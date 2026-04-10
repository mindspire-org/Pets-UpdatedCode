import express from 'express';
import Product from '../models/Product.js';
import mongoose from 'mongoose';
import Supplier from '../models/Supplier.js';

const router = express.Router();

// Get all products
router.get('/', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get categories (distinct from DB + defaults)
router.get('/categories', async (req, res) => {
  try {
    const defaults = ['Food', 'Toy', 'Collar', 'Shampoo', 'Accessory', 'Medicine', 'Grooming', 'Other'];
    const dbCats = await Product.distinct('category');
    const merged = Array.from(new Set([ ...defaults, ...dbCats.filter(Boolean).map(c => String(c).trim()) ])).sort();
    res.json({ success: true, data: merged });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Search products
router.get('/search/:query', async (req, res) => {
  try {
    const query = req.params.query;
    const products = await Product.find({
      $or: [
        { itemName: { $regex: query, $options: 'i' } },
        { category: { $regex: query, $options: 'i' } },
        { barcode: query }
      ]
    });
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get low stock products
router.get('/low-stock', async (req, res) => {
  try {
    const products = await Product.find({
      $expr: { $lte: ['$quantity', '$lowStockThreshold'] }
    });
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Clear all products (must be defined BEFORE parameterized '/:id' route)
router.delete('/clear', async (req, res) => {
  try {
    const r = await Product.deleteMany({});
    res.json({ success: true, deleted: r?.deletedCount || 0 });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get product by ID
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create product
router.post('/', async (req, res) => {
  try {
    // Convert empty barcode to null to avoid duplicate key errors with sparse index
    const productData = { ...req.body };
    if (!productData.barcode || productData.barcode.trim() === '') {
      productData.barcode = null;
    }
    
    const product = new Product(productData);
    await product.save();

    // If a supplier is selected, create a corresponding purchase record
    try {
      const qty = Number(product.quantity || 0);
      const unit = Number(product.purchasePrice || 0);
      if (product.supplier && qty > 0) {
        const supplier = await Supplier.findOne({ supplierName: product.supplier, portal: 'shop' });
        if (supplier) {
          const total = qty * unit;
          supplier.purchaseHistory.push({
            productId: product._id,
            productName: product.itemName,
            quantity: qty,
            unitPrice: unit,
            totalPrice: total,
            invoiceNumber: '',
            purchaseDate: new Date()
          });
          supplier.totalPurchases += total;
          await supplier.save();
        }
      }
    } catch (e) {
      // Non-fatal: purchase log should not block product creation
    }

    res.status(201).json({ success: true, data: product });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update product
router.put('/:id', async (req, res) => {
  try {
    // Fetch existing product to compare quantities and supplier changes
    const existing = await Product.findById(req.params.id);

    // Convert empty barcode to null to avoid duplicate key errors with sparse index
    const updateData = { ...req.body };
    if (!updateData.barcode || updateData.barcode.trim() === '') {
      updateData.barcode = null;
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Log a supplier purchase entry if quantity increased OR if supplier was newly set with existing stock
    try {
      const prevQty = Number(existing?.quantity ?? 0);
      const newQty = req.body && req.body.quantity != null ? Number(req.body.quantity) : prevQty;
      const delta = Math.max(0, newQty - prevQty);
      const unit = req.body && req.body.purchasePrice != null ? Number(req.body.purchasePrice) : Number(product.purchasePrice || 0);

      if (product.supplier) {
        const supplier = await Supplier.findOne({ supplierName: product.supplier, portal: 'shop' });
        if (supplier) {
          if (delta > 0) {
            const total = delta * unit;
            supplier.purchaseHistory.push({
              productId: product._id,
              productName: product.itemName,
              quantity: delta,
              unitPrice: unit,
              totalPrice: total,
              invoiceNumber: '',
              purchaseDate: new Date()
            });
            supplier.totalPurchases += total;
            await supplier.save();
          } else if ((!existing?.supplier || existing.supplier === '') && newQty > 0) {
            // If previously no supplier and now set, create a baseline purchase record for current stock
            const total = newQty * unit;
            supplier.purchaseHistory.push({
              productId: product._id,
              productName: product.itemName,
              quantity: newQty,
              unitPrice: unit,
              totalPrice: total,
              invoiceNumber: '',
              purchaseDate: new Date()
            });
            supplier.totalPurchases += total;
            await supplier.save();
          }
        }
      }
    } catch (e) {
      // Non-fatal: do not block product update due to supplier log issues
    }

    res.json({ success: true, data: product });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete product
router.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update stock quantity
router.patch('/:id/stock', async (req, res) => {
  try {
    const { quantity, operation } = req.body; // operation: 'add' or 'subtract'
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (operation === 'add') {
      product.quantity += quantity;
    } else if (operation === 'subtract') {
      if (product.quantity < quantity) {
        return res.status(400).json({ success: false, message: 'Insufficient stock' });
      }
      product.quantity -= quantity;
    }

    await product.save();
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/bulk', async (req, res) => {
  try {
    const payload = Array.isArray(req.body) ? req.body : req.body?.items;
    if (!Array.isArray(payload) || payload.length === 0) {
      return res.status(400).json({ success: false, message: 'No items provided' });
    }
    const results = [];
    for (const raw of payload) {
      const itemName = String(raw.itemName || raw.item_name || '').trim();
      const category = String(raw.category || '').trim() || 'Other';
      const barcodeRaw = raw.barcode == null ? '' : String(raw.barcode).trim();
      const barcode = barcodeRaw || undefined;
      const quantity = Number(raw.quantity ?? 0) || 0;
      const purchasePrice = Number(raw.purchasePrice ?? 0) || 0;
      const salePrice = Number(raw.salePrice ?? 0) || 0;
      const supplier = raw.supplier ? String(raw.supplier) : '';
      const description = raw.description ? String(raw.description) : '';
      const lowStockThreshold = Number(raw.lowStockThreshold ?? 10) || 10;
      // Do not require itemName; allow partial rows. If both barcode and itemName are missing,
      // we insert a new document (handled below).
      const doc = {
        itemName,
        category,
        barcode: barcode || null, // Convert empty to null for sparse index
        quantity,
        purchasePrice,
        salePrice,
        supplier,
        description,
        lowStockThreshold,
      };
      // If no barcode is provided, treat as a new product (do not merge by name)
      if (!barcode) {
        const created = await Product.create(doc);
        results.push(created);
        continue;
      }
      // With a barcode, upsert by barcode to avoid duplicates of the same coded item
      const filter = { barcode };
      const updated = await Product.findOneAndUpdate(
        filter,
        { $set: doc },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      results.push(updated);
    }
    res.json({ success: true, count: results.length, data: results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
