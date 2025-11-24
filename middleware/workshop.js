const { createKakaoResponse } = require('../utils/kakaoResponse');

const { HIDDEN_INPUT_BLOCK_ID, CHECK_GITHUB_ANALYSIS_STATUS_BLOCK_ID } = require('../constants/blockId');
const { WORKSHOP } = require('../constants/messages');

/**
 * 분석이 'completed' 상태일 때만 통과시킵니다.
 * 'pending', 'processing', 'error' 상태는 각기 다른 메시지로 차단합니다.
 */
const checkAnalysisCompleted = (req, res, next) => {
  const { participant } = req;

  if (participant.analysisStatus === 'pending') {
    console.warn(`[Middleware WARN] User ${participant.githubId} skipped hidden questions.`);
    return res
      .status(200)
      .json(
        createKakaoResponse(WORKSHOP.STEP_SKIPPED_HIDDEN_QUESTIONS, {}, [
          { label: '✨ 질문 받으러 가기', blockId: HIDDEN_INPUT_BLOCK_ID },
        ])
      );
  }

  if (participant.analysisStatus === 'processing') {
    console.log(`[Middleware INFO] User ${participant.githubId} analysis is processing.`);
    return res
      .status(200)
      .json(
        createKakaoResponse(WORKSHOP.ANALYSIS_PENDING, {}, [
          { label: '✅ 분석 완료 확인', blockId: CHECK_GITHUB_ANALYSIS_STATUS_BLOCK_ID },
        ])
      );
  }

  if (participant.analysisStatus === 'error') {
    console.error(`[Middleware ERROR] User ${participant.githubId} analysis status is 'error'.`);
    return res.status(200).json(createKakaoResponse(WORKSHOP.ORDER_ERROR));
  }

  // 'completed' 상태인 경우에만 다음 핸들러로 진행
  if (participant.analysisStatus === 'completed') {
    next();
  } else {
    console.error(`[Middleware ERROR] User ${participant.githubId} has unknown status: ${participant.analysisStatus}`);
    return res.status(200).json(createKakaoResponse(WORKSHOP.ORDER_ERROR));
  }
};

/**
 * '/setReview' 전용
 * 'pending' 상태만 차단합니다.
 */
const checkStatusForReview = (req, res, next) => {
  const { participant } = req;

  if (participant.analysisStatus === 'pending') {
    console.warn(`[setReview WARN] User ${participant.githubId} skipped hidden questions.`);
    return res
      .status(200)
      .json(
        createKakaoResponse(WORKSHOP.STEP_SKIPPED_HIDDEN_QUESTIONS, {}, [
          { label: '✨ 질문 받으러 가기', blockId: HIDDEN_INPUT_BLOCK_ID },
        ])
      );
  }

  next();
};

module.exports = {
  checkAnalysisCompleted,
  checkStatusForReview,
};
