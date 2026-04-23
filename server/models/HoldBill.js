import mongoose from 'mongoose';

const holdBillItemSchema = new mongoose.Schema({
  medicineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PharmacyMedicine',
    required: true
  },
  medicineName: { type: String, required: true },
  barcode: { type: String },
  batchNo: { type: String },
  quantity: { type: Number, required: true },
  pricePerUnit: { type: Number, required: true },
  minSalePrice: { type: Number },
  totalPrice: { type: Number, required: true },
  availableStock: { type: Number },
  unitsPerPack: { type: Number },
  salePerPack: { type: Number },
  loosePrice: { type: Number },
  packPrice: { type: Number },
  sellBy: { type: String, enum: ['Loose', 'Pack'], default: 'Loose' },
  discount: { type: Number, default: 0 },
  defaultDiscount: { type: Number, default: 0 },
  category: { type: String },
  unit: { type: String }
}, { _id: false });

const holdBillSchema = new mongoose.Schema({
  holdId: {
    type: String,
    required: true,
    unique: true
  },
  customerInfo: {
    customerName: { type: String },
    customerContact: { type: String },
    address: { type: String },
    cnic: { type: String },
    petName: { type: String },
    patientId: { type: String },
    clientId: { type: String },
    species: { type: String },
    breed: { type: String },
    sex: { type: String },
    age: { type: String },
    weight: { type: String },
    followUpDate: { type: String },
    comments: { type: String }
  },
  cart: [holdBillItemSchema],
  subtotal: { type: Number, default: 0 },
  billDiscountPercent: { type: Number, default: 0 },
  billDiscountAmount: { type: Number, default: 0 },
  salesTaxPercent: { type: Number, default: 0 },
  previousDue: { type: Number, default: 0 },
  notes: { type: String },
  heldBy: { type: String }
}, {
  timestamps: true
});

const HoldBill = mongoose.model('HoldBill', holdBillSchema);

export default HoldBill;
