import mongoose from 'mongoose';

const invoiceTaxSchema = new mongoose.Schema({
  name: { type: String, trim: true, default: '' },
  type: { type: String, enum: ['%', 'PKR'], default: '%' },
  value: { type: Number, default: 0 },
  applyOn: { type: String, enum: ['gross', 'net'], default: 'gross' },
  amount: { type: Number, default: 0 },
}, { _id: false });

const invoiceItemSchema = new mongoose.Schema({
  medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'PetshopPharmacyMedicine' },

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
}, { _id: true });

const petshopPharmacyInvoiceSchema = new mongoose.Schema({
  invoiceNo:   { type: String, trim: true, default: 'INV-1' },
  invoiceDate: { type: Date, required: true },
  portal:      { type: String, default: 'shop' },

  supplierName: { type: String, trim: true, default: '' },
  supplierId:   { type: mongoose.Schema.Types.ObjectId, ref: 'PetShopSupplier' },
  companyId:    { type: mongoose.Schema.Types.ObjectId, ref: 'PetShopCompany' },

  items: [invoiceItemSchema],
  invoiceTaxes: [invoiceTaxSchema],

  grossTotal:        { type: Number, default: 0 },
  totalDiscounts:    { type: Number, default: 0 },
  totalLineTaxes:    { type: Number, default: 0 },
  totalInvoiceTaxes: { type: Number, default: 0 },
  netTotal:          { type: Number, default: 0 },

  status: {
    type: String,
    enum: ['draft', 'saved', 'cancelled'],
    default: 'saved',
  },

  amountPaid:    { type: Number, default: 0, min: 0 },
  paymentStatus: { type: String, enum: ['Pending', 'Partial', 'Paid'], default: 'Pending' },

  notes: { type: String, trim: true, default: '' },
}, {
  timestamps: true,
  collection: 'petshop_invoices'
});

petshopPharmacyInvoiceSchema.index({ invoiceNo: 1, portal: 1 });
petshopPharmacyInvoiceSchema.index({ supplierName: 1 });
petshopPharmacyInvoiceSchema.index({ invoiceDate: -1 });
petshopPharmacyInvoiceSchema.index({ status: 1 });

export default mongoose.model('PetshopPharmacyInvoice', petshopPharmacyInvoiceSchema);
