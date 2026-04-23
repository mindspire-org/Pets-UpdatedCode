import mongoose from 'mongoose';

const companySchema = new mongoose.Schema({
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
    default: 'pharmacy'
  }
}, {
  timestamps: true
});

// Index for faster queries
companySchema.index({ companyName: 1, portal: 1 });
companySchema.index({ status: 1 });

export default mongoose.model('Company', companySchema);
