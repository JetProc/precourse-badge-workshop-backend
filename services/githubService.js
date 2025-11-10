const { GITHUB_API_URL } = require('../constants/url');

const axios = require('axios');
require('dotenv').config();

const ADMIN_TOKEN = process.env.GITHUB_ADMIN_TOKEN;

const getGithubEvents = async (githubId) => {
  let allEvents = [];
  let page = 1;
  const perPage = 100;
  let hasMoreData = true;

  console.log(`[GitHub Service] Start fetching events for ${githubId}...`);

  if (!ADMIN_TOKEN) {
    console.error('[GitHub Service] GITHUB_ADMIN_TOKEN is not set.');
    throw new Error('GitHub Admin Token이 설정되지 않았습니다.');
  }

  while (hasMoreData) {
    try {
      const response = await axios.get(`${GITHUB_API_URL}/users/${githubId}/events`, {
        headers: {
          Authorization: `token ${ADMIN_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
        },
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
      // ===== ⬇️ 핵심 수정 부분 ⬇️ =====
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
  if (!ADMIN_TOKEN) {
    console.error('[GitHub Service] GITHUB_ADMIN_TOKEN is not set.');
    return null;
  }
  try {
    const response = await axios.get(prUrl, {
      headers: {
        Authorization: `token ${ADMIN_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
      },
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

  if (!ADMIN_TOKEN) return [];

  while (hasMoreData) {
    try {
      const response = await axios.get(commitsUrl, {
        headers: {
          Authorization: `token ${ADMIN_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
        },
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
// ===== ⬆️ [신규 함수 2] ⬆️ =====

module.exports = {
  getGithubEvents,
  getPRDetails,
  getCommitsForPR,
};
