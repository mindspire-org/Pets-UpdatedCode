import DaySession from '../models/DaySession.js';
import DailyLog from '../models/DailyLog.js';
import JournalEntry from '../models/JournalEntry.js';
import { postEntry } from './accountingService.js';

const CASH_CODE = '1001';
const BANK_CODE = '1002';
const CASH_ADJ_CODE = '5998';

export async function getTodaySession({ portal }) {
  const date = new Date().toISOString().slice(0,10);
  return DaySession.findOne({ portal, date }).sort({ createdAt: -1 });
}

export async function computeTallies({ portal, date }) {
  const dayStr = date || new Date().toISOString().slice(0,10);
  const start = new Date(`${dayStr}T00:00:00.000Z`);
  const end = new Date(`${dayStr}T23:59:59.999Z`);

  const match = { portal, date: { $gte: start, $lte: end } };

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
  ]);

  const map = Object.fromEntries(entries.map(e => [e._id, e]));
  const cash = map[CASH_CODE] || { debit: 0, credit: 0 };
  const bank = map[BANK_CODE] || { debit: 0, credit: 0 };

  // Income and Expense summaries
  // We infer using naming: revenue accounts start with '4', expense accounts start with '5'
  const totals = entries.reduce((acc, e) => {
    if (String(e._id).startsWith('4')) {
      acc.sales += (e.credit || 0) - (e.debit || 0);
      acc.income += (e.credit || 0) - (e.debit || 0);
    } else if (String(e._id).startsWith('5')) {
      acc.expenses += (e.debit || 0) - (e.credit || 0);
    }
    return acc;
  }, { sales: 0, income: 0, expenses: 0 });

  return {
    cashIn: cash.debit || 0,
    cashOut: cash.credit || 0,
    bankIn: bank.debit || 0,
    bankOut: bank.credit || 0,
    sales: totals.sales,
    income: totals.income,
    expenses: totals.expenses,
  };
}

export async function openDay({ portal, openingAmount, openedBy, openingNote }) {
  const today = new Date().toISOString().slice(0,10);

  // If a previous day is still open, and it's not today, auto late-close it
  const existsOpen = await DaySession.findOne({ portal, status: 'open' });
  if (existsOpen) {
    if (existsOpen.date === today) {
      return existsOpen;
    }
    // Auto-close previous open day as a late close with expected tallies
    const prevDate = existsOpen.date;
    const tallies = await computeTallies({ portal, date: prevDate });
    const adjTotal = (existsOpen.adjustments || []).reduce((s, a) => s + (a.type === 'subtract' ? -Math.abs(Number(a.amount||0)) : Math.abs(Number(a.amount||0))), 0);
    const expectedClosingCash = (existsOpen.openingAmount || 0) + (tallies.cashIn || 0) - (tallies.cashOut || 0);
    const expectedClosingBank = (tallies.bankIn || 0) - (tallies.bankOut || 0);
    const expectedTotal = expectedClosingCash + expectedClosingBank + adjTotal;

    existsOpen.status = 'closed';
    existsOpen.closingAmount = expectedClosingCash;
    existsOpen.cashCount = expectedClosingCash;
    existsOpen.bankBalance = expectedClosingBank;
    existsOpen.closeType = 'late';
    existsOpen.closedBy = openedBy || 'system-auto-rollover';
    existsOpen.closedAt = new Date();
    existsOpen.closeNote = `Auto late close during next day opening (${today})`;
    existsOpen.tallies = tallies;
    existsOpen.expectedClosingCash = expectedClosingCash;
    existsOpen.expectedClosingBank = expectedClosingBank;
    existsOpen.expectedTotal = expectedTotal;
    await existsOpen.save();

    await DailyLog.create({
      date: prevDate,
      portal,
      sessionId: existsOpen._id,
      action: 'close_day',
      description: `Auto late close. Cash ${expectedClosingCash}, Bank ${expectedClosingBank}`,
      amount: expectedTotal,
      by: openedBy || 'system-auto-rollover',
    });

    // If no opening amount was provided, carry forward expected closing cash
    if (openingAmount == null) {
      openingAmount = expectedClosingCash;
    }
  }

  // Determine yesterday's CLOSED session cash closing for opening adjustment postings
  let prevClosed = null;
  try {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yStr = y.toISOString().slice(0,10);
    prevClosed = await DaySession.findOne({ portal, date: yStr, status: 'closed' }).sort({ createdAt: -1 }).lean();
  } catch {}

  const session = new DaySession({
    date: today,
    portal,
    status: 'open',
    openingAmount: Math.max(0, Number(openingAmount) || 0),
    openedBy: openedBy || 'system',
    openedAt: new Date(),
    openingNote: openingNote || '',
  });
  let createdNow = false;
  try {
    await session.save();
    createdNow = true;
  } catch (e) {
    // Concurrency safety: if two requests try to open at once, the unique partial index
    // (portal + status=open) will throw E11000 for the second request.
    if (e && (e.code === 11000 || String(e.message || '').includes('E11000'))) {
      const current = await DaySession.findOne({ portal, status: 'open' }).sort({ createdAt: -1 });
      if (current && current.date === today) return current;
    }
    throw e;
  }

  if (createdNow) {
    await DailyLog.create({
      date: today,
      portal,
      sessionId: session._id,
      action: 'open_day',
      description: `Day opened with amount ${session.openingAmount}`,
      amount: session.openingAmount,
      by: openedBy || 'system',
    });
  }

  // Opening adjustment journal entry: if openingAmount differs from yesterday closed cash closing
  // This keeps audit trail of cash drawer discrepancies at start of day.
  try {
    const prevCash = Number(prevClosed?.cashCount ?? prevClosed?.closingAmount ?? prevClosed?.expectedClosingCash ?? 0);
    const openCash = Number(session.openingAmount || 0);
    const diff = Number((openCash - prevCash) || 0);
    if (createdNow && prevClosed && Math.abs(diff) > 0.01) {
      const abs = Math.abs(diff);
      const isOver = diff > 0;
      await postEntry({
        date: new Date(`${today}T00:00:00.000Z`),
        portal,
        sourceType: 'day_opening_adjustment',
        sourceId: String(session._id),
        description: `Opening cash adjustment vs yesterday closing (${prevClosed.date}). ${isOver ? 'Over' : 'Short'} ${abs.toFixed(2)}`,
        meta: {
          daySessionId: String(session._id),
          previousDate: prevClosed.date,
          previousCash: prevCash,
          openingCash: openCash,
          difference: diff,
          note: openingNote || '',
        },
        lines: isOver
          ? [
              { accountCode: CASH_CODE, debit: abs, credit: 0 },
              { accountCode: CASH_ADJ_CODE, debit: 0, credit: abs },
            ]
          : [
              { accountCode: CASH_ADJ_CODE, debit: abs, credit: 0 },
              { accountCode: CASH_CODE, debit: 0, credit: abs },
            ],
      });
    }
  } catch {}

  return session;
}

export async function closeDay({ portal, closingAmount, cashCount, bankBalance, closeType = 'regular', closedBy, closeNote, adjustments = [] }) {
  const session = await DaySession.findOne({ portal, status: 'open' });
  if (!session) throw new Error('No open session to close');
  const date = session.date;

  const tallies = await computeTallies({ portal, date });

  const adjTotal = (adjustments || []).reduce((s, a) => s + (a.type === 'subtract' ? -Math.abs(Number(a.amount||0)) : Math.abs(Number(a.amount||0))), 0);

  const expectedClosingCash = (session.openingAmount || 0) + (tallies.cashIn || 0) - (tallies.cashOut || 0);
  const expectedClosingBank = (tallies.bankIn || 0) - (tallies.bankOut || 0);
  const expectedTotal = expectedClosingCash + expectedClosingBank + adjTotal;

  const cashCountNum = Math.max(0, Number(cashCount || closingAmount || 0));
  const bankBalNum = Number(bankBalance || 0);
  const actualTotal = cashCountNum + bankBalNum;

  // Allow close even if mismatch; instead post an audit-safe adjustment entry
  const mismatch = Number(actualTotal - expectedTotal);
  const tolerance = 0.5;
  const mismatchAbs = Math.abs(mismatch);

  session.status = 'closed';
  session.closingAmount = Math.max(0, Number(closingAmount || cashCountNum) || 0);
  session.cashCount = cashCountNum;
  session.bankBalance = bankBalNum;
  session.closeType = closeType;
  session.closedBy = closedBy || 'system';
  session.closedAt = new Date();
  session.closeNote = closeNote || '';
  session.adjustments = adjustments || [];
  session.tallies = tallies;
  session.expectedClosingCash = expectedClosingCash;
  session.expectedClosingBank = expectedClosingBank;
  session.expectedTotal = expectedTotal;

  await session.save();

  await DailyLog.create({
    date,
    portal,
    sessionId: session._id,
    action: 'close_day',
    description: `Day closed (${closeType}). Cash ${cashCountNum}, Bank ${bankBalNum}`,
    amount: actualTotal,
    by: closedBy || 'system',
  });

  // Closing difference journal entry (Cash Short/Over)
  try {
    if (mismatchAbs > tolerance) {
      const isOver = mismatch > 0; // actual > expected
      await postEntry({
        date: new Date(`${date}T23:59:00.000Z`),
        portal,
        sourceType: 'day_closing_difference',
        sourceId: String(session._id),
        description: `Day closing difference. ${isOver ? 'Over' : 'Short'} ${mismatchAbs.toFixed(2)}`,
        meta: {
          daySessionId: String(session._id),
          expectedTotal,
          actualTotal,
          expectedClosingCash,
          expectedClosingBank,
          cashCount: cashCountNum,
          bankBalance: bankBalNum,
          adjustmentsTotal: adjTotal,
          note: closeNote || '',
        },
        // Post difference to cash adjustment account against cash in hand by default
        lines: isOver
          ? [
              { accountCode: CASH_CODE, debit: mismatchAbs, credit: 0 },
              { accountCode: CASH_ADJ_CODE, debit: 0, credit: mismatchAbs },
            ]
          : [
              { accountCode: CASH_ADJ_CODE, debit: mismatchAbs, credit: 0 },
              { accountCode: CASH_CODE, debit: 0, credit: mismatchAbs },
            ],
      });

      // Also record a DailyLog item so Day Session reports show it clearly
      await DailyLog.create({
        date,
        portal,
        sessionId: session._id,
        action: 'day_closing_difference',
        description: `Posted Cash Short/Over adjustment: ${isOver ? 'Over' : 'Short'} ${mismatchAbs.toFixed(2)}`,
        amount: mismatch,
        by: closedBy || 'system',
      });
    }
  } catch {}

  return session;
}

export default {
  openDay,
  closeDay,
  computeTallies,
  getTodaySession,
};
