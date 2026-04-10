import express from 'express';
import Pet from '../models/Pet.js';

const router = express.Router();

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
router.post('/', async (req, res) => {
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
router.put('/:id', async (req, res) => {
  try {
    const pet = await Pet.findOne({ id: req.params.id });
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Pet not found' });
    }
    
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
