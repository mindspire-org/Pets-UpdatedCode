import express from "express";
import PetshopPharmacyPurchaseDraft from "../models/PetshopPharmacyPurchaseDraft.js";
import PetshopPharmacyInvoice from "../models/PetshopPharmacyInvoice.js";
import PetshopPharmacyMedicine from "../models/PetshopPharmacyMedicine.js";
import PetshopPharmacyPurchase from "../models/PetshopPharmacyPurchase.js";
import PetShopSupplier from "../models/PetShopSupplier.js";

const router = express.Router();

function recomputeDraftStatus(draft) {
  const statuses = draft.items.map((i) => i.itemStatus || "pending");
  const hasPending  = statuses.includes("pending");
  const hasApproved = statuses.includes("approved");
  const hasRejected = statuses.includes("rejected");

  if (hasPending)                        return "pending";
  if (hasApproved && !hasRejected)       return "approved";
  if (!hasApproved && hasRejected)       return "rejected";
  return "partial";
}

async function createPurchaseRowForItem(item, draft, itemIndex) {
  const uPack = item.unitsPerPack || 1;
  // Use totalItems if present, otherwise compute from packs
  const totalItems = item.totalItems != null ? Number(item.totalItems) : (item.qtyPacks || 0) * uPack;
  const purchaseOrderNo = `${draft.invoiceNo}-ITEM-${itemIndex + 1}-${Date.now()}`;

  const purchaseItem = {
    medicineName:    item.medicineName || "Unknown",
    genericName:     item.genericName  || "",
    batchNo:         item.batchNo      || "N/A",
    barcode:         item.barcode      || "",
    mainCategory:    item.mainCategory || item.category || "General",
    subCategory:     item.subCategory  || item.category || "General",
    category:        item.subCategory  || item.mainCategory || item.category || "General",
    expiryDate:      item.expiryDate   || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    unit:            item.unit         || "pieces",
    containerType:   item.containerType || "",
    qtyPacks:        item.qtyPacks     || 0,
    unitsPerPack:    uPack,
    buyPerPack:      item.buyPerPack   || 0,
    salePerPack:     item.salePerPack  || 0,
    totalItems,
    buyPerUnit:      uPack > 0 ? +((item.buyPerPack  || 0) / uPack).toFixed(4) : 0,
    salePerUnit:     uPack > 0 ? +((item.salePerPack || 0) / uPack).toFixed(4) : 0,
    quantity:        totalItems,
    purchasePrice:   uPack > 0 ? +((item.buyPerPack  || 0) / uPack).toFixed(4) : 0,
    salePrice:       uPack > 0 ? +((item.salePerPack || 0) / uPack).toFixed(4) : 0,
    totalCost:       item.lineTotal    || 0,
    defaultDiscount: item.defaultDiscount || 0,
    lineTaxType:     item.lineTaxType  || "%",
    lineTaxValue:    item.lineTaxValue || 0,
    subtotal:        item.subtotal     || 0,
    discountAmt:     item.discountAmt  || 0,
    taxAmt:          item.taxAmt       || 0,
    lineTotal:       item.lineTotal    || 0,
    minStock:        item.minStock     || 0,
  };

  const purchase = new PetshopPharmacyPurchase({
    purchaseOrderNo,
    supplierName:  draft.supplierName || "Unknown",
    supplierContact: "",
    invoiceNo:     draft.invoiceNo    || "",
    purchaseDate:  draft.invoiceDate  || new Date(),
    items:         [purchaseItem],
    totalAmount:   item.lineTotal     || 0,
    grossTotal:    item.subtotal      || 0,
    totalLineTaxes: item.taxAmt       || 0,
    totalInvoiceTaxes: 0,
    netTotal:      item.lineTotal     || 0,
    paymentStatus: "Pending",
    amountPaid:    0,
    receivedBy:    draft.submittedBy  || "",
    notes:         `Auto-created on item approval from draft ${draft._id}`,
  });

  await purchase.save();
  return purchase;
}

async function createMedicineFromItem(item, draft) {
  const uPack = item.unitsPerPack || 1;
  const quantity = item.totalItems != null ? Number(item.totalItems) : (item.qtyPacks || 0) * uPack;
  const category = item.subCategory || item.mainCategory || item.category || "General";
  const barcode = (item.barcode || "").trim();

  // ── Upsert logic ──────────────────────────────────────────────────────────
  // 0. If we have originalMedicineId, use that first!
  if (item.originalMedicineId) {
    const existing = await PetshopPharmacyMedicine.findById(item.originalMedicineId);
    if (existing) {
      existing.quantity = (existing.quantity || 0) + quantity;
      existing.purchasePrice = uPack > 0 ? +((item.buyPerPack || 0) / uPack).toFixed(4) : existing.purchasePrice;
      existing.salePrice = uPack > 0 ? +((item.salePerPack || 0) / uPack).toFixed(4) : existing.salePrice;
      existing.qtyPacks = (existing.qtyPacks || 0) + (item.qtyPacks || 0);
      existing.isActive = true;
      await existing.save();
      console.log(`[Draft Approve] Updated existing product: ${existing.medicineName} (qty +${quantity})`);
      return existing;
    }
  }

  // 1. Try match by barcode (if provided)
  // 2. Try match by medicineName + batchNo
  // 3. Create new document
  let existing = null;

  if (barcode) {
    existing = await PetshopPharmacyMedicine.findOne({ barcode });
  }

  if (!existing && item.medicineName && item.batchNo) {
    existing = await PetshopPharmacyMedicine.findOne({
      medicineName: item.medicineName,
      batchNo: item.batchNo,
    });
  }

  if (existing) {
    // Add stock to existing product
    existing.quantity = (existing.quantity || 0) + quantity;
    existing.purchasePrice = uPack > 0 ? +((item.buyPerPack || 0) / uPack).toFixed(4) : existing.purchasePrice;
    existing.salePrice = uPack > 0 ? +((item.salePerPack || 0) / uPack).toFixed(4) : existing.salePrice;
    existing.qtyPacks = (existing.qtyPacks || 0) + (item.qtyPacks || 0);
    existing.isActive = true;
    await existing.save();
    console.log(`[Draft Approve] Updated existing product: ${existing.medicineName} (qty +${quantity})`);
    return existing;
  }

  // Create new product
  const newBarcode = barcode || `AUTO-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const med = new PetshopPharmacyMedicine({
    medicineName:  item.medicineName || "Unknown",
    genericName:   item.genericName  || "",
    batchNo:       item.batchNo      || "",
    barcode:       newBarcode,
    mainCategory:  item.mainCategory || item.category || "General",
    subCategory:   item.subCategory  || item.category || "General",
    category,
    expiryDate:    item.expiryDate   || undefined,
    quantity,
    unit:          item.unit         || "pieces",
    containerType: item.containerType || "",
    purchasePrice: uPack > 0 ? +((item.buyPerPack  || 0) / uPack).toFixed(4) : 0,
    salePrice:     uPack > 0 ? +((item.salePerPack || 0) / uPack).toFixed(4) : 0,
    minSalePrice:  0,
    supplierName:  draft.supplierName || "Unknown",
    purchaseDate:  draft.invoiceDate  || new Date(),
    invoiceNo:     draft.invoiceNo    || "INV-1",
    invoiceDate:   draft.invoiceDate,
    lowStockThreshold: item.minStock  || 0,
    minStock:      item.minStock      || 0,
    defaultDiscount: item.defaultDiscount || 0,
    lineTaxType:   item.lineTaxType   || "%",
    lineTaxValue:  item.lineTaxValue  || 0,
    qtyPacks:      item.qtyPacks      || 0,
    unitsPerPack:  uPack,
    buyPerPack:    item.buyPerPack    || 0,
    salePerPack:   item.salePerPack   || 0,
    isActive:      true,
  });
  await med.save();
  console.log(`[Draft Approve] Created new product: ${med.medicineName} (qty ${quantity})`);
  return med;
}

router.get("/", async (req, res) => {
  try {
    const { portal = 'shop', status, supplierName, from, to } = req.query;
    const q = { portal };
    if (status) q.status = status;
    if (supplierName) q.supplierName = { $regex: supplierName, $options: 'i' };
    if (from || to) {
      q.invoiceDate = {};
      if (from) q.invoiceDate.$gte = new Date(from);
      if (to) q.invoiceDate.$lte = new Date(to);
    }
    const drafts = await PetshopPharmacyPurchaseDraft.find(q).sort({ submittedAt: -1 });
    res.json({ success: true, data: drafts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const draft = await PetshopPharmacyPurchaseDraft.findById(req.params.id);
    if (!draft) return res.status(404).json({ success: false, message: 'Draft not found' });
    res.json({ success: true, data: draft });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const payload = { ...req.body, portal: req.body?.portal || 'shop' };
    const draft = new PetshopPharmacyPurchaseDraft(payload);
    draft.status = recomputeDraftStatus(draft);
    await draft.save();
    res.status(201).json({ success: true, data: draft });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const draft = await PetshopPharmacyPurchaseDraft.findById(req.params.id);
    if (!draft) return res.status(404).json({ success: false, message: 'Draft not found' });

    Object.assign(draft, req.body);
    draft.status = recomputeDraftStatus(draft);
    await draft.save();

    res.json({ success: true, data: draft });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post("/:id/review-item", async (req, res) => {
  try {
    const { itemId, itemStatus, reviewedBy, comments } = req.body;
    const draft = await PetshopPharmacyPurchaseDraft.findById(req.params.id);
    if (!draft) return res.status(404).json({ success: false, message: 'Draft not found' });

    const item = draft.items.id(itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

    item.itemStatus = itemStatus;
    item.itemReviewedBy = reviewedBy || '';
    item.itemReviewedAt = new Date();
    item.itemReviewComments = comments || '';

    if (itemStatus === 'approved' && !item.medicineId) {
      const med = await createMedicineFromItem(item.toObject(), draft.toObject());
      item.medicineId = med._id;
      await createPurchaseRowForItem(item.toObject(), draft.toObject(), draft.items.indexOf(item));
    }

    draft.status = recomputeDraftStatus(draft);
    await draft.save();

    res.json({ success: true, data: draft });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ── Per-item approve/reject (REST-style) ─────────────────────────────────────
router.post("/:id/items/:itemId/approve", async (req, res) => {
  try {
    const { reviewedBy, reviewComments } = req.body || {};
    const draft = await PetshopPharmacyPurchaseDraft.findById(req.params.id);
    if (!draft) return res.status(404).json({ success: false, message: 'Draft not found' });

    const item = draft.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

    item.itemStatus = 'approved';
    item.itemReviewedBy = reviewedBy || 'Admin';
    item.itemReviewedAt = new Date();
    item.itemReviewComments = reviewComments || '';

    if (!item.medicineId) {
      const med = await createMedicineFromItem(item.toObject(), draft.toObject());
      item.medicineId = med._id;
      await createPurchaseRowForItem(item.toObject(), draft.toObject(), draft.items.indexOf(item));
    }

    draft.status = recomputeDraftStatus(draft);
    await draft.save();
    res.json({ success: true, data: draft });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post("/:id/items/:itemId/reject", async (req, res) => {
  try {
    const { reviewedBy, reviewComments } = req.body || {};
    const draft = await PetshopPharmacyPurchaseDraft.findById(req.params.id);
    if (!draft) return res.status(404).json({ success: false, message: 'Draft not found' });

    const item = draft.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

    item.itemStatus = 'rejected';
    item.itemReviewedBy = reviewedBy || 'Admin';
    item.itemReviewedAt = new Date();
    item.itemReviewComments = reviewComments || '';

    draft.status = recomputeDraftStatus(draft);
    await draft.save();
    res.json({ success: true, data: draft });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ── Whole-draft approve/reject ────────────────────────────────────────────────
router.post("/:id/approve", async (req, res) => {
  try {
    const { reviewedBy, reviewComments } = req.body || {};
    const draft = await PetshopPharmacyPurchaseDraft.findById(req.params.id);
    if (!draft) return res.status(404).json({ success: false, message: 'Draft not found' });

    for (let i = 0; i < draft.items.length; i++) {
      const item = draft.items[i];
      if (item.itemStatus !== 'pending') continue;
      item.itemStatus = 'approved';
      item.itemReviewedBy = reviewedBy || 'Admin';
      item.itemReviewedAt = new Date();
      item.itemReviewComments = reviewComments || '';
      if (!item.medicineId) {
        const med = await createMedicineFromItem(item.toObject(), draft.toObject());
        item.medicineId = med._id;
        await createPurchaseRowForItem(item.toObject(), draft.toObject(), i);
      }
    }

    draft.status = 'approved';
    draft.reviewedBy = reviewedBy || 'Admin';
    draft.reviewedAt = new Date();
    draft.reviewComments = reviewComments || '';
    await draft.save();
    res.json({ success: true, data: draft });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post("/:id/reject", async (req, res) => {
  try {
    const { reviewedBy, reviewComments } = req.body || {};
    const draft = await PetshopPharmacyPurchaseDraft.findById(req.params.id);
    if (!draft) return res.status(404).json({ success: false, message: 'Draft not found' });

    for (const item of draft.items) {
      if (item.itemStatus === 'pending') {
        item.itemStatus = 'rejected';
        item.itemReviewedBy = reviewedBy || 'Admin';
        item.itemReviewedAt = new Date();
        item.itemReviewComments = reviewComments || '';
      }
    }

    draft.status = 'rejected';
    draft.reviewedBy = reviewedBy || 'Admin';
    draft.reviewedAt = new Date();
    draft.reviewComments = reviewComments || '';
    await draft.save();
    res.json({ success: true, data: draft });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ── Delete draft ──────────────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const draft = await PetshopPharmacyPurchaseDraft.findByIdAndDelete(req.params.id);
    if (!draft) return res.status(404).json({ success: false, message: 'Draft not found' });
    res.json({ success: true, message: 'Draft deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/:id/convert-to-invoice", async (req, res) => {
  try {
    const draft = await PetshopPharmacyPurchaseDraft.findById(req.params.id);
    if (!draft) return res.status(404).json({ success: false, message: 'Draft not found' });

    const invoice = new PetshopPharmacyInvoice({
      invoiceNo: draft.invoiceNo,
      invoiceDate: draft.invoiceDate,
      portal: draft.portal || 'shop',
      supplierName: draft.supplierName,
      supplierId: draft.supplierId,
      companyId: draft.companyId,
      items: (draft.items || []).map(i => ({ ...i.toObject(), medicineId: i.medicineId || undefined })),
      invoiceTaxes: draft.invoiceTaxes,
      grossTotal: draft.grossTotal,
      totalDiscounts: 0,
      totalLineTaxes: draft.totalLineTaxes,
      totalInvoiceTaxes: draft.totalInvoiceTaxes,
      netTotal: draft.netTotal,
      notes: draft.notes,
      status: 'saved',
    });

    await invoice.save();
    draft.convertedInvoiceId = invoice._id;
    await draft.save();

    res.json({ success: true, data: { draft, invoice } });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get("/suppliers/search", async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const portal = String(req.query.portal || 'shop');
    if (!q) return res.json({ success: true, data: [] });

    const suppliers = await PetShopSupplier.find({
      portal,
      supplierName: { $regex: q, $options: 'i' },
    }).limit(25);

    res.json({ success: true, data: suppliers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
