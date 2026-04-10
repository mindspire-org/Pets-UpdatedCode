import express from 'express';
import Financial from '../models/Financial.js';
import { postFinancialRecord } from '../utils/accountingService.js';
import dayGuard from '../middleware/dayGuard.js';
import DailyLog from '../models/DailyLog.js';

const router = express.Router();
router.get('/', async (req, res) => {
  try {
    const records = await Financial.find().sort({ date: -1 });
    res.json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.get('/:id', async (req, res) => {
  try {
    const record = await Financial.findOne({ id: req.params.id });
    if (!record) return res.status(404).json({ success: false, message: 'Record not found' });
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.post('/', dayGuard(req => req.body.portal || 'admin'), async (req, res) => {
  try {
    const record = new Financial(req.body);
    if (!record.id) {
      record.id = `fin_${Date.now()}`;
    }
    await record.save();

    // Fire-and-forget accounting posting; errors are logged but do not block main response
    try {
      await postFinancialRecord(record.toObject());
    } catch (e) {
      console.error('Accounting posting failed for Financial record', e?.message || e);
    }

    try {
      await DailyLog.create({
        date: new Date().toISOString().slice(0,10),
        portal: record.portal || 'admin',
        sessionId: req.daySession?._id,
        action: 'financial_create',
        refType: 'financial',
        refId: record.id,
        description: `${record.type} - ${record.category}`,
        amount: record.amount,
      });
    } catch {}

    res.status(201).json({ success: true, data: record });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});
router.put('/:id', dayGuard(req => req.body.portal || 'admin'), async (req, res) => {
  try {
    const record = await Financial.findOneAndUpdate({ id: req.params.id }, req.body, { new: true, runValidators: true });
    if (!record) return res.status(404).json({ success: false, message: 'Record not found' });
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});
router.delete('/:id', dayGuard(req => req.query.portal || 'admin'), async (req, res) => {
  try {
    const record = await Financial.findOneAndDelete({ id: req.params.id });
    if (!record) return res.status(404).json({ success: false, message: 'Record not found' });
    res.json({ success: true, message: 'Record deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
export default router;
