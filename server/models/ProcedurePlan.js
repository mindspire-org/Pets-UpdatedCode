import mongoose from 'mongoose';

const procedurePlanSchema = new mongoose.Schema({
  petId: { type: String, trim: true, required: true, index: true },
  clientId: { type: String, trim: true },
  petName: { type: String, trim: true },
  ownerName: { type: String, trim: true },
  contact: { type: String, trim: true },

  procedureName: { type: String, trim: true, required: true },
  status: { type: String, enum: ['ongoing', 'completed'], default: 'ongoing', index: true },
  notes: { type: String, trim: true },
}, { timestamps: true });

procedurePlanSchema.index({ petId: 1, status: 1, createdAt: -1 });

const ProcedurePlan = mongoose.model('ProcedurePlan', procedurePlanSchema);

export default ProcedurePlan;
