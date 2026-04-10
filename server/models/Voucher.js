import mongoose from 'mongoose';

const voucherLineSchema = new mongoose.Schema({
  accountCode: {
    type: String,
    required: true,
    trim: true,
  },
  debit: {
    type: Number,
    default: 0,
  },
  credit: {
    type: Number,
    default: 0,
  },
}, { _id: false });

const voucherSchema = new mongoose.Schema({
  voucherNo: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  type: {
    type: String,
    enum: ['JV', 'PV', 'RV', 'CV'],
    required: true,
  },
  status: {
    type: String,
    enum: ['draft', 'posted', 'cancelled'],
    default: 'draft',
  },
  date: {
    type: Date,
    default: Date.now,
  },
  portal: {
    type: String,
    enum: ['admin', 'reception', 'doctor', 'pharmacy', 'lab', 'shop', 'system'],
    default: 'admin',
  },
  receiptNo: {
    type: String,
    trim: true,
  },
  paymentMethod: {
    type: String,
    trim: true,
  },
  expenseCategory: {
    type: String,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  partyType: {
    type: String,
    enum: ['supplier', 'customer', 'patient', 'none'],
    default: 'none',
  },
  partyId: {
    type: String,
    trim: true,
  },
  partyName: {
    type: String,
    trim: true,
  },
  journalEntryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JournalEntry',
  },
  lines: {
    type: [voucherLineSchema],
    validate: {
      validator: function (v) {
        if (!v || v.length === 0) return false;
        const totalDebit = v.reduce((s, l) => s + (l.debit || 0), 0);
        const totalCredit = v.reduce((s, l) => s + (l.credit || 0), 0);
        return Math.abs(totalDebit - totalCredit) < 0.01;
      },
      message: 'Voucher lines must balance (debits = credits)',
    },
  },
}, {
  timestamps: true,
});

voucherSchema.index({ voucherNo: 1 }, { unique: true });
voucherSchema.index({ type: 1, date: -1 });
voucherSchema.index({ portal: 1, date: -1 });
voucherSchema.index({ status: 1, date: -1 });

const Voucher = mongoose.model('Voucher', voucherSchema);

export default Voucher;
