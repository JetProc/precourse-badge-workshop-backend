const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const WeekScheduleSchema = new Schema(
  {
    week: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
  },
  { _id: false }
);

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
