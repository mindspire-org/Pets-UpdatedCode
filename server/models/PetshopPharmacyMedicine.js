import mongoose from 'mongoose';

const petshopPharmacyMedicineSchema = new mongoose.Schema({
  medicineName: {
    type: String,
    required: true,
    trim: true
  },
  batchNo: {
    type: String,
    trim: true
  },
  mainCategory: {
    type: String,
    trim: true,
    default: 'Medicine'
  },
  subCategory: {
    type: String,
    trim: true,
    default: function () {
      return this.category || 'General';
    }
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  expiryDate: {
    type: Date,
    required: false
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String,
    default: 'pieces'
  },
  purchasePrice: {
    type: Number,
    required: true,
    min: 0
  },
  salePrice: {
    type: Number,
    required: true,
    min: 0
  },
  minSalePrice: {
    type: Number,
    default: 0,
    min: 0
  },
  supplierName: {
    type: String,
    required: true,
    trim: true
  },
  purchaseDate: {
    type: Date,
    required: true
  },
  invoiceNo: {
    type: String,
    trim: true
  },
  invoiceDate: {
    type: Date
  },
  barcode: {
    type: String,
    trim: true,
    default: '',
  },
  lowStockThreshold: {
    type: Number,
    default: 10
  },
  description: {
    type: String,
    trim: true
  },
  containerType: {
    type: String,
    trim: true,
    default: ''
  },
  // For ml-based medicines (injections)
  mlPerVial: {
    type: Number,
    min: 0
  },
  // Original quantity when purchased (for tracking)
  originalQuantity: {
    type: Number,
    min: 0
  },
  // Remaining ml for injections (tracks partial usage)
  remainingMl: {
    type: Number,
    min: 0
  },
  // Track if this is an active batch
  isActive: {
    type: Boolean,
    default: true
  },
  // Dosage information
  dosage: {
    type: String,
    trim: true
  },
  // Manufacturer
  manufacturer: {
    type: String,
    trim: true
  },
  // Invoice item fields
  genericName: { type: String, trim: true, default: '' },
  qtyPacks: { type: Number, default: 0 },
  unitsPerPack: { type: Number, default: 1 },
  buyPerPack: { type: Number, default: 0 },
  salePerPack: { type: Number, default: 0 },
  totalItems: { type: Number, default: 0 },
  minStock: { type: Number, default: 0 },
  defaultDiscount: { type: Number, default: 0 },
  lineTaxType: { type: String, enum: ['%', 'PKR'], default: '%' },
  lineTaxValue: { type: Number, default: 0 },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'PetShopCompany' },
}, {
  timestamps: true,
  collection: 'petshop_products',
});

petshopPharmacyMedicineSchema.index({ medicineName: 1, batchNo: 1 }, { sparse: true });
petshopPharmacyMedicineSchema.index({ category: 1 });
petshopPharmacyMedicineSchema.index({ mainCategory: 1 });
petshopPharmacyMedicineSchema.index({ subCategory: 1 });
petshopPharmacyMedicineSchema.index({ expiryDate: 1 });
petshopPharmacyMedicineSchema.index({ barcode: 1 }, { sparse: true });

petshopPharmacyMedicineSchema.virtual('isExpired').get(function() {
  if (!this.expiryDate) return false; // no expiry = never expires
  return this.expiryDate < new Date();
});

petshopPharmacyMedicineSchema.virtual('isExpiringSoon').get(function() {
  if (!this.expiryDate) return false; // no expiry = never expires
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  return this.expiryDate <= thirtyDaysFromNow && this.expiryDate >= new Date();
});

petshopPharmacyMedicineSchema.virtual('isLowStock').get(function() {
  return this.quantity <= this.lowStockThreshold;
});

petshopPharmacyMedicineSchema.set('toJSON', { virtuals: true });
petshopPharmacyMedicineSchema.set('toObject', { virtuals: true });

const PetshopPharmacyMedicine = mongoose.model('PetshopPharmacyMedicine', petshopPharmacyMedicineSchema);

export default PetshopPharmacyMedicine;
