import express from 'express';
import mongoose from 'mongoose';
import Inventory from '../models/Inventory.js';
import JournalEntry from '../models/JournalEntry.js';
import { postInventoryPurchase } from '../utils/accountingService.js';
import dayGuard from '../middleware/dayGuard.js';
import DailyLog from '../models/DailyLog.js';
const router = express.Router();
router.get('/', async (req, res) => {
  try {
    const items = await Inventory.find().sort({ createdAt: -1 });
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/categories', async (req, res) => {
  try {
    const { department } = req.query;
    const filter = {};
    if (department) filter.department = department;
    const defaultsLab = ['Reagents','Test Kits','Chemicals','Consumables','Glassware','Equipment','Stains & Dyes','Calibrators','Controls','Buffers','Tubes & Vials','Other'];
    const dbCats = await Inventory.distinct('category', filter);
    const merged = Array.from(new Set([ ...(department === 'lab' ? defaultsLab : []), ...dbCats.filter(Boolean).map(c => String(c).trim()) ])).sort();
    res.json({ success: true, data: merged });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/bulk', async (req, res) => {
  try {
    const payload = Array.isArray(req.body) ? req.body : req.body?.items;
    if (!Array.isArray(payload) || payload.length === 0) {
      return res.status(400).json({ success: false, message: 'No items provided' });
    }

    const norm = (v) => String(v || '').trim();
    const normLower = (v) => norm(v).toLowerCase();
    const normalizeDepartment = (v) => {
      const d = normLower(v);
      if (d === 'lab' || d === 'pharmacy' || d === 'shop' || d === 'admin') return d;
      return 'admin';
    };
    const normalizeStatus = (v) => {
      const s = normLower(v);
      if (!s) return '';
      if (s === 'in stock' || s === 'instock') return 'In Stock';
      if (s === 'low stock' || s === 'low') return 'Low Stock';
      if (s === 'out of stock' || s === 'out') return 'Out of Stock';
      if (s === 'expired' || s === 'exp') return 'Expired';
      // Excel may contain UI shorthand like OK/Expiring
      if (s === 'ok') return 'In Stock';
      if (s === 'expiring' || s === 'expiring soon') return 'Low Stock';
      return '';
    };
    const computeStatus = (qty, min, expiryDate) => {
      const q = Number(qty || 0);
      const m = Number(min || 0);
      if (expiryDate && expiryDate instanceof Date && !Number.isNaN(expiryDate.getTime())) {
        const today = new Date();
        if (expiryDate.getTime() < today.getTime()) return 'Expired';
      }
      if (q === 0) return 'Out of Stock';
      if (q <= m) return 'Low Stock';
      return 'In Stock';
    };

    const stats = { created: 0, updated: 0, failed: 0 };
    const errors = [];

    for (const raw of payload) {
      try {
        const id = norm(raw?.id || raw?.ID);
        const department = normalizeDepartment(raw?.department || raw?.Department || raw?.portal || raw?.Portal || 'admin');
        const itemName = norm(raw?.itemName || raw?.Item || raw?.name || raw?.Name || raw?.['Item'] || raw?.['Item Name']);
        const category = norm(raw?.category || raw?.Category || 'Other') || 'Other';
        const invoice = norm(raw?.invoice || raw?.Invoice || raw?.['Invoice #'] || raw?.['Invoice']);

        if (!itemName) {
          stats.failed += 1;
          errors.push({ row: raw, message: 'Missing itemName' });
          continue;
        }

        const packs = Number(raw?.packs ?? raw?.Packs ?? 0) || 0;
        const unitsPerPack = Number(raw?.unitsPerPack ?? raw?.['Units/Pack'] ?? raw?.['Units per Pack'] ?? 0) || 0;
        const unitSale = Number(raw?.unitSale ?? raw?.['Unit Sale'] ?? 0) || 0;
        const price = Number(raw?.price ?? raw?.unitPurchase ?? raw?.['Unit Purchase'] ?? raw?.purchasePrice ?? 0) || 0;
        const quantityRaw = raw?.quantity ?? raw?.qty ?? raw?.['Total Units'] ?? raw?.['Quantity'] ?? 0;
        let quantity = Number(quantityRaw) || 0;
        if (!Number.isFinite(quantity) || quantity === 0) {
          if (packs > 0 && unitsPerPack > 0) quantity = packs * unitsPerPack;
        }
        const minStockLevel = Number(raw?.minStockLevel ?? raw?.min ?? raw?.['Min Stock'] ?? 0) || 0;
        const supplier = norm(raw?.supplier || raw?.Supplier);
        const statusRaw = norm(raw?.status || raw?.Status);

        const expiryCell = raw?.expiryDate ?? raw?.expiry ?? raw?.Expiry ?? raw?.['Expiry'];
        let expiryDate;
        if (expiryCell) {
          const dt = new Date(expiryCell);
          if (!Number.isNaN(dt.getTime())) expiryDate = dt;
        }

        const normalizedStatus = normalizeStatus(statusRaw);
        const finalStatus = normalizedStatus || computeStatus(quantity, minStockLevel, expiryDate);

        const update = {
          itemName,
          invoice,
          category,
          quantity,
          packs,
          unitsPerPack,
          unitSale,
          price,
          supplier,
          expiryDate,
          minStockLevel,
          department,
          status: finalStatus,
          updatedAt: new Date(),
        };

        let filter;
        if (id) filter = { id };
        else filter = { department, itemName, invoice };

        const setOnInsert = { id: id || new mongoose.Types.ObjectId().toString() };

        const r = await Inventory.updateOne(
          filter,
          {
            $set: update,
            $setOnInsert: setOnInsert,
          },
          { upsert: true, runValidators: true }
        );
        if (r?.upsertedId) stats.created += 1;
        else if (typeof r?.modifiedCount === 'number') stats.updated += r.modifiedCount;
        else stats.updated += 1;
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
router.get('/:id', async (req, res) => {
  try {
    const item = await Inventory.findOne({ id: req.params.id });
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.post('/', dayGuard(req => (req.body.department || 'admin')), async (req, res) => {
  try {
    // Map frontend fields to backend schema
    const itemData = {
      ...req.body,
      id: req.body.id || new mongoose.Types.ObjectId().toString(),
      type: req.body.type || (req.body.category === 'medical_equipment' ? 'Equipment' : 'Other'),
      invoice: req.body.invoice || '',
      packs: (typeof req.body.packs === 'number' ? req.body.packs : (parseFloat(req.body.packs) || 0)) || 0,
      unitsPerPack: (typeof req.body.unitsPerPack === 'number' ? req.body.unitsPerPack : (parseFloat(req.body.unitsPerPack) || 0)) || 0,
      unitSale: (typeof req.body.unitSale === 'number' ? req.body.unitSale : (parseFloat(req.body.unitSale) || 0)) || 0,
      price: (typeof req.body.price === 'number' ? req.body.price : (parseFloat(req.body.purchasePrice) || parseFloat(req.body.unitSale) || 0)) || 0,
      status: req.body.status || 'In Stock',
      department: req.body.department || 'admin',
      createdBy: req.body.createdBy || 'system'
    };
    
    const item = new Inventory(itemData);
    await item.save();
    try {
      await postInventoryPurchase(item.toObject());
    } catch (e) {
      console.warn('Accounting post failed for inventory create', e && e.message ? e.message : e);
    }
    try {
      await DailyLog.create({
        date: new Date().toISOString().slice(0,10),
        portal: item.department || 'admin',
        sessionId: req.daySession?._id,
        action: 'inventory_create',
        refType: 'inventory_item',
        refId: String(item.id || item._id),
        description: item.itemName,
        amount: item.price || 0,
      });
    } catch {}

    res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error('Error creating inventory item:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});
router.put('/:id', async (req, res) => {
  try {
    // Map frontend fields to backend schema
    const updateData = {
      ...req.body,
      invoice: req.body.invoice || '',
      packs: (typeof req.body.packs === 'number' ? req.body.packs : (parseFloat(req.body.packs) || 0)) || 0,
      unitsPerPack: (typeof req.body.unitsPerPack === 'number' ? req.body.unitsPerPack : (parseFloat(req.body.unitsPerPack) || 0)) || 0,
      unitSale: (typeof req.body.unitSale === 'number' ? req.body.unitSale : (parseFloat(req.body.unitSale) || 0)) || 0,
      price: (typeof req.body.price === 'number' ? req.body.price : (parseFloat(req.body.purchasePrice) || parseFloat(req.body.unitSale) || 0)) || 0,
      status: req.body.status || 'In Stock',
      updatedAt: new Date()
    };
    
    const item = await Inventory.findOneAndUpdate(
      { id: req.params.id },
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    try {
      const sid = String(item.id || item._id);
      const exists = await JournalEntry.exists({ sourceType: 'inventory_purchase', sourceId: sid });
      if (!exists) {
        await postInventoryPurchase(item.toObject());
      }
    } catch (e) {
      console.warn('Accounting post failed for inventory update', e && e.message ? e.message : e);
    }
    res.json({ success: true, data: item });
  } catch (error) {
    console.error('Error updating inventory item:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});
router.delete('/:id', async (req, res) => {
  try {
    const item = await Inventory.findOneAndDelete({ id: req.params.id });
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
export default router;
