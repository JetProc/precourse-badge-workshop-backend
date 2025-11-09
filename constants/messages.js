// constants/messages.js

const { GITHUB_AUTH_URL } = require('./url');

const AUTH = {
  // /start
  START_PROMPT: (user_code) => [
    `훈장을 제작하려면\n✨ GitHub 본인 인증 ✨\n이 필요해요!\n\nPC나 모바일에서\n${GITHUB_AUTH_URL}\n에 접속해 아래 코드를 입력해주세요. 😎`,
    `아래 코드를 꾹 눌러 복사하여 사용하세요! 😉`,
    `${user_code}`,
    `인증이 완료 되었다면 아래의\n[✅ 인증 완료] 버튼\n을 꾹! 눌러주세요! 😊`,
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
  CLASS_YEAR_INVALID_FORMAT: ['❗ 기수(숫자)만 정확히 입력해주세요.\n(예: 8) 🔢\n\n'],
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
  YES_NO_INVALID: ['❗ Y 또는 N (혹은 예, 아니오)으로만 답변해주세요. 😥'],
  YES_NO_SERVER_ERROR: ['❗ Y/N 검증 중 서버 오류가 발생했어요. 🥲\n\n'],
};

const WORKSHOP = {
  // init-participant
  INIT_SUCCESS: (nickname) => [
    `${nickname}님, 환영합니다! 🎉`,
    `이제부터 7개의 '히든 업적' 질문을 시작할게요.\n(Y/N)으로 답해주세요. 📝`,
  ],
  INIT_ERROR: ['앗! 😵 초기 설정 중', '서버 오류가 발생했어요.\n잠시 후 다시 시도해주세요. 😥'],

  // setHiddenInfo
  SET_HIDDEN_SUCCESS: [
    '모든 히든 질문에 답변해주셔서 감사합니다! 👏',
    "마지막으로 '제작 후기(회고)'를 한마디 적어주세요. ✍️",
  ],
  SET_HIDDEN_ERROR: ['앗! 😵 히든 업적 저장 중', '서버 오류가 발생했어요.\n잠시 후 다시 시도해주세요. 😥'],

  // setReflection
  SET_REFLECTION_EMPTY: ['회고 내용이 비어있어요. 🙁', '한 글자 이상 입력해주세요. ✍️'],
  SET_REFLECTION_SUCCESS: [
    `감사합니다! 회고가 성공적으로 저장되었어요. ✅`,
    `이제 모든 훈장 재료가 준비되었습니다! 🥳`,
    `[🏭 훈장 맡기기] 버튼을 눌러\nGitHub 활동 분석을 시작해주세요!\n(약 1~2분 소요) ⏳`,
  ],
  SET_REFLECTION_ERROR: ['앗! 😵 회고 저장 중', '서버 오류가 발생했어요.\n잠시 후 다시 시도해주세요. 😥'],

  // order (final)
  ORDER_SUCCESS: (nickname) => [
    `${nickname}님의 훈장 제작이 완료되었어요! ✨`,
    '아래 버튼을 눌러\n당신의 멋진 훈장을 확인해보세요! 🏆🎉',
  ],
  ORDER_ERROR: ['앗! 😵 훈장 제작 중', '예상치 못한 오류가 발생했어요. 😥'],

  // my-data
  MY_DATA_SUCCESS: ['현재 설정된 정보를 성공적으로 불러왔습니다! 📋'],
  MY_DATA_ERROR: ['앗! 😵 정보를 불러오는 중', '오류가 발생했어요. 😥'],
};

const COMMON_ERRORS = {
  USER_ID_NOT_FOUND: ['오류: 사용자 ID를 식별할 수 없어요. 🧐'],
  NOT_VERIFIED: ['인증 정보가 유효하지 않아요. 😥', '[🎖️ 신규 훈장 제작하기] 버튼\n을 다시 눌러 인증해주세요! 🚀'],
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
