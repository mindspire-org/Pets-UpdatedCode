import React, { useMemo, useEffect, useState } from 'react'
import { FiTrendingUp, FiClock, FiCheckCircle, FiActivity, FiDollarSign, FiCalendar, FiDownload } from 'react-icons/fi'
import { TbMicroscope, TbFlask, TbClipboardCheck } from 'react-icons/tb'
import { labReportsAPI } from '../../services/api'
import ExpenseCard from '../../components/ExpenseCard'
import DateRangePicker from '../../components/DateRangePicker'

// Normalize report date from multiple possible fields
const getDateStr = (r) => {
  const raw = r?.collectionDate || r?.date || r?.reportDate || r?.createdAt
  if (!raw) return ''
  try {
    if (typeof raw === 'string') {
      return (raw.length >= 10 ? raw.slice(0,10) : new Date(raw).toISOString().slice(0,10))
    }
    return new Date(raw).toISOString().slice(0,10)
  } catch {
    return ''
  }
}

function TestStatisticsChart({ reports }) {
  const [highlightIndex, setHighlightIndex] = useState(null)
  
  // Get last 7 days data
  const chartData = useMemo(() => {
    const days = []
    const today = new Date()
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().slice(0, 10)
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
      
      const dayReports = reports.filter(r => getDateStr(r) === dateStr)
      
      days.push({
        day: dayName,
        date: dateStr,
        count: dayReports.length,
        revenue: dayReports.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
      })
    }
    
    return days
  }, [reports])
  
  const maxCount = Math.max(...chartData.map(d => d.count), 1)
  
  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-slate-800">Weekly Test Volume</h3>
      <div className="w-full">
        <svg viewBox="0 0 100 60" className="w-full h-60" preserveAspectRatio="none">
          <defs>
            <pattern id="testGrid" width="10" height="7.5" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 7.5" fill="none" stroke="#e2e8f0" strokeWidth="0.2"/>
            </pattern>
            <linearGradient id="barGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="1" />
              <stop offset="100%" stopColor="#059669" stopOpacity="1" />
            </linearGradient>
          </defs>
          
          {/* Grid background */}
          <rect width="80" height="45" x="15" y="5" fill="url(#testGrid)" />
          
          {/* Y-axis labels */}
          {[0, Math.ceil(maxCount * 0.25), Math.ceil(maxCount * 0.5), Math.ceil(maxCount * 0.75), maxCount].map((val, i) => (
            <g key={i}>
              <text x="12" y={50 - (val/maxCount)*45} fontSize="2.5" fill="#64748b" textAnchor="end">{val}</text>
              <line x1="15" x2="95" y1={50 - (val/maxCount)*45} y2={50 - (val/maxCount)*45} stroke="#e2e8f0" strokeWidth="0.2" />
            </g>
          ))}
          
          {/* Bars */}
          <g>
            {chartData.map((item, i) => {
              const x = 15 + (i * 11.4) + 2.5
              const h = (item.count / maxCount) * 45
              const y = 50 - h
              const active = highlightIndex === i
              return (
                <g key={i} onMouseEnter={() => setHighlightIndex(i)} onMouseLeave={() => setHighlightIndex(null)}>
                  <rect 
                    x={x} 
                    y={y} 
                    width="6" 
                    height={h} 
                    fill="url(#barGradient)" 
                    opacity={active ? 1 : 0.85}
                    style={{transition: 'all 200ms ease', cursor: 'pointer'}}
                  />
                  {active && (
                    <g>
                      <rect x={x-4} y={y-8} width="14" height="7" rx="1" fill="#1e293b" opacity="0.95" />
                      <text x={x+3} y={y-4} fontSize="2.2" fill="#fff" textAnchor="middle" fontWeight="600">{item.count}</text>
                      <text x={x+3} y={y-1.5} fontSize="1.5" fill="#10b981" textAnchor="middle">tests</text>
                    </g>
                  )}
                </g>
              )
            })}
          </g>
          
          {/* X-axis labels */}
          {chartData.map((item, i) => (
            <text key={i} x={15 + (i * 11.4) + 5.5} y="57" fontSize="2.2" fill="#64748b" textAnchor="middle">{item.day}</text>
          ))}
        </svg>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500 px-2">
        <span>Last 7 days performance</span>
        <span className="font-semibold text-emerald-600">Total: {chartData.reduce((sum, d) => sum + d.count, 0)} tests</span>
      </div>
    </div>
  )
}

export default function LabDashboard(){
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({
    fromDate: new Date().toISOString().slice(0,10),
    toDate: new Date().toISOString().slice(0,10)
  })

  // Fetch once on mount; cards and lists filter locally by dateRange
  useEffect(() => {
    let mounted = true
    ;(async()=>{
      try {
        setLoading(true)
        const response = await labReportsAPI.getAll()
        if (!mounted) return
        setReports(response.data || [])
      } catch (err) {
        console.error('Error fetching reports:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return ()=>{ mounted = false }
  }, [])

  const handleDateRangeChange = (newDateRange) => {
    setDateRange(newDateRange)
  }

  // Date filtering function
  const isDateInRange = (dateStr) => {
    if (!dateStr) return false
    const d = String(dateStr).slice(0,10)
    return d >= dateRange.fromDate && d <= dateRange.toDate
  }

  const filteredReports = useMemo(() => {
    return (reports||[]).filter(r => isDateInRange(getDateStr(r)))
  }, [reports, dateRange.fromDate, dateRange.toDate])

  const stats = useMemo(() => {
    const list = filteredReports
    const pending = list.filter(r => String(r.paymentStatus||'').toLowerCase() === 'pending').length
    const completed = list.filter(r => String(r.paymentStatus||'').toLowerCase() === 'paid').length
    const revenue = list.reduce((s, r) => s + (Number(r.amount) || 0), 0)
    return { 
      total: list.length, 
      pending, 
      completed, 
      revenue, 
      todayTests: list.length, 
      todayRevenue: revenue 
    }
  }, [filteredReports])

  const recentReports = useMemo(() => {
    return filteredReports.slice(0, 8).map(r => ({
      text: `${r.testType || r.testName} - ${r.petName}`,
      time: new Date(r.createdAt || r.collectionDate || r.date).toLocaleString(),
      status: r.paymentStatus
    }))
  }, [filteredReports])

  const exportCsv = () => {
    const toCsvValue = (v) => {
      const s = String(v ?? '')
      return `"${s.replace(/"/g, '""')}"`
    }

    const rows = []
    rows.push(['Lab Dashboard Export'])
    rows.push(['From', dateRange.fromDate, 'To', dateRange.toDate])
    rows.push(['Total Tests', stats.total])
    rows.push(['Pending Payment', stats.pending])
    rows.push(['Completed', stats.completed])
    rows.push(['Total Revenue', stats.revenue])
    rows.push([])
    rows.push(['Reports'])
    rows.push(['Date', 'Test', 'Pet', 'Amount', 'Payment Status'])
    ;(filteredReports || []).forEach(r => {
      rows.push([
        getDateStr(r),
        r.testType || r.testName || '',
        r.petName || '',
        Number(r.amount || 0),
        r.paymentStatus || ''
      ])
    })

    const csv = rows.map(r => r.map(toCsvValue).join(',')).join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lab-dashboard-${dateRange.fromDate}-to-${dateRange.toDate}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">Laboratory Dashboard</h1>
          <p className="text-slate-500 mt-1">Monitor your lab operations and performance</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg">
          <TbMicroscope className="w-6 h-6" />
          <span className="font-semibold">Lab Portal</span>
        </div>
      </div>

      {/* Date Range Picker */}
      <div className="rounded-2xl bg-gradient-to-br from-white via-emerald-50 to-teal-50 shadow-xl ring-1 ring-emerald-200 border border-emerald-100 p-6">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
              <FiCalendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-emerald-600">Date Range</div>
              <div className="text-lg font-bold text-slate-800">
                {dateRange.fromDate === dateRange.toDate 
                  ? new Date(dateRange.fromDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                  : `${new Date(dateRange.fromDate).toLocaleDateString()} - ${new Date(dateRange.toDate).toLocaleDateString()}`
                }
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-end gap-3">
            <DateRangePicker 
              onDateChange={handleDateRangeChange}
              defaultFromDate={dateRange.fromDate}
              defaultToDate={dateRange.toDate}
              showAllButton
              className="flex-wrap"
            />
            <button
              type="button"
              onClick={exportCsv}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors text-sm font-medium shadow-sm"
            >
              <FiDownload className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="group relative rounded-2xl p-6 bg-gradient-to-br from-blue-50 to-cyan-50 ring-1 ring-blue-200/50 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-200/30 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white shadow-lg">
                <TbFlask className="w-6 h-6" />
              </div>
              <div className="text-xs font-semibold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">Total</div>
            </div>
            <div className="text-slate-600 text-sm font-medium mb-1">Total Tests</div>
            <div className="text-3xl font-bold text-slate-800">{stats.total}</div>
            <div className="text-xs text-slate-500 mt-2">Today: {stats.todayTests}</div>
          </div>
        </div>

        <div className="group relative rounded-2xl p-6 bg-gradient-to-br from-amber-50 to-orange-50 ring-1 ring-amber-200/50 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-200/30 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-lg">
                <FiClock className="w-6 h-6" />
              </div>
              <div className="text-xs font-semibold text-amber-600 bg-amber-100 px-3 py-1 rounded-full">Pending</div>
            </div>
            <div className="text-slate-600 text-sm font-medium mb-1">Pending Payment</div>
            <div className="text-3xl font-bold text-slate-800">{stats.pending}</div>
            <div className="text-xs text-slate-500 mt-2">Awaiting clearance</div>
          </div>
        </div>

        <div className="group relative rounded-2xl p-6 bg-gradient-to-br from-emerald-50 to-green-50 ring-1 ring-emerald-200/50 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-200/30 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center text-white shadow-lg">
                <TbClipboardCheck className="w-6 h-6" />
              </div>
              <div className="text-xs font-semibold text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full">Done</div>
            </div>
            <div className="text-slate-600 text-sm font-medium mb-1">Completed</div>
            <div className="text-3xl font-bold text-slate-800">{stats.completed}</div>
            <div className="text-xs text-slate-500 mt-2">Payment received</div>
          </div>
        </div>

        <div className="group relative rounded-2xl p-6 bg-gradient-to-br from-purple-50 to-pink-50 ring-1 ring-purple-200/50 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-200/30 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shadow-lg">
                <FiDollarSign className="w-6 h-6" />
              </div>
              <div className="text-xs font-semibold text-purple-600 bg-purple-100 px-3 py-1 rounded-full">Revenue</div>
            </div>
            <div className="text-slate-600 text-sm font-medium mb-1">Total Revenue</div>
            <div className="text-3xl font-bold text-slate-800">Rs. {stats.revenue.toLocaleString()}</div>
            <div className="text-xs text-slate-500 mt-2">Today: Rs. {stats.todayRevenue.toLocaleString()}</div>
          </div>
        </div>

        <ExpenseCard 
          portal="lab" 
          title="Laboratory" 
          color="green" 
        />
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl p-6 bg-white ring-1 ring-slate-200 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white">
              <FiTrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-800">Test Statistics</div>
              <div className="text-xs text-slate-500">Performance overview</div>
            </div>
          </div>
          <TestStatisticsChart reports={filteredReports} />
        </div>

        <div className="rounded-2xl p-6 bg-white ring-1 ring-slate-200 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white">
              <FiClock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-800">Recent Activity</div>
              <div className="text-xs text-slate-500">Latest reports</div>
            </div>
          </div>
          <div className="space-y-3 max-h-[280px] overflow-y-auto custom-scrollbar">
            {recentReports.map((a, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 hover:from-emerald-50 hover:to-teal-50 transition-all duration-200 border border-slate-200">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${a.status === 'Paid' ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                  <FiCheckCircle className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-700 truncate">{a.text}</div>
                  <div className="text-xs text-slate-500 mt-1">{a.time}</div>
                </div>
              </div>
            ))}
            {recentReports.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <TbMicroscope className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <div className="text-sm">No recent activity</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
