import express from 'express';
import PetShopHoldBill from '../models/PetShopHoldBill.js';

const router = express.Router();

// Get all held bills for Pet Shop
router.get('/', async (req, res) => {
  try {
    const heldBills = await PetShopHoldBill.find().sort({ createdAt: -1 });
    res.json({ success: true, data: heldBills });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create a new held bill for Pet Shop
router.post('/', async (req, res) => {
  try {
    const { cart, customerInfo, ...rest } = req.body;
    
    // Generate a simple hold ID if not provided
    const holdId = `PS-HOLD-${Date.now()}`;
    
    const holdBill = new PetShopHoldBill({
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

// Delete a held bill (after it's been resumed or cancelled)
router.delete('/:id', async (req, res) => {
  try {
    const holdBill = await PetShopHoldBill.findByIdAndDelete(req.params.id);
    if (!holdBill) {
      return res.status(404).json({ success: false, message: 'Held bill not found' });
    }
    res.json({ success: true, message: 'Held bill deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
