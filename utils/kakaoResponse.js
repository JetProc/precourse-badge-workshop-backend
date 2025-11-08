const createKakaoResponse = (texts, data = {}, buttons = []) => {
  // 텍스트 말풍선 생성
  const outputs = texts.map((text) => ({
    simpleText: { text: text },
  }));

  // 버튼 생성
  const quickReplies = buttons.map((btn) => ({
    label: btn.label,
    action: 'block', // '블록'으로 이동
    blockId: btn.blockId,
    messageText: btn.label, // 사용자가 버튼을 눌렀을 때 채팅창에 표시될 텍스트
  }));

  // 최종 포맷으로 반환
  const response = {
    version: '2.0',
    template: {
      outputs: outputs,
      ...(quickReplies.length > 0 && { quickReplies: quickReplies }),
    },
    data: data,
  };

  return response;
};

module.exports = { createKakaoResponse };
