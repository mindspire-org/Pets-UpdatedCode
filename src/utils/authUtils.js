/**
 * Auth utilities for managing user sessions and permissions
 */

/**
 * Force refresh user permissions by clearing localStorage and redirecting to login
 * This should be called when permissions are updated by admin
 */
export const forcePermissionRefresh = (portal) => {
  // Clear the specific portal auth data
  localStorage.removeItem(`${portal}_auth`);
  localStorage.removeItem('portal');
  
  // Redirect to login page
  window.location.href = `/${portal}/login`;
};

/**
 * Update user permissions in localStorage without requiring re-login
 * This can be used to sync permissions in real-time
 */
export const updateUserPermissions = (portal, newPermissions) => {
  try {
    const authKey = `${portal}_auth`;
    const currentAuth = JSON.parse(localStorage.getItem(authKey) || '{}');
    
    // Update the permissions
    const updatedAuth = {
      ...currentAuth,
      sidebarPermissions: newPermissions.sidebarPermissions || currentAuth.sidebarPermissions,
      portalAccess: newPermissions.portalAccess || currentAuth.portalAccess
    };
    
    // Save back to localStorage
    localStorage.setItem(authKey, JSON.stringify(updatedAuth));
    
    // Force a page reload to apply new permissions
    window.location.reload();
    
    return true;
  } catch (error) {
    console.error('Failed to update user permissions:', error);
    return false;
  }
};

/**
 * Check if user has valid permissions for current portal
 */
export const validateUserPermissions = (portal) => {
  try {
    const authKey = `${portal}_auth`;
    const auth = JSON.parse(localStorage.getItem(authKey) || '{}');
    
    // Check if user has portal access
    if (auth.role?.toLowerCase() !== 'admin') {
      const hasPortalAccess = Array.isArray(auth.portalAccess)
        ? auth.portalAccess.map(p => String(p).toLowerCase()).includes(String(portal).toLowerCase())
        : false
      if (!hasPortalAccess) {
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Failed to validate permissions:', error);
    return false;
  }
};

/**
 * Get current user permissions for debugging
 */
export const debugUserPermissions = (portal) => {
  try {
    const authKey = `${portal}_auth`;
    const auth = JSON.parse(localStorage.getItem(authKey) || '{}');
    
    console.log('🔍 Debug User Permissions:', {
      portal,
      username: auth.username,
      role: auth.role,
      portalAccess: auth.portalAccess,
      sidebarPermissions: auth.sidebarPermissions,
      hasPortalAccess: auth.portalAccess?.map(p => String(p).toLowerCase()).includes(String(portal).toLowerCase()),
      isAdmin: auth.role?.toLowerCase() === 'admin'
    });
    
    return auth;
  } catch (error) {
    console.error('Failed to debug permissions:', error);
    return {};
  }
};

export default {
  forcePermissionRefresh,
  updateUserPermissions,
  validateUserPermissions,
  debugUserPermissions
};