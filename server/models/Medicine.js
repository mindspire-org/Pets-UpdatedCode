import mongoose from 'mongoose';

const medicineRowSchema = new mongoose.Schema({
  name: String,
  composition: String,
  dosage: String,
  ingredients: String,
  route: String,
  doseRate: String,
  perMl: String,
  dose: String,
  unit: String,
  instructions: String
}, { _id: false });

const medicineSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  condition: {
    type: String,
    required: true,
    trim: true
  },
  rows: [medicineRowSchema],
  createdBy: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for faster queries
medicineSchema.index({ id: 1 });
medicineSchema.index({ condition: 1 });

const Medicine = mongoose.model('Medicine', medicineSchema);

export default Medicine;
