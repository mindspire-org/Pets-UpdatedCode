import React, { useState, useEffect } from 'react'
import { FiSave, FiPlus, FiTrash2 } from 'react-icons/fi'
import { useAlert } from '../../../context/AlertContext'

export default function StaffSettings() {
  const { success, error } = useAlert()
  const [settings, setSettings] = useState({
    departments: [],
    shifts: [],
    leaveTypes: [],
    workingHours: {
      start: '09:00',
      end: '17:00'
    },
    weeklyHolidays: ['Sunday'],
    overtimeRate: 1.5,
    lateArrivalGrace: 15
  })

  const [newDepartment, setNewDepartment] = useState('')
  const [newShift, setNewShift] = useState({ name: '', start: '', end: '' })
  const [newLeaveType, setNewLeaveType] = useState({ name: '', days: '' })

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = () => {
    try {
      const stored = JSON.parse(localStorage.getItem('staff_settings') || '{}')
      setSettings({
        departments: stored.departments || ['Reception', 'Pharmacy', 'Laboratory', 'Nursing', 'Administration'],
        shifts: stored.shifts || [
          { name: 'Morning', start: '08:00', end: '16:00' },
          { name: 'Evening', start: '16:00', end: '00:00' },
          { name: 'Night', start: '00:00', end: '08:00' }
        ],
        leaveTypes: stored.leaveTypes || [
          { name: 'Sick Leave', days: 10 },
          { name: 'Casual Leave', days: 15 },
          { name: 'Annual Leave', days: 20 }
        ],
        workingHours: stored.workingHours || { start: '09:00', end: '17:00' },
        weeklyHolidays: stored.weeklyHolidays || ['Sunday'],
        overtimeRate: stored.overtimeRate || 1.5,
        lateArrivalGrace: stored.lateArrivalGrace || 15
      })
    } catch (error) {
      console.error('Error loading settings:', error)
    }
  }

  const saveSettings = () => {
    try {
      localStorage.setItem('staff_settings', JSON.stringify(settings))
      success('Settings saved successfully!')
    } catch (err) {
      console.error('Error saving settings:', err)
      error('Failed to save settings')
    }
  }

  const addDepartment = () => {
    if (newDepartment.trim()) {
      setSettings(prev => ({
        ...prev,
        departments: [...prev.departments, newDepartment.trim()]
      }))
      setNewDepartment('')
    }
  }

  const removeDepartment = (index) => {
    setSettings(prev => ({
      ...prev,
      departments: prev.departments.filter((_, i) => i !== index)
    }))
  }

  const addShift = () => {
    if (newShift.name && newShift.start && newShift.end) {
      setSettings(prev => ({
        ...prev,
        shifts: [...prev.shifts, newShift]
      }))
      setNewShift({ name: '', start: '', end: '' })
    }
  }

  const removeShift = (index) => {
    setSettings(prev => ({
      ...prev,
      shifts: prev.shifts.filter((_, i) => i !== index)
    }))
  }

  const addLeaveType = () => {
    if (newLeaveType.name && newLeaveType.days) {
      setSettings(prev => ({
        ...prev,
        leaveTypes: [...prev.leaveTypes, { ...newLeaveType, days: parseInt(newLeaveType.days) }]
      }))
      setNewLeaveType({ name: '', days: '' })
    }
  }

  const removeLeaveType = (index) => {
    setSettings(prev => ({
      ...prev,
      leaveTypes: prev.leaveTypes.filter((_, i) => i !== index)
    }))
  }

  const toggleHoliday = (day) => {
    setSettings(prev => ({
      ...prev,
      weeklyHolidays: prev.weeklyHolidays.includes(day)
        ? prev.weeklyHolidays.filter(d => d !== day)
        : [...prev.weeklyHolidays, day]
    }))
  }

  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-indigo-800">Staff Settings</h1>
          <p className="text-slate-600">Configure departments, shifts, and policies</p>
        </div>
        <button
          onClick={saveSettings}
          className="h-11 px-5 rounded-xl bg-green-600 text-white flex items-center gap-2 shadow hover:bg-green-700"
        >
          <FiSave /> Save Settings
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Departments */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Departments</h3>
          <div className="space-y-2 mb-4">
            {settings.departments.map((dept, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-700">{dept}</span>
                <button
                  onClick={() => removeDepartment(index)}
                  className="text-red-600 hover:text-red-700"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newDepartment}
              onChange={e => setNewDepartment(e.target.value)}
              placeholder="New department name"
              className="flex-1 h-10 px-3 rounded-lg border border-slate-300"
              onKeyPress={e => e.key === 'Enter' && addDepartment()}
            />
            <button
              onClick={addDepartment}
              className="h-10 px-4 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
            >
              <FiPlus />
            </button>
          </div>
        </div>

        {/* Shifts */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Shifts</h3>
          <div className="space-y-2 mb-4">
            {settings.shifts.map((shift, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <div className="font-semibold text-slate-700">{shift.name}</div>
                  <div className="text-sm text-slate-500">{shift.start} - {shift.end}</div>
                </div>
                <button
                  onClick={() => removeShift(index)}
                  className="text-red-600 hover:text-red-700"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <input
              value={newShift.name}
              onChange={e => setNewShift(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Shift name"
              className="w-full h-10 px-3 rounded-lg border border-slate-300"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="time"
                value={newShift.start}
                onChange={e => setNewShift(prev => ({ ...prev, start: e.target.value }))}
                className="h-10 px-3 rounded-lg border border-slate-300"
              />
              <input
                type="time"
                value={newShift.end}
                onChange={e => setNewShift(prev => ({ ...prev, end: e.target.value }))}
                className="h-10 px-3 rounded-lg border border-slate-300"
              />
            </div>
            <button
              onClick={addShift}
              className="w-full h-10 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
            >
              <FiPlus className="inline mr-2" /> Add Shift
            </button>
          </div>
        </div>

        {/* Leave Types */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Leave Types</h3>
          <div className="space-y-2 mb-4">
            {settings.leaveTypes.map((leave, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <div className="font-semibold text-slate-700">{leave.name}</div>
                  <div className="text-sm text-slate-500">{leave.days} days per year</div>
                </div>
                <button
                  onClick={() => removeLeaveType(index)}
                  className="text-red-600 hover:text-red-700"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <input
              value={newLeaveType.name}
              onChange={e => setNewLeaveType(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Leave type name"
              className="w-full h-10 px-3 rounded-lg border border-slate-300"
            />
            <input
              type="number"
              value={newLeaveType.days}
              onChange={e => setNewLeaveType(prev => ({ ...prev, days: e.target.value }))}
              placeholder="Days per year"
              className="w-full h-10 px-3 rounded-lg border border-slate-300"
            />
            <button
              onClick={addLeaveType}
              className="w-full h-10 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
            >
              <FiPlus className="inline mr-2" /> Add Leave Type
            </button>
          </div>
        </div>

        {/* Working Hours & Policies */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Working Hours & Policies</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">Standard Working Hours</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="time"
                  value={settings.workingHours.start}
                  onChange={e => setSettings(prev => ({
                    ...prev,
                    workingHours: { ...prev.workingHours, start: e.target.value }
                  }))}
                  className="h-10 px-3 rounded-lg border border-slate-300"
                />
                <input
                  type="time"
                  value={settings.workingHours.end}
                  onChange={e => setSettings(prev => ({
                    ...prev,
                    workingHours: { ...prev.workingHours, end: e.target.value }
                  }))}
                  className="h-10 px-3 rounded-lg border border-slate-300"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-2">Weekly Holidays</label>
              <div className="grid grid-cols-2 gap-2">
                {weekDays.map(day => (
                  <label key={day} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.weeklyHolidays.includes(day)}
                      onChange={() => toggleHoliday(day)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-slate-700">{day}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-1">Overtime Rate (multiplier)</label>
              <input
                type="number"
                step="0.1"
                value={settings.overtimeRate}
                onChange={e => setSettings(prev => ({ ...prev, overtimeRate: parseFloat(e.target.value) }))}
                className="w-full h-10 px-3 rounded-lg border border-slate-300"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-1">Late Arrival Grace Period (minutes)</label>
              <input
                type="number"
                value={settings.lateArrivalGrace}
                onChange={e => setSettings(prev => ({ ...prev, lateArrivalGrace: parseInt(e.target.value) }))}
                className="w-full h-10 px-3 rounded-lg border border-slate-300"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
