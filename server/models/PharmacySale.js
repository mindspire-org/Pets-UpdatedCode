import mongoose from 'mongoose';

// ── saleItemSchema additions ─────────────────────────────────────────────
const saleItemSchema = new mongoose.Schema({
  medicineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PharmacyMedicine',
    required: true
  },
  medicineName: { type: String, required: true },
  batchNo: { type: String, required: true },
  category: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, required: true },
  pricePerUnit: { type: Number, required: true, min: 0 },
  packPrice: { type: Number, default: 0, min: 0 },
  sellBy: { type: String, enum: ['Loose', 'Pack'], default: 'Loose' },
  lineDiscount: { type: Number, default: 0, min: 0 },      // % discount on this line
  lineDiscountAmt: { type: Number, default: 0, min: 0 },   // PKR amount discounted
  totalPrice: { type: Number, required: true, min: 0 },
  mlUsed: { type: Number, min: 0 },
  remainingMlAfterSale: { type: Number, min: 0 },
  expiryDate: { type: Date },
  dosage: { type: String, trim: true },
  actualSalePrice: { type: Number, min: 0 },
  actualTotalPrice: { type: Number, min: 0 }
}, { _id: false });

const pharmacySaleSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true
  },
  // Links to patient and client for unified records
  patientId: { type: String, trim: true },
  clientId: { type: String, trim: true },
  customerName: { type: String, trim: true },
  customerContact: { type: String, trim: true },
  customerAddress: { type: String, trim: true },
  customerCnic: { type: String, trim: true },
  petName: { type: String, trim: true },
  items: [saleItemSchema],
  subtotal: { type: Number, required: true, min: 0 },
  lineDiscounts: { type: Number, default: 0, min: 0 },       // total PKR of all line discounts
  billDiscountPercent: { type: Number, default: 0, min: 0 }, // bill-level % discount
  billDiscountAmount: { type: Number, default: 0, min: 0 },  // bill-level PKR discount
  salesTaxPercent: { type: Number, default: 0, min: 0 },
  salesTaxAmount: { type: Number, default: 0, min: 0 },
  discount: { type: Number, default: 0, min: 0 },            // legacy total discount
  discountBreakdown: {
    medicine: { type: Number, default: 0, min: 0 },
    surgical: { type: Number, default: 0, min: 0 },
    procedures: { type: Number, default: 0, min: 0 },
  },
  categorySubtotals: {
    medicine: { type: Number, default: 0, min: 0 },
    surgical: { type: Number, default: 0, min: 0 },
    procedures: { type: Number, default: 0, min: 0 },
  },
  // Payment charge/surcharge (e.g., card processing fee)
  paymentCharge: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  totalCost: {
    type: Number,
    min: 0
  },
  // Payment breakdown (optional, for dues tracking)
  receivedAmount: { type: Number, min: 0 },
  previousDue: { type: Number, min: 0 },
  dueAmount: { type: Number, min: 0 },
  newTotalDue: { type: Number, min: 0 },
  recoveryPayments: {
    type: [new mongoose.Schema({
      amount: { type: Number, min: 0, required: true },
      paymentMethod: { type: String, trim: true },
      paymentDetails: {
        method: { type: String, trim: true },
        bankName: { type: String, trim: true },
        accountNumber: { type: String, trim: true },
        walletNumber: { type: String, trim: true },
        transactionId: { type: String, trim: true },
        cardHolderName: { type: String, trim: true },
        cardLast4: { type: String, trim: true },
        cardAuthCode: { type: String, trim: true },
      },
      recoveredAt: { type: Date, default: Date.now },
    }, { _id: false })],
    default: []
  },
  paymentMethod: {
    type: String,
    trim: true,
    default: 'Cash'
  },
  // Optional structured payment metadata captured on POS
  paymentDetails: {
    method: { type: String, trim: true },
    bankName: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    walletNumber: { type: String, trim: true },
    transactionId: { type: String, trim: true },
    cardHolderName: { type: String, trim: true },
    cardLast4: { type: String, trim: true },
    cardAuthCode: { type: String, trim: true }
  },
  prescriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prescription'
  },
  // Link to lab report if medicine used in lab
  labReportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LabReport'
  },
  soldBy: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['Completed', 'Pending', 'Cancelled'],
    default: 'Completed'
  }
}, {
  timestamps: true
});

// Indexes for faster queries
pharmacySaleSchema.index({ invoiceNumber: 1 });
pharmacySaleSchema.index({ createdAt: -1 });
pharmacySaleSchema.index({ prescriptionId: 1 });
pharmacySaleSchema.index({ customerContact: 1 });

const PharmacySale = mongoose.model('PharmacySale', pharmacySaleSchema);

export default PharmacySale;
