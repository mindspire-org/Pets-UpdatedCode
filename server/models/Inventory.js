import mongoose from 'mongoose';

const inventorySchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  itemName: {
    type: String,
    required: true,
    trim: true
  },
  invoice: {
    type: String,
    trim: true,
    default: ''
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['Medicine', 'Equipment', 'Supply', 'Food', 'Accessory', 'Other']
  },
  quantity: {
    type: Number,
    required: true,
    default: 0
  },
  packs: {
    type: Number,
    default: 0
  },
  unitsPerPack: {
    type: Number,
    default: 0
  },
  unitSale: {
    type: Number,
    default: 0
  },
  unit: {
    type: String,
    default: 'pcs'
  },
  price: {
    type: Number,
    default: 0
  },
  supplier: {
    type: String
  },
  expiryDate: {
    type: Date
  },
  batchNumber: {
    type: String
  },
  minStockLevel: {
    type: Number,
    default: 10
  },
  location: {
    type: String
  },
  description: {
    type: String
  },
  status: {
    type: String,
    default: 'In Stock',
    enum: ['In Stock', 'Low Stock', 'Out of Stock', 'Expired']
  },
  department: {
    type: String,
    enum: ['admin', 'lab', 'pharmacy', 'shop']
  },
  createdBy: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for faster queries
inventorySchema.index({ id: 1 });
inventorySchema.index({ itemName: 1 });
inventorySchema.index({ category: 1 });
inventorySchema.index({ status: 1 });
inventorySchema.index({ department: 1 });

const Inventory = mongoose.model('Inventory', inventorySchema);

export default Inventory;
