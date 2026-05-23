import { useMemo } from 'react';

/**
 * Custom hook for checking user permissions
 * @param {string} portal - The portal name (admin, pharmacy, etc.)
 * @returns {object} Permission checking functions
 */
export const usePermissions = (portal) => {
  const auth = useMemo(() => {
    try {
      const authKey = `${portal}_auth`;
      return JSON.parse(localStorage.getItem(authKey) || '{}');
    } catch {
      return {};
    }
  }, [portal]);

  const normalized = useMemo(() => {
    const role = auth?.role?.toLowerCase();
    const portalAccess = Array.isArray(auth?.portalAccess)
      ? auth.portalAccess.map((p) => String(p).toLowerCase())
      : [];
    const sidebarPermissions =
      auth?.sidebarPermissions && typeof auth.sidebarPermissions === 'object'
        ? auth.sidebarPermissions
        : {};
    return { role, portalAccess, sidebarPermissions };
  }, [auth]);

  const permissions = useMemo(() => {
    return {
      // Check if user has access to a specific portal
      hasPortalAccess: (portalName) => {
        if (normalized.role === 'admin') return true;
        return normalized.portalAccess.includes(String(portalName).toLowerCase());
      },

      // Check if user has access to a specific page within the current portal
      hasPageAccess: (pageId) => {
        if (normalized.role === 'admin') return true;
        
        // First check if user has portal access
        if (!normalized.portalAccess.includes(String(portal).toLowerCase())) return false;
        
        // Then check page permissions
        const portalPermissions = normalized.sidebarPermissions?.[portal] || [];
        return Array.isArray(portalPermissions) && portalPermissions.includes(pageId);
      },

      // Check if user has any of the specified roles
      hasRole: (roles) => {
        if (!Array.isArray(roles)) roles = [roles];
        return roles.map(r => String(r).toLowerCase()).includes(normalized.role);
      },

      // Check if user is admin
      isAdmin: () => {
        return normalized.role === 'admin';
      },

      // Get user info
      getUser: () => auth,

      // Get all portal access
      getPortalAccess: () => auth.portalAccess || [],

      // Get permissions for current portal
      getPortalPermissions: () => auth.sidebarPermissions?.[portal] || [],

      // Filter menu items based on permissions
      filterMenuItems: (items) => {
        if (normalized.role === 'admin') return items;
        const portalPermissions = normalized.sidebarPermissions?.[portal] || [];
        if (!Array.isArray(portalPermissions)) return [];
        return items.filter(item => portalPermissions.includes(item.id));
      },

      // Filter menu groups based on permissions
      filterMenuGroups: (groups) => {
        if (normalized.role === 'admin') return groups;
        const portalPermissions = normalized.sidebarPermissions?.[portal] || [];
        if (!Array.isArray(portalPermissions)) return [];
        return groups
          .map(group => ({
            ...group,
            items: group.items.filter(item => portalPermissions.includes(item.id))
          }))
          .filter(group => group.items.length > 0);
      }
    };
  }, [auth, normalized, portal]);

  return permissions;
};

/**
 * Higher-order component for protecting routes based on permissions
 * @param {React.Component} Component - Component to protect
 * @param {string} portal - Required portal access
 * @param {string} pageId - Required page access (optional)
 * @param {string[]} roles - Required roles (optional)
 */
export const withPermissions = (Component, portal, pageId = null, roles = null) => {
  return function ProtectedComponent(props) {
    const permissions = usePermissions(portal);

    // Check role if specified
    if (roles && !permissions.hasRole(roles)) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
          <div className="text-center p-8 bg-white rounded-2xl shadow-lg border border-red-100">
            <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Access Denied</h2>
            <p className="text-slate-600">You don't have the required role to access this page.</p>
            <p className="text-sm text-slate-500 mt-2">Required roles: {Array.isArray(roles) ? roles.join(', ') : roles}</p>
          </div>
        </div>
      );
    }

    // Check portal access
    if (!permissions.hasPortalAccess(portal)) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
          <div className="text-center p-8 bg-white rounded-2xl shadow-lg border border-red-100">
            <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Portal Access Denied</h2>
            <p className="text-slate-600">You don't have access to the {portal} portal.</p>
            <p className="text-sm text-slate-500 mt-2">Contact your administrator to request access.</p>
          </div>
        </div>
      );
    }

    // Check page access if specified
    if (pageId && !permissions.hasPageAccess(pageId)) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
          <div className="text-center p-8 bg-white rounded-2xl shadow-lg border border-red-100">
            <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Page Access Denied</h2>
            <p className="text-slate-600">You don't have permission to access this page.</p>
            <p className="text-sm text-slate-500 mt-2">Contact your administrator to request access.</p>
          </div>
        </div>
      );
    }

    return <Component {...props} />;
  };
};

export default usePermissions;