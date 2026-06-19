import express from 'express';
import ProcedureRecord from '../models/ProcedureRecord.js';
import Voucher from '../models/Voucher.js';
import Sequence from '../models/Sequence.js';
import { postReceptionProcedure, postEntry } from '../utils/accountingService.js';
import dayGuard from '../middleware/dayGuard.js';
import Receivable from '../models/Receivable.js';
import DailyLog from '../models/DailyLog.js';
import ProcedurePlan from '../models/ProcedurePlan.js';
import ProcedureSession from '../models/ProcedureSession.js';

const router = express.Router();

const fmtSeq = (n) => String(n).padStart(6, '0');
const nextVoucherNo = async (type) => {
  const y = new Date().getFullYear();
  const key = `voucher:${type}:${y}`;
  const seqDoc = await Sequence.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `${type}-${y}-${fmtSeq(seqDoc.seq || 0)}`;
};

const nextProcedureInvoiceNo = async () => {
  const y = new Date().getFullYear();
  const key = `procedure-invoice:${y}`;
  const seqDoc = await Sequence.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `PROC-${y}-${fmtSeq(seqDoc.seq || 0)}`;
};

router.post('/', dayGuard('reception'), async (req, res) => {
  try {
    const payload = { ...req.body };
    if (!payload.invoiceNumber) {
      payload.invoiceNumber = await nextProcedureInvoiceNo();
    }
    const record = new ProcedureRecord(payload);
    await record.save();

    // Auto-create / append Procedure Plan + Session for Procedure Patient Details
    try {
      console.log('Attempting auto-session creation for Pet:', record.petId);
      const procedureName = String(record?.procedures?.[0]?.drug || 'Procedure').trim() || 'Procedure';
      const cleanPetId = String(record.petId || '').trim();
      
      if (!cleanPetId) {
        console.warn('Cannot auto-create session: petId is missing');
      } else {
        // Use a case-insensitive regex for the petId lookup to be safe
        const petIdRegex = new RegExp(`^${cleanPetId}$`, 'i');
        
        const plan = await ProcedurePlan.findOneAndUpdate(
          { petId: petIdRegex, procedureName, status: { $ne: 'completed' } },
          {
            $setOnInsert: {
              petId: cleanPetId, // Store the exact one from record
              clientId: String(record.clientId || '').trim(),
              petName: String(record.petName || '').trim(),
              ownerName: String(record.ownerName || '').trim(),
              contact: String(record.contact || '').trim(),
              procedureName,
              status: 'ongoing',
            },
            $set: {
              petName: String(record.petName || '').trim(),
              ownerName: String(record.ownerName || '').trim(),
              contact: String(record.contact || '').trim(),
              clientId: String(record.clientId || '').trim(),
            },
          },
          { new: true, upsert: true }
        );

        console.log('Plan found/created:', plan._id);

        const last = await ProcedureSession.findOne({ planId: plan._id }).sort({ sessionNo: -1 }).lean();
        const sessionNo = Math.max(1, Number(last?.sessionNo || 0) + 1);

        const totalAmount = Math.max(0, Number(record.grandTotal || 0));
        const paidAmount = Math.max(0, Number(record.receivedAmount || 0));
        const isFullyPaid = paidAmount >= totalAmount && totalAmount > 0;

        const newSession = await ProcedureSession.create({
          planId: plan._id,
          petId: cleanPetId,
          sessionNo,
          status: isFullyPaid ? 'completed' : 'planned',
          sourceRecordId: String(record._id),
          procedureItems: Array.isArray(record.procedures) ? record.procedures.map(p => ({
            mainCategory: p.mainCategory,
            subCategory: p.subCategory,
            drug: p.drug,
            quantity: Number(p.quantity || 0),
            unit: p.unit,
            amount: Number(p.amount || 0),
          })) : [],
          subtotal: Math.max(0, Number(record.subtotal || 0)),
          discount: Math.max(0, Number(record.discount || 0)),
          previousDues: Math.max(0, Number(record.previousDues || 0)),
          paymentMethod: String(record.paymentMethod || 'Cash'),
          totalAmount,
          paidAmount,
          payments: paidAmount > 0 ? [{ 
            amount: paidAmount, 
            method: String(record.paymentMethod || 'Cash'), 
            note: `Payment from Procedure Record #${record._id}`, 
            paidAt: record.createdAt || new Date() 
          }] : [],
        });
        console.log('Session auto-created successfully:', newSession._id);
      }
    } catch (e) {
      console.error('CRITICAL ERROR in auto-create procedure plan/session:', e);
    }

    // 1. Create Formal Voucher for visibility in Vouchers Page
    try {
      const subtotal = Number(record.subtotal || 0);
      const receivedAmount = Number(record.receivedAmount || 0);
      const cashPortion = Math.max(0, Math.min(receivedAmount, subtotal));
      const receivableCurrent = Math.max(0, subtotal - cashPortion);

      if (cashPortion > 0 || receivableCurrent > 0) {
        const vNo = await nextVoucherNo('RV');
        const pm = (record.paymentMethod || 'Cash').toLowerCase();
        const cashAcc = (pm.includes('bank') || pm.includes('card') || pm.includes('online')) ? '1002' : '1001';
        
        const lines = [];
        if (cashPortion > 0) lines.push({ accountCode: cashAcc, debit: cashPortion, credit: 0 });
        if (receivableCurrent > 0) lines.push({ accountCode: '1100', debit: receivableCurrent, credit: 0 });
        lines.push({ accountCode: '4003', debit: 0, credit: subtotal });

        const voucher = new Voucher({
          voucherNo: vNo,
          type: 'RV',
          status: 'posted',
          date: record.createdAt || new Date(),
          portal: 'reception',
          paymentMethod: record.paymentMethod || 'Cash',
          description: `Reception Procedures: ${record.petName}`,
          partyType: 'patient',
          partyId: record.petId,
          partyName: record.petName,
          lines: lines,
        });
        await voucher.save();

        // 2. Post to General Ledger via postEntry
        await postEntry({
          date: record.createdAt || new Date(),
          portal: 'reception',
          sourceType: 'reception_procedure',
          sourceId: vNo,
          description: `Reception Procedures: ${record.petName}`,
          lines,
          meta: { 
            patientId: record.petId,
            clientId: record.clientId,
            portalRef: String(record._id),
            extra: { voucherId: voucher._id }
          }
        });

        // 3. Log to DailyLog for Day Session Reconciliation
        if (cashPortion > 0) {
          try {
            await DailyLog.create({
              date: new Date().toISOString().slice(0,10),
              portal: 'reception',
              sessionId: req.daySession?._id,
              action: 'reception_income',
              refType: 'procedure_record',
              refId: String(record._id),
              description: `Income: Procedures for ${record.petName}`,
              amount: cashPortion
            });
          } catch (logErr) {
            console.error('DailyLog creation failed for reception income:', logErr);
          }
        }
      }
    } catch (e) {
      console.error('Failed to create formal receipt voucher for procedure:', e?.message || e);
    }

    // Create receivable if any
    try {
      const subtotal = Number(record.subtotal || 0);
      const receivedAmount = Number(record.receivedAmount || 0);
      const receivableCurrent = Math.max(0, subtotal - Math.max(0, Math.min(receivedAmount, subtotal)));
      if (receivableCurrent > 0) {
        await Receivable.create({
          portal: 'reception',
          customerId: record.clientId || undefined,
          patientId: record.petId || undefined,
          customerName: record.ownerName || undefined,
          refType: 'reception_procedure',
          refId: String(record._id),
          billDate: record.createdAt,
          description: `Reception procedures for ${record.petName}`,
          totalAmount: receivableCurrent,
          balance: receivableCurrent,
          status: 'open',
        });
      }
    } catch (e) {
      console.warn('Receivable create failed for ProcedureRecord', e?.message || e);
    }

    try {
      await DailyLog.create({
        date: new Date().toISOString().slice(0,10),
        portal: 'reception',
        sessionId: req.daySession?._id,
        action: 'reception_procedure',
        refType: 'procedure_record',
        refId: String(record._id),
        description: `Reception procedures for ${record.petName}`,
        amount: record.grandTotal || record.subtotal || 0,
      });
    } catch {}

    res.status(201).json({ success: true, data: record });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Bulk import: create simplified ProcedureRecord entries to reflect opening balances for imported pets
// This endpoint intentionally bypasses dayGuard to allow historical backfill from Excel
router.post('/import-openings', async (req, res) => {
  try {
    const { records } = req.body || {}
    if (!Array.isArray(records)) return res.status(400).json({ success:false, message:'records array required' })
    const created = []
    for (const r of records){
      const billed = Number(r.billed || 0)
      const received = Number(r.received || 0)
      const due = Math.max(0, Number(r.due != null ? r.due : (billed - received)))
      if (!(r.petName && r.ownerName && (billed>0 || received>0 || due>0))) continue
      const doc = new ProcedureRecord({
        petId: r.petId || '',
        clientId: r.clientId || '',
        petName: r.petName,
        ownerName: r.ownerName,
        contact: r.contact || '',
        procedures: [{ mainCategory:'Imported', subCategory:'Opening', drug: r.note || 'Opening Balance (Import)', quantity:1, unit:'entry', amount:billed }],
        subtotal: billed,
        previousDues: 0,
        grandTotal: billed,
        receivedAmount: received,
        receivable: due,
        notes: r.note || 'Imported from Excel',
        createdBy: 'Import'
      })
      await doc.save()
      created.push(doc._id)
    }
    res.status(201).json({ success:true, created: created.length })
  } catch (e) {
    res.status(500).json({ success:false, message: e?.message || 'Failed to import opening balances' })
  }
})

// Get all procedure records (optional filters by petId or clientId)
router.get('/', async (req, res) => {
  try {
    const { petId, clientId, includeImported } = req.query;
    const query = {};
    if (petId) query.petId = petId;
    if (clientId) query.clientId = clientId;

    // By default, hide Excel-imported opening balances from the Procedures list
    // These are NOT real procedures and should appear only in overall totals.
    const shouldExcludeImported = !(
      String(includeImported || '').toLowerCase() === '1' ||
      String(includeImported || '').toLowerCase() === 'true'
    );
    if (shouldExcludeImported) {
      query.$nor = [
        { createdBy: 'Import' },
        { notes: /import/i },
        { procedures: { $elemMatch: { mainCategory: 'Imported' } } },
        { procedures: { $elemMatch: { subCategory: 'Opening' } } },
      ];
    }

    const records = await ProcedureRecord.find(query).sort({ createdAt: -1 }).lean();

    // Fetch matching ProcedurePlans to determine status and aggregate totals
    const petIds = [...new Set(records.map(r => r.petId).filter(Boolean))];
    const [plans, allSessions] = await Promise.all([
      ProcedurePlan.find({ petId: { $in: petIds } }).lean(),
      ProcedureSession.find({ petId: { $in: petIds } }).lean()
    ]);

    const withStatus = records.map(r => {
      // Find the plan that matches this record's drug name (approximate) or just any active plan for this pet
      const firstDrug = r.procedures?.[0]?.drug || '';
      const plan = plans.find(p => 
        p.petId === r.petId && 
        (p.procedureName === firstDrug || p.status === 'ongoing')
      );

      let totalPaid = Number(r.receivedAmount || 0);
      let remainingDues = Number(r.receivable || 0);
      let status = 'completed';

      if (plan) {
        status = plan.status;
        // Aggregate totals from all sessions of this plan
        const planSessions = allSessions.filter(s => String(s.planId) === String(plan._id));
        const planTotal = planSessions.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
        const planPaid = planSessions.reduce((sum, s) => sum + Number(s.paidAmount || 0), 0);
        
        // If this record is linked to this plan, show aggregated status
        totalPaid = planPaid;
        remainingDues = Math.max(0, planTotal - planPaid);
      }

      return {
        ...r,
        receivedAmount: totalPaid,
        receivable: remainingDues,
        status: status
      };
    });

    res.json({ success: true, data: withStatus });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single record by id
router.get('/:id', async (req, res) => {
  try {
    const record = await ProcedureRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Procedure record not found' });
    }
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/payment', async (req, res) => {
  try {
    const record = await ProcedureRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Procedure record not found' });
    }

    const grandTotal = Math.max(0, Number(record.grandTotal ?? (Number(record.subtotal || 0) + Number(record.previousDues || 0))));
    const receivedAmount = Math.max(0, Number(req.body?.receivedAmount || 0));
    const nextReceived = Math.min(receivedAmount, grandTotal);
    const nextDue = Math.max(0, grandTotal - nextReceived);

    record.receivedAmount = nextReceived;
    record.receivable = nextDue;
    record.updatedAt = new Date();
    await record.save();

    try {
      const receivable = await Receivable.findOne({ refType: 'reception_procedure', refId: String(record._id) });
      if (receivable) {
        receivable.totalAmount = nextDue;
        receivable.balance = nextDue;
        receivable.status = nextDue > 0 ? 'open' : 'closed';
        await receivable.save();
      } else if (nextDue > 0) {
        await Receivable.create({
          portal: 'reception',
          customerId: record.clientId || undefined,
          patientId: record.petId || undefined,
          customerName: record.ownerName || undefined,
          refType: 'reception_procedure',
          refId: String(record._id),
          billDate: record.createdAt,
          description: `Reception procedures for ${record.petName}`,
          totalAmount: nextDue,
          balance: nextDue,
          status: 'open',
        });
      }
    } catch (e) {
      console.warn('Receivable update failed for ProcedureRecord payment update', e?.message || e);
    }

    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update a procedure record
router.put('/:id', dayGuard('reception'), async (req, res) => {
  try {
    const record = await ProcedureRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Procedure record not found' });
    }

    // Update fields
    const updates = req.body;
    Object.keys(updates).forEach(key => {
      if (key !== '_id' && key !== 'createdAt') {
        record[key] = updates[key];
      }
    });
    record.updatedAt = new Date();
    await record.save();

    // Update related receivable if exists
    try {
      const receivable = await Receivable.findOne({ refType: 'reception_procedure', refId: String(record._id) });
      if (receivable) {
        const newBalance = Math.max(0, Number(record.receivable || 0));
        receivable.totalAmount = newBalance;
        receivable.balance = newBalance;
        receivable.status = newBalance > 0 ? 'open' : 'closed';
        await receivable.save();
      } else if (Number(record.receivable || 0) > 0) {
        // Create receivable if not exists but should exist
        await Receivable.create({
          portal: 'reception',
          customerId: record.clientId || undefined,
          patientId: record.petId || undefined,
          customerName: record.ownerName || undefined,
          refType: 'reception_procedure',
          refId: String(record._id),
          billDate: record.createdAt,
          description: `Reception procedures for ${record.petName}`,
          totalAmount: Number(record.receivable || 0),
          balance: Number(record.receivable || 0),
          status: 'open',
        });
      }
    } catch (e) {
      console.warn('Receivable update failed for ProcedureRecord', e?.message || e);
    }

    // Log the update
    try {
      await DailyLog.create({
        date: new Date().toISOString().slice(0,10),
        portal: 'reception',
        sessionId: req.daySession?._id,
        action: 'reception_procedure_update',
        refType: 'procedure_record',
        refId: String(record._id),
        description: `Updated reception procedures for ${record.petName}`,
        amount: record.grandTotal || record.subtotal || 0,
      });
    } catch {}

    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete a procedure record
router.delete('/:id', dayGuard('reception'), async (req, res) => {
  try {
    const record = await ProcedureRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Procedure record not found' });
    }

    const recordInfo = { petName: record.petName, amount: record.grandTotal || record.subtotal || 0 };

    // Delete related receivable if exists
    try {
      await Receivable.deleteOne({ refType: 'reception_procedure', refId: String(record._id) });
    } catch (e) {
      console.warn('Receivable delete failed for ProcedureRecord', e?.message || e);
    }

    await ProcedureRecord.deleteOne({ _id: req.params.id });

    // Log the deletion
    try {
      await DailyLog.create({
        date: new Date().toISOString().slice(0,10),
        portal: 'reception',
        sessionId: req.daySession?._id,
        action: 'reception_procedure_delete',
        refType: 'procedure_record',
        refId: String(record._id),
        description: `Deleted reception procedures for ${recordInfo.petName}`,
        amount: recordInfo.amount,
      });
    } catch {}

    res.json({ success: true, message: 'Procedure record deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
