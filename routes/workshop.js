const express = require('express');
const router = express.Router();

require('dotenv').config();

const { createKakaoResponse } = require('../utils/kakaoResponse');
const {
  HIDDEN_INPUT_BLOCK_ID,
  START_AUTH_BLOCK_ID,
  REVIEW_INPUT_BLOCK_ID,
  SUBMIT_ORDER_BLOCK_ID,
  SET_TITLE_BLOCK_ID,
  GET_TITLE_BLOCK_ID,
  SHOW_MY_BADGE_BLOCK_ID,
} = require('../constants/blockId');
const { WORKSHOP, COMMON_ERRORS } = require('../constants/messages');
const { ACHIEVEMENT_DEFINITIONS } = require('../constants/definition');

// 모델 import
const Participant = require('../models/Participant');
const PrecourseSetting = require('../models/PrecourseSetting');

// 서비스 import
const { getVerifiedGithubId } = require('../services/authService');
const { getGithubEvents } = require('../services/githubService');
const { analyzeGithubEvents, calculateResults } = require('../services/githubAnalyzer');

/*
 * POST /api/workshop/setUserInfo
 */
router.post('/setUserInfo', async (req, res) => {
  try {
    const chatbotUserId = req.body.userRequest.user.id;

    // 1. 챗봇id로 사용자 조회하여 깃헙id 가져오기
    const githubId = await getVerifiedGithubId(chatbotUserId);
    if (!githubId) {
      console.log(`[InitParticipant FAIL] User not verified: ${chatbotUserId}`);
      return res
        .status(200)
        .json(
          createKakaoResponse(COMMON_ERRORS.NOT_VERIFIED, {}, [
            { label: '🔓 깃헙 인증하러 가기', blockId: START_AUTH_BLOCK_ID },
          ])
        );
    }

    // 2. 챗봇에서 전달받은 파라미터 호출 및 가공(기수, 닉네임)
    const { classYear, nickname } = req.body.action.params;

    const formattedNickname = nickname.toUpperCase();
    const parsedClassYear = parseInt(classYear, 10);

    // 3. Participant 모델에 데이터 저장 또는 업데이트 (upsert)
    const participant = await Participant.findOneAndUpdate(
      { githubId: githubId }, // 찾는 조건
      {
        githubId: githubId,
        classYear: parsedClassYear, // 기수 (숫자)
        nickname: formattedNickname, // 닉네임
      },
      {
        new: true, // 업데이트된 문서를 반환
        upsert: true, // 문서가 없으면 새로 생성
        setDefaultsOnInsert: true, // 새 문서 생성 시 스키마의 default 값 적용
      }
    );

    console.log(
      `[Order SUCCESS] Participant ${githubId} updated/created with classYear: ${classYear}, nickname: ${formattedNickname}`
    );

    // 4. (임시) 훈장 제작 완료 메시지 및 다음 단계 퀵 버튼
    return res.status(200).json(
      createKakaoResponse(
        WORKSHOP.INIT_SUCCESS(formattedNickname), // ✨ [수정] 상수 메시지 사용
        {},
        [{ label: '✨ 질문 받으러 가기 ', blockId: HIDDEN_INPUT_BLOCK_ID }]
      )
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
 * /api/workshop/setHiddenInfo
 */
router.post('/setHiddenInfo', async (req, res) => {
  try {
    const chatbotUserId = req.body.userRequest.user.id;

    // 1. 인증 정보 확인
    const githubId = await getVerifiedGithubId(chatbotUserId);
    if (!githubId) {
      return res
        .status(200)
        .json(
          createKakaoResponse(COMMON_ERRORS.NOT_VERIFIED, {}, [
            { label: '🔓 깃헙 인증하러 가기', blockId: START_AUTH_BLOCK_ID },
          ])
        );
    }

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
    const participant = await Participant.findOneAndUpdate(
      { githubId: githubId },
      {
        'inputs.hiddenAnswers.tdd_attempt': tdd_attempt === 'Y',
        'inputs.hiddenAnswers.readme_master': readme_master === 'Y',
        'inputs.hiddenAnswers.review_study': review_study === 'Y',
        'inputs.hiddenAnswers.review_thanked': review_thanked === 'Y',
        'inputs.hiddenAnswers.blog_share': blog_share === 'Y',
        'inputs.hiddenAnswers.community_writer': community_writer === 'Y',
        'inputs.hiddenAnswers.community_answerer': community_answerer === 'Y',
        analysisStatus: 'processing', // 3. 분석 '진행 중'으로 상태 변경
      },
      { new: true }
    );

    if (!participant) {
      return res.status(200).json(createKakaoResponse(COMMON_ERRORS.PARTICIPANT_NOT_FOUND));
    }

    console.log(`[SetHiddenInfo] Hidden info updated for ${githubId}.`);

    // 4. [즉시 응답] 사용자에게 회고 입력을 요청 (타임아웃 방지)
    res
      .status(200)
      .json(
        createKakaoResponse(WORKSHOP.SET_HIDDEN_SUCCESS, {}, [
          { label: '📝 회고 작성하기', blockId: REVIEW_INPUT_BLOCK_ID },
        ])
      );

    // 5. (응답 보낸 후) GitHub 분석 시작
    (async () => {
      try {
        console.log(`[Background Job] Analysis started for ${githubId}`);
        const setting = await PrecourseSetting.findOne({ classYear: participant.classYear });
        if (!setting || !setting.weeks || setting.weeks.length === 0) {
          throw new Error('PrecourseSetting not found.');
        }

        const githubEvents = await getGithubEvents(githubId);
        const stats = await analyzeGithubEvents(githubEvents, setting.weeks);
        const results = calculateResults(stats, participant.inputs.hiddenAnswers);

        // DB에 최종 결과 및 '완료' 상태 저장
        participant.stats = stats;
        participant.results = results;
        participant.customization.equippedTitle = results.titles[0] || '[프리코스 완주자]';
        participant.analysisStatus = 'completed'; // 분석 '완료'
        await participant.save();

        console.log(`[Background Job] Analysis completed for ${githubId}`);
      } catch (error) {
        console.error(`[Background Job] Error during analysis for ${githubId}:`, error.message);
        // 에러 상태 저장
        await Participant.updateOne({ githubId: githubId }, { analysisStatus: 'error' });
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
 * /api/workshop/setReview
 */
router.post('/setReview', async (req, res) => {
  try {
    const chatbotUserId = req.body.userRequest.user.id;

    // 1. 인증 정보 확인: githubId를 가져옵니다.
    const githubId = await getVerifiedGithubId(chatbotUserId);
    if (!githubId) {
      console.log(`[SetReflection FAIL] User not verified: ${chatbotUserId}`);
      return res
        .status(200)
        .json(
          createKakaoResponse(COMMON_ERRORS.NOT_VERIFIED, {}, [
            { label: '🔓 깃헙 인증하러 가기', blockId: START_AUTH_BLOCK_ID },
          ])
        );
    }

    const { reflection } = req.body.action.params;

    if (!reflection || reflection.trim() === '') {
      console.log(`[SetReflection FAIL] Reflection is empty for ${githubId}`);
      return res.status(200).json(createKakaoResponse(WORKSHOP.SET_REFLECTION_EMPTY));
    }

    // 3. Participant 문서 업데이트
    const participant = await Participant.findOneAndUpdate(
      { githubId: githubId }, // 찾는 조건
      {
        'customization.reflection': reflection,
      },
      {
        new: true,
      }
    );

    if (!participant) {
      console.warn(`[SetReflection WARN] Participant not found for githubId: ${githubId}`);
      return res.status(200).json(createKakaoResponse(COMMON_ERRORS.PARTICIPANT_NOT_FOUND));
    }

    console.log(`[SetReflection SUCCESS] Reflection updated for ${githubId}`);

    // 3. [핵심] GitHub 분석 상태 확인
    switch (participant.analysisStatus) {
      case 'completed':
        // 4. (분석 완료) 스탯/업적/칭호 요약본 생성
        const { stats, results, nickname } = participant;

        // 4-1. 스탯 요약 (이모지 + 한국어 포맷)
        const statsSummary = [
          `🚀 총 커밋: ${stats.commitCount}회`,
          `👀 총 리뷰: ${stats.reviewCount}회`,
          `🔥 최대 연속 커밋: ${stats.commitStreakMax}일`,
          `🚂 하루 최대 커밋: ${stats.commitMonsterMax}회`,
          `☀️ 주말 커밋: ${stats.commitWeekendCount}회`,
          `🧹 리팩토링 커밋: ${stats.commitRefactorCount}회`,
          `🐛 버그 수정 커밋: ${stats.commitFixCount}회`,
          `🧐 셀프 리뷰: ${stats.reviewSelfCount}회`,
        ];

        // Boolean 값들은 true일 때만 의미 있는 메시지 추가
        if (stats.prOpened) statsSummary.push('✅ 첫 PR 생성 완료');
        if (stats.nightowl) statsSummary.push('🌙 올빼미 활동 (자정~새벽 3시)');
        if (stats.earlybird) statsSummary.push('☀️ 얼리버드 활동 (새벽 3~6시)');
        if (stats.deadlineFighter) statsSummary.push('⏱️ 데드라인 파이터 (마감 1시간 전 커밋)');
        if (stats.commitFirstDay) statsSummary.push('🥇 미션 첫날 커밋');
        if (stats.commitLastDay) statsSummary.push('🏁 미션 마지막 날 커밋');

        const statsMessage = statsSummary.join('\n');

        // 4-1-2. 스탯 헤더 (사용자 요청 형식)
        const statsHeader = `그전에, 리코스 기간동안\n${nickname}님의 활동 내역입니다!`;
        // ===== ⬆️ [핵심 수정] ⬆️ =====

        // 4-3. 메시지 조합 (기존 WORKSHOP.SET_REFLECTION_SUCCESS 메시지는 사용하지 않음)
        const messages = WORKSHOP.SET_REFLECTION_SUCCESS(nickname, statsMessage);
        return res
          .status(200)
          .json(createKakaoResponse(messages, {}, [{ label: '🏭 훈장 맡기기', blockId: SUBMIT_ORDER_BLOCK_ID }]));

      case 'processing':
      case 'pending':
        // 5. (분석 중) "아직 분석 중" 응답 반환 (기존과 동일)
        return res
          .status(200)
          .json(
            createKakaoResponse(WORKSHOP.SET_REFLECTION_PENDING, {}, [
              { label: '📝 회고 다시 제출', blockId: REVIEW_INPUT_BLOCK_ID },
            ])
          );

      case 'error':
      default:
        // 6. (분석 오류) 에러 응답 반환 (기존과 동일)
        return res.status(200).json(createKakaoResponse(WORKSHOP.ORDER_ERROR));
    }
  } catch (error) {
    console.error('Error in /api/workshop/setReflection endpoint:', error.message, error.stack);
    res.status(500).json(createKakaoResponse(WORKSHOP.SET_REFLECTION_ERROR));
  }
});

/**
 * /api/workshop/order
 */
router.post('/order', async (req, res) => {
  try {
    const chatbotUserId = req.body.userRequest.user.id;

    // 1. 인증 정보 확인
    const githubId = await getVerifiedGithubId(chatbotUserId);
    if (!githubId) {
      return res
        .status(200)
        .json(
          createKakaoResponse(COMMON_ERRORS.NOT_VERIFIED, {}, [
            { label: '🔓 깃헙 인증하러 가기', blockId: START_AUTH_BLOCK_ID },
          ])
        );
    }

    // 2. 참가자 정보 조회
    const participant = await Participant.findOne({ githubId: githubId });
    if (!participant) {
      return res.status(200).json(createKakaoResponse(COMMON_ERRORS.PARTICIPANT_NOT_FOUND));
    }

    // 3. [핵심] 분석 상태 확인
    switch (participant.analysisStatus) {
      case 'completed':
        // 4. (분석 완료) 성공 결과 반환
        const results = participant.results;

        // 업적/칭호 ID 목록을 이름(텍스트) 목록으로 변환
        const achievementNames = results.achievements
          .map((id) => (ACHIEVEMENT_DEFINITIONS[id] ? ACHIEVEMENT_DEFINITIONS[id].name : id))
          .join('\n'); // 줄바꿈으로 구분

        const titleNames = results.titles.join('\n'); // 줄바꿈으로 구분

        // [수정] 기본 메시지 생성
        const messages = WORKSHOP.ORDER_SUCCESS(
          participant.nickname,
          participant.customization.equippedTitle //
        );

        // [수정] 업적/칭호 목록 텍스트를 메시지 중간에 삽입
        messages.splice(
          1,
          0,
          `✨ 획득한 업적 (${results.achievements.length}개)\n${achievementNames || '없음'}`,
          `⭐ 획득한 칭호 (${results.titles.length}개)\n${titleNames || '없음'}`
        );

        // [수정] 퀵 버튼: '칭호 변경하기' 1개만 제공
        const buttons = [
          {
            label: '🎨 칭호 변경하기',
            blockId: GET_TITLE_BLOCK_ID, // 칭호 선택 블록으로 이동
          },
        ];

        return res.status(200).json(createKakaoResponse(messages, {}, buttons));

      case 'processing':
      case 'pending':
        // 5. (분석 중) "아직 분석 중" 응답 반환 (기존과 동일)
        return res
          .status(200)
          .json(
            createKakaoResponse(WORKSHOP.ORDER_PENDING, {}, [
              { label: '🏭 훈장 맡기기', blockId: SUBMIT_ORDER_BLOCK_ID },
            ])
          );

      case 'error':
      default:
        // 6. (분석 오류) 에러 응답 반환 (기존과 동일)
        return res.status(200).json(createKakaoResponse(WORKSHOP.ORDER_ERROR));
    }
  } catch (error) {
    console.error('Error in /api/workshop/submitOrder endpoint:', error.message, error.stack);
    res.status(500).json(createKakaoResponse(WORKSHOP.ORDER_ERROR));
  }
});

/**
 * ========================================
 * (신규) /api/workshop/getTitles
 * 칭호 변경을 위해 획득한 칭호 목록을 퀵 버튼으로 반환
 * ========================================
 */
router.post('/getTitles', async (req, res) => {
  try {
    const chatbotUserId = req.body.userRequest.user.id;
    const githubId = await getVerifiedGithubId(chatbotUserId);
    if (!githubId) {
      return res
        .status(200)
        .json(
          createKakaoResponse(COMMON_ERRORS.NOT_VERIFIED, {}, [
            { label: '🔓 깃헙 인증하러 가기', blockId: START_AUTH_BLOCK_ID },
          ])
        );
    }

    const participant = await Participant.findOne({ githubId: githubId });
    if (!participant || participant.analysisStatus !== 'completed') {
      return res.status(200).json(createKakaoResponse(COMMON_ERRORS.PARTICIPANT_NOT_FOUND));
    }
    console.log(participant.results);

    // 획득한 칭호 목록을 퀵 버튼으로 변환
    const buttons = participant.results.titles.map((title) => ({
      label: title,
      blockId: SET_TITLE_BLOCK_ID, // 퀵 버튼이 /setTitle API를 호출하도록 연결
      messageText: title, // 원본 칭호(대괄호 포함)를 발화로 전송
    }));

    // "변경할 칭호를 선택해주세요" 메시지와 퀵 버튼 전송
    return res.status(200).json(createKakaoResponse(WORKSHOP.GET_TITLES_SUCCESS, {}, buttons));
  } catch (error) {
    console.error('Error in /api/workshop/getTitles endpoint:', error.message, error.stack);
    res.status(500).json(createKakaoResponse(WORKSHOP.SET_TITLE_ERROR));
  }
});

/*** ========================================
 * (수정) /api/workshop/setTitle
 * 칭호 '저장' 전용 API
 * ========================================
 */
router.post('/setTitle', async (req, res) => {
  try {
    const chatbotUserId = req.body.userRequest.user.id;

    // 1. 인증 정보 확인
    const githubId = await getVerifiedGithubId(chatbotUserId);
    if (!githubId) {
      return res
        .status(200)
        .json(
          createKakaoResponse(COMMON_ERRORS.NOT_VERIFIED, {}, [
            { label: '🔓 깃헙 인증하러 가기', blockId: START_AUTH_BLOCK_ID },
          ])
        );
    }

    console.log(req.body);

    // 2. 사용자가 퀵 버튼을 눌러서 전달된 'utterance' (칭호)
    const chosenTitle = req.body.userRequest.utterance.trim();

    // 3. 참가자 정보 조회
    const participant = await Participant.findOne({ githubId: githubId });
    if (!participant) {
      return res.status(200).json(createKakaoResponse(COMMON_ERRORS.PARTICIPANT_NOT_FOUND));
    }

    // 4. 사용자가 선택한 칭호가 유효한지 확인
    if (!participant.results.titles.includes(chosenTitle)) {
      console.warn(`[SetTitle WARN] User ${githubId} tried to set invalid title: ${chosenTitle}`);

      // (예외 처리) 칭호가 유효하지 않으면, 다시 /getTitles의 퀵 버튼을 보여줌
      const buttons = participant.results.titles.map((title) => ({
        label: title,
        blockId: SET_TITLE_BLOCK_ID, // 다시 /setTitle을 호출
        messageText: title,
      }));
      return res.status(200).json(createKakaoResponse(WORKSHOP.SET_TITLE_INVALID, {}, buttons));
    }

    // 5. 유효한 칭호 -> DB에 저장
    participant.customization.equippedTitle = chosenTitle;
    await participant.save();

    console.log(`[SetTitle SUCCESS] User ${githubId} set title to: ${chosenTitle}`);

    // 6. 최종 완료 응답
    return res
      .status(200)
      .json(
        createKakaoResponse(WORKSHOP.SET_TITLE_SUCCESS(chosenTitle), {}, [
          { label: '🏆 내 훈장 보기', blockId: SHOW_MY_BADGE_BLOCK_ID },
        ])
      );
  } catch (error) {
    console.error('Error in /api/workshop/setTitle endpoint:', error.message, error.stack);
    res.status(500).json(createKakaoResponse(WORKSHOP.SET_TITLE_ERROR));
  }
});

module.exports = router;
