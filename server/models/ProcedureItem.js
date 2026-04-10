import mongoose from 'mongoose';

const procedureItemSchema = new mongoose.Schema({
  mainCategory: { type: String, required: true, trim: true },
  subCategory: { type: String, required: true, trim: true },
  drug: { type: String, required: true, trim: true },
  unit: { type: String, default: '', trim: true },
  defaultAmount: { type: Number, default: 0 },
  defaultQuantity: { type: Number, default: 1 },
  active: { type: Boolean, default: true },
}, {
  timestamps: true
});

procedureItemSchema.index({ mainCategory: 1, subCategory: 1, drug: 1 }, { unique: true });

const ProcedureItem = mongoose.model('ProcedureItem', procedureItemSchema);
export default ProcedureItem;
