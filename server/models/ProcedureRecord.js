import mongoose from 'mongoose';

const procedureItemSchema = new mongoose.Schema({
  mainCategory: { type: String, required: true, trim: true },
  subCategory: { type: String, required: true, trim: true },
  drug:        { type: String, required: true, trim: true },
  quantity:    { type: Number, required: true, min: 0 },
  unit:        { type: String, trim: true },
  amount:      { type: Number, required: true, min: 0 }
}, { _id: false });

const procedureRecordSchema = new mongoose.Schema({
  petId:      { type: String, trim: true },
  clientId:   { type: String, trim: true },
  petName:    { type: String, required: true, trim: true },
  ownerName:  { type: String, required: true, trim: true },
  contact:    { type: String, trim: true },
  procedures: { type: [procedureItemSchema], default: [] },
  subtotal:   { type: Number, required: true, min: 0 },
  previousDues: { type: Number, default: 0, min: 0 },
  grandTotal: { type: Number, required: true, min: 0 },
  receivedAmount: { type: Number, default: 0, min: 0 },
  receivable: { type: Number, default: 0, min: 0 },
  notes:      { type: String, trim: true },
  createdBy:  { type: String, trim: true, default: 'Reception' }
}, {
  timestamps: true
});

procedureRecordSchema.index({ petId: 1, createdAt: -1 });
procedureRecordSchema.index({ clientId: 1, createdAt: -1 });

const ProcedureRecord = mongoose.model('ProcedureRecord', procedureRecordSchema);

export default ProcedureRecord;
