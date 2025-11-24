/*
 * 챗봇 개발 플랫폼에서 사용하는 blockId를 관리
 */

/* ===== 인증 관련 block ===== */
// 깃헙 인증 시작
const START_AUTH_BLOCK_ID = '690c35c5f582ee5b7cc1c415';
// 깃헙 인증 확인
const CHECK_AUTH_BLOCK_ID = '690e968066568549d0d2598e';

/* ===== 데이터 수집 관련 block ===== */
// 기본 정보 입력
const USER_INFO_INPUT_BLOCK_ID = '690f55edbe69223d63e1bbeb';
// 히든 질문 입력
const HIDDEN_INPUT_BLOCK_ID = '690fe1368d6d24478485b93f';
// 회고 입력
const REVIEW_INPUT_BLOCK_ID = '69101e1d1ba0d6494f5fd30f';
// 회고 분석
const CHECK_GITHUB_ANALYSIS_STATUS_BLOCK_ID = '6911ce5a0c3f687508832cf9';

/* ===== 칭호 관련 block ===== */
// 칭호 설정
const SET_TITLE_BLOCK_ID = '6910a7f55eff070a5601856d';
// 칭호 보기
const GET_TITLE_BLOCK_ID = '69117530959f5c2e998aa89b';

/* ===== 훈장 block ===== */
// 훈장 보기
const FINISH_FLOW_BLOCK_ID = '6911c9575eff070a5601e776';

module.exports = {
  START_AUTH_BLOCK_ID,
  CHECK_AUTH_BLOCK_ID,
  USER_INFO_INPUT_BLOCK_ID,
  HIDDEN_INPUT_BLOCK_ID,
  REVIEW_INPUT_BLOCK_ID,
  CHECK_GITHUB_ANALYSIS_STATUS_BLOCK_ID,
  SET_TITLE_BLOCK_ID,
  GET_TITLE_BLOCK_ID,
  FINISH_FLOW_BLOCK_ID,
};
