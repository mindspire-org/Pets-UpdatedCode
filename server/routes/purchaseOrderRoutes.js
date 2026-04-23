import express from 'express';
import PurchaseOrder from '../models/PurchaseOrder.js';

const router = express.Router();

// GET all purchase orders for pharmacy
router.get('/', async (req, res) => {
  try {
    const orders = await PurchaseOrder.find({ portal: 'pharmacy' }).sort({ date: -1 });
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET single purchase order
router.get('/:id', async (req, res) => {
  try {
    const order = await PurchaseOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Purchase Order not found' });
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST create new purchase order
router.post('/', async (req, res) => {
  try {
    const payload = req.body;
    
    // Generate PO Number if not provided
    if (!payload.poNumber) {
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const count = await PurchaseOrder.countDocuments({
        date: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lte: new Date(new Date().setHours(23, 59, 59, 999))
        }
      });
      payload.poNumber = `PO-${today}-${String(count + 1).padStart(4, '0')}`;
    }

    const newOrder = new PurchaseOrder(payload);
    await newOrder.save();
    res.status(201).json({ success: true, data: newOrder });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// PUT update purchase order
router.put('/:id', async (req, res) => {
  try {
    const updatedOrder = await PurchaseOrder.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedOrder) return res.status(404).json({ success: false, message: 'Purchase Order not found' });
    res.json({ success: true, data: updatedOrder });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// DELETE purchase order
router.delete('/:id', async (req, res) => {
  try {
    const order = await PurchaseOrder.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Purchase Order not found' });
    res.json({ success: true, message: 'Purchase Order deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
