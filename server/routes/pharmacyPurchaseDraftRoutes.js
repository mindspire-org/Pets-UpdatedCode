import express from "express";
import PharmacyPurchaseDraft from "../models/PharmacyPurchaseDraft.js";
import PharmacyInvoice from "../models/PharmacyInvoice.js";
import PharmacyMedicine from "../models/PharmacyMedicine.js";
import PharmacyPurchase from "../models/PharmacyPurchase.js";
import Supplier from "../models/Supplier.js";

const router = express.Router();

// ── Helper: recompute draft-level status from item statuses ─────────────────
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

// ── Helper: create a PharmacyPurchase row for a single approved item ─────────
async function createPurchaseRowForItem(item, draft, itemIndex) {
  const uPack = item.unitsPerPack || 1;
  // Unique PO per item: invoiceNo + item index + timestamp suffix
  const purchaseOrderNo = `${draft.invoiceNo}-ITEM-${itemIndex + 1}-${Date.now()}`;

  const purchaseItem = {
    medicineName:    item.medicineName,
    genericName:     item.genericName  || "",
    batchNo:         item.batchNo      || "N/A",
    barcode:         item.barcode      || "",
    mainCategory:    item.mainCategory || "",
    subCategory:     item.subCategory  || "",
    category:        item.subCategory  || item.mainCategory || "",
    expiryDate:      item.expiryDate   || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    unit:            item.unit         || "pieces",
    containerType:   item.containerType || "",
    qtyPacks:        item.qtyPacks     || 0,
    unitsPerPack:    uPack,
    buyPerPack:      item.buyPerPack   || 0,
    salePerPack:     item.salePerPack  || 0,
    totalItems:      (item.qtyPacks || 0) * uPack,
    buyPerUnit:      uPack > 0 ? +((item.buyPerPack  || 0) / uPack).toFixed(4) : 0,
    salePerUnit:     uPack > 0 ? +((item.salePerPack || 0) / uPack).toFixed(4) : 0,
    // legacy compat
    quantity:        (item.qtyPacks || 0) * uPack,
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

  const purchase = new PharmacyPurchase({
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

// ── Helper: create a PharmacyMedicine record from a draft item ──────────────
async function createMedicineFromItem(item, draft) {
  const uPack = item.unitsPerPack || 1;
  const med = new PharmacyMedicine({
    medicineName:  item.medicineName,
    genericName:   item.genericName  || "",
    batchNo:       item.batchNo      || "",
    barcode:       item.barcode      || "",
    mainCategory:  item.mainCategory || "",
    subCategory:   item.subCategory  || "",
    category:      item.subCategory  || item.mainCategory || "",
    expiryDate:    item.expiryDate   || undefined,
    quantity:      (item.qtyPacks || 0) * uPack,
    unit:          item.unit         || "pieces",
    containerType: item.containerType || "",
    purchasePrice: uPack > 0 ? +((item.buyPerPack  || 0) / uPack).toFixed(4) : 0,
    salePrice:     uPack > 0 ? +((item.salePerPack || 0) / uPack).toFixed(4) : 0,
    minSalePrice:  0,
    supplierName:  draft.supplierName || "",
    purchaseDate:  draft.invoiceDate,
    invoiceNo:     draft.invoiceNo    || "",
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
  return med;
}

// ── GET all purchase drafts ─────────────────────────────────────────────────
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
    const drafts = await PharmacyPurchaseDraft.find(q).sort({ submittedAt: -1 });

    // Normalize: old records may not have itemStatus on each item — default to "pending"
    const normalized = drafts.map((d) => {
      const obj = d.toObject();
      obj.items = (obj.items || []).map((item) => ({
        ...item,
        itemStatus: item.itemStatus || "pending",
      }));
      return obj;
    });

    res.json({ success: true, data: normalized });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET single purchase draft ───────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const draft = await PharmacyPurchaseDraft.findById(req.params.id);
    if (!draft) return res.status(404).json({ success: false, message: "Draft not found" });
    res.json({ success: true, data: draft });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST create purchase draft ──────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const {
      invoiceNo, invoiceDate, portal = "pharmacy",
      supplierName, supplierId, companyId,
      items = [], invoiceTaxes = [],
      grossTotal, totalLineTaxes, totalInvoiceTaxes, netTotal,
      notes, submittedBy = "Pharmacy User",
    } = req.body;

    // Ensure every item starts with itemStatus = 'pending'
    const stampedItems = items.map((it) => ({ ...it, itemStatus: "pending" }));

    const draft = new PharmacyPurchaseDraft({
      invoiceNo, invoiceDate, portal,
      supplierName,
      supplierId:  supplierId  || undefined,
      companyId:   companyId   || undefined,
      items: stampedItems,
      invoiceTaxes,
      grossTotal, totalLineTaxes, totalInvoiceTaxes, netTotal,
      notes, submittedBy,
      status: "pending",
    });

    await draft.save();
    res.status(201).json({ success: true, data: draft, message: "Draft submitted for review" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST approve a single item ──────────────────────────────────────────────
// PATCH /api/pharmacy-purchase-drafts/:draftId/items/:itemId/approve
router.post("/:draftId/items/:itemId/approve", async (req, res) => {
  try {
    const { reviewedBy = "Admin", reviewComments = "" } = req.body;
    const draft = await PharmacyPurchaseDraft.findById(req.params.draftId);
    if (!draft) return res.status(404).json({ success: false, message: "Draft not found" });

    const item = draft.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });

    // Treat missing itemStatus as "pending" for old records
    const currentStatus = item.itemStatus || "pending";
    if (currentStatus !== "pending") {
      return res.status(400).json({ success: false, message: `Item already ${currentStatus}` });
    }

    // Create the medicine record
    const med = await createMedicineFromItem(item, draft);

    // Create a PharmacyPurchase row for this item (shows in purchase history)
    const itemIndex = draft.items.findIndex((i) => String(i._id) === String(req.params.itemId));
    const purchase = await createPurchaseRowForItem(item, draft, itemIndex >= 0 ? itemIndex : 0);
    
    // Save reviewer name to the purchase record
    purchase.reviewedBy = reviewedBy;
    await purchase.save();

    // Mark item approved
    item.itemStatus         = "approved";
    item.itemReviewedBy     = reviewedBy;
    item.itemReviewedAt     = new Date();
    item.itemReviewComments = reviewComments;
    item.medicineId         = med._id;

    // Recompute overall draft status
    draft.status     = recomputeDraftStatus(draft);
    draft.reviewedBy = reviewedBy;
    draft.reviewedAt = new Date();

    // If draft is now fully resolved, create the invoice record
    if (draft.status !== "pending") {
      const approvedItems = draft.items.filter((i) => i.itemStatus === "approved");
      if (approvedItems.length > 0) {
        const invoice = new PharmacyInvoice({
          invoiceNo:         draft.invoiceNo,
          invoiceDate:       draft.invoiceDate,
          portal:            draft.portal,
          supplierName:      draft.supplierName,
          supplierId:        draft.supplierId,
          companyId:         draft.companyId,
          items:             approvedItems,
          invoiceTaxes:      draft.invoiceTaxes,
          grossTotal:        approvedItems.reduce((s, i) => s + (i.subtotal || 0), 0),
          totalLineTaxes:    approvedItems.reduce((s, i) => s + (i.taxAmt   || 0), 0),
          totalInvoiceTaxes: 0,
          netTotal:          approvedItems.reduce((s, i) => s + (i.lineTotal || 0), 0),
          notes:             draft.notes,
          status:            "saved",
        });
        await invoice.save();
        draft.convertedInvoiceId = invoice._id;

        // Update supplier
        if (draft.supplierId) {
          try {
            await Supplier.findByIdAndUpdate(draft.supplierId, {
              $inc: { totalPurchases: invoice.netTotal },
              $push: { purchaseHistory: { invoiceNo: draft.invoiceNo, amount: invoice.netTotal, date: draft.invoiceDate } },
            });
          } catch {}
        }
      }
    }

    await draft.save();
    res.json({ success: true, data: draft, message: `Item approved and added to inventory` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST reject a single item ───────────────────────────────────────────────
router.post("/:draftId/items/:itemId/reject", async (req, res) => {
  try {
    const { reviewedBy = "Admin", reviewComments = "" } = req.body;
    const draft = await PharmacyPurchaseDraft.findById(req.params.draftId);
    if (!draft) return res.status(404).json({ success: false, message: "Draft not found" });

    const item = draft.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, message: "Item not found" });

    // Treat missing itemStatus as "pending" for old records
    const currentStatus = item.itemStatus || "pending";
    if (currentStatus !== "pending") {
      return res.status(400).json({ success: false, message: `Item already ${currentStatus}` });
    }

    item.itemStatus         = "rejected";
    item.itemReviewedBy     = reviewedBy;
    item.itemReviewedAt     = new Date();
    item.itemReviewComments = reviewComments;

    draft.status     = recomputeDraftStatus(draft);
    draft.reviewedBy = reviewedBy;
    draft.reviewedAt = new Date();

    // If fully resolved with some approved items, create invoice
    if (draft.status !== "pending") {
      const approvedItems = draft.items.filter((i) => i.itemStatus === "approved");
      if (approvedItems.length > 0 && !draft.convertedInvoiceId) {
        const invoice = new PharmacyInvoice({
          invoiceNo:         draft.invoiceNo,
          invoiceDate:       draft.invoiceDate,
          portal:            draft.portal,
          supplierName:      draft.supplierName,
          supplierId:        draft.supplierId,
          companyId:         draft.companyId,
          items:             approvedItems,
          invoiceTaxes:      draft.invoiceTaxes,
          grossTotal:        approvedItems.reduce((s, i) => s + (i.subtotal || 0), 0),
          totalLineTaxes:    approvedItems.reduce((s, i) => s + (i.taxAmt   || 0), 0),
          totalInvoiceTaxes: 0,
          netTotal:          approvedItems.reduce((s, i) => s + (i.lineTotal || 0), 0),
          notes:             draft.notes,
          status:            "saved",
        });
        await invoice.save();
        draft.convertedInvoiceId = invoice._id;
      }
    }

    await draft.save();
    res.json({ success: true, data: draft, message: "Item rejected" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST approve ALL pending items in a draft ───────────────────────────────
router.post("/:id/approve", async (req, res) => {
  try {
    const { reviewedBy = "Admin", reviewComments = "" } = req.body;
    const draft = await PharmacyPurchaseDraft.findById(req.params.id);
    if (!draft) return res.status(404).json({ success: false, message: "Draft not found" });
    if (draft.status !== "pending") {
      return res.status(400).json({ success: false, message: "Draft already reviewed" });
    }

    const medicineIds = [];
    for (const [idx, item] of draft.items.entries()) {
      if (item.itemStatus !== "pending") continue;
      const med = await createMedicineFromItem(item, draft);
      // Create a PharmacyPurchase row for this item
      const purchase = await createPurchaseRowForItem(item, draft, idx);
      
      // Save reviewer name to the purchase record
      purchase.reviewedBy = reviewedBy;
      await purchase.save();

      item.itemStatus         = "approved";
      item.itemReviewedBy     = reviewedBy;
      item.itemReviewedAt     = new Date();
      item.itemReviewComments = reviewComments;
      item.medicineId         = med._id;
      medicineIds.push(med._id);
    }

    draft.status     = recomputeDraftStatus(draft);
    draft.reviewedBy = reviewedBy;
    draft.reviewedAt = new Date();
    draft.reviewComments = reviewComments;

    const invoice = new PharmacyInvoice({
      invoiceNo: draft.invoiceNo, invoiceDate: draft.invoiceDate,
      portal: draft.portal, supplierName: draft.supplierName,
      supplierId: draft.supplierId, companyId: draft.companyId,
      items: draft.items, invoiceTaxes: draft.invoiceTaxes,
      grossTotal: draft.grossTotal, totalLineTaxes: draft.totalLineTaxes,
      totalInvoiceTaxes: draft.totalInvoiceTaxes, netTotal: draft.netTotal,
      notes: draft.notes, status: "saved",
    });
    await invoice.save();
    draft.convertedInvoiceId = invoice._id;

    if (draft.supplierId) {
      try {
        await Supplier.findByIdAndUpdate(draft.supplierId, {
          $inc: { totalPurchases: draft.netTotal },
          $push: { purchaseHistory: { invoiceNo: draft.invoiceNo, amount: draft.netTotal, date: draft.invoiceDate } },
        });
      } catch {}
    }

    await draft.save();
    res.json({ success: true, data: draft, message: `All items approved — ${medicineIds.length} medicine(s) added` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST reject ALL pending items in a draft ────────────────────────────────
router.post("/:id/reject", async (req, res) => {
  try {
    const { reviewedBy = "Admin", reviewComments = "" } = req.body;
    const draft = await PharmacyPurchaseDraft.findById(req.params.id);
    if (!draft) return res.status(404).json({ success: false, message: "Draft not found" });
    if (draft.status !== "pending") {
      return res.status(400).json({ success: false, message: "Draft already reviewed" });
    }

    for (const item of draft.items) {
      if (item.itemStatus !== "pending") continue;
      item.itemStatus         = "rejected";
      item.itemReviewedBy     = reviewedBy;
      item.itemReviewedAt     = new Date();
      item.itemReviewComments = reviewComments;
    }

    draft.status         = recomputeDraftStatus(draft);
    draft.reviewedBy     = reviewedBy;
    draft.reviewedAt     = new Date();
    draft.reviewComments = reviewComments;

    await draft.save();
    res.json({ success: true, data: draft, message: "All items rejected" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT update purchase draft ───────────────────────────────────────────────
router.put("/:id", async (req, res) => {
  try {
    const {
      invoiceNo, invoiceDate, portal,
      supplierName, supplierId, companyId,
      items, invoiceTaxes,
      grossTotal, totalLineTaxes, totalInvoiceTaxes, netTotal,
      notes
    } = req.body;

    const draft = await PharmacyPurchaseDraft.findById(req.params.id);
    if (!draft) return res.status(404).json({ success: false, message: "Draft not found" });

    // Update fields
    if (invoiceNo) draft.invoiceNo = invoiceNo;
    if (invoiceDate) draft.invoiceDate = invoiceDate;
    if (portal) draft.portal = portal;
    if (supplierName) draft.supplierName = supplierName;
    draft.supplierId = supplierId || undefined;
    draft.companyId = companyId || undefined;
    
    // For items, ensure they maintain 'pending' status if they are new or modified
    if (items) {
      draft.items = items.map(it => ({
        ...it,
        itemStatus: it.itemStatus || "pending"
      }));
    }
    
    if (invoiceTaxes) draft.invoiceTaxes = invoiceTaxes;
    if (grossTotal !== undefined) draft.grossTotal = grossTotal;
    if (totalLineTaxes !== undefined) draft.totalLineTaxes = totalLineTaxes;
    if (totalInvoiceTaxes !== undefined) draft.totalInvoiceTaxes = totalInvoiceTaxes;
    if (netTotal !== undefined) draft.netTotal = netTotal;
    if (notes !== undefined) draft.notes = notes;

    // Reset overall status to pending if it was rejected or partial
    draft.status = "pending";

    await draft.save();
    res.json({ success: true, data: draft, message: "Draft updated successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE draft ────────────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const draft = await PharmacyPurchaseDraft.findById(req.params.id);
    if (!draft) return res.status(404).json({ success: false, message: "Draft not found" });
    
    await PharmacyPurchaseDraft.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Draft deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET stats ───────────────────────────────────────────────────────────────
router.get("/stats/summary", async (req, res) => {
  try {
    const { portal = "pharmacy" } = req.query;
    const stats = await PharmacyPurchaseDraft.aggregate([
      { $match: { portal } },
      { $group: { _id: "$status", count: { $sum: 1 }, totalValue: { $sum: "$netTotal" } } },
    ]);
    const summary = {
      pending:  { count: 0, totalValue: 0 },
      approved: { count: 0, totalValue: 0 },
      rejected: { count: 0, totalValue: 0 },
      partial:  { count: 0, totalValue: 0 },
    };
    stats.forEach((s) => { if (summary[s._id]) summary[s._id] = { count: s.count, totalValue: s.totalValue }; });
    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
