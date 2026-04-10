import express from 'express';
import RadiologyReport from '../models/RadiologyReport.js';
import dayGuard from '../middleware/dayGuard.js';
import DailyLog from '../models/DailyLog.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const reports = await RadiologyReport.find().sort({ reportDate: -1 });
    res.json({ success: true, data: reports });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const report = await RadiologyReport.findOne({ id: req.params.id });
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', dayGuard('lab'), async (req, res) => {
  try {
    const report = new RadiologyReport(req.body);
    await report.save();
    try {
      await DailyLog.create({
        date: new Date().toISOString().slice(0,10),
        portal: 'lab',
        sessionId: req.daySession?._id,
        action: 'radiology_report_create',
        refType: 'radiology_report',
        refId: report.id || String(report._id),
        description: `Radiology report ${report.id || ''}`,
        amount: 0,
      });
    } catch {}
    res.status(201).json({ success: true, data: report });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const report = await RadiologyReport.findOneAndUpdate({ id: req.params.id }, req.body, { new: true, runValidators: true });
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const report = await RadiologyReport.findOneAndDelete({ id: req.params.id });
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, message: 'Report deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
