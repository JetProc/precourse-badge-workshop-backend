//업적 정의
const ACHIEVEMENT_DEFINITIONS = {
  // --- 1. 커밋 관련 ---
  commit_bronze: {
    name: '🥉 커밋_브론즈',
    description: '첫 번째 커밋을 달성했습니다. 시작이 반입니다!',
  },
  commit_silver: {
    name: '🥈 커밋_실버',
    description: '프리코스 기간 중 커밋 20회를 달성했습니다.',
  },
  commit_gold: {
    name: '🥇 커밋_골드',
    description: '프리코스 기간 중 커밋 50회를 달성했습니다.',
  },
  commit_platinum: {
    name: '💿 커밋_플래티넘',
    description: '프리코스 기간 중 커밋 80회를 달성했습니다.',
  },
  commit_diamond: {
    name: '💎 커밋_다이아몬드',
    description: '프리코스 기간 중 커밋 110회를 달성했습니다.',
  },
  commit_master: {
    name: '👑 커밋_마스터',
    description: '프리코스 기간 중 커밋 150회 이상을 달성했습니다.',
  },
  commit_streak: {
    name: '🔥 불타는 5일',
    description: '5일 연속으로 커밋하는 데 성공했습니다.',
  },
  commit_weekend: {
    name: '☀️ 주말에도 코딩',
    description: '주말(토/일)에 10회 이상 커밋했습니다.',
  },
  commit_refactor: {
    name: '🧹 코드 청소부',
    description: "'refactor' 메시지를 포함한 커밋을 5회 이상 남겼습니다.",
  },
  commit_fix: {
    name: '🐞 버그 헌터',
    description: "'fix' 메시지를 포함한 커밋을 5회 이상 남겼습니다.",
  },
  commit_monster: {
    name: '🚂 폭주 기관차',
    description: '하루에 15회 이상 커밋한 기록이 있습니다.',
  },
  commit_first_day: {
    name: '👣 첫날의 발자국',
    description: '프리코스 미션 시작일(첫날)에 커밋했습니다.',
  },
  commit_last_day: {
    name: '🏁 마지막의 발자국',
    description: '프리코스 미션 마감일에 커밋했습니다.',
  },

  // --- 2. 리뷰 관련 ---
  review_bronze: {
    name: '🥉 코드 리뷰_브론즈',
    description: '첫 번째 코드 리뷰를 작성했습니다.',
  },
  review_silver: {
    name: '🥈 코드 리뷰_실버',
    description: '코드 리뷰 10회를 달성했습니다.',
  },
  review_gold: {
    name: '🥇 코드 리뷰_골드',
    description: '코드 리뷰 30회를 달성했습니다.',
  },
  review_platinum: {
    name: '💿 코드 리뷰_플래티넘',
    description: '코드 리뷰 50회를 달성했습니다.',
  },
  review_diamond: {
    name: '💎 코드 리뷰_다이아몬드',
    description: '코드 리뷰 70회를 달성했습니다.',
  },
  review_master: {
    name: '👑 코드 리뷰_마스터',
    description: '코드 리뷰 100회 이상을 달성했습니다.',
  },
  review_fast: {
    name: '⚡️ 광속 리뷰어',
    description: '동료의 PR이 생성된 지 1시간 이내에 리뷰를 남겼습니다.',
  },
  review_thanked: {
    name: '(🔒) 💌 고마워요!',
    description: '(히든) 작성한 리뷰가 동료에게 감사 인사를 받았습니다. 잠금 해제 시 반짝이는 하트 등장 💖',
  },
  review_study: {
    name: '🕵️ 탐구하는 리뷰어',
    description: '(히든) 더 나은 리뷰를 위해 깊은 자료 탐색을 수행했습니다. ✨',
  },
  review_self: {
    name: '🧠 스스로의 멘토',
    description: '자신의 PR에 스스로 20회 이상 코멘트를 남겼습니다.',
  },
  review_emoji_king: {
    name: '🤖 이모지 리액터',
    description: '리뷰/코멘트에 10개 이상의 이모지를 사용했습니다. 🤖👍🎉',
  },

  // --- 3. 시간 관련 ---
  deadline_fighter: {
    name: '⏰ 데드라인 파이터',
    description: '마감 1시간 전부터 마감 직전까지 커밋했습니다. 짜릿한 승부!',
  },
  earlybird: {
    name: '🐦 얼리버드',
    description: '새벽 3시~6시 사이에 커밋했습니다.',
  },
  nightowl: {
    name: '🌙 올빼미',
    description: '자정~새벽 3시 사이에 커밋했습니다.',
  },

  // --- 4. 프로세스 관련 ---
  pr_opened: {
    name: '🚀 첫 PR',
    description: '첫 번째 Pull Request를 생성했습니다.',
  },
  tdd_attempt: {
    name: '(🔒) 🧪 TDD 선구자',
    description: '(히든) 테스트 주도 개발을 실제로 시도했습니다. 👨‍🔬',
  },
  readme_master: {
    name: '(🔒) 📘 문서화의 달인',
    description: '(히든) README.md를 1000자 이상 정성껏 작성했습니다. ✍️',
  },

  // --- 5. 커뮤니티 관련 ---
  blog_share: {
    name: '(🔒) 📝 지식 공유자',
    description: '(히든) 블로그에 학습 경험을 공유했습니다. 세상에 지식을 퍼뜨렸습니다 🌍',
  },
  community_writer: {
    name: '(🔒) ✍️ 커뮤니티 작가',
    description: '(히든) 커뮤니티에 5회 이상 게시글을 작성했습니다.',
  },
  community_answerer: {
    name: '(🔒) 💬 친절한 답변가',
    description: '(히든) 커뮤니티에서 10회 이상 댓글을 작성했습니다.',
  },
};

//칭호 정의
const TITLE_DEFINITIONS = {
  earlybird: '[얼리버드]',
  nightowl: '[올빼미]',
  commit_streak: '[꾸준함의 증표]',
  commit_gold: '[커밋 장인]',
  review_gold: '[친절한 리뷰어]',
  deadline_fighter: '[데드라인 파이터]',
  readme_master: '[문서화의 달인]',
  blog_share: '[지식 공유자]',
  community_answerer: '[적극적인 참여자]',
  review_emoji_king: '[이모지 리액터]',
  default: '[프리코스 완주자]', // 기본 칭호
};

module.exports = { ACHIEVEMENT_DEFINITIONS, TITLE_DEFINITIONS };
