import mongoose from 'mongoose';

const labRequestSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  petName: { type: String, trim: true },
  ownerName: { type: String, trim: true },
  contact: { type: String, trim: true },
  doctorName: { type: String, trim: true },
  testType: { type: String, trim: true },
  customTestName: { type: String, trim: true },
  patientId: { type: String, trim: true },
  testId: { type: String, trim: true },
  species: { type: String, trim: true },
  age: { type: String, trim: true },
  gender: { type: String, trim: true },
  sampleType: { type: String, trim: true },
  priority: { type: String, trim: true, default: 'Routine' },
  collectedBy: { type: String, trim: true },
  requestDate: { type: String, trim: true },
  requestTime: { type: String, trim: true },
  clinicalNotes: { type: String, trim: true },
  referredBy: { type: String, trim: true },
  technician: { type: String, trim: true },
  fee: { type: String, trim: true },
  paymentStatus: { type: String, trim: true, default: 'Pending' },
  status: { type: String, trim: true, default: 'Pending' },
}, {
  timestamps: true,
});

labRequestSchema.index({ id: 1 }, { unique: true });
labRequestSchema.index({ testId: 1 });
labRequestSchema.index({ patientId: 1 });

const LabRequest = mongoose.model('LabRequest', labRequestSchema);
export default LabRequest;
