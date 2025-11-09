const express = require('express');
const router = express.Router();
require('dotenv').config();

const PrecourseSetting = require('../models/PrecourseSetting');
const Participant = require('../models/Participant');

const { VALIDATION } = require('../constants/messages');

const createValidationResponse = (status, message) => {
  return {
    status,
    message,
  };
};

/**
 * /api/validation/class-year
 * '기수' 파라미터를 검증합니다.
 */
router.post('/class-year', async (req, res) => {
  try {
    const userInput = req.body.utterance;

    const numberRegex = /^[1-9]\d*$/;

    if (!numberRegex.test(userInput)) {
      console.log(`[Validation FAIL] Invalid format (not a positive integer): ${userInput}`);
      return res.status(200).json(createValidationResponse('FAIL', VALIDATION.CLASS_YEAR_INVALID_FORMAT[0]));
    }

    const classYear = parseInt(userInput, 10);

    const setting = await PrecourseSetting.findOne({ classYear: classYear });

    if (setting) {
      console.log(`[Validation SUCCESS] classYear: ${classYear} found.`);
      return res.status(200).json(createValidationResponse('SUCCESS'));
    } else {
      console.log(`[Validation FAIL] classYear: ${classYear} not found in DB.`);
      return res.status(200).json(createValidationResponse('FAIL', VALIDATION.CLASS_YEAR_NOT_FOUND[0]));
    }
  } catch (error) {
    console.error('Error in /validation/class-year endpoint:', error.message);
    return res.status(500).json(createValidationResponse('FAIL', VALIDATION.CLASS_YEAR_SERVER_ERROR[0]));
  }
});

/**
 * /api/validation/nickname
 * '닉네임' 파라미터를 검증합니다.
 */
router.post('/nickname', async (req, res) => {
  try {
    const userInput = req.body.utterance;

    const nicknameToValidate = userInput.toUpperCase();

    if (nicknameToValidate.length < 1 || nicknameToValidate.length > 12) {
      console.log(`[Validation FAIL] Nickname length out of range: ${userInput}`);
      return res.status(200).json(createValidationResponse('FAIL', VALIDATION.NICKNAME_LENGTH[0]));
    }

    const validCharsRegex = /^[a-zA-Z0-9가-힣]*$/;
    if (!validCharsRegex.test(nicknameToValidate)) {
      console.log(`[Validation FAIL] Invalid characters in nickname: ${userInput}`);
      return res.status(200).json(createValidationResponse('FAIL', VALIDATION.NICKNAME_INVALID_CHARS[0]));
    }

    const startsWithNumberRegex = /^[0-9]/;
    if (startsWithNumberRegex.test(nicknameToValidate)) {
      console.log(`[Validation FAIL] Nickname starts with a number: ${userInput}`);
      return res.status(200).json(createValidationResponse('FAIL', VALIDATION.NICKNAME_STARTS_WITH_NUMBER[0]));
    }

    const existingParticipant = await Participant.findOne({
      nickname: nicknameToValidate,
    });

    if (existingParticipant) {
      console.log(`[Validation FAIL] Duplicate nickname: ${userInput}`);
      return res.status(200).json(createValidationResponse('FAIL', VALIDATION.NICKNAME_DUPLICATE(userInput)[0]));
    }

    console.log(`[Validation SUCCESS] Nickname: ${userInput}`);
    return res.status(200).json(createValidationResponse('SUCCESS'));
  } catch (error) {
    console.error('Error in /validation/nickname endpoint:', error.message);
    return res.status(500).json(createValidationResponse('FAIL', VALIDATION.NICKNAME_SERVER_ERROR[0]));
  }
});

/**
 * /api/validation/yes-no
 * '히든 질문 입력값'을 검증합니다.
 */
router.post('/yes-no', async (req, res) => {
  try {
    const userInput = req.body.utterance.toUpperCase();

    if (userInput === 'Y' || userInput === 'N') {
      console.log(`[Validation SUCCESS] Y/N input: ${userInput}`);
      return res.status(200).json(createValidationResponse('SUCCESS'));
    } else {
      console.log(`[Validation FAIL] Invalid Y/N input: ${userInput}`);
      return res.status(200).json(createValidationResponse('FAIL', VALIDATION.YES_NO_INVALID[0]));
    }
  } catch (error) {
    console.error('Error in /validation/yes-no endpoint:', error.message);
    return res.status(500).json(createValidationResponse('FAIL', VALIDATION.YES_NO_SERVER_ERROR[0]));
  }
});

module.exports = router;
