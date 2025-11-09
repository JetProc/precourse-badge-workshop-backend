const express = require('express');
const router = express.Router();

require('dotenv').config();

const { createKakaoResponse } = require('../utils/kakaoResponse');
const {
  HIDDEN_INPUT_BLOCK_ID,
  START_AUTH_BLOCK_ID,
  REVIEW_INPUT_BLOCK_ID,
  SUBMIT_ORDER_BLOCK_ID,
} = require('../constants/blockId');

// 모델 import
const Participant = require('../models/Participant');

// 서비스 imoprt
const { getVerifiedGithubId } = require('../services/authService');
const { WORKSHOP, COMMON_ERRORS } = require('../constants/messages');

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

    // 1. 인증 정보 확인: githubId를 가져옵니다.
    const githubId = await getVerifiedGithubId(chatbotUserId);
    if (!githubId) {
      console.log(`[SetHiddenInfo FAIL] User not verified: ${chatbotUserId}`);
      return res
        .status(200)
        .json(
          createKakaoResponse(COMMON_ERRORS.NOT_VERIFIED, {}, [
            { label: '🎖️ 신규 훈장 제작하기', blockId: START_AUTH_BLOCK_ID },
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

    console.log(`[SetHiddenInfo] Received from chatbot:`, {
      tdd_attempt,
      readme_master,
      review_study,
      review_thanked,
      blog_share,
      community_writer,
      community_answerer,
    });

    // 3. Participant 문서 업데이트
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
      },
      {
        new: true,
      }
    );

    if (!participant) {
      console.warn(`[SetHiddenInfo WARN] Participant not found for githubId: ${githubId}`);
      return res.status(200).json(createKakaoResponse(COMMON_ERRORS.PARTICIPANT_NOT_FOUND));
    }

    console.log(`[SetHiddenInfo SUCCESS] Hidden info updated for ${githubId}`);

    return res
      .status(200)
      .json(
        createKakaoResponse(WORKSHOP.SET_HIDDEN_SUCCESS, {}, [
          { label: '📝 회고 작성하기', blockId: REVIEW_INPUT_BLOCK_ID },
        ])
      );
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
            { label: '🎖️ 신규 훈장 제작하기', blockId: START_AUTH_BLOCK_ID },
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

    // 4. 다음 단계 (최종 훈장 제작 시작)로 안내하는 응답
    return res.status(200).json(
      createKakaoResponse(WORKSHOP.SET_REFLECTION_SUCCESS, {}, [
        {
          label: '🏭 훈장 맡기기',
          blockId: SUBMIT_ORDER_BLOCK_ID,
        },
      ])
    );
  } catch (error) {
    console.error('Error in /api/workshop/setReflection endpoint:', error.message, error.stack);
    res.status(500).json(createKakaoResponse(WORKSHOP.SET_REFLECTION_ERROR));
  }
});

module.exports = router;
