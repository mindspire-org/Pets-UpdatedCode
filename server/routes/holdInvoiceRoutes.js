import express from 'express';
import HoldInvoice from '../models/HoldInvoice.js';

const router = express.Router();

// Get all held invoices
router.get('/', async (req, res) => {
  try {
    const heldInvoices = await HoldInvoice.find().sort({ createdAt: -1 });
    res.json({ success: true, data: heldInvoices });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create a new held invoice
router.post('/', async (req, res) => {
  try {
    const { items, invoiceTaxes, ...rest } = req.body;
    
    // Generate a simple hold ID if not provided
    const holdId = `HOLD-INV-${Date.now()}`;
    
    const holdInvoice = new HoldInvoice({
      holdId,
      items,
      invoiceTaxes,
      ...rest
    });
    
    await holdInvoice.save();
    res.status(201).json({ success: true, data: holdInvoice });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get a specific held invoice
router.get('/:id', async (req, res) => {
  try {
    const holdInvoice = await HoldInvoice.findById(req.params.id);
    if (!holdInvoice) {
      return res.status(404).json({ success: false, message: 'Held invoice not found' });
    }
    res.json({ success: true, data: holdInvoice });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete a held invoice (after it's been resumed or cancelled)
router.delete('/:id', async (req, res) => {
  try {
    const holdInvoice = await HoldInvoice.findByIdAndDelete(req.params.id);
    if (!holdInvoice) {
      return res.status(404).json({ success: false, message: 'Held invoice not found' });
    }
    res.json({ success: true, message: 'Held invoice deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
