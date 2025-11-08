const REPO_FILTER_KEYWORD = 'woowacourse-precourse';

// 업적 계산에 사용될 커밋 메시지 키워드
const COMMIT_KEYWORDS = {
  REFACTOR: 'refactor',
  FIX: 'fix',
};

// 시간대별 업적 계산용 시간 (KST 기준)
const TIME_ZONES = {
  NIGHT_OWL_START: 0, // 00:00 (자정)
  NIGHT_OWL_END: 3, // 02:59 (새벽 3시 전)
  EARLY_BIRD_START: 3, // 03:00 (새벽 3시)
  EARLY_BIRD_END: 6, // 05:59 (새벽 6시 전)
};

module.exports = {
  REPO_FILTER_KEYWORD,
  COMMIT_KEYWORDS,
  TIME_ZONES,
};
