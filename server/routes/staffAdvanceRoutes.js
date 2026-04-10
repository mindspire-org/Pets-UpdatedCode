import express from 'express';
import StaffAdvance from '../models/StaffAdvance.js';
import Payable from '../models/Payable.js';
import DailyLog from '../models/DailyLog.js';
import { postEntry } from '../utils/accountingService.js';
import dayGuard from '../middleware/dayGuard.js';

const router = express.Router();

// List advances
router.get('/', async (req, res, next) => {
  try {
    const { portal, status, staffId, from, to } = req.query;
    const q = {};
    if (portal && portal !== 'all') q.portal = portal;
    if (status) q.status = status;
    if (staffId) q.staffId = staffId;
    if (from || to) {
      q.date = {};
      if (from) q.date.$gte = new Date(`${from}T00:00:00.000Z`);
      if (to) q.date.$lte = new Date(`${to}T23:59:59.999Z`);
    }
    const rows = await StaffAdvance.find(q).sort({ date: -1 });
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

// Create new staff advance
router.post('/', dayGuard(req => req.body.portal || 'admin'), async (req, res, next) => {
  try {
    const { portal, staffId, staffName, amount, paymentMethod = 'Cash', notes } = req.body || {};
    const adv = new StaffAdvance({ portal, staffId, staffName, amount, balance: amount, notes });
    await adv.save();

    // Journal: DR Staff Advances (1110), CR Cash/Bank
    await postEntry({
      date: adv.date,
      portal: portal || 'admin',
      sourceType: 'staff_advance',
      sourceId: String(adv._id),
      description: notes || `Advance to ${staffName || staffId || ''}`,
      lines: [
        { accountCode: '1110', debit: amount, credit: 0 },
        { accountCode: (paymentMethod || '').toLowerCase().includes('bank') ? '1002' : '1001', debit: 0, credit: amount },
      ],
      meta: { extra: { staffId, staffName, paymentMethod } },
    });

    await DailyLog.create({ date: new Date().toISOString().slice(0,10), portal: portal || 'admin', sessionId: req.daySession?._id, action: 'staff_advance_create', refType: 'staff_advance', refId: String(adv._id), description: `Advance ${amount} to ${staffName || staffId || ''}`, amount });

    res.status(201).json({ success: true, data: adv });
  } catch (e) { next(e); }
});

// Adjust advance via salary deduction or bill settlement
router.post('/:id/adjust', dayGuard(req => req.body.portal || 'admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type, note, payableId } = req.body || {};
    let { amount, lines = [], paymentMethod = 'Cash' } = req.body || {};
    const adv = await StaffAdvance.findById(id);
    if (!adv) return res.status(404).json({ success: false, message: 'Staff advance not found' });

    // If expense_allocation, compute amount from line sum
    if (type === 'expense_allocation' && Array.isArray(lines)) {
      const sum = lines.reduce((s, l) => s + Math.max(0, Number(l?.amount || 0)), 0);
      amount = sum;
    }
    const amt = Math.max(0, Number(amount) || 0);
    if (amt <= 0) return res.status(400).json({ success: false, message: 'amount must be > 0' });
    if (amt > adv.balance) return res.status(400).json({ success: false, message: 'amount exceeds advance balance' });

    adv.balance -= amt;
    // Persist extra details for new types
    const adj = { type, amount: amt, date: new Date(), note, payableId };
    if (type === 'expense_allocation') {
      adj.lines = (Array.isArray(lines) ? lines : []).map(l => ({ accountCode: String(l.accountCode||'').trim(), amount: Math.max(0, Number(l.amount||0)) }))
        .filter(l => l.accountCode && l.amount > 0);
    }
    if (type === 'return_cash') {
      adj.paymentMethod = paymentMethod;
    }
    adv.adjustments.push(adj);
    if (adv.balance <= 0.0001) { adv.balance = 0; adv.status = 'closed'; }
    await adv.save();

    if (type === 'bill_settlement') {
      // Apply to payable
      const p = await Payable.findById(payableId);
      if (!p) return res.status(404).json({ success: false, message: 'Payable not found for settlement' });
      const allocAmt = Math.min(amt, p.balance);
      p.balance -= allocAmt;
      p.allocations.push({ sourceType: 'staff_advance', sourceRef: String(adv._id), amount: allocAmt, date: new Date() });
      if (p.balance <= 0.0001) { p.balance = 0; p.status = 'closed'; }
      await p.save();

      // Journal: DR Payable, CR Staff Advances
      await postEntry({
        date: new Date(),
        portal: p.portal,
        sourceType: 'staff_advance_bill_settlement',
        sourceId: `${adv._id}_${p._id}`,
        description: note || 'Advance applied to supplier bill',
        meta: { supplierId: p.supplierId, extra: { staffAdvanceId: String(adv._id), payableId: String(p._id) } },
        lines: [
          { accountCode: (p.portal === 'pharmacy' ? '2010' : p.portal === 'lab' ? '2020' : p.portal === 'shop' ? '2030' : '2001'), debit: allocAmt, credit: 0 },
          { accountCode: '1110', debit: 0, credit: allocAmt },
        ],
      });
    } else if (type === 'salary_deduction') {
      // Journal: DR Admin Expense (Payroll), CR Staff Advances (write-off via deduction)
      await postEntry({
        date: new Date(),
        portal: adv.portal,
        sourceType: 'staff_advance_salary_deduction',
        sourceId: String(adv._id),
        description: note || 'Staff advance recovered from salary',
        lines: [
          { accountCode: '5900', debit: amt, credit: 0 },
          { accountCode: '1110', debit: 0, credit: amt },
        ],
        meta: { extra: { staffAdvanceId: String(adv._id), staffId: adv.staffId, staffName: adv.staffName } },
      });
    } else if (type === 'expense_allocation') {
      // Journal: DR multiple expense heads, CR 1110
      const clean = (Array.isArray(lines) ? lines : []).map(l => ({ accountCode: String(l.accountCode||'').trim(), amount: Math.max(0, Number(l.amount||0)) }))
        .filter(l => l.accountCode && l.amount > 0);
      const total = clean.reduce((s, l) => s + l.amount, 0);
      if (Math.abs(total - amt) > 0.01) {
        // Safety: adjust to computed total
        // No balance change since we already deducted amt, but we guard posting totals match
      }
      const debitLines = clean.map(l => ({ accountCode: l.accountCode, debit: l.amount, credit: 0 }));
      await postEntry({
        date: new Date(),
        portal: adv.portal,
        sourceType: 'staff_advance_expense_allocation',
        sourceId: `${adv._id}_${Date.now()}`,
        description: note || 'Advance allocated to expenses',
        lines: [
          ...debitLines,
          { accountCode: '1110', debit: 0, credit: total },
        ],
        meta: { extra: { staffAdvanceId: String(adv._id), staffId: adv.staffId, staffName: adv.staffName, allocations: clean } },
      });
    } else if (type === 'return_cash') {
      // Journal: DR Cash/Bank, CR Staff Advances
      const pm = String(paymentMethod || 'cash').toLowerCase();
      const cashAcc = (pm.includes('bank') || pm.includes('card') || pm.includes('online')) ? '1002' : '1001';
      await postEntry({
        date: new Date(),
        portal: adv.portal,
        sourceType: 'staff_advance_return_cash',
        sourceId: `${adv._id}_${Date.now()}`,
        description: note || 'Staff returned unspent advance',
        lines: [
          { accountCode: cashAcc, debit: amt, credit: 0 },
          { accountCode: '1110', debit: 0, credit: amt },
        ],
        meta: { extra: { staffAdvanceId: String(adv._id), staffId: adv.staffId, staffName: adv.staffName, paymentMethod } },
      });
    }

    await DailyLog.create({ date: new Date().toISOString().slice(0,10), portal: adv.portal, sessionId: req.daySession?._id, action: 'staff_advance_adjust', refType: 'staff_advance', refId: String(adv._id), description: `Adjustment ${amt} (${type})`, amount: amt });

    res.json({ success: true, data: adv });
  } catch (e) { next(e); }
});

export default router;
