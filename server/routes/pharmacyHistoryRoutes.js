import express from "express";
import PharmacySale from "../models/PharmacySale.js";
import PharmacyPurchase from "../models/PharmacyPurchase.js";
import PharmacyReturn from "../models/PharmacyReturn.js";
import PharmacyMedicine from "../models/PharmacyMedicine.js";

const router = express.Router();

// ==================== SALES HISTORY ====================

// Get comprehensive sales history with filters
router.get("/sales-history", async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      customerName,
      customerContact,
      invoiceNumber,
      paymentMethod,
      status,
      page = 1,
      limit = 50,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build filter object
    const filter = {};

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate + "T23:59:59.999Z");
    }

    if (customerName) {
      filter.customerName = { $regex: customerName, $options: "i" };
    }

    if (customerContact) {
      filter.customerContact = { $regex: customerContact, $options: "i" };
    }

    if (invoiceNumber) {
      filter.invoiceNumber = { $regex: invoiceNumber, $options: "i" };
    }

    if (paymentMethod) {
      filter.paymentMethod = paymentMethod;
    }

    if (status) {
      filter.status = status;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortObj = {};
    sortObj[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Get sales with pagination
    const sales = await PharmacySale.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit))
      .populate("prescriptionId", "prescriptionNumber")
      .lean();

    // Get total count for pagination
    const totalCount = await PharmacySale.countDocuments(filter);

    // Calculate summary statistics
    const summaryPipeline = [
      { $match: filter },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: "$totalAmount" },
          totalDiscount: { $sum: "$discount" },
          totalPaymentCharges: { $sum: "$paymentCharge" },
          avgSaleAmount: { $avg: "$totalAmount" },
        },
      },
    ];

    const summaryResult = await PharmacySale.aggregate(summaryPipeline);
    const summary = summaryResult[0] || {
      totalSales: 0,
      totalRevenue: 0,
      totalDiscount: 0,
      totalPaymentCharges: 0,
      avgSaleAmount: 0,
    };

    res.json({
      success: true,
      data: {
        sales,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: skip + parseInt(limit) < totalCount,
          hasPrev: parseInt(page) > 1,
        },
        summary,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get detailed sale by ID
router.get("/sales-history/:id", async (req, res) => {
  try {
    const sale = await PharmacySale.findById(req.params.id)
      .populate("prescriptionId")
      .populate("items.medicineId")
      .lean();

    if (!sale) {
      return res
        .status(404)
        .json({ success: false, message: "Sale not found" });
    }

    // Get related returns for this sale
    const returns = await PharmacyReturn.find({
      originalSaleId: req.params.id,
    });

    res.json({
      success: true,
      data: {
        sale,
        returns,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== PURCHASE HISTORY ====================

// Get comprehensive purchase history with filters
router.get("/purchase-history", async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      supplierName,
      invoiceNo,
      purchaseOrderNo,
      paymentStatus,
      page = 1,
      limit = 50,
      sortBy = "purchaseDate",
      sortOrder = "desc",
    } = req.query;

    // Build filter object
    const filter = {};

    if (startDate || endDate) {
      filter.purchaseDate = {};
      if (startDate) filter.purchaseDate.$gte = new Date(startDate);
      if (endDate)
        filter.purchaseDate.$lte = new Date(endDate + "T23:59:59.999Z");
    }

    if (supplierName) {
      filter.supplierName = { $regex: supplierName, $options: "i" };
    }

    if (invoiceNo) {
      filter.invoiceNo = { $regex: invoiceNo, $options: "i" };
    }

    if (purchaseOrderNo) {
      filter.purchaseOrderNo = { $regex: purchaseOrderNo, $options: "i" };
    }

    if (paymentStatus) {
      filter.paymentStatus = paymentStatus;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortObj = {};
    sortObj[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Get purchases with pagination
    const purchases = await PharmacyPurchase.find(filter)
      .select("+reviewedBy") // Explicitly include if hidden, though usually unnecessary for standard finds
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Fetch current stock for each medicine and calculate remaining amounts after returns
    const purchasesWithStock = await Promise.all(
      purchases.map(async (purchase) => {
        const itemsWithStock = await Promise.all(
          (purchase.items || []).map(async (item) => {
            const medicine = await PharmacyMedicine.findOne({
              $or: [
                { _id: item.medicineId },
                { medicineName: item.medicineName, batchNo: item.batchNo },
                { medicineName: item.medicineName, batchNo: { $in: ["N/A", "", null] } },
                { medicineName: item.medicineName, batchNo: { $exists: false } }
              ],
              isActive: true,
            }).lean();
            return {
              ...item,
              medicineId: medicine ? medicine._id : item.medicineId, // Use real ID from inventory
              currentStock: medicine ? medicine.quantity : 0,
            };
          })
        );

        // Fetch returns for this purchase to calculate remaining amount
        const returns = await PharmacyReturn.find({
          originalPurchaseId: purchase._id,
          returnType: "Supplier Return",
          refundStatus: { $in: ["Processed", "Pending"] }
        }).lean();

        const totalReturnedAmount = returns.reduce((sum, ret) => sum + (ret.totalReturnAmount || 0), 0);
        const originalTotal = purchase.netTotal ?? purchase.totalAmount ?? 0;
        const remainingAmount = Math.max(0, originalTotal - totalReturnedAmount);

        return {
          ...purchase,
          items: itemsWithStock,
          totalReturnedAmount,
          remainingAmount
        };
      })
    );

    // Get total count for pagination
    const totalCount = await PharmacyPurchase.countDocuments(filter);

    // Calculate summary statistics
    const summaryPipeline = [
      { $match: filter },
      {
        $group: {
          _id: null,
          totalPurchases: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
          totalPaid: { $sum: "$amountPaid" },
          avgPurchaseAmount: { $avg: "$totalAmount" },
        },
      },
    ];

    const summaryResult = await PharmacyPurchase.aggregate(summaryPipeline);
    const summary = summaryResult[0] || {
      totalPurchases: 0,
      totalAmount: 0,
      totalPaid: 0,
      avgPurchaseAmount: 0,
    };

    // Calculate outstanding amount
    summary.outstandingAmount = summary.totalAmount - summary.totalPaid;

    res.json({
      success: true,
      data: {
        purchases: purchasesWithStock,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: skip + parseInt(limit) < totalCount,
          hasPrev: parseInt(page) > 1,
        },
        summary,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get detailed purchase by ID
router.get("/purchase-history/:id", async (req, res) => {
  try {
    const purchase = await PharmacyPurchase.findById(req.params.id).lean();

    if (!purchase) {
      return res
        .status(404)
        .json({ success: false, message: "Purchase not found" });
    }

    // Get related returns for this purchase
    const returns = await PharmacyReturn.find({
      originalPurchaseId: req.params.id,
    });

    // Get medicines added from this purchase
    const medicines = await PharmacyMedicine.find({
      invoiceNo: purchase.invoiceNo,
      supplierName: purchase.supplierName,
    });

    res.json({
      success: true,
      data: {
        purchase,
        returns,
        medicines,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== RETURNS MANAGEMENT ====================

// Get all returns with filters
router.get("/returns", async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      returnType,
      refundStatus,
      supplierName,
      customerContact,
      page = 1,
      limit = 50,
      sortBy = "returnDate",
      sortOrder = "desc",
    } = req.query;

    // Build filter object
    const filter = {};

    if (startDate || endDate) {
      filter.returnDate = {};
      if (startDate) filter.returnDate.$gte = new Date(startDate);
      if (endDate)
        filter.returnDate.$lte = new Date(endDate + "T23:59:59.999Z");
    }

    if (returnType) {
      filter.returnType = returnType;
    }

    if (refundStatus) {
      filter.refundStatus = refundStatus;
    }

    if (supplierName) {
      filter.supplierName = { $regex: supplierName, $options: "i" };
    }

    if (customerContact) {
      filter.customerContact = { $regex: customerContact, $options: "i" };
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortObj = {};
    sortObj[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Get returns with pagination
    const returns = await PharmacyReturn.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit))
      .populate("originalSaleId", "invoiceNumber customerName")
      .populate("originalPurchaseId", "purchaseOrderNo supplierName")
      .lean();

    console.log("Returns query filter:", filter);
    console.log("Returns found:", returns.length);
    console.log("Sample return:", returns[0]);

    // Get total count for pagination
    const totalCount = await PharmacyReturn.countDocuments(filter);

    // Calculate summary statistics
    const summaryPipeline = [
      { $match: filter },
      {
        $group: {
          _id: "$returnType",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalReturnAmount" },
        },
      },
    ];

    const summaryByType = await PharmacyReturn.aggregate(summaryPipeline);

    const summary = {
      totalReturns: totalCount,
      customerReturns: summaryByType.find(
        (s) => s._id === "Customer Return",
      ) || { count: 0, totalAmount: 0 },
      supplierReturns: summaryByType.find(
        (s) => s._id === "Supplier Return",
      ) || { count: 0, totalAmount: 0 },
    };

    res.json({
      success: true,
      data: {
        returns,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: skip + parseInt(limit) < totalCount,
          hasPrev: parseInt(page) > 1,
        },
        summary,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create customer return
router.post("/returns/customer", async (req, res) => {
  try {
    const {
      originalSaleId,
      items,
      customerName,
      customerContact,
      refundMethod,
      notes,
    } = req.body;

    // Validate original sale exists
    const originalSale = await PharmacySale.findById(originalSaleId);
    if (!originalSale) {
      return res
        .status(404)
        .json({ success: false, message: "Original sale not found" });
    }

    // Generate return number
    const lastReturn = await PharmacyReturn.findOne({
      returnType: "Customer Return",
    }).sort({ createdAt: -1 });
    let returnNumber = "CR-0001";
    if (lastReturn && lastReturn.returnNumber) {
      const lastNumber = parseInt(lastReturn.returnNumber.split("-")[1]);
      returnNumber = `CR-${String(lastNumber + 1).padStart(4, "0")}`;
    }

    // Calculate total return amount
    const totalReturnAmount = items.reduce(
      (sum, item) => sum + item.totalReturnAmount,
      0,
    );

    // Process inventory adjustments (add back to stock) and update original sale
    for (const item of items) {
      // 1. Stock restoration
      const medicine = await PharmacyMedicine.findById(item.medicineId);
      if (medicine) {
        const returnQty = parseFloat(item.quantity) || 0;
        if (returnQty > 0) {
          medicine.quantity += returnQty;
          await medicine.save();
        }
      }

      // 2. Update item quantity in original sale
      const saleItem = originalSale.items.find(
        (it) => it.medicineId.toString() === item.medicineId.toString() && it.batchNo === item.batchNo,
      );
      if (saleItem) {
        const returnQty = parseFloat(item.quantity) || 0;
        saleItem.quantity = Math.max(0, saleItem.quantity - returnQty);

        // Recalculate line discount amount and total price for this item
        const basePrice = (saleItem.pricePerUnit || 0) * saleItem.quantity;
        const discPercent = saleItem.lineDiscount || 0;
        const discountedPrice = basePrice * (1 - discPercent / 100);

        saleItem.totalPrice = discountedPrice;
        saleItem.lineDiscountAmt = basePrice * (discPercent / 100);
      }
    }

    // 3. Recalculate financial totals for the original sale
    let newSubtotal = 0;
    let newLineDiscounts = 0;

    originalSale.items.forEach((it) => {
      newSubtotal += it.totalPrice;
      newLineDiscounts += it.lineDiscountAmt || 0;
    });

    originalSale.subtotal = newSubtotal;
    originalSale.lineDiscounts = newLineDiscounts;

    const billDiscPct = originalSale.billDiscountPercent || 0;
    const billDiscAmt = originalSale.billDiscountAmount || (newSubtotal * billDiscPct / 100);
    originalSale.billDiscountAmount = billDiscAmt;

    const taxPct = originalSale.salesTaxPercent || 0;
    const afterBillDisc = newSubtotal - billDiscAmt;
    const newTaxAmt = afterBillDisc * (taxPct / 100);
    originalSale.salesTaxAmount = newTaxAmt;

    const newTotal = afterBillDisc + newTaxAmt + (originalSale.previousDue || 0);
    originalSale.totalAmount = newTotal;
    originalSale.discount = newLineDiscounts + billDiscAmt;

    // Adjust received amount and balance due if necessary
    // If it was a cash sale and fully received, we reduce receivedAmount as well
    if (originalSale.paymentMethod !== "Credit") {
      originalSale.receivedAmount = newTotal;
      originalSale.balanceDue = 0;
    } else {
      // For credit sales, receivedAmount stays what it was, but balanceDue decreases
      originalSale.balanceDue = Math.max(0, newTotal - (originalSale.receivedAmount || 0));
    }

    await originalSale.save();

    // Create return record
    const customerReturn = new PharmacyReturn({
      returnNumber,
      returnType: "Customer Return",
      customerName: customerName || originalSale.customerName,
      customerContact: customerContact || originalSale.customerContact,
      originalSaleId,
      originalInvoiceNumber: originalSale.invoiceNumber,
      items,
      totalReturnAmount,
      refundMethod,
      notes,
      processedBy: req.body.processedBy || "System",
    });

    await customerReturn.save();
    console.log("Customer return saved:", customerReturn);

    res.status(201).json({
      success: true,
      data: customerReturn,
      message: "Customer return processed successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create supplier return
router.post("/returns/supplier", async (req, res) => {
  try {
    const {
      originalPurchaseId,
      items,
      supplierName,
      supplierContact,
      refundMethod,
      notes,
    } = req.body;

    // Validate original purchase exists (optional)
    if (originalPurchaseId) {
      const originalPurchase =
        await PharmacyPurchase.findById(originalPurchaseId);
      if (!originalPurchase) {
        return res
          .status(404)
          .json({ success: false, message: "Original purchase not found" });
      }
    }

    // Generate return number
    const lastReturn = await PharmacyReturn.findOne({
      returnType: "Supplier Return",
    }).sort({ createdAt: -1 });
    let returnNumber = "RTN-SUP-0001";
    if (lastReturn && lastReturn.returnNumber && lastReturn.returnNumber.startsWith("RTN-SUP-")) {
      const parts = lastReturn.returnNumber.split("-");
      const lastSeq = parseInt(parts[2]);
      returnNumber = `RTN-SUP-${String(lastSeq + 1).padStart(4, "0")}`;
    }

    // Calculate total return amount
    const totalReturnAmount = items.reduce(
      (sum, item) => sum + item.totalReturnAmount,
      0,
    );

    // Process inventory adjustments (remove from stock)
    for (const item of items) {
      const medicine = await PharmacyMedicine.findOne({
        $or: [
          { _id: item.medicineId },
          { medicineName: item.medicineName, batchNo: item.batchNo },
          { medicineName: item.medicineName, batchNo: { $in: ["N/A", "", null] } },
          { medicineName: item.medicineName, batchNo: { $exists: false } }
        ]
      });
      if (medicine) {
        medicine.quantity = Math.max(0, medicine.quantity - (Number(item.quantity) || 0));
        await medicine.save();
      }
    }

    // Create return record
    const supplierReturn = new PharmacyReturn({
      returnNumber,
      returnType: "Supplier Return",
      supplierName,
      supplierContact,
      originalPurchaseId,
      originalInvoiceNumber: req.body.invoiceNumber || req.body.invoiceNo, // Store real invoice here
      originalPurchaseOrderNo: req.body.purchaseOrderNo,
      items: items.map(it => ({
        medicineId: it.medicineId,
        medicineName: it.medicineName,
        batchNo: it.batchNo,
        category: it.category || "Medicine",
        quantity: Number(it.quantity) || 0,
        unit: it.unit || "Unit",
        returnPrice: Number(it.returnPrice) || 0,
        totalReturnAmount: Number(it.totalReturnAmount) || 0,
        reason: it.reason || notes || "Supplier return",
      })),
      totalReturnAmount,
      refundMethod,
      notes,
      refundStatus: "Processed", // Auto-process supplier returns
      processedBy: req.body.processedBy || "System",
      returnDate: new Date(),
    });

    await supplierReturn.save();

    res.status(201).json({ success: true, data: supplierReturn });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update return status
router.put("/returns/:id/status", async (req, res) => {
  try {
    const { refundStatus, approvedBy, notes } = req.body;

    const returnRecord = await PharmacyReturn.findByIdAndUpdate(
      req.params.id,
      {
        refundStatus,
        approvedBy,
        approvalDate: refundStatus === "Processed" ? new Date() : undefined,
        notes,
      },
      { new: true },
    );

    if (!returnRecord) {
      return res
        .status(404)
        .json({ success: false, message: "Return not found" });
    }

    res.json({ success: true, data: returnRecord });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete sale from history
router.delete("/sales-history/:id", async (req, res) => {
  try {
    const sale = await PharmacySale.findById(req.params.id);
    if (!sale) {
      return res
        .status(404)
        .json({ success: false, message: "Sale not found" });
    }

    // Restore stock for deleted sale
    for (const item of sale.items) {
      const medicine = await PharmacyMedicine.findById(item.medicineId);
      if (medicine) {
        medicine.quantity += item.quantity;
        await medicine.save();
      }
    }

    await PharmacySale.findByIdAndDelete(req.params.id);
    res.json({
      success: true,
      message: "Sale deleted and stock restored successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update sale from history
router.put("/sales-history/:id", async (req, res) => {
  try {
    const sale = await PharmacySale.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!sale) {
      return res
        .status(404)
        .json({ success: false, message: "Sale not found" });
    }
    res.json({ success: true, data: sale });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete purchase from history
router.delete("/purchase-history/:id", async (req, res) => {
  try {
    const purchase = await PharmacyPurchase.findById(req.params.id);
    if (!purchase) {
      return res
        .status(404)
        .json({ success: false, message: "Purchase not found" });
    }

    // Remove stock for deleted purchase
    for (const item of purchase.items) {
      const medicine = await PharmacyMedicine.findOne({
        $or: [
          { medicineName: item.medicineName, batchNo: item.batchNo },
          { medicineName: item.medicineName, batchNo: "N/A" }
        ]
      });
      if (medicine) {
        medicine.quantity = Math.max(0, medicine.quantity - item.quantity);
        await medicine.save();
      }
    }

    await PharmacyPurchase.findByIdAndDelete(req.params.id);
    res.json({
      success: true,
      message: "Purchase deleted and stock adjusted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update purchase from history
router.put("/purchase-history/:id", async (req, res) => {
  try {
    const purchase = await PharmacyPurchase.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true },
    );
    if (!purchase) {
      return res
        .status(404)
        .json({ success: false, message: "Purchase not found" });
    }
    res.json({ success: true, data: purchase });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
