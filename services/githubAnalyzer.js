const { REPO_FILTER_KEYWORD, COMMIT_KEYWORDS, TIME_ZONES } = require('../constants/precourse');
const { ACHIEVEMENT_DEFINITIONS, TITLE_DEFINITIONS } = require('../constants/definition'); // 이 상수는 이 파일에서 직접 사용되지 않지만, 다른 곳에서 사용될 것을 고려하여 남겨둡니다.

function analyzeGithubEvents(githubEvents, weekSchedule) {
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

  // 1-1. 전체 프리코스 기간(시작, 마감) 설정
  if (!weekSchedule || weekSchedule.length === 0) {
    throw new Error('주차별 일정(weekSchedule)이 비어있습니다.');
  }
  const overallStartDate = new Date(weekSchedule[0].startDate);
  const overallEndDate = new Date(weekSchedule[weekSchedule.length - 1].endDate);

  // 1-2. streak, monster 계산을 위한 임시 변수
  const commitDates = []; // KST 기준 날짜(YYYY-MM-DD)를 저장할 배열
  const commitCountPerDay = {}; // 날짜별 커밋 수 ({"2025-11-01": 5, ...})

  // --- 2. GitHub 이벤트 순회 및 분석 (필터링 로직 변경됨) ---

  for (const event of githubEvents) {
    // 전체 이벤트를 순회
    // 모든 이벤트 시간을 KST로 변환 (9시간 더하기)
    const eventDate = new Date(new Date(event.created_at).getTime() + 9 * 60 * 60 * 1000);

    // 프리코스 전체 기간 내의 이벤트만 고려
    if (eventDate < overallStartDate || eventDate > overallEndDate) {
      continue; // 기간 외 이벤트는 무시
    }

    const eventHour = eventDate.getUTCHours(); // KST로 변환했으므로 UTC 시간(getUTCHours)을 사용
    const eventDay = eventDate.getUTCDay(); // 0(일요일) ~ 6(토요일)
    const eventDateString = eventDate.toISOString().split('T')[0]; // "YYYY-MM-DD"

    // --- 2-1. 시간대별 업적 (earlybird, nightowl) ---
    // 모든 활동 (커밋, 리뷰 등)에 대해 적용
    if (eventHour >= TIME_ZONES.EARLY_BIRD_START && eventHour < TIME_ZONES.EARLY_BIRD_END) {
      stats.earlybird = true;
    }
    if (eventHour >= TIME_ZONES.NIGHT_OWL_START && eventHour < TIME_ZONES.NIGHT_OWL_END) {
      stats.nightowl = true;
    }

    // --- 2-2. 마감일/시작일/주말/데드라인 파이터 ---
    // 커밋과 PR 이벤트에 대해 적용
    if (event.type === 'PushEvent' || event.type === 'PullRequestEvent') {
      // 시작일 활동
      if (eventDateString === overallStartDate.toISOString().split('T')[0]) {
        stats.commitFirstDay = true;
      }
      // 마감일 활동
      if (eventDateString === overallEndDate.toISOString().split('T')[0]) {
        stats.commitLastDay = true;
      }
      // 주말 활동 (토:6, 일:0)
      if (eventDay === 0 || eventDay === 6) {
        // 커밋에만 적용하려면 PushEvent일 때만 증가
        if (event.type === 'PushEvent') {
          stats.commitWeekendCount++;
        }
      }
      // 데드라인 파이터 (각 주차의 마감일 1시간 전)
      for (const week of weekSchedule) {
        const weekEndDate = new Date(week.endDate);
        // 마감일의 1시간 전 ~ 마감일 사이의 활동
        const oneHourBeforeEnd = new Date(weekEndDate.getTime() - 60 * 60 * 1000);
        if (eventDate >= oneHourBeforeEnd && eventDate <= weekEndDate) {
          stats.deadlineFighter = true;
          // 하나의 주차에서라도 달성하면 충분하므로 더 이상 검사할 필요 없음
          break;
        }
      }
    }

    // --- 2-3. 이벤트 타입별 상세 분석 ---
    switch (event.type) {
      case 'PushEvent': {
        // 커밋은 레포지토리 키워드 필터링 없음
        const commits = event.payload.commits || [];
        stats.commitCount += commits.length;

        // 커밋 날짜/횟수 기록 (streak, monster용)
        if (commits.length > 0) {
          commitDates.push(eventDateString);
          commitCountPerDay[eventDateString] = (commitCountPerDay[eventDateString] || 0) + commits.length;
        }

        // 커밋 메시지 분석 (refactor, fix)
        for (const commit of commits) {
          const message = commit.message.toLowerCase();
          if (message.includes(COMMIT_KEYWORDS.REFACTOR)) {
            stats.commitRefactorCount++;
          }
          if (message.includes(COMMIT_KEYWORDS.FIX)) {
            stats.commitFixCount++;
          }
        }
        break;
      }

      case 'PullRequestReviewCommentEvent': // PR의 특정 코드 라인에 남긴 코멘트
      case 'IssueCommentEvent': {
        // PR의 일반 코멘트 (PR 또는 Issue에 대한 코멘트)
        // 리뷰는 'woowacourse-precourse' 키워드 레포만 필터링
        if (!event.repo.name.includes(REPO_FILTER_KEYWORD)) {
          break; // 관련 레포 아니면 다음 이벤트로
        }

        stats.reviewCount++;

        const commentBody = event.payload.comment.body;

        // 이모지 카운트 (간단한 정규식)
        const emojiRegex = /:\+1:|:-1:|:laughing:|:confused:|:heart:|:hooray:|:rocket:|:eyes:/g;
        const emojiMatches = commentBody.match(emojiRegex);
        if (emojiMatches) {
          stats.reviewEmojiCount += emojiMatches.length;
        }

        // review_fast (PR 생성 1시간 이내 리뷰)
        // PullRequestReviewCommentEvent에 한정 (IssueCommentEvent는 PR 생성 시간 직접 접근 어려움)
        if (event.type === 'PullRequestReviewCommentEvent' && event.payload.pull_request) {
          const prCreatedAt = new Date(new Date(event.payload.pull_request.created_at).getTime() + 9 * 60 * 60 * 1000);
          const reviewCreatedAt = eventDate;
          const diffHours = (reviewCreatedAt - prCreatedAt) / (1000 * 60 * 60);
          if (diffHours <= 1) {
            stats.reviewFastCount++;
          }
        }

        // review_self (자신 PR에 남긴 코멘트)
        // IssueCommentEvent는 issue.user와 sender를 비교, PullRequestReviewCommentEvent는 pull_request.user와 sender를 비교
        const eventCreator = event.payload.sender.login;
        let prAuthor = null;

        if (event.type === 'IssueCommentEvent' && event.payload.issue && event.payload.issue.pull_request) {
          // IssueCommentEvent인데 이게 PR에 대한 코멘트인 경우
          prAuthor = event.payload.issue.user.login; // PR 생성자
        } else if (event.type === 'PullRequestReviewCommentEvent' && event.payload.pull_request) {
          // PullRequestReviewCommentEvent는 pull_request 정보가 바로 있음
          prAuthor = event.payload.pull_request.user.login; // PR 생성자
        }

        if (prAuthor && eventCreator === prAuthor) {
          stats.reviewSelfCount++;
        }

        break;
      }

      case 'PullRequestEvent': {
        // PR 생성도 'woowacourse-precourse' 키워드 레포만 필터링 ✨
        if (!event.repo.name.includes(REPO_FILTER_KEYWORD)) {
          break;
        }
        if (event.payload.action === 'opened') {
          stats.prOpened = true; // 프리코스 기간 동안 PR을 하나라도 열었는지
        }
        break;
      }
    }
  }

  // --- 3. 2차 계산 (Streak, Monster) ---

  // 3-1. commitMonsterMax 계산 (하루 최대 커밋)
  stats.commitMonsterMax = Math.max(0, ...Object.values(commitCountPerDay)); // 커밋이 없는 날은 0으로 취급

  // 3-2. commitStreakMax 계산 (최대 연속 커밋)
  // 날짜별 커밋이 있는 날만 필터링하고 정렬하여 연속성을 계산
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
        // 다음날이면 연속
        currentStreak++;
      } else {
        currentStreak = 1; // 연속이 깨짐
      }
      maxStreak = Math.max(maxStreak, currentStreak);
    }
    stats.commitStreakMax = maxStreak;
  }

  console.log('[analyzeGithubEvents] Stats calculation complete:', stats);
  return stats;
}

// calculateResults 함수는 변경 없음
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
  if (stats.commitCount >= 1) addAchievement('commit_bronze');
  if (stats.commitCount >= 20) addAchievement('commit_silver');
  if (stats.commitCount >= 50) addAchievement('commit_gold');
  if (stats.commitCount >= 80) addAchievement('commit_platinum');
  if (stats.commitCount >= 110) addAchievement('commit_diamond');
  if (stats.commitCount >= 150) addAchievement('commit_master');
  if (stats.commitStreakMax >= 5) addAchievement('commit_streak');
  if (stats.commitWeekendCount >= 10) addAchievement('commit_weekend');
  if (stats.commitRefactorCount >= 5) addAchievement('commit_refactor');
  if (stats.commitFixCount >= 5) addAchievement('commit_fix');
  if (stats.commitMonsterMax >= 15) addAchievement('commit_monster');
  if (stats.commitFirstDay) addAchievement('commit_first_day');
  if (stats.commitLastDay) addAchievement('commit_last_day');

  if (stats.reviewCount >= 1) addAchievement('review_bronze');
  if (stats.reviewCount >= 10) addAchievement('review_silver');
  if (stats.reviewCount >= 30) addAchievement('review_gold');
  if (stats.reviewCount >= 50) addAchievement('review_platinum');
  if (stats.reviewCount >= 70) addAchievement('review_diamond');
  if (stats.reviewCount >= 100) addAchievement('review_master');
  if (stats.reviewFastCount >= 1) addAchievement('review_fast');
  if (stats.reviewSelfCount >= 20) addAchievement('review_self');
  if (stats.reviewEmojiCount >= 10) addAchievement('review_emoji_king');

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
  let grade = 'bronze';
  if (score >= 20) grade = 'silver';
  if (score >= 35) grade = 'gold';
  if (score >= 50) grade = 'platinum';
  if (score >= 65) grade = 'diamond';
  if (score >= 80) grade = 'master';

  return {
    grade: grade,
    score: score,
    achievements: [...new Set(achievements)],
    titles: [...new Set(titles)],
  };
}

module.exports = { analyzeGithubEvents, calculateResults };
