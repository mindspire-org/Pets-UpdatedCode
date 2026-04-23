import React, { useState, useEffect } from 'react';
import { usersAPI, sidebarConfigAPI } from '../../services/api';
import { FiShield, FiCheckCircle, FiXCircle, FiSave, FiAlertCircle, FiChevronRight, FiChevronDown, FiSearch, FiLayout, FiActivity, FiUser, FiSettings } from 'react-icons/fi';

export default function SidebarPermissions() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [permissions, setPermissions] = useState({});
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
          const pages = (cfg.groups || []).flatMap((g) => (g.items || []).map((it) => ({ id: it.id, name: it.label })));
          return { id: cfg.portalId, name: cfg.name, pages };
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
    // Ensure all portals are represented as arrays
    const formattedPerms = {};
    portals.forEach(portal => {
      formattedPerms[portal.id] = userPerms[portal.id] || [];
    });
    setPermissions(formattedPerms);
    setMessage({ type: '', text: '' });
  };

  const togglePermission = (portalId, pageId) => {
    setPermissions(prev => {
      const current = prev[portalId] || [];
      const updated = current.includes(pageId)
        ? current.filter(id => id !== pageId)
        : [...current, pageId];
      return { ...prev, [portalId]: updated };
    });
  };

  const togglePortalAll = (portalId, grantAll) => {
    const portal = portals.find(p => p.id === portalId);
    if (!portal) return;

    setPermissions(prev => ({
      ...prev,
      [portalId]: grantAll ? portal.pages.map(p => p.id) : []
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

  const handleSave = async () => {
    if (!selectedUser) return;
    try {
      setSaving(true);
      const res = await usersAPI.updatePermissions(selectedUser.username, permissions);
      if (res.success) {
        setMessage({ type: 'success', text: 'Permissions updated successfully' });
        // Update user in the list
        setUsers(users.map(u => u.username === selectedUser.username ? { ...u, sidebarPermissions: permissions } : u));
      }
    } catch (err) {
      console.error('Error saving permissions:', err);
      setMessage({ type: 'error', text: 'Failed to update permissions' });
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Sidebar Permissions</h1>
          <p className="text-slate-500 mt-1">Manage granular access to sidebar pages for each portal</p>
        </div>
        
        {selectedUser && (
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
        )}
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl flex items-center gap-3 ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
        }`}>
          {message.type === 'success' ? <FiCheckCircle /> : <FiAlertCircle />}
          <span className="font-medium">{message.text}</span>
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
                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                          user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {user.role}
                        </span>
                        <span className="text-xs text-slate-400 truncate">{user.username}</span>
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
              <p className="text-slate-500 max-w-xs mx-auto">Choose a user from the list to manage their portal and sidebar access permissions</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
                  <div className="h-16 w-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-2xl font-bold shadow-lg shadow-indigo-100">
                    {selectedUser.name?.charAt(0) || selectedUser.username?.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">{selectedUser.name || selectedUser.username}</h2>
                    <p className="text-slate-500 flex items-center gap-2">
                      <FiActivity className="text-indigo-500" />
                      Role: <span className="font-semibold capitalize">{selectedUser.role}</span>
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  {portals.map(portal => (
                    <div key={portal.id} className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                      <div 
                        className={`p-4 flex items-center justify-between cursor-pointer transition-colors ${
                          isPortalExpanded(portal.id) ? 'bg-slate-50' : 'bg-white hover:bg-slate-50/50'
                        }`}
                        onClick={() => togglePortalExpanded(portal.id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                            permissions[portal.id]?.length > 0 ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'
                          }`}>
                            <FiLayout />
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-800">{portal.name}</h3>
                            <p className="text-xs text-slate-400">
                              {permissions[portal.id]?.length || 0} of {portal.pages.length} pages enabled
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4" onClick={e => e.stopPropagation()}>
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
                          <div className={`transition-transform duration-200 ${isPortalExpanded(portal.id) ? 'rotate-180' : ''}`}>
                            <FiChevronDown className="text-slate-400" />
                          </div>
                        </div>
                      </div>

                      {isPortalExpanded(portal.id) && (
                        <div className="p-6 bg-white border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {portal.pages.map(page => (
                            <button
                              key={page.id}
                              onClick={() => togglePermission(portal.id, page.id)}
                              className={`flex items-center justify-between p-3 rounded-xl border transition-all text-sm font-medium ${
                                permissions[portal.id]?.includes(page.id)
                                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                                  : 'bg-slate-50/50 border-slate-100 text-slate-500 hover:bg-slate-100 hover:border-slate-200'
                              }`}
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
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
