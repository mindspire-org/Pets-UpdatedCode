import React from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { FiShield, FiLock, FiAlertTriangle } from 'react-icons/fi';

/**
 * Permission Guard Component
 * Wraps content and shows access denied message if user doesn't have required permissions
 */
const PermissionGuard = ({ 
  children, 
  portal, 
  pageId = null, 
  roles = null, 
  fallback = null,
  showFallback = true 
}) => {
  const permissions = usePermissions(portal);

  // Check role if specified
  if (roles && !permissions.hasRole(roles)) {
    if (!showFallback) return null;
    
    return fallback || (
      <div className="flex items-center justify-center min-h-[400px] bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
        <div className="text-center p-8 bg-white rounded-2xl shadow-lg border border-red-100 max-w-md">
          <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiAlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Insufficient Role</h2>
          <p className="text-slate-600">You don't have the required role to access this content.</p>
          <p className="text-sm text-slate-500 mt-2">
            Required roles: {Array.isArray(roles) ? roles.join(', ') : roles}
          </p>
        </div>
      </div>
    );
  }

  // Check portal access
  if (!permissions.hasPortalAccess(portal)) {
    if (!showFallback) return null;
    
    return fallback || (
      <div className="flex items-center justify-center min-h-[400px] bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
        <div className="text-center p-8 bg-white rounded-2xl shadow-lg border border-red-100 max-w-md">
          <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiShield className="h-8 w-8 text-red-600" />
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
    if (!showFallback) return null;
    
    return fallback || (
      <div className="flex items-center justify-center min-h-[400px] bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
        <div className="text-center p-8 bg-white rounded-2xl shadow-lg border border-red-100 max-w-md">
          <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiLock className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Page Access Denied</h2>
          <p className="text-slate-600">You don't have permission to access this page.</p>
          <p className="text-sm text-slate-500 mt-2">Contact your administrator to request access.</p>
        </div>
      </div>
    );
  }

  // All checks passed, render children
  return children;
};

/**
 * Inline Permission Check Component
 * Shows/hides content based on permissions without fallback UI
 */
export const PermissionCheck = ({ children, portal, pageId = null, roles = null }) => {
  return (
    <PermissionGuard 
      portal={portal} 
      pageId={pageId} 
      roles={roles} 
      showFallback={false}
    >
      {children}
    </PermissionGuard>
  );
};

/**
 * Permission Button Component
 * Disables button if user doesn't have required permissions
 */
export const PermissionButton = ({ 
  children, 
  portal, 
  pageId = null, 
  roles = null, 
  disabled = false,
  className = '',
  disabledClassName = 'opacity-50 cursor-not-allowed',
  title,
  ...props 
}) => {
  const permissions = usePermissions(portal);
  
  const hasPermission = 
    (!roles || permissions.hasRole(roles)) &&
    permissions.hasPortalAccess(portal) &&
    (!pageId || permissions.hasPageAccess(pageId));

  const isDisabled = disabled || !hasPermission;
  const buttonTitle = !hasPermission ? 'Insufficient permissions' : title;
  
  return (
    <button
      {...props}
      disabled={isDisabled}
      title={buttonTitle}
      className={`${className} ${isDisabled ? disabledClassName : ''}`}
    >
      {children}
    </button>
  );
};

export default PermissionGuard;