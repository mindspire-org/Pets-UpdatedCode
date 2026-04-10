import React, { useEffect, useState, useMemo } from 'react'
import { FiCheck, FiX, FiClock, FiCalendar, FiSave } from 'react-icons/fi'
import { useAlert } from '../../../context/AlertContext'

export default function Attendance() {
  const { success, error } = useAlert()
  const [staff, setStaff] = useState([])
  const [attendance, setAttendance] = useState({})
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [saved, setSaved] = useState(false)
  const [filterDepartment, setFilterDepartment] = useState('')

  useEffect(() => {
    loadStaff()
    loadAttendance()
  }, [selectedDate])

  const loadStaff = () => {
    try {
      const stored = JSON.parse(localStorage.getItem('staff_members') || '[]')
      setStaff(stored.filter(s => s.status === 'Active'))
    } catch (error) {
      console.error('Error loading staff:', error)
    }
  }

  const loadAttendance = () => {
    try {
      const allAttendance = JSON.parse(localStorage.getItem('staff_attendance') || '[]')
      const todayAttendance = allAttendance.filter(a => a.date === selectedDate)
      
      const attendanceMap = {}
      todayAttendance.forEach(a => {
        attendanceMap[a.staffId] = {
          status: a.status,
          checkIn: a.checkIn || '',
          checkOut: a.checkOut || '',
          notes: a.notes || ''
        }
      })
      
      setAttendance(attendanceMap)
    } catch (error) {
      console.error('Error loading attendance:', error)
    }
  }

  const departments = useMemo(() => {
    const depts = new Set(staff.map(s => s.department).filter(Boolean))
    return Array.from(depts).sort()
  }, [staff])

  const filteredStaff = useMemo(() => {
    if (!filterDepartment) return staff
    return staff.filter(s => s.department === filterDepartment)
  }, [staff, filterDepartment])

  const markAttendance = (staffId, status) => {
    setAttendance(prev => ({
      ...prev,
      [staffId]: {
        ...prev[staffId],
        status,
        checkIn: status === 'Present' && !prev[staffId]?.checkIn 
          ? new Date().toTimeString().slice(0, 5) 
          : prev[staffId]?.checkIn || '',
        checkOut: prev[staffId]?.checkOut || '',
        notes: prev[staffId]?.notes || ''
      }
    }))
    setSaved(false)
  }

  const updateTime = (staffId, field, value) => {
    setAttendance(prev => ({
      ...prev,
      [staffId]: {
        ...prev[staffId],
        [field]: value
      }
    }))
    setSaved(false)
  }

  const saveAttendance = () => {
    try {
      const allAttendance = JSON.parse(localStorage.getItem('staff_attendance') || '[]')
      
      // Remove existing attendance for this date
      const filtered = allAttendance.filter(a => a.date !== selectedDate)
      
      // Add new attendance records
      const newRecords = Object.entries(attendance).map(([staffId, data]) => ({
        staffId,
        date: selectedDate,
        status: data.status || 'Absent',
        checkIn: data.checkIn || '',
        checkOut: data.checkOut || '',
        notes: data.notes || '',
        markedAt: new Date().toISOString()
      }))
      
      const updated = [...filtered, ...newRecords]
      localStorage.setItem('staff_attendance', JSON.stringify(updated))
      
      setSaved(true)
      success('Attendance saved successfully!')
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('Error saving attendance:', err)
      error('Failed to save attendance')
    }
  }

  const stats = useMemo(() => {
    const present = Object.values(attendance).filter(a => a.status === 'Present').length
    const absent = Object.values(attendance).filter(a => a.status === 'Absent').length
    const leave = Object.values(attendance).filter(a => a.status === 'Leave').length
    const halfDay = Object.values(attendance).filter(a => a.status === 'Half Day').length
    
    return { present, absent, leave, halfDay }
  }, [attendance])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-indigo-800">Daily Attendance</h1>
          <p className="text-slate-600">Mark and track staff attendance</p>
        </div>
        <button
          onClick={saveAttendance}
          className="h-11 px-5 rounded-xl bg-green-600 text-white flex items-center gap-2 shadow hover:bg-green-700"
        >
          <FiSave /> Save Attendance
        </button>
      </div>

      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          Attendance saved successfully!
        </div>
      )}

      {/* Date and Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-slate-600 mb-1">Select Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-full h-11 px-4 rounded-xl border border-slate-300"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Filter by Department</label>
            <select
              value={filterDepartment}
              onChange={e => setFilterDepartment(e.target.value)}
              className="w-full h-11 px-4 rounded-xl border border-slate-300"
            >
              <option value="">All Departments</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <div className="text-sm text-slate-600">
              <span className="font-semibold">{filteredStaff.length}</span> staff members
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <div className="text-sm text-green-600 font-semibold">Present</div>
          <div className="text-2xl font-bold text-green-700 mt-1">{stats.present}</div>
        </div>
        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
          <div className="text-sm text-red-600 font-semibold">Absent</div>
          <div className="text-2xl font-bold text-red-700 mt-1">{stats.absent}</div>
        </div>
        <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
          <div className="text-sm text-yellow-600 font-semibold">Leave</div>
          <div className="text-2xl font-bold text-yellow-700 mt-1">{stats.leave}</div>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <div className="text-sm text-blue-600 font-semibold">Half Day</div>
          <div className="text-2xl font-bold text-blue-700 mt-1">{stats.halfDay}</div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Staff</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Department</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">Check In</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">Check Out</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map(member => {
                const att = attendance[member.staffId] || {}
                const status = att.status || 'Absent'
                
                return (
                  <tr key={member.staffId} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{member.name}</div>
                      <div className="text-xs text-slate-500">{member.staffId}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{member.department}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => markAttendance(member.staffId, 'Present')}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                            status === 'Present'
                              ? 'bg-green-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-green-100'
                          }`}
                        >
                          <FiCheck className="inline w-3 h-3 mr-1" /> Present
                        </button>
                        <button
                          onClick={() => markAttendance(member.staffId, 'Absent')}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                            status === 'Absent'
                              ? 'bg-red-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-red-100'
                          }`}
                        >
                          <FiX className="inline w-3 h-3 mr-1" /> Absent
                        </button>
                        <button
                          onClick={() => markAttendance(member.staffId, 'Leave')}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                            status === 'Leave'
                              ? 'bg-yellow-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-yellow-100'
                          }`}
                        >
                          Leave
                        </button>
                        <button
                          onClick={() => markAttendance(member.staffId, 'Half Day')}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                            status === 'Half Day'
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-blue-100'
                          }`}
                        >
                          Half Day
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="time"
                        value={att.checkIn || ''}
                        onChange={e => updateTime(member.staffId, 'checkIn', e.target.value)}
                        disabled={status !== 'Present' && status !== 'Half Day'}
                        className="w-28 px-2 py-1 rounded-lg border border-slate-300 text-sm disabled:bg-slate-50"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="time"
                        value={att.checkOut || ''}
                        onChange={e => updateTime(member.staffId, 'checkOut', e.target.value)}
                        disabled={status !== 'Present' && status !== 'Half Day'}
                        className="w-28 px-2 py-1 rounded-lg border border-slate-300 text-sm disabled:bg-slate-50"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
