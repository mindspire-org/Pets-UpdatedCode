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
  invoiceNumber: {
    type: String,
    default: ''
  },
  amount: {
    type: Number,
    default: 0
  },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'Card', 'Online Transfer'],
    default: 'Cash'
  },
  date: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    default: ''
  },
  paymentDate: {
    type: Date,
    default: Date.now
  }
});

const petShopSupplierSchema = new mongoose.Schema({
  portal: {
    type: String,
    default: 'shop'
  },
  supplierName: {
    type: String,
    required: true,
    trim: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PetShopCompany'
  },
  companyIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PetShopCompany'
  }],
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
  },
  taxId: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  }
}, {
  timestamps: true,
  collection: 'petshop_suppliers'
});

// Index for faster queries
petShopSupplierSchema.index({ supplierName: 1, portal: 1 });
petShopSupplierSchema.index({ status: 1 });
petShopSupplierSchema.index({ companyIds: 1 });

export default mongoose.model('PetShopSupplier', petShopSupplierSchema);
