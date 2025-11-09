const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// 각 주차 별 정보를 가진 스키마
const WeekScheduleSchema = new Schema(
  {
    week: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
  },
  { _id: false }
);

// 프리코스 기수 관련 정보를 가진 스키마
const PrecourseSettingSchema = new Schema(
  {
    classYear: { type: Number, required: true, unique: true, index: true },

    weeks: [WeekScheduleSchema],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('PrecourseSetting', PrecourseSettingSchema);
