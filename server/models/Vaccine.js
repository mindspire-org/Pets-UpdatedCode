import mongoose from 'mongoose';

const vaccineShotSchema = new mongoose.Schema({
  dateGiven: String,
  nextDue: String,
  vet: String,
  shotStage: String,
}, { _id: false });

const vaccineRowSchema = new mongoose.Schema({
  name: String,
  // Legacy single-shot fields (kept for backward compatibility)
  dateGiven: String,
  nextDue: String,
  vet: String,
  shotStage: String,
  // New multi-shot structure
  shots: [vaccineShotSchema],
  route: String,
  instructions: String
}, { _id: false });

const vaccineSchema = new mongoose.Schema({
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
  rows: [vaccineRowSchema],
  createdBy: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'doctor_vaccines'
});

// Indexes for faster queries
vaccineSchema.index({ id: 1 });
vaccineSchema.index({ condition: 1 });

const Vaccine = mongoose.model('Vaccine', vaccineSchema);

export default Vaccine;
