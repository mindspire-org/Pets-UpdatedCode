import express from 'express';
import ActivityLog from '../models/ActivityLog.js';

const router = express.Router();

// Get all activity logs
router.get('/', async (req, res) => {
  try {
    const logs = await ActivityLog.find()
      .sort({ when: -1 })
      .limit(1000);
    
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activity logs',
      error: error.message
    });
  }
});

// Get activity logs by user/portal
router.get('/user/:user', async (req, res) => {
  try {
    const { user } = req.params;
    const logs = await ActivityLog.find({ user })
      .sort({ when: -1 })
      .limit(1000);
    
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('Error fetching activity logs by user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activity logs',
      error: error.message
    });
  }
});

// Create new activity log
router.post('/', async (req, res) => {
  try {
    const { user, text } = req.body;
    
    if (!user || !text) {
      return res.status(400).json({
        success: false,
        message: 'User and text are required'
      });
    }

    const when = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const id = Date.now();

    const log = new ActivityLog({
      id,
      when,
      user,
      text
    });

    await log.save();

    res.status(201).json({
      success: true,
      data: log
    });
  } catch (error) {
    console.error('Error creating activity log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create activity log',
      error: error.message
    });
  }
});

// Clear all activity logs
router.delete('/clear', async (req, res) => {
  try {
    await ActivityLog.deleteMany({});
    
    res.json({
      success: true,
      message: 'All activity logs cleared'
    });
  } catch (error) {
    console.error('Error clearing activity logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear activity logs',
      error: error.message
    });
  }
});

// Delete specific activity log
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const log = await ActivityLog.findOneAndDelete({ id: parseInt(id) });
    
    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Activity log not found'
      });
    }

    res.json({
      success: true,
      message: 'Activity log deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting activity log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete activity log',
      error: error.message
    });
  }
});

export default router;
