import React, { useMemo, useState, useEffect } from 'react'
import { FiEye, FiEyeOff, FiAlertTriangle } from 'react-icons/fi'
import { usersAPI } from '../../services/api'

const ROLES = ['Reception', 'Pharmacy', 'Lab', 'Doctor', 'Shop', 'Admin']

export default function Users(){
  const [users, setUsers] = useState([])
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [form, setForm] = useState({ id: null, name: '', email: '', role: 'Reception', username: '', password: '' })
  const [showDialog, setShowDialog] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [userToDelete, setUserToDelete] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Load users from API on component mount
  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await usersAPI.getAll()
      if (response && response.data) {
        setUsers(response.data)
      }
    } catch (err) {
      console.error('Error loading users:', err)
      setError('Failed to load users. Please try again.')
      // Fallback to localStorage if API fails
      const storedUsers = localStorage.getItem('admin_users')
      if (storedUsers) {
        setUsers(JSON.parse(storedUsers))
      }
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(()=> users.filter(u =>
    (role ? u.role===role : true) &&
    (q ? (u.name+u.email+u.username).toLowerCase().includes(q.toLowerCase()) : true)
  ), [users, q, role])

  const reset = () => {
    setForm({ id: null, name: '', email: '', role: 'Reception', username: '', password: '' })
    setShowDialog(false)
  }

  const openAddDialog = () => {
    reset()
    setShowDialog(true)
  }

  const openEditDialog = (user) => {
    setForm({
      id: user.id || user._id,
      name: user.name || '',
      email: user.email || '',
      role: user.role || 'Reception',
      username: user.username || '',
      password: user.password || '' // Show existing password
    })
    setShowDialog(true)
  }

  const save = async (e) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.username) return
    
    try {
      setLoading(true)
      setError(null)
      
      if (form.id) {
        // Update existing user - send all fields including username and password
        await usersAPI.update(form.username, {
          username: form.username,
          name: form.name,
          email: form.email,
          role: form.role.toLowerCase(),
          password: form.password
        })
      } else {
        // Create new user
        if (!form.password) {
          setError('Password is required for new users')
          return
        }
        await usersAPI.create({
          username: form.username,
          password: form.password,
          name: form.name,
          email: form.email,
          role: form.role.toLowerCase(),
          isActive: true
        })
      }
      
      // Reload users from API
      await loadUsers()
      reset()
    } catch (err) {
      console.error('Error saving user:', err)
      setError(err.message || 'Failed to save user. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const confirmDelete = (user) => {
    setUserToDelete(user)
    setShowDeleteConfirm(true)
  }

  const deleteUser = async () => {
    if (!userToDelete) return
    
    try {
      setLoading(true)
      setError(null)
      await usersAPI.delete(userToDelete.username)
      
      // Reload users from API
      await loadUsers()
      setShowDeleteConfirm(false)
      setUserToDelete(null)
    } catch (err) {
      console.error('Error deleting user:', err)
      setError(err.message || 'Failed to delete user. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-indigo-800 mb-6">User Management</h1>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center">
            <FiAlertTriangle className="h-5 w-5 mr-2" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}

      {/* Loading Indicator */}
      {loading && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg flex items-center">
          <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Loading...</span>
        </div>
      )}

      <div className="grid md:grid-cols-1 gap-4">
        <div className="rounded-2xl bg-white shadow-lg ring-1 ring-slate-200/70 p-6">
          <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between mb-6">
            <div className="text-lg font-semibold text-indigo-700 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              All Users <span className="ml-2 bg-indigo-100 text-indigo-800 text-xs py-1 px-2 rounded-full">{filtered.length}</span>
            </div>
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={openAddDialog} 
                className="px-4 h-10 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-500 text-white font-medium shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 flex items-center cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Add User
              </button>
              <div className="relative">
                <input 
                  className="h-10 pl-9 pr-3 w-48 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 outline-none transition-all duration-200" 
                  placeholder="Search users..." 
                  value={q} 
                  onChange={e=>setQ(e.target.value)} 
                />
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400 absolute left-2 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <select 
                className="h-10 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 outline-none bg-white" 
                value={role} 
                onChange={e=>setRole(e.target.value)}
              >
                <option value="">All Roles</option>
                {ROLES.map(r=> <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl shadow-sm border border-slate-200">
            <table className="min-w-full text-sm bg-white">
              <thead>
                <tr className="bg-gradient-to-r from-indigo-50 to-blue-50 text-left text-indigo-700">
                  <th className="py-3 px-4 font-semibold">Name</th>
                  <th className="py-3 px-4 font-semibold">Email</th>
                  <th className="py-3 px-4 font-semibold">Role</th>
                  <th className="py-3 px-4 font-semibold">Username</th>
                  <th className="py-3 px-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, index)=> (
                  <tr key={u.id || u._id || u.username || index} className={`border-t border-slate-100 hover:bg-slate-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                    <td className="py-3 px-4 font-medium text-slate-700">{u.name}</td>
                    <td className="py-3 px-4 text-slate-600">{u.email}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${u.role === 'Admin' ? 'bg-purple-100 text-purple-800' : 
                          u.role === 'Reception' ? 'bg-blue-100 text-blue-800' : 
                          u.role === 'Pharmacy' ? 'bg-green-100 text-green-800' : 
                          u.role === 'Lab' ? 'bg-yellow-100 text-yellow-800' : 
                          u.role === 'Doctor' ? 'bg-emerald-100 text-emerald-800' :
                          'bg-pink-100 text-pink-800'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{u.username}</td>
                    <td className="py-3 px-4 flex gap-2">
                      <button 
                        onClick={()=>openEditDialog(u)} 
                        className="px-3 h-8 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors flex items-center cursor-pointer"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                        Edit
                      </button>
                      <button 
                        onClick={()=>confirmDelete(u)} 
                        className="px-3 h-8 rounded-md bg-red-50 text-red-700 hover:bg-red-100 transition-colors flex items-center cursor-pointer"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && userToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 mx-4 border border-red-100">
            <div className="flex items-center mb-4 text-red-600">
              <FiAlertTriangle className="h-6 w-6 mr-2" />
              <h2 className="text-xl font-bold">Confirm Delete</h2>
            </div>
            
            <p className="mb-6 text-slate-700">
              Are you sure you want to delete user <span className="font-semibold">{userToDelete.name}</span>? This action cannot be undone.
            </p>
            
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowDeleteConfirm(false)} 
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={deleteUser} 
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-all flex items-center cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Dialog */}
      {showDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 mx-4 border border-indigo-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-indigo-800 flex items-center">
                {form.id ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit User
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    Add New User
                  </>
                )}
              </h2>
              <button 
                type="button" 
                onClick={reset} 
                className="grid place-items-center h-8 w-8 rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <form onSubmit={save} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-indigo-700 mb-1">Full Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input 
                    className="w-full h-11 pl-10 pr-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 outline-none transition-all" 
                    placeholder="Enter full name" 
                    value={form.name} 
                    onChange={e=>setForm(s=>({...s, name:e.target.value}))}
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-indigo-700 mb-1">Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <input 
                    type="email"
                    className="w-full h-11 pl-10 pr-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 outline-none transition-all" 
                    placeholder="Enter email address" 
                    value={form.email} 
                    onChange={e=>setForm(s=>({...s, email:e.target.value}))}
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-indigo-700 mb-1">Role</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <select 
                    className="w-full h-11 pl-10 pr-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 outline-none transition-all appearance-none bg-white" 
                    value={form.role} 
                    onChange={e=>setForm(s=>({...s, role:e.target.value}))}
                    required
                  >
                    {ROLES.map(r=> <option key={r} value={r}>{r}</option>)}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-indigo-700 mb-1">Username</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </div>
                  <input 
                    className="w-full h-11 pl-10 pr-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 outline-none transition-all" 
                    placeholder="Enter username" 
                    value={form.username} 
                    onChange={e=>setForm(s=>({...s, username:e.target.value}))}
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-indigo-700 mb-1">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input 
                    type={showPassword ? "text" : "password"}
                    className="w-full h-11 pl-10 pr-10 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-300 focus:border-indigo-500 outline-none transition-all" 
                    placeholder="Enter password" 
                    value={form.password} 
                    onChange={e=>setForm(s=>({...s, password:e.target.value}))}
                    required
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)} 
                    className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center h-8 w-8 rounded-full text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 transition-all"
                  >
                    {showPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-8">
                <button 
                  type="button" 
                  onClick={reset} 
                  className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-500 text-white hover:shadow-lg transition-all flex items-center cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                    {form.id ? (
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    ) : (
                      <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                    )}
                  </svg>
                  {form.id ? 'Update User' : 'Add User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
