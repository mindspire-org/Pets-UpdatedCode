import express from 'express';
import { openDay, closeDay, getTodaySession, computeTallies } from '../utils/daySessionService.js';
import DaySession from '../models/DaySession.js';
import DailyLog from '../models/DailyLog.js';

const router = express.Router();

// GET /api/day/status?portal=
router.get('/status', async (req, res, next) => {
  try {
    const { portal } = req.query;
    if (!portal) return res.status(400).json({ success: false, message: 'portal is required' });
    const session = await getTodaySession({ portal });
    if (!session) return res.json({ success: true, data: null });
    let data = session.toObject();
    if (session.status === 'open') {
      try {
        const tallies = await computeTallies({ portal, date: session.date });
        data.tallies = tallies;
      } catch {}
    }
    res.json({ success: true, data });
  } catch (e) { next(e); }
});

// POST /api/day/open
router.post('/open', async (req, res, next) => {
  try {
    const { portal, openingAmount, openedBy, openingNote } = req.body || {};
    if (!portal) return res.status(400).json({ success: false, message: 'portal is required' });
    if (openingAmount == null) return res.status(400).json({ success: false, message: 'openingAmount is required' });
    const session = await openDay({ portal, openingAmount, openedBy, openingNote });
    res.status(201).json({ success: true, data: session });
  } catch (e) { next(e); }
});

// POST /api/day/close
router.post('/close', async (req, res, next) => {
  try {
    const { portal, closingAmount, cashCount, bankBalance, closeType, closedBy, closeNote, adjustments } = req.body || {};
    if (!portal) return res.status(400).json({ success: false, message: 'portal is required' });
    const session = await closeDay({ portal, closingAmount, cashCount, bankBalance, closeType, closedBy, closeNote, adjustments });
    res.json({ success: true, data: session });
  } catch (e) { next(e); }
});

// GET /api/day/history?portal=&from=&to=
router.get('/history', async (req, res, next) => {
  try {
    const { portal, from, to } = req.query;
    const q = {};
    if (portal && portal !== 'all') q.portal = portal;
    if (from || to) {
      q.date = {};
      if (from) q.date.$gte = from;
      if (to) q.date.$lte = to;
    }
    const items = await DaySession.find(q).sort({ date: -1, createdAt: -1 }).lean();
    res.json({ success: true, data: items });
  } catch (e) { next(e); }
});

// GET /api/day/reconciliation?portal=&date=YYYY-MM-DD
router.get('/reconciliation', async (req, res, next) => {
  try {
    const { portal, date } = req.query;
    if (!portal) return res.status(400).json({ success: false, message: 'portal is required' });
    const tallies = await computeTallies({ portal, date });
    const session = await DaySession.findOne({ portal, date }).lean();
    let expectedClosingCash = 0, expectedClosingBank = 0, expectedTotal = 0;
    if (session) {
      expectedClosingCash = (session.openingAmount || 0) + (tallies.cashIn || 0) - (tallies.cashOut || 0);
      expectedClosingBank = (tallies.bankIn || 0) - (tallies.bankOut || 0);
      const adjTotal = (session.adjustments || []).reduce((s,a)=> s + (a.type==='subtract'?-Math.abs(a.amount||0):Math.abs(a.amount||0)), 0);
      expectedTotal = expectedClosingCash + expectedClosingBank + adjTotal;
    }
    res.json({ success: true, data: { tallies, session, expectedClosingCash, expectedClosingBank, expectedTotal } });
  } catch (e) { next(e); }
});

// GET /api/day/tallies?portal=&date=
router.get('/tallies', async (req, res, next) => {
  try {
    const { portal, date } = req.query;
    if (!portal) return res.status(400).json({ success: false, message: 'portal is required' });
    const t = await computeTallies({ portal, date });
    res.json({ success: true, data: t });
  } catch (e) { next(e); }
});

// GET /api/day/logs?portal=&date=
router.get('/logs', async (req, res, next) => {
  try {
    const { portal, date } = req.query;
    if (!portal) return res.status(400).json({ success: false, message: 'portal is required' });
    const day = date || new Date().toISOString().slice(0,10);
    const logs = await DailyLog.find({ portal, date: day }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: logs });
  } catch (e) { next(e); }
});

export default router;
