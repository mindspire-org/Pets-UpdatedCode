import express from 'express';
import ShotReminder from '../models/ShotReminder.js';
import Prescription from '../models/Prescription.js';
import Pet from '../models/Pet.js';

const router = express.Router();

// Helper to extract reminders from a prescription and save to DB
const syncRemindersFromPrescription = async (prx) => {
  const items = Array.isArray(prx.items) ? prx.items : [];
  const vaccineItems = items.filter(x => x.isVaccine);
  
  const pet = await Pet.findOne({ id: prx.patient?.id });
  // Deep search for phone number
  const ownerPhone = pet?.ownerPhone || 
                    pet?.phone || 
                    pet?.details?.owner?.phone || 
                    pet?.details?.owner?.contact || 
                    pet?.details?.owner?.mobile || 
                    prx.patient?.phone || 
                    '';

  for (const [vIdx, v] of vaccineItems.entries()) {
    const shots = Array.isArray(v.shots) ? v.shots : [];
    const totalShotsCount = shots.length;

    for (const [sIdx, s] of shots.entries()) {
      const dueDateStr = s.dateGiven || s.date || s.when;
      if (!dueDateStr) continue;
      
      const dueDate = new Date(dueDateStr);
      if (isNaN(dueDate.getTime())) continue;

      const reminderId = `prx:${prx.id}:vac:${v.name}:shot:${sIdx}`;
      
      // Calculate summary for this specific vaccine in this prescription
      const summary = {
        total: totalShotsCount,
        pending: shots.filter(sh => (sh.status || 'Pending') === 'Pending').length,
        completed: shots.filter(sh => sh.status === 'Completed').length,
        cancelled: shots.filter(sh => sh.status === 'Cancelled').length
      };

      await ShotReminder.findOneAndUpdate(
        { id: reminderId },
        {
          id: reminderId,
          prescriptionId: prx.id,
          patientId: prx.patient?.id,
          petName: prx.patient?.petName,
          ownerName: prx.patient?.ownerName,
          ownerPhone,
          doctorName: prx.doctor?.name || prx.doctor?.username,
          vaccineName: v.name,
          shotStage: s.shotStage || `Shot ${sIdx + 1}`,
          dueDate,
          status: s.status || 'Pending',
          instructions: v.instructions,
          shotIndex: sIdx,
          vaccineIndex: vIdx,
          vaccineSummary: summary // Store the deep summary
        },
        { upsert: true, new: true }
      );
    }
  }
};

// Sync all prescriptions (initial setup)
router.post('/sync', async (req, res) => {
  try {
    const prescriptions = await Prescription.find();
    for (const prx of prescriptions) {
      await syncRemindersFromPrescription(prx);
    }
    res.json({ success: true, message: 'Reminders synced successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all reminders with filters
router.get('/', async (req, res) => {
  try {
    const { status, petId, search } = req.query;
    let query = {};
    
    if (status && status !== 'All') {
      query.status = status;
    }
    
    if (petId) {
      query.patientId = petId;
    }

    if (search) {
      const s = String(search).toLowerCase();
      query.$or = [
        { petName: { $regex: s, $options: 'i' } },
        { ownerName: { $regex: s, $options: 'i' } },
        { ownerPhone: { $regex: s, $options: 'i' } },
        { vaccineName: { $regex: s, $options: 'i' } },
        { patientId: { $regex: s, $options: 'i' } }
      ];
    }

    const reminders = await ShotReminder.find(query).sort({ dueDate: 1 });
    res.json({ success: true, data: reminders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update status
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    let reminder = await ShotReminder.findOne({ id: req.params.id });
    
    if (!reminder) {
      return res.status(404).json({ success: false, message: 'Reminder not found' });
    }

    // Also update the status in the Prescription model to keep them in sync
    const prx = await Prescription.findOne({ id: reminder.prescriptionId });
    if (prx) {
      const items = Array.isArray(prx.items) ? prx.items : [];
      let updated = false;
      items.forEach(item => {
        if (item.isVaccine && item.name === reminder.vaccineName) {
          if (Array.isArray(item.shots) && item.shots[reminder.shotIndex]) {
            item.shots[reminder.shotIndex].status = status;
            updated = true;
          }
        }
      });
      if (updated) {
        await Prescription.findOneAndUpdate({ id: prx.id }, { items });
        
        // Now re-sync all reminders for this prescription to update vaccineSummary
        await syncRemindersFromPrescription(prx);
      }
    }

    // Fetch the updated reminder
    reminder = await ShotReminder.findOne({ id: req.params.id });

    res.json({ success: true, data: reminder });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get upcoming reminders (for topbar)
router.get('/upcoming', async (req, res) => {
  try {
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + 2);
    
    const count = await ShotReminder.countDocuments({
      status: 'Pending',
      dueDate: { $gte: now, $lte: future }
    });
    
    const next = await ShotReminder.findOne({
      status: 'Pending',
      dueDate: { $gte: now, $lte: future }
    }).sort({ dueDate: 1 });

    res.json({ 
      success: true, 
      count, 
      nextDueDate: next?.dueDate || null 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
