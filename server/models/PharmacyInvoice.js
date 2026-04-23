import mongoose from 'mongoose';

const invoiceTaxSchema = new mongoose.Schema({
  name: { type: String, trim: true, default: '' },
  type: { type: String, enum: ['%', 'PKR'], default: '%' },
  value: { type: Number, default: 0 },
  applyOn: { type: String, enum: ['gross', 'net'], default: 'gross' },
  amount: { type: Number, default: 0 },   // computed & stored
}, { _id: false });

const invoiceItemSchema = new mongoose.Schema({
  // Medicine reference (created separately in PharmacyMedicine)
  medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'PharmacyMedicine' },

  // Category / medicine identity
  mainCategory: { type: String, trim: true, default: '' },
  subCategory:  { type: String, trim: true, default: '' },
  category:     { type: String, trim: true, default: '' },
  medicineName: { type: String, required: true, trim: true },
  genericName:  { type: String, trim: true, default: '' },
  batchNo:      { type: String, trim: true, default: '' },
  barcode:      { type: String, trim: true, default: '' },
  expiryDate:   { type: Date },

  // Pack-level quantities & pricing
  qtyPacks:    { type: Number, default: 0 },
  unitsPerPack:{ type: Number, default: 1 },
  buyPerPack:  { type: Number, default: 0 },
  salePerPack: { type: Number, default: 0 },

  // Derived (stored for reporting)
  totalItems:    { type: Number, default: 0 },  // qtyPacks * unitsPerPack
  buyPerUnit:    { type: Number, default: 0 },  // buyPerPack / unitsPerPack
  salePerUnit:   { type: Number, default: 0 },  // salePerPack / unitsPerPack

  // Stock & pricing settings
  minStock:        { type: Number, default: 0 },
  defaultDiscount: { type: Number, default: 0 },  // %
  lineTaxType:     { type: String, enum: ['%', 'PKR'], default: '%' },
  lineTaxValue:    { type: Number, default: 0 },

  // Computed line amounts (stored for reporting)
  subtotal:    { type: Number, default: 0 },  // qtyPacks * buyPerPack
  discountAmt: { type: Number, default: 0 },
  taxAmt:      { type: Number, default: 0 },
  lineTotal:   { type: Number, default: 0 },

  unit:          { type: String, default: 'pieces' },
  containerType: { type: String, default: '' },
}, { _id: true });

const pharmacyInvoiceSchema = new mongoose.Schema({
  // Invoice identity
  invoiceNo:   { type: String, trim: true, default: 'INV-1' },
  invoiceDate: { type: Date, required: true },
  portal:      { type: String, default: 'pharmacy' },

  // Supplier & company
  supplierName: { type: String, trim: true, default: '' },
  supplierId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  companyId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },

  // Items
  items: [invoiceItemSchema],

  // Invoice-level taxes
  invoiceTaxes: [invoiceTaxSchema],

  // Computed totals (stored for fast reporting)
  grossTotal:        { type: Number, default: 0 },
  totalDiscounts:    { type: Number, default: 0 },
  totalLineTaxes:    { type: Number, default: 0 },
  totalInvoiceTaxes: { type: Number, default: 0 },
  netTotal:          { type: Number, default: 0 },

  // Status
  status: {
    type: String,
    enum: ['draft', 'saved', 'cancelled'],
    default: 'saved',
  },

  notes: { type: String, trim: true, default: '' },
}, {
  timestamps: true,
});

pharmacyInvoiceSchema.index({ invoiceNo: 1, portal: 1 });
pharmacyInvoiceSchema.index({ supplierName: 1 });
pharmacyInvoiceSchema.index({ invoiceDate: -1 });
pharmacyInvoiceSchema.index({ status: 1 });

export default mongoose.model('PharmacyInvoice', pharmacyInvoiceSchema);
