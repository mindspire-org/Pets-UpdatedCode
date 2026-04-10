import express from 'express';
import PharmacyMedicine from '../models/PharmacyMedicine.js';
import PharmacySale from '../models/PharmacySale.js';
import PharmacyPurchase from '../models/PharmacyPurchase.js';

const router = express.Router();

// ==================== MEDICINE ROUTES ====================

// Get all medicines
router.get('/medicines', async (req, res) => {
  try {
    const medicines = await PharmacyMedicine.find({ isActive: true }).sort({ createdAt: -1 });
    res.json({ success: true, data: medicines });
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
    const lowStock = medicines.filter(med => med.quantity <= med.lowStockThreshold);
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
    const medicine = new PharmacyMedicine(req.body);
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

// Update medicine
router.put('/medicines/:id', async (req, res) => {
  try {
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

// Create new sale (with stock deduction)
router.post('/sales', async (req, res) => {
  try {
    const { items, ...saleData } = req.body;
    
    // Validate stock availability and deduct quantities
    for (const item of items) {
      // Validate quantity is a valid number
      const quantity = parseFloat(item.quantity);
      if (isNaN(quantity) || quantity <= 0) {
        return res.status(400).json({ 
          success: false, 
          message: `Invalid quantity for ${item.medicineName}` 
        });
      }
      
      const medicine = await PharmacyMedicine.findById(item.medicineId);
      
      if (!medicine) {
        return res.status(404).json({ 
          success: false, 
          message: `Medicine ${item.medicineName} not found` 
        });
      }
      
      // Check if sufficient stock available
      if (medicine.quantity < quantity) {
        return res.status(400).json({ 
          success: false, 
          message: `Insufficient stock for ${medicine.medicineName}. Available: ${medicine.quantity}` 
        });
      }
      
      // Deduct stock
      medicine.quantity -= quantity;
      await medicine.save();
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
      items,
      invoiceNumber
    });
    
    await sale.save();
    res.status(201).json({ success: true, data: sale });
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

// Delete sale
router.delete('/sales/:id', async (req, res) => {
  try {
    const sale = await PharmacySale.findByIdAndDelete(req.params.id);
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale not found' });
    }
    res.json({ success: true, message: 'Sale deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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

// Create new purchase (and add medicines to inventory)
router.post('/purchases', async (req, res) => {
  try {
    const { items, ...purchaseData } = req.body;
    
    // Generate purchase order number
    const lastPurchase = await PharmacyPurchase.findOne().sort({ createdAt: -1 });
    let purchaseOrderNo = 'PH-PO-0001';
    if (lastPurchase && lastPurchase.purchaseOrderNo) {
      const lastNumber = parseInt(lastPurchase.purchaseOrderNo.split('-')[2]);
      purchaseOrderNo = `PH-PO-${String(lastNumber + 1).padStart(4, '0')}`;
    }
    
    // Create purchase record
    const purchase = new PharmacyPurchase({
      ...purchaseData,
      items,
      purchaseOrderNo
    });
    
    await purchase.save();
    
    // Add medicines to inventory
    for (const item of items) {
      // Check if medicine with same batch already exists
      const existingMedicine = await PharmacyMedicine.findOne({
        medicineName: item.medicineName,
        batchNo: item.batchNo
      });
      
      if (existingMedicine) {
        // Update existing medicine quantity
        existingMedicine.quantity += item.quantity;
        await existingMedicine.save();
      } else {
        // Create new medicine entry
        const medicine = new PharmacyMedicine({
          medicineName: item.medicineName,
          batchNo: item.batchNo,
          category: item.category,
          expiryDate: item.expiryDate,
          quantity: item.quantity,
          unit: item.unit,
          purchasePrice: item.purchasePrice,
          salePrice: item.salePrice,
          supplierName: purchaseData.supplierName,
          purchaseDate: purchaseData.purchaseDate,
          invoiceNo: purchaseData.invoiceNo,
          mlPerVial: item.mlPerVial
        });
        await medicine.save();
      }
    }
    
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

// ==================== REPORTS ROUTES ====================

// Get daily sales report
router.get('/reports/daily-sales/:date', async (req, res) => {
  try {
    const date = new Date(req.params.date);
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));
    
    const sales = await PharmacySale.find({
      createdAt: { $gte: startOfDay, $lte: endOfDay },
      status: 'Completed'
    });
    
    const totalSales = sales.length;
    const totalRevenue = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const totalDiscount = sales.reduce((sum, sale) => sum + sale.discount, 0);
    
    res.json({ 
      success: true, 
      data: {
        date: req.params.date,
        totalSales,
        totalRevenue,
        totalDiscount,
        sales
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get monthly sales report
router.get('/reports/monthly-sales/:year/:month', async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month);
    
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    
    const sales = await PharmacySale.find({
      createdAt: { $gte: startDate, $lte: endDate },
      status: 'Completed'
    });
    
    const totalSales = sales.length;
    const totalRevenue = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const totalDiscount = sales.reduce((sum, sale) => sum + sale.discount, 0);
    
    res.json({ 
      success: true, 
      data: {
        year,
        month,
        totalSales,
        totalRevenue,
        totalDiscount,
        sales
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get inventory summary
router.get('/reports/inventory-summary', async (req, res) => {
  try {
    const medicines = await PharmacyMedicine.find({ isActive: true });
    
    const totalMedicines = medicines.length;
    const totalValue = medicines.reduce((sum, med) => sum + (med.quantity * med.purchasePrice), 0);
    const lowStock = medicines.filter(med => med.quantity <= med.lowStockThreshold).length;
    
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const expiringSoon = medicines.filter(med => 
      med.expiryDate >= new Date() && med.expiryDate <= thirtyDaysFromNow
    ).length;
    
    const expired = medicines.filter(med => med.expiryDate < new Date()).length;
    
    res.json({ 
      success: true, 
      data: {
        totalMedicines,
        totalValue,
        lowStock,
        expiringSoon,
        expired
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
