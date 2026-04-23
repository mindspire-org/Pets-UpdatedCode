import mongoose from 'mongoose';

const purchaseItemSchema = new mongoose.Schema({
  medicineName:    { type: String, required: true },
  genericName:     { type: String, trim: true, default: '' },
  batchNo:         { type: String, required: true },
  barcode:         { type: String, trim: true, default: '' },
  mainCategory:    { type: String, trim: true, default: '' },
  subCategory:     { type: String, trim: true, default: '' },
  category:        { type: String, required: true },
  expiryDate:      { type: Date, required: true },
  unit:            { type: String, required: true },
  containerType:   { type: String, default: '' },

  // Pack-level quantities & pricing (from AddInvoice)
  qtyPacks:        { type: Number, default: 0, min: 0 },
  unitsPerPack:    { type: Number, default: 1, min: 1 },
  buyPerPack:      { type: Number, default: 0, min: 0 },
  salePerPack:     { type: Number, default: 0, min: 0 },

  // Computed fields
  totalItems:      { type: Number, default: 0, min: 0 },  // qtyPacks * unitsPerPack
  buyPerUnit:      { type: Number, default: 0, min: 0 },  // buyPerPack / unitsPerPack
  salePerUnit:     { type: Number, default: 0, min: 0 },  // salePerPack / unitsPerPack

  // Legacy / backward-compat fields
  quantity:        { type: Number, default: 0, min: 0 },  // = totalItems
  purchasePrice:   { type: Number, default: 0, min: 0 },  // = buyPerUnit
  salePrice:       { type: Number, default: 0, min: 0 },  // = salePerUnit
  totalCost:       { type: Number, default: 0, min: 0 },  // = lineTotal

  // Discount & tax
  defaultDiscount: { type: Number, default: 0, min: 0 },
  lineTaxType:     { type: String, enum: ['%', 'PKR'], default: '%' },
  lineTaxValue:    { type: Number, default: 0, min: 0 },
  subtotal:        { type: Number, default: 0, min: 0 },
  discountAmt:     { type: Number, default: 0, min: 0 },
  taxAmt:          { type: Number, default: 0, min: 0 },
  lineTotal:       { type: Number, default: 0, min: 0 },

  minStock:        { type: Number, default: 0, min: 0 },
  mlPerVial:       { type: Number, min: 0 }
}, { _id: false });

const pharmacyPurchaseSchema = new mongoose.Schema({
  purchaseOrderNo: {
    type: String,
    required: true,
    unique: true
  },
  supplierName: {
    type: String,
    required: true,
    trim: true
  },
  supplierContact: {
    type: String,
    trim: true
  },
  invoiceNo: {
    type: String,
    required: true,
    trim: true
  },
  purchaseDate: {
    type: Date,
    required: true
  },
  items: [purchaseItemSchema],
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  grossTotal:        { type: Number, default: 0, min: 0 },
  totalLineTaxes:    { type: Number, default: 0, min: 0 },
  totalInvoiceTaxes: { type: Number, default: 0, min: 0 },
  netTotal:          { type: Number, default: 0, min: 0 },
  invoiceTaxes: [{
    name:    { type: String, default: '' },
    type:    { type: String, enum: ['%', 'PKR'], default: '%' },
    value:   { type: Number, default: 0 },
    applyOn: { type: String, enum: ['gross', 'net'], default: 'gross' },
    amount:  { type: Number, default: 0 },
    _id: false
  }],
  paymentStatus: {
    type: String,
    enum: ['Paid', 'Pending', 'Partial'],
    default: 'Pending'
  },
  amountPaid: {
    type: Number,
    default: 0,
    min: 0
  },
  notes: {
    type: String,
    trim: true
  },
  receivedBy: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for faster queries
pharmacyPurchaseSchema.index({ purchaseOrderNo: 1 });
pharmacyPurchaseSchema.index({ supplierName: 1 });
pharmacyPurchaseSchema.index({ purchaseDate: -1 });
pharmacyPurchaseSchema.index({ invoiceNo: 1 });

const PharmacyPurchase = mongoose.model('PharmacyPurchase', pharmacyPurchaseSchema);

export default PharmacyPurchase;
