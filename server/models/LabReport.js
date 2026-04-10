import mongoose from 'mongoose';

const testResultSchema = new mongoose.Schema({
  id: mongoose.Schema.Types.Mixed,
  testName: String,
  result: String,
  unit: String,
  normalRange: String,
  status: String,
  notes: String
}, { _id: false });

const inventoryUsedSchema = new mongoose.Schema({
  inventoryId: { type: String, trim: true },
  itemName: { type: String, trim: true },
  quantity: { type: Number, default: 0 }
}, { _id: false });

const paymentDetailsSchema = new mongoose.Schema({
  method: { type: String, default: '' },
  bankName: { type: String, default: '' },
  accountNumber: { type: String, default: '' },
  walletNumber: { type: String, default: '' },
  transactionId: { type: String, default: '' },
  cardHolderName: { type: String, default: '' },
  cardLast4: { type: String, default: '' },
  cardAuthCode: { type: String, default: '' },
}, { _id: false });

const recoveryPaymentSchema = new mongoose.Schema({
  amount: { type: Number, default: 0 },
  paymentMethod: { type: String, default: '' },
  paymentDetails: { type: paymentDetailsSchema, default: () => ({}) },
  recoveredAt: { type: Date, default: Date.now },
}, { _id: false });

const labReportSchema = new mongoose.Schema({
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
  species: {
    type: String
  },
  age: {
    type: String
  },
  gender: {
    type: String
  },
  requestedBy: {
    type: String
  },
  testCategory: {
    type: String,
    required: true
  },
  testType: {
    type: String,
    required: true
  },
  sampleType: {
    type: String
  },
  collectionDate: {
    type: Date
  },
  reportDate: {
    type: Date,
    default: Date.now
  },
  tests: [testResultSchema],
  overallNotes: {
    type: String
  },
  technician: {
    type: String
  },
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
  amount: {
    type: Number,
    default: 0
  },
  paymentStatus: {
    type: String,
    default: 'Pending',
    enum: ['Paid', 'Pending', 'Cancelled']
  },
  paymentMethod: {
    type: String,
    default: 'Cash'
  },
  paymentDetails: {
    type: paymentDetailsSchema,
    default: () => ({})
  },
  paymentCharge: {
    type: Number,
    default: 0
  },
  receivedAmount: {
    type: Number,
    default: 0
  },
  dueAmount: {
    type: Number,
    default: 0
  },
  recoveryPayments: {
    type: [recoveryPaymentSchema],
    default: []
  },
  inventoryUsed: [inventoryUsedSchema],
  date: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for faster queries
labReportSchema.index({ id: 1 });
labReportSchema.index({ reportNumber: 1 });
labReportSchema.index({ petId: 1 });
labReportSchema.index({ status: 1 });
labReportSchema.index({ reportDate: -1 });

const LabReport = mongoose.model('LabReport', labReportSchema);

export default LabReport;
