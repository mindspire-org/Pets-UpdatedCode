import React from 'react';
import { usePermissions } from '../../hooks/usePermissions';

export default function PermissionTest() {
  const permissions = usePermissions('pharmacy');
  const user = permissions.getUser();
  const portalAccess = permissions.getPortalAccess();
  const portalPermissions = permissions.getPortalPermissions();

  const allPharmacyPages = [
    'dashboard', 'pos', 'credit-customers', 'medicines', 'suppliers', 
    'companies', 'purchase-orders', 'sales-history', 'purchase-history', 
    'return-history', 'sales-return', 'supplier-returns', 'referrals', 
    'prescriptions', 'reports', 'notifications', 'audit-logs', 'expenses', 'settings'
  ];

  const clearAuthData = () => {
    if (window.permissionDebugger) {
      window.permissionDebugger.clearAllAuthData();
    } else {
      localStorage.removeItem('pharmacy_auth');
      localStorage.removeItem('portal');
      window.location.href = '/pharmacy/login';
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-6">Permission Test Page</h1>
        
        {/* User Info */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-700 mb-3">Current User</h2>
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="font-medium text-slate-600">Username:</span>
                <span className="ml-2 text-slate-800">{user.username || 'Not logged in'}</span>
              </div>
              <div>
                <span className="font-medium text-slate-600">Role:</span>
                <span className="ml-2 text-slate-800">{user.role || 'None'}</span>
              </div>
              <div>
                <span className="font-medium text-slate-600">Is Admin:</span>
                <span className={`ml-2 font-medium ${permissions.isAdmin() ? 'text-green-600' : 'text-red-600'}`}>
                  {permissions.isAdmin() ? 'Yes' : 'No'}
                </span>
              </div>
              <div>
                <span className="font-medium text-slate-600">Portal Access:</span>
                <span className={`ml-2 font-medium ${permissions.hasPortalAccess('pharmacy') ? 'text-green-600' : 'text-red-600'}`}>
                  {permissions.hasPortalAccess('pharmacy') ? 'Granted' : 'Denied'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Portal Access */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-700 mb-3">Portal Access</h2>
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex flex-wrap gap-2">
              {portalAccess.length > 0 ? (
                portalAccess.map(portal => (
                  <span key={portal} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                    {portal}
                  </span>
                ))
              ) : (
                <span className="text-slate-500 italic">No portal access</span>
              )}
            </div>
          </div>
        </div>

        {/* Page Permissions */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-700 mb-3">Pharmacy Page Permissions</h2>
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {allPharmacyPages.map(pageId => {
                const hasAccess = permissions.hasPageAccess(pageId);
                return (
                  <div key={pageId} className={`flex items-center justify-between p-3 rounded-lg border ${
                    hasAccess ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}>
                    <span className="text-sm font-medium text-slate-700 capitalize">
                      {pageId.replace('-', ' ')}
                    </span>
                    <span className={`text-xs font-bold ${
                      hasAccess ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {hasAccess ? '✅ ALLOWED' : '❌ BLOCKED'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Raw Data */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-700 mb-3">Raw Permission Data</h2>
          <div className="bg-slate-50 rounded-lg p-4">
            <pre className="text-xs text-slate-600 overflow-x-auto">
              {JSON.stringify({
                portalAccess,
                sidebarPermissions: user.sidebarPermissions,
                pharmacyPermissions: portalPermissions
              }, null, 2)}
            </pre>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-4">
          <button
            onClick={clearAuthData}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Clear Auth Data & Logout
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Refresh Page
          </button>
          <button
            onClick={() => {
              if (window.permissionDebugger) {
                window.permissionDebugger.debugPortalPermissions('pharmacy');
              }
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Debug in Console
          </button>
        </div>

        {/* Instructions */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">Testing Instructions</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• If you see "No portal access" or "Portal Access: Denied", contact your administrator</li>
            <li>• If you see pages marked as "BLOCKED" that you should have access to, try clearing auth data</li>
            <li>• After permission changes, you must log out and log back in to see updates</li>
            <li>• Open browser console (F12) to see detailed permission debugging logs</li>
          </ul>
        </div>
      </div>
    </div>
  );
}