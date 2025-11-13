const express = require('express');
const router = express.Router();

require('dotenv').config();

// util import
const { createKakaoResponse } = require('../utils/kakaoResponse');

// 상수 import
const {
  HIDDEN_INPUT_BLOCK_ID,
  REVIEW_INPUT_BLOCK_ID,
  CHECK_GITHUB_ANALYSIS_STATUS_BLOCK_ID,
  SET_TITLE_BLOCK_ID,
  FINISH_FLOW_BLOCK_ID,
} = require('../constants/blockId');
const { WORKSHOP, COMMON_ERRORS } = require('../constants/messages');
const { DEFAULT_TITLE_DEFINITION } = require('../constants/config');

// 모델 import
const Participant = require('../models/Participant');
const PrecourseSetting = require('../models/PrecourseSetting');

// 서비스 import
const { getGithubEvents } = require('../services/githubService');
const { analyzeGithubEvents, calculateResults } = require('../services/githubAnalyzer');
const { createCompletedResponse } = require('../services/workshopService');

// 미들웨어 import
const { checkVerification, loadParticipant } = require('../middleware/auth');
const { checkAnalysisCompleted, checkStatusForReview } = require('../middleware/workshop');

/**
 * routes: /api/workshop/setUserInfo
 * middleware: 1.인증 확인
 * description: 닉네임, 기수 정보를 받아 Participant 문서를 생성(또는 업데이트)합니다.
 */
router.post('/setUserInfo', checkVerification, async (req, res) => {
  try {
    // 1. 챗봇에서 전달받은 파라미터 호출 및 가공(기수, 닉네임)
    const { classYear, nickname } = req.body.action.params;

    const parsedClassYear = parseInt(classYear, 10);
    const formattedNickname = nickname.toUpperCase();

    // 2. Participant 모델에 데이터 저장 또는 업데이트 (upsert)
    const participant = await Participant.findOneAndUpdate(
      { githubId: req.githubId }, // 찾는 조건
      {
        githubId: req.githubId,
        classYear: parsedClassYear,
        nickname: formattedNickname,
      },
      {
        new: true,
        upsert: true, // 문서가 없으면 새로 생성
        setDefaultsOnInsert: true,
      }
    );

    console.log(
      `[Order SUCCESS] Participant ${req.githubId} updated/created with classYear: ${classYear}, nickname: ${formattedNickname}`
    );

    // 3. 다음 단계 퀵 버튼
    return res
      .status(200)
      .json(
        createKakaoResponse(WORKSHOP.INIT_SUCCESS(formattedNickname), {}, [
          { label: '✨ 질문 받으러 가기 ', blockId: HIDDEN_INPUT_BLOCK_ID },
        ])
      );
  } catch (error) {
    console.error('Error in /api/workshop/setUserInfo endpoint:', error.message, error.stack);
    if (error.name === 'CastError') {
      return res.status(200).json(createKakaoResponse(COMMON_ERRORS.CAST_ERROR));
    }
    res.status(500).json(createKakaoResponse(WORKSHOP.INIT_ERROR));
  }
});

/**
 * routes: /api/workshop/setHiddenInfo
 * middleware: 1.인증 확인, 2.참가자 로드
 * description: 히든 질문 7개에 대한 답변을 저장하고, 백그라운드 분석을 시작합니다.
 */
router.post('/setHiddenInfo', checkVerification, loadParticipant, async (req, res) => {
  try {
    // 1. 사용자 스키마 호출
    const { participant } = req;

    const {
      tdd_attempt,
      readme_master,
      review_study,
      review_thanked,
      blog_share,
      community_writer,
      community_answerer,
    } = req.body.action.params;

    // 2. Participant 문서 업데이트
    // 값이 'Y'라면 boolean값을 true로 저장하는 로직
    participant.inputs.hiddenAnswers = {
      tdd_attempt: tdd_attempt === 'Y',
      readme_master: readme_master === 'Y',
      review_study: review_study === 'Y',
      review_thanked: review_thanked === 'Y',
      blog_share: blog_share === 'Y',
      community_writer: community_writer === 'Y',
      community_answerer: community_answerer === 'Y',
    };
    // 3. 분석 '진행 중'으로 상태 변경
    participant.analysisStatus = 'processing';

    // 4. DB에 저장
    await participant.save();
    console.log(`[SetHiddenInfo] Hidden info updated for ${participant.githubId}.`);

    // 5. 사용자에게 회고 입력을 요청 (타임아웃 방지)
    res
      .status(200)
      .json(
        createKakaoResponse(WORKSHOP.SET_HIDDEN_SUCCESS, {}, [
          { label: '📝 회고 작성하기', blockId: REVIEW_INPUT_BLOCK_ID },
        ])
      );

    // 6. (응답 보낸 후) 백그라운드에서 GitHub 분석 시작
    (async () => {
      try {
        console.log(`[Background Job] Analysis started for ${participant.githubId}`);

        const setting = await PrecourseSetting.findOne({ classYear: participant.classYear });
        if (!setting || !setting.weeks || setting.weeks.length === 0) {
          throw new Error('PrecourseSetting not found.');
        }

        const githubEvents = await getGithubEvents(participant.githubId);
        const stats = await analyzeGithubEvents(githubEvents, setting.weeks);
        const results = calculateResults(stats, participant.inputs.hiddenAnswers);

        // DB에 최종 결과 및 '완료' 상태 저장
        participant.stats = stats;
        participant.results = results;
        participant.customization.equippedTitle = results.titles[0] || DEFAULT_TITLE_DEFINITION;
        participant.analysisStatus = 'completed';
        await participant.save();

        console.log(`[Background Job] Analysis completed for ${participant.githubId}`);
      } catch (error) {
        console.error(`[Background Job] Error during analysis for ${participant.githubId}:`, error.message);
        await Participant.updateOne({ githubId: participant.githubId }, { analysisStatus: 'error' });
      }
    })();
  } catch (error) {
    console.error('Error in /api/workshop/setHiddenInfo endpoint:', error.message, error.stack);
    if (error.name === 'CastError') {
      return res.status(200).json(createKakaoResponse(COMMON_ERRORS.CAST_ERROR));
    }
    res.status(500).json(createKakaoResponse(WORKSHOP.SET_HIDDEN_ERROR));
  }
});

/**
 * routes: /api/workshop/setReview
 * middleware: 1.인증 확인, 2.참가자 로드, 3-2.'pending' 상태 차단
 * description: 회고를 저장하고, 분석 상태에 따라 분기 처리합니다.
 */
router.post('/setReview', checkVerification, loadParticipant, checkStatusForReview, async (req, res) => {
  try {
    // 1. 사용자 스키마 및 챗봇에서 전달 받은 회고 내용 호출
    const { participant } = req;
    const { reflection } = req.body.action.params;

    if (!reflection || reflection.trim() === '') {
      return res.status(200).json(createKakaoResponse(WORKSHOP.SET_REFLECTION_EMPTY));
    }

    // 2. 회고 db에 저장
    participant.customization.reflection = reflection;
    await participant.save();
    console.log(`[SetReflection SUCCESS] Reflection updated for ${participant.githubId}.`);

    // 3. 현재 분석 상태에 따라 분기 처리
    switch (participant.analysisStatus) {
      // 분석 완료
      case 'completed':
        return res.status(200).json(createCompletedResponse(participant));

      // 처리 중
      case 'processing':
        return res.status(200).json(
          createKakaoResponse(WORKSHOP.ANALYSIS_PENDING, {}, [
            {
              label: '✅ 분석 완료 확인',
              blockId: CHECK_GITHUB_ANALYSIS_STATUS_BLOCK_ID,
            },
          ])
        );
      case 'error':
      default:
        return res.status(200).json(createKakaoResponse(WORKSHOP.ORDER_ERROR));
    }
  } catch (error) {
    console.error('Error in /api/workshop/setReflection endpoint:', error.message, error.stack);
    res.status(500).json(createKakaoResponse(WORKSHOP.SET_REFLECTION_ERROR));
  }
});

/**
 * routes: /api/workshop/checkGithubAnalysisStatus
 * middleware: 1. 인증 확인, 2. 참가자 로드
 * description: 현재 분석 상태를 확인하고, 상태에 따라 분기 처리합니다.
 */
router.post('/checkGithubAnalysisStatus', checkVerification, loadParticipant, async (req, res) => {
  try {
    // 1. 사용자 스키마 호출
    const { participant } = req;

    // 2. 단계 확인
    // 2-1. pending 상태일 땐 '히든 질문 블록' 폴백
    if (participant.analysisStatus === 'pending') {
      console.warn(`[checkStatus WARN] User ${participant.githubId} skipped hidden questions.`);
      return res
        .status(200)
        .json(
          createKakaoResponse(WORKSHOP.STEP_SKIPPED_HIDDEN_QUESTIONS, {}, [
            { label: '✨ 질문 받으러 가기', blockId: HIDDEN_INPUT_BLOCK_ID },
          ])
        );
    }

    // 2-2. 단계에 따라 분기 처리
    switch (participant.analysisStatus) {
      case 'completed':
        return res.status(200).json(createCompletedResponse(participant));

      case 'processing':
        return res.status(200).json(
          createKakaoResponse(WORKSHOP.ANALYSIS_PENDING, {}, [
            {
              label: '✅ 분석 완료 확인',
              blockId: CHECK_GITHUB_ANALYSIS_STATUS_BLOCK_ID,
            },
          ])
        );
      case 'error':
      default:
        return res.status(200).json(createKakaoResponse(WORKSHOP.ORDER_ERROR));
    }
  } catch (error) {
    console.error('Error in /api/workshop/checkGithubAnalysisStatus endpoint:', error.message, error.stack);
    res.status(500).json(createKakaoResponse(WORKSHOP.SET_REFLECTION_ERROR));
  }
});

/**
 * routes: /api/workshop/getTitles
 * middleware: 1.인증 확인, 2.참가자 로드, 3-1.'completed' 상태 확인
 * description: 획득한 칭호 목록을 퀵 버튼으로 반환합니다.
 */
router.post('/getTitles', checkVerification, loadParticipant, checkAnalysisCompleted, async (req, res) => {
  try {
    // 1. 사용자 스키마 호출
    const { participant } = req;

    // 2. 획득한 칭호 목록을 퀵 버튼으로 변환
    const buttons = participant.results.titles.map((title) => ({
      label: title,
      blockId: SET_TITLE_BLOCK_ID, // 퀵 버튼을 누르면 /setTitle API를 호출하도록 연결
      messageText: title,
    }));

    // 2-1. 바꾸지 않는 선택지도 맨 앞에 추가!
    buttons.unshift({
      label: '🙅 바꾸지 않을래요',
      blockId: FINISH_FLOW_BLOCK_ID,
      messageText: 'cancel',
    });

    return res.status(200).json(createKakaoResponse(WORKSHOP.GET_TITLES_SUCCESS, {}, buttons));
  } catch (error) {
    console.error('Error in /api/workshop/getTitles endpoint:', error.message, error.stack);
    res.status(500).json(createKakaoResponse(WORKSHOP.SET_TITLE_ERROR));
  }
});

/**
 * routes: /api/workshop/setTitle
 * middleware: 1.인증 확인, 2.참가자 로드, 3-1. 'completed' 상태 확인
 * description: 사용자가 선택한 칭호를 저장합니다.
 */
router.post('/setTitle', checkVerification, loadParticipant, checkAnalysisCompleted, async (req, res) => {
  try {
    // 1. 사용자 스키마 호출
    const { participant } = req;

    // 2. 사용자가 퀵 버튼을 눌러서 전달된 발화(utterance) 호출
    const chosenTitle = req.body.userRequest.utterance.trim();

    // 3. 동적으로 사용자 깃헙 아이디를 주소로 하는 url 생성
    const webLinkUrl = `${process.env.BASE_URL}/${participant.githubId}`;
    // 3-1. url이 버튼으로 반영된 텍스트 카드 생성
    const webLinkButton = {
      label: '🏆 내 훈장 보러가기',
      action: 'webLink',
      webLinkUrl: webLinkUrl,
    };

    // 4. 사용자가 선택한 칭호가 유효한지 확인
    if (!participant.results.titles.includes(chosenTitle)) {
      console.warn(`[SetTitle WARN] User ${participant.githubId} tried to set invalid title: ${chosenTitle}`);

      const buttons = participant.results.titles.map((title) => ({
        label: title,
        blockId: SET_TITLE_BLOCK_ID,
        messageText: title,
      }));
      buttons.unshift({
        label: '🙅 바꾸지 않을래요',
        blockId: FINISH_FLOW_BLOCK_ID, //바꾸지 않는다면 바로 /finish API 호출
        messageText: 'cancel',
      });
      return res.status(200).json(createKakaoResponse(WORKSHOP.SET_TITLE_INVALID, {}, buttons));
    }

    // 5. 유효한 칭호라면 DB에 저장
    participant.customization.equippedTitle = chosenTitle;
    await participant.save();

    console.log(`[SetTitle SUCCESS] User ${participant.githubId} set title to: ${chosenTitle}`);

    // 6. 최종 완료 응답
    return res.status(200).json(
      createKakaoResponse(
        WORKSHOP.SET_TITLE_SUCCESS(chosenTitle),
        {},
        [webLinkButton] // 웹 링크 버튼 반환
      )
    );
  } catch (error) {
    console.error('Error in /api/workshop/setTitle endpoint:', error.message, error.stack);
    res.status(500).json(createKakaoResponse(WORKSHOP.SET_TITLE_ERROR));
  }
});

/**
 * routes: /api/workshop/finish
 * middelware: 1.인증 확인, 2.참가자 로드, 3-1.'completed' 상태 확인
 * description: 칭호 변경을 스킵하고 훈장 웹 링크를 반환합니다.
 */
router.post('/finish', checkVerification, loadParticipant, checkAnalysisCompleted, async (req, res) => {
  try {
    // 1. 사용자 스키마 호출
    const { participant } = req;

    // 2. 동적으로 사용자 깃헙 아이디를 주소로 하는 url 생성
    const webLinkUrl = `${process.env.BASE_URL}/${participant.githubId}`;
    // 2-1. url이 버튼으로 반영된 텍스트 카드 생성
    const webLinkButton = {
      label: '🏆 내 훈장 보러가기',
      action: 'webLink',
      webLinkUrl: webLinkUrl,
    };

    console.log(`[Flow FINISHED] User ${participant.githubId} skipped title change.`);

    // 3.'바꾸지 않음' 메시지와 함께 웹 링크 버튼 반환
    return res.status(200).json(
      createKakaoResponse(
        WORKSHOP.SET_TITLE_CANCELED(participant.customization.equippedTitle),
        {},
        [webLinkButton] // 웹 링크 버튼 반환
      )
    );
  } catch (error) {
    console.error('Error in /api/workshop/finish endpoint:', error.message, error.stack);
    res.status(500).json(createKakaoResponse(WORKSHOP.SET_TITLE_ERROR));
  }
});

module.exports = router;
