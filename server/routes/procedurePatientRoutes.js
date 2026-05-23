import express from 'express';
import ProcedurePlan from '../models/ProcedurePlan.js';
import ProcedureSession from '../models/ProcedureSession.js';
import Pet from '../models/Pet.js';
import Appointment from '../models/Appointment.js';
import Receivable from '../models/Receivable.js';

const router = express.Router();

// GET /api/procedure-patients
// Query:
// - tab: active | unpaid | completed
// - search: text
// - page: 1-based
// - limit: number
router.get('/', async (req, res) => {
  try {
    const tab = String(req.query.tab || 'active').toLowerCase();
    const search = String(req.query.search || '').trim();
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 25)));
    const skip = (page - 1) * limit;

    // Build search filter for plans
    const planMatch = {};
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      planMatch.$or = [
        { petId: rx },
        { clientId: rx },
        { petName: rx },
        { ownerName: rx },
        { contact: rx },
      ];
    }

    // Fetch all plans with their sessions
    const plans = await ProcedurePlan.find(planMatch).sort({ createdAt: -1 }).lean();
    const planIds = (plans || []).map(p => p._id);

    // Fetch all sessions for these plans
    const sessions = planIds.length
      ? await ProcedureSession.find({ planId: { $in: planIds } }).lean()
      : [];

    // Group sessions by petId and calculate totals
    const byPet = {};
    (sessions || []).forEach(s => {
      const pid = String(s.petId || '').trim();
      if (!pid) return;
      if (!byPet[pid]) {
        byPet[pid] = {
          petId: pid,
          totalAmount: 0,
          paidAmount: 0,
          sessions: [],
          plans: [],
          lastVisit: null,
        };
      }
      byPet[pid].totalAmount += Number(s.totalAmount || 0);
      byPet[pid].paidAmount += Number(s.paidAmount || 0);
      byPet[pid].sessions.push(s);
      const sDate = s.createdAt ? new Date(s.createdAt) : null;
      if (sDate && (!byPet[pid].lastVisit || sDate > byPet[pid].lastVisit)) {
        byPet[pid].lastVisit = sDate;
      }
    });

    // Attach plan info to each pet
    (plans || []).forEach(p => {
      const pid = String(p.petId || '').trim();
      if (!pid || !byPet[pid]) return;
      byPet[pid].plans.push(p);
      byPet[pid].clientId = p.clientId || byPet[pid].clientId;
      byPet[pid].petName = p.petName || byPet[pid].petName;
      byPet[pid].ownerName = p.ownerName || byPet[pid].ownerName;
      byPet[pid].contact = p.contact || byPet[pid].contact;
      // Update lastVisit from plan if newer
      const pDate = p.createdAt ? new Date(p.createdAt) : null;
      if (pDate && (!byPet[pid].lastVisit || pDate > byPet[pid].lastVisit)) {
        byPet[pid].lastVisit = pDate;
      }
    });

    // Build list with calculated remaining dues
    let list = Object.values(byPet).map(row => ({
      petId: row.petId,
      clientId: row.clientId || '',
      name: row.petName || '',
      ownerName: row.ownerName || '',
      phone: row.contact || '',
      lastVisit: row.lastVisit,
      totalPaid: row.paidAmount,
      totalAmount: row.totalAmount,
      remainingDues: Math.max(0, row.totalAmount - row.paidAmount),
      hasOngoing: (row.plans || []).some(p => p.status !== 'completed'),
    }));

    // Apply tab filter
    if (tab === 'unpaid') {
      list = list.filter(r => Number(r.remainingDues || 0) > 0);
    } else if (tab === 'completed') {
      list = list.filter(r => Number(r.remainingDues || 0) <= 0);
    } else {
      // active: has ongoing procedures OR has remaining dues
      list = list.filter(r => r.hasOngoing || Number(r.remainingDues || 0) > 0);
    }

    const total = list.length;

    // Sort by lastVisit desc
    list.sort((a, b) => {
      const aDate = a.lastVisit ? new Date(a.lastVisit).getTime() : 0;
      const bDate = b.lastVisit ? new Date(b.lastVisit).getTime() : 0;
      return bDate - aDate;
    });

    // Paginate
    const data = list.slice(skip, skip + limit);

    // Fetch next appointments
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const petIds = (data || []).map(d => String(d?.petId || '').trim()).filter(Boolean);
    const appts = petIds.length
      ? await Appointment.find({
          petId: { $in: petIds },
          status: { $nin: ['Cancelled', 'No Show'] },
        })
          .sort({ date: 1, time: 1 })
          .lean()
      : [];

    const apptsByPet = (appts || []).reduce((acc, a) => {
      const pid = String(a?.petId || '').trim();
      if (!pid) return acc;
      if (!acc[pid]) acc[pid] = [];
      acc[pid].push(a);
      return acc;
    }, {});

    const withNextAppointment = (data || []).map((row) => {
      const pid = String(row?.petId || '').trim();
      const next = (apptsByPet[pid] || [])
        .map(a => ({ ...a, _dt: toDateTime(a.date, a.time) }))
        .filter(a => a._dt && a._dt >= today)
        .sort((a, b) => a._dt - b._dt)[0] || null;

      return {
        ...row,
        nextAppointment: next
          ? { id: next.id, date: next.date, time: next.time, status: next.status, doctor: next.doctor, type: next.type }
          : null,
      };
    });

    res.json({ success: true, data: withNextAppointment, page, limit, total });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to load procedure patients' });
  }
});

const toDateTime = (dateStr, timeStr) => {
  try {
    const d = String(dateStr || '').trim();
    const t = String(timeStr || '').trim();
    if (!d) return null;
    const iso = t ? `${d}T${t}:00` : `${d}T00:00:00`;
    const dt = new Date(iso);
    if (!Number.isFinite(dt.getTime())) return null;
    return dt;
  } catch {
    return null;
  }
};

// GET /api/procedure-patients/:petId
router.get('/:petId', async (req, res) => {
  try {
    const petId = String(req.params.petId || '').trim();
    if (!petId) return res.status(400).json({ success: false, message: 'petId required' });

    const [pet, records, openRecv] = await Promise.all([
      Pet.findOne({ id: petId }).lean(),
      ProcedureRecord.find({ petId }).sort({ createdAt: -1 }).lean(),
      Receivable.find({ portal: 'reception', refType: 'reception_procedure', status: 'open', patientId: petId }).lean(),
    ]);

    const outstandingFromReceivables = (openRecv || []).reduce((s, r) => s + Number(r.balance || 0), 0);

    const totalPaid = (records || []).reduce((s, r) => s + Number(r.receivedAmount || 0), 0);
    const outstandingFromRecords = (records || []).reduce((s, r) => s + Number(r.receivable || 0), 0);
    const outstanding = Math.max(outstandingFromReceivables, outstandingFromRecords);

    const lastVisit = records?.[0]?.createdAt || null;

    const ongoing = (records || []).filter(r => Number(r.receivable || 0) > 0);
    const past = (records || []).filter(r => Number(r.receivable || 0) <= 0);
    const unpaidSessions = ongoing.length;

    const topDue = ongoing.reduce((best, r) => {
      if (!best) return r;
      return Number(r.receivable || 0) > Number(best.receivable || 0) ? r : best;
    }, null);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const appts = await Appointment.find({ petId, status: { $nin: ['Cancelled', 'No Show'] } })
      .sort({ date: 1, time: 1 })
      .lean();

    const nextAppointment = (appts || [])
      .map(a => ({ ...a, _dt: toDateTime(a.date, a.time) }))
      .filter(a => a._dt && a._dt >= today)
      .sort((a, b) => a._dt - b._dt)[0] || null;

    res.json({
      success: true,
      data: {
        pet: pet || {
          id: petId,
          petName: records?.[0]?.petName || '',
          ownerName: records?.[0]?.ownerName || '',
          ownerContact: records?.[0]?.contact || '',
          clientId: records?.[0]?.clientId || '',
        },
        summary: {
          totalPaid,
          outstanding,
          lastVisit,
          nextAppointment: nextAppointment
            ? { id: nextAppointment.id, date: nextAppointment.date, time: nextAppointment.time, status: nextAppointment.status, doctor: nextAppointment.doctor, type: nextAppointment.type }
            : null,
          unpaidSessions,
          topDue: topDue
            ? { recordId: String(topDue._id), name: topDue.procedures?.[0]?.drug || 'Procedure', due: Number(topDue.receivable || 0), date: topDue.createdAt }
            : null,
        },
        ongoing,
        past,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to load patient details' });
  }
});

export default router;
