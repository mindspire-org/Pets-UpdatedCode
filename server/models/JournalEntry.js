import mongoose from 'mongoose';

const journalLineSchema = new mongoose.Schema({
  accountCode: {
    type: String,
    required: true,
    trim: true,
  },
  debit: {
    type: Number,
    default: 0,
  },
  credit: {
    type: Number,
    default: 0,
  },
}, { _id: false });

const journalEntrySchema = new mongoose.Schema({
  date: {
    type: Date,
    default: Date.now,
  },
  // Link to DaySession when available
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DaySession',
  },
  // Cached YYYY-MM-DD for efficient day queries
  dayDate: {
    type: String,
    trim: true,
    index: true,
  },
  portal: {
    type: String,
    enum: ['admin', 'reception', 'doctor', 'pharmacy', 'lab', 'shop', 'system'],
    default: 'system',
  },
  sourceType: {
    type: String,
    required: true,
    trim: true,
  },
  sourceId: {
    type: String,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  lines: {
    type: [journalLineSchema],
    validate: {
      validator: function (v) {
        if (!v || v.length === 0) return false;
        const totalDebit = v.reduce((s, l) => s + (l.debit || 0), 0);
        const totalCredit = v.reduce((s, l) => s + (l.credit || 0), 0);
        return Math.abs(totalDebit - totalCredit) < 0.01; // must balance
      },
      message: 'Journal entry lines must balance (debits = credits)',
    },
  },
  meta: {
    patientId: String,
    petId: String,
    doctorId: String,
    clientId: String,
    customerId: String,
    supplierId: String,
    portalRef: String,
    extra: mongoose.Schema.Types.Mixed,
  },
}, {
  timestamps: true,
});

journalEntrySchema.index({ date: -1 });
journalEntrySchema.index({ portal: 1, date: -1 });
journalEntrySchema.index({ 'meta.supplierId': 1, date: -1 });
journalEntrySchema.index({ 'meta.customerId': 1, date: -1 });
journalEntrySchema.index({ 'meta.patientId': 1, date: -1 });

const JournalEntry = mongoose.model('JournalEntry', journalEntrySchema);

export default JournalEntry;
