import express from "express";
import PetshopPharmacySale from "../models/PetshopPharmacySale.js";
import PetshopPharmacyPurchase from "../models/PetshopPharmacyPurchase.js";
import PetshopPharmacyReturn from "../models/PetshopPharmacyReturn.js";
import PetshopNotification from "../models/PetshopNotification.js";
import PetshopPharmacyMedicine from "../models/PetshopPharmacyMedicine.js";

const router = express.Router();

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

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortObj = {};
    sortObj[sortBy] = sortOrder === "desc" ? -1 : 1;

    const sales = await PetshopPharmacySale.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit))
      .populate("prescriptionId", "prescriptionNumber")
      .lean();

    const totalCount = await PetshopPharmacySale.countDocuments(filter);

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

    const summaryResult = await PetshopPharmacySale.aggregate(summaryPipeline);
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

    const originalSale = await PetshopPharmacySale.findById(originalSaleId);
    if (!originalSale) {
      return res
        .status(404)
        .json({ success: false, message: "Original sale not found" });
    }

    const lastReturn = await PetshopPharmacyReturn.findOne({
      returnType: "Customer Return",
    }).sort({ createdAt: -1 });
    let returnNumber = "CR-0001";
    if (lastReturn && lastReturn.returnNumber) {
      const lastNumber = parseInt(lastReturn.returnNumber.split("-")[1]);
      returnNumber = `CR-${String(lastNumber + 1).padStart(4, "0")}`;
    }

    const totalReturnAmount = items.reduce(
      (sum, item) => sum + item.totalReturnAmount,
      0,
    );

    for (const item of items) {
      const medicine = await PetshopPharmacyMedicine.findById(item.medicineId);
      if (medicine) {
        const returnQty = parseFloat(item.quantity) || 0;
        if (returnQty > 0) {
          medicine.quantity += returnQty;
          await medicine.save();
        }
      }

      const saleItem = originalSale.items.find(
        (it) =>
          it.medicineId.toString() === item.medicineId.toString() &&
          it.batchNo === item.batchNo,
      );
      if (saleItem) {
        const returnQty = parseFloat(item.quantity) || 0;
        saleItem.quantity = Math.max(0, saleItem.quantity - returnQty);

        const basePrice = (saleItem.pricePerUnit || 0) * saleItem.quantity;
        const discPercent = saleItem.lineDiscount || 0;
        const discountedPrice = basePrice * (1 - discPercent / 100);

        saleItem.totalPrice = discountedPrice;
        saleItem.lineDiscountAmt = basePrice * (discPercent / 100);
      }
    }

    let newSubtotal = 0;
    let newLineDiscounts = 0;

    originalSale.items.forEach((it) => {
      newSubtotal += it.totalPrice;
      newLineDiscounts += it.lineDiscountAmt || 0;
    });

    originalSale.subtotal = newSubtotal;
    originalSale.lineDiscounts = newLineDiscounts;

    const billDiscPct = originalSale.billDiscountPercent || 0;
    let billDiscAmt = originalSale.billDiscountAmount || 0;
    if (billDiscPct > 0) {
      billDiscAmt = (newSubtotal * billDiscPct) / 100;
    } else {
      billDiscAmt = Math.min(billDiscAmt, newSubtotal);
    }
    originalSale.billDiscountAmount = billDiscAmt;

    const taxPct = originalSale.salesTaxPercent || 0;
    const afterBillDisc = Math.max(0, newSubtotal - billDiscAmt);
    const newTaxAmt = (afterBillDisc * taxPct) / 100;
    originalSale.salesTaxAmount = newTaxAmt;

    const newTotal = Math.max(
      0,
      afterBillDisc + newTaxAmt + (originalSale.paymentCharge || 0),
    );
    originalSale.totalAmount = newTotal;
    originalSale.discount = newLineDiscounts + billDiscAmt;

    if (originalSale.paymentMethod !== "Credit") {
      originalSale.receivedAmount = newTotal;
      originalSale.balanceDue = 0;
    } else {
      originalSale.balanceDue = Math.max(
        0,
        newTotal - (originalSale.receivedAmount || 0),
      );
    }

    await originalSale.save();

    const customerReturn = new PetshopPharmacyReturn({
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

    try {
      await PetshopNotification.create({
        portal: "shop",
        type: "return_customer",
        severity: "info",
        title: "Customer Return Processed",
        message: `Customer return: ${customerReturn.returnNumber} · PKR ${Number(customerReturn.totalReturnAmount || 0).toFixed(2)}`,
        relatedId: customerReturn._id,
        relatedModel: "PetshopPharmacyReturn",
        meta: {
          returnNumber: customerReturn.returnNumber,
          returnType: customerReturn.returnType,
          originalSaleId,
          originalInvoiceNumber: originalSale.invoiceNumber,
          customerName: customerReturn.customerName,
          customerContact: customerReturn.customerContact,
          totalReturnAmount: customerReturn.totalReturnAmount,
        },
        createdBy: customerReturn.processedBy || "System",
      });
    } catch (e) {
      console.error(
        "Failed to create customer return notification (petshop)",
        e && e.message ? e.message : e,
      );
    }

    res.status(201).json({
      success: true,
      data: customerReturn,
      message: "Customer return processed successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

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

    if (originalPurchaseId) {
      const originalPurchase = await PetshopPharmacyPurchase.findById(
        originalPurchaseId,
      );
      if (!originalPurchase) {
        return res
          .status(404)
          .json({ success: false, message: "Original purchase not found" });
      }
    }

    const lastReturn = await PetshopPharmacyReturn.findOne({
      returnType: "Supplier Return",
    }).sort({ createdAt: -1 });
    let returnNumber = "RTN-SUP-0001";
    if (
      lastReturn &&
      lastReturn.returnNumber &&
      lastReturn.returnNumber.startsWith("RTN-SUP-")
    ) {
      const parts = lastReturn.returnNumber.split("-");
      const lastSeq = parseInt(parts[2]);
      returnNumber = `RTN-SUP-${String(lastSeq + 1).padStart(4, "0")}`;
    }

    const totalReturnAmount = items.reduce(
      (sum, item) => sum + item.totalReturnAmount,
      0,
    );

    for (const item of items) {
      const medicine = await PetshopPharmacyMedicine.findOne({
        $or: [
          { _id: item.medicineId },
          { medicineName: item.medicineName, batchNo: item.batchNo },
          { medicineName: item.medicineName, batchNo: { $in: ["N/A", "", null] } },
          { medicineName: item.medicineName, batchNo: { $exists: false } },
        ],
      });
      if (medicine) {
        medicine.quantity = Math.max(
          0,
          medicine.quantity - (Number(item.quantity) || 0),
        );
        await medicine.save();
      }
    }

    const supplierReturn = new PetshopPharmacyReturn({
      returnNumber,
      returnType: "Supplier Return",
      supplierName,
      supplierContact,
      originalPurchaseId,
      originalInvoiceNumber: req.body.invoiceNumber || req.body.invoiceNo,
      originalPurchaseOrderNo: req.body.purchaseOrderNo,
      items: items.map((it) => ({
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
      refundStatus: "Processed",
      processedBy: req.body.processedBy || "System",
      returnDate: new Date(),
    });

    await supplierReturn.save();

    try {
      await PetshopNotification.create({
        portal: "shop",
        type: "return_supplier",
        severity: "info",
        title: "Supplier Return Processed",
        message: `Supplier return: ${supplierReturn.returnNumber} · PKR ${Number(supplierReturn.totalReturnAmount || 0).toFixed(2)}`,
        relatedId: supplierReturn._id,
        relatedModel: "PetshopPharmacyReturn",
        meta: {
          returnNumber: supplierReturn.returnNumber,
          returnType: supplierReturn.returnType,
          originalPurchaseId,
          supplierName: supplierReturn.supplierName,
          supplierContact: supplierReturn.supplierContact,
          totalReturnAmount: supplierReturn.totalReturnAmount,
        },
        createdBy: supplierReturn.processedBy || "System",
      });
    } catch (e) {
      console.error(
        "Failed to create supplier return notification (petshop)",
        e && e.message ? e.message : e,
      );
    }

    res.status(201).json({ success: true, data: supplierReturn });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/returns/:id/status", async (req, res) => {
  try {
    const { refundStatus, approvedBy, notes } = req.body;

    const returnRecord = await PetshopPharmacyReturn.findByIdAndUpdate(
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

router.get("/sales-history/:id", async (req, res) => {
  try {
    const sale = await PetshopPharmacySale.findById(req.params.id)
      .populate("prescriptionId")
      .populate("items.medicineId")
      .lean();

    if (!sale) {
      return res.status(404).json({ success: false, message: "Sale not found" });
    }

    const returns = await PetshopPharmacyReturn.find({ originalSaleId: sale._id })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: { sale, returns } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete sale from history
router.delete("/sales-history/:id", async (req, res) => {
  try {
    const sale = await PetshopPharmacySale.findById(req.params.id);
    if (!sale) {
      return res
        .status(404)
        .json({ success: false, message: "Sale not found" });
    }

    // Restore stock for deleted sale
    for (const item of sale.items) {
      const medicine = await PetshopPharmacyMedicine.findById(item.medicineId);
      if (medicine) {
        medicine.quantity += item.quantity;
        await medicine.save();
      }
    }

    await PetshopPharmacySale.findByIdAndDelete(req.params.id);
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
    const sale = await PetshopPharmacySale.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      },
    );
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

    const filter = {};

    if (startDate || endDate) {
      filter.purchaseDate = {};
      if (startDate) filter.purchaseDate.$gte = new Date(startDate);
      if (endDate) filter.purchaseDate.$lte = new Date(endDate + "T23:59:59.999Z");
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

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortObj = {};
    sortObj[sortBy] = sortOrder === "desc" ? -1 : 1;

    const purchases = await PetshopPharmacyPurchase.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const purchasesWithStock = await Promise.all(
      purchases.map(async (purchase) => {
        const itemsWithStock = await Promise.all(
          (purchase.items || []).map(async (item) => {
            const medicine = await PetshopPharmacyMedicine.findOne({
              $or: [
                { _id: item.medicineId },
                { medicineName: item.medicineName, batchNo: item.batchNo },
                { medicineName: item.medicineName, batchNo: { $in: ["N/A", "", null] } },
                { medicineName: item.medicineName, batchNo: { $exists: false } },
              ],
              isActive: true,
            }).lean();

            return {
              ...item,
              medicineId: medicine ? medicine._id : item.medicineId,
              currentStock: medicine ? medicine.quantity : 0,
            };
          }),
        );

        const returns = await PetshopPharmacyReturn.find({
          originalPurchaseId: purchase._id,
          returnType: "Supplier Return",
          refundStatus: { $in: ["Processed", "Pending"] },
        }).lean();

        const totalReturnedAmount = returns.reduce(
          (sum, ret) => sum + (ret.totalReturnAmount || 0),
          0,
        );
        const originalTotal = purchase.netTotal ?? purchase.totalAmount ?? 0;
        const remainingAmount = Math.max(0, originalTotal - totalReturnedAmount);

        return {
          ...purchase,
          items: itemsWithStock,
          totalReturnedAmount,
          remainingAmount,
        };
      }),
    );

    const totalCount = await PetshopPharmacyPurchase.countDocuments(filter);

    const summaryPipeline = [
      { $match: filter },
      {
        $group: {
          _id: null,
          totalPurchases: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
          avgPurchaseAmount: { $avg: "$totalAmount" },
          totalPaid: { $sum: "$amountPaid" },
        },
      },
    ];

    const summaryResult = await PetshopPharmacyPurchase.aggregate(summaryPipeline);
    const summary = summaryResult[0] || {
      totalPurchases: 0,
      totalAmount: 0,
      avgPurchaseAmount: 0,
      totalPaid: 0,
    };

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

router.get("/purchase-history/:id", async (req, res) => {
  try {
    const purchase = await PetshopPharmacyPurchase.findById(req.params.id).lean();
    if (!purchase) {
      return res.status(404).json({ success: false, message: "Purchase not found" });
    }

    const returns = await PetshopPharmacyReturn.find({
      originalPurchaseId: req.params.id,
    });

    const medicines = await PetshopPharmacyMedicine.find({
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

// Delete purchase from history
router.delete("/purchase-history/:id", async (req, res) => {
  try {
    const purchase = await PetshopPharmacyPurchase.findById(req.params.id);
    if (!purchase) {
      return res
        .status(404)
        .json({ success: false, message: "Purchase not found" });
    }

    // Remove stock for deleted purchase
    for (const item of purchase.items) {
      const medicine = await PetshopPharmacyMedicine.findOne({
        $or: [
          { medicineName: item.medicineName, batchNo: item.batchNo },
          { medicineName: item.medicineName, batchNo: "N/A" },
        ],
      });
      if (medicine) {
        medicine.quantity = Math.max(0, medicine.quantity - item.quantity);
        await medicine.save();
      }
    }

    await PetshopPharmacyPurchase.findByIdAndDelete(req.params.id);
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
    const purchase = await PetshopPharmacyPurchase.findByIdAndUpdate(
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

router.get("/returns", async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      returnType,
      refundStatus,
      customerName,
      supplierName,
      returnNumber,
      customerContact,
      page = 1,
      limit = 50,
      sortBy = "returnDate",
      sortOrder = "desc",
    } = req.query;

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

    if (returnNumber) {
      filter.returnNumber = { $regex: returnNumber, $options: "i" };
    }

    if (supplierName) {
      filter.supplierName = { $regex: supplierName, $options: "i" };
    }

    if (customerName) {
      filter.$or = [
        { customerName: { $regex: customerName, $options: "i" } },
        { supplierName: { $regex: customerName, $options: "i" } },
      ];
    }

    if (customerContact) {
      filter.customerContact = { $regex: customerContact, $options: "i" };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortObj = {};
    sortObj[sortBy] = sortOrder === "desc" ? -1 : 1;

    const returns = await PetshopPharmacyReturn.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit))
      .populate("originalSaleId", "invoiceNumber customerName")
      .populate("originalPurchaseId", "purchaseOrderNo supplierName")
      .lean();

    const totalCount = await PetshopPharmacyReturn.countDocuments(filter);

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

    const summaryByType = await PetshopPharmacyReturn.aggregate(summaryPipeline);

    const summary = {
      totalReturns: totalCount,
      customerReturns:
        summaryByType.find((s) => s._id === "Customer Return") ||
        { count: 0, totalAmount: 0 },
      supplierReturns:
        summaryByType.find((s) => s._id === "Supplier Return") ||
        { count: 0, totalAmount: 0 },
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

router.get("/return-history", async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      returnType,
      customerName,
      supplierName,
      returnNumber,
      refundStatus,
      page = 1,
      limit = 50,
      sortBy = "returnDate",
      sortOrder = "desc",
    } = req.query;

    const filter = {};

    if (startDate || endDate) {
      filter.returnDate = {};
      if (startDate) filter.returnDate.$gte = new Date(startDate);
      if (endDate) filter.returnDate.$lte = new Date(endDate + "T23:59:59.999Z");
    }

    if (returnType) filter.returnType = returnType;
    if (customerName) filter.customerName = { $regex: customerName, $options: 'i' };
    if (supplierName) filter.supplierName = { $regex: supplierName, $options: 'i' };
    if (returnNumber) filter.returnNumber = { $regex: returnNumber, $options: 'i' };
    if (refundStatus) filter.refundStatus = refundStatus;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const returns = await PetshopPharmacyReturn.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalCount = await PetshopPharmacyReturn.countDocuments(filter);

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
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/inventory-summary", async (req, res) => {
  try {
    const medicines = await PetshopPharmacyMedicine.find({ isActive: true }).lean();
    const totalItems = medicines.reduce((s, m) => s + (m.quantity || 0), 0);
    const totalValue = medicines.reduce((s, m) => s + (m.quantity || 0) * (m.purchasePrice || 0), 0);

    res.json({
      success: true,
      data: {
        totalMedicines: medicines.length,
        totalItems,
        totalValue,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
