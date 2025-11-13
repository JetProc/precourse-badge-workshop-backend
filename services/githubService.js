const axios = require('axios');

require('dotenv').config();

const { GITHUB_API_URL } = require('../constants/url');

const ADMIN_TOKEN = process.env.GITHUB_ADMIN_TOKEN;

// GITHUB_ADMIN_TOKEN이 없는 경우, 서버 시작 시점에 즉시 에러 발생
if (!ADMIN_TOKEN) {
  console.error('[GitHub Service] GITHUB_ADMIN_TOKEN is not set.');
  throw new Error('GitHub Admin Token이 설정되지 않았습니다.');
}

// 1. 공통 설정을 가진 axios 인스턴스 생성
const githubApi = axios.create({
  baseURL: GITHUB_API_URL,
  headers: {
    Authorization: `token ${ADMIN_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
  },
});

const getGithubEvents = async (githubId) => {
  let allEvents = [];
  let page = 1;
  const perPage = 100;
  let hasMoreData = true;

  console.log(`[GitHub Service] Start fetching events for ${githubId}...`);

  while (hasMoreData) {
    try {
      // 2. 생성한 인스턴스(githubApi)를 사용하여 요청
      const response = await githubApi.get(`/users/${githubId}/events`, {
        params: {
          page: page,
          per_page: perPage,
        },
      });

      if (response.data.length > 0) {
        allEvents = allEvents.concat(response.data);
        page++;
      } else {
        hasMoreData = false;
      }
    } catch (error) {
      if (error.response && error.response.status === 422) {
        console.warn(`[GitHub Service] Pagination limit reached for ${githubId} (300 events). Stopping fetch.`);
        hasMoreData = false;
      } else {
        console.error(
          `[GitHub Service] Error fetching page ${page} for ${githubId}:`,
          error.response ? error.response.data : error.message
        );
        hasMoreData = false;
      }
    }
  }

  console.log(`[GitHub Service] Fetched total ${allEvents.length} events for ${githubId}.`);
  return allEvents;
};

/**
 * PR의 상세 정보 URL을 호출하여 전체 PR 객체를 가져옵니다.
 */
const getPRDetails = async (prUrl) => {
  try {
    const response = await axios.get(prUrl, {
      headers: githubApi.defaults.headers,
    });
    return response.data; // 상세 PR 객체 반환
  } catch (error) {
    console.error(`[GitHub Service] Error fetching PR details from ${prUrl}:`, error.message);
    return null;
  }
};

/**
 * PR의 commits_url을 호출하여 모든 커밋 목록을 가져옵니다. (페이징 포함)
 */
const getCommitsForPR = async (commitsUrl) => {
  let allCommits = [];
  let page = 1;
  const perPage = 100;
  let hasMoreData = true;

  while (hasMoreData) {
    try {
      const response = await axios.get(commitsUrl, {
        headers: githubApi.defaults.headers,
        params: { page: page, per_page: perPage },
      });

      if (response.data.length > 0) {
        allCommits = allCommits.concat(response.data);
        page++;
      } else {
        hasMoreData = false;
      }
    } catch (error) {
      console.error(`[GitHub Service] Error fetching commits from ${commitsUrl} (page ${page}):`, error.message);
      hasMoreData = false;
    }
  }
  return allCommits;
};

module.exports = {
  getGithubEvents,
  getPRDetails,
  getCommitsForPR,
};
