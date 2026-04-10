import React, { useEffect, useState, useMemo } from 'react'
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiUser, FiMail, FiPhone, FiMapPin } from 'react-icons/fi'
import { useAlert } from '../../../context/AlertContext'

const emptyForm = {
  id: null,
  staffId: '',
  name: '',
  email: '',
  phone: '',
  department: '',
  designation: '',
  joiningDate: '',
  salary: '',
  address: '',
  emergencyContact: '',
  status: 'Active'
}

export default function StaffManagement() {
  const { success, confirm } = useAlert()
  const [staff, setStaff] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [showDialog, setShowDialog] = useState(false)
  const [query, setQuery] = useState('')
  const [filterDepartment, setFilterDepartment] = useState('')

  useEffect(() => {
    loadStaff()
  }, [])

  const loadStaff = () => {
    try {
      const stored = JSON.parse(localStorage.getItem('staff_members') || '[]')
      setStaff(stored)
    } catch (error) {
      console.error('Error loading staff:', error)
    }
  }

  const saveStaff = (staffList) => {
    localStorage.setItem('staff_members', JSON.stringify(staffList))
    setStaff(staffList)
  }

  const departments = useMemo(() => {
    const depts = new Set(staff.map(s => s.department).filter(Boolean))
    return Array.from(depts).sort()
  }, [staff])

  const filtered = useMemo(() => {
    let result = staff
    
    if (filterDepartment) {
      result = result.filter(s => s.department === filterDepartment)
    }
    
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      result = result.filter(s =>
        [s.name, s.staffId, s.email, s.phone, s.department, s.designation]
          .some(v => String(v || '').toLowerCase().includes(q))
      )
    }
    
    return result
  }, [staff, query, filterDepartment])

  const openDialog = (member = null) => {
    if (member) {
      setForm({ ...member, id: member._id || member.staffId })
    } else {
      setForm({ ...emptyForm, staffId: `STAFF-${Date.now()}` })
    }
    setShowDialog(true)
  }

  const closeDialog = () => {
    setShowDialog(false)
    setForm(emptyForm)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    const payload = {
      staffId: form.staffId,
      name: form.name,
      email: form.email,
      phone: form.phone,
      department: form.department,
      designation: form.designation,
      joiningDate: form.joiningDate,
      salary: form.salary,
      address: form.address,
      emergencyContact: form.emergencyContact,
      status: form.status,
      createdAt: form.createdAt || new Date().toISOString()
    }

    if (form.id) {
      // Update existing
      const updated = staff.map(s => 
        (s.staffId === form.staffId || s._id === form.id) ? payload : s
      )
      saveStaff(updated)
      success('Staff member updated successfully!')
    } else {
      // Add new
      saveStaff([...staff, payload])
      success('Staff member added successfully!')
    }

    closeDialog()
  }

  const handleDelete = async (member) => {
    const confirmed = await confirm(
      `Are you sure you want to delete ${member.name}? This action cannot be undone.`,
      {
        title: 'Delete Staff Member',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        type: 'danger'
      }
    )

    if (confirmed) {
      const updated = staff.filter(s => s.staffId !== member.staffId)
      saveStaff(updated)
      success('Staff member deleted successfully!')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-indigo-800">Staff Management</h1>
          <p className="text-slate-600">Manage all staff members and their information</p>
        </div>
        <button
          onClick={() => openDialog()}
          className="h-11 px-5 rounded-xl bg-indigo-600 text-white flex items-center gap-2 shadow hover:bg-indigo-700"
        >
          <FiPlus /> Add Staff Member
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search staff..."
              className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-300 bg-white"
            />
          </div>
          <select
            value={filterDepartment}
            onChange={e => setFilterDepartment(e.target.value)}
            className="h-11 px-4 rounded-xl border border-slate-300 bg-white"
          >
            <option value="">All Departments</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="font-semibold">{filtered.length}</span> staff members
          </div>
        </div>
      </div>

      {/* Staff Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(member => (
          <div
            key={member.staffId}
            className="bg-white rounded-2xl border-2 border-slate-200 hover:border-indigo-300 p-6 transition-all hover:shadow-lg"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <FiUser className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="font-bold text-slate-800">{member.name}</div>
                  <div className="text-xs text-slate-500">{member.staffId}</div>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                member.status === 'Active' 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-red-100 text-red-700'
              }`}>
                {member.status}
              </span>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <FiUser className="w-4 h-4" />
                <span>{member.designation || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <FiMapPin className="w-4 h-4" />
                <span>{member.department || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <FiPhone className="w-4 h-4" />
                <span>{member.phone || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <FiMail className="w-4 h-4" />
                <span className="truncate">{member.email || 'N/A'}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => openDialog(member)}
                className="flex-1 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center gap-1 hover:bg-blue-100"
              >
                <FiEdit2 className="w-4 h-4" /> Edit
              </button>
              <button
                onClick={() => handleDelete(member)}
                className="flex-1 px-3 py-2 rounded-lg bg-red-50 text-red-600 flex items-center justify-center gap-1 hover:bg-red-100"
              >
                <FiTrash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-500">
            No staff members found
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-slate-800">
                {form.id ? 'Edit Staff Member' : 'Add Staff Member'}
              </h2>
              <button onClick={closeDialog} className="text-slate-500 text-2xl leading-none">×</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Staff ID</label>
                  <input
                    value={form.staffId}
                    readOnly
                    className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Full Name *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full h-11 px-3 rounded-xl border border-slate-300"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full h-11 px-3 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Phone *</label>
                  <input
                    value={form.phone}
                    onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full h-11 px-3 rounded-xl border border-slate-300"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Department *</label>
                  <input
                    value={form.department}
                    onChange={e => setForm(prev => ({ ...prev, department: e.target.value }))}
                    className="w-full h-11 px-3 rounded-xl border border-slate-300"
                    placeholder="e.g., Reception, Pharmacy, Lab"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Designation *</label>
                  <input
                    value={form.designation}
                    onChange={e => setForm(prev => ({ ...prev, designation: e.target.value }))}
                    className="w-full h-11 px-3 rounded-xl border border-slate-300"
                    placeholder="e.g., Receptionist, Pharmacist"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Joining Date</label>
                  <input
                    type="date"
                    value={form.joiningDate}
                    onChange={e => setForm(prev => ({ ...prev, joiningDate: e.target.value }))}
                    className="w-full h-11 px-3 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Salary</label>
                  <input
                    type="number"
                    value={form.salary}
                    onChange={e => setForm(prev => ({ ...prev, salary: e.target.value }))}
                    className="w-full h-11 px-3 rounded-xl border border-slate-300"
                    placeholder="Monthly salary"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Emergency Contact</label>
                  <input
                    value={form.emergencyContact}
                    onChange={e => setForm(prev => ({ ...prev, emergencyContact: e.target.value }))}
                    className="w-full h-11 px-3 rounded-xl border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full h-11 px-3 rounded-xl border border-slate-300"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-1">Address</label>
                <textarea
                  value={form.address}
                  onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="px-4 h-11 rounded-xl border border-slate-300 text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 h-11 rounded-xl bg-indigo-600 text-white font-semibold"
                >
                  {form.id ? 'Update' : 'Add'} Staff Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
