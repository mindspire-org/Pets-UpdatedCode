import mongoose from 'mongoose';

const purchaseItemSchema = new mongoose.Schema({
  medicineName: {
    type: String,
    required: true
  },
  batchNo: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String,
    required: true
  },
  purchasePrice: {
    type: Number,
    required: true,
    min: 0
  },
  salePrice: {
    type: Number,
    required: true,
    min: 0
  },
  totalCost: {
    type: Number,
    required: true,
    min: 0
  },
  expiryDate: {
    type: Date,
    required: true
  },
  mlPerVial: {
    type: Number,
    min: 0
  }
}, { _id: false });

const pharmacyPurchaseSchema = new mongoose.Schema({
  purchaseOrderNo: {
    type: String,
    required: true,
    unique: true
  },
  supplierName: {
    type: String,
    required: true,
    trim: true
  },
  supplierContact: {
    type: String,
    trim: true
  },
  invoiceNo: {
    type: String,
    required: true,
    trim: true
  },
  purchaseDate: {
    type: Date,
    required: true
  },
  items: [purchaseItemSchema],
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentStatus: {
    type: String,
    enum: ['Paid', 'Pending', 'Partial'],
    default: 'Pending'
  },
  amountPaid: {
    type: Number,
    default: 0,
    min: 0
  },
  notes: {
    type: String,
    trim: true
  },
  receivedBy: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for faster queries
pharmacyPurchaseSchema.index({ purchaseOrderNo: 1 });
pharmacyPurchaseSchema.index({ supplierName: 1 });
pharmacyPurchaseSchema.index({ purchaseDate: -1 });
pharmacyPurchaseSchema.index({ invoiceNo: 1 });

const PharmacyPurchase = mongoose.model('PharmacyPurchase', pharmacyPurchaseSchema);

export default PharmacyPurchase;
