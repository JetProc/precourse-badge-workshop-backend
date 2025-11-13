const { REPO_FILTER_KEYWORD, COMMIT_KEYWORDS, TIME_ZONES } = require('../constants/precourse');
const { TITLE_DEFINITIONS } = require('../constants/definition');

const { getPRDetails, getCommitsForPR } = require('../services/githubService');

// =================================================================
// 헬퍼 함수 1: 리뷰/코멘트 이벤트 처리
// =================================================================
/**
 * PullRequestReviewCommentEvent 또는 IssueCommentEvent를 처리합니다.
 * reviewCount, reviewEmojiCount, reviewFastCount, reviewSelfCount를 계산하여 stats 객체를 수정합니다.
 */
function _handleReviewCommentEvent(event, eventDateKST, stats) {
  // 리뷰는 'woowacourse-precourse' 키워드 레포만 필터링
  if (!event.repo.name.includes(REPO_FILTER_KEYWORD)) {
    return; // 관련 레포 아니면 종료
  }

  stats.reviewCount++;

  const commentBody = event.payload.comment.body;

  // 이모지 카운트
  const emojiRegex = /:\+1:|:-1:|:laughing:|:confused:|:heart:|:hooray:|:rocket:|:eyes:/g;
  const emojiMatches = commentBody.match(emojiRegex);
  if (emojiMatches) {
    stats.reviewEmojiCount += emojiMatches.length;
  }

  // review_fast (PR 생성 1시간 이내 리뷰)
  if (event.type === 'PullRequestReviewCommentEvent' && event.payload.pull_request) {
    const prCreatedAt = new Date(new Date(event.payload.pull_request.created_at).getTime() + 9 * 60 * 60 * 1000);
    const reviewCreatedAt = eventDateKST; // KST로 변환된 시간 사용
    const diffHours = (reviewCreatedAt - prCreatedAt) / (1000 * 60 * 60);
    if (diffHours <= 1) {
      stats.reviewFastCount++;
    }
  }

  // review_self (자신 PR에 남긴 코멘트)
  let eventCreator = null;
  let prAuthor = null;

  if (event.type === 'IssueCommentEvent') {
    eventCreator = event.payload.comment?.user?.login;
    if (event.payload.issue?.pull_request) {
      prAuthor = event.payload.issue.user?.login;
    }
  } else if (event.type === 'PullRequestReviewCommentEvent') {
    eventCreator = event.payload.comment?.user?.login;
  }

  if (prAuthor && eventCreator && eventCreator === prAuthor) {
    stats.reviewSelfCount++;
  }
}

// =================================================================
// 헬퍼 함수 2: PR 이벤트 처리 (커밋 분석 포함)
// =================================================================
/**
 * 'opened'된 PullRequestEvent를 비동기적으로 처리합니다.
 * PR에 포함된 모든 커밋을 순회하며 stats 객체와
 * commitDates, commitCountPerDay를 수정합니다.
 */
async function _handlePullRequestEvent(
  event,
  stats,
  weekSchedule,
  overallStartDate,
  overallEndDate,
  commitDates, // (수정을 위해 참조 전달)
  commitCountPerDay // (수정을 위해 참조 전달)
) {
  // PR 생성도 'woowacourse-precourse' 키워드 레포만 필터링
  if (!event.repo.name.includes(REPO_FILTER_KEYWORD)) {
    return;
  }

  // "기간 내에 열린 PR"만 분석
  if (event.payload.action === 'opened') {
    stats.prOpened = true;

    // 1. 이벤트 요약 정보에서 PR 상세 정보 URL 가져오기
    const prSummary = event.payload.pull_request;

    if (prSummary && prSummary.url) {
      // 2. [API 2단계 호출] PR 상세 정보 가져오기
      const fullPR = await getPRDetails(prSummary.url);

      if (!fullPR || !fullPR.commits_url) return; // 상세 정보 없으면 스킵

      // 3. [API 3단계 호출] 개별 커밋 목록 가져오기
      const detailedCommits = await getCommitsForPR(fullPR.commits_url);

      // 4. 총 커밋 수 집계 (상세 정보의 .commits가 가장 정확)
      stats.commitCount += fullPR.commits;

      // 5. 개별 커밋 순회
      for (const commitData of detailedCommits) {
        const message = commitData.commit.message.toLowerCase();
        // 커밋 작성자/승인자 날짜 중 유효한 것 사용
        const commitTimestamp = commitData.commit.author?.date || commitData.commit.committer?.date;
        if (!commitTimestamp) continue;

        const commitDate = new Date(new Date(commitTimestamp).getTime() + 9 * 60 * 60 * 1000);

        // 6. 개별 커밋이 프리코스 기간 내인지 다시 확인
        if (commitDate < overallStartDate || commitDate > overallEndDate) {
          continue;
        }

        const commitHour = commitDate.getUTCHours();
        const commitDay = commitDate.getUTCDay();
        const commitDateString = commitDate.toISOString().split('T')[0];

        // --- 7. 모든 커밋 기반 스탯을 여기서 계산 ---

        // refactor / fix
        if (message.includes(COMMIT_KEYWORDS.REFACTOR)) {
          stats.commitRefactorCount++;
        }
        if (message.includes(COMMIT_KEYWORDS.FIX)) {
          stats.commitFixCount++;
        }

        // weekend
        if (commitDay === 0 || commitDay === 6) {
          stats.commitWeekendCount++;
        }

        // streak / monster (데이터 수집)
        // [수정] 상위 스코프의 배열/객체를 직접 수정
        commitDates.push(commitDateString);
        commitCountPerDay[commitDateString] = (commitCountPerDay[commitDateString] || 0) + 1;

        // time-based
        if (commitHour >= TIME_ZONES.EARLY_BIRD_START && commitHour < TIME_ZONES.EARLY_BIRD_END) {
          stats.earlybird = true;
        }
        if (commitHour >= TIME_ZONES.NIGHT_OWL_START && commitHour < TIME_ZONES.NIGHT_OWL_END) {
          stats.nightowl = true;
        }

        // first/last day (전체 기간 기준)
        if (commitDateString === overallStartDate.toISOString().split('T')[0]) {
          stats.commitFirstDay = true;
        }
        if (commitDateString === overallEndDate.toISOString().split('T')[0]) {
          stats.commitLastDay = true;
        }

        // deadline fighter (주차별 기간 기준)
        for (const week of weekSchedule) {
          const weekStartDate = new Date(week.startDate);
          const weekEndDate = new Date(week.endDate);

          // YYYY-MM-DD 형식으로 변환
          const weekStartDateString = weekStartDate.toISOString().split('T')[0];
          const weekEndDateString = weekEndDate.toISOString().split('T')[0];

          // 1. 각 주차의 '첫날' 커밋 확인 (원본 코드 로직 유지)
          if (commitDateString === weekStartDateString) {
            stats.commitFirstDay = true;
          }

          // 2. 각 주차의 '마지막 날' 커밋 확인 (원본 코드 로직 유지)
          if (commitDateString === weekEndDateString) {
            stats.commitLastDay = true;
          }

          // 3. 각 주차의 '데드라인 파이터' 확인 (기존 로직)
          const oneHourBeforeEnd = new Date(weekEndDate.getTime() - 60 * 60 * 1000);
          if (commitDate >= oneHourBeforeEnd && commitDate <= weekEndDate) {
            stats.deadlineFighter = true;
          }
        }
      } // end of individual commit loop
    }
  } // end of if (action === 'opened')
}

/**
 * [Async] GitHub 이벤트를 분석하여 통계를 계산합니다.
 */
async function analyzeGithubEvents(githubEvents, weekSchedule) {
  // --- 1. 초기화 및 전체 기간 설정 ---
  let stats = {
    commitCount: 0,
    commitStreakMax: 0,
    commitWeekendCount: 0,
    commitRefactorCount: 0,
    commitFixCount: 0,
    commitMonsterMax: 0,
    commitFirstDay: false,
    commitLastDay: false,
    reviewCount: 0,
    reviewFastCount: 0,
    reviewSelfCount: 0,
    reviewEmojiCount: 0,
    deadlineFighter: false,
    earlybird: false,
    nightowl: false,
    prOpened: false,
  };

  if (!weekSchedule || weekSchedule.length === 0) {
    throw new Error('주차별 일정(weekSchedule)이 비어있습니다.');
  }
  const overallStartDate = new Date(weekSchedule[0].startDate);
  const overallEndDate = new Date(weekSchedule[weekSchedule.length - 1].endDate);

  // 헬퍼 함수가 수정할 수 있도록 외부에 선언
  const commitDates = []; // KST 기준 날짜(YYYY-MM-DD)를 저장할 배열
  const commitCountPerDay = {}; // 날짜별 커밋 수 ({"2025-11-01": 5, ...})

  // --- 2. GitHub 이벤트 순회 및 분석 (Async) ---

  for (const event of githubEvents) {
    // 모든 이벤트 시간을 KST로 변환 (9시간 더하기)
    const eventDateKST = new Date(new Date(event.created_at).getTime() + 9 * 60 * 60 * 1000);

    // 프리코스 전체 기간 내의 이벤트만 고려
    if (eventDateKST < overallStartDate || eventDateKST > overallEndDate) {
      continue; // 기간 외 이벤트는 무시
    }

    // --- 2-3. 이벤트 타입별 상세 분석 ---
    switch (event.type) {
      case 'PushEvent': {
        // PushEvent는 부정확하므로 커밋 관련 모든 집계에서 제외합니다.
        // (시간대별 업적 등도 PullRequest의 개별 커밋에서 처리)
        break;
      }

      case 'PullRequestReviewCommentEvent': // PR의 특정 코드 라인에 남긴 코멘트
      case 'IssueCommentEvent': {
        // [REFACTORED] 헬퍼 함수로 로직 이동
        // (review_fast 계산을 위해 eventDateKST도 전달)
        _handleReviewCommentEvent(event, eventDateKST, stats);
        break;
      }

      case 'PullRequestEvent': {
        // [REFACTORED] 헬퍼 함수로 로직 이동
        // (commitDates, commitCountPerDay를 전달하여 헬퍼 함수가 수정하도록 함)
        await _handlePullRequestEvent(
          event,
          stats,
          weekSchedule,
          overallStartDate,
          overallEndDate,
          commitDates, // 참조 전달
          commitCountPerDay // 참조 전달
        );
        break;
      }
    } // end of switch
  } // end of event loop

  // --- 3. 2차 계산 (Streak, Monster) ---

  // 3-1. commitMonsterMax 계산 (하루 최대 커밋)
  stats.commitMonsterMax = Math.max(0, ...Object.values(commitCountPerDay));

  // 3-2. commitStreakMax 계산 (최대 연속 커밋)
  const uniqueCommitDays = [...new Set(commitDates)].sort();
  if (uniqueCommitDays.length > 0) {
    let currentStreak = 1;
    let maxStreak = 1;
    for (let i = 1; i < uniqueCommitDays.length; i++) {
      const prevDate = new Date(uniqueCommitDays[i - 1]);
      const currentDate = new Date(uniqueCommitDays[i]);
      const diffTime = currentDate - prevDate;
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      if (diffDays === 1) {
        currentStreak++;
      } else {
        currentStreak = 1;
      }
      maxStreak = Math.max(maxStreak, currentStreak);
    }
    stats.commitStreakMax = maxStreak;
  }

  console.log('[analyzeGithubEvents] Stats calculation complete:', stats);
  return stats;
}

/**
 * 계산된 통계(stats)와 사용자 입력(hiddenAnswers)을 기반으로
 * 최종 업적, 칭호, 등급을 부여합니다.
 * (이 함수는 원본과 동일하며, 변경 사항이 없습니다)
 */
function calculateResults(stats, hiddenAnswers) {
  let achievements = [];
  let titles = [TITLE_DEFINITIONS.default];
  let score = 0;

  const addAchievement = (id) => {
    achievements.push(id);
    score += 5;
    if (TITLE_DEFINITIONS[id]) {
      titles.push(TITLE_DEFINITIONS[id]);
    }
  };

  // --- 1. 'stats' 기반 자동 업적 판정 ---

  // [수정됨] 커밋 등급 (가장 높은 1개만)
  if (stats.commitCount >= 150) {
    addAchievement('commit_master');
  } else if (stats.commitCount >= 110) {
    addAchievement('commit_diamond');
  } else if (stats.commitCount >= 80) {
    addAchievement('commit_platinum');
  } else if (stats.commitCount >= 50) {
    addAchievement('commit_gold');
  } else if (stats.commitCount >= 20) {
    addAchievement('commit_silver');
  } else if (stats.commitCount >= 1) {
    addAchievement('commit_bronze');
  }

  // 커밋 관련 기타 업적
  if (stats.commitStreakMax >= 5) addAchievement('commit_streak');
  if (stats.commitWeekendCount >= 10) addAchievement('commit_weekend');
  if (stats.commitRefactorCount >= 5) addAchievement('commit_refactor');
  if (stats.commitFixCount >= 5) addAchievement('commit_fix');
  if (stats.commitMonsterMax >= 15) addAchievement('commit_monster');
  if (stats.commitFirstDay) addAchievement('commit_first_day');
  if (stats.commitLastDay) addAchievement('commit_last_day');

  // [수정됨] 리뷰 등급 (가장 높은 1개만)
  if (stats.reviewCount >= 100) {
    addAchievement('review_master');
  } else if (stats.reviewCount >= 70) {
    addAchievement('review_diamond');
  } else if (stats.reviewCount >= 50) {
    addAchievement('review_platinum');
  } else if (stats.reviewCount >= 30) {
    addAchievement('review_gold');
  } else if (stats.reviewCount >= 10) {
    addAchievement('review_silver');
  } else if (stats.reviewCount >= 1) {
    addAchievement('review_bronze');
  }

  // 리뷰 관련 기타 업적
  if (stats.reviewFastCount >= 1) addAchievement('review_fast');
  if (stats.reviewSelfCount >= 20) addAchievement('review_self');
  if (stats.reviewEmojiCount >= 10) addAchievement('review_emoji_king');

  // 시간 및 프로세스 관련 업적
  if (stats.deadlineFighter) addAchievement('deadline_fighter');
  if (stats.earlybird) addAchievement('earlybird');
  if (stats.nightowl) addAchievement('nightowl');
  if (stats.prOpened) addAchievement('pr_opened');

  // --- 2. 'hiddenAnswers' 기반 히든 업적 판정 ---
  if (hiddenAnswers.review_thanked) addAchievement('review_thanked');
  if (hiddenAnswers.review_study) addAchievement('review_study');
  if (hiddenAnswers.tdd_attempt) addAchievement('tdd_attempt');
  if (hiddenAnswers.readme_master) addAchievement('readme_master');
  if (hiddenAnswers.blog_share) addAchievement('blog_share');
  if (hiddenAnswers.community_writer) addAchievement('community_writer');
  if (hiddenAnswers.community_answerer) addAchievement('community_answerer');

  // --- 3. 종합 등급(Grade) 계산 ---
  let grade = '🥉 bronze';
  if (score >= 20) grade = '🥈 silver';
  if (score >= 35) grade = '🥇 gold';
  if (score >= 50) grade = '💿 platinum';
  if (score >= 65) grade = '💎 diamond';
  if (score >= 80) grade = '👑 master';

  return {
    grade: grade,
    score: score,
    achievements: [...new Set(achievements)],
    titles: [...new Set(titles)],
  };
}

module.exports = {
  analyzeGithubEvents,
  calculateResults,
};
