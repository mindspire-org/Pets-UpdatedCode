import express from 'express';
import LabTest from '../models/LabTest.js';
const router = express.Router();
router.get('/', async (req, res) => {
  try {
    const tests = await LabTest.find().sort({ createdAt: -1 });
    res.json({ success: true, data: tests });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.get('/:id', async (req, res) => {
  try {
    const test = await LabTest.findOne({ id: req.params.id });
    if (!test) return res.status(404).json({ success: false, message: 'Test not found' });
    res.json({ success: true, data: test });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
// normalize helper
const normalizeSpeciesRanges = (speciesRanges = [], legacy = {}) => {
  const normalize = (t='') => {
    const s = String(t || '').trim();
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const out = [];
  const seen = new Set();
  for (const s of speciesRanges || []) {
    const species = normalize(s.species);
    const range = String(s.range || '').trim();
    if (!species || !range) continue;
    if (seen.has(species)) continue;
    seen.add(species);
    out.push({ species, range });
  }
  // legacy mapping fallback
  if (legacy.rangeM && !seen.has('Cat')) out.push({ species: 'Cat', range: legacy.rangeM });
  if (legacy.rangeF && !seen.has('Dog')) out.push({ species: 'Dog', range: legacy.rangeF });
  if (legacy.rangeP && !seen.has('Horse')) out.push({ species: 'Horse', range: legacy.rangeP });
  return out;
};

router.post('/', async (req, res) => {
  try {
    const payload = { ...req.body };
    // ensure speciesRanges normalized and legacy fields synced
    const norm = normalizeSpeciesRanges(payload.speciesRanges, payload);
    payload.speciesRanges = norm;
    payload.rangeM = norm.find(s=>s.species==='Cat')?.range || payload.rangeM;
    payload.rangeF = norm.find(s=>s.species==='Dog')?.range || payload.rangeF;
    payload.rangeP = norm.find(s=>s.species==='Horse')?.range || payload.rangeP;

    const test = new LabTest(payload);
    await test.save();
    res.status(201).json({ success: true, data: test });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Backfill legacy ranges (rangeM/F/P) into speciesRanges
router.post('/backfill-species-ranges', async (req, res) => {
  try {
    const tests = await LabTest.find({});
    let updated = 0;
    for (const t of tests) {
      const hasSpecies = Array.isArray(t.speciesRanges) && t.speciesRanges.length > 0;
      const hasLegacy = t.rangeM || t.rangeF || t.rangeP;
      if (!hasSpecies && hasLegacy) {
        const speciesRanges = [];
        if (t.rangeM) speciesRanges.push({ species: 'Cat', range: t.rangeM });
        if (t.rangeF) speciesRanges.push({ species: 'Dog', range: t.rangeF });
        if (t.rangeP) speciesRanges.push({ species: 'Horse', range: t.rangeP });
        t.speciesRanges = speciesRanges;
        await t.save();
        updated++;
      }
    }
    res.json({ success: true, message: 'Backfill complete', updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.put('/:id', async (req, res) => {
  try {
    const payload = { ...req.body };
    const norm = normalizeSpeciesRanges(payload.speciesRanges, payload);
    payload.speciesRanges = norm;
    payload.rangeM = norm.find(s=>s.species==='Cat')?.range || payload.rangeM;
    payload.rangeF = norm.find(s=>s.species==='Dog')?.range || payload.rangeF;
    payload.rangeP = norm.find(s=>s.species==='Horse')?.range || payload.rangeP;

    const test = await LabTest.findOneAndUpdate(
      { id: req.params.id },
      { $set: payload },
      { new: true, runValidators: true }
    );
    if (!test) return res.status(404).json({ success: false, message: 'Test not found' });
    res.json({ success: true, data: test });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});
router.delete('/:id', async (req, res) => {
  try {
    const test = await LabTest.findOneAndDelete({ id: req.params.id });
    if (!test) return res.status(404).json({ success: false, message: 'Test not found' });
    res.json({ success: true, message: 'Test deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
export default router;
