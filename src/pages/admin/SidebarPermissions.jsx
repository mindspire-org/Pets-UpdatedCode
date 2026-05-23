import React, { useState, useEffect } from 'react';
import { usersAPI, sidebarConfigAPI } from '../../services/api';
import { useAlert } from '../../context/AlertContext';
import { FiShield, FiCheckCircle, FiXCircle, FiSave, FiAlertCircle, FiChevronRight, FiChevronDown, FiSearch, FiLayout, FiActivity, FiUser, FiSettings, FiGlobe, FiLock } from 'react-icons/fi';

export default function SidebarPermissions() {
  const { success: showToast, error: showErrorToast } = useAlert();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [portalAccess, setPortalAccess] = useState([]);
  const [portals, setPortals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [expandedPortals, setExpandedPortals] = useState(['admin']);

  useEffect(() => {
    loadUsers();
    loadPortals();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await usersAPI.getAll();
      if (res.success) {
        setUsers(res.data);
      }
    } catch (err) {
      console.error('Error loading users:', err);
      setMessage({ type: 'error', text: 'Failed to load users' });
    } finally {
      setLoading(false);
    }
  };

  const loadPortals = async () => {
    try {
      const res = await sidebarConfigAPI.getAll();
      if (res.success) {
        const formatted = (res.data || []).map((cfg) => {
          const groups = (cfg.groups || [])
            .slice()
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .map((g) => ({
              id: g.id,
              title: g.title,
              order: g.order,
              pages: (g.items || [])
                .slice()
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map((it) => ({ id: it.id, name: it.label }))
            }));
          return { id: cfg.portalId, name: cfg.name, groups };
        });
        setPortals(formatted);
      }
    } catch (err) {
      console.error('Error loading portals:', err);
      setMessage({ type: 'error', text: 'Failed to load portal sidebar definitions' });
    }
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    // Initialize permissions from user data or empty object
    const userPerms = user.sidebarPermissions || {};
    const userPortalAccess = user.portalAccess || [];
    
    // Ensure all portals are represented as arrays
    const formattedPerms = {};
    portals.forEach(portal => {
      formattedPerms[portal.id] = userPerms[portal.id] || [];
    });
    
    setPermissions(formattedPerms);
    setPortalAccess(userPortalAccess);
    setMessage({ type: '', text: '' });
  };

  const togglePortalAccess = (portalId) => {
    setPortalAccess(prev => {
      const updated = prev.includes(portalId)
        ? prev.filter(id => id !== portalId)
        : [...prev, portalId];
      
      // If adding portal access, grant some default pages or use quick setup
      // If removing portal access, also remove all page permissions for that portal
      if (!updated.includes(portalId)) {
        setPermissions(prevPerms => ({
          ...prevPerms,
          [portalId]: []
        }));
      }
      
      return updated;
    });
  };

  const togglePermission = (portalId, pageId) => {
    // Can only modify page permissions if user has portal access
    if (!portalAccess.includes(portalId)) {
      setMessage({ type: 'error', text: `Grant ${portals.find(p => p.id === portalId)?.name} portal access first` });
      return;
    }
    
    setPermissions(prev => {
      const current = prev[portalId] || [];
      const updated = current.includes(pageId)
        ? current.filter(id => id !== pageId)
        : [...current, pageId];
      return { ...prev, [portalId]: updated };
    });
  };

  const togglePortalAll = (portalId, grantAll) => {
    // Can only modify if user has portal access
    if (!portalAccess.includes(portalId)) {
      setMessage({ type: 'error', text: `Grant ${portals.find(p => p.id === portalId)?.name} portal access first` });
      return;
    }
    
    const portal = portals.find(p => p.id === portalId);
    if (!portal) return;

    const allPageIds = portal.groups.flatMap(g => g.pages.map(p => p.id));
    setPermissions(prev => ({
      ...prev,
      [portalId]: grantAll ? allPageIds : []
    }));
  };

  const togglePortalExpanded = (portalId) => {
    setExpandedPortals(prev =>
      prev.includes(portalId)
        ? prev.filter(id => id !== portalId)
        : [...prev, portalId]
    );
  };

  const isPortalExpanded = (portalId) => expandedPortals.includes(portalId);

  const handleQuickSetup = async () => {
    if (!selectedUser) return;
    
    try {
      setSaving(true);
      
      // Get default permissions for user's role
      const response = await fetch('/api/users/quick-setup-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: selectedUser.username,
          role: selectedUser.role
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setPermissions(data.sidebarPermissions);
        setPortalAccess(data.portalAccess);
        showToast('Default permissions applied successfully');
      } else {
        // Fallback to client-side default assignment
        const roleDefaults = {
          admin: {
            portalAccess: ['admin', 'reception', 'doctor', 'lab', 'pharmacy', 'shop'],
            sidebarPermissions: {
              admin: ['dashboard', 'pets', 'clients', 'inventory', 'hospital-inventory', 'financials', 'finance-center', 'accounting-overview', 'chart-of-accounts', 'vouchers', 'petty-cash', 'suppliers', 'receivables', 'payables', 'vendor-payments', 'budget-planner', 'staff-advances', 'day-sessions', 'expenses', 'doctors', 'staff', 'users', 'sidebar-permissions', 'logs', 'settings'],
              reception: ['dashboard', 'pets', 'clients', 'appointments', 'visits', 'billing', 'reports', 'forms', 'procedures', 'settings'],
              doctor: ['dashboard', 'medicines', 'prescription', 'medical-forms', 'medical-forms-history', 'details', 'patients', 'settings'],
              lab: ['dashboard', 'catalog', 'requests', 'add-report', 'reports', 'inventory', 'sample-intake', 'radiology', 'suppliers', 'settings'],
              pharmacy: ['dashboard', 'pos', 'credit-customers', 'medicines', 'suppliers', 'companies', 'purchase-orders', 'sales-history', 'purchase-history', 'return-history', 'sales-return', 'supplier-returns', 'referrals', 'prescriptions', 'reports', 'notifications', 'audit-logs', 'expenses', 'settings'],
              shop: ['dashboard', 'products', 'pos', 'suppliers', 'companies', 'reports', 'settings']
            }
          },
          pharmacy: {
            portalAccess: ['pharmacy'],
            sidebarPermissions: {
              pharmacy: ['dashboard', 'pos', 'credit-customers', 'medicines', 'suppliers', 'companies', 'purchase-orders', 'sales-history', 'purchase-history', 'return-history', 'sales-return', 'supplier-returns', 'referrals', 'prescriptions', 'reports', 'notifications', 'audit-logs', 'expenses', 'settings']
            }
          },
          reception: {
            portalAccess: ['reception'],
            sidebarPermissions: {
              reception: ['dashboard', 'pets', 'clients', 'appointments', 'visits', 'billing', 'reports', 'forms', 'procedures', 'settings']
            }
          },
          doctor: {
            portalAccess: ['doctor'],
            sidebarPermissions: {
              doctor: ['dashboard', 'medicines', 'prescription', 'medical-forms', 'medical-forms-history', 'details', 'patients', 'settings']
            }
          },
          lab: {
            portalAccess: ['lab'],
            sidebarPermissions: {
              lab: ['dashboard', 'catalog', 'requests', 'add-report', 'reports', 'inventory', 'sample-intake', 'radiology', 'suppliers', 'settings']
            }
          },
          shop: {
            portalAccess: ['shop'],
            sidebarPermissions: {
              shop: ['dashboard', 'products', 'pos', 'suppliers', 'companies', 'reports', 'settings']
            }
          }
        };
        
        const defaults = roleDefaults[selectedUser.role.toLowerCase()];
        if (defaults) {
          setPortalAccess(defaults.portalAccess);
          setPermissions(defaults.sidebarPermissions);
          showToast('Default permissions applied successfully');
        }
      }
    } catch (err) {
      console.error('Error applying quick setup:', err);
      showErrorToast('Failed to apply default permissions');
    } finally {
      setSaving(false);
    }
  };
  const handleForceRefresh = async () => {
    if (!selectedUser) return;
    
    try {
      // Send a signal to force user logout (this would need backend implementation)
      // For now, we'll show a message to admin
      setMessage({ 
        type: 'success', 
        text: `Permissions updated for ${selectedUser.username}. User will need to log out and log back in to see changes.` 
      });
    } catch (err) {
      console.error('Error forcing refresh:', err);
    }
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    try {
      setSaving(true);
      const res = await usersAPI.updatePermissions(selectedUser.username, permissions, portalAccess);
      if (res.success) {
        showToast('Permissions updated successfully. User needs to log out and log back in to see changes.');
        // Update user in the list
        setUsers(users.map(u => u.username === selectedUser.username ? { 
          ...u, 
          sidebarPermissions: permissions,
          portalAccess: portalAccess
        } : u));
        setSelectedUser(prev => ({
          ...prev,
          sidebarPermissions: permissions,
          portalAccess: portalAccess
        }));
      }
    } catch (err) {
      console.error('Error saving permissions:', err);
      showErrorToast('Failed to update permissions');
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleColor = (role) => {
    const colors = {
      admin: 'bg-purple-100 text-purple-700',
      reception: 'bg-blue-100 text-blue-700',
      pharmacy: 'bg-green-100 text-green-700',
      lab: 'bg-yellow-100 text-yellow-700',
      doctor: 'bg-emerald-100 text-emerald-700',
      shop: 'bg-pink-100 text-pink-700'
    };
    return colors[role?.toLowerCase()] || 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">User Permissions Management</h1>
          <p className="text-slate-500 mt-1">Manage portal access and granular sidebar permissions for each user</p>
        </div>
        
        {selectedUser && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleQuickSetup}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all disabled:opacity-50"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Quick Setup
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50"
            >
              {saving ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <FiSave />
              )}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl flex items-center gap-3 ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
        }`}>
          {message.type === 'success' ? <FiCheckCircle /> : <FiAlertCircle />}
          <span className="font-medium">{message.text}</span>
          <button 
            onClick={() => setMessage({ type: '', text: '' })}
            className="ml-auto text-current opacity-60 hover:opacity-100"
          >
            <FiXCircle />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* User Selection List */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            
            <div className="max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-slate-400">
                  <div className="inline-block h-8 w-8 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin mb-2" />
                  <p className="text-sm">Loading users...</p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <FiUser className="mx-auto text-3xl mb-2 opacity-20" />
                  <p className="text-sm">No users found</p>
                </div>
              ) : (
                filteredUsers.map(user => (
                  <button
                    key={user._id}
                    onClick={() => handleSelectUser(user)}
                    className={`w-full p-4 flex items-center gap-3 text-left transition-all border-b border-slate-50 last:border-0 ${
                      selectedUser?.username === user.username 
                        ? 'bg-indigo-50 border-l-4 border-l-indigo-600' 
                        : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center text-lg font-bold shadow-sm ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {user.name?.charAt(0) || user.username?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-800 truncate">{user.name || user.username}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${getRoleColor(user.role)}`}>
                          {user.role}
                        </span>
                        <span className="text-xs text-slate-400 truncate">{user.username}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <FiGlobe className="h-3 w-3 text-slate-400" />
                        <span className="text-xs text-slate-500">
                          {user.portalAccess?.length || 0} portal{(user.portalAccess?.length || 0) !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <FiChevronRight className={`text-slate-300 transition-transform ${selectedUser?.username === user.username ? 'translate-x-1 text-indigo-400' : ''}`} />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Permissions Configuration */}
        <div className="lg:col-span-8">
          {!selectedUser ? (
            <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-20 text-center">
              <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <FiShield className="text-4xl text-slate-300" />
              </div>
              <h2 className="text-xl font-bold text-slate-700 mb-2">Select a User</h2>
              <p className="text-slate-500 max-w-xs mx-auto">Choose a user from the list to manage their portal access and sidebar permissions</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* User Info Header */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
                  <div className="h-16 w-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-2xl font-bold shadow-lg shadow-indigo-100">
                    {selectedUser.name?.charAt(0) || selectedUser.username?.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-slate-800">{selectedUser.name || selectedUser.username}</h2>
                    <p className="text-slate-500 flex items-center gap-2">
                      <FiActivity className="text-indigo-500" />
                      Role: <span className={`font-semibold capitalize px-2 py-1 rounded text-xs ${getRoleColor(selectedUser.role)}`}>{selectedUser.role}</span>
                    </p>
                    {(!selectedUser.portalAccess || selectedUser.portalAccess.length === 0) && (
                      <div className="mt-2 flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1 rounded-lg text-sm">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <span className="font-medium">No permissions set - use Quick Setup or configure manually</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Portal Access Section */}
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <FiGlobe className="text-indigo-500" />
                    Portal Access
                  </h3>
                  <p className="text-sm text-slate-500 mb-4">Select which portals this user can access</p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {portals.map(portal => (
                      <button
                        key={portal.id}
                        onClick={() => togglePortalAccess(portal.id)}
                        className={`p-3 rounded-xl border transition-all text-sm font-medium flex items-center justify-between ${
                          portalAccess.includes(portal.id)
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                            : 'bg-slate-50/50 border-slate-100 text-slate-500 hover:bg-slate-100 hover:border-slate-200'
                        }`}
                      >
                        <span className="capitalize">{portal.name}</span>
                        {portalAccess.includes(portal.id) ? (
                          <FiCheckCircle className="text-indigo-600" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border border-slate-300 bg-white" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Page Permissions Section */}
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <FiLock className="text-indigo-500" />
                    Page Permissions
                  </h3>
                  <p className="text-sm text-slate-500 mb-4">Configure specific page access within each portal</p>
                </div>
              </div>

              {/* Portal Permissions */}
              <div className="space-y-4">
                {portals.map(portal => (
                  <div key={portal.id} className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm bg-white">
                    <div 
                      className={`p-4 flex items-center justify-between cursor-pointer transition-colors ${
                        isPortalExpanded(portal.id) ? 'bg-slate-50' : 'bg-white hover:bg-slate-50/50'
                      } ${!portalAccess.includes(portal.id) ? 'opacity-50' : ''}`}
                      onClick={() => togglePortalExpanded(portal.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                          portalAccess.includes(portal.id) 
                            ? permissions[portal.id]?.length > 0 
                              ? 'bg-indigo-100 text-indigo-600' 
                              : 'bg-amber-100 text-amber-600'
                            : 'bg-slate-100 text-slate-400'
                        }`}>
                          {portalAccess.includes(portal.id) ? <FiLayout /> : <FiLock />}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            {portal.name}
                            {!portalAccess.includes(portal.id) && (
                              <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium">
                                No Access
                              </span>
                            )}
                          </h3>
                          <p className="text-xs text-slate-400">
                            {portalAccess.includes(portal.id) 
                              ? `${permissions[portal.id]?.length || 0} of ${portal.groups.flatMap(g => g.pages).length} pages enabled`
                              : 'Portal access required'
                            }
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4" onClick={e => e.stopPropagation()}>
                        {portalAccess.includes(portal.id) && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => togglePortalAll(portal.id, true)}
                              className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded bg-indigo-50 transition-colors"
                            >
                              Grant All
                            </button>
                            <button
                              onClick={() => togglePortalAll(portal.id, false)}
                              className="text-[10px] font-bold uppercase tracking-wider text-rose-600 hover:text-rose-700 px-2 py-1 rounded bg-rose-50 transition-colors"
                            >
                              Revoke All
                            </button>
                          </div>
                        )}
                        <div className={`transition-transform duration-200 ${isPortalExpanded(portal.id) ? 'rotate-180' : ''}`}>
                          <FiChevronDown className="text-slate-400" />
                        </div>
                      </div>
                    </div>

                    {isPortalExpanded(portal.id) && (
                      <div className={`p-6 bg-white border-t border-slate-100 space-y-6 ${!portalAccess.includes(portal.id) ? 'opacity-50' : ''}`}>
                        {!portalAccess.includes(portal.id) && (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                            <FiLock className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                            <p className="text-amber-700 font-medium">Portal access required</p>
                            <p className="text-amber-600 text-sm">Enable portal access above to configure page permissions</p>
                          </div>
                        )}
                        
                        {portal.groups.map(group => (
                          <div key={group.id}>
                            {group.title && (
                              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] mb-3">
                                {group.title}
                              </h4>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {group.pages.map(page => (
                                <button
                                  key={page.id}
                                  onClick={() => togglePermission(portal.id, page.id)}
                                  disabled={!portalAccess.includes(portal.id)}
                                  className={`flex items-center justify-between p-3 rounded-xl border transition-all text-sm font-medium ${
                                    permissions[portal.id]?.includes(page.id)
                                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                                      : 'bg-slate-50/50 border-slate-100 text-slate-500 hover:bg-slate-100 hover:border-slate-200'
                                  } ${!portalAccess.includes(portal.id) ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                  <span>{page.name}</span>
                                  {permissions[portal.id]?.includes(page.id) ? (
                                    <FiCheckCircle className="text-indigo-600" />
                                  ) : (
                                    <div className="h-4 w-4 rounded-full border border-slate-300 bg-white" />
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}