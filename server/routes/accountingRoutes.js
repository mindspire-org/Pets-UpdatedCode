import express from 'express';
import Account from '../models/Account.js';
import JournalEntry from '../models/JournalEntry.js';
import Sale from '../models/Sale.js';
import PharmacySale from '../models/PharmacySale.js';
import PharmacyPurchase from '../models/PharmacyPurchase.js';
import Inventory from '../models/Inventory.js';
import LabReport from '../models/LabReport.js';
import ProcedureRecord from '../models/ProcedureRecord.js';
import Financial from '../models/Financial.js';
import Expense from '../models/Expense.js';
import { ensureDefaultAccounts, getChartOfAccounts, getSanityChecks, getAccountBalanceAsOf, getTrialBalance, getIncomeStatement, getGeneralLedger, getJournalEntryDetail, getPartyLedger, getBalanceSheet, getCashFlow, postShopSale, postPharmacySale, postPharmacyPurchase, postLabReport, postReceptionProcedure, postFinancialRecord, postInventoryPurchase } from '../utils/accountingService.js';

const router = express.Router();

// Ensure default accounts exist before any request
router.use(async (req, res, next) => {
  try {
    await ensureDefaultAccounts();
    next();
  } catch (err) {
    next(err);
  }
});

// GET /api/accounting/accounts
router.get('/accounts', async (req, res, next) => {
  try {
    const accounts = await Account.find().sort({ code: 1 });
    res.json({ success: true, data: accounts });
  } catch (err) {
    next(err);
  }
});

// GET /api/accounting/chart-of-accounts?from=&to=&portal=
router.get('/chart-of-accounts', async (req, res, next) => {
  try {
    const { from, to, portal } = req.query;
    const rows = await getChartOfAccounts({ from, to, portal });
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/accounting/sanity-checks?from=&to=&portal=
router.get('/sanity-checks', async (req, res, next) => {
  try {
    const { from, to, portal } = req.query;
    const data = await getSanityChecks({ from, to, portal });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /api/accounting/account-balance/:accountCode?to=&portal=
router.get('/account-balance/:accountCode', async (req, res, next) => {
  try {
    const { accountCode } = req.params;
    const { to, portal } = req.query;
    const data = await getAccountBalanceAsOf({ accountCode, to, portal });
    if (!data) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// POST /api/accounting/accounts
router.post('/accounts', async (req, res, next) => {
  try {
    const body = req.body || {};
    const code = String(body.code || '').trim();
    const name = String(body.name || '').trim();
    const type = String(body.type || '').trim();

    if (!code || !name || !type) {
      return res.status(400).json({ success: false, message: 'code, name, type are required' });
    }

    const parentCode = body.parentCode ? String(body.parentCode).trim() : undefined;
    if (parentCode) {
      const parent = await Account.findOne({ code: parentCode });
      if (!parent) {
        return res.status(400).json({ success: false, message: 'parentCode not found' });
      }
    }

    const account = new Account({
      code,
      name,
      type,
      subType: body.subType,
      portal: body.portal || 'global',
      active: body.active !== undefined ? Boolean(body.active) : true,
      isGroup: Boolean(body.isGroup),
      parentCode,
      openingDebit: Number(body.openingDebit || 0),
      openingCredit: Number(body.openingCredit || 0),
    });

    await account.save();
    res.status(201).json({ success: true, data: account });
  } catch (err) {
    next(err);
  }
});

// PUT /api/accounting/accounts/:code
router.put('/accounts/:code', async (req, res, next) => {
  try {
    const code = String(req.params.code || '').trim();
    const body = req.body || {};
    if (!code) return res.status(400).json({ success: false, message: 'code is required' });

    const existing = await Account.findOne({ code });
    if (!existing) return res.status(404).json({ success: false, message: 'Account not found' });

    const parentCode = body.parentCode !== undefined ? String(body.parentCode || '').trim() : existing.parentCode;
    if (parentCode) {
      if (parentCode === code) {
        return res.status(400).json({ success: false, message: 'parentCode cannot equal code' });
      }
      const parent = await Account.findOne({ code: parentCode });
      if (!parent) {
        return res.status(400).json({ success: false, message: 'parentCode not found' });
      }
    }

    const updated = await Account.findOneAndUpdate(
      { code },
      {
        $set: {
          name: body.name !== undefined ? String(body.name).trim() : existing.name,
          type: body.type !== undefined ? String(body.type).trim() : existing.type,
          subType: body.subType !== undefined ? body.subType : existing.subType,
          portal: body.portal !== undefined ? body.portal : existing.portal,
          active: body.active !== undefined ? Boolean(body.active) : existing.active,
          isGroup: body.isGroup !== undefined ? Boolean(body.isGroup) : existing.isGroup,
          parentCode: body.parentCode !== undefined ? (parentCode || undefined) : existing.parentCode,
          openingDebit: body.openingDebit !== undefined ? Number(body.openingDebit || 0) : existing.openingDebit,
          openingCredit: body.openingCredit !== undefined ? Number(body.openingCredit || 0) : existing.openingCredit,
        },
      },
      { new: true }
    );

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/accounting/accounts/:code
router.delete('/accounts/:code', async (req, res, next) => {
  try {
    const code = String(req.params.code || '').trim();
    if (!code) return res.status(400).json({ success: false, message: 'code is required' });

    const children = await Account.exists({ parentCode: code });
    if (children) {
      return res.status(400).json({ success: false, message: 'Cannot delete: account has child accounts' });
    }

    const used = await JournalEntry.exists({ 'lines.accountCode': code });
    if (used) {
      return res.status(400).json({ success: false, message: 'Cannot delete: account has transactions' });
    }

    const removed = await Account.findOneAndDelete({ code });
    if (!removed) return res.status(404).json({ success: false, message: 'Account not found' });

    res.json({ success: true, message: 'Account deleted' });
  } catch (err) {
    next(err);
  }
});

// GET /api/accounting/trial-balance?from=&to=
router.get('/trial-balance', async (req, res, next) => {
  try {
    const { from, to, portal } = req.query;
    const rows = await getTrialBalance({ from, to, portal });
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/accounting/income-statement?from=&to=
router.get('/income-statement', async (req, res, next) => {
  try {
    const { from, to, portal } = req.query;
    const report = await getIncomeStatement({ from, to, portal });
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

// GET /api/accounting/balance-sheet?from=&to=&portal=
router.get('/balance-sheet', async (req, res, next) => {
  try {
    const { from, to, portal } = req.query;
    const report = await getBalanceSheet({ from, to, portal });
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

// GET /api/accounting/cash-flow?from=&to=&portal=
router.get('/cash-flow', async (req, res, next) => {
  try {
    const { from, to, portal } = req.query;
    const report = await getCashFlow({ from, to, portal });
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

// GET /api/accounting/general-ledger/:accountCode
router.get('/general-ledger/:accountCode', async (req, res, next) => {
  try {
    const { accountCode } = req.params;
    const { from, to, portal } = req.query;
    const rows = await getGeneralLedger({ accountCode, from, to, portal });
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/accounting/journal-entry/:entryId
router.get('/journal-entry/:entryId', async (req, res, next) => {
  try {
    const { entryId } = req.params;
    const detail = await getJournalEntryDetail({ entryId });
    if (!detail) {
      return res.status(404).json({ success: false, message: 'Journal entry not found' });
    }
    res.json({ success: true, data: detail });
  } catch (err) {
    next(err);
  }
});

// GET /api/accounting/customer-ledger/:id
router.get('/customer-ledger/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { from, to, portal } = req.query;
    const rows = await getPartyLedger({ partyType: 'customer', partyId: id, from, to, portal });
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/accounting/supplier-ledger/:id
router.get('/supplier-ledger/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { from, to, portal } = req.query;
    const rows = await getPartyLedger({ partyType: 'supplier', partyId: id, from, to, portal });
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/accounting/patient-ledger/:id
router.get('/patient-ledger/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { from, to, portal } = req.query;
    const rows = await getPartyLedger({ partyType: 'patient', partyId: id, from, to, portal });
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/accounting/sync?from=&to=
// Backfill JournalEntries from existing domain records in the given date range
router.post('/sync', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    let start, end;
    if (from) { start = new Date(from); start.setHours(0,0,0,0); }
    if (to) { end = new Date(to); end.setHours(23,59,59,999); }

    const inRange = (field) => (start || end) ? { [field]: { ...(start ? { $gte: start } : {}), ...(end ? { $lte: end } : {}) } } : {};

    const summary = { created: 0, skipped: 0, errors: 0, details: [] };

    // Helper to check existence and post
    const ensureEntry = async (sourceType, sourceId, postFn, payload) => {
      try {
        const exists = await JournalEntry.exists({ sourceType, sourceId: String(sourceId) });
        if (exists) { summary.skipped++; return; }
        await postFn(payload);
        summary.created++;
      } catch (e) {
        summary.errors++;
        summary.details.push({ sourceType, sourceId, error: e?.message || String(e) });
      }
    };

    // Shop Sales
    const shopSales = await Sale.find(inRange('createdAt')).lean();
    for (const s of shopSales) {
      await ensureEntry('shop_sale', String(s._id), postShopSale, s);
    }

    // Pharmacy Sales
    const phSales = await PharmacySale.find(inRange('createdAt')).lean();
    for (const s of phSales) {
      await ensureEntry('pharmacy_sale', String(s._id), postPharmacySale, s);
    }

    // Pharmacy Purchases
    const phPurchases = await PharmacyPurchase.find({ $or: [ inRange('purchaseDate'), inRange('createdAt') ] }).lean();
    for (const p of phPurchases) {
      await ensureEntry('pharmacy_purchase', String(p._id), postPharmacyPurchase, p);
    }

    // Lab Reports
    const labReports = await LabReport.find({ $or: [ inRange('reportDate'), inRange('createdAt') ] }).lean();
    for (const r of labReports) {
      const sid = r.id || String(r._id);
      // existence check tries both possible id encodings
      const exists = await JournalEntry.exists({ sourceType: 'lab_report', sourceId: { $in: [sid, String(r._id)] } });
      if (exists) { summary.skipped++; } else {
        await ensureEntry('lab_report', sid, postLabReport, r);
      }
    }

    // Reception Procedures
    const procedures = await ProcedureRecord.find(inRange('createdAt')).lean();
    for (const pr of procedures) {
      await ensureEntry('reception_procedure', String(pr._id), postReceptionProcedure, pr);
    }

    // Financial Records (Income/Expense)
    const financials = await Financial.find(inRange('date')).lean();
    for (const f of financials) {
      const type = f.type === 'Income' ? 'financial_income' : 'financial_expense';
      await ensureEntry(type, f.id || String(f._id), postFinancialRecord, f);
    }

    // Expenses (ensure accounting posted if any missed)
    const expenses = await Expense.find(inRange('date')).lean();
    for (const e of expenses) {
      await ensureEntry('financial_expense', e.id || String(e._id), postFinancialRecord, {
        id: e.id,
        type: 'Expense',
        category: e.category,
        amount: e.amount,
        date: e.date,
        paymentMethod: e.paymentMethod,
        portal: e.portal || 'admin',
      });
    }

    // Inventory Purchases (Admin/Lab/Shop)
    const invFilter = { $and: [
      { $or: [ inRange('purchaseDate'), inRange('createdAt') ] },
      { department: { $in: ['admin','lab','shop'] } },
    ]};
    const invItems = await Inventory.find(invFilter).lean();
    for (const it of invItems) {
      await ensureEntry('inventory_purchase', String(it.id || it._id), postInventoryPurchase, it);
    }

    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
});

export default router;
