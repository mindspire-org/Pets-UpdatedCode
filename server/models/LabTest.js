import mongoose from 'mongoose';

const parameterSchema = new mongoose.Schema({
  id: mongoose.Schema.Types.Mixed,
  name: String,
  unit: String,
  normalRange: String
}, { _id: false });

 const consumableSchema = new mongoose.Schema({
   inventoryId: { type: String, trim: true },
   itemName: { type: String, trim: true },
   quantity: { type: Number, default: 0 }
 }, { _id: false });

const labTestSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  testName: {
    type: String,
    required: true,
    trim: true
  },
  parameters: [parameterSchema],
  price: {
    type: Number,
    default: 0
  },
  turnaroundTime: {
    type: String
  },
  sampleType: {
    type: String
  },
  consumables: [consumableSchema],
  // Optional metadata used by UI
  notes: String,
  fasting: { type: Boolean, default: false },
  parameter: String,
  unit: String,
  // Legacy demographic ranges (kept for backward compatibility)
  rangeM: String,
  rangeF: String,
  rangeP: String,
  // New species-based ranges
  speciesRanges: [{
    species: { type: String, trim: true },
    range: { type: String, trim: true }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for faster queries
labTestSchema.index({ id: 1 });
labTestSchema.index({ category: 1 });
labTestSchema.index({ testName: 1 });

const LabTest = mongoose.model('LabTest', labTestSchema);

export default LabTest;
