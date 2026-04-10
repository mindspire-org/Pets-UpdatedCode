import mongoose from 'mongoose';

const allocationLineSchema = new mongoose.Schema({
  accountCode: { type: String, trim: true },
  amount: { type: Number, min: 0 }
}, { _id: false });

const adjustmentSchema = new mongoose.Schema({
  type: { type: String, enum: ['salary_deduction', 'bill_settlement', 'expense_allocation', 'return_cash'], required: true },
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, default: Date.now },
  note: { type: String },
  payableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payable' },
  lines: { type: [allocationLineSchema], default: [] },
  paymentMethod: { type: String },
}, { _id: false });

const staffAdvanceSchema = new mongoose.Schema({
  portal: { type: String, enum: ['admin','reception','doctor','pharmacy','lab','shop'], required: true, index: true },
  staffId: { type: String },
  staffName: { type: String },
  date: { type: Date, default: Date.now },
  amount: { type: Number, required: true },
  balance: { type: Number, required: true },
  status: { type: String, enum: ['open','closed'], default: 'open', index: true },
  adjustments: { type: [adjustmentSchema], default: [] },
  notes: { type: String },
}, { timestamps: true });

staffAdvanceSchema.index({ portal: 1, staffId: 1, status: 1 });

const StaffAdvance = mongoose.model('StaffAdvance', staffAdvanceSchema);
export default StaffAdvance;
