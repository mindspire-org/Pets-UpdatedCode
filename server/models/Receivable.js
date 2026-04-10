import mongoose from 'mongoose';

const allocationSchema = new mongoose.Schema({
  paymentId: { type: String },
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, default: Date.now },
}, { _id: false });

const receivableSchema = new mongoose.Schema({
  portal: { type: String, enum: ['admin','reception','doctor','pharmacy','lab','shop'], required: true, index: true },
  customerId: { type: String },
  patientId: { type: String },
  customerName: { type: String },
  refType: { type: String },
  refId: { type: String, index: true },
  billDate: { type: Date, default: Date.now },
  description: { type: String },
  totalAmount: { type: Number, required: true },
  balance: { type: Number, required: true },
  status: { type: String, enum: ['open','closed'], default: 'open', index: true },
  allocations: { type: [allocationSchema], default: [] },
}, { timestamps: true });

receivableSchema.index({ portal: 1, customerId: 1, status: 1 });

const Receivable = mongoose.model('Receivable', receivableSchema);
export default Receivable;
