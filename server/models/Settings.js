import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  role: {
    type: String,
    required: true,
    enum: ['admin', 'reception', 'doctor', 'lab', 'pharmacy', 'shop']
  },
  companyName: {
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
  signature: {
    type: String,
    default: ''
  },
  theme: {
    type: String,
    default: 'light',
    enum: ['light', 'dark']
  },
  language: {
    type: String,
    default: 'en'
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
  }
}, {
  timestamps: true
});

// Indexes for faster queries
settingsSchema.index({ userId: 1, role: 1 });

const Settings = mongoose.model('Settings', settingsSchema);

export default Settings;
