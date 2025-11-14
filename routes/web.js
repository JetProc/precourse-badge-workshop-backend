const express = require('express');
const router = express.Router();

// 모델 import
const Participant = require('../models/Participant');
const PrecourseSetting = require('../models/PrecourseSetting');

/**
 * ========================================
 * GET /api/web/settings
 * ========================================
 * 프론트엔드 전시장의 '기수 선택' 드롭다운 목록을 위한 API입니다.
 * 최신 기수가 먼저 오도록 정렬된 기수 배열(예: [9, 8])을 반환합니다.
 */
router.get('/settings', async (req, res) => {
  try {
    // classYear 필드를 기준으로 내림차순(최신순) 정렬
    const settings = await PrecourseSetting.find().sort({ classYear: -1 });

    // PrecourseSetting 객체 배열에서 classYear 값만 추출
    const classYears = settings.map((s) => s.classYear);

    res.status(200).json(classYears);
  } catch (error) {
    console.error('Error in /api/web/settings:', error.message, error.stack);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

/**
 * ========================================
 * GET /api/web/participants
 * ========================================
 * 프론트엔드 전시장 메인 페이지의 훈장 목록을 위한 메인 API입니다.
 * 기수(classYear)는 필수이며, 정렬(sortBy, order) 및 검색(search)을 지원합니다.
 */
router.get('/participants', async (req, res) => {
  try {
    // 1. 쿼리 파라미터 구조 분해 (기본값 설정)
    const { classYear, sortBy = 'tier', order = 'desc', search = '' } = req.query;

    // 2. [필수] 기수(classYear) 쿼리 검사
    if (!classYear) {
      return res.status(400).json({ error: 'classYear 쿼리 파라미터는 필수입니다.' });
    }

    // 3. Mongoose 쿼리 객체 생성
    let query = { classYear: parseInt(classYear, 10) };

    // 4. [검색] search 쿼리가 있으면 githubId에 대한 regex (대소문자 무관) 필터 추가
    if (search) {
      query.githubId = { $regex: search, $options: 'i' };
    }

    // 5. [정렬] Mongoose sort 객체 생성
    const sortOrder = order === 'asc' ? 1 : -1;
    let sortQuery = {};

    if (sortBy === 'tier') {
      // '티어'는 'results.score' (점수)를 기준으로 정렬합니다.
      sortQuery['results.score'] = sortOrder;
    } else if (sortBy === 'name') {
      // '이름'은 'githubId'를 기준으로 정렬합니다.
      sortQuery['githubId'] = sortOrder;
    }

    // 6. 2차 정렬 추가 (항상)
    sortQuery['githubId'] = sortQuery['githubId'] || 1;

    // 7. [최적화] 전시장 목록 표시에 필요한 데이터만 선택(select)
    // [수정됨] 요청하신 4가지 + githubId를 포함합니다.
    const fieldsToSelect = 'githubId nickname results.grade results.achievements customization.equippedTitle';

    const participants = await Participant.find(query).sort(sortQuery).select(fieldsToSelect);

    res.status(200).json(participants);
  } catch (error) {
    console.error('Error in /api/web/participants:', error.message, error.stack);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

/**
 * ========================================
 * GET /api/web/participant/:githubId
 * ========================================
 * 개인 훈장 보관소 (상세 페이지)를 위한 API입니다.
 * :githubId에 해당하는 참가자의 모든 상세 정보를 반환합니다.
 */
router.get('/participant/:githubId', async (req, res) => {
  try {
    const { githubId } = req.params;
    const participant = await Participant.findOne({ githubId: githubId });

    // 1. [예외 처리] 기획안대로 참가자를 찾지 못한 경우 404 반환
    if (!participant) {
      return res.status(404).json({ error: '해당 훈장(사용자)을 찾을 수 없습니다.' });
    }

    // 2. [상세 정보] participant 문서의 모든 정보
    // (stats, results, customization 포함)
    res.status(200).json(participant);
  } catch (error) {
    console.error(`Error in /api/web/participant/${req.params.githubId}:`, error.message, error.stack);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
