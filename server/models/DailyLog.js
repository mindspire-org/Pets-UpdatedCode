import mongoose from 'mongoose';

const dailyLogSchema = new mongoose.Schema({
  date: { type: String, required: true, index: true },
  portal: { type: String, required: true, enum: ['admin','reception','doctor','pharmacy','lab','shop'] },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'DaySession' },
  action: { type: String, required: true },
  refType: { type: String },
  refId: { type: String },
  description: { type: String },
  amount: { type: Number, default: 0 },
  by: { type: String },
}, { timestamps: true });

dailyLogSchema.index({ portal: 1, date: -1 });

typeof dailyLogSchema; // to avoid isolatedModules issues

const DailyLog = mongoose.model('DailyLog', dailyLogSchema);
export default DailyLog;
