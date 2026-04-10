import mongoose from 'mongoose';

const sequenceSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

sequenceSchema.index({ key: 1 }, { unique: true });

const Sequence = mongoose.model('Sequence', sequenceSchema);

export default Sequence;
