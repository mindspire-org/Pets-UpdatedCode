import mongoose from 'mongoose';

const invoiceTaxSchema = new mongoose.Schema({
  name: { type: String, trim: true, default: '' },
  type: { type: String, enum: ['%', 'PKR'], default: '%' },
  value: { type: Number, default: 0 },
  applyOn: { type: String, enum: ['gross', 'net'], default: 'gross' },
  amount: { type: Number, default: 0 },
}, { _id: false });

const draftItemSchema = new mongoose.Schema({
  mainCategory: { type: String, trim: true, default: '' },
  subCategory:  { type: String, trim: true, default: '' },
  category:     { type: String, trim: true, default: '' },
  medicineName: { type: String, required: true, trim: true },
  genericName:  { type: String, trim: true, default: '' },
  batchNo:      { type: String, trim: true, default: '' },
  barcode:      { type: String, trim: true, default: '' },
  expiryDate:   { type: Date },

  qtyPacks:    { type: Number, default: 0 },
  unitsPerPack:{ type: Number, default: 1 },
  buyPerPack:  { type: Number, default: 0 },
  salePerPack: { type: Number, default: 0 },

  totalItems:    { type: Number, default: 0 },
  buyPerUnit:    { type: Number, default: 0 },
  salePerUnit:   { type: Number, default: 0 },

  minStock:        { type: Number, default: 0 },
  defaultDiscount: { type: Number, default: 0 },
  lineTaxType:     { type: String, enum: ['%', 'PKR'], default: '%' },
  lineTaxValue:    { type: Number, default: 0 },

  subtotal:    { type: Number, default: 0 },
  discountAmt: { type: Number, default: 0 },
  taxAmt:      { type: Number, default: 0 },
  lineTotal:   { type: Number, default: 0 },

  unit:          { type: String, default: 'pieces' },
  containerType: { type: String, default: '' },

  // ── Per-item review status ──────────────────────────────────────────────
  itemStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  itemReviewedBy:      { type: String, trim: true, default: '' },
  itemReviewedAt:      { type: Date },
  itemReviewComments:  { type: String, trim: true, default: '' },
  // Reference to the PharmacyMedicine doc created on approval
  medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'PharmacyMedicine' },
}, { _id: true });

const pharmacyPurchaseDraftSchema = new mongoose.Schema({
  invoiceNo:   { type: String, trim: true, default: 'INV-1' },
  invoiceDate: { type: Date, required: true },
  portal:      { type: String, default: 'pharmacy' },

  supplierName: { type: String, trim: true, default: '' },
  supplierId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  companyId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },

  items: [draftItemSchema],
  invoiceTaxes: [invoiceTaxSchema],

  grossTotal:        { type: Number, default: 0 },
  totalLineTaxes:    { type: Number, default: 0 },
  totalInvoiceTaxes: { type: Number, default: 0 },
  netTotal:          { type: Number, default: 0 },

  // Overall draft status — auto-computed from item statuses
  // 'pending'  → at least one item still pending
  // 'approved' → all items approved
  // 'rejected' → all items rejected
  // 'partial'  → mix of approved + rejected (no pending left)
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'partial'],
    default: 'pending',
  },

  submittedBy:    { type: String, trim: true, default: '' },
  submittedAt:    { type: Date, default: Date.now },
  reviewedBy:     { type: String, trim: true, default: '' },
  reviewedAt:     { type: Date },
  reviewComments: { type: String, trim: true, default: '' },

  convertedInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'PharmacyInvoice' },
  notes: { type: String, trim: true, default: '' },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

pharmacyPurchaseDraftSchema.index({ status: 1, submittedAt: -1 });
pharmacyPurchaseDraftSchema.index({ supplierName: 1 });
pharmacyPurchaseDraftSchema.index({ invoiceDate: -1 });
pharmacyPurchaseDraftSchema.index({ portal: 1, status: 1 });

const PharmacyPurchaseDraft = mongoose.model('PharmacyPurchaseDraft', pharmacyPurchaseDraftSchema);
export default PharmacyPurchaseDraft;
