import mongoose from 'mongoose';

const petshopPharmacyDueSchema = new mongoose.Schema({
  clientId: { type: String, required: true, unique: true },
  name: { type: String, trim: true },
  customerContact: { type: String, trim: true },
  previousDue: { type: Number, default: 0, min: 0 },
  totalPaid: { type: Number, default: 0, min: 0 }
}, { timestamps: true, collection: 'petshop_dues' });

petshopPharmacyDueSchema.index({ clientId: 1 });

const PetshopPharmacyDue = mongoose.model('PetshopPharmacyDue', petshopPharmacyDueSchema);
export default PetshopPharmacyDue;
