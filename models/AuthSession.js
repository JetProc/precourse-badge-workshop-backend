const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AuthSessionSchema = new Schema(
  {
    chatbotUserId: { type: String, required: true, unique: true, index: true },
    device_code: { type: String, required: true },
    status: { type: String, required: true, enum: ['pending', 'verified', 'expired', 'error'], default: 'pending' },
    githubId: { type: String },
    interval: { type: Number, default: 5 },
    expiresAt: { type: Date, expires: 900 },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('AuthSession', AuthSessionSchema);
