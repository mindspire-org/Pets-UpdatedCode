import mongoose from 'mongoose';

const budgetRowSchema = new mongoose.Schema({
  category: { type: String, trim: true, default: '' },
  description: { type: String, trim: true, default: '' },
  months: { type: [Number], default: [] },
}, { _id: false });

const budgetPlanSchema = new mongoose.Schema({
  fiscalYear: { type: String, required: true, trim: true },
  branch: { type: String, trim: true, default: 'all' },
  project: { type: String, trim: true, default: 'all' },
  status: { type: String, enum: ['Draft', 'Final'], default: 'Draft' },
  incomeRows: { type: [budgetRowSchema], default: [] },
  expenseRows: { type: [budgetRowSchema], default: [] },
}, { timestamps: true });

budgetPlanSchema.index({ fiscalYear: 1, branch: 1, project: 1 }, { unique: true });

const BudgetPlan = mongoose.model('BudgetPlan', budgetPlanSchema);

export default BudgetPlan;
