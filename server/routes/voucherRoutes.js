import express from 'express';
import Voucher from '../models/Voucher.js';
import Sequence from '../models/Sequence.js';
import Account from '../models/Account.js';
import JournalEntry from '../models/JournalEntry.js';
import DaySession from '../models/DaySession.js';
import { postEntry } from '../utils/accountingService.js';

const router = express.Router();

const fmtSeq = (n) => String(n).padStart(6, '0');

const getYearKey = (d) => {
  const dt = d instanceof Date ? d : new Date(d || Date.now());
  return String(dt.getFullYear());
};

const nextVoucherNo = async ({ type, date, fy }) => {
  const y = fy ? String(fy).trim() : getYearKey(date);
  const key = `voucher:${type}:${y}`;
  const seqDoc = await Sequence.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `${type}-${y}-${fmtSeq(seqDoc.seq || 0)}`;
};

const sumTotals = (lines = []) => {
  const debit = (lines || []).reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const credit = (lines || []).reduce((s, l) => s + (Number(l.credit) || 0), 0);
  return { debit, credit };
};

const ensureDayOpen = async (portal) => {
  const p = String(portal || '').trim();
  if (!p) throw new Error('portal is required');
  const today = new Date().toISOString().slice(0, 10);
  const session = await DaySession.findOne({ portal: p, date: today, status: 'open' }).lean();
  if (!session) {
    const err = new Error(`Day is not open for portal ${p}. Please open the day before performing this action.`);
    err.status = 423;
    throw err;
  }
  return session;
};

const validateLines = async (lines) => {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error('lines are required');
  }
  const { debit, credit } = sumTotals(lines);
  if (Math.abs(debit - credit) >= 0.01) {
    throw new Error('Voucher lines must balance (debits = credits)');
  }

  const codes = [...new Set(lines.map(l => String(l.accountCode || '').trim()).filter(Boolean))];
  const accounts = await Account.find({ code: { $in: codes } }).lean();
  const map = Object.fromEntries(accounts.map(a => [a.code, a]));

  for (const c of codes) {
    const a = map[c];
    if (!a) throw new Error(`Account not found: ${c}`);
    if (a.isGroup) throw new Error(`Group account cannot be used in voucher lines: ${c}`);
    if (a.active === false) throw new Error(`Inactive account cannot be used in voucher lines: ${c}`);
  }

  return map;
};

const hydrateVoucher = async (v) => {
  if (!v) return null;
  const codes = [...new Set((v.lines || []).map(l => l.accountCode))].filter(Boolean);
  const accounts = await Account.find({ code: { $in: codes } }).lean();
  const map = Object.fromEntries(accounts.map(a => [a.code, a]));
  const { debit, credit } = sumTotals(v.lines || []);
  return {
    _id: String(v._id),
    voucherNo: v.voucherNo,
    type: v.type,
    status: v.status,
    date: v.date,
    portal: v.portal,
    receiptNo: v.receiptNo,
    paymentMethod: v.paymentMethod,
    expenseCategory: v.expenseCategory,
    description: v.description,
    partyType: v.partyType,
    partyId: v.partyId,
    partyName: v.partyName,
    journalEntryId: v.journalEntryId ? String(v.journalEntryId) : null,
    totals: { debit, credit },
    lines: (v.lines || []).map(l => ({
      accountCode: l.accountCode,
      accountName: map[l.accountCode]?.name || l.accountCode,
      debit: l.debit || 0,
      credit: l.credit || 0,
    })),
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
};

// List vouchers
router.get('/', async (req, res, next) => {
  try {
    const { type, status, portal, from, to, q, limit, skip, accountCode } = req.query;
    const filter = {};
    if (type && type !== 'all') filter.type = type;
    if (status && status !== 'all') filter.status = status;
    if (portal && portal !== 'all') filter.portal = portal;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(`${from}T00:00:00.000Z`);
      if (to) filter.date.$lte = new Date(`${to}T23:59:59.999Z`);
    }
    if (q) {
      const qq = String(q).trim();
      if (qq) {
        filter.$or = [
          { voucherNo: new RegExp(qq.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
          { description: new RegExp(qq.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
          { partyName: new RegExp(qq.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
          { receiptNo: new RegExp(qq.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        ];
      }
    }

    if (accountCode) {
      filter['lines.accountCode'] = String(accountCode).trim();
    }

    const lim = Math.max(0, Math.min(200, parseInt(limit, 10) || 0));
    const sk = Math.max(0, parseInt(skip, 10) || 0);

    let queryBuilder = Voucher.find(filter).sort({ date: -1, createdAt: -1 });
    if (sk) queryBuilder = queryBuilder.skip(sk);
    if (lim) queryBuilder = queryBuilder.limit(lim);

    const rows = await queryBuilder.lean();
    const data = await Promise.all(rows.map(hydrateVoucher));
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

// Get voucher detail
router.get('/:id', async (req, res, next) => {
  try {
    const v = await Voucher.findById(req.params.id).lean();
    if (!v) return res.status(404).json({ success: false, message: 'Voucher not found' });
    const data = await hydrateVoucher(v);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

// Create voucher (draft by default). If post=true, it posts immediately (requires open day)
router.post('/', async (req, res, next) => {
  try {
    const body = req.body || {};
    const type = String(body.type || '').trim();
    if (!['JV', 'PV', 'RV', 'CV'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid voucher type' });
    }

    const date = body.date ? new Date(body.date) : new Date();
    const portal = String(body.portal || 'admin').trim() || 'admin';
    const postNow = Boolean(body.post);

    if (postNow) {
      await ensureDayOpen(portal);
    }

    const lines = Array.isArray(body.lines) ? body.lines : [];
    await validateLines(lines);

    const voucherNo = await nextVoucherNo({ type, date, fy: body.fy });

    const v = new Voucher({
      voucherNo,
      type,
      status: 'draft',
      date,
      portal,
      receiptNo: body.receiptNo,
      paymentMethod: body.paymentMethod,
      expenseCategory: body.expenseCategory,
      description: body.description,
      partyType: body.partyType || 'none',
      partyId: body.partyId,
      partyName: body.partyName,
      lines: lines.map(l => ({
        accountCode: String(l.accountCode || '').trim(),
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0),
      })),
    });

    await v.save();

    if (postNow) {
      // mark posted only after successful ledger posting
      const je = await postEntry({
        date: v.date,
        portal: v.portal,
        sourceType: 'voucher',
        sourceId: v.voucherNo,
        description: v.description || `${v.type} ${v.voucherNo}`,
        meta: {
          supplierId: v.partyType === 'supplier' ? v.partyId : undefined,
          customerId: v.partyType === 'customer' ? v.partyId : undefined,
          patientId: v.partyType === 'patient' ? v.partyId : undefined,
          portalRef: v.voucherNo,
          extra: {
            voucherId: String(v._id),
            voucherType: v.type,
            receiptNo: v.receiptNo || undefined,
            partyName: v.partyName || undefined,
            paymentMethod: v.paymentMethod || undefined,
            expenseCategory: v.expenseCategory || undefined,
          },
        },
        lines: v.lines,
      });
      v.journalEntryId = je?._id;
      v.status = 'posted';
      await v.save();
    }

    const data = await hydrateVoucher(await Voucher.findById(v._id).lean());
    res.status(201).json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

// Update voucher (draft only)
router.put('/:id', async (req, res, next) => {
  try {
    const v = await Voucher.findById(req.params.id);
    if (!v) return res.status(404).json({ success: false, message: 'Voucher not found' });
    if (v.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Only draft vouchers can be edited' });
    }

    const body = req.body || {};
    if (body.date) v.date = new Date(body.date);
    if (body.portal) v.portal = String(body.portal).trim();
    if (body.receiptNo !== undefined) v.receiptNo = body.receiptNo;
    if (body.paymentMethod !== undefined) v.paymentMethod = body.paymentMethod;
    if (body.expenseCategory !== undefined) v.expenseCategory = body.expenseCategory;
    if (body.description !== undefined) v.description = body.description;
    if (body.partyType !== undefined) v.partyType = body.partyType;
    if (body.partyId !== undefined) v.partyId = body.partyId;
    if (body.partyName !== undefined) v.partyName = body.partyName;

    if (body.lines) {
      const lines = Array.isArray(body.lines) ? body.lines : [];
      await validateLines(lines);
      v.lines = lines.map(l => ({
        accountCode: String(l.accountCode || '').trim(),
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0),
      }));
    }

    await v.save();
    const data = await hydrateVoucher(v.toObject());
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

// Post voucher (requires open day)
router.post('/:id/post', async (req, res, next) => {
  try {
    const v = await Voucher.findById(req.params.id);
    if (!v) return res.status(404).json({ success: false, message: 'Voucher not found' });
    if (v.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Only draft vouchers can be posted' });
    }

    await ensureDayOpen(v.portal);

    await validateLines(v.lines || []);

    // prevent duplicates if re-post attempt
    const exists = await JournalEntry.exists({ sourceType: 'voucher', sourceId: v.voucherNo });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Voucher already posted to ledger' });
    }

    const je = await postEntry({
      date: v.date,
      portal: v.portal,
      sourceType: 'voucher',
      sourceId: v.voucherNo,
      description: v.description || `${v.type} ${v.voucherNo}`,
      meta: {
        supplierId: v.partyType === 'supplier' ? v.partyId : undefined,
        customerId: v.partyType === 'customer' ? v.partyId : undefined,
        patientId: v.partyType === 'patient' ? v.partyId : undefined,
        portalRef: v.voucherNo,
        extra: {
          voucherId: String(v._id),
          voucherType: v.type,
          receiptNo: v.receiptNo || undefined,
          partyName: v.partyName || undefined,
          paymentMethod: v.paymentMethod || undefined,
          expenseCategory: v.expenseCategory || undefined,
        },
      },
      lines: v.lines,
    });

    v.journalEntryId = je?._id;
    v.status = 'posted';
    await v.save();

    const data = await hydrateVoucher(v.toObject());
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

// Delete voucher (draft only)
router.delete('/:id', async (req, res, next) => {
  try {
    const v = await Voucher.findById(req.params.id);
    if (!v) return res.status(404).json({ success: false, message: 'Voucher not found' });
    if (v.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Only draft vouchers can be deleted' });
    }
    await Voucher.deleteOne({ _id: v._id });
    res.json({ success: true, message: 'Voucher deleted' });
  } catch (e) {
    next(e);
  }
});

export default router;
