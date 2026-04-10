import mongoose from 'mongoose';

const prescriptionItemSchema = new mongoose.Schema({
  id: mongoose.Schema.Types.Mixed,
  name: String,
  composition: String,
  doseRate: String,
  perMl: String,
  ingredients: String,
  description: String,
  route: String,
  dose: String,
  unit: String,
  condition: String,
  instructions: String
}, { _id: false });

const prescriptionSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  when: {
    type: Date,
    required: true,
    default: Date.now
  },
  patient: {
    id: String,
    petName: String,
    species: String,
    age: String,
    gender: String,
    breed: String,
    ownerName: String,
    appointment: String,
    weightKg: String,
    tempF: String,
    dehydration: String
  },
  items: [prescriptionItemSchema],
  note: {
    type: String
  },
  notes: {
    hx: [String],
    oe: [String],
    dx: [String]
  },
  doctor: {
    name: String,
    username: String,
    id: String
  },
  status: {
    type: String,
    default: 'Active',
    enum: ['Active', 'Completed', 'Cancelled']
  }
}, {
  timestamps: true
});

// Indexes for faster queries
prescriptionSchema.index({ id: 1 });
prescriptionSchema.index({ 'patient.id': 1 });
prescriptionSchema.index({ when: -1 });
prescriptionSchema.index({ 'doctor.username': 1 });

const Prescription = mongoose.model('Prescription', prescriptionSchema);

export default Prescription;
