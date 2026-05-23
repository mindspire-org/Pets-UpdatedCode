import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  itemName: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  barcode: {
    type: String,
    unique: true,
    sparse: true
  },
  quantity: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  purchasePrice: {
    type: Number,
    required: true,
    min: 0
  },
  salePrice: {
    type: Number,
    required: true,
    min: 0
  },
  minSalePrice: {
    type: Number,
    default: 0,
    min: 0
  },
  supplier: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  lowStockThreshold: {
    type: Number,
    default: 10
  },
  batchNo: {
    type: String,
    default: ''
  },
  defaultDiscount: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  expiryDate: {
    type: Date
  },
  image: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Index for faster searches
productSchema.index({ itemName: 'text', category: 'text', barcode: 'text' });

export default mongoose.model('Product', productSchema);
