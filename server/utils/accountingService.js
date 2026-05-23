import Account from '../models/Account.js';
import JournalEntry from '../models/JournalEntry.js';
import DaySession from '../models/DaySession.js';

// Basic chart of accounts seed (idempotent)
export const ensureDefaultAccounts = async () => {
  const defaults = [
    { code: '1000', name: 'Assets', type: 'asset', isGroup: true, portal: 'global' },
    { code: '1010', name: 'Cash & Bank', type: 'asset', isGroup: true, parentCode: '1000', portal: 'global' },
    { code: '1020', name: 'Receivables', type: 'asset', isGroup: true, parentCode: '1000', portal: 'global' },
    { code: '1030', name: 'Inventory', type: 'asset', isGroup: true, parentCode: '1000', portal: 'global' },
    { code: '2000', name: 'Liabilities', type: 'liability', isGroup: true, portal: 'global' },
    { code: '2050', name: 'Payables', type: 'liability', isGroup: true, parentCode: '2000', portal: 'global' },
    { code: '3001', name: 'Equity', type: 'equity', isGroup: true, portal: 'global' },
    { code: '4000', name: 'Income', type: 'income', isGroup: true, portal: 'global' },
    { code: '5000', name: 'Expenses', type: 'expense', isGroup: true, portal: 'global' },
    { code: '5010', name: 'Cost of Goods Sold', type: 'expense', isGroup: true, parentCode: '5000', portal: 'global' },
    { code: '5020', name: 'Operating Expenses', type: 'expense', isGroup: true, parentCode: '5000', portal: 'global' },
    { code: '1001', name: 'Cash in Hand', type: 'asset', subType: 'cash', portal: 'global' },
    { code: '1002', name: 'Bank', type: 'asset', subType: 'bank', portal: 'global' },
    { code: '1003', name: 'Petty Cash', type: 'asset', subType: 'cash', portal: 'global' },
    { code: '1100', name: 'Accounts Receivable', type: 'asset', subType: 'receivable', portal: 'global' },
    { code: '1110', name: 'Staff Advances', type: 'asset', subType: 'other_receivable', portal: 'global' },
    { code: '1200', name: 'Hospital Inventory', type: 'asset', subType: 'inventory', portal: 'admin' },
    { code: '1210', name: 'Pharmacy Inventory', type: 'asset', subType: 'inventory', portal: 'pharmacy' },
    { code: '1220', name: 'Lab Inventory', type: 'asset', subType: 'inventory', portal: 'lab' },
    { code: '1230', name: 'Pet Shop Inventory', type: 'asset', subType: 'inventory', portal: 'shop' },
    { code: '2001', name: 'Supplier Payables - Hospital', type: 'liability', subType: 'payable', portal: 'admin' },
    { code: '2010', name: 'Supplier Payables - Pharmacy', type: 'liability', subType: 'payable', portal: 'pharmacy' },
    { code: '2020', name: 'Supplier Payables - Lab', type: 'liability', subType: 'payable', portal: 'lab' },
    { code: '2030', name: 'Supplier Payables - Pet Shop', type: 'liability', subType: 'payable', portal: 'shop' },
    { code: '3000', name: "Owner's Equity", type: 'equity', portal: 'global' },
    { code: '4001', name: 'Consultation Fee Revenue', type: 'income', portal: 'reception' },
    { code: '4002', name: 'Registration Fee Revenue', type: 'income', portal: 'reception' },
    { code: '4003', name: 'Procedure Fee Revenue', type: 'income', portal: 'reception' },
    { code: '4100', name: 'Pharmacy Sales Revenue', type: 'income', portal: 'pharmacy' },
    { code: '4200', name: 'Lab Test Revenue', type: 'income', portal: 'lab' },
    { code: '4300', name: 'Pet Shop Sales Revenue', type: 'income', portal: 'shop' },
    { code: '4099', name: 'Other Income', type: 'income', portal: 'global' },
    { code: '5100', name: 'COGS - Pharmacy', type: 'expense', subType: 'cogs', portal: 'pharmacy' },
    { code: '5200', name: 'COGS - Lab', type: 'expense', subType: 'cogs', portal: 'lab' },
    { code: '5300', name: 'COGS - Pet Shop', type: 'expense', subType: 'cogs', portal: 'shop' },
    { code: '5900', name: 'Admin Expenses', type: 'expense', portal: 'admin' },
    { code: '6000', name: 'Staff Salaries', type: 'expense', subType: 'opex_staff', portal: 'global' },
    { code: '6100', name: 'Building-Related Expenses', type: 'expense', subType: 'opex_building', portal: 'global' },
    { code: '6200', name: 'Other Operational Costs', type: 'expense', subType: 'opex_other', portal: 'global' },
    { code: '5910', name: 'Travel Expense', type: 'expense', portal: 'global' },
    { code: '5920', name: 'Food Expense', type: 'expense', portal: 'global' },
    { code: '5990', name: 'Misc Expense', type: 'expense', portal: 'global' },
    { code: '5999', name: 'General Expense', type: 'expense', portal: 'global' },
    { code: '5998', name: 'Cash Short & Over (Cash Adjustment)', type: 'expense', subType: 'cash_adjustment', portal: 'global' },
  ];

  for (const acc of defaults) {
    await Account.updateOne(
      { code: acc.code },
      { $setOnInsert: { ...acc, openingDebit: 0, openingCredit: 0 } },
      { upsert: true }
    );
  }

  // Set hierarchy defaults only when missing (avoid overriding user customization)
  const ensureHierarchy = async (code, parentCode) => {
    await Account.updateOne(
      { code, parentCode: { $in: [null, undefined, ''] } },
      { $set: { parentCode } }
    );
    await Account.updateOne(
      { code, isGroup: { $in: [null, undefined] } },
      { $set: { isGroup: false } }
    );
  };
  const ensureGroup = async (code, parentCode) => {
    await Account.updateOne(
      { code, isGroup: { $in: [null, undefined] } },
      { $set: { isGroup: true } }
    );
    if (parentCode) {
      await Account.updateOne(
        { code, parentCode: { $in: [null, undefined, ''] } },
        { $set: { parentCode } }
      );
    }
  };

  await ensureGroup('1000');
  await ensureGroup('1010', '1000');
  await ensureGroup('1020', '1000');
  await ensureGroup('1030', '1000');
  await ensureGroup('2000');
  await ensureGroup('2050', '2000');
  await ensureGroup('3001');
  await ensureGroup('4000');
  await ensureGroup('5000');
  await ensureGroup('5010', '5000');
  await ensureGroup('5020', '5000');

  await ensureHierarchy('1001', '1010');
  await ensureHierarchy('1002', '1010');
  await ensureHierarchy('1003', '1010');
  await ensureHierarchy('1100', '1020');
  await ensureHierarchy('1110', '1020');
  await ensureHierarchy('1200', '1030');
  await ensureHierarchy('1210', '1030');
  await ensureHierarchy('1220', '1030');
  await ensureHierarchy('1230', '1030');
  await ensureHierarchy('2001', '2050');
  await ensureHierarchy('2010', '2050');
  await ensureHierarchy('2020', '2050');
  await ensureHierarchy('2030', '2050');
  await ensureHierarchy('3000', '3001');
  await ensureHierarchy('4001', '4000');
  await ensureHierarchy('4002', '4000');
  await ensureHierarchy('4003', '4000');
  await ensureHierarchy('4100', '4000');
  await ensureHierarchy('4200', '4000');
  await ensureHierarchy('4300', '4000');
  await ensureHierarchy('4099', '4000');
  await ensureHierarchy('5100', '5010');
  await ensureHierarchy('5200', '5010');
  await ensureHierarchy('5300', '5010');
  await ensureHierarchy('5900', '5020');
  await ensureHierarchy('6000', '5020');
  await ensureHierarchy('6100', '5020');
  await ensureHierarchy('6200', '5020');
  await ensureHierarchy('5910', '5020');
  await ensureHierarchy('5920', '5020');
  await ensureHierarchy('5990', '5020');
  await ensureHierarchy('5999', '5020');
};

const normalBalance = (accountType) => {
  return accountType === 'asset' || accountType === 'expense' ? 'debit' : 'credit';
};

const netBalance = ({ accountType, debit, credit }) => {
  const nb = normalBalance(accountType);
  if (nb === 'debit') return (debit || 0) - (credit || 0);
  return (credit || 0) - (debit || 0);
};

export const getChartOfAccounts = async ({ from, to, portal }) => {
  let start;
  let end;
  if (from) {
    start = new Date(from);
    start.setHours(0, 0, 0, 0);
  }
  if (to) {
    end = new Date(to);
    end.setHours(23, 59, 59, 999);
  }

  const match = {};
  if (start || end) {
    match.date = { ...(start ? { $gte: start } : {}), ...(end ? { $lte: end } : {}) };
  }
  if (portal && portal !== 'all') match.portal = portal;

  const entriesAgg = await JournalEntry.aggregate([
    { $match: match },
    { $unwind: '$lines' },
    {
      $group: {
        _id: '$lines.accountCode',
        debit: { $sum: '$lines.debit' },
        credit: { $sum: '$lines.credit' },
      },
    },
  ]);

  const movementMap = Object.fromEntries(entriesAgg.map(r => [r._id, { debit: r.debit || 0, credit: r.credit || 0 }]));
  const accountFilter = portal && portal !== 'all' ? { $or: [{ portal }, { portal: 'global' }] } : {};
  const accounts = await Account.find(accountFilter).sort({ code: 1 }).lean();
  const accMap = Object.fromEntries(accounts.map(a => [a.code, a]));

  const childrenMap = {};
  for (const a of accounts) {
    const p = a.parentCode || null;
    childrenMap[p] = childrenMap[p] || [];
    childrenMap[p].push(a.code);
  }

  const computeNode = (code) => {
    const acc = accMap[code];
    if (!acc) return { opening: 0, current: 0 };
    const children = childrenMap[code] || [];
    if (acc.isGroup && children.length) {
      let opening = 0;
      let current = 0;
      for (const c of children) {
        const r = computeNode(c);
        opening += r.opening;
        current += r.current;
      }
      return { opening, current };
    }

    const opening = netBalance({
      accountType: acc.type,
      debit: acc.openingDebit || 0,
      credit: acc.openingCredit || 0,
    });

    const mv = movementMap[acc.code] || { debit: 0, credit: 0 };
    const movement = netBalance({ accountType: acc.type, debit: mv.debit, credit: mv.credit });
    return { opening, current: opening + movement };
  };

  const roots = [
    ...((childrenMap[null] || []).filter(c => accMap[c]?.isGroup)),
    ...((childrenMap[null] || []).filter(c => !accMap[c]?.isGroup)),
  ];

  const rows = [];
  const walk = (code, level) => {
    const acc = accMap[code];
    if (!acc) return;
    const amounts = computeNode(code);
    rows.push({
      code: acc.code,
      name: acc.name,
      type: acc.type,
      portal: acc.portal,
      parentCode: acc.parentCode || null,
      isGroup: Boolean(acc.isGroup),
      level,
      opening: amounts.opening,
      current: amounts.current,
    });
    const children = (childrenMap[code] || []).slice().sort();
    for (const c of children) walk(c, level + 1);
  };

  for (const r of roots) walk(r, 0);
  return rows;
};

export const postInventoryPurchase = async (item) => {
  if (!item) return null;
  const qty = Number(item.quantity || 0);
  const unitPrice = Number(item.price || item.purchasePrice || 0);
  const amount = qty * unitPrice;
  if (!amount) return null;

  const portal = item.department || 'admin';
  // Map department to inventory and payable accounts
  const inventoryAccount = portal === 'lab' ? '1220' : portal === 'shop' ? '1230' : '1200';
  const payableAccount = portal === 'lab' ? '2020' : portal === 'shop' ? '2030' : '2001';

  // If supplier provided, credit payable; else assume cash
  const creditLines = item.supplier && String(item.supplier).trim() ?
    [{ accountCode: payableAccount, debit: 0, credit: amount }] :
    [{ accountCode: '1001', debit: 0, credit: amount }];

  const description = `Inventory purchase ${item.itemName || item.name || ''}`.trim();
  const meta = {
    supplierId: item.supplier || undefined,
    portalRef: String(item.id || item._id || ''),
    extra: {
      itemName: item.itemName || item.name,
      quantity: qty,
      unitPrice,
    },
  };

  return postEntry({
    date: item.purchaseDate || item.createdAt || new Date(),
    portal,
    sourceType: 'inventory_purchase',
    sourceId: String(item.id || item._id || ''),
    description,
    meta,
    lines: [
      { accountCode: inventoryAccount, debit: amount, credit: 0 },
      ...creditLines,
    ],
  });
};

export const getBalanceSheet = async ({ from, to, portal }) => {
  // as-of balance by account type; include retained earnings (net income) for the period [from,to]
  const asOfMatch = {};
  if (to) {
    asOfMatch.date = { $lte: new Date(new Date(to).setHours(23,59,59,999)) };
  }
  if (portal && portal !== 'all') asOfMatch.portal = portal;

  const agg = await JournalEntry.aggregate([
    { $match: asOfMatch },
    { $unwind: '$lines' },
    {
      $group: {
        _id: '$lines.accountCode',
        debit: { $sum: '$lines.debit' },
        credit: { $sum: '$lines.credit' },
      },
    },
  ]);

  const balanceMap = Object.fromEntries(
    agg.map(a => [a._id, { debit: a.debit || 0, credit: a.credit || 0 }])
  );

  const accountFilter = portal && portal !== 'all'
    ? { $or: [{ portal }, { portal: 'global' }] }
    : {};
  const accounts = await Account.find({
    ...accountFilter,
    type: { $in: ['asset', 'liability', 'equity'] },
    active: true,
    isGroup: { $ne: true },
  }).sort({ code: 1 }).lean();
  const byType = { asset: [], liability: [], equity: [] };
  for (const acc of accounts) {
    const b0 = balanceMap[acc.code] || { debit: 0, credit: 0 };
    const b = {
      debit: (b0.debit || 0) + (acc.openingDebit || 0),
      credit: (b0.credit || 0) + (acc.openingCredit || 0),
    };
    const bal = (b.debit || 0) - (b.credit || 0);
    if (acc.type === 'asset') byType.asset.push({ code: acc.code, name: acc.name, balance: bal });
    if (acc.type === 'liability') byType.liability.push({ code: acc.code, name: acc.name, balance: (b.credit || 0) - (b.debit || 0) });
    if (acc.type === 'equity') byType.equity.push({ code: acc.code, name: acc.name, balance: (b.credit || 0) - (b.debit || 0) });
  }

  // Net income should be as-of the balance sheet date (cumulative to `to`)
  const isReport = await getIncomeStatement({ from: undefined, to, portal });
  const retained = isReport.netProfit || 0;

  const totalAssets = byType.asset.reduce((s, r) => s + r.balance, 0);
  const totalLiabilities = byType.liability.reduce((s, r) => s + r.balance, 0);
  const totalEquityBase = byType.equity.reduce((s, r) => s + r.balance, 0);
  const totalEquity = totalEquityBase + retained;

  const liabilitiesAndEquity = totalLiabilities + totalEquity;
  const difference = totalAssets - liabilitiesAndEquity;

  return {
    totals: {
      assets: totalAssets,
      liabilities: totalLiabilities,
      equity: totalEquity,
      liabilitiesAndEquity,
      retainedEarnings: retained,
      difference,
    },
    assets: byType.asset,
    liabilities: byType.liability,
    equity: byType.equity,
  };
};

export const getCashFlow = async ({ from, to, portal }) => {
  const cashCodes = ['1001', '1002', '1003'];
  const match = {};
  let start;
  let end;
  if (from) {
    start = new Date(from);
    start.setHours(0, 0, 0, 0);
  }
  if (to) {
    end = new Date(to);
    end.setHours(23, 59, 59, 999);
  }
  if (start || end) {
    match.date = { ...(start ? { $gte: start } : {}), ...(end ? { $lte: end } : {}) };
  }
  if (portal && portal !== 'all') match.portal = portal;

  const accounts = await Account.find().lean();
  const accountMap = Object.fromEntries(accounts.map(a => [a.code, a]));

  const balanceAsOf = async (asOfDate) => {
    if (!asOfDate) return { cashInHand: 0, pettyCash: 0, cash: 0, bank: 0, total: 0 };
    const asOfMatch = { date: { $lte: asOfDate } };
    if (portal && portal !== 'all') asOfMatch.portal = portal;
    const rows = await JournalEntry.aggregate([
      { $match: asOfMatch },
      { $unwind: '$lines' },
      { $match: { 'lines.accountCode': { $in: cashCodes } } },
      {
        $group: {
          _id: '$lines.accountCode',
          debit: { $sum: '$lines.debit' },
          credit: { $sum: '$lines.credit' },
        },
      },
    ]);

    const rowMap = Object.fromEntries(rows.map(r => [r._id, { debit: r.debit || 0, credit: r.credit || 0 }]));
    const opening1001 = (accountMap['1001']?.openingDebit || 0) - (accountMap['1001']?.openingCredit || 0);
    const opening1002 = (accountMap['1002']?.openingDebit || 0) - (accountMap['1002']?.openingCredit || 0);
    const opening1003 = (accountMap['1003']?.openingDebit || 0) - (accountMap['1003']?.openingCredit || 0);

    const cashInHand = ((rowMap['1001']?.debit || 0) - (rowMap['1001']?.credit || 0)) + opening1001;
    const pettyCash = ((rowMap['1003']?.debit || 0) - (rowMap['1003']?.credit || 0)) + opening1003;
    const cash = cashInHand + pettyCash;
    const bank = ((rowMap['1002']?.debit || 0) - (rowMap['1002']?.credit || 0)) + opening1002;
    return { cashInHand, pettyCash, cash, bank, total: cash + bank };
  };

  const openingDate = start ? new Date(start.getTime() - 1) : null;
  const opening = await balanceAsOf(openingDate);
  const closing = await balanceAsOf(end || new Date());

  const entries = await JournalEntry.find(match).sort({ date: 1, _id: 1 }).lean();
  const detailLines = [];

  const categorize = (e) => {
    const st = (e.sourceType || '').toLowerCase();
    if (
      st.includes('sale') ||
      st.includes('lab_report') ||
      st.includes('reception_procedure') ||
      st.includes('financial_income')
    ) return 'operating';
    if (st.includes('financial_expense') || st.includes('purchase') || st.includes('inventory_purchase')) return 'operating';
    if (st.includes('equity')) return 'financing';
    return 'uncategorized';
  };

  const sections = {
    operating: { inflows: [], outflows: [], totalInflows: 0, totalOutflows: 0, net: 0 },
    investing: { inflows: [], outflows: [], totalInflows: 0, totalOutflows: 0, net: 0 },
    financing: { inflows: [], outflows: [], totalInflows: 0, totalOutflows: 0, net: 0 },
    uncategorized: { inflows: [], outflows: [], totalInflows: 0, totalOutflows: 0, net: 0 },
  };

  for (const e of entries) {
    const cashMove = (e.lines || [])
      .filter(l => cashCodes.includes(l.accountCode))
      .reduce((s, l) => s + ((l.debit || 0) - (l.credit || 0)), 0);

    if (Math.abs(cashMove) < 0.000001) continue;

    const components = (e.lines || [])
      .filter(l => !cashCodes.includes(l.accountCode))
      .map(l => {
        const acc = accountMap[l.accountCode];
        return {
          accountCode: l.accountCode,
          accountName: acc?.name || l.accountCode,
          type: acc?.type || null,
          debit: l.debit || 0,
          credit: l.credit || 0,
        };
      });

    const line = {
      entryId: String(e._id),
      date: e.date,
      portal: e.portal,
      sourceType: e.sourceType,
      sourceId: e.sourceId,
      description: e.description,
      inflow: cashMove > 0 ? cashMove : 0,
      outflow: cashMove < 0 ? -cashMove : 0,
      net: cashMove,
      components,
    };

    detailLines.push(line);

    const bucket = categorize(e);
    if (cashMove > 0) {
      sections[bucket].inflows.push(line);
      sections[bucket].totalInflows += cashMove;
    } else {
      sections[bucket].outflows.push(line);
      sections[bucket].totalOutflows += -cashMove;
    }
    sections[bucket].net = sections[bucket].totalInflows - sections[bucket].totalOutflows;
  }

  const totalInflows = Object.values(sections).reduce((s, sec) => s + sec.totalInflows, 0);
  const totalOutflows = Object.values(sections).reduce((s, sec) => s + sec.totalOutflows, 0);
  const netChange = totalInflows - totalOutflows;

  return {
    opening,
    closing,
    totals: { inflows: totalInflows, outflows: totalOutflows, netChange },
    sections,
    lines: detailLines,
  };
};

const resolveCashAccount = (paymentMethod) => {
  const pm = (paymentMethod || '').toLowerCase();
  if (pm.includes('bank') || pm.includes('card') || pm.includes('online')) return '1002';
  return '1001';
};

export const getPayableAccountForPortal = (portal) => {
  if (portal === 'pharmacy') return '2010';
  if (portal === 'lab') return '2020';
  if (portal === 'shop') return '2030';
  return '2001'; // admin/hospital
};

export const postEntry = async ({ date = new Date(), portal = 'system', sourceType, sourceId, description = '', lines, meta = {} }) => {
  if (!lines || !lines.length) {
    throw new Error('Journal entry must have at least one line');
  }

  const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error('Journal entry not balanced (debits != credits)');
  }

  // Link to DaySession if available
  const dayDate = new Date(date).toISOString().slice(0,10);
  let sessionId = undefined;
  try {
    if (portal && portal !== 'system') {
      const session = await DaySession.findOne({ portal, date: dayDate });
      if (session) sessionId = session._id;
    }
  } catch {}

  const entry = new JournalEntry({ date, dayDate, sessionId, portal, sourceType, sourceId, description, lines, meta });
  await entry.save();
  return entry;
};

// Helper: convert a Financial record (generic income/expense) into a journal entry
export const postFinancialRecord = async (financial) => {
  if (!financial) return null;
  const { id, type, category, amount, date, paymentMethod, petId, petName, ownerName } = financial;
  const amt = Number(amount || 0);
  if (!amt) return null;

  const cat = (category || '').toLowerCase();
  const isIncome = type === 'Income';

  // Map payment method to cash/bank account
  const cashAccount = resolveCashAccount(paymentMethod);

  let accountCode;
  if (isIncome) {
    if (cat.includes('consult')) accountCode = '4001';
    else if (cat.includes('register')) accountCode = '4002';
    else if (cat.includes('procedure')) accountCode = '4003';
    else accountCode = '4099';
  } else {
    // Expense side - basic mapping, otherwise General Expense
    if (cat.includes('salary') || cat.includes('payroll') || cat.includes('wage')) accountCode = '6000';
    else if (cat.includes('rent') || cat.includes('electric') || cat.includes('utility') || cat.includes('maintenance') || cat.includes('building')) accountCode = '6100';
    else if (cat.includes('travel')) accountCode = '5910';
    else if (cat.includes('food')) accountCode = '5920';
    else accountCode = '6200';
  }

  const description = `${type} - ${category}`;
  const portal = financial.portal || 'admin';
  const meta = {
    patientId: petId || undefined,
    petId: petId || undefined,
    clientId: ownerName || undefined,
    portalRef: id,
    extra: { petName, ownerName, paymentMethod },
  };

  if (isIncome) {
    // Debit Cash, Credit Income
    return postEntry({
      date,
      portal,
      sourceType: 'financial_income',
      sourceId: id,
      description,
      meta,
      lines: [
        { accountCode: cashAccount, debit: amt, credit: 0 },
        { accountCode, debit: 0, credit: amt },
      ],
    });
  }

  // Expense: Debit Expense, Credit Cash
  return postEntry({
    date,
    portal,
    sourceType: 'financial_expense',
    sourceId: id,
    description,
    meta,
    lines: [
      { accountCode, debit: amt, credit: 0 },
      { accountCode: cashAccount, debit: 0, credit: amt },
    ],
  });
};

export const postReceptionProcedure = async (record) => {
  if (!record) return null;
  const subtotal = Number(record.subtotal || 0);
  const receivedAmount = Number(record.receivedAmount || 0);
  if (!subtotal) return null;

  const cashPortion = Math.max(0, Math.min(receivedAmount, subtotal));
  const receivableCurrent = Math.max(0, subtotal - cashPortion);

  if (!cashPortion && !receivableCurrent) return null;

  const description = `Reception procedures for ${record.petName || ''}`.trim();
  const portal = 'reception';
  const cashAccount = resolveCashAccount(record.paymentMethod || 'Cash');
  const meta = {
    patientId: record.petId || undefined,
    petId: record.petId || undefined,
    clientId: record.clientId || undefined,
    portalRef: String(record._id || ''),
    extra: {
      petName: record.petName,
      ownerName: record.ownerName,
      contact: record.contact,
      previousDues: record.previousDues,
      grandTotal: record.grandTotal,
      receivable: record.receivable,
    },
  };

  const lines = [];
  if (cashPortion) {
    lines.push({ accountCode: cashAccount, debit: cashPortion, credit: 0 });
  }
  if (receivableCurrent) {
    lines.push({ accountCode: '1100', debit: receivableCurrent, credit: 0 });
  }
  lines.push({ accountCode: '4003', debit: 0, credit: subtotal });

  return postEntry({
    date: record.createdAt || new Date(),
    portal,
    sourceType: 'reception_procedure',
    sourceId: String(record._id || ''),
    description,
    meta,
    lines,
  });
};

export const postShopSale = async (sale) => {
  if (!sale) return null;
  const totalAmount = Number(sale.totalAmount || 0);
  if (!totalAmount) return null;

  const receivedAmount = Number(sale.receivedAmount || 0);
  const cashAccount = resolveCashAccount(sale.paymentMethod);

  const cashPortion = Math.max(0, Math.min(receivedAmount, totalAmount));
  const receivableCurrent = Math.max(0, totalAmount - cashPortion);

  const lines = [];
  if (cashPortion) {
    lines.push({ accountCode: cashAccount, debit: cashPortion, credit: 0 });
  }
  if (receivableCurrent) {
    lines.push({ accountCode: '1100', debit: receivableCurrent, credit: 0 });
  }

  // Revenue - Pet Shop Sales
  lines.push({ accountCode: '4300', debit: 0, credit: totalAmount });

  // COGS and Inventory, if we have cost info
  const totalCost = Number(sale.totalCost || 0);
  if (totalCost > 0) {
    lines.push({ accountCode: '5300', debit: totalCost, credit: 0 });
    lines.push({ accountCode: '1230', debit: 0, credit: totalCost });
  }

  const description = `Shop sale ${sale.invoiceNumber || ''}`.trim();
  const meta = {
    customerId: sale.customerId || undefined,
    portalRef: String(sale._id || ''),
    extra: {
      customerName: sale.customerName,
      customerContact: sale.customerContact,
      previousDue: sale.previousDue,
      balanceDue: sale.balanceDue,
      paymentMethod: sale.paymentMethod,
    },
  };

  return postEntry({
    date: sale.createdAt || new Date(),
    portal: 'shop',
    sourceType: 'shop_sale',
    sourceId: String(sale._id || ''),
    description,
    meta,
    lines,
  });
};

export const postLabReport = async (report) => {
  if (!report) return null;
  const baseAmount = Number(report.amount || 0);
  const charge = Number(report.paymentCharge || 0);
  const totalAmount = Math.max(0, baseAmount + charge);
  if (!totalAmount) return null;

  const receivedAmount = Math.max(0, Number(report.receivedAmount || 0));
  const cashPortion = Math.max(0, Math.min(receivedAmount, totalAmount));
  const receivablePortion = Math.max(0, totalAmount - cashPortion);
  const cashAccount = report.paymentMethod && String(report.paymentMethod).toLowerCase().includes('bank') ? '1002' : '1001';

  const lines = [];
  if (cashPortion) {
    lines.push({ accountCode: cashAccount, debit: cashPortion, credit: 0 });
  }
  if (receivablePortion) {
    lines.push({ accountCode: '1100', debit: receivablePortion, credit: 0 });
  }

  // Credit Lab Test Revenue
  lines.push({ accountCode: '4200', debit: 0, credit: totalAmount });

  const description = `Lab report ${report.reportNumber || ''}`.trim();
  const meta = {
    patientId: report.petId || undefined,
    petId: report.petId || undefined,
    clientId: report.ownerName || undefined,
    portalRef: report.id || undefined,
    extra: {
      petName: report.petName,
      ownerName: report.ownerName,
      testCategory: report.testCategory,
      testType: report.testType,
      paymentStatus: report.paymentStatus,
    },
  };

  return postEntry({
    date: report.reportDate || report.createdAt || new Date(),
    portal: 'lab',
    sourceType: 'lab_report',
    sourceId: report.id || String(report._id || ''),
    description,
    meta,
    lines,
  });
};

export const postPharmacySale = async (sale) => {
  if (!sale) return null;
  const totalAmount = Number(sale.totalAmount || 0);
  if (!totalAmount) return null;

  const receivedAmount = Number(sale.receivedAmount || 0);
  const cashAccount = resolveCashAccount(sale.paymentMethod);

  const cashPortion = Math.max(0, Math.min(receivedAmount, totalAmount));
  const receivableCurrent = Math.max(0, totalAmount - cashPortion);

  const lines = [];
  if (cashPortion) {
    lines.push({ accountCode: cashAccount, debit: cashPortion, credit: 0 });
  }
  if (receivableCurrent) {
    lines.push({ accountCode: '1100', debit: receivableCurrent, credit: 0 });
  }

  // Revenue
  lines.push({ accountCode: '4100', debit: 0, credit: totalAmount });

  // COGS and Inventory, if we have cost info
  const totalCost = Number(sale.totalCost || 0);
  if (totalCost > 0) {
    lines.push({ accountCode: '5100', debit: totalCost, credit: 0 });
    lines.push({ accountCode: '1210', debit: 0, credit: totalCost });
  }

  const description = `Pharmacy sale ${sale.invoiceNumber || ''}`.trim();
  const meta = {
    patientId: sale.patientId || undefined,
    petId: sale.patientId || undefined,
    clientId: sale.clientId || undefined,
    customerId: sale.clientId || undefined,
    portalRef: String(sale._id || ''),
    extra: {
      customerName: sale.customerName,
      customerContact: sale.customerContact,
      previousDue: sale.previousDue,
      dueAmount: sale.dueAmount,
      newTotalDue: sale.newTotalDue,
      paymentMethod: sale.paymentMethod,
    },
  };

  return postEntry({
    date: sale.createdAt || new Date(),
    portal: 'pharmacy',
    sourceType: 'pharmacy_sale',
    sourceId: String(sale._id || ''),
    description,
    meta,
    lines,
  });
};

// Simple aggregations
export const getTrialBalance = async ({ from, to, portal }) => {
  const match = {};
  if (from || to) {
    match.date = {};
    if (from) {
      const start = new Date(from);
      start.setHours(0, 0, 0, 0);
      match.date.$gte = start;
    }
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      match.date.$lte = end;
    }
  }
  if (portal && portal !== 'all') match.portal = portal;

  const entries = await JournalEntry.aggregate([
    { $match: match },
    { $unwind: '$lines' },
    {
      $group: {
        _id: '$lines.accountCode',
        debit: { $sum: '$lines.debit' },
        credit: { $sum: '$lines.credit' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const accountFilter = portal && portal !== 'all'
    ? { $or: [{ portal }, { portal: 'global' }] }
    : {};
  const accounts = await Account.find({ ...accountFilter, active: true }).lean();
  const map = Object.fromEntries(accounts.map(a => [a.code, a]));
  const byCode = Object.fromEntries(entries.map(e => [e._id, e]));

  const rows = accounts
    .filter(a => !a.isGroup)
    .map(a => {
      const e = byCode[a.code] || { debit: 0, credit: 0 };
      return {
        code: a.code,
        name: a.name,
        type: a.type || null,
        debit: (e.debit || 0) + (a.openingDebit || 0),
        credit: (e.credit || 0) + (a.openingCredit || 0),
      };
    })
    .sort((a, b) => String(a.code).localeCompare(String(b.code)));

  return rows;
};

export const getIncomeStatement = async ({ from, to, portal }) => {
  const match = {};
  if (from || to) {
    match.date = {};
    if (from) {
      const start = new Date(from);
      start.setHours(0, 0, 0, 0);
      match.date.$gte = start;
    }
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      match.date.$lte = end;
    }
  }
  if (portal && portal !== 'all') match.portal = portal;

  const pipeline = [
    { $match: match },
    { $unwind: '$lines' },
    {
      $group: {
        _id: '$lines.accountCode',
        debit: { $sum: '$lines.debit' },
        credit: { $sum: '$lines.credit' },
      },
    },
  ];

  const aggregates = await JournalEntry.aggregate(pipeline);
  const allAccounts = await Account.find().lean();
  const accountMap = Object.fromEntries(allAccounts.map(a => [a.code, a]));

  let totalRevenue = 0;
  let totalCOGS = 0;
  let totalExpenses = 0;

  const details = aggregates.map(a => {
    const acc = accountMap[a._id];
    const type = acc?.type;
    const balance = (a.debit || 0) - (a.credit || 0);
    if (type === 'income') {
      totalRevenue += -balance; // income normally credit
    } else if (type === 'expense' && acc?.subType === 'cogs') {
      totalCOGS += balance;
    } else if (type === 'expense') {
      totalExpenses += balance;
    }
    return { code: a._id, name: acc?.name || a._id, type, debit: a.debit, credit: a.credit };
  });

  const grossProfit = totalRevenue - totalCOGS;
  const netProfit = grossProfit - totalExpenses;

  const incomeHeads = {
    consultation: { total: 0, entries: [] },
    procedures: { total: 0, entries: [] },
    pharmacy: { total: 0, entries: [] },
    lab: { total: 0, entries: [] },
    other: { total: 0, entries: [] },
  };

  const expenseHeads = {
    staffSalaries: { total: 0, entries: [] },
    buildingRelated: { total: 0, entries: [] },
    otherOperational: { total: 0, entries: [] },
  };

  const classifyIncomeHead = (sourceType, description) => {
    const st = (sourceType || '').toLowerCase();
    const desc = (description || '').toLowerCase();
    if (st.includes('reception_procedure') || desc.includes('procedure')) return 'procedures';
    if (desc.includes('consultation')) return 'consultation';
    if (st.includes('pharmacy')) return 'pharmacy';
    if (st.includes('lab')) return 'lab';
    return 'other';
  };

  const classifyExpenseHead = (category) => {
    const c = (category || '').toLowerCase();
    if (c.includes('salary') || c.includes('payroll') || c.includes('wage')) return 'staffSalaries';
    if (c.includes('rent') || c.includes('electric') || c.includes('utility') || c.includes('maintenance') || c.includes('building')) return 'buildingRelated';
    return 'otherOperational';
  };

  // Get all entries to build breakdown
  const allEntries = await JournalEntry.find(match).sort({ date: 1, _id: 1 }).lean();

  for (const e of allEntries) {
    const isVoucherExpense = e.sourceType === 'voucher' && /^Expense\s*-\s*/i.test(e.description || '');
    
    // Process Revenue
    const revenueLines = (e.lines || []).filter(l => {
      const acc = accountMap[l.accountCode];
      return acc?.type === 'income';
    });
    const revAmount = revenueLines.reduce((s, l) => s + (l.credit - l.debit), 0);
    if (revAmount > 0) {
      const headKey = classifyIncomeHead(e.sourceType, e.description);
      incomeHeads[headKey].total += revAmount;
      incomeHeads[headKey].entries.push({
        entryId: String(e._id),
        date: e.date,
        portal: e.portal,
        description: e.description,
        amount: revAmount
      });
    }

    // Process Expenses
    if (e.sourceType === 'financial_expense' || isVoucherExpense) {
      const fromMeta = e.meta?.extra?.expenseCategory ? String(e.meta.extra.expenseCategory) : '';
      const rawCategoryBase = fromMeta || (e.description || '').replace(/^Expense\s*-\s*/i, '').trim();
      const rawCategory = rawCategoryBase.split('|')[0].trim();
      const headKey = classifyExpenseHead(rawCategory);
      
      const expenseLines = (e.lines || []).filter(l => {
        const acc = accountMap[l.accountCode];
        return acc?.type === 'expense' && acc?.subType !== 'cogs';
      });
      const amount = expenseLines.reduce((s, l) => s + (l.debit - l.credit), 0);
      
      if (amount > 0) {
        expenseHeads[headKey].total += amount;
        expenseHeads[headKey].entries.push({
          entryId: String(e._id),
          date: e.date,
          portal: e.portal,
          category: rawCategory,
          description: e.description,
          amount,
          paymentMethod: e.meta?.extra?.paymentMethod || null,
        });
      }
    }
  }

  const operatingRevenueBreakdown = {
    consultation: incomeHeads.consultation.total,
    procedures: incomeHeads.procedures.total,
    pharmacy: incomeHeads.pharmacy.total,
    lab: incomeHeads.lab.total,
    other: incomeHeads.other.total,
    total: totalRevenue
  };

  const operatingExpenseBreakdown = {
    staffSalaries: expenseHeads.staffSalaries.total,
    buildingRelated: expenseHeads.buildingRelated.total,
    otherOperational: expenseHeads.otherOperational.total,
    total: expenseHeads.staffSalaries.total + expenseHeads.buildingRelated.total + expenseHeads.otherOperational.total,
    entries: expenseHeads,
  };

  return { totalRevenue, totalCOGS, totalExpenses, grossProfit, netProfit, operatingRevenueBreakdown, operatingExpenseBreakdown, lines: details };
};

export const getSanityChecks = async ({ from, to, portal }) => {
  const accountFilter = portal && portal !== 'all'
    ? { $or: [{ portal }, { portal: 'global' }] }
    : {};

  const accounts = await Account.find({ ...accountFilter, active: true, isGroup: { $ne: true } }).lean();
  const opening = accounts.reduce(
    (s, a) => {
      s.debit += Number(a.openingDebit || 0);
      s.credit += Number(a.openingCredit || 0);
      return s;
    },
    { debit: 0, credit: 0 }
  );
  opening.difference = opening.debit - opening.credit;
  opening.ok = Math.abs(opening.difference) < 0.01;

  const tbRows = await getTrialBalance({ from, to, portal });
  const trialBalance = (tbRows || []).reduce(
    (s, r) => {
      s.debit += Number(r.debit || 0);
      s.credit += Number(r.credit || 0);
      return s;
    },
    { debit: 0, credit: 0 }
  );
  trialBalance.difference = trialBalance.debit - trialBalance.credit;
  trialBalance.ok = Math.abs(trialBalance.difference) < 0.01;

  const bs = await getBalanceSheet({ from, to, portal });
  const balanceSheet = {
    assets: Number(bs?.totals?.assets || 0),
    liabilitiesAndEquity: Number(bs?.totals?.liabilitiesAndEquity || 0),
    difference: Number(bs?.totals?.difference || 0),
    ok: Math.abs(Number(bs?.totals?.difference || 0)) < 0.01,
  };

  return { opening, trialBalance, balanceSheet };
};

export const getAccountBalanceAsOf = async ({ accountCode, to, portal }) => {
  if (!accountCode) return null;
  const acc = await Account.findOne({ code: String(accountCode).trim() }).lean();
  if (!acc) return null;

  const asOfMatch = {};
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    asOfMatch.date = { $lte: end };
  }
  if (portal && portal !== 'all') asOfMatch.portal = portal;

  const agg = await JournalEntry.aggregate([
    { $match: { ...asOfMatch, 'lines.accountCode': String(accountCode).trim() } },
    { $unwind: '$lines' },
    { $match: { 'lines.accountCode': String(accountCode).trim() } },
    {
      $group: {
        _id: '$lines.accountCode',
        debit: { $sum: '$lines.debit' },
        credit: { $sum: '$lines.credit' },
      },
    },
  ]);

  const mv = agg && agg[0] ? agg[0] : { debit: 0, credit: 0 };
  const openingDebit = Number(acc.openingDebit || 0);
  const openingCredit = Number(acc.openingCredit || 0);
  const debit = Number(mv.debit || 0);
  const credit = Number(mv.credit || 0);

  const isDebitNormal = acc.type === 'asset' || acc.type === 'expense';
  const openingBalance = isDebitNormal ? (openingDebit - openingCredit) : (openingCredit - openingDebit);
  const movement = isDebitNormal ? (debit - credit) : (credit - debit);
  const balance = openingBalance + movement;

  return {
    code: acc.code,
    name: acc.name,
    type: acc.type,
    portal: acc.portal,
    asOf: to || null,
    openingDebit,
    openingCredit,
    debit,
    credit,
    balance,
  };
};

export const postPharmacyPurchase = async (purchase) => {
  if (!purchase) return null;
  const totalAmount = Number(purchase.totalAmount || 0);
  if (!totalAmount) return null;

  const paid = Number(purchase.amountPaid || 0);
  const cashPortion = Math.max(0, Math.min(paid, totalAmount));
  const payablePortion = Math.max(0, totalAmount - cashPortion);

  const lines = [];
  if (cashPortion) {
    // Cash/Bank out
    lines.push({ accountCode: '1001', debit: 0, credit: cashPortion });
  }
  if (payablePortion) {
    // Supplier Payable - Pharmacy
    lines.push({ accountCode: '2010', debit: 0, credit: payablePortion });
  }

  // Inventory in (Pharmacy Inventory)
  lines.push({ accountCode: '1210', debit: totalAmount, credit: 0 });

  const description = `Pharmacy purchase ${purchase.purchaseOrderNo || ''}`.trim();
  const meta = {
    supplierId: purchase.supplierName || undefined,
    portalRef: String(purchase._id || ''),
    extra: {
      supplierName: purchase.supplierName,
      supplierContact: purchase.supplierContact,
      invoiceNo: purchase.invoiceNo,
      paymentStatus: purchase.paymentStatus,
    },
  };

  return postEntry({
    date: purchase.purchaseDate || purchase.createdAt || new Date(),
    portal: 'pharmacy',
    sourceType: 'pharmacy_purchase',
    sourceId: String(purchase._id || ''),
    description,
    meta,
    lines,
  });
};

export const getGeneralLedger = async ({ accountCode, from, to, portal }) => {
  if (!accountCode) return [];
  const match = {};
  if (from || to) {
    match.date = {};
    if (from) {
      const start = new Date(from);
      start.setHours(0, 0, 0, 0);
      match.date.$gte = start;
    }
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      match.date.$lte = end;
    }
  }
  if (portal && portal !== 'all') match.portal = portal;

  const pipeline = [
    { $match: match },
    { $unwind: '$lines' },
    { $match: { 'lines.accountCode': accountCode } },
    { $sort: { date: 1, _id: 1 } },
  ];

  const entries = await JournalEntry.aggregate(pipeline);

  let runningDebit = 0;
  let runningCredit = 0;

  return entries.map(e => {
    runningDebit += e.lines.debit || 0;
    runningCredit += e.lines.credit || 0;
    return {
      entryId: String(e._id),
      date: e.date,
      portal: e.portal,
      sourceType: e.sourceType,
      sourceId: e.sourceId,
      description: e.description,
      debit: e.lines.debit || 0,
      credit: e.lines.credit || 0,
      runningDebit,
      runningCredit,
    };
  });
};

export const getJournalEntryDetail = async ({ entryId }) => {
  if (!entryId) return null;
  const entry = await JournalEntry.findById(entryId).lean();
  if (!entry) return null;

  const accounts = await Account.find({ code: { $in: (entry.lines || []).map(l => l.accountCode) } }).lean();
  const accountMap = Object.fromEntries(accounts.map(a => [a.code, a]));

  const lines = (entry.lines || []).map(l => {
    const acc = accountMap[l.accountCode];
    return {
      accountCode: l.accountCode,
      accountName: acc?.name || l.accountCode,
      accountType: acc?.type || null,
      subType: acc?.subType || null,
      debit: l.debit || 0,
      credit: l.credit || 0,
    };
  });

  const totals = {
    debit: lines.reduce((s, l) => s + (l.debit || 0), 0),
    credit: lines.reduce((s, l) => s + (l.credit || 0), 0),
  };

  const hasReceivable = lines.some(l => l.accountCode === '1100' && (l.debit || l.credit));
  const hasPayable = lines.some(l => ['2001', '2010', '2020', '2030'].includes(l.accountCode) && (l.debit || l.credit));
  const hasCash = lines.some(l => ['1001', '1002'].includes(l.accountCode) && (l.debit || l.credit));
  const paymentStatus = entry?.meta?.extra?.paymentStatus || (hasCash ? (hasReceivable || hasPayable ? 'Partially Paid' : 'Paid') : (hasReceivable || hasPayable ? 'Unpaid' : 'N/A'));

  return {
    entryId: String(entry._id),
    date: entry.date,
    dayDate: entry.dayDate,
    portal: entry.portal,
    sourceType: entry.sourceType,
    sourceId: entry.sourceId,
    description: entry.description,
    meta: entry.meta || {},
    totals,
    paymentStatus,
    lines,
  };
};

export const getPartyLedger = async ({ partyType, partyId, from, to, portal }) => {
  if (!partyId) return [];

  const match = {};
  if (from || to) {
    match.date = {};
    if (from) {
      const start = new Date(from);
      start.setHours(0, 0, 0, 0);
      match.date.$gte = start;
    }
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      match.date.$lte = end;
    }
  }
  if (portal && portal !== 'all') match.portal = portal;

  const pipeline = [
    { $match: match },
    { $sort: { date: 1, _id: 1 } },
  ];

  const entries = await JournalEntry.aggregate(pipeline);

  let runningBalance = 0;

  const relevantAccountCodes =
    partyType === 'supplier'
      ? ['2001', '2010', '2020', '2030']
      : ['1100', '1001', '1002'];

  const matchEntryParty = (e) => {
    if (!e.meta) return false;
    const m = e.meta;
    // Check all possible party ID fields for a match
    const partyFields = ['patientId', 'petId', 'clientId', 'customerId', 'supplierId', 'partyId'];
    for (const f of partyFields) {
      if (String(m[f] || '') === String(partyId)) return true;
      if (m.extra && String(m.extra[f] || '') === String(partyId)) return true;
    }
    return false;
  };

  return entries
    .filter(matchEntryParty)
    .map(e => {
      const relLines = (e.lines || []).filter(l => relevantAccountCodes.includes(l.accountCode));
      const debit = relLines.reduce((s, l) => s + (l.debit || 0), 0);
      const credit = relLines.reduce((s, l) => s + (l.credit || 0), 0);
      if (partyType === 'supplier') {
        runningBalance += credit - debit;
      } else {
        runningBalance += debit - credit;
      }
      return {
        entryId: String(e._id),
        date: e.date,
        portal: e.portal,
        sourceType: e.sourceType,
        sourceId: e.sourceId,
        description: e.description,
        debit,
        credit,
        balance: runningBalance,
      };
    });
};

export default {
  ensureDefaultAccounts,
  postEntry,
  getTrialBalance,
  getIncomeStatement,
  getChartOfAccounts,
  getSanityChecks,
  getAccountBalanceAsOf,
  postFinancialRecord,
  postReceptionProcedure,
  postPharmacySale,
  postLabReport,
  postShopSale,
  postPharmacyPurchase,
  postInventoryPurchase,
  getGeneralLedger,
  getJournalEntryDetail,
  getPartyLedger,
  getBalanceSheet,
  getCashFlow,
};
