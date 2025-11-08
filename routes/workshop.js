const express = require('express');
const router = express.Router();
const axios = require('axios');
require('dotenv').config();

const { createKakaoResponse } = require('../utils/kakaoResponse');
const { WORKSHOP_COMPLETED_BLOCK_ID, START_AUTH_BLOCK_ID } = require('../constants/blockId');

const Participant = require('../models/Participant');
const PrecourseSetting = require('../models/PrecourseSetting');
const AuthSession = require('../models/AuthSession');

const { ACHIEVEMENT_DEFINITIONS, TITLE_DEFINITIONS } = require('../constants/definition');
const { analyzeGithubEvents, calculateResults } = require('../services/githubAnalyzer'); // 이 서비스 파일을 사용

const GITHUB_ADMIN_TOKEN = process.env.GITHUB_ADMIN_TOKEN;

router.post('/order', async (req, res) => {
  try {
    const chatbotUserId = req.body.userRequest.user.id;
    const { nickname, classYear, ...hiddenParams } = req.body.action.params;

    const hiddenAnswers = {};
    for (const key in hiddenParams) {
      if (key.startsWith('hidden_')) {
        hiddenAnswers[key.replace('hidden_', '')] = hiddenParams[key] === 'true';
      }
    }

    const authSession = await AuthSession.findOne({ chatbotUserId: chatbotUserId });
    if (!authSession || authSession.status !== 'verified' || !authSession.githubId) {
      return res
        .status(403)
        .json(
          createKakaoResponse(['인증 정보가 유효하지 않습니다.\n다시 인증해주세요. 😥'], {}, [
            { label: '🎖️ 신규 훈장 제작', blockId: START_AUTH_BLOCK_ID },
          ])
        );
    }
    const githubId = authSession.githubId;

    const setting = await PrecourseSetting.findOne({ classYear: parseInt(classYear, 10) });
    if (!setting || !setting.weeks || setting.weeks.length === 0) {
      return res
        .status(400)
        .json(createKakaoResponse([`(${classYear}기) 프리코스 주차별 일정 정보를 찾을 수 없습니다.`]));
    }
    const weekSchedule = setting.weeks;

    const githubEventsResponse = await axios.get(`https://api.github.com/users/${githubId}/events?per_page=100`, {
      headers: { Authorization: `token ${GITHUB_ADMIN_TOKEN}` },
    });
    const githubEvents = githubEventsResponse.data;

    console.log(`[Order API] Fetched ${githubEvents.length} events for ${githubId} (classYear: ${classYear}).`);

    // 핵심: analyzeGithubEvents 함수 호출
    const stats = analyzeGithubEvents(githubEvents, weekSchedule);
    // 핵심: calculateResults 함수 호출
    const results = calculateResults(stats, hiddenAnswers);

    const participantData = {
      githubId: githubId,
      classYear: parseInt(classYear, 10),
      nickname: nickname,
      inputs: { hiddenAnswers: hiddenAnswers },
      stats: stats,
      results: results,
      customization: {
        equippedTitle: results.titles[0] || TITLE_DEFINITIONS.default,
        reflection: req.body.action.params.reflection || '',
      },
    };

    const updatedParticipant = await Participant.findOneAndUpdate(
      { githubId: githubId },
      { $set: participantData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`[Order API] Participant data UPSERTED: ${updatedParticipant._id}`);

    const responseMessages = [
      `${updatedParticipant.nickname}님의 훈장 제작이 완료되었습니다! ✨`,
      '아래 버튼을 눌러 훈장을 확인해보세요!',
    ];
    const responseData = { githubId: githubId };
    const responseButtons = [{ label: '🏆 내 훈장 보러가기', blockId: WORKSHOP_COMPLETED_BLOCK_ID }];
    res.status(200).json(createKakaoResponse(responseMessages, responseData, responseButtons));
  } catch (error) {
    console.error('Error in /api/workshop/order endpoint:', error.message, error.stack);
    res.status(500).json(createKakaoResponse(['훈장 제작 중 예상치 못한 오류가 발생했습니다. 😥']));
  }
});

router.post('/my-data', async (req, res) => {
  try {
    const chatbotUserId = req.body.userRequest.user.id;

    // 1. 인증 정보 확인 (authSession에서 githubId 가져오기)
    const authSession = await AuthSession.findOne({ chatbotUserId: chatbotUserId });
    if (!authSession || authSession.status !== 'verified' || !authSession.githubId) {
      return res
        .status(403)
        .json(
          createKakaoResponse(['인증 정보가 유효하지 않습니다.\n다시 인증해주세요. 😥'], {}, [
            { label: '🎖️ 신규 훈장 제작', blockId: START_AUTH_BLOCK_ID },
          ])
        );
    }
    const githubId = authSession.githubId;

    // 2. Participant DB에서 해당 유저의 훈장 정보 조회
    const participant = await Participant.findOne({ githubId: githubId });
    if (!participant) {
      // (이 경우는 /order를 아직 완료하지 않은 사용자)
      return res
        .status(404)
        .json(
          createKakaoResponse([
            '아직 훈장을 제작하지 않았습니다. [🎖️ 신규 훈장 제작] 버튼을 눌러 먼저 훈장을 만들어주세요.',
          ])
        );
    }

    // 3. 필요한 데이터(호칭, 회고, 해금된 호칭 목록) 추출
    const data = {
      equippedTitle: participant.customization.equippedTitle,
      reflection: participant.customization.reflection,
      unlockedTitles: participant.results.titles, // (호칭 변경 시 목록을 보여주기 위해 필요)
    };

    // 4. 챗봇에게 'data' 객체와 함께 응답 전송
    return res.status(200).json(createKakaoResponse(['현재 설정된 정보를 불러왔습니다.'], data));
  } catch (error) {
    console.error('Error in /api/workshop/my-data endpoint:', error.message, error.stack);
    res.status(500).json(createKakaoResponse(['정보를 불러오는 중 오류가 발생했습니다. 😥']));
  }
});

module.exports = router;
