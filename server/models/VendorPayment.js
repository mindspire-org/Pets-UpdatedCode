import mongoose from 'mongoose';

const allocationSchema = new mongoose.Schema({
  payableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payable', required: true },
  amount: { type: Number, required: true, min: 0 },
}, { _id: false });

const vendorPaymentSchema = new mongoose.Schema({
  portal: { type: String, enum: ['admin','reception','doctor','pharmacy','lab','shop'], required: true, index: true },
  supplierId: { type: String },
  supplierName: { type: String },
  date: { type: Date, default: Date.now },
  amount: { type: Number, required: true },
  paymentMethod: { type: String, default: 'Cash' },
  notes: { type: String },
  allocations: { type: [allocationSchema], default: [] },
}, { timestamps: true });

vendorPaymentSchema.index({ portal: 1, date: -1 });

const VendorPayment = mongoose.model('VendorPayment', vendorPaymentSchema);
export default VendorPayment;
