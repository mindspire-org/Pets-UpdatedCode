import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  petId: {
    type: String,
    required: true
  },
  procedureSessionId: {
    type: String,
    trim: true,
  },
  clientId: {
    type: String
  },
  petName: {
    type: String,
    required: true
  },
  ownerName: {
    type: String,
    required: true
  },
  ownerContact: {
    type: String
  },
  type: {
    type: String,
    required: true
  },
  species: {
    type: String
  },
  date: {
    type: String,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  doctor: {
    type: String
  },
  purpose: {
    type: String
  },
  reason: {
    type: String
  },
  notes: {
    type: String
  },
  status: {
    type: String,
    default: 'Scheduled',
    enum: ['Scheduled', 'Confirmed', 'In Progress', 'Completed', 'Cancelled', 'No Show']
  },
  priority: {
    type: String,
    default: 'Normal',
    enum: ['Low', 'Normal', 'High', 'Emergency']
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for faster queries
appointmentSchema.index({ id: 1 });
appointmentSchema.index({ petId: 1 });
appointmentSchema.index({ date: 1, time: 1 });
appointmentSchema.index({ status: 1 });
appointmentSchema.index({ doctor: 1 });

const Appointment = mongoose.model('Appointment', appointmentSchema);

export default Appointment;
