import express from 'express';
import Expense from '../models/Expense.js';
import { postFinancialRecord } from '../utils/accountingService.js';
import dayGuard from '../middleware/dayGuard.js';
import DailyLog from '../models/DailyLog.js';

const router = express.Router();

// GET /api/expenses - list all expenses (latest first)
router.get('/', async (req, res) => {
  try {
    const expenses = await Expense.find().sort({ date: -1 });
    res.json({ success: true, data: expenses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/expenses/portal/:portal - expenses for a specific portal
router.get('/portal/:portal', async (req, res) => {
  try {
    const expenses = await Expense.find({ portal: req.params.portal }).sort({ date: -1 });
    res.json({ success: true, data: expenses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/expenses/date-range?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
router.get('/date-range', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    // include full end day
    end.setHours(23, 59, 59, 999);

    const expenses = await Expense.find({
      date: { $gte: start, $lte: end },
    }).sort({ date: -1 });

    res.json({ success: true, data: expenses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/expenses/stats - basic stats (totals and by portal)
router.get('/stats', async (req, res) => {
  try {
    const expenses = await Expense.find();
    const totalAmount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    const byPortal = expenses.reduce((acc, e) => {
      const key = e.portal || 'admin';
      acc[key] = (acc[key] || 0) + (e.amount || 0);
      return acc;
    }, {});

    res.json({ success: true, data: { totalAmount, byPortal, count: expenses.length } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/expenses/:id - get by business id
router.get('/:id', async (req, res) => {
  try {
    const expense = await Expense.findOne({ id: req.params.id });
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }
    res.json({ success: true, data: expense });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/expenses - create new expense
router.post('/', dayGuard(req => req.body.portal || 'admin'), async (req, res) => {
  try {
    const payload = { ...req.body };
    if (!payload.id) {
      payload.id = `exp_${Date.now()}`;
    }

    const expense = new Expense(payload);
    await expense.save();

    // Fire-and-forget accounting posting; errors should not block
    try {
      await postFinancialRecord({
        id: expense.id,
        type: 'Expense',
        category: expense.category,
        amount: expense.amount,
        date: expense.date,
        paymentMethod: expense.paymentMethod,
        ownerName: undefined,
        petId: undefined,
        petName: undefined,
        portal: expense.portal || 'admin',
      });
    } catch (e) {
      console.error('Accounting posting failed for Expense', e?.message || e);
    }

    try {
      await DailyLog.create({
        date: new Date().toISOString().slice(0,10),
        portal: expense.portal || 'admin',
        sessionId: req.daySession?._id,
        action: 'expense_create',
        refType: 'expense',
        refId: expense.id,
        description: expense.category,
        amount: expense.amount,
      });
    } catch {}

    res.status(201).json({ success: true, data: expense });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// PUT /api/expenses/:id - update by business id
router.put('/:id', dayGuard(req => req.body.portal || 'admin'), async (req, res) => {
  try {
    const expense = await Expense.findOneAndUpdate(
      { id: req.params.id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    res.json({ success: true, data: expense });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// DELETE /api/expenses/:id - delete by business id
router.delete('/:id', dayGuard(req => req.query.portal || 'admin'), async (req, res) => {
  try {
    const expense = await Expense.findOneAndDelete({ id: req.params.id });
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }
    res.json({ success: true, message: 'Expense deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
