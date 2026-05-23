/**
 * Permission Debugger Utility
 * Helps debug and fix permission issues
 */

/**
 * Clear all authentication data and force refresh
 */
export const clearAllAuthData = () => {
  const portals = ['admin', 'pharmacy', 'doctor', 'lab', 'reception', 'shop'];
  
  console.log('🧹 Clearing all authentication data...');
  
  portals.forEach(portal => {
    const authKey = `${portal}_auth`;
    if (localStorage.getItem(authKey)) {
      console.log(`🗑️ Removing ${authKey}`);
      localStorage.removeItem(authKey);
    }
  });
  
  if (localStorage.getItem('portal')) {
    console.log('🗑️ Removing portal');
    localStorage.removeItem('portal');
  }
  
  console.log('✅ All auth data cleared');
  
  // Redirect to home page
  window.location.href = '/';
};

/**
 * Debug current user permissions for a specific portal
 */
export const debugPortalPermissions = (portal) => {
  const authKey = `${portal}_auth`;
  const authData = localStorage.getItem(authKey);
  
  console.log(`🔍 Debugging ${portal} portal permissions:`);
  console.log('📦 Raw localStorage data:', authData);
  
  if (!authData) {
    console.log(' No authentication data found');
    return null;
  }
  
  try {
    const parsed = JSON.parse(authData);
    console.log(' User:', parsed.username);
    console.log(' Role:', parsed.role);
    console.log(' Portal Access:', parsed.portalAccess);
    console.log(' Sidebar Permissions:', parsed.sidebarPermissions);
    console.log(' Is Admin:', parsed.role?.toLowerCase() === 'admin');
    console.log(' Has Portal Access:', parsed.portalAccess?.map(p => String(p).toLowerCase()).includes(String(portal).toLowerCase()));
    console.log(' Portal Pages:', parsed.sidebarPermissions?.[portal] || []);
    
    return parsed;
  } catch (error) {
    console.error(' Failed to parse auth data:', error);
    return null;
  }
};

/**
 * Simulate user permissions for testing
 */
export const simulateUserPermissions = (portal, username, role, portalAccess, sidebarPermissions) => {
  const authKey = `${portal}_auth`;
  const authData = {
    username,
    role,
    portalAccess,
    sidebarPermissions,
    // Add some mock data
    name: username,
    isActive: true,
    createdAt: new Date().toISOString()
  };
  
  console.log('🎭 Simulating user permissions:', authData);
  localStorage.setItem(authKey, JSON.stringify(authData));
  localStorage.setItem('portal', portal);
  
  console.log('✅ Simulation complete - refresh page to see changes');
  return authData;
};

/**
 * Test permission filtering with different user scenarios
 */
export const testPermissionScenarios = () => {
  console.log('🧪 Testing Permission Scenarios');
  
  // Scenario 1: Admin user (should see all pages)
  console.log('\n👑 Scenario 1: Admin User');
  simulateUserPermissions(
    'pharmacy',
    'admin',
    'admin',
    ['admin', 'pharmacy', 'doctor', 'lab', 'reception', 'shop'],
    {
      admin: ['dashboard', 'users', 'settings'],
      pharmacy: ['dashboard', 'pos', 'medicines', 'suppliers']
    }
  );
  
  // Scenario 2: Limited pharmacy user (like rahab)
  console.log('\n🏥 Scenario 2: Limited Pharmacy User (like rahab)');
  simulateUserPermissions(
    'pharmacy',
    'rahab',
    'pharmacy',
    ['pharmacy'],
    {
      pharmacy: ['dashboard', 'pos', 'credit-customers']
    }
  );
  
  // Scenario 3: No permissions user
  console.log('\n🚫 Scenario 3: No Permissions User');
  simulateUserPermissions(
    'pharmacy',
    'noperm',
    'pharmacy',
    [],
    {}
  );
  
  console.log('\n✅ All scenarios set up - refresh page to test each one');
};

// Make functions available globally for browser console testing
if (typeof window !== 'undefined') {
  window.permissionDebugger = {
    clearAllAuthData,
    debugPortalPermissions,
    simulateUserPermissions,
    testPermissionScenarios
  };
  
  console.log('🔧 Permission Debugger loaded! Available functions:');
  console.log('- permissionDebugger.clearAllAuthData()');
  console.log('- permissionDebugger.debugPortalPermissions("pharmacy")');
  console.log('- permissionDebugger.simulateUserPermissions(portal, username, role, portalAccess, sidebarPermissions)');
  console.log('- permissionDebugger.testPermissionScenarios()');
}

export default {
  clearAllAuthData,
  debugPortalPermissions,
  simulateUserPermissions,
  testPermissionScenarios
};