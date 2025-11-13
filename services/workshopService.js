const { createKakaoResponse } = require('../utils/kakaoResponse');

const { GET_TITLE_BLOCK_ID, FINISH_FLOW_BLOCK_ID } = require('../constants/blockId');
const { WORKSHOP } = require('../constants/messages');
const { ACHIEVEMENT_DEFINITIONS } = require('../constants/definition');

function createCompletedResponse(participant) {
  const { stats, results, nickname, customization } = participant;

  const statsSummary = [
    `🚀 총 커밋: ${stats.commitCount}회`,
    `👀 총 리뷰: ${stats.reviewCount}회`,
    `🔥 최대 연속 커밋: ${stats.commitStreakMax}일`,
    `🚂 하루 최대 커밋: ${stats.commitMonsterMax}회`,
    `☀️ 주말 커밋: ${stats.commitWeekendCount}회`,
    `🧹 리팩토링 커밋: ${stats.commitRefactorCount}회`,
    `🐛 버그 수정 커밋: ${stats.commitFixCount}회`,
    `🧐 셀프 리뷰: ${stats.reviewSelfCount}회`,
  ];

  if (stats.prOpened) statsSummary.push('✅ 첫 PR 생성 완료');
  if (stats.nightowl) statsSummary.push('🌙 올빼미 활동 (자정~새벽 3시)');
  if (stats.earlybird) statsSummary.push('☀️ 얼리버드 활동 (새벽 3~6시)');
  if (stats.deadlineFighter) statsSummary.push('⏱️ 데드라인 파이터');
  if (stats.commitFirstDay) statsSummary.push('🥇 미션 첫날 커밋');
  if (stats.commitLastDay) statsSummary.push('🏁 미션 마지막 날 커밋');

  const statsMessage = statsSummary.join('\n');

  const achievementNames = results.achievements
    .map((id) => (ACHIEVEMENT_DEFINITIONS[id] ? ACHIEVEMENT_DEFINITIONS[id].name : id))
    .join('\n');

  const titleNames = results.titles.join('\n');

  const messages = WORKSHOP.SET_REFLECTION_SUCCESS(
    nickname,
    statsMessage,
    results.grade,
    results.score,
    { count: results.achievements.length, names: achievementNames },
    { count: results.titles.length, names: titleNames },
    customization.equippedTitle
  );

  const buttons = [
    {
      label: '🙅 이대로 좋아요',
      blockId: FINISH_FLOW_BLOCK_ID,
      messageText: '이대로 좋아요',
    },
    {
      label: '🎨 칭호 변경하기',
      blockId: GET_TITLE_BLOCK_ID,
      messageText: '칭호 변경하기',
    },
  ];

  return createKakaoResponse(messages, {}, buttons);
}

module.exports = {
  createCompletedResponse,
};
