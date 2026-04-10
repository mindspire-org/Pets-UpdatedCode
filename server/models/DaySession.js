import mongoose from 'mongoose';

const adjustmentSchema = new mongoose.Schema({
  label: { type: String, trim: true },
  type: { type: String, enum: ['add', 'subtract'], default: 'add' },
  amount: { type: Number, default: 0, min: 0 },
}, { _id: false });

const talliesSchema = new mongoose.Schema({
  cashIn: { type: Number, default: 0 },
  cashOut: { type: Number, default: 0 },
  bankIn: { type: Number, default: 0 },
  bankOut: { type: Number, default: 0 },
  sales: { type: Number, default: 0 },
  income: { type: Number, default: 0 },
  expenses: { type: Number, default: 0 },
  purchases: { type: Number, default: 0 },
  vendorPayments: { type: Number, default: 0 },
  staffAdvances: { type: Number, default: 0 },
}, { _id: false });

const daySessionSchema = new mongoose.Schema({
  date: { type: String, required: true, index: true }, // YYYY-MM-DD
  portal: { type: String, required: true, enum: ['admin','reception','doctor','pharmacy','lab','shop'], index: true },
  status: { type: String, enum: ['open','closed'], default: 'open', index: true },

  openingAmount: { type: Number, required: true, min: 0 },
  openedBy: { type: String, required: true },
  openedAt: { type: Date, default: Date.now },
  openingNote: { type: String, trim: true },

  // Closing section
  closingAmount: { type: Number, default: 0 },
  cashCount: { type: Number, default: 0 },
  bankBalance: { type: Number, default: 0 },
  closeType: { type: String, enum: ['regular','early','late'], default: 'regular' },
  closedBy: { type: String },
  closedAt: { type: Date },
  closeNote: { type: String, trim: true },

  adjustments: { type: [adjustmentSchema], default: [] },
  tallies: { type: talliesSchema, default: () => ({}) },
  expectedClosingCash: { type: Number, default: 0 },
  expectedClosingBank: { type: Number, default: 0 },
  expectedTotal: { type: Number, default: 0 },

}, { timestamps: true });

// Only one OPEN session per portal at a time
// Partial index for status = 'open'
daySessionSchema.index(
  { portal: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'open' } }
);

daySessionSchema.index({ portal: 1, date: -1 });

daySessionSchema.methods.isOpen = function () { return this.status === 'open'; };

const DaySession = mongoose.model('DaySession', daySessionSchema);
export default DaySession;
