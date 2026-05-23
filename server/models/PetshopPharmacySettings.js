import mongoose from 'mongoose';

const petshopPharmacySettingsSchema = new mongoose.Schema({
  settingsId: {
    type: String,
    default: 'petshop_shared_settings',
    unique: true,
    required: true
  },
  pharmacyName: {
    type: String,
    default: ''
  },
  companyLogo: {
    type: String,
    default: ''
  },
  address: {
    type: String,
    default: ''
  },
  phone: {
    type: String,
    default: ''
  },
  email: {
    type: String,
    default: ''
  },
  website: {
    type: String,
    default: ''
  },
  billingFooter: {
    type: String,
    default: ''
  },
  billDiscountPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  salesTaxPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  currency: {
    type: String,
    default: 'PKR'
  },
  timezone: {
    type: String,
    default: 'Asia/Karachi'
  },
  customSettings: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  lastUpdatedBy: {
    type: String,
    default: ''
  },
  lastUpdatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'petshop_settings'
});

petshopPharmacySettingsSchema.index({ settingsId: 1 });

const PetshopPharmacySettings = mongoose.model('PetshopPharmacySettings', petshopPharmacySettingsSchema);

export default PetshopPharmacySettings;
