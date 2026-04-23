import mongoose from 'mongoose';

const pharmacySettingsSchema = new mongoose.Schema({
  // Single shared document - using a fixed identifier
  settingsId: {
    type: String,
    default: 'pharmacy_shared_settings',
    unique: true,
    required: true
  },
  
  // Pharmacy Information
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
  
  // Default Bill Settings (POS)
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
  
  // Currency and Timezone
  currency: {
    type: String,
    default: 'PKR'
  },
  timezone: {
    type: String,
    default: 'Asia/Karachi'
  },
  
  // Custom/Additional Settings
  customSettings: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Track last updated by
  lastUpdatedBy: {
    type: String,
    default: ''
  },
  lastUpdatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries
pharmacySettingsSchema.index({ settingsId: 1 });

const PharmacySettings = mongoose.model('PharmacySettings', pharmacySettingsSchema);

export default PharmacySettings;
