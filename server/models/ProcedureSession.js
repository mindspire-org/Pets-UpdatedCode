import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true, min: 0 },
  method: { type: String, trim: true, default: 'Cash' },
  paidAt: { type: Date, default: Date.now },
  note: { type: String, trim: true },
}, { _id: false });

const procedureItemSchema = new mongoose.Schema({
  mainCategory: { type: String, trim: true },
  subCategory: { type: String, trim: true },
  drug: { type: String, trim: true },
  quantity: { type: Number, min: 0 },
  unit: { type: String, trim: true },
  amount: { type: Number, min: 0 },
}, { _id: false });

const procedureSessionSchema = new mongoose.Schema({
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProcedurePlan', required: true, index: true },
  petId: { type: String, trim: true, required: true, index: true },

  sessionNo: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ['planned', 'completed'], default: 'planned', index: true },

  scheduledAt: { type: Date },

  sourceRecordId: { type: String, trim: true },

  procedureItems: { type: [procedureItemSchema], default: [] },
  subtotal: { type: Number, default: 0, min: 0 },
  discount: { type: Number, default: 0, min: 0 },
  previousDues: { type: Number, default: 0, min: 0 },
  paymentMethod: { type: String, trim: true },

  totalAmount: { type: Number, default: 0, min: 0 },
  paidAmount: { type: Number, default: 0, min: 0 },

  payments: { type: [paymentSchema], default: [] },
  photos: {
    before: {
      data: { type: String },
      contentType: { type: String },
      uploadedAt: { type: Date },
    },
    after: {
      data: { type: String },
      contentType: { type: String },
      uploadedAt: { type: Date },
    },
  },
}, { timestamps: true });

procedureSessionSchema.index({ petId: 1, createdAt: -1 });
procedureSessionSchema.index({ planId: 1, sessionNo: 1 }, { unique: true });

procedureSessionSchema.virtual('balance').get(function getBalance() {
  const total = Number(this.totalAmount || 0);
  const paid = Number(this.paidAmount || 0);
  return Math.max(0, total - paid);
});

procedureSessionSchema.set('toJSON', { virtuals: true });
procedureSessionSchema.set('toObject', { virtuals: true });

const ProcedureSession = mongoose.model('ProcedureSession', procedureSessionSchema);

export default ProcedureSession;
