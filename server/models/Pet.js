import mongoose from 'mongoose';

const petSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  clientId: {
    type: String,
    // was unique before; allow multiple pets per client now
    sparse: true,
    trim: true
  },
  petName: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    default: 'Unknown'
  },
  species: {
    type: String,
    trim: true
  },
  breed: {
    type: String,
    trim: true
  },
  age: {
    type: String,
    trim: true
  },
  // Prefer using dateOfBirth for dynamic age calculation.
  // ageRecordedAt is optional reference for when the provided "age" string was captured
  dateOfBirth: {
    type: Date
  },
  ageRecordedAt: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', '']
  },
  ownerName: {
    type: String,
    required: true,
    trim: true
  },
  ownerContact: {
    type: String,
    trim: true
  },
  ownerAddress: {
    type: String,
    trim: true
  },
  when: {
    type: Date,
    default: Date.now
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    default: 'Active',
    enum: ['Active', 'Inactive', 'Deceased', 'Expired']
  },
  dateOfDeath: {
    type: Date
  },
  deathNote: {
    type: String,
    trim: true
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform(doc, ret) {
      // Map age to computedAge for responses, so UI sees always-updated value
      if (typeof doc.computedAge === 'function') {
        ret.age = doc.computedAge();
      } else if (doc.computedAge) {
        ret.age = doc.computedAge;
      }
      return ret;
    }
  },
  toObject: { virtuals: true }
});

function formatAge(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '';
  const day = 24 * 60 * 60 * 1000;
  const year = 365.25 * day;
  const month = 30.4375 * day; // average month length
  // Show day-wise age for the first ~3 months (90 days)
  if (ms < 90 * day) {
    const d = Math.floor(ms / day);
    return `${d} day${d === 1 ? '' : 's'}`;
  }
  if (ms < 12 * month) {
    const m = Math.floor(ms / month);
    return `${m} month${m === 1 ? '' : 's'}`;
  }
  const y = Math.floor(ms / year);
  const rem = ms - y * year;
  const m = Math.floor(rem / month);
  if (m > 0) return `${y} year${y === 1 ? '' : 's'} ${m} month${m === 1 ? '' : 's'}`;
  return `${y} year${y === 1 ? '' : 's'}`;
}

// Helper to parse stored string like "10 days", "2 weeks", "3 months", "1 year"
function parseAgeStringToMs(ageStr = '') {
  const s = String(ageStr || '').trim().toLowerCase();
  const rx = /^(\d+)\s*(day|days|week|weeks|month|months|year|years)$/i;
  const m = s.match(rx);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2];
  const day = 24 * 60 * 60 * 1000;
  switch (unit) {
    case 'day':
    case 'days': return n * day;
    case 'week':
    case 'weeks': return n * 7 * day;
    case 'month':
    case 'months': return Math.round(n * 30.4375 * day);
    case 'year':
    case 'years': return Math.round(n * 365.25 * day);
    default: return null;
  }
}

// Virtual that returns a function to compute age string at call time
petSchema.virtual('computedAge').get(function() {
  const now = Date.now();
  let dob = this.dateOfBirth ? new Date(this.dateOfBirth).getTime() : null;
  if (!dob) {
    const baseline = this.ageRecordedAt ? new Date(this.ageRecordedAt).getTime() : (this.createdAt ? new Date(this.createdAt).getTime() : null);
    const ageMsAtBaseline = parseAgeStringToMs(this.age);
    if (baseline && ageMsAtBaseline != null) {
      dob = baseline - ageMsAtBaseline;
    }
  }
  if (!dob) return () => this.age || '';
  const ms = now - dob;
  return () => formatAge(ms);
});

// Indexes for faster queries
petSchema.index({ id: 1 });
petSchema.index({ clientId: 1 });
petSchema.index({ petName: 1 });
petSchema.index({ ownerName: 1 });
petSchema.index({ 'details.pet.petId': 1 });
petSchema.index({ 'details.owner.ownerId': 1 });

const Pet = mongoose.model('Pet', petSchema);

export default Pet;
