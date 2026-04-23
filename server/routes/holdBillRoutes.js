import express from 'express';
import HoldBill from '../models/HoldBill.js';

const router = express.Router();

// Get all held bills
router.get('/', async (req, res) => {
  try {
    const heldBills = await HoldBill.find().sort({ createdAt: -1 });
    res.json({ success: true, data: heldBills });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create a new held bill
router.post('/', async (req, res) => {
  try {
    const { cart, customerInfo, ...rest } = req.body;
    
    // Generate a simple hold ID if not provided
    const holdId = `HOLD-${Date.now()}`;
    
    const holdBill = new HoldBill({
      holdId,
      cart,
      customerInfo,
      ...rest
    });
    
    await holdBill.save();
    res.status(201).json({ success: true, data: holdBill });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get a specific held bill
router.get('/:id', async (req, res) => {
  try {
    const holdBill = await HoldBill.findById(req.params.id);
    if (!holdBill) {
      return res.status(404).json({ success: false, message: 'Held bill not found' });
    }
    res.json({ success: true, data: holdBill });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete a held bill (after it's been resumed or cancelled)
router.delete('/:id', async (req, res) => {
  try {
    const holdBill = await HoldBill.findByIdAndDelete(req.params.id);
    if (!holdBill) {
      return res.status(404).json({ success: false, message: 'Held bill not found' });
    }
    res.json({ success: true, message: 'Held bill deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
