import express from 'express';
import MedicalForm from '../models/MedicalForm.js';

const router = express.Router();

// Get all medical forms
router.get('/', async (req, res) => {
  try {
    const forms = await MedicalForm.find().sort({ createdAt: -1 });
    res.json({ success: true, data: forms });
  } catch (error) {
    console.error('Error fetching medical forms:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get medical forms by patient ID
router.get('/patient/:patientId', async (req, res) => {
  try {
    const forms = await MedicalForm.find({ patientId: req.params.patientId }).sort({ createdAt: -1 });
    res.json({ success: true, data: forms });
  } catch (error) {
    console.error('Error fetching patient medical forms:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get medical form by ID
router.get('/:id', async (req, res) => {
  try {
    const form = await MedicalForm.findById(req.params.id);
    if (!form) {
      return res.status(404).json({ success: false, message: 'Medical form not found' });
    }
    res.json({ success: true, data: form });
  } catch (error) {
    console.error('Error fetching medical form:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create new medical form
router.post('/', async (req, res) => {
  try {
    const form = new MedicalForm(req.body);
    await form.save();
    res.status(201).json({ success: true, data: form });
  } catch (error) {
    console.error('Error creating medical form:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update medical form
router.put('/:id', async (req, res) => {
  try {
    const form = await MedicalForm.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );
    if (!form) {
      return res.status(404).json({ success: false, message: 'Medical form not found' });
    }
    res.json({ success: true, data: form });
  } catch (error) {
    console.error('Error updating medical form:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete medical form
router.delete('/:id', async (req, res) => {
  try {
    const form = await MedicalForm.findByIdAndDelete(req.params.id);
    if (!form) {
      return res.status(404).json({ success: false, message: 'Medical form not found' });
    }
    res.json({ success: true, message: 'Medical form deleted successfully' });
  } catch (error) {
    console.error('Error deleting medical form:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
