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

  qtyPacks:        { type: Number, default: 0, min: 0 },
  unitsPerPack:    { type: Number, default: 1, min: 1 },
  buyPerPack:      { type: Number, default: 0, min: 0 },
  salePerPack:     { type: Number, default: 0, min: 0 },

  totalItems:      { type: Number, default: 0, min: 0 },
  buyPerUnit:      { type: Number, default: 0, min: 0 },
  salePerUnit:     { type: Number, default: 0, min: 0 },

  quantity:        { type: Number, default: 0, min: 0 },
  purchasePrice:   { type: Number, default: 0, min: 0 },
  salePrice:       { type: Number, default: 0, min: 0 },
  totalCost:       { type: Number, default: 0, min: 0 },

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

const petshopPharmacyPurchaseSchema = new mongoose.Schema({
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
  timestamps: true,
  collection: 'petshop_purchases'
});

petshopPharmacyPurchaseSchema.index({ purchaseOrderNo: 1 });
petshopPharmacyPurchaseSchema.index({ supplierName: 1 });
petshopPharmacyPurchaseSchema.index({ purchaseDate: -1 });
petshopPharmacyPurchaseSchema.index({ invoiceNo: 1 });

const PetshopPharmacyPurchase = mongoose.model('PetshopPharmacyPurchase', petshopPharmacyPurchaseSchema);

export default PetshopPharmacyPurchase;
