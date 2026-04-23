import express from "express";
import PharmacyInvoice from "../models/PharmacyInvoice.js";
import PharmacyMedicine from "../models/PharmacyMedicine.js";
import Supplier from "../models/Supplier.js";

const router = express.Router();

// ── GET all invoices ─────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { portal = "pharmacy", status, from, to, supplier } = req.query;
    const q = { portal };
    if (status) q.status = status;
    if (supplier) q.supplierName = { $regex: supplier, $options: "i" };
    if (from || to) {
      q.invoiceDate = {};
      if (from) q.invoiceDate.$gte = new Date(from);
      if (to)   q.invoiceDate.$lte = new Date(to);
    }
    const invoices = await PharmacyInvoice.find(q).sort({ invoiceDate: -1 });
    res.json({ success: true, data: invoices });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET single invoice ───────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const invoice = await PharmacyInvoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });
    res.json({ success: true, data: invoice });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST create invoice ──────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const {
      invoiceNo, invoiceDate, portal = "pharmacy",
      supplierName, supplierId, companyId,
      items = [], invoiceTaxes = [],
      grossTotal, totalDiscounts, totalLineTaxes, totalInvoiceTaxes, netTotal,
      notes, status = "saved",
    } = req.body;

    // 1. Save the invoice document
    const invoice = new PharmacyInvoice({
      invoiceNo, invoiceDate, portal,
      supplierName, supplierId: supplierId || undefined, companyId: companyId || undefined,
      items, invoiceTaxes,
      grossTotal, totalDiscounts, totalLineTaxes, totalInvoiceTaxes, netTotal,
      notes, status,
    });
    await invoice.save();

    // 2. Create a PharmacyMedicine record for each item
    const medicineIds = [];
    for (const item of items) {
      const uPack = item.unitsPerPack || 1;
      const med = new PharmacyMedicine({
        medicineName:    item.medicineName,
        genericName:     item.genericName || "",
        batchNo:         item.batchNo || "",
        barcode:         item.barcode || "",
        mainCategory:    item.mainCategory || "",
        subCategory:     item.subCategory || "",
        category:        item.subCategory || item.mainCategory || "",
        expiryDate:      item.expiryDate || undefined,
        quantity:        (item.qtyPacks || 0) * uPack,
        unit:            item.unit || "pieces",
        containerType:   item.containerType || "",
        purchasePrice:   uPack > 0 ? +((item.buyPerPack || 0) / uPack).toFixed(4) : 0,
        salePrice:       uPack > 0 ? +((item.salePerPack || 0) / uPack).toFixed(4) : 0,
        minSalePrice:    0,
        supplierName:    supplierName || "",
        purchaseDate:    invoiceDate,
        invoiceNo:       invoiceNo || "",
        invoiceDate:     invoiceDate,
        lowStockThreshold: item.minStock || 10,
        minStock:        item.minStock || 0,
        defaultDiscount: item.defaultDiscount || 0,
        lineTaxType:     item.lineTaxType || "%",
        lineTaxValue:    item.lineTaxValue || 0,
        qtyPacks:        item.qtyPacks || 0,
        unitsPerPack:    uPack,
        buyPerPack:      item.buyPerPack || 0,
        salePerPack:     item.salePerPack || 0,
        companyId:       companyId || undefined,
        isActive:        true,
      });
      const saved = await med.save();
      medicineIds.push(saved._id);
    }

    // 3. Update supplier purchase history & totals
    if (supplierName && items.length > 0) {
      try {
        const sup = supplierId
          ? await Supplier.findById(supplierId)
          : await Supplier.findOne({ supplierName, portal });

        if (sup) {
          const totalCost = items.reduce((s, it) => {
            const uPack = it.unitsPerPack || 1;
            const unitPrice = uPack > 0 ? (it.buyPerPack || 0) / uPack : 0;
            return s + unitPrice * ((it.qtyPacks || 0) * uPack);
          }, 0);

          for (const item of items) {
            const uPack = item.unitsPerPack || 1;
            const unitPrice = uPack > 0 ? (item.buyPerPack || 0) / uPack : 0;
            const qty = (item.qtyPacks || 0) * uPack;
            sup.purchaseHistory.push({
              productName:   item.medicineName,
              quantity:      qty,
              unitPrice:     unitPrice,
              totalPrice:    unitPrice * qty,
              invoiceNumber: invoiceNo || `INV-${Date.now()}`,
              purchaseDate:  new Date(invoiceDate),
            });
          }
          sup.totalPurchases = Number(sup.totalPurchases || 0) + netTotal;
          await sup.save();
        }
      } catch (supErr) {
        console.error("Supplier update error:", supErr.message);
      }
    }

    res.status(201).json({ success: true, data: invoice, medicineIds });
  } catch (err) {
    console.error("Create invoice error:", err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// ── PUT update invoice ───────────────────────────────────────────────────────
router.put("/:id", async (req, res) => {
  try {
    const invoice = await PharmacyInvoice.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });
    res.json({ success: true, data: invoice });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ── DELETE invoice ───────────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const invoice = await PharmacyInvoice.findByIdAndDelete(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });
    res.json({ success: true, message: "Invoice deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
