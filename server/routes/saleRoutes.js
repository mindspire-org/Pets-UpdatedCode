import express from 'express';
import Sale from '../models/Sale.js';
import Product from '../models/Product.js';
import ShopCustomer from '../models/ShopCustomer.js';
import { postEntry, postShopSale } from '../utils/accountingService.js';
import dayGuard from '../middleware/dayGuard.js';
import Receivable from '../models/Receivable.js';
import DailyLog from '../models/DailyLog.js';

const router = express.Router();

// Get all sales
router.get('/', async (req, res) => {
  try {
    const sales = await Sale.find().sort({ createdAt: -1 });
    res.json({ success: true, data: sales });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get sales by date range
router.get('/date-range', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (!isNaN(start)) start.setHours(0, 0, 0, 0);
    if (!isNaN(end)) end.setHours(23, 59, 59, 999);
    const sales = await Sale.find({
      createdAt: {
        $gte: isNaN(start) ? undefined : start,
        $lte: isNaN(end) ? undefined : end
      }
    }).sort({ createdAt: -1 });
    res.json({ success: true, data: sales });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get today's sales
router.get('/today', async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const sales = await Sale.find({
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    });
    res.json({ success: true, data: sales });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get sale by ID
router.get('/:id', async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale not found' });
    }
    res.json({ success: true, data: sale });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create sale (with stock update)
router.post('/', dayGuard('shop'), async (req, res) => {
  try {
    const { items, customerName, customerContact, ...saleData } = req.body;

    // Validate stock availability and compute totalCost
    let totalCost = 0;
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({ 
          success: false, 
          message: `Product ${item.itemName} not found` 
        });
      }
      if (product.quantity < item.quantity) {
        return res.status(400).json({ 
          success: false, 
          message: `Insufficient stock for ${product.itemName}. Available: ${product.quantity}` 
        });
      }
      const unitCost = product.purchasePrice || 0;
      totalCost += unitCost * item.quantity;
    }

    // Generate invoice number
    const count = await Sale.countDocuments();
    const timestamp = Date.now();
    const randomNum = Math.floor(Math.random() * 1000);
    const invoiceNumber = `INV-${timestamp}-${count + 1}-${randomNum}`;

    // Create sale
    const sale = new Sale({
      ...saleData,
      items,
      customerName,
      customerContact,
      invoiceNumber,
      totalCost: Math.max(0, Number(totalCost) || 0),
    });
    await sale.save();

    // Create Receivable if there is a balance due
    try {
      const totalAmount = Number(sale.totalAmount || 0);
      const receivedAmount = Number(sale.receivedAmount || 0);
      const receivableCurrent = Math.max(0, totalAmount - Math.max(0, Math.min(receivedAmount, totalAmount)));
      if (receivableCurrent > 0) {
        await Receivable.create({
          portal: 'shop',
          customerId: sale.customerId || undefined,
          customerName: sale.customerName || undefined,
          refType: 'shop_sale',
          refId: String(sale._id),
          billDate: sale.createdAt,
          description: `Sale ${sale.invoiceNumber}`,
          totalAmount: receivableCurrent,
          balance: receivableCurrent,
          status: 'open',
        });
      }
    } catch (e) {
      console.warn('Receivable create failed for Sale', e?.message || e);
    }

    try {
      await postShopSale(sale.toObject());
    } catch (e) {
      console.error('Accounting posting failed for Sale', e && e.message ? e.message : e);
    }

    // Update product stock
    for (const item of items) {
      await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { quantity: -item.quantity } }
      );
    }

    // Update customer record if contact provided
    if (customerContact) {
      let customer = await ShopCustomer.findOne({ contact: customerContact });
      
      if (!customer && customerName) {
        customer = new ShopCustomer({
          customerName,
          contact: customerContact
        });
      }

      if (customer) {
        customer.purchaseHistory.push({
          saleId: sale._id,
          invoiceNumber: sale.invoiceNumber,
          amount: sale.totalAmount,
          items: items.length,
          purchaseDate: sale.createdAt
        });
        customer.totalSpent += sale.totalAmount;
        await customer.save();
      }
    }

    try {
      await DailyLog.create({
        date: new Date().toISOString().slice(0,10),
        portal: 'shop',
        sessionId: req.daySession?._id,
        action: 'shop_sale',
        refType: 'sale',
        refId: String(sale._id),
        description: `Sale ${sale.invoiceNumber}`,
        amount: sale.totalAmount,
      });
    } catch {}

    res.status(201).json({ success: true, data: sale });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Recover pending payment for a sale
router.post('/:id/recover', dayGuard('shop'), async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, paymentMethod = 'Cash', paymentDetails } = req.body || {};
    const sale = await Sale.findById(id);
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found' });

    const amt = Math.max(0, Number(amount) || 0);
    if (amt <= 0) return res.status(400).json({ success: false, message: 'amount must be > 0' });

    const pending = Math.max(0, Number(sale.balanceDue || 0));
    if (amt > pending) return res.status(400).json({ success: false, message: 'amount exceeds pending balance' });

    sale.receivedAmount = Math.max(0, Number(sale.receivedAmount || 0)) + amt;
    sale.balanceDue = Math.max(0, pending - amt);
    sale.recoveryPayments.push({
      amount: amt,
      paymentMethod,
      paymentDetails: {
        ...(paymentDetails || {}),
        method: (paymentDetails && paymentDetails.method) || paymentMethod,
      },
      recoveredAt: new Date()
    });
    await sale.save();

    // Update corresponding receivable if present
    try {
      const r = await Receivable.findOne({ portal: 'shop', refType: 'shop_sale', refId: String(sale._id), status: 'open' });
      if (r) {
        const applyAmt = Math.min(Math.max(0, amt), Math.max(0, Number(r.balance || 0)));
        if (applyAmt > 0) {
          r.balance = Math.max(0, Number(r.balance || 0) - applyAmt);
          r.allocations.push({ paymentId: `sale_recover_${Date.now()}`, amount: applyAmt, date: new Date() });
          if (r.balance <= 0.0001) { r.balance = 0; r.status = 'closed'; }
          await r.save();
        }
      }
    } catch (e) {
      console.warn('Receivable update failed for sale recover', e?.message || e);
    }

    try {
      await postEntry({
        date: new Date(),
        portal: 'shop',
        sourceType: 'shop_sale_recover',
        sourceId: String(sale._id),
        description: `Recovered payment for ${sale.invoiceNumber}`,
        meta: { customerId: sale.customerId, extra: { paymentMethod } },
        lines: [
          { accountCode: paymentMethod && String(paymentMethod).toLowerCase().includes('bank') ? '1002' : '1001', debit: amt, credit: 0 },
          { accountCode: '1100', debit: 0, credit: amt },
        ],
      });
    } catch (e) {
      console.warn('Accounting entry failed for sale recover', e?.message || e);
    }

    try {
      await DailyLog.create({
        date: new Date().toISOString().slice(0,10),
        portal: 'shop',
        sessionId: req.daySession?._id,
        action: 'shop_sale_recover',
        refType: 'sale',
        refId: String(sale._id),
        description: `Recovered Rs${amt} for ${sale.invoiceNumber}`,
        amount: amt,
      });
    } catch {}

    res.json({ success: true, data: sale });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete sale (restore stock)
router.delete('/:id', dayGuard('shop'), async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale not found' });
    }

    // Restore stock
    for (const item of sale.items) {
      await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { quantity: item.quantity } }
      );
    }

    await Sale.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Sale deleted and stock restored' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get sales statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todaySales, totalSales, recentSales] = await Promise.all([
      Sale.find({ createdAt: { $gte: today } }),
      Sale.countDocuments(),
      Sale.find().sort({ createdAt: -1 }).limit(10)
    ]);

    const todayRevenue = todaySales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const totalRevenue = await Sale.aggregate([
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    res.json({
      success: true,
      data: {
        todaySales: todaySales.length,
        todayRevenue,
        totalSales,
        totalRevenue: totalRevenue[0]?.total || 0,
        recentSales
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
