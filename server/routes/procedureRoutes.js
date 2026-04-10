import express from 'express';
import ProcedureRecord from '../models/ProcedureRecord.js';
import { postReceptionProcedure } from '../utils/accountingService.js';
import dayGuard from '../middleware/dayGuard.js';
import Receivable from '../models/Receivable.js';
import DailyLog from '../models/DailyLog.js';

const router = express.Router();

router.post('/', dayGuard('reception'), async (req, res) => {
  try {
    const record = new ProcedureRecord(req.body);
    await record.save();

    try {
      await postReceptionProcedure(record.toObject());
    } catch (e) {
      console.error('Accounting posting failed for ProcedureRecord', e && e.message ? e.message : e);
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

    const records = await ProcedureRecord.find(query).sort({ createdAt: -1 });
    res.json({ success: true, data: records });
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
