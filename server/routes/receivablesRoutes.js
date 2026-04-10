import express from 'express';
import Receivable from '../models/Receivable.js';
import DailyLog from '../models/DailyLog.js';
import { postEntry } from '../utils/accountingService.js';
import dayGuard from '../middleware/dayGuard.js';

const router = express.Router();

// List receivables
router.get('/', async (req, res, next) => {
  try {
    const { portal, status, from, to } = req.query;
    const q = {};
    if (portal && portal !== 'all') q.portal = portal;
    if (status) q.status = status;
    if (from || to) {
      q.billDate = {};
      if (from) q.billDate.$gte = new Date(`${from}T00:00:00.000Z`);
      if (to) q.billDate.$lte = new Date(`${to}T23:59:59.999Z`);
    }
    const rows = await Receivable.find(q).sort({ billDate: -1 });
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

// Create receivable manually
router.post('/', dayGuard(req => req.body.portal || 'admin'), async (req, res, next) => {
  try {
    const payload = req.body || {};
    payload.balance = payload.totalAmount;
    const r = new Receivable(payload);
    await r.save();
    await DailyLog.create({ date: new Date().toISOString().slice(0,10), portal: r.portal, sessionId: req.daySession?._id, action: 'receivable_create', refType: 'receivable', refId: String(r._id), description: r.description, amount: r.totalAmount });
    res.status(201).json({ success: true, data: r });
  } catch (e) { next(e); }
});

// Apply customer payment against receivable(s)
router.post('/:id/allocate', dayGuard(req => req.body.portal || 'admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount, paymentMethod = 'Cash', note } = req.body || {};
    const r = await Receivable.findById(id);
    if (!r) return res.status(404).json({ success: false, message: 'Receivable not found' });

    const amt = Math.max(0, Number(amount) || 0);
    if (amt <= 0) return res.status(400).json({ success: false, message: 'amount must be > 0' });
    if (amt > r.balance) return res.status(400).json({ success: false, message: 'amount exceeds receivable balance' });

    r.balance -= amt;
    r.allocations.push({ paymentId: `manual_${Date.now()}`, amount: amt, date: new Date() });
    if (r.balance <= 0.0001) { r.balance = 0; r.status = 'closed'; }
    await r.save();

    // Journal: DR Cash/Bank, CR Accounts Receivable
    await postEntry({
      date: new Date(),
      portal: r.portal,
      sourceType: 'customer_payment',
      sourceId: String(r._id),
      description: note || `Customer payment against ${r.refType || 'invoice'} ${r.refId || ''}`,
      meta: { customerId: r.customerId, patientId: r.patientId, extra: { paymentMethod } },
      lines: [
        { accountCode: paymentMethod && paymentMethod.toLowerCase().includes('bank') ? '1002' : '1001', debit: amt, credit: 0 },
        { accountCode: '1100', debit: 0, credit: amt },
      ],
    });

    await DailyLog.create({ date: new Date().toISOString().slice(0,10), portal: r.portal, sessionId: req.daySession?._id, action: 'receivable_allocate', refType: 'receivable', refId: String(r._id), description: `Payment ${amt} applied`, amount: amt });

    res.json({ success: true, data: r });
  } catch (e) { next(e); }
});

export default router;
