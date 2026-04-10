import express from 'express';
import Settings from '../models/Settings.js';
const router = express.Router();
router.get('/:userId', async (req, res) => {
  try {
    const settings = await Settings.findOne({ userId: req.params.userId });
    if (!settings) {
      return res.json({ success: true, data: {} });
    }
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.post('/', async (req, res) => {
  try {
    const settings = await Settings.findOneAndUpdate(
      { userId: req.body.userId },
      req.body,
      { new: true, upsert: true, runValidators: true }
    );
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});
router.put('/:userId', async (req, res) => {
  try {
    const settings = await Settings.findOneAndUpdate(
      { userId: req.params.userId },
      req.body,
      { new: true, upsert: true, runValidators: true }
    );
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});
export default router;
