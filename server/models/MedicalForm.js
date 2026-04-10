import mongoose from 'mongoose';

const medicalFormSchema = new mongoose.Schema({
  formType: {
    type: String,
    required: true,
    enum: ['Treatment Chart', 'Blood Transfusion'],
  },
  patientId: {
    type: String,
    required: true,
    index: true,
  },
  animalName: String,
  ownerName: String,
  species: String,
  age: String,
  bodyWeight: String,
  contact: String,
  contactPerson: String,
  gender: String,
  doa: String,
  tempF: String,
  dehydrationLevel: String,
  hct: String,
  
  // Treatment Chart specific fields
  drugs: {
    type: Array,
    default: [],
  },
  treatmentDates: [String],
  temp: mongoose.Schema.Types.Mixed,
  dehydration: mongoose.Schema.Types.Mixed,
  tempNote: String,
  dehydrationNote: String,
  
  // Blood Transfusion specific fields
  presentingComplaint: String,
  lastImmunization: String,
  lastAntihelmintics: String,
  bloodType: String,
  transfusionPurpose: String,
  desiredHct: String,
  recipientHct: String,
  donorHct: String,
  donorWeightKg: String,
  factorMode: String,
  customFactor: String,
  transfusionMeds: {
    type: Array,
    default: [],
  },
  labFindings: String,
  medicationsAdministered: {
    type: Array,
    default: [],
  },
  
  // Additional fields
  clientId: String,
  sex: String,
  neuteredSpayed: String,
  colorMarking: String,
  microchipNumber: String,
  cnicOwner: String,
  contactOwnerGuardian: String,
  alternateContact: String,
  homeAddress: String,
  
  // Metadata
  createdBy: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Index for efficient queries
medicalFormSchema.index({ patientId: 1, createdAt: -1 });
medicalFormSchema.index({ formType: 1, patientId: 1 });

export default mongoose.model('MedicalForm', medicalFormSchema);
