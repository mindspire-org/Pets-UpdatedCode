import express from 'express';
import Payable from '../models/Payable.js';
import VendorPayment from '../models/VendorPayment.js';
import DailyLog from '../models/DailyLog.js';
import { getPayableAccountForPortal, postEntry } from '../utils/accountingService.js';
import dayGuard from '../middleware/dayGuard.js';

const router = express.Router();

// List payables
router.get('/', async (req, res, next) => {
  try {
    const { portal, status, supplierId, from, to } = req.query;
    const q = {};
    if (portal && portal !== 'all') q.portal = portal;
    if (status) q.status = status;
    if (supplierId) {
      // Use $or to find by either supplierId (exact match) OR supplierName (case-insensitive regex)
      q.$or = [ 
        { supplierId: supplierId }, 
        { supplierName: new RegExp(String(supplierId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } 
      ];
    }
    if (from || to) {
      q.billDate = {};
      if (from) q.billDate.$gte = new Date(`${from}T00:00:00.000Z`);
      if (to) q.billDate.$lte = new Date(`${to}T23:59:59.999Z`);
    }
    const rows = await Payable.find(q).sort({ billDate: -1 });
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

// Create payable manually
router.post('/', dayGuard(req => req.body.portal || 'admin'), async (req, res, next) => {
  try {
    const payload = req.body || {};
    payload.balance = payload.totalAmount;
    const p = new Payable(payload);
    await p.save();
    await DailyLog.create({ date: new Date().toISOString().slice(0,10), portal: p.portal, sessionId: req.daySession?._id, action: 'payable_create', refType: 'payable', refId: String(p._id), description: p.description, amount: p.totalAmount });
    res.status(201).json({ success: true, data: p });
  } catch (e) { next(e); }
});

// Allocate payment to a payable (partial allowed)
router.post('/:id/allocate', dayGuard(req => req.body.portal || 'admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount, paymentMethod = 'Cash', note } = req.body || {};
    const p = await Payable.findById(id);
    if (!p) return res.status(404).json({ success: false, message: 'Payable not found' });

    const amt = Math.max(0, Number(amount) || 0);
    if (amt <= 0) return res.status(400).json({ success: false, message: 'amount must be > 0' });
    if (amt > p.balance) return res.status(400).json({ success: false, message: 'amount exceeds payable balance' });

    // Create a VendorPayment document so it appears in the Vendor Payments list
    const vp = new VendorPayment({
      portal: p.portal,
      supplierId: p.supplierId,
      supplierName: p.supplierName,
      date: new Date(),
      amount: amt,
      paymentMethod,
      allocations: [{ payableId: p._id, amount: amt }],
      notes: note,
    });
    await vp.save();

    // Apply allocation to the payable
    p.balance -= amt;
    p.allocations.push({ paymentId: vp._id, sourceType: 'vendor_payment', sourceRef: String(vp._id), amount: amt, date: vp.date });
    if (p.balance <= 0.0001) { p.balance = 0; p.status = 'closed'; }
    await p.save();

    // Sync with Supplier model for Pharmacy/Lab/Shop portals
    if (['pharmacy', 'lab', 'shop'].includes(p.portal) && p.supplierId) {
      try {
        const Supplier = mongoose.model('Supplier');
        const updateQuery = {
          $inc: { totalPaid: amt },
          $push: {
            paymentHistory: {
              amount: amt,
              paymentMethod: paymentMethod || 'Cash',
              notes: note || `Admin Payment against bill ${p.billRef || ''}`,
              paymentDate: vp.date,
              invoiceNumber: p.billRef
            }
          }
        };

        const supplier = await Supplier.findById(p.supplierId);
        if (supplier) {
          // Also try to update specific purchase record if billRef matches
          if (p.billRef) {
            const purchase = supplier.purchaseHistory.find(ph => 
              ph.invoiceNumber && ph.invoiceNumber.toString().trim().toLowerCase() === p.billRef.toString().trim().toLowerCase()
            );
            if (purchase) {
              purchase.paidAmount = (Number(purchase.paidAmount) || 0) + amt;
              supplier.markModified('purchaseHistory');
            }
          }
          
          // Apply other updates
          supplier.totalPaid = (Number(supplier.totalPaid) || 0) + amt;
          supplier.paymentHistory.push({
            amount: amt,
            paymentMethod: paymentMethod || 'Cash',
            notes: note || `Admin Payment against bill ${p.billRef || ''}`,
            paymentDate: vp.date,
            invoiceNumber: p.billRef
          });
          
          await supplier.save();
          console.log(`Synced admin payment of ${amt} to supplier ${supplier.supplierName} (${p.portal})`);
        }
      } catch (err) {
        console.error(`Error syncing payment to Supplier (${p.portal}):`, err);
      }
    }

    const payableAccount = getPayableAccountForPortal(p.portal);
    const cashAcc = (paymentMethod || '').toLowerCase().includes('bank') ? '1002' : '1001';
    await postEntry({
      date: vp.date,
      portal: p.portal,
      sourceType: 'vendor_payment',
      sourceId: String(vp._id),
      description: note || `Payment to supplier against ${p.billRef || p.description || ''}`,
      meta: { supplierId: p.supplierId, extra: { paymentMethod } },
      lines: [
        { accountCode: payableAccount, debit: amt, credit: 0 },
        { accountCode: cashAcc, debit: 0, credit: amt },
      ],
    });

    await DailyLog.create({ date: new Date().toISOString().slice(0,10), portal: p.portal, sessionId: req.daySession?._id, action: 'vendor_payment_create', refType: 'vendor_payment', refId: String(vp._id), description: `Vendor payment ${amt}`, amount: amt });

    res.json({ success: true, data: p });
  } catch (e) { next(e); }
});

export default router;
