const express = require('express');
const router = express.Router();
require('dotenv').config();

const PrecourseSetting = require('../models/PrecourseSetting');

const createValidationResponse = (status, message) => {
  return {
    status,
    message,
  };
};

/**
 * POST /api/validation/class-year
 * '기수' 파라미터를 검증합니다.
 */
router.post('/class-year', async (req, res) => {
  try {
    // 1. 카카오 검증 스킬이 보내주는 사용자 입력값을 받습니다.
    const userInput = req.body.utterance;

    // 2. 숫자로 변환
    const classYear = parseInt(userInput, 10);
    // 3. 숫자가 아니거나 0 이하인 경우
    if (isNaN(classYear) || classYear <= 0 || classYear >= 50) {
      console.log(`[Validation FAIL] Invalid number: ${userInput}`);
      return res.status(200).json(createValidationResponse('FAIL', '잘못된 형식입니다.😢\n\n'));
    }

    // 4. DB에서 해당 기수 정보가 있는지 확인
    const setting = await PrecourseSetting.findOne({ classYear: classYear });

    if (setting) {
      // 5. (성공) DB에 기수 정보가 있음
      console.log(`[Validation SUCCESS] classYear: ${classYear} found.`);
      return res.status(200).json(createValidationResponse('SUCCESS'));
    } else {
      // 6. (실패) DB에 기수 정보가 없음
      console.log(`[Validation FAIL] classYear: ${classYear} not found in DB.`);
      return res.status(200).json(createValidationResponse('FAIL', '기수 정보가 없습니다.😢\n\n'));
    }
  } catch (error) {
    console.error('Error in /validation/class-year endpoint:', error.message);
    // 검증 단계에서 500 에러가 나도 FAIL로 처리하여 사용자 입력을 다시 받음
    return res.status(500).json(createValidationResponse('FAIL', '서버 오류입니다.🥲\n\n'));
  }
});

module.exports = router;
