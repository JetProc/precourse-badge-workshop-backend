const createKakaoResponse = (texts, data = {}, buttons = []) => {
  const hasWebLinkButton = buttons.some((btn) => btn.action === 'webLink');

  let outputs;
  let quickReplies = [];
  if (hasWebLinkButton) {
    const title = texts[0] || ' ';
    const description = texts.slice(1).join('\n\n');

    const cardButtons = buttons.map((btn) => {
      if (btn.action === 'webLink') {
        return {
          action: 'webLink',
          label: btn.label,
          webLinkUrl: btn.webLinkUrl,
        };
      }

      return {
        action: 'block',
        label: btn.label,
        blockId: btn.blockId,
        messageText: btn.messageText || btn.label,
      };
    });

    outputs = [
      {
        textCard: {
          title: title,
          ...(description && { description: description }),
          buttons: cardButtons,
        },
      },
    ];
  } else {
    outputs = texts.map((text) => ({
      simpleText: { text: text },
    }));

    quickReplies = buttons.map((btn) => ({
      label: btn.label,
      action: 'block',
      blockId: btn.blockId,
      messageText: btn.messageText || btn.label,
    }));
  }

  const response = {
    version: '2.0',
    template: {
      outputs: outputs, // simpleText 또는 textCard
      ...(quickReplies.length > 0 && { quickReplies: quickReplies }),
    },
    data: data,
  };

  return response;
};

module.exports = { createKakaoResponse };
