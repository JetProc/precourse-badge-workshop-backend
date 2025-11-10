const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// 히든 질문으로 얻는 값을 가진 스키마
const InputsSchema = new Schema(
  {
    hiddenAnswers: {
      review_thanked: { type: Boolean, default: false },
      review_study: { type: Boolean, default: false },
      tdd_attempt: { type: Boolean, default: false },
      readme_master: { type: Boolean, default: false },
      blog_share: { type: Boolean, default: false },
      community_writer: { type: Boolean, default: false },
      community_answerer: { type: Boolean, default: false },
    },
  },
  { _id: false }
);

// 깃헙 기반 이벤트로 얻는 값을 가진 스키마
const StatsSchema = new Schema(
  {
    commitCount: { type: Number, default: 0 },
    commitStreakMax: { type: Number, default: 0 },
    commitWeekendCount: { type: Number, default: 0 },
    commitRefactorCount: { type: Number, default: 0 },
    commitFixCount: { type: Number, default: 0 },
    commitMonsterMax: { type: Number, default: 0 },
    commitFirstDay: { type: Boolean, default: false },
    commitLastDay: { type: Boolean, default: false },
    reviewCount: { type: Number, default: 0 },
    reviewFastCount: { type: Number, default: 0 },
    reviewSelfCount: { type: Number, default: 0 },
    reviewEmojiCount: { type: Number, default: 0 },
    deadlineFighter: { type: Boolean, default: false },
    earlybird: { type: Boolean, default: false },
    nightowl: { type: Boolean, default: false },
    prOpened: { type: Boolean, default: false },
  },
  { _id: false }
);

// 스탯을 종합하여 가공한 결과를 가진 스키마
const ResultsSchema = new Schema(
  {
    grade: { type: String, default: 'bronze' },
    score: { type: Number, default: 0 },
    achievements: { type: [String], default: [] },
    titles: { type: [String], default: [] },
  },
  { _id: false }
);

// 사용자가 수정/확인할 수 있는 정보를 가진 스키마
const CustomizationSchema = new Schema(
  {
    equippedTitle: { type: String, default: '[프리코스 완주자]' },
    reflection: { type: String, default: '' },
  },
  { _id: false }
);

// 사용자 정보가 담긴 종합 스키마
const ParticipantSchema = new Schema(
  {
    githubId: { type: String, required: true, unique: true, index: true },
    classYear: { type: Number, required: true },
    nickname: { type: String, required: true },

    inputs: { type: InputsSchema, required: true },
    stats: { type: StatsSchema, required: true },
    results: { type: ResultsSchema, required: true },
    customization: { type: CustomizationSchema, required: true },

    analysisStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'error'],
      default: 'pending',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Participant', ParticipantSchema);
