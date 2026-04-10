import mongoose from 'mongoose';

const radiologyTestSchema = new mongoose.Schema({
  id: mongoose.Schema.Types.Mixed,
  testName: String,
  findings: String,
  impressions: String,
  notes: String,
  status: String
}, { _id: false });

const radiologyReportSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  reportNumber: {
    type: String,
    required: true,
    unique: true
  },
  petId: {
    type: String,
    required: true
  },
  petName: {
    type: String,
    required: true
  },
  ownerName: {
    type: String,
    required: true
  },
  species: String,
  age: String,
  gender: String,
  requestedBy: String,
  modality: { type: String, trim: true }, // X-Ray, Ultrasound, CT, MRI
  bodyPart: { type: String, trim: true },
  studyDate: { type: Date, default: Date.now },
  reportDate: { type: Date, default: Date.now },
  tests: [radiologyTestSchema],
  overallNotes: String,
  technician: String,
  status: {
    type: String,
    default: 'Pending',
    enum: ['Pending', 'In Progress', 'Completed', 'Reviewed']
  },
  priority: {
    type: String,
    default: 'Normal',
    enum: ['Normal', 'Urgent', 'STAT']
  },
  amount: { type: Number, default: 0 },
  paymentStatus: {
    type: String,
    default: 'Pending',
    enum: ['Paid', 'Pending', 'Cancelled']
  },
  date: { type: String }
}, {
  timestamps: true
});

radiologyReportSchema.index({ id: 1 });
radiologyReportSchema.index({ reportNumber: 1 });
radiologyReportSchema.index({ petId: 1 });
radiologyReportSchema.index({ reportDate: -1 });

const RadiologyReport = mongoose.model('RadiologyReport', radiologyReportSchema);
export default RadiologyReport;
