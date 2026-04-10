import mongoose from 'mongoose';

const purchaseHistorySchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  productName: String,
  quantity: Number,
  unitPrice: Number,
  totalPrice: Number,
  paidAmount: {
    type: Number,
    default: 0
  },
  purchaseDate: {
    type: Date,
    default: Date.now
  },
  invoiceNumber: String
});

const paymentHistorySchema = new mongoose.Schema({
  amount: Number,
  paymentMethod: String,
  notes: String,
  paymentDate: {
    type: Date,
    default: Date.now
  },
  invoiceNumber: String
});

const supplierSchema = new mongoose.Schema({
  portal: {
    type: String,
    default: 'admin'
  },
  supplierName: {
    type: String,
    required: true,
    trim: true
  },
  contactPerson: {
    type: String,
    default: ''
  },
  phone: {
    type: String,
    default: ''
  },
  email: {
    type: String,
    default: ''
  },
  address: {
    type: String,
    default: ''
  },
  city: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    default: 'General'
  },
  purchaseHistory: [purchaseHistorySchema],
  totalPurchases: {
    type: Number,
    default: 0
  },
  totalPaid: {
    type: Number,
    default: 0
  },
  paymentHistory: [paymentHistorySchema],
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

export default mongoose.model('Supplier', supplierSchema);
