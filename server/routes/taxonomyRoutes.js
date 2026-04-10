import express from 'express';
import Taxonomy from '../models/Taxonomy.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const list = await Taxonomy.find({}).sort({ commonName: 1 });
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { commonName, speciesName } = req.body || {};
    if (!commonName || !speciesName) {
      return res.status(400).json({ success: false, message: 'commonName and speciesName are required' });
    }
    const updated = await Taxonomy.findOneAndUpdate(
      { commonName: commonName.trim() },
      { commonName: commonName.trim(), speciesName: speciesName.trim() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Taxonomy.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
