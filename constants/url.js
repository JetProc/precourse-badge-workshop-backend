/*
 * 깃헙 api 관련 url 관리
 */

//깃헙 디바이스 코드 요청 url
const GITHUB_DEVICE_CODE_REQUEST_URL = 'https://github.com/login/device/code';

//깃헙 코드 인증 url
const GITHUB_AUTH_URL = 'https://github.com/login/device';

//깃헙 api url
const GITHUB_API_URL = 'https://api.github.com';

//깃헙 액세스 토큰 접근 url
const GITHUB_ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';

//깃헙 사용자 url
const GITHUB_USER_API_URL = 'https://api.github.com/user';

module.exports = {
  GITHUB_AUTH_URL,
  GITHUB_DEVICE_CODE_REQUEST_URL,
  GITHUB_API_URL,
  GITHUB_ACCESS_TOKEN_URL,
  GITHUB_USER_API_URL,
};
