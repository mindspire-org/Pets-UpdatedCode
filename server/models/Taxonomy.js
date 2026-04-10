import mongoose from 'mongoose';

const TaxonomySchema = new mongoose.Schema({
  commonName: { type: String, required: true, trim: true },
  speciesName: { type: String, required: true, trim: true },
}, { timestamps: true });

TaxonomySchema.index({ commonName: 1 }, { unique: true });

const Taxonomy = mongoose.model('Taxonomy', TaxonomySchema);
export default Taxonomy;
