import express from 'express';
import Pet from '../models/Pet.js';
import Voucher from '../models/Voucher.js';
import Sequence from '../models/Sequence.js';
import { postEntry } from '../utils/accountingService.js';
import dayGuard from '../middleware/dayGuard.js';
import Receivable from '../models/Receivable.js';
import DailyLog from '../models/DailyLog.js';

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

// Get all pets
router.get('/', async (req, res) => {
  try {
    const pets = await Pet.find().sort({ createdAt: -1 });
    res.json({ success: true, data: pets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Search pets (place BEFORE '/:id' to avoid conflicts)
router.get('/search/:query', async (req, res) => {
  try {
    const query = req.params.query;
    const pets = await Pet.find({
      $or: [
        { petName: { $regex: query, $options: 'i' } },
        { ownerName: { $regex: query, $options: 'i' } },
        { id: { $regex: query, $options: 'i' } },
        { clientId: { $regex: query, $options: 'i' } },
        { 'details.pet.petId': { $regex: query, $options: 'i' } },
        { 'details.owner.ownerId': { $regex: query, $options: 'i' } }
      ]
    });
    res.json({ success: true, data: pets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get pet by ID or clientId
router.get('/:id', async (req, res) => {
  try {
    let pet = await Pet.findOne({ id: req.params.id });
    if (!pet) {
      pet = await Pet.findOne({ clientId: req.params.id });
    }
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Pet not found' });
    }
    res.json({ success: true, data: pet });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create new pet
router.post('/', dayGuard('reception'), async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.age && !body.dateOfBirth && !body.ageRecordedAt) {
      body.ageRecordedAt = new Date();
    }
    if (!body.clientId) {
      body.clientId = `CL-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random()*1e6).toString(36).toUpperCase()}`;
    }
    // Normalize and auto-handle death fields
    try {
      if (typeof body.status === 'string' && body.status.toLowerCase() === 'deceased') {
        body.status = 'Expired';
      }
      const lifeDead = !!(body.details && body.details.life && body.details.life.dead);
      if (body.dateOfDeath || lifeDead || (typeof body.status === 'string' && body.status.toLowerCase() === 'expired')) {
        body.status = 'Expired';
        if (body.dateOfDeath) {
          body.dateOfDeath = new Date(body.dateOfDeath);
        } else if (lifeDead && !body.dateOfDeath) {
          body.dateOfDeath = new Date();
        }
      }
    } catch {}
    
    const pet = new Pet(body);
    if (pet.details) {
      pet.markModified('details');
    }
    await pet.save();

    // Create financial transactions if consultant fees are provided
    try {
      const consultantFees = Number(body.details?.clinic?.consultantFees || 0);
      if (consultantFees > 0) {
        // Determine payment method and received amount (default to full payment if not specified)
        const paymentMethod = body.details?.clinic?.paymentMethod || 'Cash';
        const receivedAmount = Number(body.details?.clinic?.receivedAmount || consultantFees);
        
        const cashPortion = Math.max(0, Math.min(receivedAmount, consultantFees));
        const receivableCurrent = Math.max(0, consultantFees - cashPortion);

        if (cashPortion > 0 || receivableCurrent > 0) {
          // 1. Create Formal Voucher for visibility in Vouchers Page
          const vNo = await nextVoucherNo('RV');
          const pm = paymentMethod.toLowerCase();
          const cashAcc = (pm.includes('bank') || pm.includes('card') || pm.includes('online')) ? '1002' : '1001';
          
          const lines = [];
          if (cashPortion > 0) lines.push({ accountCode: cashAcc, debit: cashPortion, credit: 0 });
          if (receivableCurrent > 0) lines.push({ accountCode: '1100', debit: receivableCurrent, credit: 0 });
          lines.push({ accountCode: '4002', debit: 0, credit: consultantFees }); // Registration Fee Revenue

          const voucher = new Voucher({
            voucherNo: vNo,
            type: 'RV',
            status: 'posted',
            date: pet.createdAt || new Date(),
            portal: 'reception',
            paymentMethod: paymentMethod,
            description: `Pet Registration: ${pet.petName}`,
            partyType: 'patient',
            partyId: pet.id,
            partyName: pet.petName,
            lines: lines,
          });
          await voucher.save();

          // 2. Post to General Ledger via postEntry
          await postEntry({
            date: pet.createdAt || new Date(),
            portal: 'reception',
            sourceType: 'pet_registration',
            sourceId: pet.id,
            description: `Pet Registration: ${pet.petName}`,
            lines,
            meta: { 
              patientId: pet.id,
              petId: pet.id,
              clientId: pet.clientId,
              portalRef: String(pet._id),
              extra: { 
                voucherId: voucher._id,
                ownerName: pet.ownerName,
                consultingVet: body.details?.clinic?.consultingVet,
                paymentMethod: paymentMethod
              }
            }
          });

          // 3. Create receivable if any balance due
          if (receivableCurrent > 0) {
            try {
              await Receivable.create({
                portal: 'reception',
                customerId: pet.clientId || undefined,
                patientId: pet.id || undefined,
                customerName: pet.ownerName || undefined,
                refType: 'pet_registration',
                refId: String(pet._id),
                billDate: pet.createdAt || new Date(),
                description: `Registration fees for ${pet.petName}`,
                totalAmount: receivableCurrent,
                balance: receivableCurrent,
                status: 'open',
              });
            } catch (recErr) {
              console.error('Failed to create receivable for pet registration:', recErr);
            }
          }

          // 4. Log to DailyLog for Day Session Reconciliation
          if (cashPortion > 0) {
            try {
              await DailyLog.create({
                date: new Date().toISOString().slice(0,10),
                portal: 'reception',
                sessionId: req.daySession?._id,
                action: 'reception_income',
                refType: 'pet_registration',
                refId: String(pet._id),
                description: `Income: Registration for ${pet.petName}`,
                amount: cashPortion
              });
            } catch (logErr) {
              console.error('DailyLog creation failed for pet registration income:', logErr);
            }
          }
        }
      }
    } catch (financialErr) {
      console.error('Failed to create financial transactions for pet registration:', financialErr?.message || financialErr);
      // Don't fail the pet creation if financial transactions fail
    }

    res.status(201).json({ success: true, data: pet });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Bulk import pets
router.post('/bulk', async (req, res) => {
  try {
    const { pets } = req.body;
    if (!Array.isArray(pets) || pets.length === 0) {
      return res.status(400).json({ success: false, message: 'Pets array is required' });
    }
    
    const results = { created: 0, skipped: 0, errors: [] };
    const existingIds = new Set(await Pet.find().select('id').lean().then(pets => pets.map(p => p.id)));
    
    for (const petData of pets) {
      try {
        const body = { ...petData };
        
        // Skip if already exists
        if (existingIds.has(body.id)) {
          results.skipped++;
          continue;
        }
        
        if (body.age && !body.dateOfBirth && !body.ageRecordedAt) {
          body.ageRecordedAt = new Date();
        }
        if (!body.clientId) {
          body.clientId = `CL-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random()*1e6).toString(36).toUpperCase()}`;
        }
        
        // Normalize and auto-handle death fields
        try {
          if (typeof body.status === 'string' && body.status.toLowerCase() === 'deceased') {
            body.status = 'Expired';
          }
          const lifeDead = !!(body.details && body.details.life && body.details.life.dead);
          if (body.dateOfDeath || lifeDead || (typeof body.status === 'string' && body.status.toLowerCase() === 'expired')) {
            body.status = 'Expired';
            if (body.dateOfDeath) {
              body.dateOfDeath = new Date(body.dateOfDeath);
            } else if (lifeDead && !body.dateOfDeath) {
              body.dateOfDeath = new Date();
            }
          }
        } catch {}
        
        const pet = new Pet(body);
        if (pet.details) {
          pet.markModified('details');
        }
        await pet.save();
        existingIds.add(body.id);
        results.created++;
      } catch (error) {
        results.errors.push({ id: petData.id, error: error.message });
      }
    }
    
    res.status(201).json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update pet
router.put('/:id', dayGuard('reception'), async (req, res) => {
  try {
    const pet = await Pet.findOne({ id: req.params.id });
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Pet not found' });
    }
    
    // Store original consultant fees for comparison
    const originalFees = Number(pet.details?.clinic?.consultantFees || 0);
    
    // Update all fields
    const updates = { ...req.body };
    if (updates.age && !updates.dateOfBirth) {
      updates.ageRecordedAt = new Date();
    }
    // Normalize and auto-handle death fields
    try {
      if (typeof updates.status === 'string' && updates.status.toLowerCase() === 'deceased') {
        updates.status = 'Expired';
      }
      const lifeDead = !!(updates.details && updates.details.life && updates.details.life.dead);
      if (updates.dateOfDeath || lifeDead || (typeof updates.status === 'string' && updates.status.toLowerCase() === 'expired')) {
        updates.status = 'Expired';
        if (updates.dateOfDeath) {
          updates.dateOfDeath = new Date(updates.dateOfDeath);
        } else if (lifeDead && !updates.dateOfDeath) {
          updates.dateOfDeath = new Date();
        }
      }
    } catch {}
    Object.assign(pet, updates);
    
    // Mark details as modified for Mixed type
    if (req.body.details) {
      pet.markModified('details');
    }
    
    await pet.save();

    // Handle financial transactions if consultant fees were added/changed
    try {
      const newFees = Number(updates.details?.clinic?.consultantFees || 0);
      const feesDifference = newFees - originalFees;
      
      if (feesDifference > 0) {
        // Additional fees added - create new financial transactions
        const paymentMethod = updates.details?.clinic?.paymentMethod || 'Cash';
        const receivedAmount = Number(updates.details?.clinic?.receivedAmount || feesDifference);
        
        const cashPortion = Math.max(0, Math.min(receivedAmount, feesDifference));
        const receivableCurrent = Math.max(0, feesDifference - cashPortion);

        if (cashPortion > 0 || receivableCurrent > 0) {
          // 1. Create Formal Voucher for additional fees
          const vNo = await nextVoucherNo('RV');
          const pm = paymentMethod.toLowerCase();
          const cashAcc = (pm.includes('bank') || pm.includes('card') || pm.includes('online')) ? '1002' : '1001';
          
          const lines = [];
          if (cashPortion > 0) lines.push({ accountCode: cashAcc, debit: cashPortion, credit: 0 });
          if (receivableCurrent > 0) lines.push({ accountCode: '1100', debit: receivableCurrent, credit: 0 });
          lines.push({ accountCode: '4002', debit: 0, credit: feesDifference }); // Registration Fee Revenue

          const voucher = new Voucher({
            voucherNo: vNo,
            type: 'RV',
            status: 'posted',
            date: new Date(),
            portal: 'reception',
            paymentMethod: paymentMethod,
            description: `Pet Registration Update: ${pet.petName} (Additional Fees)`,
            partyType: 'patient',
            partyId: pet.id,
            partyName: pet.petName,
            lines: lines,
          });
          await voucher.save();

          // 2. Post to General Ledger via postEntry
          await postEntry({
            date: new Date(),
            portal: 'reception',
            sourceType: 'pet_registration_update',
            sourceId: pet.id,
            description: `Pet Registration Update: ${pet.petName} (Additional Fees)`,
            lines,
            meta: { 
              patientId: pet.id,
              petId: pet.id,
              clientId: pet.clientId,
              portalRef: String(pet._id),
              extra: { 
                voucherId: voucher._id,
                ownerName: pet.ownerName,
                consultingVet: updates.details?.clinic?.consultingVet,
                paymentMethod: paymentMethod,
                originalFees: originalFees,
                newFees: newFees,
                feesDifference: feesDifference
              }
            }
          });

          // 3. Create/update receivable if any balance due
          if (receivableCurrent > 0) {
            try {
              // Check if existing receivable exists
              const existingReceivable = await Receivable.findOne({
                refType: 'pet_registration',
                refId: String(pet._id),
                status: 'open'
              });

              if (existingReceivable) {
                // Update existing receivable
                existingReceivable.totalAmount += receivableCurrent;
                existingReceivable.balance += receivableCurrent;
                existingReceivable.description = `Registration fees for ${pet.petName} (Updated)`;
                await existingReceivable.save();
              } else {
                // Create new receivable
                await Receivable.create({
                  portal: 'reception',
                  customerId: pet.clientId || undefined,
                  patientId: pet.id || undefined,
                  customerName: pet.ownerName || undefined,
                  refType: 'pet_registration',
                  refId: String(pet._id),
                  billDate: new Date(),
                  description: `Registration fees for ${pet.petName} (Updated)`,
                  totalAmount: receivableCurrent,
                  balance: receivableCurrent,
                  status: 'open',
                });
              }
            } catch (recErr) {
              console.error('Failed to create/update receivable for pet registration update:', recErr);
            }
          }

          // 4. Log to DailyLog for Day Session Reconciliation
          if (cashPortion > 0) {
            try {
              await DailyLog.create({
                date: new Date().toISOString().slice(0,10),
                portal: 'reception',
                sessionId: req.daySession?._id,
                action: 'reception_income',
                refType: 'pet_registration_update',
                refId: String(pet._id),
                description: `Income: Registration Update for ${pet.petName}`,
                amount: cashPortion
              });
            } catch (logErr) {
              console.error('DailyLog creation failed for pet registration update income:', logErr);
            }
          }
        }
      }
    } catch (financialErr) {
      console.error('Failed to create financial transactions for pet registration update:', financialErr?.message || financialErr);
      // Don't fail the pet update if financial transactions fail
    }
    
    res.json({ success: true, data: pet });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Bulk delete all pets (use with caution)
router.delete('/all', async (req, res) => {
  try {
    const result = await Pet.deleteMany({});
    res.json({ success: true, deleted: result.deletedCount || 0 });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete pet
router.delete('/:id', async (req, res) => {
  try {
    const pet = await Pet.findOneAndDelete({ id: req.params.id });
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Pet not found' });
    }
    res.json({ success: true, message: 'Pet deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// (search route moved above)

export default router;
