import express from 'express';
import Pet from '../models/Pet.js';
import Appointment from '../models/Appointment.js';
import Prescription from '../models/Prescription.js';
import LabReport from '../models/LabReport.js';
import RadiologyReport from '../models/RadiologyReport.js';
import PharmacySale from '../models/PharmacySale.js';
import Financial from '../models/Financial.js';

const router = express.Router();

const normalizeId = (v) => String(v || '').trim();

async function buildPetRecord(pet) {
  const petId = normalizeId(pet.id || pet._id);
  const petName = pet.petName;
  const ownerName = pet.ownerName;
  const clientId = pet.clientId || pet.details?.owner?.clientId || '';

  const [appointments, prescriptions, labReports, radiologyReports, pharmacySales, financials] = await Promise.all([
    Appointment.find({ petId: petId }).sort({ createdAt: -1 }),
    Prescription.find({ 'patient.id': petId }).sort({ when: -1 }),
    LabReport.find({ $or: [{ petId: petId }, { petName: petName, ownerName: ownerName }] }).sort({ createdAt: -1 }),
    RadiologyReport.find({ $or: [{ petId: petId }, { petName: petName, ownerName: ownerName }] }).sort({ createdAt: -1 }),
    PharmacySale.find({ $or: [{ patientId: petId }, { petName: petName, customerName: ownerName }] }).sort({ createdAt: -1 }),
    Financial.find({ petId: petId }).sort({ date: -1 })
  ]);

  const totals = {
    prescriptions: prescriptions.length,
    pharmacyTotal: pharmacySales.reduce((s, x) => s + (x.totalAmount || 0), 0),
    pharmacyPaid: pharmacySales.reduce((s, x) => s + Number(x.receivedAmount || x.totalAmount || 0), 0),
    pharmacyDue: pharmacySales.reduce((s, x) => s + Number(x.dueAmount || 0), 0),
    labTotal: labReports.reduce((s, x) => s + Number(x.amount || 0), 0),
    labPaid: labReports.filter(x => x.paymentStatus === 'Paid').reduce((s, x) => s + Number(x.amount || 0), 0),
    labUnpaid: labReports.filter(x => x.paymentStatus !== 'Paid').reduce((s, x) => s + Number(x.amount || 0), 0),
    radiologyTotal: radiologyReports.reduce((s, x) => s + Number(x.amount || 0), 0),
    radiologyPaid: radiologyReports.filter(x => x.paymentStatus === 'Paid').reduce((s, x) => s + Number(x.amount || 0), 0),
    radiologyUnpaid: radiologyReports.filter(x => x.paymentStatus !== 'Paid').reduce((s, x) => s + Number(x.amount || 0), 0),
    consultationFees: financials
      .filter(f => f.type === 'Income' && /consult/i.test(f.category || '') )
      .reduce((s, f) => s + Number(f.amount || 0), 0)
  };

  return { pet, appointments, prescriptions, labReports, radiologyReports, pharmacySales, financials, totals, clientId };
}

// Get full record by pet id
router.get('/pet/:id', async (req, res) => {
  try {
    const id = normalizeId(req.params.id);
    let pet = await Pet.findOne({ id });
    if (!pet) return res.status(404).json({ success: false, message: 'Pet not found' });

    const record = await buildPetRecord(pet);
    res.json({ success: true, data: record });
  } catch (error) {
    console.error('full-record pet error', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get full record by clientId
router.get('/client/:clientId', async (req, res) => {
  try {
    const clientId = normalizeId(req.params.clientId);
    const pets = await Pet.find({ $or: [{ clientId }, { 'details.owner.clientId': clientId }] }).sort({ createdAt: -1 });
    if (!pets || pets.length === 0) {
      return res.json({ success: true, data: { clientId, pets: [], totals: {}, summaries: [] } });
    }

    const perPet = await Promise.all(pets.map(p => buildPetRecord(p)));

    // Aggregate totals across all pets
    const grand = perPet.reduce((acc, r) => {
      acc.prescriptions += r.totals.prescriptions;
      acc.pharmacyTotal += r.totals.pharmacyTotal;
      acc.pharmacyPaid += r.totals.pharmacyPaid;
      acc.pharmacyDue += r.totals.pharmacyDue;
      acc.labTotal += r.totals.labTotal;
      acc.labPaid += r.totals.labPaid;
      acc.labUnpaid += r.totals.labUnpaid;
      acc.radiologyTotal += r.totals.radiologyTotal;
      acc.radiologyPaid += r.totals.radiologyPaid;
      acc.radiologyUnpaid += r.totals.radiologyUnpaid;
      acc.consultationFees += r.totals.consultationFees;
      return acc;
    }, { prescriptions: 0, pharmacyTotal: 0, pharmacyPaid: 0, pharmacyDue: 0, labTotal: 0, labPaid: 0, labUnpaid: 0, radiologyTotal: 0, radiologyPaid: 0, radiologyUnpaid: 0, consultationFees: 0 });

    res.json({ success: true, data: { clientId, pets: perPet, totals: grand } });
  } catch (error) {
    console.error('full-record client error', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
