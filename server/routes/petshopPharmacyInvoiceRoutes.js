import express from "express";
import PetshopPharmacyInvoice from "../models/PetshopPharmacyInvoice.js";
import PetshopPharmacyMedicine from "../models/PetshopPharmacyMedicine.js";
import PetShopSupplier from "../models/PetShopSupplier.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { portal = "shop", status, from, to, supplier } = req.query;
    const q = { portal };
    if (status) q.status = status;
    if (supplier) q.supplierName = { $regex: supplier, $options: "i" };
    if (from || to) {
      q.invoiceDate = {};
      if (from) q.invoiceDate.$gte = new Date(from);
      if (to) q.invoiceDate.$lte = new Date(to);
    }
    const invoices = await PetshopPharmacyInvoice.find(q).sort({ invoiceDate: -1 });
    res.json({ success: true, data: invoices });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const invoice = await PetshopPharmacyInvoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });
    res.json({ success: true, data: invoice });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const {
      invoiceNo, invoiceDate, portal = "shop",
      supplierName, supplierId, companyId,
      items = [], invoiceTaxes = [],
      grossTotal, totalDiscounts, totalLineTaxes, totalInvoiceTaxes, netTotal,
      notes, status = "saved",
    } = req.body;

    const invoice = new PetshopPharmacyInvoice({
      invoiceNo, invoiceDate, portal,
      supplierName, supplierId: supplierId || undefined, companyId: companyId || undefined,
      items, invoiceTaxes,
      grossTotal, totalDiscounts, totalLineTaxes, totalInvoiceTaxes, netTotal,
      notes, status,
    });
    await invoice.save();

    const medicineIds = [];
    for (const item of items) {
      const uPack = item.unitsPerPack || 1;
      // Use totalItems if available, otherwise calculate
      const qty = item.totalItems != null ? Number(item.totalItems) : (item.qtyPacks || 0) * uPack;
      const med = new PetshopPharmacyMedicine({
        medicineName:    item.medicineName,
        genericName:     item.genericName || "",
        batchNo:         item.batchNo || "",
        barcode:         item.barcode || "",
        mainCategory:    item.mainCategory || "",
        subCategory:     item.subCategory || "",
        category:        item.subCategory || item.mainCategory || "",
        expiryDate:      item.expiryDate || undefined,
        quantity:        qty,
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
        totalItems:      qty,
        companyId:       companyId || undefined,
        isActive:        true,
      });
      const saved = await med.save();
      medicineIds.push(saved._id);
    }

    if (supplierName && items.length > 0) {
      try {
        const sup = supplierId
          ? await PetShopSupplier.findById(supplierId)
          : await PetShopSupplier.findOne({ supplierName, portal });

        if (sup) {
          const totalCost = items.reduce((s, it) => {
            const uPack = it.unitsPerPack || 1;
            const unitPrice = uPack > 0 ? (it.buyPerPack || 0) / uPack : 0;
            const qty = it.totalItems != null ? Number(it.totalItems) : (it.qtyPacks || 0) * uPack;
            return s + unitPrice * qty;
          }, 0);

          for (const item of items) {
            const uPack = item.unitsPerPack || 1;
            const unitPrice = uPack > 0 ? (item.buyPerPack || 0) / uPack : 0;
            const qty = item.totalItems != null ? Number(item.totalItems) : (item.qtyPacks || 0) * uPack;
            sup.purchaseHistory.push({
              productName:   item.medicineName,
              quantity:      qty,
              unitPrice:     unitPrice,
              totalPrice:    unitPrice * qty,
              purchaseDate:  invoiceDate || new Date(),
              invoiceNumber: invoiceNo || '',
            });
          }

          sup.totalPurchases = (sup.totalPurchases || 0) + totalCost;
          await sup.save();
        }
      } catch {}
    }

    res.status(201).json({ success: true, data: invoice, medicineIds });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

export default router;
