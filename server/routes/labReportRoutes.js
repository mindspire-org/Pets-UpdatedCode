import express from 'express';
import LabReport from '../models/LabReport.js';
import LabTest from '../models/LabTest.js';
import Inventory from '../models/Inventory.js';
import Receivable from '../models/Receivable.js';
import { postLabReport } from '../utils/accountingService.js';
import dayGuard from '../middleware/dayGuard.js';
import DailyLog from '../models/DailyLog.js';

const router = express.Router();

const normalizeConsumables = (list = []) => {
  if (!Array.isArray(list)) return [];
  return list
    .map(x => ({
      inventoryId: String(x?.inventoryId || '').trim(),
      itemName: String(x?.itemName || x?.name || '').trim(),
      quantity: Number(x?.quantity || 0)
    }))
    .filter(x => (x.inventoryId || x.itemName) && Number.isFinite(x.quantity) && x.quantity > 0);
};

const computeInventoryStatus = (item, nextQty) => {
  const min = Number(item?.minStockLevel || 0);
  if (nextQty <= 0) return 'Out of Stock';
  if (Number.isFinite(min) && nextQty <= min) return 'Low Stock';
  return 'In Stock';
};

const resolveConsumables = async (reportBody) => {
  const fromBody = normalizeConsumables(reportBody?.inventoryUsed);
  if (fromBody.length > 0) return fromBody;

  const testType = String(reportBody?.testType || '').trim();
  if (!testType) return [];
  const t = await LabTest.findOne({ testName: testType });
  return normalizeConsumables(t?.consumables);
};

const consumeInventory = async (consumables) => {
  const consumed = [];
  try {
    for (const c of consumables) {
      let inv = null;
      if (c.inventoryId) {
        inv = await Inventory.findOne({ id: c.inventoryId, department: 'lab' });
      }
      if (!inv && c.itemName) {
        inv = await Inventory.findOne({ department: 'lab', itemName: new RegExp(`^${c.itemName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
      }
      if (!inv) {
        throw new Error(`Missing inventory item: ${c.itemName || c.inventoryId}`);
      }
      if (Number(inv.quantity || 0) < c.quantity) {
        throw new Error(`Insufficient inventory: ${inv.itemName} (Available: ${inv.quantity}, Required: ${c.quantity})`);
      }

      const updated = await Inventory.findOneAndUpdate(
        { id: inv.id, department: 'lab', quantity: { $gte: c.quantity } },
        { $inc: { quantity: -c.quantity } },
        { new: true }
      );

      if (!updated) {
        throw new Error(`Insufficient inventory: ${inv.itemName}`);
      }

      const nextStatus = computeInventoryStatus(updated, Number(updated.quantity || 0));
      if (nextStatus !== updated.status) {
        await Inventory.updateOne({ id: updated.id }, { $set: { status: nextStatus } });
      }

      consumed.push({ inventoryId: updated.id, itemName: updated.itemName, quantity: c.quantity });
    }
    return consumed;
  } catch (e) {
    for (const c of consumed) {
      try {
        const rolled = await Inventory.findOneAndUpdate(
          { id: c.inventoryId, department: 'lab' },
          { $inc: { quantity: c.quantity } },
          { new: true }
        );
        if (rolled) {
          const nextStatus = computeInventoryStatus(rolled, Number(rolled.quantity || 0));
          if (nextStatus !== rolled.status) {
            await Inventory.updateOne({ id: rolled.id }, { $set: { status: nextStatus } });
          }
        }
      } catch {}
    }
    throw e;
  }
};

router.get('/', async (req, res) => {
  try {
    const reports = await LabReport.find().sort({ reportDate: -1 });
    res.json({ success: true, data: reports });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.get('/:id', async (req, res) => {
  try {
    const report = await LabReport.findOne({ id: req.params.id });
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.post('/', dayGuard('lab'), async (req, res) => {
  try {
    const consumables = await resolveConsumables(req.body);
    const used = consumables.length > 0 ? await consumeInventory(consumables) : [];
    const baseAmount = Math.max(0, Number(req.body?.amount || 0));
    const paymentCharge = Math.max(0, Number(req.body?.paymentCharge || 0));
    const totalAmount = Math.max(0, baseAmount + paymentCharge);
    const receivedAmount = Math.max(0, Number(req.body?.receivedAmount || 0));
    const dueAmount = Math.max(0, totalAmount - Math.min(receivedAmount, totalAmount));
    const paymentStatus = dueAmount > 0 ? 'Pending' : (req.body?.paymentStatus || 'Paid');
    const paymentMethod = String(req.body?.paymentMethod || req.body?.paymentDetails?.method || 'Cash').trim() || 'Cash';
    const paymentDetails = req.body?.paymentDetails && typeof req.body.paymentDetails === 'object'
      ? { ...req.body.paymentDetails, method: req.body.paymentDetails.method || paymentMethod }
      : { method: paymentMethod };

    const body = {
      ...req.body,
      amount: baseAmount,
      paymentCharge,
      receivedAmount,
      dueAmount,
      paymentStatus,
      paymentMethod,
      paymentDetails,
      inventoryUsed: used,
    };

    const report = new LabReport(body);
    try {
      await report.save();
    } catch (e) {
      if (used.length > 0) {
        try {
          for (const u of used) {
            const rolled = await Inventory.findOneAndUpdate(
              { id: u.inventoryId, department: 'lab' },
              { $inc: { quantity: u.quantity } },
              { new: true }
            );
            if (rolled) {
              const nextStatus = computeInventoryStatus(rolled, Number(rolled.quantity || 0));
              if (nextStatus !== rolled.status) {
                await Inventory.updateOne({ id: rolled.id }, { $set: { status: nextStatus } });
              }
            }
          }
        } catch {}
      }
      throw e;
    }

    try {
      await postLabReport(report.toObject());
    } catch (e) {
      console.error('Accounting posting failed for LabReport', e && e.message ? e.message : e);
    }

    try {
      if (dueAmount > 0) {
        await Receivable.create({
          portal: 'lab',
          customerId: body.petId || undefined,
          patientId: body.petId || undefined,
          customerName: body.ownerName || undefined,
          refType: 'lab_report',
          refId: String(report.id || report._id),
          billDate: report.reportDate || report.createdAt || new Date(),
          description: `Lab report ${report.reportNumber}`,
          totalAmount: dueAmount,
          balance: dueAmount,
          status: 'open',
          allocations: [],
        });
      }
    } catch (e) {
      console.warn('Receivable create failed for LabReport', e?.message || e);
    }

    try {
      await DailyLog.create({
        date: new Date().toISOString().slice(0,10),
        portal: 'lab',
        sessionId: req.daySession?._id,
        action: 'lab_report_create',
        refType: 'lab_report',
        refId: report.id || String(report._id),
        description: `Lab report ${report.reportNumber}`,
        amount: report.amount || 0,
      });
    } catch {}

    res.status(201).json({ success: true, data: report });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/:id/recover', dayGuard('lab'), async (req, res) => {
  try {
    const { id } = req.params;
    const amount = Math.max(0, Number(req.body?.amount || 0));
    const paymentMethod = String(req.body?.paymentMethod || '').trim() || 'Cash';
    const paymentDetails = req.body?.paymentDetails && typeof req.body.paymentDetails === 'object'
      ? req.body.paymentDetails
      : {};
    if (!amount) return res.status(400).json({ success: false, message: 'amount is required' });

    const report = await LabReport.findOne({ id });
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });

    const base = Math.max(0, Number(report.amount || 0));
    const charge = Math.max(0, Number(report.paymentCharge || 0));
    const total = Math.max(0, base + charge);
    const received = Math.max(0, Number(report.receivedAmount || 0));
    const currentDue = Math.max(0, total - Math.min(received, total));
    const applied = Math.min(currentDue, amount);
    if (!applied) return res.status(400).json({ success: false, message: 'Nothing to recover' });

    const nextReceived = Math.max(0, received + applied);
    const nextDue = Math.max(0, total - Math.min(nextReceived, total));
    report.receivedAmount = nextReceived;
    report.dueAmount = nextDue;
    report.paymentStatus = nextDue > 0 ? 'Pending' : 'Paid';
    report.recoveryPayments = Array.isArray(report.recoveryPayments) ? report.recoveryPayments : [];
    report.recoveryPayments.push({
      amount: applied,
      paymentMethod,
      paymentDetails: { ...paymentDetails, method: paymentDetails?.method || paymentMethod },
      recoveredAt: new Date(),
    });
    await report.save();

    try {
      const receivable = await Receivable.findOne({
        portal: 'lab',
        refType: 'lab_report',
        refId: String(report.id || report._id),
        status: 'open',
      });
      if (receivable) {
        const bal = Math.max(0, Number(receivable.balance || 0));
        const nextBal = Math.max(0, bal - applied);
        receivable.balance = nextBal;
        receivable.status = nextBal > 0 ? 'open' : 'closed';
        receivable.allocations = Array.isArray(receivable.allocations) ? receivable.allocations : [];
        receivable.allocations.push({ paymentId: `lab_report_recover_${Date.now()}`, amount: applied, date: new Date() });
        await receivable.save();
      }
    } catch (e) {
      console.warn('Receivable update failed for LabReport recover', e?.message || e);
    }

    try {
      await DailyLog.create({
        date: new Date().toISOString().slice(0,10),
        portal: 'lab',
        sessionId: req.daySession?._id,
        action: 'lab_report_recover',
        refType: 'lab_report',
        refId: report.id || String(report._id),
        description: `Recovery for ${report.reportNumber}`,
        amount: applied,
      });
    } catch {}

    res.json({ success: true, data: report, recovered: applied });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.put('/:id', async (req, res) => {
  try {
    const report = await LabReport.findOneAndUpdate({ id: req.params.id }, req.body, { new: true, runValidators: true });
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});
router.delete('/:id', async (req, res) => {
  try {
    const report = await LabReport.findOneAndDelete({ id: req.params.id });
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, message: 'Report deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
export default router;
