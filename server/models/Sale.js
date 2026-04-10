import mongoose from 'mongoose';

const saleItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  itemName: String,
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unitPrice: {
    type: Number,
    required: true
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalPrice: {
    type: Number,
    required: true
  }
}, { _id: false });

const saleSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    unique: true
  },
  customerId: {
    type: String,
    default: ''
  },
  items: [saleItemSchema],
  subtotal: {
    type: Number,
    required: true
  },
  discount: {
    type: Number,
    default: 0
  },
  tax: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true
  },
  totalCost: {
    type: Number,
    default: 0
  },
  paymentCharge: {
    type: Number,
    default: 0,
    min: 0
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
  paymentMethod: {
    type: String,
    enum: ['Cash', 'Card', 'Online', 'Other'],
    default: 'Cash'
  },
  recoveryPayments: {
    type: [
      {
        amount: { type: Number, required: true, min: 0 },
        paymentMethod: { type: String, default: 'Cash' },
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
        recoveredAt: { type: Date, default: Date.now }
      }
    ],
    default: []
  },
  receivedAmount: {
    type: Number,
    default: 0
  },
  previousDue: {
    type: Number,
    default: 0
  },
  balanceDue: {
    type: Number,
    default: 0
  },
  customerName: {
    type: String,
    default: ''
  },
  customerContact: {
    type: String,
    default: ''
  },
  soldBy: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Auto-generate invoice number
saleSchema.pre('save', async function(next) {
  if (!this.invoiceNumber) {
    try {
      const count = await mongoose.model('Sale').countDocuments();
      const timestamp = Date.now();
      const randomNum = Math.floor(Math.random() * 1000);
      this.invoiceNumber = `INV-${timestamp}-${count + 1}-${randomNum}`;
    } catch (error) {
      console.error('Error generating invoice number:', error);
      // Fallback invoice number
      this.invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    }
  }
  next();
});

export default mongoose.model('Sale', saleSchema);
