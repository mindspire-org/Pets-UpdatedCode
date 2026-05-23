import express from 'express';
import Pet from '../models/Pet.js';
import Appointment from '../models/Appointment.js';
import ProcedurePlan from '../models/ProcedurePlan.js';
import ProcedureSession from '../models/ProcedureSession.js';
import ProcedureRecord from '../models/ProcedureRecord.js';

const router = express.Router();

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

const buildPatientPayload = async (petId) => {
  const cleanPetId = String(petId || '').trim();
  const esc = cleanPetId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const petIdRegex = new RegExp(`^${esc}$`, 'i');

  let [pet, plans, sessions, appts] = await Promise.all([
    Pet.findOne({ id: petIdRegex }).lean(),
    ProcedurePlan.find({ petId: petIdRegex }).sort({ createdAt: -1 }).lean(),
    ProcedureSession.find({ petId: petIdRegex }).sort({ createdAt: -1 }).lean(),
    Appointment.find({ petId: petIdRegex, status: { $nin: ['Cancelled', 'No Show'] } }).sort({ date: 1, time: 1 }).lean(),
  ]);

  // Safety net: if a ProcedureRecord exists but sessions were never created (older data / failed hook),
  // auto-migrate the latest ProcedureRecord into a ProcedurePlan + Session-1.
  if ((plans || []).length === 0 && (sessions || []).length === 0) {
    const latestRecord = await ProcedureRecord.findOne({ petId: petIdRegex }).sort({ createdAt: -1 }).lean();
    if (latestRecord) {
      const procedureName = String(latestRecord?.procedures?.[0]?.drug || 'Procedure').trim() || 'Procedure';
      const totalAmount = Math.max(0, Number(latestRecord.grandTotal || 0));
      const paidAmount = Math.max(0, Number(latestRecord.receivedAmount || 0));
      const isFullyPaid = paidAmount >= totalAmount && totalAmount > 0;

      const createdPlan = await ProcedurePlan.create({
        petId: cleanPetId || String(latestRecord.petId || '').trim(),
        clientId: String(latestRecord.clientId || '').trim(),
        petName: String(latestRecord.petName || '').trim(),
        ownerName: String(latestRecord.ownerName || '').trim(),
        contact: String(latestRecord.contact || '').trim(),
        procedureName,
        status: 'ongoing',
      });

      await ProcedureSession.create({
        planId: createdPlan._id,
        petId: createdPlan.petId,
        sessionNo: 1,
        status: isFullyPaid ? 'completed' : 'planned',
        sourceRecordId: String(latestRecord._id),
        procedureItems: Array.isArray(latestRecord.procedures)
          ? latestRecord.procedures.map(p => ({
            mainCategory: p.mainCategory,
            subCategory: p.subCategory,
            drug: p.drug,
            quantity: Number(p.quantity || 0),
            unit: p.unit,
            amount: Number(p.amount || 0),
          }))
          : [],
        subtotal: Math.max(0, Number(latestRecord.subtotal || 0)),
        discount: Math.max(0, Number(latestRecord.discount || 0)),
        previousDues: Math.max(0, Number(latestRecord.previousDues || 0)),
        paymentMethod: String(latestRecord.paymentMethod || 'Cash'),
        totalAmount,
        paidAmount,
        payments: paidAmount > 0
          ? [{ amount: paidAmount, method: String(latestRecord.paymentMethod || 'Cash'), note: 'Imported from Procedures', paidAt: latestRecord.createdAt || new Date() }]
          : [],
      });

      [pet, plans, sessions] = await Promise.all([
        Pet.findOne({ id: petIdRegex }).lean(),
        ProcedurePlan.find({ petId: petIdRegex }).sort({ createdAt: -1 }).lean(),
        ProcedureSession.find({ petId: petIdRegex }).sort({ createdAt: -1 }).lean(),
      ]);
    }
  }

  const planIds = (plans || []).map(p => String(p._id));
  const sessionsByPlan = (sessions || []).reduce((acc, s) => {
    const pid = String(s.planId);
    if (!acc[pid]) acc[pid] = [];
    acc[pid].push(s);
    return acc;
  }, {});

  for (const pid of planIds) {
    (sessionsByPlan[pid] || []).sort((a, b) => Number(a.sessionNo || 0) - Number(b.sessionNo || 0));
  }

  const totalPaid = (sessions || []).reduce((sum, s) => sum + Number(s.paidAmount || 0), 0);
  const outstanding = (sessions || []).reduce((sum, s) => sum + Math.max(0, Number(s.totalAmount || 0) - Number(s.paidAmount || 0)), 0);

  const lastVisit = (sessions || [])
    .filter(s => String(s.status || '') === 'completed')
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))[0]?.updatedAt || null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const nextAppointment = (appts || [])
    .map(a => ({ ...a, _dt: toDateTime(a.date, a.time) }))
    .filter(a => a._dt && a._dt >= today)
    .sort((a, b) => a._dt - b._dt)[0] || null;

  const apptsBySession = (appts || []).reduce((acc, a) => {
    const sid = String(a?.procedureSessionId || '').trim();
    if (!sid) return acc;
    if (!acc[sid]) acc[sid] = [];
    acc[sid].push(a);
    return acc;
  }, {});

  const unpaidSessions = (sessions || []).filter(s => Math.max(0, Number(s.totalAmount || 0) - Number(s.paidAmount || 0)) > 0).length;

  const topDueSessions = (sessions || [])
    .map(s => ({
      sessionId: String(s._id),
      planId: String(s.planId),
      sessionNo: Number(s.sessionNo || 0),
      due: Math.max(0, Number(s.totalAmount || 0) - Number(s.paidAmount || 0)),
      createdAt: s.createdAt,
    }))
    .filter(x => x.due > 0)
    .sort((a, b) => b.due - a.due)
    .slice(0, 5);

  const plansWithSessions = (plans || []).map(p => ({
    ...p,
    sessions: (sessionsByPlan[String(p._id)] || []).map((s) => {
      const sid = String(s?._id || '');
      const next = (apptsBySession[sid] || [])
        .map(a => ({ ...a, _dt: toDateTime(a.date, a.time) }))
        .filter(a => a._dt && a._dt >= today)
        .sort((a, b) => a._dt - b._dt)[0] || null;
      return {
        ...s,
        nextAppointment: next
          ? { id: next.id, date: next.date, time: next.time, status: next.status, doctor: next.doctor, type: next.type }
          : null,
      };
    }),
  }));

  return {
    pet: pet || { id: petId },
    summary: {
      totalPaid,
      outstanding,
      lastVisit,
      nextAppointment: nextAppointment
        ? { id: nextAppointment.id, date: nextAppointment.date, time: nextAppointment.time, status: nextAppointment.status, doctor: nextAppointment.doctor, type: nextAppointment.type }
        : null,
      unpaidSessions,
      topDueSessions,
    },
    plans: plansWithSessions,
    appointments: appts || [],
  };
};

// GET /api/procedure-plans/patient/:petId
router.get('/patient/:petId', async (req, res) => {
  try {
    const petId = String(req.params.petId || '').trim();
    if (!petId) return res.status(400).json({ success: false, message: 'petId required' });
    const data = await buildPatientPayload(petId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to load patient procedures' });
  }
});

// POST /api/procedure-plans/patient/:petId
router.post('/patient/:petId', async (req, res) => {
  try {
    const petId = String(req.params.petId || '').trim();
    if (!petId) return res.status(400).json({ success: false, message: 'petId required' });

    const procedureName = String(req.body?.procedureName || '').trim();
    if (!procedureName) return res.status(400).json({ success: false, message: 'procedureName required' });

    const totalAmount = Math.max(0, Number(req.body?.totalAmount || 0));
    const scheduledAt = req.body?.scheduledAt ? new Date(req.body.scheduledAt) : undefined;

    const pet = await Pet.findOne({ id: petId }).lean();

    const plan = await ProcedurePlan.create({
      petId,
      clientId: pet?.clientId || '',
      petName: pet?.petName || '',
      ownerName: pet?.ownerName || '',
      contact: pet?.ownerContact || '',
      procedureName,
      status: 'ongoing',
    });

    const session = await ProcedureSession.create({
      planId: plan._id,
      petId,
      sessionNo: 1,
      status: 'planned',
      scheduledAt: scheduledAt && Number.isFinite(scheduledAt.getTime()) ? scheduledAt : undefined,
      totalAmount,
      paidAmount: 0,
      payments: [],
    });

    res.json({ success: true, data: { plan, session } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to create procedure plan' });
  }
});

// POST /api/procedure-plans/:planId/sessions
router.post('/:planId/sessions', async (req, res) => {
  try {
    const planId = String(req.params.planId || '').trim();
    if (!planId) return res.status(400).json({ success: false, message: 'planId required' });

    const plan = await ProcedurePlan.findById(planId).lean();
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });

    const totalAmount = Math.max(0, Number(req.body?.totalAmount || 0));
    const scheduledAt = req.body?.scheduledAt ? new Date(req.body.scheduledAt) : undefined;

    const last = await ProcedureSession.findOne({ planId }).sort({ sessionNo: -1 }).lean();
    const sessionNo = Math.max(1, Number(last?.sessionNo || 0) + 1);

    const session = await ProcedureSession.create({
      planId,
      petId: plan.petId,
      sessionNo,
      status: 'planned',
      scheduledAt: scheduledAt && Number.isFinite(scheduledAt.getTime()) ? scheduledAt : undefined,
      totalAmount,
      paidAmount: 0,
      payments: [],
    });

    res.json({ success: true, data: session });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to add session' });
  }
});

// PUT /api/procedure-plans/sessions/:sessionId
router.put('/sessions/:sessionId', async (req, res) => {
  try {
    const sessionId = String(req.params.sessionId || '').trim();
    if (!sessionId) return res.status(400).json({ success: false, message: 'sessionId required' });

    const patch = {};
    if (req.body?.scheduledAt != null) {
      const dt = new Date(req.body.scheduledAt);
      patch.scheduledAt = Number.isFinite(dt.getTime()) ? dt : undefined;
    }
    if (req.body?.totalAmount != null) patch.totalAmount = Math.max(0, Number(req.body.totalAmount || 0));

    const updated = await ProcedureSession.findByIdAndUpdate(sessionId, patch, { new: true }).lean();
    if (!updated) return res.status(404).json({ success: false, message: 'Session not found' });

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to update session' });
  }
});

// PUT /api/procedure-plans/sessions/:sessionId/pay
router.put('/sessions/:sessionId/pay', async (req, res) => {
  try {
    const sessionId = String(req.params.sessionId || '').trim();
    if (!sessionId) return res.status(400).json({ success: false, message: 'sessionId required' });

    const amount = Math.max(0, Number(req.body?.amount || 0));
    if (!amount) return res.status(400).json({ success: false, message: 'amount required' });

    const method = String(req.body?.method || 'Cash').trim() || 'Cash';
    const note = String(req.body?.note || '').trim();

    const session = await ProcedureSession.findById(sessionId);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    const planId = String(session.planId || '').trim();
    const allSessions = await ProcedureSession.find({ planId }).lean();

    const planTotal = (allSessions || []).reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
    const planPaid = (allSessions || []).reduce((sum, s) => sum + Number(s.paidAmount || 0), 0);
    const planDue = Math.max(0, planTotal - planPaid);
    const applied = Math.min(planDue, amount);

    if (!applied) return res.status(400).json({ success: false, message: 'No outstanding balance' });

    session.paidAmount = Number(session.paidAmount || 0) + applied;
    session.payments = [...(session.payments || []), { amount: applied, method, note, paidAt: new Date() }];
    await session.save();

    res.json({ success: true, data: session.toObject({ virtuals: true }) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to pay' });
  }
});

// PUT /api/procedure-plans/sessions/:sessionId/complete
router.put('/sessions/:sessionId/complete', async (req, res) => {
  try {
    const sessionId = String(req.params.sessionId || '').trim();
    if (!sessionId) return res.status(400).json({ success: false, message: 'sessionId required' });

    const session = await ProcedureSession.findById(sessionId);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    session.status = 'completed';
    await session.save();

    res.json({ success: true, data: session.toObject({ virtuals: true }) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to complete session' });
  }
});

// PUT /api/procedure-plans/:planId/complete
router.put('/:planId/complete', async (req, res) => {
  try {
    const planId = String(req.params.planId || '').trim();
    if (!planId) return res.status(400).json({ success: false, message: 'planId required' });

    const plan = await ProcedurePlan.findById(planId);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });

    plan.status = 'completed';
    await plan.save();

    res.json({ success: true, data: plan.toObject() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to complete procedure' });
  }
});

// PUT /api/procedure-plans/sessions/:sessionId/photos
router.put('/sessions/:sessionId/photos', async (req, res) => {
  try {
    const sessionId = String(req.params.sessionId || '').trim();
    if (!sessionId) return res.status(400).json({ success: false, message: 'sessionId required' });

    const type = String(req.body?.type || '').trim();
    const data = String(req.body?.data || '').trim();
    const contentType = String(req.body?.contentType || '').trim();

    if (!['before', 'after'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid type' });
    }
    if (!data) return res.status(400).json({ success: false, message: 'data required' });

    const session = await ProcedureSession.findById(sessionId);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    const patch = {
      data,
      contentType: contentType || 'image/jpeg',
      uploadedAt: new Date(),
    };

    session.photos = session.photos || {};
    session.photos[type] = patch;
    await session.save();

    res.json({ success: true, data: session.toObject({ virtuals: true }) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to upload photo' });
  }
});

// DELETE /api/procedure-plans/sessions/:sessionId/photos/:type
router.delete('/sessions/:sessionId/photos/:type', async (req, res) => {
  try {
    const sessionId = String(req.params.sessionId || '').trim();
    const type = String(req.params.type || '').trim();
    if (!sessionId) return res.status(400).json({ success: false, message: 'sessionId required' });
    if (!['before', 'after'].includes(type)) return res.status(400).json({ success: false, message: 'Invalid type' });

    const session = await ProcedureSession.findById(sessionId);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    session.photos = session.photos || {};
    session.photos[type] = undefined;
    await session.save();

    res.json({ success: true, data: session.toObject({ virtuals: true }) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to delete photo' });
  }
});

export default router;
