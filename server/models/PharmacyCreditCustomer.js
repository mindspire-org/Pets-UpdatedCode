import mongoose from 'mongoose';

const paymentEntrySchema = new mongoose.Schema({
  amount:        { type: Number, required: true, min: 0 },
  notes:         { type: String, trim: true, default: '' },
  paidAt:        { type: Date, default: Date.now },
  invoiceNumber: { type: String, trim: true, default: '' },
}, { _id: true });

const pharmacyCreditCustomerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, trim: true, default: '' },
  cnic:  { type: String, trim: true, default: '' },
  address: { type: String, trim: true, default: '' },
  totalDue:  { type: Number, default: 0, min: 0 },
  totalPaid: { type: Number, default: 0, min: 0 },
  isActive:  { type: Boolean, default: true },
  paymentHistory: { type: [paymentEntrySchema], default: [] },
}, { timestamps: true });

pharmacyCreditCustomerSchema.index({ name: 1 });
pharmacyCreditCustomerSchema.index({ phone: 1 });

const PharmacyCreditCustomer = mongoose.model(
  'PharmacyCreditCustomer',
  pharmacyCreditCustomerSchema,
  'pharmacy_creditcustomers'
);

export default PharmacyCreditCustomer;
