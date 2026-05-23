import User from '../models/User.js';

// Middleware to check if user has access to a specific portal
export const checkPortalAccess = (requiredPortal) => {
  return async (req, res, next) => {
    try {
      const { username } = req.headers;
      
      if (!username) {
        return res.status(401).json({ 
          success: false, 
          message: 'Username required in headers' 
        });
      }

      const user = await User.findOne({ username, isActive: true });
      
      if (!user) {
        return res.status(401).json({ 
          success: false, 
          message: 'User not found or inactive' 
        });
      }

      // Admin users have access to all portals
      if (user.role === 'admin') {
        req.user = user;
        return next();
      }

      // Check if user has access to the required portal
      if (!user.portalAccess || !user.portalAccess.includes(requiredPortal)) {
        return res.status(403).json({ 
          success: false, 
          message: `Access denied to ${requiredPortal} portal` 
        });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Authentication error' 
      });
    }
  };
};

// Middleware to check if user has access to a specific page within a portal
export const checkPageAccess = (portal, pageId) => {
  return async (req, res, next) => {
    try {
      const { username } = req.headers;
      
      if (!username) {
        return res.status(401).json({ 
          success: false, 
          message: 'Username required in headers' 
        });
      }

      const user = await User.findOne({ username, isActive: true });
      
      if (!user) {
        return res.status(401).json({ 
          success: false, 
          message: 'User not found or inactive' 
        });
      }

      // Admin users have access to all pages
      if (user.role === 'admin') {
        req.user = user;
        return next();
      }

      // Check portal access first
      if (!user.portalAccess || !user.portalAccess.includes(portal)) {
        return res.status(403).json({ 
          success: false, 
          message: `Access denied to ${portal} portal` 
        });
      }

      // Check page access
      const portalPermissions = user.sidebarPermissions?.get(portal) || [];
      if (!portalPermissions.includes(pageId)) {
        return res.status(403).json({ 
          success: false, 
          message: `Access denied to ${pageId} page in ${portal} portal` 
        });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error('Page access middleware error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Authorization error' 
      });
    }
  };
};

// Middleware to check if user has any of the specified roles
export const checkRole = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      const { username } = req.headers;
      
      if (!username) {
        return res.status(401).json({ 
          success: false, 
          message: 'Username required in headers' 
        });
      }

      const user = await User.findOne({ username, isActive: true });
      
      if (!user) {
        return res.status(401).json({ 
          success: false, 
          message: 'User not found or inactive' 
        });
      }

      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ 
          success: false, 
          message: `Access denied. Required roles: ${allowedRoles.join(', ')}` 
        });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error('Role check middleware error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Role authorization error' 
      });
    }
  };
};

export default {
  checkPortalAccess,
  checkPageAccess,
  checkRole
};