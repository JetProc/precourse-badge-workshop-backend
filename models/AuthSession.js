const { DEFAULT_AUTH_POLLING_TIME } = require('../constants/config');

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AuthSessionSchema = new Schema(
  {
    chatbotUserId: { type: String, required: true, unique: true, index: true },
    device_code: { type: String, required: true },
    status: { type: String, required: true, enum: ['pending', 'verified', 'expired', 'error'], default: 'pending' },
    githubId: { type: String },
    interval: { type: Number, default: DEFAULT_AUTH_POLLING_TIME },
    expiresAt: { type: Date, expires: 900 },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('AuthSession', AuthSessionSchema);
