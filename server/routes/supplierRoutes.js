import express from "express";
import Supplier from "../models/Supplier.js";
import Product from "../models/Product.js";
import PharmacyMedicine from "../models/PharmacyMedicine.js";
import PharmacyPurchase from "../models/PharmacyPurchase.js";
import Inventory from "../models/Inventory.js";
import Payable from "../models/Payable.js";
import VendorPayment from "../models/VendorPayment.js";
import PetshopPharmacyInvoice from "../models/PetshopPharmacyInvoice.js";
import PetshopPharmacyMedicine from "../models/PetshopPharmacyMedicine.js";

const router = express.Router();

// Get all suppliers (optionally filter by portal)
router.get("/", async (req, res) => {
  try {
    const { portal, status } = req.query;
    const q = {};
    if (portal && portal !== "all") {
      q.portal = portal;
    }
    if (status && status !== "all") {
      q.status = status;
    }
    const suppliers = await Supplier.find(q).sort({ createdAt: -1 });
    res.json({ success: true, data: suppliers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

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
        const portal =
          String(
            raw?.portal ||
              raw?.Portal ||
              raw?.department ||
              raw?.Department ||
              "admin",
          ).trim() || "admin";

        if (!supplierName) {
          stats.failed += 1;
          errors.push({ row: raw, message: "Missing supplierName" });
          continue;
        }

        const update = {
          portal,
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
        };

        const r = await Supplier.updateOne(
          { supplierName, portal },
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
    const supplier = await Supplier.findById(req.params.id);
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
    const supplier = new Supplier(req.body);
    await supplier.save();
    res.status(201).json({ success: true, data: supplier });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update supplier
router.put("/:id", async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
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
    const supplier = await Supplier.findByIdAndDelete(req.params.id);
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
      portal,
    } = req.body;

    const supplier = await Supplier.findById(req.params.id);
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

    // Explicitly handle numerical addition to avoid potential string concatenation or undefined issues
    const currentTotal = Number(supplier.totalPurchases || 0);
    supplier.totalPurchases = currentTotal + totalPrice;

    console.log(
      `Backend: Updating supplier ${supplier.supplierName} (Portal: ${portal || supplier.portal}) totalPurchases: ${currentTotal} -> ${supplier.totalPurchases}`,
    );

    await supplier.save();

    // For pharmacy portal, also create a PharmacyPurchase record for purchase history
    if (portal === "pharmacy") {
      try {
        // Generate purchase order number
        const lastPurchase = await PharmacyPurchase.findOne().sort({
          createdAt: -1,
        });
        let purchaseOrderNo = "PO-0001";
        if (lastPurchase && lastPurchase.purchaseOrderNo) {
          const lastNumber = parseInt(
            lastPurchase.purchaseOrderNo.split("-")[1],
          );
          purchaseOrderNo = `PO-${String(lastNumber + 1).padStart(4, "0")}`;
        }

        const pharmacyPurchase = new PharmacyPurchase({
          purchaseOrderNo,
          supplierName: supplier.supplierName,
          supplierContact: supplier.phone || "",
          invoiceNo: invoiceNumber || `INV-${Date.now()}`,
          purchaseDate: new Date(),
          items: [
            {
              medicineName: productName,
              batchNo: `BATCH-${Date.now()}`,
              category: "Medicine",
              quantity: Number(quantity || 0),
              unit: "pcs",
              purchasePrice: Number(unitPrice || 0),
              salePrice: Number(unitPrice || 0) * 1.2, // 20% markup
              totalCost: totalPrice,
              expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
            },
          ],
          totalAmount: totalPrice,
          paymentStatus: "Pending",
          amountPaid: 0,
          notes: `Purchase from ${supplier.supplierName}`,
          receivedBy: "System",
        });

        await pharmacyPurchase.save();
        console.log(
          `Backend: Created PharmacyPurchase record for ${productName}`,
        );
      } catch (err) {
        console.error("Error creating PharmacyPurchase record:", err);
      }
    }

    // Create a corresponding Payable record for the Admin portal
    try {
      const activePortal = portal || supplier.portal || "shop";

      await Payable.create({
        portal: activePortal,
        supplierId: supplier._id,
        supplierName: supplier.supplierName,
        billRef: invoiceNumber || `PUR-${Date.now()}`,
        billDate: new Date(),
        totalAmount: totalPrice,
        balance: totalPrice,
        status: "open",
        description: `Purchase of ${quantity} x ${productName || "product"} (${activePortal})`,
      });

      console.log(`Backend: Created Payable for ${activePortal}`);
    } catch (err) {
      console.error("Error creating payable from purchase:", err);
    }

    // Update product stock if productId provided (for shop portal)
    if (productId) {
      if (!portal || portal === "shop") {
        await Product.findByIdAndUpdate(productId, {
          $inc: { quantity: Number(quantity || 0) },
        });
      } else if (portal === "pharmacy") {
        await PharmacyMedicine.findByIdAndUpdate(productId, {
          $inc: { quantity: Number(quantity || 0) },
        });
      } else if (portal === "lab") {
        await Inventory.findByIdAndUpdate(productId, {
          $inc: { quantity: Number(quantity || 0) },
        });
      }
    }

    res.json({ success: true, data: supplier });
  } catch (error) {
    console.error("Error in POST purchase:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update a purchase entry in supplier purchase history (and adjust product stock)
router.put("/:id/purchase/:purchaseId", async (req, res) => {
  try {
    console.log("PUT purchase request:", req.params, req.body);
    const {
      productId,
      productName,
      quantity,
      unitPrice,
      invoiceNumber,
      purchaseDate,
    } = req.body;

    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res
        .status(404)
        .json({ success: false, message: "Supplier not found" });
    }

    console.log("Looking for purchaseId:", req.params.purchaseId);
    console.log(
      "Available purchases:",
      supplier.purchaseHistory.map((p, i) => ({
        index: i,
        _id: p._id?.toString(),
        productName: p.productName,
      })),
    );

    // Find purchase by _id using Mongoose's subdocument .id() method or manual find
    let purchase = supplier.purchaseHistory.id(req.params.purchaseId);

    // Fallback: if .id() doesn't work (maybe _id missing), try manual find
    if (!purchase) {
      purchase = supplier.purchaseHistory.find(
        (p) => p._id && p._id.toString() === req.params.purchaseId,
      );
    }

    console.log("Found purchase:", purchase);
    if (!purchase) {
      console.log("Purchase not found with ID:", req.params.purchaseId);
      return res
        .status(404)
        .json({ success: false, message: "Purchase record not found" });
    }

    console.log("Before update - purchase:", purchase);

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

    // Stock adjustments:
    // - If product changed: decrement old product by prevQty and increment new product by nextQty
    // - Else: increment by (nextQty - prevQty)
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

    console.log("After update - purchase:", purchase);

    await supplier.save();
    console.log(
      "After save - supplier purchaseHistory length:",
      supplier.purchaseHistory.length,
    );

    res.json({ success: true, data: supplier });
  } catch (error) {
    console.error("Error in PUT purchase:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete a purchase entry from supplier purchase history (and adjust product stock)
router.delete("/:id/purchase/:purchaseId", async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res
        .status(404)
        .json({ success: false, message: "Supplier not found" });
    }

    // Find purchase by _id using Mongoose's subdocument .id() method or manual find
    let purchase = supplier.purchaseHistory.id(req.params.purchaseId);

    // Fallback: if .id() doesn't work (maybe _id missing), try manual find
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

    // Revert stock increase that was done when recording purchase
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
    console.log(
      "Backend: Processing payment for supplier:",
      req.params.id,
      req.body,
    );

    const supplier = await Supplier.findById(req.params.id);
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

    // Explicitly update totalPaid
    const currentPaid = Number(supplier.totalPaid || 0);
    supplier.totalPaid = currentPaid + paymentAmount;

    // Create a VendorPayment record so it shows up in the Admin "Vendor Payments" list
    try {
      await VendorPayment.create({
        portal: "shop",
        supplierId: supplier._id,
        supplierName: supplier.supplierName,
        date: new Date(),
        amount: paymentAmount,
        paymentMethod: "Cash",
        notes: notes || `Payment for ${invoiceNumber || "account"}`,
        allocations: invoiceNumber
          ? [{ payableId: invoiceNumber, amount: paymentAmount }]
          : [],
      });
    } catch (err) {
      console.error("Error creating vendor payment record from shop:", err);
    }

    // If invoiceNumber is provided, update paidAmount in purchaseHistory and update Payable balance
    if (invoiceNumber) {
      const purchase = supplier.purchaseHistory.find(
        (p) =>
          p.invoiceNumber === invoiceNumber ||
          p._id.toString() === invoiceNumber,
      );
      if (purchase) {
        purchase.paidAmount = Number(purchase.paidAmount || 0) + paymentAmount;
        console.log(
          `Backend: Updated paidAmount for invoice ${invoiceNumber}: ${purchase.paidAmount}`,
        );
      }

      // Update the Payable balance in the Admin portal database
      try {
        const payable = await Payable.findOne({
          portal: "shop",
          $or: [
            { billRef: invoiceNumber },
            { supplierId: supplier._id, totalAmount: purchase?.totalPrice }, // Fallback if billRef mismatch
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

    console.log(
      `Backend: Supplier ${supplier.supplierName} totalPaid updated: ${currentPaid} -> ${supplier.totalPaid}`,
    );

    await supplier.save();

    // Also update PharmacyPurchase records for this invoice
    if (invoiceNumber) {
      try {
        // Find all PharmacyPurchase rows for this invoice
        const pharmPurchases = await PharmacyPurchase.find({
          invoiceNo: invoiceNumber,
          supplierName: { $regex: new RegExp(`^${supplier.supplierName}$`, "i") },
        });

        if (pharmPurchases.length > 0) {
          // Distribute payment proportionally across rows by netTotal
          const invoiceNetTotal = pharmPurchases.reduce((s, p) => s + Number(p.netTotal || p.totalAmount || 0), 0);
          let remaining = paymentAmount;

          for (const pp of pharmPurchases) {
            const rowTotal = Number(pp.netTotal || pp.totalAmount || 0);
            const proportion = invoiceNetTotal > 0 ? rowTotal / invoiceNetTotal : 1 / pharmPurchases.length;
            const rowPayment = Math.min(
              Math.round(paymentAmount * proportion * 100) / 100,
              Math.max(0, rowTotal - Number(pp.amountPaid || 0)),
              remaining
            );
            pp.amountPaid = Number(pp.amountPaid || 0) + rowPayment;
            remaining -= rowPayment;
            // Update paymentStatus
            const rowRemaining = rowTotal - pp.amountPaid;
            if (rowRemaining <= 0.01) {
              pp.paymentStatus = "Paid";
            } else if (pp.amountPaid > 0) {
              pp.paymentStatus = "Partial";
            }
            await pp.save();
          }
        }
      } catch (err) {
        console.error("Error updating PharmacyPurchase payment:", err);
      }
    }

    res.json({ success: true, data: supplier });
  } catch (error) {
    console.error("Backend: Error recording payment:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Get PharmacyPurchase invoices for a supplier (by name) — for Record Payment dropdown
router.get("/:id/pharmacy-invoices", async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id).lean();
    if (!supplier) return res.status(404).json({ success: false, message: "Supplier not found" });

    let invoices;
    if (supplier.portal === "shop") {
      // Use Petshop's own PetshopPharmacyInvoice collection
      const petshopInvoices = await PetshopPharmacyInvoice.find({
        supplierName: { $regex: new RegExp(`^${supplier.supplierName}$`, "i") },
        portal: "shop"
      }).sort({ invoiceDate: -1 }).lean();

      const invoiceMap = {};
      for (const inv of petshopInvoices) {
        const key = inv.invoiceNo;
        if (!invoiceMap[key]) {
          invoiceMap[key] = {
            invoiceNo: inv.invoiceNo,
            purchaseDate: inv.invoiceDate,
            supplierName: inv.supplierName,
            netTotal: Number(inv.netTotal || 0),
            amountPaid: 0,
            paymentStatus: "Pending",
            purchaseIds: [String(inv._id)],
          };
        }
      }

      invoices = Object.values(invoiceMap).map(inv => ({
        ...inv,
        remaining: Math.max(0, inv.netTotal - inv.amountPaid),
      }));
    } else {
      // Use PharmacyPurchase for other portals (pharmacy)
      const purchases = await PharmacyPurchase.find({
        supplierName: { $regex: new RegExp(`^${supplier.supplierName}$`, "i") }
      }).sort({ purchaseDate: -1 }).lean();

      const invoiceMap = {};
      for (const p of purchases) {
        const key = p.invoiceNo;
        if (!invoiceMap[key]) {
          invoiceMap[key] = {
            invoiceNo: p.invoiceNo,
            purchaseDate: p.purchaseDate,
            supplierName: p.supplierName,
            netTotal: 0,
            amountPaid: 0,
            paymentStatus: p.paymentStatus || "Pending",
            purchaseIds: [],
          };
        }
        invoiceMap[key].netTotal += Number(p.netTotal || p.totalAmount || 0);
        invoiceMap[key].amountPaid += Number(p.amountPaid || 0);
        invoiceMap[key].purchaseIds.push(String(p._id));
      }

      invoices = Object.values(invoiceMap).map(inv => ({
        ...inv,
        remaining: Math.max(0, inv.netTotal - inv.amountPaid),
      }));
    }

    res.json({ success: true, data: invoices });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get all individual supplied items for a supplier — for Supplied Items tab
router.get("/:id/pharmacy-items", async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id).lean();
    if (!supplier) return res.status(404).json({ success: false, message: "Supplier not found" });

    let items;
    if (supplier.portal === "shop") {
      // Use Petshop's own PetshopPharmacyMedicine collection
      const petshopMedicines = await PetshopPharmacyMedicine.find({
        supplierName: { $regex: new RegExp(`^${supplier.supplierName}$`, "i") }
      }).sort({ purchaseDate: -1 }).lean();

      items = petshopMedicines.map(med => ({
        invoiceNo: med.invoiceNo,
        purchaseDate: med.purchaseDate,
        medicineName: med.medicineName,
        genericName: med.genericName || "",
        batchNo: med.batchNo || "",
        category: med.subCategory || med.category || "",
        qtyPacks: med.qtyPacks || 0,
        unitsPerPack: med.unitsPerPack || 1,
        totalItems: med.totalItems || med.quantity || 0,
        unit: med.unit || "pcs",
        buyPerPack: med.buyPerPack || med.purchasePrice || 0,
        buyPerUnit: med.purchasePrice || 0,
        salePerPack: med.salePerPack || med.salePrice || 0,
        salePerUnit: med.salePrice || 0,
        lineTotal: (med.buyPerPack || med.purchasePrice || 0) * (med.qtyPacks || 1),
        expiryDate: med.expiryDate,
      }));
    } else {
      // Use PharmacyPurchase for other portals (pharmacy)
      const purchases = await PharmacyPurchase.find({
        supplierName: { $regex: new RegExp(`^${supplier.supplierName}$`, "i") }
      }).sort({ purchaseDate: -1 }).lean();

      const itemsArray = [];
      for (const p of purchases) {
        for (const item of (p.items || [])) {
          itemsArray.push({
            invoiceNo: p.invoiceNo,
            purchaseDate: p.purchaseDate,
            medicineName: item.medicineName,
            genericName: item.genericName || "",
            batchNo: item.batchNo || "",
            category: item.subCategory || item.category || "",
            qtyPacks: item.qtyPacks || 0,
            unitsPerPack: item.unitsPerPack || 1,
            totalItems: item.totalItems || item.quantity || 0,
            unit: item.unit || "pcs",
            buyPerPack: item.buyPerPack || item.purchasePrice || 0,
            buyPerUnit: item.buyPerUnit || item.purchasePrice || 0,
            salePerPack: item.salePerPack || item.salePrice || 0,
            salePerUnit: item.salePerUnit || item.salePrice || 0,
            lineTotal: item.lineTotal || item.totalCost || 0,
            expiryDate: item.expiryDate,
          });
        }
      }
      items = itemsArray;
    }

    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
