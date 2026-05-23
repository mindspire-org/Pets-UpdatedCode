import mongoose from 'mongoose';

const petShopCompanySchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  portal: {
    type: String,
    default: 'shop'
  },
  // Additional fields specific to pet shop companies
  contactPerson: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  address: {
    type: String,
    trim: true
  },
  website: {
    type: String,
    trim: true
  },
  // Business details
  businessType: {
    type: String,
    enum: ['manufacturer', 'distributor', 'wholesaler', 'retailer', 'importer', 'other'],
    default: 'distributor'
  },
  // Product categories they specialize in
  specializations: [{
    type: String,
    trim: true
  }],
  // Payment terms
  paymentTerms: {
    type: String,
    trim: true,
    default: 'Net 30'
  },
  // Credit limit
  creditLimit: {
    type: Number,
    default: 0
  },
  // Tax information
  taxId: {
    type: String,
    trim: true
  },
  // Notes
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true,
  collection: 'petshop_companies'
});

// Index for faster queries
petShopCompanySchema.index({ companyName: 1, portal: 1 });
petShopCompanySchema.index({ status: 1 });
petShopCompanySchema.index({ businessType: 1 });
petShopCompanySchema.index({ specializations: 1 });

export default mongoose.model('PetShopCompany', petShopCompanySchema);