import mongoose from 'mongoose';

const saleItemSchema = new mongoose.Schema({
  medicineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PetshopPharmacyMedicine',
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
  lineDiscount: { type: Number, default: 0, min: 0 },
  lineDiscountAmt: { type: Number, default: 0, min: 0 },
  totalPrice: { type: Number, required: true, min: 0 },
  mlUsed: { type: Number, min: 0 },
  remainingMlAfterSale: { type: Number, min: 0 },
  expiryDate: { type: Date },
  dosage: { type: String, trim: true },
  actualSalePrice: { type: Number, min: 0 },
  actualTotalPrice: { type: Number, min: 0 }
}, { _id: false });

const petshopPharmacySaleSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true
  },
  patientId: { type: String, trim: true },
  clientId: { type: String, trim: true },
  customerName: { type: String, trim: true },
  customerContact: { type: String, trim: true },
  customerAddress: { type: String, trim: true },
  customerCnic: { type: String, trim: true },
  petName: { type: String, trim: true },
  items: [saleItemSchema],
  subtotal: { type: Number, required: true, min: 0 },
  lineDiscounts: { type: Number, default: 0, min: 0 },
  billDiscountPercent: { type: Number, default: 0, min: 0 },
  billDiscountAmount: { type: Number, default: 0, min: 0 },
  salesTaxPercent: { type: Number, default: 0, min: 0 },
  salesTaxAmount: { type: Number, default: 0, min: 0 },
  discount: { type: Number, default: 0, min: 0 },
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
  timestamps: true,
  collection: 'petshop_sales'
});

petshopPharmacySaleSchema.index({ invoiceNumber: 1 });
petshopPharmacySaleSchema.index({ createdAt: -1 });
petshopPharmacySaleSchema.index({ prescriptionId: 1 });
petshopPharmacySaleSchema.index({ customerContact: 1 });

// Auto-generate invoice number if missing — uses the atomic Sequence
// counter to avoid the random-suffix collisions that previously caused
// sale saves to fail (and, inside a transaction, roll back inventory
// decreases that had already been applied).
petshopPharmacySaleSchema.pre('save', async function(next) {
  if (!this.invoiceNumber) {
    try {
      const Sequence = mongoose.model('Sequence');
      const y = new Date().getFullYear();
      const key = `petshop-sale-invoice:${y}`;
      const seqDoc = await Sequence.findOneAndUpdate(
        { key },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      const seq = String(seqDoc.seq || 0).padStart(6, '0');
      this.invoiceNumber = `PS-${y}-${seq}`;
    } catch (error) {
      console.error('Error generating petshop invoice number:', error);
      // Last-resort fallback with enough randomness to be effectively unique
      this.invoiceNumber = `PS-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    }
  }
  next();
});

const PetshopPharmacySale = mongoose.model('PetshopPharmacySale', petshopPharmacySaleSchema);

export default PetshopPharmacySale;
