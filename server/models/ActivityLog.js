import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  when: {
    type: String,
    required: true
  },
  user: {
    type: String,
    required: true,
    index: true
  },
  text: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// Create indexes for better query performance
activityLogSchema.index({ when: -1 });
activityLogSchema.index({ user: 1, when: -1 });

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

export default ActivityLog;
