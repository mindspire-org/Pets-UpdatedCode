// Backup of original Sale.js before accounting wiring
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
  paymentMethod: {
    type: String,
    enum: ['Cash', 'Card', 'Online', 'Other'],
    default: 'Cash'
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

saleSchema.pre('save', async function(next) {
  if (!this.invoiceNumber) {
    try {
      const count = await mongoose.model('Sale').countDocuments();
      const timestamp = Date.now();
      const randomNum = Math.floor(Math.random() * 1000);
      this.invoiceNumber = `INV-${timestamp}-${count + 1}-${randomNum}`;
    } catch (error) {
      console.error('Error generating invoice number:', error);
      this.invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    }
  }
  next();
});

export default mongoose.model('Sale', saleSchema);
