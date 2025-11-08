const express = require('express');
const router = express.Router();
const axios = require('axios');
require('dotenv').config();

const { createKakaoResponse } = require('../utils/kakaoResponse');
const { START_AUTH_BLOCK_ID, CHECK_AUTH_BLOCK_ID, START_MATERIAL_BLOCK_ID } = require('../constants/blockId');
const { requestGitHubDeviceCode, checkGitHubAccessToken } = require('../services/githubAuth');
const { GITHUB_DEVICE_AUTH_URL } = require('../constants/url');

const DEFAULT_POLLING_TIME = 5;

// (임시) 메모리 저장소
const authStore = {};

// POST /api/auth/start
router.post('/start', async (req, res) => {
  try {
    const chatbotUserId = req.body.userRequest.user.id;

    // 챗봇 유저 아이디가 없을 때 return
    if (!chatbotUserId) {
      return res.status(400).json(createKakaoResponse('오류: 사용자 ID를 식별할 수 없습니다.'));
    }

    const existingAuthData = authStore[chatbotUserId];

    if (existingAuthData && existingAuthData.status === 'verified') {
      const messages = [`${existingAuthData.githubId}님!\n이미 인증이 완료되었습니다.😎`];
      const data = { status: 'verified', githubId: existingAuthData.githubId };
      const buttons = [{ label: '➡️ 다음 단계로', blockId: START_MATERIAL_BLOCK_ID }];

      return res.status(200).json(createKakaoResponse(messages, data, buttons));
    }

    // GitHub에 Device Code 요청
    const { device_code, user_code, interval } = await requestGitHubDeviceCode();

    // 임시 저장소에 저장
    authStore[chatbotUserId] = {
      device_code: device_code,
      status: 'pending',
      githubId: null,
      interval: interval || DEFAULT_POLLING_TIME,
    };

    const messages = [
      `훈장을 제작하기 위해선\nGitHub 본인 인증이 필요합니다!\n\nPC/모바일에서\n/${GITHUB_DEVICE_AUTH_URL}\n에 접속해 아래 코드를 입력해주세요. 😎`,
      `${user_code}`,
      `인증이 완료 되었다면 아래의\n[✅ 인증 완료] 버튼을 눌러주세요!`,
    ];

    const data = {
      user_code: user_code,
      verification_uri: GITHUB_DEVICE_AUTH_URL,
    };

    const buttons = [{ label: '✅ 인증 완료', blockId: CHECK_AUTH_BLOCK_ID }];

    res.status(200).json(createKakaoResponse(messages, data, buttons));
  } catch (error) {
    res.status(500).json(createKakaoResponse(['오류: GitHub 인증 시작 중 문제가 발생했습니다.']));
  }
});

// POST /api/auth/check-auth
router.post('/check-auth', async (req, res) => {
  try {
    const chatbotUserId = req.body.userRequest.user.id;
    const authData = authStore[chatbotUserId];

    let messages = [];
    let data = {};
    let buttons = [];

    // 세션 없음 (에러 메시지 + 인증 버튼)
    if (!authData) {
      messages = ['인증 세션이 없습니다.😥\n[🎖️ 신규 훈장 제작] 버튼을 다시 눌러주세요.'];
      data = { status: 'error' };
      buttons = [{ label: '🎖️ 신규 훈장 제작', blockId: START_AUTH_BLOCK_ID }];
      return res.status(200).json(createKakaoResponse(messages, data, buttons));
    }

    // 이미 인증됨 (성공 메시지 + 다음 단계 버튼)
    if (authData.status === 'verified') {
      messages = [`${authData.githubId}님!\n이미 인증이 완료되었습니다.😎`];
      data = { status: 'verified', githubId: authData.githubId };
      buttons = [{ label: '➡️ 다음 단계로', blockId: START_MATERIAL_BLOCK_ID }];
      return res.status(200).json(createKakaoResponse(messages, data, buttons));
    }

    // 인증 로직
    const githubAuthResult = await checkGitHubAccessToken(authData.device_code);

    // 5. (인증 성공 메시지 + 다음 단계 버튼)
    if (githubAuthResult.success) {
      const { githubId } = githubAuthResult;

      authStore[chatbotUserId].status = 'verified';
      authStore[chatbotUserId].githubId = githubId;

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
        delete authStore[chatbotUserId];
        buttons = [{ label: '🏠 처음으로', blockId: START_AUTH_BLOCK_ID }];
      } else {
        messages = [`인증 중 알 수 없는 오류가 발생했습니다. (${error_description || error})`];
        data = { status: 'error' };
        buttons = [{ label: '🏠 처음으로', blockId: START_AUTH_BLOCK_ID }];
      }
      return res.status(200).json(createKakaoResponse(messages, data, buttons));
    }
  } catch (error) {
    res.status(500).json(createKakaoResponse(['오류: GitHub 인증 확인 중 문제가 발생했습니다.']));
  }
});

module.exports = router;
