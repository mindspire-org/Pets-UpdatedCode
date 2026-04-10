import React, { useEffect, useMemo, useState } from 'react'
import { petsAPI, prescriptionsAPI, appointmentsAPI } from '../../services/api'
import ExpenseCard from '../../components/ExpenseCard'
import DateRangePicker from '../../components/DateRangePicker'

export default function DoctorDashboard(){
  let auth
  try { auth = JSON.parse(localStorage.getItem('doctor_auth') || '{}') } catch {}
  const doctorName = auth?.name || auth?.username || 'Doctor'

  const [todayStats, setTodayStats] = useState({ total:0, treated:0, pending:0 })
  const [totals, setTotals] = useState({ patients:0, prescriptions:0 })
  const [series, setSeries] = useState([]) // last 7 days
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState({
    fromDate: new Date().toISOString().slice(0,10),
    toDate: new Date().toISOString().slice(0,10)
  })

  const handleDateRangeChange = (newDateRange) => {
    setDateRange(newDateRange)
  }

  // Date filtering function
  const isDateInRange = (dateStr) => {
    if (!dateStr) return false
    const date = new Date(dateStr).toISOString().slice(0,10)
    return date >= dateRange.fromDate && date <= dateRange.toDate
  }

  useEffect(()=>{
    fetchData()
  }, [dateRange.fromDate, dateRange.toDate])

  const fetchData = async () => {
      // Prevent multiple simultaneous calls
      if (loading) return
      
      setLoading(true)
      try {
        // Fetch data from MongoDB API
        const [petsResponse, prescriptionsResponse, appointmentsResponse] = await Promise.all([
          petsAPI.getAll(),
          prescriptionsAPI.getAll(),
          appointmentsAPI.getAll()
        ])

        const pets = petsResponse?.data || []
        const prs = prescriptionsResponse?.data || []
        const appointments = appointmentsResponse?.data || []
        
        const startOfDay = (d)=>{ const x=new Date(d); x.setHours(0,0,0,0); return +x }
        const isToday = (ms)=> startOfDay(ms) === startOfDay(Date.now())

        // map for quick treated-by-patient today
        const treatedTodayIds = new Set((prs||[]).filter(p=>isToday(new Date(p.when))).map(p=>p.patient?.id).filter(Boolean))

        // Count only patients with appointments for today
        const appointmentsToday = appointments.filter(apt => {
          return isToday(new Date(apt.date || apt.createdAt))
        })
        const totalToday = appointmentsToday.length
        const treatedToday = (prs||[]).filter(p=>isToday(new Date(p.when))).length
        const pendingToday = Math.max(totalToday - treatedToday, 0)
        setTodayStats({ total: totalToday, treated: treatedToday, pending: pendingToday })

        const prescriptionsInRange = (prs||[]).filter(p=>{
          const ts = p.when || p.createdAt
          return isDateInRange(ts)
        })

        const appointmentsInRange = (appointments||[]).filter(apt => isDateInRange(apt.date || apt.createdAt))
        const patientKeys = new Set()
        appointmentsInRange.forEach(apt => {
          if (apt.petId) {
            patientKeys.add(`id:${apt.petId}`)
          } else {
            const key = `${(apt.petName||'').trim().toLowerCase()}|${(apt.ownerName||'').trim().toLowerCase()}`
            if (key !== '|') patientKeys.add(key)
          }
        })

        setTotals({ patients: patientKeys.size, prescriptions: prescriptionsInRange.length })

        // Build last 7 days series based on appointments
        const days = [...Array(7)].map((_,i)=>{
          const d = new Date(); d.setDate(d.getDate()-(6-i)); d.setHours(0,0,0,0); return d
        })
        const dayKey = d=> d.toISOString().slice(0,10)
        const appointmentsByDay = {}
        const prsByDay = {}
        ;(appointments||[]).forEach(apt=>{ const k=dayKey(new Date(apt.date||apt.createdAt||Date.now())); appointmentsByDay[k]=(appointmentsByDay[k]||0)+1 })
        ;(prs||[]).forEach(p=>{ const k=dayKey(new Date(p.when||Date.now())); prsByDay[k]=(prsByDay[k]||0)+1 })
        setSeries(days.map(d=>({ date: dayKey(d), visits: appointmentsByDay[dayKey(d)]||0, treated: prsByDay[dayKey(d)]||0 })))
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
        // Fallback to localStorage if API fails
        try {
          const pets = JSON.parse(localStorage.getItem('reception_pets')||'[]')||[]
          const prs = JSON.parse(localStorage.getItem('doctor_prescriptions')||'[]')||[]
          // ... same logic as above
        } catch (e) {
          console.error('Fallback error:', e)
        }
      } finally {
        setLoading(false)
      }
    }

  // chart params
  const maxY = Math.max(5, ...series.map(s=>Math.max(s.visits, s.treated)))
  const allZero = series.length>0 && series.every(s=> (s.visits||0)===0 && (s.treated||0)===0)

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-sky-600 bg-clip-text text-transparent">Doctor Dashboard</h1>
        <p className="text-slate-500 mt-1">Welcome back! Here's your practice overview</p>
      </div>

      {/* Date Range Picker */}
      <div className="rounded-2xl bg-gradient-to-br from-white via-emerald-50 to-sky-50 shadow-xl ring-1 ring-emerald-200 border border-emerald-100 p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-sky-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
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
          
          <DateRangePicker 
            onDateChange={handleDateRangeChange}
            defaultFromDate={dateRange.fromDate}
            defaultToDate={dateRange.toDate}
            showAllButton={true}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-50 to-sky-100 border border-sky-200/50 p-6 hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer">
          <div className="absolute top-0 right-0 w-20 h-20 bg-sky-200/30 rounded-full -translate-y-10 translate-x-10"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sky-700 text-sm font-medium">Patients Today</div>
              <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-800">{todayStats.total}</div>
            <div className="text-xs text-sky-600 mt-1">Total visits registered</div>
          </div>
        </div>
        
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50 to-green-100 border border-emerald-200/50 p-6 hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-200/30 rounded-full -translate-y-10 translate-x-10"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <div className="text-emerald-700 text-sm font-medium">Treated Today</div>
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/></svg>
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-800">{todayStats.treated}</div>
            <div className="text-xs text-emerald-600 mt-1">Prescriptions issued</div>
          </div>
        </div>
        
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50 to-orange-100 border border-amber-200/50 p-6 hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer">
          <div className="absolute top-0 right-0 w-20 h-20 bg-amber-200/30 rounded-full -translate-y-10 translate-x-10"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <div className="text-amber-700 text-sm font-medium">Pending</div>
              <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/></svg>
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-800">{todayStats.pending}</div>
            <div className="text-xs text-amber-600 mt-1">Awaiting treatment</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="group rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-100 border border-purple-200/50 p-6 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <div className="text-purple-700 text-sm font-medium">Total Patients</div>
            <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/></svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-800">{totals.patients}</div>
          <div className="text-xs text-purple-600 mt-1">All time registrations</div>
        </div>
        
        <div className="group rounded-2xl bg-gradient-to-br from-rose-50 to-pink-100 border border-rose-200/50 p-6 hover:shadow-lg transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <div className="text-rose-700 text-sm font-medium">Total Prescriptions</div>
            <div className="w-8 h-8 bg-rose-500 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-800">{totals.prescriptions}</div>
          <div className="text-xs text-rose-600 mt-1">Medicines prescribed</div>
        </div>

        <ExpenseCard 
          portal="doctor" 
          title="Doctor" 
          color="purple" 
        />
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-gray-100 border border-slate-200/50 shadow-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-slate-800 font-bold text-lg">Last 7 Days Analytics</div>
            <div className="text-xs text-slate-500 mt-1">Visits vs Treated comparison</div>
          </div>
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>
          </div>
        </div>
        {(!series || series.length===0 || allZero) ? (
          <div className="h-48 flex flex-col items-center justify-center text-slate-400">
            <svg className="w-16 h-16 mb-4 opacity-50" fill="currentColor" viewBox="0 0 20 20"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>
            <div className="text-sm font-medium">No data yet</div>
            <div className="text-xs">Add patients and prescriptions to see trends</div>
          </div>
        ) : (
          <div className="mt-4">
            <svg viewBox="0 0 800 260" className="w-full h-64">
              {(()=>{
                const W=800, H=260, PL=48, PR=12, PT=10, PB=28
                const cw=W-PL-PR, ch=H-PT-PB
                const n=series.length
                const step=cw/n
                const barW=Math.max(10, step*0.32)
                const maxV=maxY
                const y=(v)=> PT + ch - (v/maxV)*ch
                const x=(i)=> PL + i*step + step*0.5
                const ticks=5
                const lines=[]
                for(let t=0;t<=ticks;t++){
                  const vy = (maxV/ticks)*t
                  const yy = y(vy)
                  lines.push(
                    <g key={`g${t}`}>
                      <line x1={PL} x2={W-PR} y1={yy} y2={yy} stroke="#e2e8f0" strokeDasharray="4 4" />
                      <text x={PL-6} y={yy+4} fontSize="10" textAnchor="end" fill="#64748b">{Math.round(vy)}</text>
                    </g>
                  )
                }
                const bars = series.map((s,i)=>{
                  const cx = x(i)
                  const vH = Math.max(0, ch - (y(s.visits)-PT))
                  const tH = Math.max(0, ch - (y(s.treated)-PT))
                  return (
                    <g key={`b${i}`}>
                      <rect x={cx-barW-2} y={y(s.visits)} width={barW} height={vH} fill="#38bdf8" rx="4" />
                      <rect x={cx+2} y={y(s.treated)} width={barW} height={tH} fill="#34d399" rx="4" />
                      <text x={cx} y={H-8} fontSize="10" textAnchor="middle" fill="#94a3b8">{series[i].date.slice(5)}</text>
                    </g>
                  )
                })
                return (
                  <g>
                    {/* axes */}
                    <line x1={PL} y1={PT} x2={PL} y2={H-PB} stroke="#94a3b8" />
                    <line x1={PL} y1={H-PB} x2={W-PR} y2={H-PB} stroke="#94a3b8" />
                    {lines}
                    {bars}
                  </g>
                )
              })()}
            </svg>
            <div className="mt-4 flex items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-2 px-3 py-1 bg-sky-50 rounded-full border border-sky-200">
                <span className="w-3 h-3 bg-gradient-to-r from-sky-400 to-blue-500 inline-block rounded-full"></span> 
                <span className="text-sky-700 font-medium">Visits</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 rounded-full border border-emerald-200">
                <span className="w-3 h-3 bg-gradient-to-r from-emerald-400 to-green-500 inline-block rounded-full"></span> 
                <span className="text-emerald-700 font-medium">Treated</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
