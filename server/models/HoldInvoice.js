import mongoose from 'mongoose';

const holdInvoiceItemSchema = new mongoose.Schema({
  mainCategory: { type: String },
  subCategory: { type: String },
  category: { type: String },
  medicineName: { type: String, required: true },
  genericName: { type: String },
  batchNo: { type: String },
  barcode: { type: String },
  expiryDate: { type: String },
  qtyPacks: { type: Number, required: true },
  unitsPerPack: { type: Number, default: 1 },
  buyPerPack: { type: Number, required: true },
  salePerPack: { type: Number, default: 0 },
  minStock: { type: Number, default: 0 },
  defaultDiscount: { type: Number, default: 0 },
  lineTaxType: { type: String, enum: ['%', 'PKR'], default: '%' },
  lineTaxValue: { type: Number, default: 0 },
  unit: { type: String, default: 'pieces' },
  containerType: { type: String },
  subtotal: { type: Number, default: 0 },
  discountAmt: { type: Number, default: 0 },
  taxAmt: { type: Number, default: 0 },
  lineTotal: { type: Number, default: 0 }
}, { _id: false });

const holdInvoiceTaxSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['%', 'PKR'], default: '%' },
  value: { type: Number, default: 0 },
  applyOn: { type: String, enum: ['gross', 'net'], default: 'gross' },
  amount: { type: Number, default: 0 }
}, { _id: false });

const holdInvoiceSchema = new mongoose.Schema({
  holdId: {
    type: String,
    required: true,
    unique: true
  },
  invoiceNo: { type: String, default: 'INV-1' },
  invoiceDate: { type: Date, default: Date.now },
  supplierName: { type: String },
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company'
  },
  items: [holdInvoiceItemSchema],
  invoiceTaxes: [holdInvoiceTaxSchema],
  grossTotal: { type: Number, default: 0 },
  totalLineTaxes: { type: Number, default: 0 },
  totalInvoiceTaxes: { type: Number, default: 0 },
  netTotal: { type: Number, default: 0 },
  notes: { type: String },
  heldBy: { type: String },
  portal: { type: String, default: 'pharmacy' }
}, {
  timestamps: true
});

const HoldInvoice = mongoose.model('HoldInvoice', holdInvoiceSchema);

export default HoldInvoice;
