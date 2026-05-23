import express from 'express';
import PetshopPharmacySettings from '../models/PetshopPharmacySettings.js';

const router = express.Router();

const SETTINGS_ID = 'petshop_shared_settings';

router.get('/', async (req, res) => {
  try {
    let settings = await PetshopPharmacySettings.findOne({ settingsId: SETTINGS_ID });

    if (!settings) {
      settings = new PetshopPharmacySettings({ settingsId: SETTINGS_ID });
      await settings.save();
    }

    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching petshop settings:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const updateData = {
      ...req.body,
      lastUpdatedAt: new Date(),
      lastUpdatedBy: req.body.updatedBy || 'system'
    };

    delete updateData.settingsId;
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    const settings = await PetshopPharmacySettings.findOneAndUpdate(
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
    console.error('Error saving petshop settings:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

router.put('/', async (req, res) => {
  try {
    const updateData = {
      ...req.body,
      lastUpdatedAt: new Date(),
      lastUpdatedBy: req.body.updatedBy || 'system'
    };

    delete updateData.settingsId;
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    const settings = await PetshopPharmacySettings.findOneAndUpdate(
      { settingsId: SETTINGS_ID },
      updateData,
      { new: true, runValidators: true }
    );

    if (!settings) {
      return res.status(404).json({ success: false, message: 'Petshop settings not found' });
    }

    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error updating petshop settings:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/defaults', async (req, res) => {
  try {
    let settings = await PetshopPharmacySettings.findOne({ settingsId: SETTINGS_ID });

    if (!settings) {
      settings = new PetshopPharmacySettings({ settingsId: SETTINGS_ID });
      await settings.save();
    }

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
    console.error('Error fetching petshop defaults:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
