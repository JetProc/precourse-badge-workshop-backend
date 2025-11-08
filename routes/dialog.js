// routes/dialog.js

const express = require('express');
const router = express.Router();
require('dotenv').config();

const { createKakaoResponse } = require('../utils/kakaoResponse');
const PrecourseSetting = require('../models/PrecourseSetting');

// 대화의 각 단계를 정의
const DIALOG_STEPS = [
  'validate_classYear', // 1. 기수 입력 및 검증
  'validate_nickname', // 2. 닉네임 입력 및 검증
  'ask_hidden_tdd_attempt', // 3. TDD (Y/N)
  'ask_hidden_readme_master', // 4. README (Y/N)
  // ... (모든 히든 질문 8~10개) ...
  'ask_reflection', // 11. 회고 입력
  'submit_order', // 12. 최종 제출
];

// 이 함수가 모든 멀티턴 대화를 처리합니다.
router.post('/', async (req, res) => {
  try {
    const utterance = req.body.utterance || ''; // 사용자 발화
    const context = req.body.context; // 현재 컨텍스트

    let currentPhase = 'validate_classYear'; // 기본값 (1단계)
    let accumulatedParams = {}; // 이전 단계에서 수집된 파라미터 (기수, 닉네임 등)

    if (context && context.values && context.values[0]) {
      currentPhase = context.values[0].params.phase;
      accumulatedParams = context.values[0].params.data || {};
    }

    let responseText = '';
    let nextPhase = '';
    let nextParams = accumulatedParams;

    // --- '현재 단계(phase)'에 따라 분기 ---
    switch (currentPhase) {
      // 1. 기수 입력 및 검증
      case 'validate_classYear':
        if (utterance === '') {
          // [블록] 재료 수집 (시작)에서 최초 호출 시
          responseText = '참여한 프리코스 기수를 숫자로 알려주세요. (예: 8)';
          nextPhase = 'validate_classYear'; // 다음에도 이 단계 유지 (입력 받아야 하므로)
        } else {
          const classYear = parseInt(utterance, 10);
          const setting = await PrecourseSetting.findOne({ classYear: classYear });

          if (setting) {
            // (검증 성공)
            responseText = '훈장에 새길 닉네임을 알려주세요. (10자 이내)';
            nextPhase = 'validate_nickname';
            nextParams.classYear = classYear; // 파라미터 누적
          } else {
            // (검증 실패)
            responseText = `[ ❌ 존재하지 않는 기수입니다. 다시 입력해주세요. ]`;
            nextPhase = 'validate_classYear'; // 이 단계 유지
          }
        }
        break;

      // 2. 닉네임 입력 및 검증
      case 'validate_nickname':
        if (utterance.length > 0 && utterance.length <= 10) {
          // (검증 성공)
          responseText =
            "이제부터 '히든 업적' 질문을 시작합니다. (Y/N)으로 답해주세요.\n\n(1/8) TDD를 1회 이상 시도했나요?";
          nextPhase = 'ask_hidden_tdd_attempt';
          nextParams.nickname = utterance; // 파라미터 누적
        } else {
          // (검증 실패)
          responseText = '[ ❌ 닉네임은 1~10자 사이로 입력해주세요. ]';
          nextPhase = 'validate_nickname'; // 이 단계 유지
        }
        break;

      // 3. TDD 질문
      case 'ask_hidden_tdd_attempt':
        // (이전 단계의 응답(Y/N)을 저장)
        nextParams.hidden_tdd_attempt = utterance.toLowerCase() === 'y' || utterance === '예';
        // (다음 질문)
        responseText = '(2/8) README.md를 1000자 이상 상세하게 작성했나요?';
        nextPhase = 'ask_hidden_readme_master';
        break;

      // 4. README 질문
      case 'ask_hidden_readme_master':
        nextParams.hidden_readme_master = utterance.toLowerCase() === 'y' || utterance === '예';
        responseText = '(3/8) ...다음 히든 질문...';
        nextPhase = 'ask_hidden_..._';
        break;

      // ... (모든 히든 질문 반복) ...

      // 11. 회고 질문
      case 'ask_reflection':
        nextParams.submit_order = utterance.toLowerCase() === 'y' || utterance === '예'; // 마지막 히든 질문 저장
        responseText = "마지막 질문입니다. '제작 후기(회고)'를 한마디 적어주세요.";
        nextPhase = 'submit_order';
        break;

      // 12. 최종 제출
      case 'submit_order':
        nextParams.reflection = utterance; // 회고 저장

        // 여기서 챗봇 빌더의 'submitOrder' 스킬을 호출하는 대신,
        // 백엔드 내부에서 order 로직을 바로 실행하거나,
        // 이 데이터를 담아 'submitOrder' 스킬을 호출하는 블록으로 이동시킵니다.

        // (추천) '주문 블록'으로 이동시키기
        responseText = '모든 재료가 수집되었습니다! GitHub 활동 분석을 시작합니다...';
        nextPhase = 'DONE'; // 컨텍스트 종료

        // 'order' 스킬을 호출하는 [블록] 주문 및 분석 시작 블록으로 이동시킵니다.
        // 이 블록은 context가 아닌, 수집된 파라미터(nextParams)를 POST /order로 전송해야 합니다.

        // (주의!) 이 방법은 복잡합니다.
        // 가장 간단한 방법은 이 /dialog API가 /order API의 역할까지 모두 수행하는 것입니다.

        // (대안: /dialog가 /order 역할까지 수행)
        // const finalResults = await analyzeAndSave(nextParams, req.body.userRequest.user.id);
        // responseText = "제작 완료!";
        // nextPhase = "DONE"; // 컨텍스트 종료
        break;
    }

    // --- 응답 생성 ---
    const responsePayload = createKakaoResponse([responseText]);

    if (nextPhase !== 'DONE') {
      // (✨핵심✨) 다음 단계의 context를 챗봇에게 반환
      responsePayload.context = {
        values: [
          {
            name: 'multiTurnContext', // 컨텍스트 이름
            lifeSpan: 5, // 5분 동안 유효
            params: {
              phase: nextPhase, // 다음 단계
              data: nextParams, // 지금까지 누적된 데이터
            },
          },
        ],
      };
    }

    res.status(200).json(responsePayload);
  } catch (error) {
    console.error('Error in /dialog endpoint:', error.message);
    res.status(500).json(createKakaoResponse(['오류: 대화 처리 중 문제가 발생했습니다.']));
  }
});

module.exports = router;
