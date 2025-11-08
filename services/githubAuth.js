const axios = require('axios');
const { GITHUB_DEVICE_CODE_AUTH_URL } = require('../constants/url');
require('dotenv').config();

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

async function requestGitHubDeviceCode() {
  try {
    const response = await axios.post(
      GITHUB_DEVICE_CODE_AUTH_URL,
      { client_id: GITHUB_CLIENT_ID, scope: 'read:user' },
      { headers: { Accept: 'application/json' } }
    );
    return response.data;
  } catch (error) {
    throw new Error('GitHub Device Code 요청 실패');
  }
}

async function checkGitHubAccessToken(deviceCode) {
  try {
    const response = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      },
      { headers: { Accept: 'application/json' } }
    );

    const { access_token, error, error_description } = response.data;

    if (access_token) {
      const userResponse = await axios.get('https://api.github.com/user', {
        headers: { Authorization: `token ${access_token}` },
      });
      const githubId = userResponse.data.login;
      return { success: true, githubId };
    } else {
      return { success: false, error, error_description };
    }
  } catch (error) {
    return { success: false, error: 'internal_error', error_description: 'GitHub Access Token 확인 실패' };
  }
}

module.exports = { requestGitHubDeviceCode, checkGitHubAccessToken };
