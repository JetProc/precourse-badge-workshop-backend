const { createKakaoResponse } = require('../utils/kakaoResponse');

const { START_AUTH_BLOCK_ID } = require('../constants/blockId');
const { COMMON_ERRORS } = require('../constants/messages');

const Participant = require('../models/Participant');

const { getVerifiedGithubId } = require('../services/authService');

/**
 * 1. 깃헙 인증 여부를 확인하고 req.githubId를 추가합니다.
 * 인증되지 않은 경우, 인증 블록 버튼과 함께 에러를 반환합니다.
 */
const checkVerification = async (req, res, next) => {
  try {
    // 1) 사용자 챗봇 아이디 저장
    const chatbotUserId = req.body.userRequest.user.id;
    if (!chatbotUserId) {
      console.log('[Middleware FAIL] User ID not found');
      return res.status(200).json(createKakaoResponse(COMMON_ERRORS.USER_ID_NOT_FOUND));
    }

    // 2) 깃헙 아이디 인증 여부를 검증 후 실패한다면 인증 블록 폴백
    const githubId = await getVerifiedGithubId(chatbotUserId);
    if (!githubId) {
      console.log(`[Middleware FAIL] User not verified: ${chatbotUserId}`);
      return res
        .status(200)
        .json(
          createKakaoResponse(COMMON_ERRORS.NOT_VERIFIED, {}, [
            { label: '🔓 깃헙 인증하러 가기', blockId: START_AUTH_BLOCK_ID },
          ])
        );
    }

    // 3) 요청 객체에 githubId 주입
    req.githubId = githubId; //
    next();
  } catch (error) {
    console.error('Error in checkVerification middleware:', error.message, error.stack);
    next(error);
  }
};

/**
 * 3. 인증된 req.githubId를 기반으로 Participant 문서를 req.participant에 추가합니다.
 */
const loadParticipant = async (req, res, next) => {
  try {
    // 1) 깃헙 아이디 유무 검증
    if (!req.githubId) {
      console.error('[Middleware Error] loadParticipant: req.githubId is missing. checkVerification must run first.');
      return res.status(500).json(createKakaoResponse(COMMON_ERRORS.USER_ID_NOT_FOUND)); //
    }

    // 2) 사용자 정보 유무 검증
    const participant = await Participant.findOne({ githubId: req.githubId });
    if (!participant) {
      console.log(`[Middleware FAIL] Participant not found for githubId: ${req.githubId}`);
      return res.status(200).json(createKakaoResponse(COMMON_ERRORS.PARTICIPANT_NOT_FOUND));
    }

    // 3) 둘 다 존재한다면 요청 객체에 participant 정보 주입
    req.participant = participant;
    next();
  } catch (error) {
    console.error('Error in loadParticipant middleware:', error.message, error.stack);
    next(error);
  }
};

module.exports = {
  checkVerification,
  loadParticipant,
};
