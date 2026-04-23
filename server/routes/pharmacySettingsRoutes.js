import express from 'express';
import PharmacySettings from '../models/PharmacySettings.js';

const router = express.Router();

const SETTINGS_ID = 'pharmacy_shared_settings';

// GET /api/pharmacy-settings - Get shared pharmacy settings
router.get('/', async (req, res) => {
  try {
    let settings = await PharmacySettings.findOne({ settingsId: SETTINGS_ID });
    
    // If no settings exist, create default settings
    if (!settings) {
      settings = new PharmacySettings({ settingsId: SETTINGS_ID });
      await settings.save();
    }
    
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching pharmacy settings:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/pharmacy-settings - Create or update pharmacy settings
router.post('/', async (req, res) => {
  try {
    const updateData = {
      ...req.body,
      lastUpdatedAt: new Date(),
      lastUpdatedBy: req.body.updatedBy || 'system'
    };
    
    // Remove settingsId from update data to prevent changing it
    delete updateData.settingsId;
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    
    const settings = await PharmacySettings.findOneAndUpdate(
      { settingsId: SETTINGS_ID },
      updateData,
      { 
        new: true, 
        upsert: true, 
        runValidators: true 
      }
    );
    
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error saving pharmacy settings:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// PUT /api/pharmacy-settings - Update pharmacy settings
router.put('/', async (req, res) => {
  try {
    const updateData = {
      ...req.body,
      lastUpdatedAt: new Date(),
      lastUpdatedBy: req.body.updatedBy || 'system'
    };
    
    // Remove protected fields from update
    delete updateData.settingsId;
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    
    const settings = await PharmacySettings.findOneAndUpdate(
      { settingsId: SETTINGS_ID },
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!settings) {
      return res.status(404).json({ success: false, message: 'Pharmacy settings not found' });
    }
    
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error updating pharmacy settings:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// GET /api/pharmacy-settings/defaults - Get default values only
router.get('/defaults', async (req, res) => {
  try {
    let settings = await PharmacySettings.findOne({ settingsId: SETTINGS_ID });
    
    if (!settings) {
      settings = new PharmacySettings({ settingsId: SETTINGS_ID });
      await settings.save();
    }
    
    // Return only the default percentage values
    res.json({
      success: true,
      data: {
        billDiscountPercent: settings.billDiscountPercent || 0,
        salesTaxPercent: settings.salesTaxPercent || 0,
        currency: settings.currency || 'PKR',
        pharmacyName: settings.pharmacyName || ''
      }
    });
  } catch (error) {
    console.error('Error fetching pharmacy defaults:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
