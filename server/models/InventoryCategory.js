import mongoose from 'mongoose';

const inventoryCategorySchema = new mongoose.Schema({
  department: {
    type: String,
    enum: ['admin', 'lab', 'pharmacy', 'shop'],
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  }
}, {
  timestamps: true
});

inventoryCategorySchema.index({ department: 1, name: 1 }, { unique: true });

const InventoryCategory = mongoose.model('InventoryCategory', inventoryCategorySchema);

export default InventoryCategory;
