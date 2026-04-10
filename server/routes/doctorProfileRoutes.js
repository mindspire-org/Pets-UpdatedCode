import express from 'express';
import DoctorProfile from '../models/DoctorProfile.js';

const router = express.Router();

// Get all doctor profiles (default)
router.get('/', async (req, res) => {
  try {
    const profiles = await DoctorProfile.find({}).sort({ name: 1, username: 1 });
    res.json({ success: true, data: profiles });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Explicit list endpoint for clients expecting /list
router.get('/list', async (req, res) => {
  try {
    const profiles = await DoctorProfile.find({}).sort({ name: 1, username: 1 });
    res.json({ success: true, data: profiles });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get doctor profile by username
router.get('/:username', async (req, res) => {
  try {
    const profile = await DoctorProfile.findOne({ username: req.params.username });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }
    res.json({ success: true, data: profile });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create or update doctor profile
router.post('/', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ success: false, message: 'Username is required' });
    }

    const profile = await DoctorProfile.findOneAndUpdate(
      { username },
      req.body,
      { new: true, upsert: true, runValidators: true }
    );
    
    res.json({ success: true, data: profile });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update doctor profile
router.put('/:username', async (req, res) => {
  try {
    const profile = await DoctorProfile.findOneAndUpdate(
      { username: req.params.username },
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }
    
    res.json({ success: true, data: profile });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update doctor signature
router.put('/:username/signature', async (req, res) => {
  try {
    const { signature } = req.body;
    const profile = await DoctorProfile.findOneAndUpdate(
      { username: req.params.username },
      { signature },
      { new: true, upsert: true }
    );
    
    res.json({ success: true, data: profile });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete doctor profile
router.delete('/:username', async (req, res) => {
  try {
    const profile = await DoctorProfile.findOneAndDelete({ username: req.params.username });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }
    res.json({ success: true, message: 'Profile deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
