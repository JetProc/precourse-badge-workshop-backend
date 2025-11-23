const express = require('express');
const router = express.Router();

require('dotenv').config();

// util import
const { createKakaoResponse } = require('../utils/kakaoResponse');

// 상수 import
const {
  HIDDEN_INPUT_BLOCK_ID,
  REVIEW_INPUT_BLOCK_ID,
  CHECK_GITHUB_ANALYSIS_STATUS_BLOCK_ID,
  SET_TITLE_BLOCK_ID,
  FINISH_FLOW_BLOCK_ID,
} = require('../constants/blockId');
const { WORKSHOP, COMMON_ERRORS } = require('../constants/messages');
const { DEFAULT_TITLE_DEFINITION } = require('../constants/config');

// 모델 import
const Participant = require('../models/Participant');
const PrecourseSetting = require('../models/PrecourseSetting');

// 서비스 import
const { getGithubEvents } = require('../services/githubService');
const { analyzeGithubEvents, calculateResults } = require('../services/githubAnalyzer');
const { createCompletedResponse } = require('../services/workshopService');

// 미들웨어 import
const { checkVerification, loadParticipant } = require('../middleware/auth');
const { checkAnalysisCompleted, checkStatusForReview } = require('../middleware/workshop');

function generateBadgeUrl(participant) {
  const compressedData = {
    nm: participant.nickname, // nickname
    id: participant.githubId, // githubId
    cy: participant.classYear, // classYear
    gr: participant.results.grade, // grade
    sc: participant.results.score, // score
    et: participant.customization.equippedTitle, // equippedTitle
    rf: participant.customization.reflection, // reflection (회고)

    // 업적 (ID 목록만 전달)
    ac: participant.results.achievements,

    // 통계 (수치만 전달)
    st: {
      cc: participant.stats.commitCount,
      rc: participant.stats.reviewCount,
      csm: participant.stats.commitStreakMax,
      cmm: participant.stats.commitMonsterMax,
      cwc: participant.stats.commitWeekendCount,
      crc: participant.stats.commitRefactorCount,
      cfc: participant.stats.commitFixCount,
      rsc: participant.stats.reviewSelfCount,

      po: participant.stats.prOpened ? 1 : 0,
      no: participant.stats.nightowl ? 1 : 0,
      eb: participant.stats.earlybird ? 1 : 0,
      df: participant.stats.deadlineFighter ? 1 : 0,
      cfd: participant.stats.commitFirstDay ? 1 : 0,
      cld: participant.stats.commitLastDay ? 1 : 0,
    },
  };

  const jsonString = JSON.stringify(compressedData);

  // 한글 깨짐 방지를 위해 Buffer 사용
  const encodedData = Buffer.from(jsonString).toString('base64');

  return `${process.env.BASE_URL}?data=${encodeURIComponent(encodedData)}`;
}

/**
 * routes: /api/workshop/setUserInfo
 */
router.post('/setUserInfo', checkVerification, async (req, res) => {
  try {
    const { classYear, nickname } = req.body.action.params;

    const parsedClassYear = parseInt(classYear, 10);
    const formattedNickname = nickname.toUpperCase();

    const participant = await Participant.findOneAndUpdate(
      { githubId: req.githubId },
      {
        githubId: req.githubId,
        classYear: parsedClassYear,
        nickname: formattedNickname,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res
      .status(200)
      .json(
        createKakaoResponse(WORKSHOP.INIT_SUCCESS(formattedNickname), {}, [
          { label: '✨ 질문 받으러 가기 ', blockId: HIDDEN_INPUT_BLOCK_ID },
        ])
      );
  } catch (error) {
    console.error('Error in /setUserInfo:', error.message);
    if (error.name === 'CastError') return res.status(200).json(createKakaoResponse(COMMON_ERRORS.CAST_ERROR));
    res.status(500).json(createKakaoResponse(WORKSHOP.INIT_ERROR));
  }
});

/**
 * routes: /api/workshop/setHiddenInfo
 */
router.post('/setHiddenInfo', checkVerification, loadParticipant, async (req, res) => {
  try {
    const { participant } = req;
    const {
      tdd_attempt,
      readme_master,
      review_study,
      review_thanked,
      blog_share,
      community_writer,
      community_answerer,
    } = req.body.action.params;

    participant.inputs.hiddenAnswers = {
      tdd_attempt: tdd_attempt === 'Y',
      readme_master: readme_master === 'Y',
      review_study: review_study === 'Y',
      review_thanked: review_thanked === 'Y',
      blog_share: blog_share === 'Y',
      community_writer: community_writer === 'Y',
      community_answerer: community_answerer === 'Y',
    };
    participant.analysisStatus = 'processing';
    await participant.save();

    res
      .status(200)
      .json(
        createKakaoResponse(WORKSHOP.SET_HIDDEN_SUCCESS, {}, [
          { label: '📝 회고 작성하기', blockId: REVIEW_INPUT_BLOCK_ID },
        ])
      );

    // Background 실행
    (async () => {
      try {
        console.log(`[Background Job] Analysis started for ${participant.githubId}`);
        const setting = await PrecourseSetting.findOne({ classYear: participant.classYear });
        if (!setting || !setting.weeks) throw new Error('PrecourseSetting not found.');

        const githubEvents = await getGithubEvents(participant.githubId);
        const stats = await analyzeGithubEvents(githubEvents, setting.weeks);
        const results = calculateResults(stats, participant.inputs.hiddenAnswers);

        participant.stats = stats;
        participant.results = results;
        participant.customization.equippedTitle = results.titles[0] || DEFAULT_TITLE_DEFINITION;
        participant.analysisStatus = 'completed';
        await participant.save();
        console.log(`[Background Job] Analysis completed for ${participant.githubId}`);
      } catch (error) {
        console.error(`[Background Job] Error:`, error.message);
        await Participant.updateOne({ githubId: participant.githubId }, { analysisStatus: 'error' });
      }
    })();
  } catch (error) {
    console.error('Error in /setHiddenInfo:', error.message);
    res.status(500).json(createKakaoResponse(WORKSHOP.SET_HIDDEN_ERROR));
  }
});

/**
 * routes: /api/workshop/setReview
 */
router.post('/setReview', checkVerification, loadParticipant, checkStatusForReview, async (req, res) => {
  try {
    const { participant } = req;
    const { reflection } = req.body.action.params;

    if (!reflection || reflection.trim() === '') {
      return res.status(200).json(createKakaoResponse(WORKSHOP.SET_REFLECTION_EMPTY));
    }

    participant.customization.reflection = reflection;
    await participant.save();

    switch (participant.analysisStatus) {
      case 'completed':
        return res.status(200).json(createCompletedResponse(participant));
      case 'processing':
        return res
          .status(200)
          .json(
            createKakaoResponse(WORKSHOP.ANALYSIS_PENDING, {}, [
              { label: '✅ 분석 완료 확인', blockId: CHECK_GITHUB_ANALYSIS_STATUS_BLOCK_ID },
            ])
          );
      case 'error':
      default:
        return res.status(200).json(createKakaoResponse(WORKSHOP.ORDER_ERROR));
    }
  } catch (error) {
    console.error('Error in /setReview:', error.message);
    res.status(500).json(createKakaoResponse(WORKSHOP.SET_REFLECTION_ERROR));
  }
});

/**
 * routes: /api/workshop/checkGithubAnalysisStatus
 */
router.post('/checkGithubAnalysisStatus', checkVerification, loadParticipant, async (req, res) => {
  try {
    const { participant } = req;

    if (participant.analysisStatus === 'pending') {
      return res
        .status(200)
        .json(
          createKakaoResponse(WORKSHOP.STEP_SKIPPED_HIDDEN_QUESTIONS, {}, [
            { label: '✨ 질문 받으러 가기', blockId: HIDDEN_INPUT_BLOCK_ID },
          ])
        );
    }

    switch (participant.analysisStatus) {
      case 'completed':
        return res.status(200).json(createCompletedResponse(participant));
      case 'processing':
        return res
          .status(200)
          .json(
            createKakaoResponse(WORKSHOP.ANALYSIS_PENDING, {}, [
              { label: '✅ 분석 완료 확인', blockId: CHECK_GITHUB_ANALYSIS_STATUS_BLOCK_ID },
            ])
          );
      case 'error':
      default:
        return res.status(200).json(createKakaoResponse(WORKSHOP.ORDER_ERROR));
    }
  } catch (error) {
    console.error('Error in /checkGithubAnalysisStatus:', error.message);
    res.status(500).json(createKakaoResponse(WORKSHOP.SET_REFLECTION_ERROR));
  }
});

/**
 * routes: /api/workshop/getTitles
 */
router.post('/getTitles', checkVerification, loadParticipant, checkAnalysisCompleted, async (req, res) => {
  try {
    const { participant } = req;
    const buttons = participant.results.titles.map((title) => ({
      label: title,
      blockId: SET_TITLE_BLOCK_ID,
      messageText: title,
    }));

    buttons.unshift({
      label: '🙅 바꾸지 않을래요',
      blockId: FINISH_FLOW_BLOCK_ID,
      messageText: 'cancel',
    });

    return res.status(200).json(createKakaoResponse(WORKSHOP.GET_TITLES_SUCCESS, {}, buttons));
  } catch (error) {
    console.error('Error in /getTitles:', error.message);
    res.status(500).json(createKakaoResponse(WORKSHOP.SET_TITLE_ERROR));
  }
});

/**
 * routes: /api/workshop/setTitle
 */
router.post('/setTitle', checkVerification, loadParticipant, checkAnalysisCompleted, async (req, res) => {
  try {
    const { participant } = req;
    const chosenTitle = req.body.userRequest.utterance.trim();

    if (!participant.results.titles.includes(chosenTitle)) {
      const buttons = participant.results.titles.map((title) => ({
        label: title,
        blockId: SET_TITLE_BLOCK_ID,
        messageText: title,
      }));
      buttons.unshift({
        label: '🙅 바꾸지 않을래요',
        blockId: FINISH_FLOW_BLOCK_ID,
        messageText: 'cancel',
      });
      return res.status(200).json(createKakaoResponse(WORKSHOP.SET_TITLE_INVALID, {}, buttons));
    }

    participant.customization.equippedTitle = chosenTitle;
    await participant.save();

    const webLinkUrl = generateBadgeUrl(participant);
    console.log('1. weblinkurl:', webLinkUrl);

    return res
      .status(200)
      .json(
        createKakaoResponse(WORKSHOP.SET_TITLE_SUCCESS(chosenTitle), {}, [
          { label: '🏆 내 훈장 보러가기', action: 'webLink', webLinkUrl: webLinkUrl },
        ])
      );
  } catch (error) {
    console.error('Error in /setTitle:', error.message);
    res.status(500).json(createKakaoResponse(WORKSHOP.SET_TITLE_ERROR));
  }
});

/**
 * routes: /api/workshop/finish
 */
router.post('/finish', checkVerification, loadParticipant, checkAnalysisCompleted, async (req, res) => {
  try {
    const { participant } = req;

    const webLinkUrl = generateBadgeUrl(participant);
    console.log('1. weblinkurl:', webLinkUrl);

    return res
      .status(200)
      .json(
        createKakaoResponse(WORKSHOP.SET_TITLE_CANCELED(participant.customization.equippedTitle), {}, [
          { label: '🏆 내 훈장 보러가기', action: 'webLink', webLinkUrl: webLinkUrl },
        ])
      );
  } catch (error) {
    console.error('Error in /finish:', error.message);
    res.status(500).json(createKakaoResponse(WORKSHOP.SET_TITLE_ERROR));
  }
});

module.exports = router;
