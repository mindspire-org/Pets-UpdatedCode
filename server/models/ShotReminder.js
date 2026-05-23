import mongoose from 'mongoose';

const shotReminderSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  prescriptionId: {
    type: String,
    required: true
  },
  patientId: String,
  petName: String,
  ownerName: String,
  ownerPhone: String,
  doctorName: String,
  vaccineName: String,
  shotStage: String,
  dueDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Completed', 'Cancelled'],
    default: 'Pending'
  },
  instructions: String,
  shotIndex: Number,
  vaccineIndex: Number,
  vaccineSummary: {
    total: Number,
    pending: Number,
    completed: Number,
    cancelled: Number
  },
  lastNotified: Date
}, {
  timestamps: true
});

// Indexes for common lookups
shotReminderSchema.index({ dueDate: 1 });
shotReminderSchema.index({ status: 1 });
shotReminderSchema.index({ patientId: 1 });
shotReminderSchema.index({ prescriptionId: 1 });

const ShotReminder = mongoose.model('ShotReminder', shotReminderSchema);

export default ShotReminder;
