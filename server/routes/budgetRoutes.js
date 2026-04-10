import express from 'express';
import BudgetPlan from '../models/BudgetPlan.js';

const router = express.Router();

const normalizeMonths = (months) => {
  const arr = Array.isArray(months) ? months : [];
  const out = new Array(12).fill(0);
  for (let i = 0; i < 12; i++) {
    out[i] = Math.max(0, Number(arr[i]) || 0);
  }
  return out;
};

const normalizeRows = (rows) => {
  const arr = Array.isArray(rows) ? rows : [];
  return arr.map(r => ({
    category: String(r?.category || '').trim(),
    description: String(r?.description || '').trim(),
    months: normalizeMonths(r?.months),
  }));
};

// Get a budget plan by key
router.get('/', async (req, res, next) => {
  try {
    const { fiscalYear, branch = 'all', project = 'all' } = req.query;
    if (!fiscalYear) return res.status(400).json({ success: false, message: 'fiscalYear is required' });

    const plan = await BudgetPlan.findOne({
      fiscalYear: String(fiscalYear).trim(),
      branch: String(branch).trim() || 'all',
      project: String(project).trim() || 'all',
    }).lean();

    res.json({ success: true, data: plan || null });
  } catch (e) { next(e); }
});

// Upsert a budget plan
router.post('/', async (req, res, next) => {
  try {
    const payload = req.body || {};
    const fiscalYear = String(payload.fiscalYear || '').trim();
    if (!fiscalYear) return res.status(400).json({ success: false, message: 'fiscalYear is required' });

    const branch = String(payload.branch || 'all').trim() || 'all';
    const project = String(payload.project || 'all').trim() || 'all';
    const status = ['Draft', 'Final'].includes(payload.status) ? payload.status : 'Draft';

    const update = {
      fiscalYear,
      branch,
      project,
      status,
      incomeRows: normalizeRows(payload.incomeRows),
      expenseRows: normalizeRows(payload.expenseRows),
    };

    const doc = await BudgetPlan.findOneAndUpdate(
      { fiscalYear, branch, project },
      { $set: update },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, data: doc });
  } catch (e) {
    if (e?.code === 11000) {
      e.status = 409;
      e.message = 'Budget plan already exists for this Fiscal Year / Branch / Project';
    }
    next(e);
  }
});

export default router;
