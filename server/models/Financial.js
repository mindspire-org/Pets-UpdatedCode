import mongoose from 'mongoose';

const financialSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    required: true,
    enum: ['Income', 'Expense']
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'Card', 'Bank Transfer', 'Check', 'Other']
  },
  reference: {
    type: String
  },
  petId: {
    type: String
  },
  petName: {
    type: String
  },
  ownerName: {
    type: String
  },
  status: {
    type: String,
    default: 'Completed',
    enum: ['Pending', 'Completed', 'Cancelled', 'Refunded']
  },
  createdBy: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for faster queries
financialSchema.index({ id: 1 });
financialSchema.index({ type: 1 });
financialSchema.index({ category: 1 });
financialSchema.index({ date: -1 });
financialSchema.index({ status: 1 });

const Financial = mongoose.model('Financial', financialSchema);

export default Financial;
