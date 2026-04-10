import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiCalendar, FiUsers, FiDollarSign, FiActivity, FiTrendingUp, FiCheckCircle, FiClock, FiAlertCircle } from 'react-icons/fi'
import { petsAPI, appointmentsAPI, financialsAPI, labReportsAPI, pharmacySalesAPI, salesAPI, prescriptionsAPI } from '../../services/api'
import DateRangePicker from '../../components/DateRangePicker'

function StatCard({ title, value, bg, icon: Icon, trend, subtitle, onClick }) {
  return (
    <div onClick={onClick} className={`rounded-2xl p-6 shadow-xl ring-1 ring-slate-200/70 ${bg} hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 group cursor-pointer`}>
      <div className="flex items-center justify-between mb-4">
        <div className="h-14 w-14 rounded-xl bg-white/90 shadow-lg grid place-items-center text-indigo-600 group-hover:scale-110 transition-transform duration-300">
          <Icon size={26} />
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-100 px-2 py-1 rounded-full">
            <FiTrendingUp className="w-3 h-3" />
            {trend}
          </div>
        )}
      </div>
      <div>
        <div className="text-sm font-medium text-slate-600 mb-1">{title}</div>
        <div className="text-3xl font-bold tracking-tight text-slate-900 mb-1">{value}</div>
        {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
      </div>
    </div>
  )
}

function DailyIncomeChart({ data }) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const yMax = Math.max(1, ...data) * 1.2
  const [hi, setHi] = React.useState(null)
  
  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-slate-800">Daily Income</h3>
      <div className="w-full">
        <svg viewBox="0 0 100 60" className="w-full h-60" preserveAspectRatio="none">
          <defs>
            <pattern id="grid" width="10" height="7.5" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 7.5" fill="none" stroke="#e2e8f0" strokeWidth="0.2"/>
            </pattern>
          </defs>
          
          {/* Grid background */}
          <rect width="80" height="45" x="15" y="5" fill="url(#grid)" />
          
          {/* Y-axis labels */}
          {Array.from({ length: 5 }, (_, i) => Math.round((yMax / 4) * i)).map((val, i) => (
            <g key={i}>
              <text x="12" y={50 - (val/yMax)*45} fontSize="2.5" fill="#64748b" textAnchor="end">{val}</text>
              <line x1="15" x2="95" y1={50 - (val/yMax)*45} y2={50 - (val/yMax)*45} stroke="#e2e8f0" strokeWidth="0.2" />
            </g>
          ))}
          
          {/* Bars */}
          <g>
            {data.map((val, i) => {
              const x = 15 + (i * 11.4) + 2.5
              const h = (val / yMax) * 45
              const y = 50 - h
              const active = hi === i
              return (
                <g key={i} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)}>
                  <rect 
                    x={x} 
                    y={y} 
                    width="6" 
                    height={h} 
                    fill="#3b82f6" 
                    opacity={active ? 1 : 0.8}
                    style={{transition: 'all 200ms ease'}}
                  />
                  {active && (
                    <g>
                      <rect x={x-3} y={y-6} width="12" height="5" rx="1" fill="#1e293b" opacity="0.9" />
                      <text x={x+3} y={y-3} fontSize="2" fill="#fff" textAnchor="middle" fontWeight="600">{val}</text>
                    </g>
                  )}
                </g>
              )
            })}
          </g>
          
          {/* X-axis labels */}
          {days.map((day, i) => (
            <text key={i} x={15 + (i * 11.4) + 5.5} y="57" fontSize="2.2" fill="#64748b" textAnchor="middle">{day}</text>
          ))}
        </svg>
      </div>
    </div>
  )
}

function ComparisonChart({ sales, purchases, expenses }) {
  const data = [
    { label: 'Sales', value: sales, color: '#10b981' },
    { label: 'Purchases', value: purchases, color: '#10b981' },
    { label: 'Expenses', value: expenses, color: '#10b981' }
  ]
  const max = Math.max(1, ...data.map(d => d.value)) * 1.2
  const [hi, setHi] = React.useState(null)
  
  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-slate-800">Comparison: Sales, Purchases, Expenses</h3>
      <div className="w-full">
        <svg viewBox="0 0 100 60" className="w-full h-60" preserveAspectRatio="none">
          <defs>
            <pattern id="compGrid" width="10" height="7.5" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 7.5" fill="none" stroke="#e2e8f0" strokeWidth="0.2"/>
            </pattern>
          </defs>
          
          {/* Grid background */}
          <rect width="70" height="45" x="20" y="5" fill="url(#compGrid)" />
          
          {/* Y-axis labels */}
          {[0, 150000, 300000, 450000, 600000].map((val, i) => (
            <g key={i}>
              <text x="17" y={50 - (val/max)*45} fontSize="2.5" fill="#64748b" textAnchor="end">{val}</text>
              <line x1="20" x2="90" y1={50 - (val/max)*45} y2={50 - (val/max)*45} stroke="#e2e8f0" strokeWidth="0.2" />
            </g>
          ))}
          
          {/* Bars */}
          <g>
            {data.map((item, i) => {
              const x = 20 + (i * 22.5) + 5
              const h = (item.value / max) * 45
              const y = 50 - h
              const active = hi === i
              return (
                <g key={i} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)}>
                  <rect 
                    x={x} 
                    y={y} 
                    width="12" 
                    height={h} 
                    fill={item.color} 
                    opacity={active ? 1 : 0.8}
                    style={{transition: 'all 200ms ease'}}
                  />
                  {active && (
                    <g>
                      <rect x={x-2.5} y={y-6} width="17" height="5" rx="1" fill="#1e293b" opacity="0.9" />
                      <text x={x+6} y={y-3} fontSize="2" fill="#fff" textAnchor="middle" fontWeight="600">{item.value}</text>
                    </g>
                  )}
                </g>
              )
            })}
          </g>
          
          {/* X-axis labels */}
          {data.map((item, i) => (
            <text key={i} x={20 + (i * 22.5) + 11} y="57" fontSize="2.8" fill="#64748b" textAnchor="middle" fontWeight="500">{item.label}</text>
          ))}
        </svg>
      </div>
    </div>
  )
}

export default function Dashboard(){
  const navigate = useNavigate()
  const [pets, setPets] = useState([])
  const [appointments, setAppointments] = useState([])
  const [financials, setFinancials] = useState([])
  const [labReports, setLabReports] = useState([])
  const [pharmacySales, setPharmacySales] = useState([])
  const [shopSales, setShopSales] = useState([])
  const [prescriptions, setPrescriptions] = useState([])
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState({
    fromDate: new Date().toISOString().slice(0,10),
    toDate: new Date().toISOString().slice(0,10)
  })

  useEffect(() => {
    loadDashboardData()
  }, [dateRange.fromDate, dateRange.toDate])

  const loadDashboardData = async () => {
    // Prevent multiple simultaneous calls
    if (loading) return
    
    try {
      setLoading(true)
      
      // Load data with fallback to localStorage and sample data
      const loadWithFallback = async (apiCall, localStorageKey, fallbackData = []) => {
        try {
          // Add timeout to individual API calls
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('API timeout')), 5000)
          )
          
          const response = await Promise.race([apiCall(), timeoutPromise])
          return response.data || fallbackData
        } catch (error) {
          console.warn(`API failed for ${localStorageKey}:`, error.message)
          try {
            const localData = JSON.parse(localStorage.getItem(localStorageKey) || '[]')
            if (Array.isArray(localData) && localData.length > 0) {
              return localData
            }
            // Return sample data if localStorage is also empty
            return getSampleData(localStorageKey)
          } catch (parseError) {
            console.warn(`localStorage parse failed for ${localStorageKey}`)
            return getSampleData(localStorageKey)
          }
        }
      }

      // Generate sample data for testing
      const getSampleData = (key) => {
        const today = new Date().toISOString().slice(0, 10)
        switch (key) {
          case 'reception_pets':
            return [
              { id: 1, petName: 'Buddy', ownerName: 'John Doe', createdAt: today },
              { id: 2, petName: 'Max', ownerName: 'Jane Smith', createdAt: today }
            ]
          case 'reception_appointments':
            return [
              { id: 1, petName: 'Buddy', date: today, status: 'Completed' },
              { id: 2, petName: 'Max', date: today, status: 'Pending' }
            ]
          case 'admin_financials':
            return [
              { id: 1, amount: 1500, type: 'income', date: today },
              { id: 2, amount: 2000, type: 'income', date: today }
            ]
          default:
            return []
        }
      }

      // Load all data with fallbacks
      const [petsData, apptsData, financialsData, labData, pharmacyData, shopData, prescData] = await Promise.all([
        loadWithFallback(() => petsAPI.getAll(), 'reception_pets'),
        loadWithFallback(() => appointmentsAPI.getAll(), 'reception_appointments'),
        loadWithFallback(() => financialsAPI.getAll(), 'admin_financials'),
        loadWithFallback(() => labReportsAPI.getAll(), 'lab_reports'),
        loadWithFallback(() => pharmacySalesAPI.getAll(), 'pharmacy_sales'),
        loadWithFallback(() => salesAPI.getAll(), 'shop_sales'),
        loadWithFallback(() => prescriptionsAPI.getAll(), 'doctor_prescriptions')
      ])

      setPets(petsData)
      setAppointments(apptsData)
      setFinancials(financialsData)
      setLabReports(labData)
      setPharmacySales(pharmacyData)
      setShopSales(shopData)
      setPrescriptions(prescData)

      // Set loading to false immediately after data is set
      setLoading(false)

      console.log('Dashboard data loaded successfully:', {
        pets: petsData.length,
        appointments: apptsData.length,
        financials: financialsData.length,
        labReports: labData.length,
        pharmacySales: pharmacyData.length,
        shopSales: shopData.length,
        prescriptions: prescData.length
      })

    } catch (err) {
      console.error('Error loading dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Filter data by selected date range
  const isDateInRange = (dateStr) => {
    if (!dateStr) return false
    const date = new Date(dateStr).toISOString().slice(0,10)
    return date >= dateRange.fromDate && date <= dateRange.toDate
  }

  const dateFilteredAppts = appointments.filter(a => 
    isDateInRange(a.date || a.appointmentDate || a.createdAt)
  )
  
  const dateFilteredPets = pets.filter(p => 
    isDateInRange(p.createdAt || p.when)
  )

  const dateFilteredFinancials = financials.filter(f => 
    isDateInRange(f.date || f.createdAt)
  )

  const dateFilteredLabReports = labReports.filter(r => 
    isDateInRange(r.createdAt || r.reportDate || r.date)
  )

  const dateFilteredPharmacySales = pharmacySales.filter(s => 
    isDateInRange(s.createdAt || s.date)
  )

  const dateFilteredShopSales = shopSales.filter(s => 
    isDateInRange(s.createdAt || s.date)
  )

  const dateFilteredPrescriptions = prescriptions.filter(p => 
    isDateInRange(p.createdAt || p.when || p.date)
  )

  // Calculate statistics with fallbacks
  const totalPets = dateFilteredPets.length || 0
  const totalIncome = dateFilteredFinancials.reduce((sum, f) => sum + (Number(f.amount) || 0), 0) || 0
  const pendingTests = dateFilteredLabReports.filter(r => r.status === 'Pending').length || 0
  const completedAppts = dateFilteredAppts.filter(a => a.status === 'Completed').length || 0
  const pendingAppts = dateFilteredAppts.filter(a => a.status === 'Scheduled' || a.status === 'Confirmed' || a.status === 'Pending').length || 0
  const totalPrescriptions = dateFilteredPrescriptions.length || 0
  
  // Ensure we have some data to display
  const hasData = pets.length > 0 || appointments.length > 0 || financials.length > 0

  const handleDateRangeChange = useCallback((newDateRange) => {
    setDateRange(newDateRange)
  }, [])
  
  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  }

  // ===== Charts: derive data from selected date range =====
  const normalizeAmount = (v) => Number(v) || 0
  const getMonIndex = (d) => {
    if (!d) return null
    const dt = new Date(d)
    if (isNaN(dt.getTime())) return null
    // JS: 0=Sun..6=Sat; we want 0=Mon..6=Sun
    return (dt.getDay() + 6) % 7
  }

  const dailyIncomeByDow = useMemo(() => {
    const arr = Array(7).fill(0)
    const add = (date, amt) => {
      const idx = getMonIndex(date)
      if (idx === null) return
      arr[idx] += normalizeAmount(amt)
    }

    // Income sources by date
    dateFilteredPharmacySales.forEach(s => add(s.createdAt || s.date, s.totalAmount || s.amount || 0))
    dateFilteredShopSales.forEach(s => add(s.createdAt || s.date, s.totalAmount || s.total || 0))
    dateFilteredLabReports.forEach(r => add(r.createdAt || r.reportDate || r.date, r.amount || 0))
    dateFilteredAppts
      .filter(a => (a.status === 'Completed') && (a.fee || a.amount))
      .forEach(a => add(a.createdAt || a.date, a.fee || a.amount || 0))
    dateFilteredPrescriptions
      .filter(p => p.amount)
      .forEach(p => add(p.createdAt || p.when || p.date, p.amount))

    return arr
  }, [dateFilteredPharmacySales, dateFilteredShopSales, dateFilteredLabReports, dateFilteredAppts, dateFilteredPrescriptions])

  const salesTotal = useMemo(() => dailyIncomeByDow.reduce((s, v) => s + v, 0), [dailyIncomeByDow])

  const expenseFinancials = useMemo(() => (
    dateFilteredFinancials.filter(f => String(f.type || '').toLowerCase() === 'expense' || String(f.type || '').toLowerCase() === 'expenses')
  ), [dateFilteredFinancials])

  const isPurchaseExpense = (f) => {
    const cat = String(f.category || f.subcategory || f.description || f.detail || '').toLowerCase()
    return /purchase|inventory|stock|procure|buy/.test(cat)
  }

  const purchasesTotal = useMemo(() => (
    expenseFinancials.filter(isPurchaseExpense).reduce((s, f) => s + normalizeAmount(f.amount), 0)
  ), [expenseFinancials])

  const otherExpensesTotal = useMemo(() => (
    expenseFinancials.filter(f => !isPurchaseExpense(f)).reduce((s, f) => s + normalizeAmount(f.amount), 0)
  ), [expenseFinancials])


  // Combine all transactions from different portals with date filtering
  const getAllTransactions = useMemo(() => {
    const transactions = []

    // Lab Reports (Income) - use filtered data
    dateFilteredLabReports.forEach(report => {
      transactions.push({
        id: report._id || report.id,
        type: 'income',
        portal: 'Laboratory',
        title: `Lab Test - ${report.testType || 'Test'}`,
        subtitle: `Patient: ${report.petName || 'Unknown'}`,
        amount: report.amount || 0,
        date: report.createdAt || report.reportDate || report.date,
        reference: report.reportNumber || report.id,
        status: 'Paid',
        color: 'emerald'
      })
    })

    // Pharmacy Sales (Income) - use filtered data
    dateFilteredPharmacySales.forEach(sale => {
      transactions.push({
        id: sale._id || sale.id,
        type: 'income',
        portal: 'Pharmacy',
        title: `Medicine Sale - ${sale.invoiceNumber}`,
        subtitle: `Customer: ${sale.customerName || 'Walk-in'}`,
        amount: sale.totalAmount || 0,
        date: sale.createdAt || sale.date,
        reference: sale.invoiceNumber,
        status: sale.status || 'Paid',
        color: 'emerald'
      })
    })

    // Shop Sales (Income) - use filtered data
    dateFilteredShopSales.forEach(sale => {
      transactions.push({
        id: sale._id || sale.id,
        type: 'income',
        portal: 'Shop',
        title: `Product Sale - ${sale.invoiceNumber || 'Sale'}`,
        subtitle: `Customer: ${sale.customerName || 'Walk-in'}`,
        amount: sale.totalAmount || sale.total || 0,
        date: sale.createdAt || sale.date,
        reference: sale.invoiceNumber || sale.id,
        status: sale.status || 'Paid',
        color: 'emerald'
      })
    })

    // Appointments (Income) - use filtered data
    dateFilteredAppts.filter(apt => apt.status === 'Completed' && apt.fee).forEach(apt => {
      transactions.push({
        id: apt._id || apt.id,
        type: 'income',
        portal: 'Reception',
        title: `Appointment Fee - ${apt.petName || 'Pet'}`,
        subtitle: `Doctor: ${apt.doctorName || 'Unknown'}`,
        amount: apt.fee || 0,
        date: apt.createdAt || apt.date,
        reference: apt.id || apt.appointmentId,
        status: 'Paid',
        color: 'emerald'
      })
    })

    // Prescriptions (Income - if they have fees) - use filtered data
    dateFilteredPrescriptions.filter(presc => presc.amount).forEach(presc => {
      transactions.push({
        id: presc._id || presc.id,
        type: 'income',
        portal: 'Doctor',
        title: `Prescription Fee`,
        subtitle: `Patient: ${presc.patient?.petName || 'Unknown'}`,
        amount: presc.amount || 0,
        date: presc.createdAt || presc.when,
        reference: presc.id,
        status: 'Paid',
        color: 'emerald'
      })
    })

    // Sort by date (newest first) and return top 10
    return transactions
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10)
  }, [dateFilteredLabReports, dateFilteredPharmacySales, dateFilteredShopSales, dateFilteredAppts, dateFilteredPrescriptions])

  const recentTransactions = getAllTransactions

  return (
    <div className="space-y-8">
      {/* Professional Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
          Admin Dashboard
        </h1>
        <p className="text-slate-600 text-lg">Complete hospital management overview</p>
      </div>

      {/* Professional Date Range Picker */}
      <div className="rounded-2xl bg-gradient-to-br from-white via-indigo-50 to-purple-50 shadow-xl ring-1 ring-indigo-200 border border-indigo-100 p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <FiCalendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-indigo-600">Date Range</div>
              <div className="text-lg font-bold text-slate-800">
                {dateRange.fromDate === dateRange.toDate 
                  ? formatDate(dateRange.fromDate)
                  : `${new Date(dateRange.fromDate).toLocaleDateString()} - ${new Date(dateRange.toDate).toLocaleDateString()}`
                }
              </div>
            </div>
          </div>
          
          <DateRangePicker 
            onDateChange={handleDateRangeChange}
            defaultFromDate={dateRange.fromDate}
            defaultToDate={dateRange.toDate}
            showAllButton={true}
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <div className="text-slate-500 font-medium">Loading dashboard data...</div>
          <div className="mt-4 space-y-2">
            <button 
              onClick={() => setLoading(false)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Skip Loading
            </button>
            <div className="text-xs text-slate-400">
              Data Status: Pets({pets.length}) | Appointments({appointments.length}) | Financials({financials.length})
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Main Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            <StatCard 
              title="Appointments"
              value={dateFilteredAppts.length.toString()} 
              bg="bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50" 
              icon={FiCalendar}
              trend="+12%"
              subtitle={`${appointments.length} total`}
              onClick={() => navigate('/reception/appointments')}
            />
            <StatCard 
              title="Pet Registrations"
              value={totalPets.toString()} 
              bg="bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50" 
              icon={FiUsers}
              trend="+8%"
              subtitle={`${pets.length} total pets`}
              onClick={() => navigate('/admin/pets')}
            />
            <StatCard 
              title="Total Income"
              value={`Rs. ${totalIncome.toLocaleString()}`} 
              bg="bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50" 
              icon={FiDollarSign}
              trend="+15%"
              subtitle="From all portals"
              onClick={() => navigate('/admin/financials')}
            />
            <StatCard 
              title="Lab Tests" 
              value={dateFilteredLabReports.length.toString()} 
              bg="bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50" 
              icon={FiActivity}
              subtitle={`${pendingTests} pending`}
              onClick={() => navigate('/lab/reports')}
            />
          </div>

          {/* Secondary Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="rounded-2xl p-6 bg-gradient-to-br from-green-50 to-emerald-100 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                  <FiCheckCircle className="w-5 h-5 text-white" />
                </div>
                <div className="text-sm font-semibold text-green-700">Completed</div>
              </div>
              <div className="text-3xl font-bold text-slate-900">{completedAppts}</div>
              <div className="text-xs text-slate-600 mt-1">Appointments completed</div>
            </div>

            <div className="rounded-2xl p-6 bg-gradient-to-br from-amber-50 to-orange-100 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center">
                  <FiClock className="w-5 h-5 text-white" />
                </div>
                <div className="text-sm font-semibold text-amber-700">Pending</div>
              </div>
              <div className="text-3xl font-bold text-slate-900">{pendingAppts}</div>
              <div className="text-xs text-slate-600 mt-1">Appointments pending</div>
            </div>

            <div className="rounded-2xl p-6 bg-gradient-to-br from-red-50 to-pink-100 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center">
                  <FiAlertCircle className="w-5 h-5 text-white" />
                </div>
                <div className="text-sm font-semibold text-red-700">Urgent</div>
              </div>
              <div className="text-3xl font-bold text-slate-900">{pendingTests}</div>
              <div className="text-xs text-slate-600 mt-1">Lab tests pending</div>
            </div>
          </div>
        </>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-white shadow-xl ring-1 ring-slate-200/70 p-6 hover:shadow-2xl transition-shadow duration-300">
          <DailyIncomeChart data={dailyIncomeByDow} />
        </div>
        <div className="rounded-2xl bg-white shadow-xl ring-1 ring-slate-200/70 p-6 hover:shadow-2xl transition-shadow duration-300">
          <ComparisonChart sales={salesTotal} purchases={purchasesTotal} expenses={otherExpensesTotal} />
        </div>
      </div>

      <div className="rounded-2xl bg-white shadow-md ring-1 ring-slate-200/70 p-6">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-slate-900">Recent Transactions</h3>
          <p className="text-sm text-slate-500 mt-1">Latest financial activities from all portals</p>
        </div>
        
        <div className="space-y-4">
          {recentTransactions.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-slate-400 mb-2">
                <FiActivity className="w-12 h-12 mx-auto" />
              </div>
              <p className="text-slate-500">No recent transactions found</p>
            </div>
          ) : (
            recentTransactions.map((transaction, index) => (
              <div key={transaction.id || index} className="flex items-start gap-4 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                <div className={`w-1 h-12 ${transaction.color === 'emerald' ? 'bg-emerald-500' : 'bg-red-500'} rounded-full flex-shrink-0`}></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-semibold text-slate-900 text-sm">{transaction.title}</h4>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        transaction.type === 'income' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {transaction.type === 'income' ? 'Income' : 'Expense'}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                        {transaction.portal}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mb-1">{transaction.subtitle}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(transaction.date).toLocaleDateString()} • Ref: {transaction.reference}
                  </p>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-bold ${
                    transaction.type === 'income' ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {transaction.type === 'income' ? '+' : '-'}PKR {transaction.amount.toLocaleString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
          <div className="text-sm text-slate-500">
            Showing {Math.min(recentTransactions.length, 10)} of {recentTransactions.length} recent transactions
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">All Portals</span>
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                Live Data
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
