import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  portal: {
    type: String,
    enum: ['reception', 'doctor', 'pharmacy', 'lab', 'shop', 'admin'],
    default: 'admin'
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  paymentMethod: {
    type: String,
    default: 'Cash'
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

expenseSchema.index({ id: 1 });
expenseSchema.index({ portal: 1 });
expenseSchema.index({ date: -1 });

const Expense = mongoose.model('Expense', expenseSchema);

export default Expense;
