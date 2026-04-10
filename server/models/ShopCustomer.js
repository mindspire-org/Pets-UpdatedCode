import mongoose from 'mongoose';

const purchaseRecordSchema = new mongoose.Schema({
  saleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale'
  },
  invoiceNumber: String,
  amount: Number,
  items: Number,
  purchaseDate: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const shopCustomerSchema = new mongoose.Schema({
  customerName: {
    type: String,
    required: true,
    trim: true
  },
  contact: {
    type: String,
    required: true
  },
  email: {
    type: String,
    default: ''
  },
  address: {
    type: String,
    default: ''
  },
  petName: {
    type: String,
    default: ''
  },
  petType: {
    type: String,
    default: ''
  },
  purchaseHistory: [purchaseRecordSchema],
  totalSpent: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

export default mongoose.model('ShopCustomer', shopCustomerSchema);
