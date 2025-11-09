const express = require('express');
const router = express.Router();
require('dotenv').config();

const { createKakaoResponse } = require('../utils/kakaoResponse');

const { START_AUTH_BLOCK_ID, CHECK_AUTH_BLOCK_ID, USER_INFO_INPUT_BLOCK_ID } = require('../constants/blockId');
const { GITHUB_AUTH_URL } = require('../constants/url');
const { DEFAULT_AUTH_POLLING_TIME } = require('../constants/config');

const { requestGitHubDeviceCode, checkGitHubAccessToken } = require('../services/githubAuth');

const AuthSession = require('../models/AuthSession');
const { COMMON_ERRORS, AUTH } = require('../constants/messages');
const { getAuthSessionInfo } = require('../services/authService');

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

// POST /api/auth/start
router.post('/start', async (req, res) => {
  try {
    // 챗봇id 기반으로 이미 인증되었는지 확인
    const chatbotUserId = req.body.userRequest.user.id;

    if (!chatbotUserId) {
      return res.status(200).json(createKakaoResponse(COMMON_ERRORS.USER_ID_NOT_FOUND));
    }

    const authData = await getAuthSessionInfo(chatbotUserId);

    // 인증되었다면 다음 단계로 넘어가기
    if (authData && authData.status === 'verified') {
      const messages = AUTH.START_ALREADY_VERIFIED(authData.githubId);
      const data = { status: 'verified', githubId: authData.githubId };
      const buttons = [{ label: '🎖️ 신규 훈장 제작하기', blockId: USER_INFO_INPUT_BLOCK_ID }];
      return res.status(200).json(createKakaoResponse(messages, data, buttons));
    }

    // 인증되지 않았다면 인증하기
    const { device_code, user_code, interval } = await requestGitHubDeviceCode(GITHUB_CLIENT_ID);

    await AuthSession.findOneAndUpdate(
      { chatbotUserId: chatbotUserId },
      {
        device_code: device_code,
        status: 'pending',
        githubId: null,
        interval: interval || DEFAULT_AUTH_POLLING_TIME,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 인증 확인 버튼 보내줘서 check-auth API 호출하도록 유도하기
    res
      .status(200)
      .json(
        createKakaoResponse(AUTH.START_PROMPT(user_code), {}, [{ label: '✅ 인증 완료', blockId: CHECK_AUTH_BLOCK_ID }])
      );
  } catch (error) {
    console.error('Error in /start endpoint:', error.message);
    res.status(500).json(createKakaoResponse(AUTH.START_ERROR));
  }
});

// POST /api/auth/check-auth
router.post('/check-auth', async (req, res) => {
  try {
    const chatbotUserId = req.body.userRequest.user.id;

    const authData = await getAuthSessionInfo(chatbotUserId);

    let messages = [];
    let data = {};
    let buttons = [];

    if (!authData) {
      messages = AUTH.CHECK_NO_SESSION;
      data = { status: 'error' };
      buttons = [{ label: '🎖️ 신규 훈장 제작하기', blockId: START_AUTH_BLOCK_ID }];
      return res.status(200).json(createKakaoResponse(messages, data, buttons));
    }

    if (authData.status === 'verified') {
      messages = AUTH.CHECK_ALREADY_VERIFIED(authData.githubId);
      data = { status: 'verified', githubId: authData.githubId };
      buttons = [{ label: '➡️ 다음 단계로', blockId: USER_INFO_INPUT_BLOCK_ID }];
      return res.status(200).json(createKakaoResponse(messages, data, buttons));
    }

    // 깃헙 인증 로직
    const githubAuthResult = await checkGitHubAccessToken(GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, authData.device_code);

    // 인증 성공 시 DB 업데이트 및 다음 단계 진행
    if (githubAuthResult.success) {
      const { githubId } = githubAuthResult;
      authData.status = 'verified';
      authData.githubId = githubId;
      await authData.save();

      messages = AUTH.CHECK_SUCCESS(githubId);
      data = { status: 'verified', githubId: githubId };
      buttons = [{ label: '➡️ 다음 단계로', blockId: USER_INFO_INPUT_BLOCK_ID }];

      return res.status(200).json(createKakaoResponse(messages, data, buttons));
    }
    //인증 실패 시 에러 메시지 출력
    else {
      const { error, error_description } = githubAuthResult;

      if (error === 'authorization_pending') {
        messages = AUTH.CHECK_PENDING;
        data = { status: 'pending' };
        buttons = [{ label: '🔄 다시 확인하기', blockId: CHECK_AUTH_BLOCK_ID }];
      } else if (error === 'expired_token') {
        messages = AUTH.CHECK_EXPIRED;
        data = { status: 'expired' };
        await AuthSession.deleteOne({ chatbotUserId: chatbotUserId });
        buttons = [{ label: '🏠 처음으로', blockId: START_AUTH_BLOCK_ID }];
      } else {
        messages = AUTH.CHECK_ERROR_UNKNOWN(error_description || error);
        data = { status: 'error' };
        authData.status = 'error';
        await authData.save();
        buttons = [{ label: '🏠 처음으로', blockId: START_AUTH_BLOCK_ID }];
      }
      return res.status(200).json(createKakaoResponse(messages, data, buttons));
    }
  } catch (error) {
    console.error('Error in /check-auth endpoint:', error.message);
    res.status(500).json(createKakaoResponse(AUTH.CHECK_ERROR_INTERNAL));
  }
});

module.exports = router;
