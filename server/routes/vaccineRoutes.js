import express from 'express';
import Vaccine from '../models/Vaccine.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const vaccines = await Vaccine.find().sort({ createdAt: -1 });
    res.json({ success: true, data: vaccines });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const vaccine = await Vaccine.findOne({ id: req.params.id });
    if (!vaccine) {
      return res.status(404).json({ success: false, message: 'Vaccine not found' });
    }
    res.json({ success: true, data: vaccine });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const vaccine = new Vaccine(req.body);
    await vaccine.save();
    res.status(201).json({ success: true, data: vaccine });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const vaccine = await Vaccine.findOneAndUpdate(
      { id: req.params.id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!vaccine) {
      return res.status(404).json({ success: false, message: 'Vaccine not found' });
    }
    res.json({ success: true, data: vaccine });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const vaccine = await Vaccine.findOneAndDelete({ id: req.params.id });
    if (!vaccine) {
      return res.status(404).json({ success: false, message: 'Vaccine not found' });
    }
    res.json({ success: true, message: 'Vaccine deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
