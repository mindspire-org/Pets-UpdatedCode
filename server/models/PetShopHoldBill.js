import mongoose from 'mongoose';

const petShopHoldBillItemSchema = new mongoose.Schema({
  // Support both field name conventions (pharmacy cart uses medicineId/medicineName/pricePerUnit)
  medicineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PetshopPharmacyMedicine',
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
  },
  medicineName: { type: String },
  itemName: { type: String },
  barcode: { type: String },
  batchNo: { type: String },
  quantity: { type: Number, required: true },
  pricePerUnit: { type: Number },
  salePrice: { type: Number },
  minSalePrice: { type: Number },
  totalPrice: { type: Number, required: true },
  availableStock: { type: Number },
  unitsPerPack: { type: Number },
  salePerPack: { type: Number },
  loosePrice: { type: Number },
  packPrice: { type: Number },
  sellBy: { type: String, enum: ['Loose', 'Pack'], default: 'Loose' },
  discount: { type: Number, default: 0 },
  dbDefaultDiscount: { type: Number, default: 0 },
  defaultDiscount: { type: Number, default: 0 },
  category: { type: String },
  unit: { type: String }
}, { _id: false });

const petShopHoldBillSchema = new mongoose.Schema({
  holdId: {
    type: String,
    required: true,
    unique: true
  },
  customerInfo: {
    customerId: { type: String },
    customerName: { type: String },
    customerContact: { type: String }
  },
  cart: [petShopHoldBillItemSchema],
  grossTotal: { type: Number, default: 0 },
  lineDiscountsTotal: { type: Number, default: 0 },
  subtotalAfterLineDiscounts: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  billDiscountAmount: { type: Number, default: 0 },
  previousDue: { type: Number, default: 0 },
  payableTotal: { type: Number, default: 0 },
  heldBy: { type: String }
}, {
  timestamps: true,
  collection: 'petshop_heldbills'
});

const PetShopHoldBill = mongoose.model('PetShopHoldBill', petShopHoldBillSchema);

export default PetShopHoldBill;
