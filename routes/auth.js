const express = require('express');
const router = express.Router();
require('dotenv').config();

const { createKakaoResponse } = require('../utils/kakaoResponse');
const { START_AUTH_BLOCK_ID, CHECK_AUTH_BLOCK_ID, START_MATERIAL_BLOCK_ID } = require('../constants/blockId');
const { requestGitHubDeviceCode, checkGitHubAccessToken } = require('../services/githubAuth');
const { GITHUB_AUTH_URL } = require('../constants/url');

const AuthSession = require('../models/AuthSession');

const DEFAULT_POLLING_TIME = 5;
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

// POST /api/auth/start
router.post('/start', async (req, res) => {
  try {
    const chatbotUserId = req.body.userRequest.user.id;

    if (!chatbotUserId) {
      return res.status(400).json(createKakaoResponse('오류: 사용자 ID를 식별할 수 없습니다.'));
    }

    const existingAuthData = await AuthSession.findOne({ chatbotUserId: chatbotUserId });

    if (existingAuthData && existingAuthData.status === 'verified') {
      const messages = [`${existingAuthData.githubId}님!\n이미 인증이 완료되었습니다.😎`];
      const data = { status: 'verified', githubId: existingAuthData.githubId };
      const buttons = [{ label: '➡️ 다음 단계로', blockId: START_MATERIAL_BLOCK_ID }];

      return res.status(200).json(createKakaoResponse(messages, data, buttons));
    }

    const githubAuthResult = await requestGitHubDeviceCode(GITHUB_CLIENT_ID);

    if (!githubAuthResult.success) {
      return res.status(500).json(createKakaoResponse(['오류: GitHub 인증 시작 중 문제가 발생했습니다.']));
    }

    const { device_code, user_code, interval } = githubAuthResult;

    await AuthSession.findOneAndUpdate(
      { chatbotUserId: chatbotUserId },
      {
        device_code: device_code,
        status: 'pending',
        githubId: null,
        interval: interval || DEFAULT_POLLING_TIME,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const messages = [
      `훈장을 제작하기 위해선\nGitHub 본인 인증이 필요합니다!\n\nPC/모바일에서\n${GITHUB_AUTH_URL}\n에 접속해 아래 코드를 입력해주세요. 😎`,
      `${user_code}`,
      `인증이 완료 되었다면 아래의\n[✅ 인증 완료] 버튼을 눌러주세요!`,
    ];

    const data = {
      user_code: user_code,
      verification_uri: GITHUB_AUTH_URL,
    };

    const buttons = [{ label: '✅ 인증 완료', blockId: CHECK_AUTH_BLOCK_ID }];

    res.status(200).json(createKakaoResponse(messages, data, buttons));
  } catch (error) {
    console.error('Error in /start endpoint:', error.message);
    res.status(500).json(createKakaoResponse(['오류: GitHub 인증 시작 중 문제가 발생했습니다.']));
  }
});

// POST /api/auth/check-auth
router.post('/check-auth', async (req, res) => {
  try {
    const chatbotUserId = req.body.userRequest.user.id;

    const authData = await AuthSession.findOne({ chatbotUserId: chatbotUserId });

    let messages = [];
    let data = {};
    let buttons = [];

    if (!authData) {
      messages = ['인증 세션이 없습니다.😥\n[🎖️ 신규 훈장 제작] 버튼을 다시 눌러주세요.'];
      data = { status: 'error' };
      buttons = [{ label: '🎖️ 신규 훈장 제작', blockId: START_AUTH_BLOCK_ID }];
      return res.status(200).json(createKakaoResponse(messages, data, buttons));
    }

    if (authData.status === 'verified') {
      messages = [`${authData.githubId}님!\n이미 인증이 완료되었습니다.😎`];
      data = { status: 'verified', githubId: authData.githubId };
      buttons = [{ label: '➡️ 다음 단계로', blockId: START_MATERIAL_BLOCK_ID }];
      return res.status(200).json(createKakaoResponse(messages, data, buttons));
    }

    // 인증 로직
    const githubAuthResult = await checkGitHubAccessToken(GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, authData.device_code);

    if (githubAuthResult.success) {
      const { githubId } = githubAuthResult;

      authData.status = 'verified';
      authData.githubId = githubId;
      await authData.save();

      messages = [`인증이 완료되었습니다.✅\n${githubId}님 반갑습니다!🤗`];
      data = { status: 'verified', githubId: githubId };
      buttons = [{ label: '➡️ 다음 단계로', blockId: START_MATERIAL_BLOCK_ID }];

      return res.status(200).json(createKakaoResponse(messages, data, buttons));
    } else {
      const { error, error_description } = githubAuthResult;

      if (error === 'authorization_pending') {
        messages = ['아직 사용자가 GitHub에서\n코드를 입력/승인하지 않았습니다...😥'];
        data = { status: 'pending' };
        buttons = [{ label: '🔄 다시 확인하기', blockId: CHECK_AUTH_BLOCK_ID }];
      } else if (error === 'expired_token') {
        messages = ['인증 시간이 초과되었습니다.\n처음부터 다시 시작해주세요.😓'];
        data = { status: 'expired' };

        await AuthSession.deleteOne({ chatbotUserId: chatbotUserId });

        buttons = [{ label: '🏠 처음으로', blockId: START_AUTH_BLOCK_ID }];
      } else {
        messages = [`인증 중 알 수 없는 오류가 발생했습니다. (${error_description || error})`];
        data = { status: 'error' };

        authData.status = 'error';
        await authData.save();

        buttons = [{ label: '🏠 처음으로', blockId: START_AUTH_BLOCK_ID }];
      }
      return res.status(200).json(createKakaoResponse(messages, data, buttons));
    }
  } catch (error) {
    console.error('Error in /check-auth endpoint:', error.message);
    res.status(500).json(createKakaoResponse(['오류: GitHub 인증 확인 중 문제가 발생했습니다.']));
  }
});

module.exports = router;
