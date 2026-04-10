import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  parentCode: {
    type: String,
    trim: true,
  },
  isGroup: {
    type: Boolean,
    default: false,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  type: {
    type: String,
    enum: ['asset', 'liability', 'equity', 'income', 'expense'],
    required: true,
  },
  subType: {
    type: String,
    trim: true,
  },
  openingDebit: {
    type: Number,
    default: 0,
  },
  openingCredit: {
    type: Number,
    default: 0,
  },
  portal: {
    type: String,
    enum: ['admin', 'reception', 'doctor', 'pharmacy', 'lab', 'shop', 'global'],
    default: 'global',
  },
  active: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

accountSchema.index({ code: 1 }, { unique: true });
accountSchema.index({ parentCode: 1 });
accountSchema.index({ type: 1 });
accountSchema.index({ portal: 1 });

const Account = mongoose.model('Account', accountSchema);

export default Account;
