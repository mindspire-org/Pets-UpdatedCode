import mongoose from 'mongoose';

const allocationSchema = new mongoose.Schema({
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'VendorPayment' },
  sourceType: { type: String }, // 'vendor_payment' | 'staff_advance' | 'other'
  sourceRef: { type: String },
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, default: Date.now },
}, { _id: false });

const payableSchema = new mongoose.Schema({
  portal: { type: String, enum: ['admin','reception','doctor','pharmacy','lab','shop'], required: true, index: true },
  supplierId: { type: String },
  supplierName: { type: String },
  billRef: { type: String, index: true },
  billDate: { type: Date, default: Date.now },
  dueDate: { type: Date },
  sourceType: { type: String },
  sourceId: { type: String },
  description: { type: String },
  totalAmount: { type: Number, required: true },
  balance: { type: Number, required: true },
  status: { type: String, enum: ['open','closed'], default: 'open', index: true },
  allocations: { type: [allocationSchema], default: [] },
}, { timestamps: true });

payableSchema.index({ portal: 1, supplierId: 1, status: 1 });

const Payable = mongoose.model('Payable', payableSchema);
export default Payable;
