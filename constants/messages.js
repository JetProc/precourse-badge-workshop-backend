const { GITHUB_AUTH_URL } = require('./url');

const AUTH = {
  // /start
  START_PROMPT: (user_code) => [
    `훈장을 제작하려면\n✨ GitHub 본인 인증 ✨\n이 필요해요!\n\nPC나 모바일에서\n${GITHUB_AUTH_URL}\n에 접속해 아래 코드를 입력해주세요. 😎\n\n처음이라면 깃허브 로그인을\n먼저 해야할 수도 있습니다! 🙂\n\n아래 코드를 꾹 눌러 복사하여 깃허브에 붙여넣어주세요! 😉`,
    `${user_code}`,
    `인증이 완료 되었다면 아래의\n[✅ 인증 완료] 버튼을 누르거나\n'인증 완료'라고 채팅창에 보내주세요! 😊`,
  ],
  START_ALREADY_VERIFIED: (githubId) => [
    `${githubId}님! 🥳\n이미 인증이 완료되었어요! 😎`,
    `본격적으로 훈장을 제작해볼까요? 🚀`,
  ],
  START_ERROR: ['앗! 😵\nGitHub 인증 시작 중', '예상치 못한 문제가 발생했어요.\n다시 시도해주세요. 😥'],

  // /check-auth
  CHECK_NO_SESSION: ['인증 세션이 없어요. 😥', '[🎖️ 신규 훈장 제작하기] 버튼\n을 다시 눌러서 시작해주세요!'],
  CHECK_ALREADY_VERIFIED: (githubId) => [
    `${githubId}님! 🥳\n이미 인증이 완료되었어요! 😎`,
    `본격적으로 훈장을 제작해볼까요? 🚀`,
  ],
  CHECK_SUCCESS: (githubId) => [`인증이 성공적으로 완료되었어요! ✅`, `${githubId}님, 반갑습니다! 🤗`],
  CHECK_PENDING: ['아직 사용자가 GitHub에서 코드를 입력하거나 승인하지 않았어요... 😥'],
  CHECK_EXPIRED: ['인증 시간이 초과되었어요. ⏱️\n처음부터 다시 시작해주세요. 😓'],
  CHECK_ERROR_UNKNOWN: (error) => ['인증 중 알 수 없는 오류가 발생했어요. 😵', `(${error})`],
  CHECK_ERROR_INTERNAL: ['앗! 😵\nGitHub 인증 확인 중', '내부적인 문제가 발생했어요\n다시 시도해주세요. 😥'],
};

const VALIDATION = {
  // class-year
  CLASS_YEAR_INVALID_FORMAT: ['❗ 기수(숫자)만 정확히 입력해주세요.\n\n'],
  CLASS_YEAR_NOT_FOUND: ['❗ 존재하지 않는 기수 정보입니다. 😢\n\n'],
  CLASS_YEAR_SERVER_ERROR: ['❗ 서버 오류가 발생했어요.', '잠시 후 다시 시도해주세요. 🥲\n\n'],

  // nickname
  NICKNAME_LENGTH: ['❗ 닉네임은 1글자 이상 12글자 이하로 입력해주세요. 😅\n\n'],
  NICKNAME_INVALID_CHARS: ['❗ 닉네임은 영어, 한글, 숫자만 가능해요. (공백, 특수문자 🚫)\n\n'],
  NICKNAME_STARTS_WITH_NUMBER: ['❗ 닉네임은 숫자로 시작할 수 없어요. 🚫\n\n'],
  NICKNAME_DUPLICATE: (nickname) => [
    `❗ [ ${nickname} ]은(는)\n이미 사용 중인 닉네임이에요. 😵`,
    '다른 닉네임을 입력해주세요. 😊',
  ],
  NICKNAME_SERVER_ERROR: ['❗ 닉네임 검증 중 서버 오류가 발생했어요. 🥲\n\n'],

  // yes-no
  YES_NO_INVALID: ['❗ y 또는 n으로만 답변해주세요. 😥\n\n'],
  YES_NO_SERVER_ERROR: ['❗ Y/N 검증 중 서버 오류가 발생했어요. 🥲\n\n'],
};

const WORKSHOP = {
  // init-participant
  INIT_SUCCESS: (nickname) => [
    `${nickname}님, 환영합니다! 🎉`,
    `이제부터는 깃헙 기록만으론 알 수 없는\n7개의 '히든 활동' 질문을 시작할게요.\n\n솔직하게 질문에 답하면서 프리코스를 되돌아볼까요?`,
    `답은 (y/n)으로 해주세요! 📝`,
  ],
  INIT_ERROR: ['앗! 😵 초기 설정 중', '서버 오류가 발생했어요.\n잠시 후 다시 시도해주세요. 😥'],

  // setHiddenInfo
  SET_HIDDEN_SUCCESS: [
    '질문에 답변해주셔서 감사합니다!\n당신은 훈장 받을 자격이 있는 것 같습니다!👏',
    "마지막으로 [📝 회고 작성하기]버튼을 눌러\n'제작 후기(회고)'를 한마디 적어주세요. ✍️",
  ],
  SET_HIDDEN_ERROR: ['앗! 😵 히든 업적 저장 중', '서버 오류가 발생했어요.\n잠시 후 다시 시도해주세요. 😥'],

  // setReflection
  SET_REFLECTION_EMPTY: ['회고 내용이 비어있어요. 🙁', '한 글자 이상 입력해주세요. ✍️'],
  SET_REFLECTION_SUCCESS: (nickname, statsMessage, grade, score, achievementMessage, titleMessage, equippedTitle) => [
    // [말풍선 1: 인사, 스탯, 등급]
    `그렇군요, ${nickname}님!\n이제 모든 준비를 마쳤습니다. 🥳\n\n훈장을 보기 전에 먼저\n프리코스 기간동안의 Github 활동 기록입니다!\n\n` +
      `===== 📊 GitHub 활동 요약 =====\n${statsMessage}\n\n` +
      // 등급 및 점수 표시
      `===== 🏆 종합 등급 =====\n` +
      `당신의 등급은 [ ${grade.toUpperCase()} ] 입니다!\n` +
      `(총 ${score}점 획득)\n` +
      `* 업적 1개당 5점씩 반영됩니다.`, //

    // [말풍선 2: 업적 및 칭호]
    `그리고 활동 기록에 따른 업적과 칭호입니다!\n\n===== ✨ 획득 업적 (${achievementMessage.count}개) =====\n${
      achievementMessage.names || '없음'
    }\n\n` + `===== ⭐ 획득 칭호 (${titleMessage.count}개) =====\n${titleMessage.names || '없음'}`,

    // [말풍선 3: 칭호 설정 및 CTA]
    `현재 칭호는\n${equippedTitle}\n(으)로 설정되어 있습니다.\n\n` + `다른 칭호로 변경하시겠어요?`,
  ],
  SET_REFLECTION_PENDING: [
    '회고가 성공적으로 저장되었습니다. ✍️',
    'GitHub 활동 분석이 아직 진행 중입니다. 🧑‍🏭 (약 5~10초 소요)',
    '잠시 후 이 [회고 다시 제출] 버튼을 눌러주세요!',
  ],
  SET_REFLECTION_ERROR: ['앗! 😵 회고 저장 중', '서버 오류가 발생했어요.\n잠시 후 다시 시도해주세요. 😥'],

  STEP_SKIPPED_HIDDEN_QUESTIONS: [
    '앗! 😵',
    "이전 단계인 '히든 질문'을 먼저 완료해주세요!",
    '버튼을 눌러 히든 질문 단계로 이동합니다. 👇',
  ],

  ANALYSIS_PENDING: [
    'GitHub 활동 분석이 아직 진행 중입니다. 🧑‍🏭 (약 5~10초 소요)',
    '잠시 후 [✅ 분석 완료 확인] 버튼을 눌러주세요!',
  ],

  ORDER_ERROR: ['앗! 😵 훈장 제작 중', '예상치 못한 오류가 발생했어요. 😥'],

  GET_TITLES_SUCCESS: ['변경할 칭호를 선택해주세요. 👇'],

  SET_TITLE_CANCELED: (title) => [
    `칭호를 ${title}(으)로 유지합니다. 😌`,
    `이제 [🏆 내 훈장 보러가기] 버튼을 눌러\n제작된 훈장 카드를 확인해보세요!`,
  ],

  SET_TITLE_SUCCESS: (title) => [
    `당신의 칭호가\n${title}\n(으)로 설정되었습니다! 🥳`,
    `이제 [🏆 내 훈장 보러가기] 버튼을 눌러\n제작된 훈장 카드를 확인해보세요!`,
  ],
  SET_TITLE_INVALID: ['앗! 😅', '선택한 칭호가 획득한 칭호 목록에 없어요.\n다시 시도해주세요.'],
  SET_TITLE_ERROR: ['앗! 😵 칭호 설정 중', '서버 오류가 발생했어요.\n잠시 후 다시 시도해주세요. 😥'],
};

const COMMON_ERRORS = {
  USER_ID_NOT_FOUND: ['오류: 사용자 ID를 식별할 수 없어요. 🧐'],
  NOT_VERIFIED: ['인증 정보가 유효하지 않아요. 😥', '[🔓 깃헙 인증하러 가기] 버튼\n을 다시 눌러 인증해주세요! 🚀'],
  CAST_ERROR: ['잘못된 형식의 데이터가 전달되었어요. 😵', '다시 시도해주세요. 😥'],
  PARTICIPANT_NOT_FOUND: ['사용자 정보를 찾을 수 없어요. 😢', '다시 인증해주세요. 😥'],
  PARTICIPANT_NOT_CREATED: [
    '아직 훈장을 제작하지 않았어요. 😭',
    '[🎖️ 신규 훈장 제작하기] 버튼을 눌러',
    '먼저 훈장을 만들어주세요! 🛠️',
  ],
};

module.exports = {
  AUTH,
  VALIDATION,
  WORKSHOP,
  COMMON_ERRORS,
};
