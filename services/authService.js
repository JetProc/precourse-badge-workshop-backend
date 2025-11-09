const AuthSession = require('../models/AuthSession');

const getAuthSessionInfo = async (chatbotUserId) => {
  const authSession = await AuthSession.findOne({ chatbotUserId: chatbotUserId });
  return authSession;
};

const getVerifiedGithubId = async (chatbotUserId) => {
  const authSession = await getAuthSessionInfo(chatbotUserId);
  if (authSession && authSession.status === 'verified' && authSession.githubId) {
    return authSession.githubId;
  }
  return null;
};

module.exports = {
  getAuthSessionInfo,
  getVerifiedGithubId,
};
