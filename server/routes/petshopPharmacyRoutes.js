import express from 'express';
import mongoose from 'mongoose';
import PetshopPharmacyMedicine from '../models/PetshopPharmacyMedicine.js';
import PetshopPharmacySale from '../models/PetshopPharmacySale.js';
import PetshopPharmacyPurchase from '../models/PetshopPharmacyPurchase.js';
import PetshopPharmacyDue from '../models/PetshopPharmacyDue.js';
import PetshopPharmacyCreditCustomer from '../models/PetshopPharmacyCreditCustomer.js';
import PetshopNotification from '../models/PetshopNotification.js';
import Sequence from '../models/Sequence.js';
import { postShopSale } from '../utils/accountingService.js';

const router = express.Router();

// Atomic, collision-free invoice number generator (replaces the random
// PS-<timestamp>-<count>-<rand> scheme that could clash with the unique
// index and abort the sale AFTER inventory had already been decreased).
const fmtSeq = (n) => String(n).padStart(6, '0');
const nextPetshopInvoiceNo = async () => {
  const y = new Date().getFullYear();
  const key = `petshop-sale-invoice:${y}`;
  const seqDoc = await Sequence.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `PS-${y}-${fmtSeq(seqDoc.seq || 0)}`;
};

// ==================== DUES (CLIENT PREVIOUS BALANCE) ====================

router.get('/dues', async (req, res) => {
  try {
    const records = await PetshopPharmacyDue.find().sort({ updatedAt: -1, createdAt: -1 });
    res.json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/dues/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    if (!clientId) return res.status(400).json({ success: false, message: 'clientId is required' });
    const row = await PetshopPharmacyDue.findOne({ clientId });
    res.json({ success: true, data: row || { clientId, previousDue: 0, totalPaid: 0 } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/dues/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const payload = {
      previousDue: Math.max(0, Number(req.body?.previousDue || 0)),
      totalPaid: Math.max(0, Number(req.body?.totalPaid || 0)),
      name: req.body?.name || '',
      customerContact: req.body?.customerContact || '',
    };
    const updated = await PetshopPharmacyDue.findOneAndUpdate(
      { clientId },
      { $set: { ...payload, clientId } },
      { new: true, upsert: true }
    );
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== MEDICINE ROUTES ====================

router.get('/medicines/find-by-barcode/:barcode', async (req, res) => {
  try {
    const barcode = String(req.params.barcode || '').trim();
    if (!barcode) return res.status(400).json({ success: false, message: 'Barcode is required' });
    const medicine = await PetshopPharmacyMedicine.findOne({ barcode });
    if (!medicine) return res.status(404).json({ success: false, message: 'Medicine not found' });
    res.json({ success: true, data: medicine });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/medicines', async (req, res) => {
  try {
    const medicines = await PetshopPharmacyMedicine.find({ isActive: true }).sort({ createdAt: -1 });
    res.json({ success: true, data: medicines });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/medicines/:id', async (req, res) => {
  try {
    const medicine = await PetshopPharmacyMedicine.findById(req.params.id);
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found' });
    }
    res.json({ success: true, data: medicine });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/medicines/search/:query', async (req, res) => {
  try {
    const query = req.params.query;
    const medicines = await PetshopPharmacyMedicine.find({
      isActive: true,
      $or: [
        { medicineName: { $regex: query, $options: 'i' } },
        { barcode: query }
      ]
    });
    res.json({ success: true, data: medicines });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/medicines/alerts/low-stock', async (req, res) => {
  try {
    const medicines = await PetshopPharmacyMedicine.find({ isActive: true });
    const lowStock = medicines.filter(med => med.quantity <= med.lowStockThreshold);
    res.json({ success: true, data: lowStock });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/medicines/alerts/expiring', async (req, res) => {
  try {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const medicines = await PetshopPharmacyMedicine.find({
      isActive: true,
      expiryDate: {
        $gte: new Date(),
        $lte: thirtyDaysFromNow
      }
    }).sort({ expiryDate: 1 });

    res.json({ success: true, data: medicines });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/medicines/alerts/expired', async (req, res) => {
  try {
    const medicines = await PetshopPharmacyMedicine.find({
      isActive: true,
      expiryDate: { $lt: new Date() }
    }).sort({ expiryDate: -1 });

    res.json({ success: true, data: medicines });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/medicines', async (req, res) => {
  try {
    const medicine = new PetshopPharmacyMedicine(req.body);
    await medicine.save();
    res.status(201).json({ success: true, data: medicine });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Medicine with this batch number already exists'
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/medicines/:id', async (req, res) => {
  try {
    const medicine = await PetshopPharmacyMedicine.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found' });
    }
    res.json({ success: true, data: medicine });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/medicines/:id', async (req, res) => {
  try {
    const medicine = await PetshopPharmacyMedicine.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found' });
    }
    res.json({ success: true, message: 'Medicine deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== SALES ROUTES ====================

router.get('/sales', async (req, res) => {
  try {
    const sales = await PetshopPharmacySale.find().sort({ createdAt: -1 });
    res.json({ success: true, data: sales });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/sales/date-range/:startDate/:endDate', async (req, res) => {
  try {
    const { startDate, endDate } = req.params;
    const sales = await PetshopPharmacySale.find({
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate + 'T23:59:59.999Z')
      }
    }).sort({ createdAt: -1 });
    res.json({ success: true, data: sales });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/sales/:id', async (req, res) => {
  try {
    const sale = await PetshopPharmacySale.findById(req.params.id)
      .populate('prescriptionId')
      .populate('items.medicineId');
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale not found' });
    }
    res.json({ success: true, data: sale });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/sales', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { items, ...saleData } = req.body;

    // 1) Validate all items & stock availability BEFORE making any changes.
    //    This prevents the "payment failed but inventory decreased" scenario:
    //    if any item is invalid or out of stock we abort before touching stock.
    const medicineDocs = [];
    for (const item of items) {
      const quantity = parseFloat(item.quantity);
      if (isNaN(quantity) || quantity <= 0) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `Invalid quantity for ${item.medicineName}`
        });
      }

      const medicine = await PetshopPharmacyMedicine.findById(item.medicineId).session(session);

      if (!medicine) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          success: false,
          message: `Medicine ${item.medicineName} not found`
        });
      }

      if (medicine.quantity < quantity) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${medicine.medicineName}. Available: ${medicine.quantity}`
        });
      }
      medicineDocs.push({ medicine, quantity, item });
    }

    // 2) Generate a deterministic, collision-free invoice number up front so
    //    the sale document saves cleanly (the model's pre-save hook used a
    //    random suffix that could collide with the unique index).
    if (!saleData.invoiceNumber) {
      saleData.invoiceNumber = await nextPetshopInvoiceNo();
    }

    // 3) Create the sale record first. If this fails (validation, duplicate
    //    invoice, etc.) the transaction aborts and NO inventory is changed.
    const sale = new PetshopPharmacySale({ items, ...saleData });
    await sale.save({ session });

    // 4) Only after the sale is persisted do we decrease inventory. Both
    //    operations are in the same transaction so they commit together.
    for (const { medicine, quantity, item } of medicineDocs) {
      medicine.quantity -= quantity;

      if (medicine.category === 'Injection' && item.mlUsed) {
        const mlUsed = parseFloat(item.mlUsed);
        if (!isNaN(mlUsed) && mlUsed > 0) {
          if (!medicine.remainingMl && medicine.mlPerVial) {
            medicine.remainingMl = medicine.mlPerVial * medicine.quantity;
          }

          if (medicine.remainingMl >= mlUsed) {
            medicine.remainingMl -= mlUsed;
            item.remainingMlAfterSale = medicine.remainingMl;
          }
        }
      }

      await medicine.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    // Post-commit side effects (non-critical)
    try {
      await PetshopNotification.create({
        portal: "shop",
        type: "sale",
        severity: "info",
        title: "New Sale",
        message: `Sale created: ${sale.invoiceNumber || sale._id} · PKR ${Number(sale.totalAmount || 0).toFixed(2)}`,
        relatedId: sale._id,
        relatedModel: "PetshopPharmacySale",
        meta: {
          invoiceNumber: sale.invoiceNumber,
          totalAmount: sale.totalAmount,
          customerName: sale.customerName,
          customerContact: sale.customerContact,
        },
        createdBy: sale.soldBy || "System",
      });
    } catch (e) {
      console.error(
        "Failed to create sale notification (petshop)",
        e && e.message ? e.message : e,
      );
    }

    try {
      await postShopSale(sale.toObject());
    } catch (e) {
      console.error('Accounting posting failed for PetshopPharmacySale', e && e.message ? e.message : e);
    }

    res.status(201).json({ success: true, data: sale });
  } catch (error) {
    await session.abortTransaction().catch(() => {});
    session.endSession();
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/sales/:id', async (req, res) => {
  try {
    const sale = await PetshopPharmacySale.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale not found' });
    }
    res.json({ success: true, data: sale });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/sales/:id', async (req, res) => {
  try {
    const sale = await PetshopPharmacySale.findByIdAndDelete(req.params.id);
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale not found' });
    }
    res.json({ success: true, message: 'Sale deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== PURCHASE ROUTES ====================

router.get('/purchases', async (req, res) => {
  try {
    const purchases = await PetshopPharmacyPurchase.find().sort({ createdAt: -1 });
    res.json({ success: true, data: purchases });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/purchases/:id', async (req, res) => {
  try {
    const purchase = await PetshopPharmacyPurchase.findById(req.params.id);
    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase not found' });
    }
    res.json({ success: true, data: purchase });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/purchases', async (req, res) => {
  try {
    const purchase = new PetshopPharmacyPurchase(req.body);
    await purchase.save();
    res.status(201).json({ success: true, data: purchase });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/purchases/:id', async (req, res) => {
  try {
    const purchase = await PetshopPharmacyPurchase.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase not found' });
    }
    res.json({ success: true, data: purchase });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/purchases/:id', async (req, res) => {
  try {
    const purchase = await PetshopPharmacyPurchase.findByIdAndDelete(req.params.id);
    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase not found' });
    }
    res.json({ success: true, message: 'Purchase deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== CREDIT CUSTOMERS ====================

router.get('/credit-customers', async (req, res) => {
  try {
    const customers = await PetshopPharmacyCreditCustomer.find({ isActive: true }).sort({ createdAt: -1 });
    res.json({ success: true, data: customers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/credit-customers/:id', async (req, res) => {
  try {
    const customer = await PetshopPharmacyCreditCustomer.findById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/credit-customers', async (req, res) => {
  try {
    const { name, phone, cnic, address } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
    const customer = new PetshopPharmacyCreditCustomer({ name, phone, cnic, address });
    await customer.save();
    res.status(201).json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/credit-customers/:id', async (req, res) => {
  try {
    const { name, phone, cnic, address, totalDue, totalPaid } = req.body;
    const updated = await PetshopPharmacyCreditCustomer.findByIdAndUpdate(
      req.params.id,
      { $set: { name, phone, cnic, address, totalDue, totalPaid } },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/credit-customers/:id/sales', async (req, res) => {
  try {
    const customer = await PetshopPharmacyCreditCustomer.findById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

    const sales = await PetshopPharmacySale.find({
      paymentMethod: 'Credit',
      $or: [
        { customerCnic: customer.cnic },
        { customerContact: customer.phone },
        { customerName: customer.name },
      ],
    }).sort({ createdAt: -1 }).lean();

    const receipts = sales.map(s => ({
      _id: s._id,
      invoiceNumber: s.invoiceNumber,
      createdAt: s.createdAt,
      totalAmount: s.totalAmount || 0,
      receivedAmount: s.receivedAmount || 0,
      balanceDue: s.balanceDue || 0,
      remaining: Math.max(0, (s.totalAmount || 0) - (s.receivedAmount || 0)),
    }));

    res.json({ success: true, data: receipts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/credit-customers/:id/pay', async (req, res) => {
  try {
    const { amount, notes, invoiceNumber, receiptPayAmounts } = req.body;
    const paid = Math.max(0, Number(amount) || 0);
    const customer = await PetshopPharmacyCreditCustomer.findById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    customer.totalPaid = (customer.totalPaid || 0) + paid;
    customer.totalDue = Math.max(0, (customer.totalDue || 0) - paid);

    customer.paymentHistory.push({
      amount: paid,
      notes: notes || '',
      invoiceNumber: invoiceNumber || '',
      paidAt: new Date(),
    });
    await customer.save();

    if (receiptPayAmounts && typeof receiptPayAmounts === 'object') {
      for (const [saleId, amtStr] of Object.entries(receiptPayAmounts)) {
        const amt = Number(amtStr) || 0;
        if (amt <= 0) continue;
        try {
          const sale = await PetshopPharmacySale.findById(saleId);
          if (sale) {
            sale.receivedAmount = (sale.receivedAmount || 0) + amt;
            sale.balanceDue = Math.max(0, (sale.totalAmount || 0) - sale.receivedAmount);
            await sale.save();
          }
        } catch {}
      }
    }

    res.json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/credit-customers/:id/payment-history', async (req, res) => {
  try {
    const customer = await PetshopPharmacyCreditCustomer.findById(req.params.id).lean();
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    const history = (customer.paymentHistory || []).sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/credit-customers/:id', async (req, res) => {
  try {
    const deleted = await PetshopPharmacyCreditCustomer.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive: false } },
      { new: true }
    );
    if (!deleted) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, message: 'Customer deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
