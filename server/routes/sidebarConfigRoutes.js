import express from 'express';
import SidebarConfig from '../models/SidebarConfig.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const configs = await SidebarConfig.find().sort({ portalId: 1 });
    res.json({ success: true, data: configs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:portalId', async (req, res) => {
  try {
    const config = await SidebarConfig.findOne({ portalId: req.params.portalId });
    if (!config) {
      return res.status(404).json({ success: false, message: 'Portal sidebar config not found' });
    }
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
