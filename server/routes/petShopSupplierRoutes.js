import express from "express";
import PetShopSupplier from "../models/PetShopSupplier.js";
import Product from "../models/Product.js";
import Payable from "../models/Payable.js";
import VendorPayment from "../models/VendorPayment.js";
import PetShopCompany from "../models/PetShopCompany.js";
import PetshopPharmacyInvoice from "../models/PetshopPharmacyInvoice.js";
import PetshopPharmacyMedicine from "../models/PetshopPharmacyMedicine.js";
import PetshopPharmacyPurchase from "../models/PetshopPharmacyPurchase.js";

const router = express.Router();

// Get all pet shop suppliers (optionally filter by status)
// Also computes real totalPurchases and totalPaid from PetshopPharmacyPurchase collection
router.get("/", async (req, res) => {
  try {
    const { status } = req.query;
    const query = { portal: 'shop' };
    
    if (status && status !== "all") {
      query.status = status;
    }
    
    const suppliers = await PetShopSupplier.find(query)
      .populate('companyIds', 'companyName status')
      .sort({ createdAt: -1 })
      .lean();

    // Aggregate totals from PetshopPharmacyPurchase grouped by supplierName
    const purchaseAgg = await PetshopPharmacyPurchase.aggregate([
      {
        $group: {
          _id: { $toLower: "$supplierName" },
          totalPurchases: { $sum: { $ifNull: ["$netTotal", "$totalAmount"] } },
        }
      }
    ]);
    const aggMap = {};
    for (const row of purchaseAgg) {
      aggMap[row._id] = { totalPurchases: row.totalPurchases };
    }

    const enriched = suppliers.map(s => {
      const key = (s.supplierName || "").toLowerCase();
      const agg = aggMap[key];
      return {
        ...s,
        // totalPurchases from the actual purchase collection
        totalPurchases: agg ? agg.totalPurchases : (s.totalPurchases || 0),
        // totalPaid stays from supplier.paymentHistory (already tracked correctly)
        totalPaid: s.totalPaid || 0,
      };
    });

    res.json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Bulk upsert suppliers from import
router.post("/bulk", async (req, res) => {
  try {
    const payload = Array.isArray(req.body) ? req.body : req.body?.items;
    if (!Array.isArray(payload) || payload.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No items provided" });
    }

    const stats = { created: 0, updated: 0, failed: 0 };
    const errors = [];

    for (const raw of payload) {
      try {
        const supplierName = String(
          raw?.supplierName ||
            raw?.name ||
            raw?.supplier ||
            raw?.["Supplier Name"] ||
            "",
        ).trim();

        if (!supplierName) {
          stats.failed += 1;
          errors.push({ row: raw, message: "Missing supplierName" });
          continue;
        }

        const update = {
          portal: 'shop',
          supplierName,
          contactPerson: String(
            raw?.contactPerson || raw?.["Contact Person"] || "",
          ).trim(),
          phone: String(raw?.phone || raw?.Phone || "").trim(),
          email: String(raw?.email || raw?.Email || "").trim(),
          address: String(raw?.address || raw?.Address || "").trim(),
          city: String(raw?.city || raw?.City || "").trim(),
          category:
            String(raw?.category || raw?.Category || "General").trim() ||
            "General",
          notes: String(raw?.notes || raw?.Notes || "").trim(),
          taxId: String(raw?.taxId || raw?.["Tax ID"] || "").trim(),
          status: String(raw?.status || raw?.Status || "active").trim().toLowerCase() || "active",
        };

        const r = await PetShopSupplier.updateOne(
          { supplierName, portal: 'shop' },
          { $set: update },
          { upsert: true, runValidators: true },
        );
        if (r?.upsertedCount) stats.created += r.upsertedCount;
        else stats.updated += r?.modifiedCount ? r.modifiedCount : 1;
      } catch (e) {
        stats.failed += 1;
        errors.push({ row: raw, message: e?.message || String(e) });
      }
    }

    res.json({ success: true, ...stats, errors });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get supplier by ID
router.get("/:id", async (req, res) => {
  try {
    const supplier = await PetShopSupplier.findById(req.params.id)
      .populate('companyIds', 'companyName status');
    if (!supplier) {
      return res
        .status(404)
        .json({ success: false, message: "Supplier not found" });
    }
    res.json({ success: true, data: supplier });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create supplier
router.post("/", async (req, res) => {
  try {
    const supplier = new PetShopSupplier({ ...req.body, portal: 'shop' });
    await supplier.save();
    res.status(201).json({ success: true, data: supplier });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update supplier
router.put("/:id", async (req, res) => {
  try {
    const supplier = await PetShopSupplier.findByIdAndUpdate(
      req.params.id,
      { ...req.body, portal: 'shop' },
      { new: true, runValidators: true }
    );
    if (!supplier) {
      return res
        .status(404)
        .json({ success: false, message: "Supplier not found" });
    }
    res.json({ success: true, data: supplier });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete supplier
router.delete("/:id", async (req, res) => {
  try {
    const supplier = await PetShopSupplier.findByIdAndDelete(req.params.id);
    if (!supplier) {
      return res
        .status(404)
        .json({ success: false, message: "Supplier not found" });
    }
    res.json({ success: true, message: "Supplier deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add purchase to supplier (and update product stock)
router.post("/:id/purchase", async (req, res) => {
  try {
    const {
      productId,
      productName,
      quantity,
      unitPrice,
      invoiceNumber,
    } = req.body;

    const supplier = await PetShopSupplier.findById(req.params.id);
    if (!supplier) {
      return res
        .status(404)
        .json({ success: false, message: "Supplier not found" });
    }

    const totalPrice = Number(quantity || 0) * Number(unitPrice || 0);

    // Add to purchase history
    supplier.purchaseHistory.push({
      productId,
      productName,
      quantity: Number(quantity || 0),
      unitPrice: Number(unitPrice || 0),
      totalPrice,
      invoiceNumber,
      purchaseDate: new Date(),
    });

    // Update total purchases
    const currentTotal = Number(supplier.totalPurchases || 0);
    supplier.totalPurchases = currentTotal + totalPrice;

    await supplier.save();

    // Create a corresponding Payable record for the Admin portal
    try {
      await Payable.create({
        portal: "shop",
        supplierId: supplier._id,
        supplierName: supplier.supplierName,
        billRef: invoiceNumber || `PUR-${Date.now()}`,
        billDate: new Date(),
        totalAmount: totalPrice,
        balance: totalPrice,
        status: "open",
        description: `Purchase of ${quantity} x ${productName || "product"} (shop)`,
      });
    } catch (err) {
      console.error("Error creating payable from purchase:", err);
    }

    // Update product stock if productId provided
    if (productId) {
      await Product.findByIdAndUpdate(productId, {
        $inc: { quantity: Number(quantity || 0) },
      });
    }

    res.json({ success: true, data: supplier });
  } catch (error) {
    console.error("Error in POST purchase:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update a purchase entry in supplier purchase history
router.put("/:id/purchase/:purchaseId", async (req, res) => {
  try {
    const {
      productId,
      productName,
      quantity,
      unitPrice,
      invoiceNumber,
      purchaseDate,
    } = req.body;

    const supplier = await PetShopSupplier.findById(req.params.id);
    if (!supplier) {
      return res
        .status(404)
        .json({ success: false, message: "Supplier not found" });
    }

    // Find purchase by _id
    let purchase = supplier.purchaseHistory.id(req.params.purchaseId);
    if (!purchase) {
      purchase = supplier.purchaseHistory.find(
        (p) => p._id && p._id.toString() === req.params.purchaseId,
      );
    }

    if (!purchase) {
      return res
        .status(404)
        .json({ success: false, message: "Purchase record not found" });
    }

    const prevQty = Number(purchase.quantity || 0);
    const prevUnit = Number(purchase.unitPrice || 0);
    const prevTotal = Number(purchase.totalPrice || prevQty * prevUnit);
    const prevProductId = purchase.productId ? String(purchase.productId) : "";

    const nextQty = Number(quantity ?? purchase.quantity ?? 0);
    const nextUnit = Number(unitPrice ?? purchase.unitPrice ?? 0);
    const nextTotal = nextQty * nextUnit;
    const nextProductId = productId ? String(productId) : prevProductId;

    // Adjust supplier total purchases by delta
    supplier.totalPurchases =
      Number(supplier.totalPurchases || 0) - prevTotal + nextTotal;

    // Stock adjustments
    if (prevProductId && nextProductId && prevProductId !== nextProductId) {
      await Product.findByIdAndUpdate(prevProductId, {
        $inc: { quantity: -prevQty },
      });
      await Product.findByIdAndUpdate(nextProductId, {
        $inc: { quantity: nextQty },
      });
    } else if (nextProductId) {
      const delta = nextQty - prevQty;
      if (delta !== 0) {
        await Product.findByIdAndUpdate(nextProductId, {
          $inc: { quantity: delta },
        });
      }
    }

    // Update fields
    purchase.productId = nextProductId || undefined;
    if (productName !== undefined) purchase.productName = productName;
    if (quantity !== undefined) purchase.quantity = nextQty;
    if (unitPrice !== undefined) purchase.unitPrice = nextUnit;
    purchase.totalPrice = nextTotal;
    if (invoiceNumber !== undefined) purchase.invoiceNumber = invoiceNumber;
    if (purchaseDate) purchase.purchaseDate = new Date(purchaseDate);

    await supplier.save();

    res.json({ success: true, data: supplier });
  } catch (error) {
    console.error("Error in PUT purchase:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete a purchase entry from supplier purchase history
router.delete("/:id/purchase/:purchaseId", async (req, res) => {
  try {
    const supplier = await PetShopSupplier.findById(req.params.id);
    if (!supplier) {
      return res
        .status(404)
        .json({ success: false, message: "Supplier not found" });
    }

    // Find purchase by _id
    let purchase = supplier.purchaseHistory.id(req.params.purchaseId);
    if (!purchase) {
      purchase = supplier.purchaseHistory.find(
        (p) => p._id && p._id.toString() === req.params.purchaseId,
      );
    }

    if (!purchase) {
      return res
        .status(404)
        .json({ success: false, message: "Purchase record not found" });
    }

    const qty = Number(purchase.quantity || 0);
    const unit = Number(purchase.unitPrice || 0);
    const total = Number(purchase.totalPrice || qty * unit);
    const pid = purchase.productId ? String(purchase.productId) : "";

    // Remove from supplier totals
    supplier.totalPurchases = Math.max(
      0,
      Number(supplier.totalPurchases || 0) - total,
    );

    // Revert stock increase
    if (pid) {
      await Product.findByIdAndUpdate(pid, { $inc: { quantity: -qty } });
    }

    purchase.deleteOne();
    await supplier.save();

    res.json({ success: true, data: supplier });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Add payment to supplier
router.post("/:id/payment", async (req, res) => {
  try {
    const { amount, paymentMethod, notes, date, invoiceNumber } = req.body;

    const supplier = await PetShopSupplier.findById(req.params.id);
    if (!supplier) {
      return res
        .status(404)
        .json({ success: false, message: "Supplier not found" });
    }

    const paymentAmount = Number(amount || 0);
    if (paymentAmount <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid payment amount" });
    }

    // Ensure paymentHistory exists
    if (!supplier.paymentHistory) {
      supplier.paymentHistory = [];
    }

    // Add to payment history
    supplier.paymentHistory.push({
      amount: paymentAmount,
      paymentMethod: paymentMethod || "Cash",
      notes: notes || "",
      paymentDate: date ? new Date(date) : new Date(),
      invoiceNumber: invoiceNumber || undefined,
    });

    // Update totalPaid
    const currentPaid = Number(supplier.totalPaid || 0);
    supplier.totalPaid = currentPaid + paymentAmount;

    // Create a VendorPayment record
    try {
      await VendorPayment.create({
        portal: "shop",
        supplierId: supplier._id,
        supplierName: supplier.supplierName,
        date: new Date(),
        amount: paymentAmount,
        paymentMethod: paymentMethod || "Cash",
        notes: notes || `Payment for ${invoiceNumber || "account"}`,
        allocations: invoiceNumber
          ? [{ payableId: invoiceNumber, amount: paymentAmount }]
          : [],
      });
    } catch (err) {
      console.error("Error creating vendor payment record from shop:", err);
    }

    // If invoiceNumber is provided, update paidAmount in purchaseHistory
    if (invoiceNumber) {
      const purchase = supplier.purchaseHistory.find(
        (p) =>
          p.invoiceNumber === invoiceNumber ||
          (p._id && p._id.toString() === invoiceNumber),
      );
      if (purchase) {
        purchase.paidAmount = Number(purchase.paidAmount || 0) + paymentAmount;
      }

      // Also update amountPaid and paymentStatus on the PetshopPharmacyPurchase document(s)
      try {
        const pharmPurchases = await PetshopPharmacyPurchase.find({
          invoiceNo: invoiceNumber,
          supplierName: { $regex: new RegExp(`^${supplier.supplierName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        });

        if (pharmPurchases.length > 0) {
          // Total net across all matching docs for proportional distribution
          const totalNet = pharmPurchases.reduce((s, p) => s + Number(p.netTotal || p.totalAmount || 0), 0);

          for (const pp of pharmPurchases) {
            const ppNet = Number(pp.netTotal || pp.totalAmount || 0);
            const ppRemaining = Math.max(0, ppNet - Number(pp.amountPaid || 0));
            // Allocate proportionally based on this doc's share of the total
            const allocation = totalNet > 0
              ? Math.min(ppRemaining, (ppNet / totalNet) * paymentAmount)
              : Math.min(ppRemaining, paymentAmount);

            pp.amountPaid = Number(pp.amountPaid || 0) + allocation;

            if (pp.amountPaid >= ppNet) {
              pp.amountPaid = ppNet;
              pp.paymentStatus = "Paid";
            } else if (pp.amountPaid > 0) {
              pp.paymentStatus = "Partial";
            } else {
              pp.paymentStatus = "Pending";
            }
            await pp.save();
          }
        }
      } catch (err) {
        console.error("Error updating PetshopPharmacyPurchase payment status:", err);
      }

      // Update the Payable balance
      try {
        const payable = await Payable.findOne({
          portal: "shop",
          $or: [
            { billRef: invoiceNumber },
            { supplierId: supplier._id },
          ],
        });

        if (payable) {
          payable.balance = Math.max(0, payable.balance - paymentAmount);
          payable.allocations.push({
            sourceType: "shop_payment",
            amount: paymentAmount,
            date: new Date(),
          });
          if (payable.balance <= 0.0001) {
            payable.balance = 0;
            payable.status = "closed";
          }
          await payable.save();
        }
      } catch (err) {
        console.error("Error updating payable from shop payment:", err);
      }
    }

    await supplier.save();

    res.json({ success: true, data: supplier });
  } catch (error) {
    console.error("Backend: Error recording payment:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Get purchase invoices for a supplier - for Record Payment dropdown
router.get("/:id/invoices", async (req, res) => {
  try {
    const supplier = await PetShopSupplier.findById(req.params.id).lean();
    if (!supplier) return res.status(404).json({ success: false, message: "Supplier not found" });

    // Aggregate by invoiceNumber from purchaseHistory
    const invoiceMap = {};
    for (const p of (supplier.purchaseHistory || [])) {
      const key = p.invoiceNumber || `PUR-${p._id}`;
      if (!invoiceMap[key]) {
        invoiceMap[key] = {
          invoiceNo: p.invoiceNumber || key,
          purchaseDate: p.purchaseDate,
          supplierName: supplier.supplierName,
          netTotal: 0,
          amountPaid: 0,
          paymentStatus: "Pending",
        };
      }
      invoiceMap[key].netTotal += Number(p.totalPrice || 0);
      invoiceMap[key].amountPaid += Number(p.paidAmount || 0);
    }

    const invoices = Object.values(invoiceMap).map(inv => ({
      ...inv,
      remaining: Math.max(0, inv.netTotal - inv.amountPaid),
    }));

    res.json({ success: true, data: invoices });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get all supplied items for a supplier (from PetshopPharmacyPurchase items array)
router.get("/:id/purchase-items", async (req, res) => {
  try {
    const supplier = await PetShopSupplier.findById(req.params.id).lean();
    if (!supplier) return res.status(404).json({ success: false, message: "Supplier not found" });

    const purchases = await PetshopPharmacyPurchase.find({
      supplierName: { $regex: new RegExp(`^${supplier.supplierName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    }).sort({ purchaseDate: -1 }).lean();

    // Flatten all items from all purchase docs, attaching invoice context
    const items = [];
    for (const p of purchases) {
      for (const item of (p.items || [])) {
        items.push({
          invoiceNo: p.invoiceNo || p.purchaseOrderNo,
          purchaseDate: p.purchaseDate,
          medicineName: item.medicineName || "",
          genericName: item.genericName || "",
          batchNo: item.batchNo || "",
          barcode: item.barcode || "",
          category: item.subCategory || item.mainCategory || item.category || "",
          expiryDate: item.expiryDate || null,
          unit: item.unit || "pieces",
          qtyPacks: item.qtyPacks || 0,
          unitsPerPack: item.unitsPerPack || 1,
          totalItems: item.totalItems || item.quantity || 0,
          buyPerPack: item.buyPerPack || 0,
          buyPerUnit: item.buyPerUnit || item.purchasePrice || 0,
          salePerPack: item.salePerPack || 0,
          salePerUnit: item.salePerUnit || item.salePrice || 0,
          lineTotal: item.lineTotal || item.totalCost || 0,
        });
      }
    }

    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get all supplied items for a supplier (legacy — from embedded purchaseHistory)
router.get("/:id/items", async (req, res) => {
  try {
    const supplier = await PetShopSupplier.findById(req.params.id).lean();
    if (!supplier) return res.status(404).json({ success: false, message: "Supplier not found" });

    // Flatten all items from purchaseHistory with invoice context
    const items = (supplier.purchaseHistory || []).map(p => ({
      invoiceNo: p.invoiceNumber || `PUR-${p._id}`,
      purchaseDate: p.purchaseDate,
      medicineName: p.productName,
      genericName: "",
      batchNo: "",
      category: supplier.category || "Product",
      qtyPacks: p.quantity,
      unitsPerPack: 1,
      totalItems: p.quantity,
      unit: "pcs",
      buyPerPack: p.unitPrice,
      buyPerUnit: p.unitPrice,
      salePerPack: p.unitPrice * 1.2, // 20% markup
      salePerUnit: p.unitPrice * 1.2,
      lineTotal: p.totalPrice,
      expiryDate: null,
    }));

    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get petshop pharmacy invoices for a supplier
// Queries PetshopPharmacyPurchase (the actual purchase collection) by supplierName
router.get("/:id/pharmacy-invoices", async (req, res) => {
  try {
    const supplier = await PetShopSupplier.findById(req.params.id).lean();
    if (!supplier) return res.status(404).json({ success: false, message: "Supplier not found" });

    // Match by supplierName (case-insensitive) against the purchase collection
    const purchases = await PetshopPharmacyPurchase.find({
      supplierName: { $regex: new RegExp(`^${supplier.supplierName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    }).sort({ purchaseDate: -1 }).lean();

    // Aggregate by invoiceNo — multiple purchase docs can share the same invoiceNo
    const invoiceMap = {};
    for (const p of purchases) {
      const key = p.invoiceNo || p.purchaseOrderNo;
      if (!invoiceMap[key]) {
        invoiceMap[key] = {
          invoiceNo: key,
          purchaseDate: p.purchaseDate,
          supplierName: p.supplierName,
          netTotal: Number(p.netTotal || p.totalAmount || 0),
          amountPaid: Number(p.amountPaid || 0),
          paymentStatus: p.paymentStatus || "Pending",
          _docIds: [p._id.toString()],
        };
      } else {
        invoiceMap[key].netTotal += Number(p.netTotal || p.totalAmount || 0);
        invoiceMap[key].amountPaid += Number(p.amountPaid || 0);
        invoiceMap[key]._docIds.push(p._id.toString());
      }
    }

    const invoiceList = Object.values(invoiceMap).map(inv => ({
      invoiceNo: inv.invoiceNo,
      purchaseDate: inv.purchaseDate,
      supplierName: inv.supplierName,
      netTotal: inv.netTotal,
      amountPaid: inv.amountPaid,
      paymentStatus: inv.paymentStatus,
      remaining: Math.max(0, inv.netTotal - inv.amountPaid),
      _docIds: inv._docIds,
    }));

    res.json({ success: true, data: invoiceList });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get petshop pharmacy items for a supplier
router.get("/:id/pharmacy-items", async (req, res) => {
  try {
    const supplier = await PetShopSupplier.findById(req.params.id).lean();
    if (!supplier) return res.status(404).json({ success: false, message: "Supplier not found" });
    
    const medicines = await PetshopPharmacyMedicine.find({ supplierName: supplier.supplierName }).sort({ createdAt: -1 }).lean();
    const items = medicines.map(med => ({
      invoiceNo: med.invoiceNo,
      purchaseDate: med.purchaseDate,
      medicineName: med.medicineName,
      genericName: med.genericName || "",
      batchNo: med.batchNo || "",
      category: med.category || "Product",
      qtyPacks: med.qtyPacks || 0,
      unitsPerPack: med.unitsPerPack || 1,
      totalItems: med.totalItems || med.quantity || 0,
      unit: med.unit || "pcs",
      buyPerPack: med.buyPerPack || 0,
      buyPerUnit: med.purchasePrice || 0,
      salePerPack: med.salePerPack || 0,
      salePerUnit: med.salePrice || 0,
      lineTotal: (med.buyPerPack || 0) * (med.qtyPacks || 0),
      expiryDate: med.expiryDate || null,
    }));
    
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
