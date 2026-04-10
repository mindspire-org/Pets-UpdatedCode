import React, { useEffect, useState, useMemo } from 'react'
import { FiDownload, FiCalendar, FiTrendingUp, FiUser } from 'react-icons/fi'

export default function MonthlyReports() {
  const [staff, setStaff] = useState([])
  const [attendance, setAttendance] = useState([])
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [selectedStaff, setSelectedStaff] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = () => {
    try {
      const staffData = JSON.parse(localStorage.getItem('staff_members') || '[]')
      const attendanceData = JSON.parse(localStorage.getItem('staff_attendance') || '[]')
      setStaff(staffData)
      setAttendance(attendanceData)
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  const monthlyData = useMemo(() => {
    const monthStart = `${selectedMonth}-01`
    const monthEnd = `${selectedMonth}-31`
    
    const monthAttendance = attendance.filter(a => 
      a.date >= monthStart && a.date <= monthEnd
    )

    const staffStats = staff.map(member => {
      const memberAttendance = monthAttendance.filter(a => a.staffId === member.staffId)
      
      const present = memberAttendance.filter(a => a.status === 'Present').length
      const absent = memberAttendance.filter(a => a.status === 'Absent').length
      const leave = memberAttendance.filter(a => a.status === 'Leave').length
      const halfDay = memberAttendance.filter(a => a.status === 'Half Day').length
      
      const totalDays = present + absent + leave + halfDay
      const attendanceRate = totalDays > 0 ? ((present + halfDay * 0.5) / totalDays * 100).toFixed(1) : 0
      
      // Calculate working hours
      const totalHours = memberAttendance.reduce((sum, a) => {
        if (a.checkIn && a.checkOut) {
          const [inH, inM] = a.checkIn.split(':').map(Number)
          const [outH, outM] = a.checkOut.split(':').map(Number)
          const hours = (outH * 60 + outM - inH * 60 - inM) / 60
          return sum + hours
        }
        return sum
      }, 0)

      return {
        ...member,
        present,
        absent,
        leave,
        halfDay,
        totalDays,
        attendanceRate,
        totalHours: totalHours.toFixed(1)
      }
    })

    return staffStats
  }, [staff, attendance, selectedMonth])

  const filteredData = useMemo(() => {
    if (!selectedStaff) return monthlyData
    return monthlyData.filter(s => s.staffId === selectedStaff)
  }, [monthlyData, selectedStaff])

  const overallStats = useMemo(() => {
    const totalPresent = monthlyData.reduce((sum, s) => sum + s.present, 0)
    const totalAbsent = monthlyData.reduce((sum, s) => sum + s.absent, 0)
    const totalLeave = monthlyData.reduce((sum, s) => sum + s.leave, 0)
    const totalHalfDay = monthlyData.reduce((sum, s) => sum + s.halfDay, 0)
    const avgAttendance = monthlyData.length > 0
      ? (monthlyData.reduce((sum, s) => sum + parseFloat(s.attendanceRate), 0) / monthlyData.length).toFixed(1)
      : 0

    return {
      totalPresent,
      totalAbsent,
      totalLeave,
      totalHalfDay,
      avgAttendance
    }
  }, [monthlyData])

  const exportToCSV = () => {
    const headers = ['Staff ID', 'Name', 'Department', 'Present', 'Absent', 'Leave', 'Half Day', 'Attendance %', 'Total Hours']
    const rows = filteredData.map(s => [
      s.staffId,
      s.name,
      s.department,
      s.present,
      s.absent,
      s.leave,
      s.halfDay,
      s.attendanceRate,
      s.totalHours
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance-report-${selectedMonth}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-indigo-800">Monthly Reports</h1>
          <p className="text-slate-600">View and analyze monthly attendance reports</p>
        </div>
        <button
          onClick={exportToCSV}
          className="h-11 px-5 rounded-xl bg-green-600 text-white flex items-center gap-2 shadow hover:bg-green-700"
        >
          <FiDownload /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-600 mb-1">Select Month</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="w-full h-11 px-4 rounded-xl border border-slate-300"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Filter by Staff</label>
            <select
              value={selectedStaff}
              onChange={e => setSelectedStaff(e.target.value)}
              className="w-full h-11 px-4 rounded-xl border border-slate-300"
            >
              <option value="">All Staff</option>
              {staff.map(member => (
                <option key={member.staffId} value={member.staffId}>
                  {member.name} - {member.department}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <div className="text-sm text-green-600 font-semibold">Total Present</div>
          <div className="text-2xl font-bold text-green-700 mt-1">{overallStats.totalPresent}</div>
        </div>
        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
          <div className="text-sm text-red-600 font-semibold">Total Absent</div>
          <div className="text-2xl font-bold text-red-700 mt-1">{overallStats.totalAbsent}</div>
        </div>
        <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
          <div className="text-sm text-yellow-600 font-semibold">Total Leave</div>
          <div className="text-2xl font-bold text-yellow-700 mt-1">{overallStats.totalLeave}</div>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <div className="text-sm text-blue-600 font-semibold">Half Days</div>
          <div className="text-2xl font-bold text-blue-700 mt-1">{overallStats.totalHalfDay}</div>
        </div>
        <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
          <div className="text-sm text-purple-600 font-semibold">Avg Attendance</div>
          <div className="text-2xl font-bold text-purple-700 mt-1">{overallStats.avgAttendance}%</div>
        </div>
      </div>

      {/* Staff Reports Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Staff</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Department</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">Present</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">Absent</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">Leave</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">Half Day</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">Attendance %</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">Total Hours</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map(member => (
                <tr key={member.staffId} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-800">{member.name}</div>
                    <div className="text-xs text-slate-500">{member.staffId}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{member.department}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-semibold">
                      {member.present}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-1 bg-red-100 text-red-700 rounded-lg text-sm font-semibold">
                      {member.absent}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-lg text-sm font-semibold">
                      {member.leave}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-semibold">
                      {member.halfDay}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-24 bg-slate-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            member.attendanceRate >= 90 ? 'bg-green-500' :
                            member.attendanceRate >= 75 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${member.attendanceRate}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-slate-700">
                        {member.attendanceRate}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-700 font-semibold">
                    {member.totalHours}h
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
