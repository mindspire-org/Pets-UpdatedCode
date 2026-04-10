import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiUsers, FiClock, FiCalendar, FiSettings, FiTrendingUp, FiUserCheck, FiAlertCircle } from 'react-icons/fi'

export default function StaffDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    totalStaff: 0,
    presentToday: 0,
    absentToday: 0,
    onLeave: 0,
    departments: 0,
    avgAttendance: 0
  })

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = () => {
    try {
      const staff = JSON.parse(localStorage.getItem('staff_members') || '[]')
      const attendance = JSON.parse(localStorage.getItem('staff_attendance') || '[]')
      const today = new Date().toISOString().slice(0, 10)
      
      const todayAttendance = attendance.filter(a => a.date === today)
      const present = todayAttendance.filter(a => a.status === 'Present').length
      const absent = todayAttendance.filter(a => a.status === 'Absent').length
      const onLeave = todayAttendance.filter(a => a.status === 'Leave').length
      
      // Calculate departments
      const departments = new Set(staff.map(s => s.department).filter(Boolean))
      
      // Calculate average attendance for last 30 days
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const recentAttendance = attendance.filter(a => new Date(a.date) >= thirtyDaysAgo)
      const avgAttendance = recentAttendance.length > 0 
        ? (recentAttendance.filter(a => a.status === 'Present').length / recentAttendance.length * 100).toFixed(1)
        : 0

      setStats({
        totalStaff: staff.length,
        presentToday: present,
        absentToday: absent,
        onLeave: onLeave,
        departments: departments.size,
        avgAttendance: avgAttendance
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const cards = [
    {
      title: 'Staff Management',
      description: 'Manage staff members, roles, and departments',
      icon: FiUsers,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
      path: '/admin/staff/management',
      stat: `${stats.totalStaff} Staff`,
      statColor: 'text-blue-700'
    },
    {
      title: 'Daily Attendance',
      description: 'Mark and track daily staff attendance',
      icon: FiUserCheck,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
      path: '/admin/staff/attendance',
      stat: `${stats.presentToday} Present Today`,
      statColor: 'text-green-700'
    },
    {
      title: 'Monthly Reports',
      description: 'View monthly attendance and performance reports',
      icon: FiCalendar,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
      path: '/admin/staff/monthly',
      stat: `${stats.avgAttendance}% Avg Attendance`,
      statColor: 'text-purple-700'
    },
    {
      title: 'Staff Settings',
      description: 'Configure departments, shifts, and policies',
      icon: FiSettings,
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600',
      path: '/admin/staff/settings',
      stat: `${stats.departments} Departments`,
      statColor: 'text-orange-700'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          Staff Management
        </h1>
        <p className="text-slate-600 mt-2">Comprehensive staff attendance and management system</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-blue-600 font-semibold">Total Staff</div>
              <div className="text-3xl font-bold text-blue-700 mt-1">{stats.totalStaff}</div>
            </div>
            <div className="w-14 h-14 bg-blue-500 rounded-xl flex items-center justify-center">
              <FiUsers className="w-7 h-7 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-green-600 font-semibold">Present Today</div>
              <div className="text-3xl font-bold text-green-700 mt-1">{stats.presentToday}</div>
            </div>
            <div className="w-14 h-14 bg-green-500 rounded-xl flex items-center justify-center">
              <FiUserCheck className="w-7 h-7 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-2xl p-6 border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-red-600 font-semibold">Absent Today</div>
              <div className="text-3xl font-bold text-red-700 mt-1">{stats.absentToday}</div>
            </div>
            <div className="w-14 h-14 bg-red-500 rounded-xl flex items-center justify-center">
              <FiAlertCircle className="w-7 h-7 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-6 border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-purple-600 font-semibold">Avg Attendance</div>
              <div className="text-3xl font-bold text-purple-700 mt-1">{stats.avgAttendance}%</div>
            </div>
            <div className="w-14 h-14 bg-purple-500 rounded-xl flex items-center justify-center">
              <FiTrendingUp className="w-7 h-7 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Module Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cards.map((card, index) => (
          <div
            key={index}
            onClick={() => navigate(card.path)}
            className="group cursor-pointer bg-white rounded-2xl border-2 border-slate-200 hover:border-indigo-300 p-6 transition-all duration-200 hover:shadow-xl hover:scale-[1.02]"
          >
            <div className="flex items-start gap-4">
              <div className={`w-16 h-16 bg-gradient-to-br ${card.color} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <card.icon className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-slate-800 mb-1">{card.title}</h3>
                <p className="text-sm text-slate-600 mb-3">{card.description}</p>
                <div className={`inline-flex items-center gap-2 px-3 py-1 ${card.bgColor} rounded-lg`}>
                  <span className={`text-sm font-semibold ${card.statColor}`}>{card.stat}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-200 p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={() => navigate('/admin/staff/management')}
            className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all"
          >
            <FiUsers className="w-5 h-5 text-indigo-600" />
            <span className="font-semibold text-slate-700">Add New Staff</span>
          </button>
          <button
            onClick={() => navigate('/admin/staff/attendance')}
            className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-slate-200 hover:border-green-300 hover:shadow-md transition-all"
          >
            <FiClock className="w-5 h-5 text-green-600" />
            <span className="font-semibold text-slate-700">Mark Attendance</span>
          </button>
          <button
            onClick={() => navigate('/admin/staff/monthly')}
            className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-slate-200 hover:border-purple-300 hover:shadow-md transition-all"
          >
            <FiCalendar className="w-5 h-5 text-purple-600" />
            <span className="font-semibold text-slate-700">View Reports</span>
          </button>
        </div>
      </div>
    </div>
  )
}
