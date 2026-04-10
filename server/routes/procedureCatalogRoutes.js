import express from 'express';
import ProcedureItem from '../models/ProcedureItem.js';

const router = express.Router();

// List all procedure catalog items
router.get('/', async (req, res) => {
  try {
    const items = await ProcedureItem.find({ active: true }).sort({ mainCategory: 1, subCategory: 1, drug: 1 });
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Bulk upsert catalog items
router.post('/bulk', async (req, res) => {
  try {
    const items = Array.isArray(req.body) ? req.body : [];
    const results = [];
    for (const raw of items) {
      const payload = {
        mainCategory: (raw.mainCategory || '').trim(),
        subCategory: (raw.subCategory || '').trim(),
        drug: (raw.drug || '').trim(),
        unit: (raw.unit || '').trim(),
        defaultAmount: Number(raw.defaultAmount || raw.amount || 0),
        defaultQuantity: Number(raw.defaultQuantity || 1),
        active: raw.active !== false,
      };
      if (!payload.mainCategory || !payload.subCategory || !payload.drug) continue;
      const up = await ProcedureItem.findOneAndUpdate(
        { mainCategory: payload.mainCategory, subCategory: payload.subCategory, drug: payload.drug },
        { $setOnInsert: payload, $set: { unit: payload.unit, defaultAmount: payload.defaultAmount, defaultQuantity: payload.defaultQuantity, active: payload.active } },
        { upsert: true, new: true }
      );
      results.push(up);
    }
    res.json({ success: true, count: results.length });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Create a new procedure catalog item
router.post('/', async (req, res) => {
  try {
    const payload = {
      mainCategory: (req.body.mainCategory || '').trim(),
      subCategory: (req.body.subCategory || '').trim(),
      drug: (req.body.drug || '').trim(),
      unit: (req.body.unit || '').trim(),
      defaultAmount: Number(req.body.defaultAmount || 0),
      defaultQuantity: Number(req.body.defaultQuantity || 1),
      active: req.body.active !== false,
    };

    if (!payload.mainCategory || !payload.subCategory || !payload.drug) {
      return res.status(400).json({ success: false, message: 'mainCategory, subCategory and drug are required' });
    }

    const created = await ProcedureItem.create(payload);
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: 'Item already exists' });
    }
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update an existing item
router.put('/:id', async (req, res) => {
  try {
    const update = { ...req.body };
    const item = await ProcedureItem.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Soft delete (deactivate)
router.delete('/:id', async (req, res) => {
  try {
    const item = await ProcedureItem.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
