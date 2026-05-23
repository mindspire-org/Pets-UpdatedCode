import express from 'express';
import User from '../models/User.js';
import { getDefaultPermissions } from '../utils/defaultPermissions.js';
import updateShopPermissions from '../utils/update-shop-permissions.js';

const router = express.Router();

const normalizeSidebarPermissions = (sidebarPermissions) => {
  if (!sidebarPermissions) return {};

  // Mongoose Map may serialize oddly; ensure we return a plain object
  if (typeof sidebarPermissions?.entries === 'function') {
    try {
      return Object.fromEntries(sidebarPermissions.entries());
    } catch {
      // fall through
    }
  }

  // Already a plain object
  if (typeof sidebarPermissions === 'object' && !Array.isArray(sidebarPermissions)) {
    return sidebarPermissions;
  }

  return {};
};

const normalizeUserForClient = (userDocOrObj) => {
  if (!userDocOrObj) return userDocOrObj;
  const obj = typeof userDocOrObj.toObject === 'function'
    ? userDocOrObj.toObject()
    : { ...userDocOrObj };

  if ('password' in obj) delete obj.password;
  obj.sidebarPermissions = normalizeSidebarPermissions(obj.sidebarPermissions);
  if (!Array.isArray(obj.portalAccess)) obj.portalAccess = [];
  return obj;
};

// Get all users
router.get('/', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({ success: true, data: users.map(normalizeUserForClient) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get user by username
router.get('/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username }).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: normalizeUserForClient(user) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create new user
router.post('/', async (req, res) => {
  try {
    const userData = { ...req.body };
    
    // Initialize with empty permissions - admin will set them explicitly
    // Only admin role gets automatic full access
    if (userData.role === 'admin') {
      const defaultPerms = getDefaultPermissions(userData.role);
      userData.portalAccess = userData.portalAccess || defaultPerms.portalAccess;
      userData.sidebarPermissions = userData.sidebarPermissions || defaultPerms.sidebarPermissions;
    } else {
      // For non-admin users, start with no permissions
      userData.portalAccess = userData.portalAccess || [];
      userData.sidebarPermissions = userData.sidebarPermissions || {};
    }
    
    const user = new User(userData);
    await user.save();
    res.status(201).json({ success: true, data: normalizeUserForClient(user) });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Find user by username only
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }
    
    // Check password
    if (user.password !== password) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }
    
    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account is inactive' });
    }
    
    // Update last login
    user.lastLogin = new Date();
    await user.save();
    
    // Return user data without password
    res.json({ success: true, data: normalizeUserForClient(user) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update user
router.put('/:username', async (req, res) => {
  try {
    const updateData = { ...req.body };
    
    // If role is being changed to admin, give full permissions
    if (updateData.role === 'admin') {
      const existingUser = await User.findOne({ username: req.params.username });
      if (existingUser && existingUser.role !== 'admin') {
        const defaultPerms = getDefaultPermissions('admin');
        // Only update if current permissions are empty
        if (!updateData.portalAccess && (!existingUser.portalAccess || existingUser.portalAccess.length === 0)) {
          updateData.portalAccess = defaultPerms.portalAccess;
        }
        if (!updateData.sidebarPermissions && (!existingUser.sidebarPermissions || Object.keys(existingUser.sidebarPermissions).length === 0)) {
          updateData.sidebarPermissions = defaultPerms.sidebarPermissions;
        }
      }
    }
    // For non-admin roles, don't auto-assign permissions
    
    const user = await User.findOneAndUpdate(
      { username: req.params.username },
      updateData,
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: normalizeUserForClient(user) });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete user
router.delete('/:username', async (req, res) => {
  try {
    const user = await User.findOneAndDelete({ username: req.params.username });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update sidebar permissions for a user
router.put('/:username/permissions', async (req, res) => {
  try {
    const { sidebarPermissions, portalAccess } = req.body;
    const updateData = {};
    
    if (sidebarPermissions !== undefined) {
      updateData.sidebarPermissions = sidebarPermissions;
    }
    
    if (portalAccess !== undefined) {
      updateData.portalAccess = portalAccess;
    }
    
    const user = await User.findOneAndUpdate(
      { username: req.params.username },
      updateData,
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: normalizeUserForClient(user) });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Get user permissions by username
router.get('/:username/permissions', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .select('username role sidebarPermissions portalAccess');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({ success: true, data: normalizeUserForClient(user) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update shop permissions for existing users
router.post('/update-shop-permissions', async (req, res) => {
  try {
    await updateShopPermissions();
    res.json({ 
      success: true, 
      message: 'Shop permissions updated successfully for all existing users' 
    });
  } catch (error) {
    console.error('Error updating shop permissions:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update shop permissions: ' + error.message 
    });
  }
});

// Get current user permissions for debugging
router.get('/debug-permissions/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username }).select('-password');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({ 
      success: true, 
      data: {
        username: user.username,
        role: user.role,
        portalAccess: user.portalAccess,
        sidebarPermissions: user.sidebarPermissions
      }
    });
  } catch (error) {
    console.error('Error getting user permissions:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get user permissions: ' + error.message 
    });
  }
});

// Quick fix: Add companies permission to a specific user
router.post('/add-companies-permission/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Initialize sidebarPermissions if it doesn't exist
    if (!user.sidebarPermissions) {
      user.sidebarPermissions = {};
    }
    
    // Initialize shop permissions if they don't exist
    if (!user.sidebarPermissions.shop) {
      user.sidebarPermissions.shop = [];
    }
    
    // Add companies permission if not already present
    if (!user.sidebarPermissions.shop.includes('companies')) {
      user.sidebarPermissions.shop.push('companies');
      await user.save();
    }
    
    res.json({ 
      success: true, 
      message: `Companies permission added to user ${username}`,
      permissions: user.sidebarPermissions.shop
    });
  } catch (error) {
    console.error('Error adding companies permission:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to add companies permission: ' + error.message 
    });
  }
});

export default router;
