// routes/workshop.js

const express = require('express');
const router = express.Router();
const axios = require('axios');
require('dotenv').config();

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

// (임시) 메모리 저장소
const authStore = {};

/**
 * 텍스트 응답을 위한 카카오 챗봇 응답 포맷 헬퍼 함수
 */
const createSimpleTextResponse = (text) => {
  return {
    version: '2.0',
    template: {
      outputs: [
        {
          simpleText: {
            text: text,
          },
        },
      ],
    },
  };
};

/**
 * POST /api/workshop/start
 * 챗봇이 '훈장 제작'을 시작할 때 호출.
 */
router.post('/start', async (req, res) => {
  try {
    // --- (수정 1) 챗봇 유저 ID 읽는 방식 변경 ---
    // 카카오 챗봇은 req.body.userRequest.user.id로 사용자 ID를 보냅니다.
    const chatbotUserId = req.body.userRequest.user.id;

    if (!chatbotUserId) {
      console.error('No chatbotUserId found in req.body.userRequest.user.id');
      return res.status(400).json(createSimpleTextResponse('오류: 사용자 ID를 식별할 수 없습니다.'));
    }

    // GitHub에 Device Code 요청
    const response = await axios.post(
      'https://github.com/login/device/code',
      { client_id: GITHUB_CLIENT_ID, scope: 'read:user' },
      { headers: { Accept: 'application/json' } }
    );

    const { device_code, user_code, verification_uri, interval } = response.data;

    // 임시 저장소에 저장
    authStore[chatbotUserId] = {
      device_code: device_code,
      status: 'pending',
      githubId: null,
      interval: interval || 5,
    };
    console.log(`[Auth Start] chatbotUserId: ${chatbotUserId}, device_code: ${device_code}`);

    // --- (수정 2) 카카오 챗봇 응답 형식으로 변경 ---
    const responseText = `제작을 위해 GitHub 본인 인증이 필요합니다.\nPC/모바일 브라우저에서 [github.com/login/device]에 접속해 아래 코드를 입력해주세요.\n\n(코드: ${user_code})`;
    res.status(200).json(createSimpleTextResponse(responseText));
  } catch (error) {
    console.error('Error starting device flow:', error.response ? error.response.data : error.message);
    res.status(500).json(createSimpleTextResponse('오류: GitHub 인증 시작 중 문제가 발생했습니다.'));
  }
});

/**
 * POST /api/workshop/check-auth
 * 챗봇이 인증이 완료되었는지 주기적으로 확인(Polling)하기 위해 호출.
 */
router.post('/check-auth', async (req, res) => {
  try {
    // --- (수정 1) 챗봇 유저 ID 읽는 방식 변경 ---
    const chatbotUserId = req.body.userRequest.user.id;
    const authData = authStore[chatbotUserId];

    if (!authData) {
      return res
        .status(404)
        .json(createSimpleTextResponse("인증 세션이 없습니다. '훈장 제작하기'를 다시 시작해주세요."));
    }

    if (authData.status === 'verified') {
      // (참고) 챗봇 빌더는 응답으로 받은 값을 파라미터로 저장할 수 있습니다.
      // skill.githubId 등으로 사용하기 위해 data 객체를 추가합니다.
      const responsePayload = createSimpleTextResponse(`이미 인증이 완료되었습니다. (${authData.githubId}님)`);
      responsePayload.data = {
        status: 'verified',
        githubId: authData.githubId,
      };
      return res.status(200).json(responsePayload);
    }

    // GitHub에 Access Token 요청 (폴링)
    const response = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        device_code: authData.device_code,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      },
      { headers: { Accept: 'application/json' } }
    );

    const { access_token, error, error_description } = response.data;

    if (error) {
      let status = 'error';
      let message = '인증 중 알 수 없는 오류가 발생했습니다.';

      if (error === 'authorization_pending') {
        status = 'pending';
        message = '아직 사용자가 GitHub에서 코드를 입력/승인하지 않았습니다.';
      } else if (error === 'expired_token') {
        status = 'expired';
        message = '인증 시간이 초과되었습니다. 처음부터 다시 시작해주세요.';
        delete authStore[chatbotUserId];
      } else {
        console.error(`[Auth Check] GitHub Error for ${chatbotUserId}: ${error} - ${error_description}`);
      }

      // --- (수정 2) 카카오 챗봇 응답 형식으로 변경 ---
      const responsePayload = createSimpleTextResponse(message);
      responsePayload.data = { status: status }; // 챗봇 빌더가 분기 처리에 사용할 status
      return res.status(200).json(responsePayload);
    }

    // (성공) Access Token 획득!
    if (access_token) {
      const userResponse = await axios.get('https://api.github.com/user', {
        headers: { Authorization: `token ${access_token}` },
      });

      const githubId = userResponse.data.login;
      authStore[chatbotUserId].status = 'verified';
      authStore[chatbotUserId].githubId = githubId;

      console.log(`[Auth Verified] chatbotUserId: ${chatbotUserId} -> githubId: ${githubId}`);

      // --- (수정 2) 카카오 챗봇 응답 형식으로 변경 ---
      const responsePayload = createSimpleTextResponse(`인증이 완료되었습니다! ${githubId}님 반갑습니다!`);
      responsePayload.data = {
        status: 'verified',
        githubId: githubId,
      };
      return res.status(200).json(responsePayload);
    }
  } catch (error) {
    console.error('Error checking auth:', error.response ? error.response.data : error.message);
    res.status(500).json(createSimpleTextResponse('오류: GitHub 인증 확인 중 문제가 발생했습니다.'));
  }
});

module.exports = router;
