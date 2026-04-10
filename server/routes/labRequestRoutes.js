import express from 'express';
import LabRequest from '../models/LabRequest.js';

const router = express.Router();

// GET all lab requests
router.get('/', async (req, res) => {
  try {
    const items = await LabRequest.find().sort({ createdAt: -1 });
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET lab request by id (supports custom id or Mongo _id)
router.get('/:id', async (req, res) => {
  try {
    const q = req.params.id;
    let item = await LabRequest.findOne({ id: q });
    if (!item) item = await LabRequest.findById(q);
    if (!item) return res.status(404).json({ success: false, message: 'Request not found' });
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// CREATE lab request
router.post('/', async (req, res) => {
  try {
    const body = { ...req.body };
    if (!body.id) body.id = `INT-${Date.now()}`;
    const created = await LabRequest.create(body);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// UPDATE lab request by id
router.put('/:id', async (req, res) => {
  try {
    const q = req.params.id;
    let item = await LabRequest.findOne({ id: q });
    if (!item) item = await LabRequest.findById(q);
    if (!item) return res.status(404).json({ success: false, message: 'Request not found' });
    Object.assign(item, req.body);
    await item.save();
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE lab request by id
router.delete('/:id', async (req, res) => {
  try {
    const q = req.params.id;
    let item = await LabRequest.findOneAndDelete({ id: q });
    if (!item) item = await LabRequest.findByIdAndDelete(q);
    if (!item) return res.status(404).json({ success: false, message: 'Request not found' });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
