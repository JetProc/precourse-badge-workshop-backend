const axios = require('axios');
const { GITHUB_DEVICE_CODE_AUTH_URL } = require('../constants/url');

// GitHub Device Flow 인증을 시작하고 device_code, user_code 등을 받아옵니다.
async function requestGitHubDeviceCode(clientId) {
  try {
    const response = await axios.post(
      GITHUB_DEVICE_CODE_AUTH_URL,
      { client_id: clientId, scope: 'read:user' },
      { headers: { Accept: 'application/json' } }
    );
    return { success: true, ...response.data };
  } catch (error) {
    console.error('Error requesting GitHub Device Code:', error.response ? error.response.data : error.message);
    return { success: false, error: 'internal_error', error_description: 'GitHub Device Code 요청 실패' };
  }
}

//GitHub으로부터 access_token을 확인하고 사용자 정보를 가져옵니다.
async function checkGitHubAccessToken(clientId, clientSecret, deviceCode) {
  try {
    const response = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: clientId,
        client_secret: clientSecret,
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
    console.error('Error checking GitHub Access Token:', error.response ? error.response.data : error.message);
    return { success: false, error: 'internal_error', error_description: 'GitHub Access Token 확인 중 내부 오류 발생' };
  }
}

module.exports = { requestGitHubDeviceCode, checkGitHubAccessToken };
