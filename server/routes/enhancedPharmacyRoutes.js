import express from 'express';
import PharmacyMedicine from '../models/PharmacyMedicine.js';
import PharmacySale from '../models/PharmacySale.js';
import PharmacyPurchase from '../models/PharmacyPurchase.js';
import PharmacyDue from '../models/PharmacyDue.js';
import { postPharmacySale, postPharmacyPurchase } from '../utils/accountingService.js';
import dayGuard from '../middleware/dayGuard.js';
import Receivable from '../models/Receivable.js';
import DailyLog from '../models/DailyLog.js';
import Payable from '../models/Payable.js';

const router = express.Router();

// ==================== DUES (CLIENT PREVIOUS BALANCE) ====================
// Get all client dues (used for bulk summaries without per-client requests)
router.get('/dues', async (req, res) => {
  try {
    const records = await PharmacyDue.find().sort({ updatedAt: -1, createdAt: -1 });
    res.json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get client dues by clientId (used across portals)
router.get('/dues/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    if (!clientId) return res.status(400).json({ success: false, message: 'clientId is required' });
    const row = await PharmacyDue.findOne({ clientId });
    res.json({ success: true, data: row || { clientId, previousDue: 0, totalPaid: 0 } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Find a single medicine by barcode (no stock filters) for admin/import use
router.get('/medicines/find-by-barcode/:barcode', async (req, res) => {
  try {
    const barcode = String(req.params.barcode || '').trim();
    if (!barcode) return res.status(400).json({ success: false, message: 'Barcode is required' });
    const medicine = await PharmacyMedicine.findOne({ barcode });
    if (!medicine) return res.status(404).json({ success: false, message: 'Medicine not found' });
    res.json({ success: true, data: medicine });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Upsert client dues by clientId (called after creating procedures/sales to persist receivable)
router.put('/dues/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const payload = {
      previousDue: Math.max(0, Number(req.body?.previousDue || 0)),
      totalPaid: Math.max(0, Number(req.body?.totalPaid || 0)),
      name: req.body?.name || '',
      customerContact: req.body?.customerContact || '',
    };
    const updated = await PharmacyDue.findOneAndUpdate(
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

// Get all medicines with enhanced filtering for POS
router.get('/medicines', async (req, res) => {
  try {
    const medicines = await PharmacyMedicine.find({ isActive: true }).sort({ createdAt: -1 });

    // Initialize remainingMl for injections that don't have it set
    const updatedMedicines = medicines.map(medicine => {
      if (medicine.category === 'Injection' && !medicine.remainingMl && medicine.mlPerVial) {
        medicine.remainingMl = medicine.mlPerVial * medicine.quantity;
      }
      return medicine;
    });

    res.json({ success: true, data: updatedMedicines });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get medicine by ID
router.get('/medicines/:id', async (req, res) => {
  try {
    const medicine = await PharmacyMedicine.findById(req.params.id);
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found' });
    }
    res.json({ success: true, data: medicine });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Search medicines by name or barcode
router.get('/medicines/search/:query', async (req, res) => {
  try {
    const query = req.params.query;
    const medicines = await PharmacyMedicine.find({
      isActive: true,
      $or: [
        { medicineName: { $regex: query, $options: 'i' } },
        { barcode: query }
      ],
      $and: [
        {
          $or: [
            { quantity: { $gt: 0 } },
            { 
              category: 'Injection',
              $or: [
                { remainingMl: { $gt: 0 } },
                { quantity: { $gt: 0 }, remainingMl: { $exists: false } }
              ]
            }
          ]
        }
      ]
    });
    res.json({ success: true, data: medicines });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get low stock medicines
router.get('/medicines/alerts/low-stock', async (req, res) => {
  try {
    const medicines = await PharmacyMedicine.find({ isActive: true });
    const lowStock = medicines.filter(med => {
      if (med.category === 'Injection') {
        const remainingMl = med.remainingMl || (med.mlPerVial * med.quantity);
        return remainingMl <= (med.lowStockThreshold || 10);
      }
      return med.quantity <= med.lowStockThreshold;
    });
    res.json({ success: true, data: lowStock });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get expiring medicines (within 30 days)
router.get('/medicines/alerts/expiring', async (req, res) => {
  try {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    const medicines = await PharmacyMedicine.find({
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

// Get expired medicines
router.get('/medicines/alerts/expired', async (req, res) => {
  try {
    const medicines = await PharmacyMedicine.find({
      isActive: true,
      expiryDate: { $lt: new Date() }
    }).sort({ expiryDate: -1 });
    
    res.json({ success: true, data: medicines });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add new medicine
router.post('/medicines', async (req, res) => {
  try {
    const medicineData = { ...req.body };
    
    // Set original quantity for tracking
    medicineData.originalQuantity = medicineData.quantity;
    
    // For injections, initialize remainingMl
    if (medicineData.category === 'Injection' && medicineData.mlPerVial) {
      medicineData.remainingMl = medicineData.mlPerVial * medicineData.quantity;
    }
    // Validate barcode presence & uniqueness
    const barcode = String(medicineData.barcode || '').trim();
    if (!barcode) {
      return res.status(400).json({ success: false, message: 'Barcode is required' });
    }
    const dup = await PharmacyMedicine.findOne({ barcode });
    if (dup) {
      return res.status(400).json({ success: false, message: 'Medicine with this barcode already exists' });
    }

    const medicine = new PharmacyMedicine({ ...medicineData, barcode });
    await medicine.save();
    res.status(201).json({ success: true, data: medicine });
  } catch (error) {
    if (error.code === 11000) {
      const key = Object.keys(error.keyPattern || {})[0] || '';
      const msg = key === 'barcode' ? 'Medicine with this barcode already exists' : 'Medicine with this batch number already exists';
      return res.status(400).json({ success: false, message: msg });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update medicine
router.put('/medicines/:id', async (req, res) => {
  try {
    if (typeof req.body.barcode !== 'undefined') {
      const barcode = String(req.body.barcode || '').trim();
      if (!barcode) {
        return res.status(400).json({ success: false, message: 'Barcode is required' });
      }
      const exists = await PharmacyMedicine.findOne({ barcode, _id: { $ne: req.params.id } });
      if (exists) {
        return res.status(400).json({ success: false, message: 'Medicine with this barcode already exists' });
      }
      req.body.barcode = barcode;
    }
    const medicine = await PharmacyMedicine.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found' });
    }
    res.json({ success: true, data: medicine });
  } catch (error) {
    if (error.code === 11000) {
      const key = Object.keys(error.keyPattern || {})[0] || '';
      const msg = key === 'barcode' ? 'Medicine with this barcode already exists' : 'Medicine with this batch number already exists';
      return res.status(400).json({ success: false, message: msg });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete medicine (soft delete)
router.delete('/medicines/:id', async (req, res) => {
  try {
    const medicine = await PharmacyMedicine.findByIdAndUpdate(
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

// Get all sales
router.get('/sales', async (req, res) => {
  try {
    const sales = await PharmacySale.find().sort({ createdAt: -1 });
    res.json({ success: true, data: sales });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get sales by date range
router.get('/sales/date-range/:startDate/:endDate', async (req, res) => {
  try {
    const { startDate, endDate } = req.params;
    const sales = await PharmacySale.find({
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

// Get sale by ID
router.get('/sales/:id', async (req, res) => {
  try {
    const sale = await PharmacySale.findById(req.params.id)
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

// Enhanced sale creation with injection partial sale logic
router.post('/sales', dayGuard('pharmacy'), async (req, res) => {
  try {
    const { items, ...saleData } = req.body;
    
    // Validate and process each item
    const processedItems = [];
    let totalCost = 0;
    
    for (const item of items) {
      const medicine = await PharmacyMedicine.findById(item.medicineId);
      
      if (!medicine) {
        return res.status(404).json({ 
          success: false, 
          message: `Medicine ${item.medicineName} not found` 
        });
      }

      if (medicine.category === 'Injection') {
        // Handle injection partial sale
        const mlUsed = parseFloat(item.mlUsed);
        
        if (isNaN(mlUsed) || mlUsed <= 0) {
          return res.status(400).json({ 
            success: false, 
            message: `Invalid ML amount for ${item.medicineName}` 
          });
        }

        // Initialize remainingMl if not set
        if (!medicine.remainingMl && medicine.mlPerVial) {
          medicine.remainingMl = medicine.mlPerVial * medicine.quantity;
        }

        const currentRemainingMl = medicine.remainingMl || 0;
        
        if (mlUsed > currentRemainingMl) {
          return res.status(400).json({ 
            success: false, 
            message: `Only ${currentRemainingMl}ml available for ${medicine.medicineName}` 
          });
        }

        // Calculate new remaining ml
        const newRemainingMl = currentRemainingMl - mlUsed;
        
        // Update medicine stock
        medicine.remainingMl = newRemainingMl;
        
        // If batch is completely used, mark as inactive or update quantity
        if (newRemainingMl <= 0) {
          medicine.quantity = 0;
          // Keep the batch active until a new batch is added
          // This ensures the same batch continues to appear until finished
        }
        
        await medicine.save();

        // Cost for injection: use purchasePrice per ml where possible
        const purchasePricePerMl = medicine.mlPerVial && medicine.purchasePrice
          ? medicine.purchasePrice / medicine.mlPerVial
          : medicine.purchasePrice || 0;
        totalCost += purchasePricePerMl * mlUsed;

        // Add processed item
        processedItems.push({
          ...item,
          mlUsed: mlUsed,
          remainingMlAfterSale: newRemainingMl,
          quantity: 1 // For injections, quantity is always 1 vial
        });

      } else {
        // Handle regular medicine sale
        const quantity = parseFloat(item.quantity);
        
        if (isNaN(quantity) || quantity <= 0) {
          return res.status(400).json({ 
            success: false, 
            message: `Invalid quantity for ${item.medicineName}` 
          });
        }
        
        if (medicine.quantity < quantity) {
          return res.status(400).json({ 
            success: false, 
            message: `Insufficient stock for ${medicine.medicineName}. Available: ${medicine.quantity}` 
          });
        }
        
        // Deduct stock
        medicine.quantity -= quantity;
        
        // If stock reaches zero, keep the batch active until new stock is added
        if (medicine.quantity <= 0) {
          medicine.quantity = 0;
        }
        
        await medicine.save();

        // Cost for regular medicine: quantity * purchasePrice
        const unitCost = medicine.purchasePrice || 0;
        totalCost += unitCost * quantity;

        // Add processed item
        processedItems.push({
          ...item,
          quantity: quantity,
          mlUsed: 0
        });
      }
    }
    
    // Generate invoice number
    const lastSale = await PharmacySale.findOne().sort({ createdAt: -1 });
    let invoiceNumber = 'PH-INV-0001';
    if (lastSale && lastSale.invoiceNumber) {
      const lastNumber = parseInt(lastSale.invoiceNumber.split('-')[2]);
      invoiceNumber = `PH-INV-${String(lastNumber + 1).padStart(4, '0')}`;
    }
    
    // Create sale record
    const sale = new PharmacySale({
      ...saleData,
      items: processedItems,
      invoiceNumber,
      totalCost: Math.max(0, Number(totalCost) || 0),
    });
    
    await sale.save();

    // Create Receivable if there is a due portion
    try {
      const totalAmount = Number(sale.totalAmount || 0);
      const receivedAmount = Number(sale.receivedAmount || 0);
      const receivableCurrent = Math.max(0, totalAmount - Math.max(0, Math.min(receivedAmount, totalAmount)));
      if (receivableCurrent > 0) {
        await Receivable.create({
          portal: 'pharmacy',
          customerId: sale.clientId || sale.customerId || undefined,
          patientId: sale.patientId || undefined,
          customerName: sale.customerName || undefined,
          refType: 'pharmacy_sale',
          refId: String(sale._id),
          billDate: sale.createdAt,
          description: `Pharmacy sale ${sale.invoiceNumber}`,
          totalAmount: receivableCurrent,
          balance: receivableCurrent,
          status: 'open',
        });
      }
    } catch (e) {
      console.warn('Receivable create failed for PharmacySale', e?.message || e);
    }

    try {
      await postPharmacySale(sale.toObject());
    } catch (e) {
      console.error('Accounting posting failed for PharmacySale', e && e.message ? e.message : e);
    }
    
    // Populate the sale with medicine details for response
    const populatedSale = await PharmacySale.findById(sale._id)
      .populate('items.medicineId');

    try {
      await DailyLog.create({
        date: new Date().toISOString().slice(0,10),
        portal: 'pharmacy',
        sessionId: req.daySession?._id,
        action: 'pharmacy_sale',
        refType: 'pharmacy_sale',
        refId: String(sale._id),
        description: `Pharmacy sale ${sale.invoiceNumber}`,
        amount: sale.totalAmount,
      });
    } catch {}

    res.status(201).json({ success: true, data: populatedSale });
  } catch (error) {
    console.error('Sale creation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/sales/:id/payment', async (req, res) => {
  try {
    const sale = await PharmacySale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale not found' });
    }

    const total = Math.max(0, Number(sale.totalAmount || 0));
    const previousDue = Math.max(0, Number(sale.previousDue || 0));
    const receivedAmount = Math.max(0, Number(req.body?.receivedAmount || 0));
    const nextReceived = Math.min(receivedAmount, total);
    const nextDue = Math.max(0, total - nextReceived);

    sale.receivedAmount = nextReceived;
    sale.dueAmount = nextDue;
    sale.newTotalDue = Math.max(0, previousDue + nextDue);
    sale.status = nextDue > 0 ? 'Pending' : 'Completed';
    if (req.body?.paymentMethod != null) {
      sale.paymentMethod = String(req.body.paymentMethod || '').trim() || sale.paymentMethod || 'Cash';
    }
    if (req.body?.paymentDetails && typeof req.body.paymentDetails === 'object') {
      sale.paymentDetails = {
        ...(sale.paymentDetails || {}),
        ...req.body.paymentDetails,
        method: req.body.paymentDetails?.method || req.body?.paymentMethod || sale.paymentDetails?.method || sale.paymentMethod || 'Cash',
      };
    }
    await sale.save();

    try {
      const receivable = await Receivable.findOne({
        portal: 'pharmacy',
        refType: 'pharmacy_sale',
        refId: String(sale._id),
      });

      if (receivable) {
        receivable.totalAmount = nextDue;
        receivable.balance = nextDue;
        receivable.status = nextDue > 0 ? 'open' : 'closed';
        await receivable.save();
      } else if (nextDue > 0) {
        await Receivable.create({
          portal: 'pharmacy',
          customerId: sale.clientId || undefined,
          patientId: sale.patientId || undefined,
          customerName: sale.customerName || undefined,
          refType: 'pharmacy_sale',
          refId: String(sale._id),
          billDate: sale.createdAt,
          description: `Pharmacy sale ${sale.invoiceNumber}`,
          totalAmount: nextDue,
          balance: nextDue,
          status: 'open',
        });
      }
    } catch (e) {
      console.warn('Receivable update failed for PharmacySale payment update', e?.message || e);
    }

    res.json({ success: true, data: sale });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update sale
router.put('/sales/:id', async (req, res) => {
  try {
    const sale = await PharmacySale.findByIdAndUpdate(
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

router.post('/sales/:id/recover', dayGuard('pharmacy'), async (req, res) => {
  try {
    const { id } = req.params;
    const amount = Math.max(0, Number(req.body?.amount || 0));
    const paymentMethod = String(req.body?.paymentMethod || '').trim() || 'Cash';
    const paymentDetails = req.body?.paymentDetails && typeof req.body.paymentDetails === 'object'
      ? req.body.paymentDetails
      : {};
    if (!amount) return res.status(400).json({ success: false, message: 'amount is required' });

    const sale = await PharmacySale.findById(id);
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found' });

    const total = Math.max(0, Number(sale.totalAmount || 0));
    const received = Math.max(0, Number(sale.receivedAmount || 0));
    const currentDue = Math.max(0, total - Math.min(received, total));
    const applied = Math.min(currentDue, amount);
    if (!applied) return res.status(400).json({ success: false, message: 'Nothing to recover' });

    const nextReceived = Math.max(0, received + applied);
    const nextDue = Math.max(0, total - Math.min(nextReceived, total));
    sale.receivedAmount = nextReceived;
    sale.dueAmount = nextDue;
    sale.newTotalDue = Math.max(0, Number(sale.previousDue || 0) + nextDue);
    sale.status = nextDue > 0 ? 'Pending' : 'Completed';
    sale.recoveryPayments = Array.isArray(sale.recoveryPayments) ? sale.recoveryPayments : [];
    sale.recoveryPayments.push({
      amount: applied,
      paymentMethod,
      paymentDetails: {
        ...paymentDetails,
        method: paymentDetails?.method || paymentMethod,
      },
      recoveredAt: new Date(),
    });
    await sale.save();

    try {
      const receivable = await Receivable.findOne({
        portal: 'pharmacy',
        refType: 'pharmacy_sale',
        refId: String(sale._id),
      });
      if (receivable) {
        const balance = Math.max(0, Number(receivable.balance || 0));
        const nextBal = Math.max(0, balance - applied);
        receivable.balance = nextBal;
        receivable.status = nextBal > 0 ? 'open' : 'closed';
        receivable.allocations = Array.isArray(receivable.allocations) ? receivable.allocations : [];
        receivable.allocations.push({ paymentId: `ph_sale_recover_${Date.now()}`, amount: applied, date: new Date() });
        await receivable.save();
      }
    } catch (e) {
      console.warn('Receivable update failed for PharmacySale recover', e?.message || e);
    }

    try {
      if (sale.clientId) {
        const dueRow = await PharmacyDue.findOne({ clientId: sale.clientId });
        if (dueRow) {
          dueRow.previousDue = Math.max(0, Number(dueRow.previousDue || 0) - applied);
          await dueRow.save();
        }
      }
    } catch (e) {
      console.warn('PharmacyDue update failed for PharmacySale recover', e?.message || e);
    }

    try {
      await DailyLog.create({
        date: new Date().toISOString().slice(0,10),
        portal: 'pharmacy',
        sessionId: req.daySession?._id,
        action: 'pharmacy_sale_recover',
        refType: 'pharmacy_sale',
        refId: String(sale._id),
        description: `Recovery for ${sale.invoiceNumber}`,
        amount: applied,
      });
    } catch {}

    res.json({ success: true, data: sale, recovered: applied });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete sale (with stock restoration)
router.delete('/sales/:id', dayGuard('pharmacy'), async (req, res) => {
  try {
    const sale = await PharmacySale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale not found' });
    }

    // Restore stock for each item
    for (const item of sale.items) {
      const medicine = await PharmacyMedicine.findById(item.medicineId);
      if (medicine) {
        if (medicine.category === 'Injection' && item.mlUsed) {
          // Restore ml for injections
          medicine.remainingMl = (medicine.remainingMl || 0) + item.mlUsed;
          if (medicine.remainingMl > 0) {
            medicine.quantity = Math.max(medicine.quantity, 1);
          }
        } else {
          // Restore quantity for regular medicines
          medicine.quantity += item.quantity;
        }
        await medicine.save();
      }
    }

    await PharmacySale.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Sale deleted and stock restored successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== DUES ROUTES ====================

// Get dues by clientId
router.get('/dues/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const record = await PharmacyDue.findOne({ clientId });
    if (!record) return res.json({ success: true, previousDue: 0, data: { clientId, previousDue: 0, totalPaid: 0 } });
    res.json({ success: true, previousDue: record.previousDue, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Upsert dues by clientId
router.put('/dues/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { previousDue = 0, totalPaid = 0, name, customerContact } = req.body || {};
    const updated = await PharmacyDue.findOneAndUpdate(
      { clientId },
      { clientId, name, customerContact, previousDue: Math.max(0, Number(previousDue) || 0), totalPaid: Math.max(0, Number(totalPaid) || 0) },
      { new: true, upsert: true, runValidators: true }
    );
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// ==================== PURCHASE ROUTES ====================

// Get all purchases
router.get('/purchases', async (req, res) => {
  try {
    const purchases = await PharmacyPurchase.find().sort({ purchaseDate: -1 });
    res.json({ success: true, data: purchases });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get purchase by ID
router.get('/purchases/:id', async (req, res) => {
  try {
    const purchase = await PharmacyPurchase.findById(req.params.id);
    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase not found' });
    }
    res.json({ success: true, data: purchase });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create new purchase
router.post('/purchases', dayGuard('pharmacy'), async (req, res) => {
  try {
    const purchase = new PharmacyPurchase(req.body);
    await purchase.save();

    try {
      await postPharmacyPurchase(purchase.toObject());
    } catch (e) {
      console.error('Accounting posting failed for PharmacyPurchase', e && e.message ? e.message : e);
    }

    try {
      const total = Number(purchase.totalAmount || 0);
      const paid = Number(purchase.amountPaid || 0);
      const balance = Math.max(0, total - paid);
      if (balance > 0) {
        await Payable.create({
          portal: 'pharmacy',
          supplierId: purchase.supplierName, // string id fallback
          supplierName: purchase.supplierName,
          billRef: purchase.invoiceNo,
          billDate: purchase.purchaseDate || purchase.createdAt,
          sourceType: 'pharmacy_purchase',
          sourceId: String(purchase._id),
          description: `Pharmacy invoice ${purchase.invoiceNo}`,
          totalAmount: balance,
          balance: balance,
          status: 'open',
        });
      }
    } catch (e) {
      console.warn('Payable create failed for PharmacyPurchase', e?.message || e);
    }

    try {
      await DailyLog.create({
        date: new Date().toISOString().slice(0,10),
        portal: 'pharmacy',
        sessionId: req.daySession?._id,
        action: 'pharmacy_purchase',
        refType: 'pharmacy_purchase',
        refId: String(purchase._id),
        description: `Pharmacy purchase ${purchase.purchaseOrderNo}`,
        amount: purchase.totalAmount,
      });
    } catch {}

    res.status(201).json({ success: true, data: purchase });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update purchase
router.put('/purchases/:id', async (req, res) => {
  try {
    const purchase = await PharmacyPurchase.findByIdAndUpdate(
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

// Delete purchase
router.delete('/purchases/:id', async (req, res) => {
  try {
    const purchase = await PharmacyPurchase.findByIdAndDelete(req.params.id);
    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase not found' });
    }
    res.json({ success: true, message: 'Purchase deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== REPORTING ROUTES ====================

// Get sales summary
router.get('/reports/sales-summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate + 'T23:59:59.999Z')
        }
      };
    }

    const sales = await PharmacySale.find(dateFilter);
    
    const summary = {
      totalSales: sales.length,
      totalRevenue: sales.reduce((sum, sale) => sum + sale.totalAmount, 0),
      totalDiscount: sales.reduce((sum, sale) => sum + sale.discount, 0),
      averageSaleAmount: sales.length > 0 ? sales.reduce((sum, sale) => sum + sale.totalAmount, 0) / sales.length : 0,
      paymentMethods: {}
    };

    // Group by payment methods
    sales.forEach(sale => {
      summary.paymentMethods[sale.paymentMethod] = 
        (summary.paymentMethods[sale.paymentMethod] || 0) + 1;
    });

    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get top selling medicines
router.get('/reports/top-selling', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const sales = await PharmacySale.find();
    const medicineStats = {};

    sales.forEach(sale => {
      sale.items.forEach(item => {
        if (!medicineStats[item.medicineName]) {
          medicineStats[item.medicineName] = {
            name: item.medicineName,
            category: item.category,
            totalQuantity: 0,
            totalMlUsed: 0,
            totalRevenue: 0,
            salesCount: 0
          };
        }
        
        const stats = medicineStats[item.medicineName];
        stats.totalQuantity += item.quantity || 0;
        stats.totalMlUsed += item.mlUsed || 0;
        stats.totalRevenue += item.totalPrice;
        stats.salesCount += 1;
      });
    });

    const topSelling = Object.values(medicineStats)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, parseInt(limit));

    res.json({ success: true, data: topSelling });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
