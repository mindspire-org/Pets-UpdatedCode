import React, { useMemo, useState, useEffect } from 'react'
import { FiFilter, FiSearch } from 'react-icons/fi'
import { appointmentsAPI } from '../../services/api'

export default function ReceptionReports(){
  const [appts, setAppts] = useState([])
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState('daily')
  const [date, setDate] = useState(new Date().toISOString().slice(0,10))
  const [month, setMonth] = useState(new Date().toISOString().slice(0,7))
  const [query, setQuery] = useState('')

  useEffect(() => {
    loadAppointments()
  }, [])

  const loadAppointments = async () => {
    try {
      setLoading(true)
      const response = await appointmentsAPI.getAll()
      setAppts(response?.data || [])
    } catch (err) {
      console.error('Error loading appointments:', err)
      try {
        const stored = localStorage.getItem('reception_appointments')
        if (stored) setAppts(JSON.parse(stored))
      } catch (e) {}
    } finally {
      setLoading(false)
    }
  }

  const filtered = appts.filter(a => {
    let ok = true
    const appointmentDate = a.appointmentDate || a.date || ''
    if(view==='daily') ok = appointmentDate.slice(0,10)===date
    if(view==='monthly') ok = appointmentDate.slice(0,7)===month
    if(!ok) return false
    const s = query.trim().toLowerCase()
    if(!s) return true
    return [a.petName,a.ownerName,a.doctor,a.status].some(v => String(v||'').toLowerCase().includes(s))
  })

  const total = filtered.length
  const completed = filtered.filter(a=>a.status==='Completed').length
  const cancelled = filtered.filter(a=>a.status==='Cancelled').length

  const toCSV = rows => {
    const headers = ['Pet Name','Owner Name','Doctor','Date','Time','Status']
    const lines = rows.map(r => [r.petName,r.ownerName,r.doctor,r.date,r.time,r.status].map(v=>`"${String(v||'').replace(/"/g,'""')}"`).join(','))
    return [headers.join(','), ...lines].join('\n')
  }

  const exportCSV = () => {
    const blob = new Blob([toCSV(filtered)], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `appointments-${view}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports</h1>

      <div className="rounded-2xl bg-white shadow-md ring-1 ring-slate-200/70 p-6">
        <div className="mb-4 flex items-center gap-2 text-slate-800 font-semibold"><FiFilter className="text-indigo-600" /> Filters</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          <select value={view} onChange={e=>setView(e.target.value)} className="h-10 px-3 rounded-lg border border-slate-300 bg-white">
            <option value="daily">Daily</option>
            <option value="monthly">Monthly</option>
          </select>
          {view==='daily' ? (
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="h-10 px-3 rounded-lg border border-slate-300 bg-white" />
          ) : (
            <input type="month" value={month} onChange={e=>setMonth(e.target.value)} className="h-10 px-3 rounded-lg border border-slate-300 bg-white" />
          )}
          <div className="flex items-center gap-2">
            <FiSearch className="text-slate-500" />
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search..." className="h-10 px-3 rounded-lg border border-slate-300 bg-white" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl p-5 shadow-md ring-1 bg-gradient-to-br from-indigo-50 to-white ring-indigo-200/70">
          <div className="text-sm/5 text-slate-700/80">Total Appointments</div>
          <div className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">{total}</div>
        </div>
        <div className="rounded-2xl p-5 shadow-md ring-1 bg-gradient-to-br from-emerald-50 to-white ring-emerald-200/70">
          <div className="text-sm/5 text-slate-700/80">Completed</div>
          <div className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">{completed}</div>
        </div>
        <div className="rounded-2xl p-5 shadow-md ring-1 bg-gradient-to-br from-amber-50 to-white ring-amber-200/70">
          <div className="text-sm/5 text-slate-700/80">Pending</div>
          <div className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">{filtered.filter(a=>a.status==='Pending').length}</div>
        </div>
        <div className="rounded-2xl p-5 shadow-md ring-1 bg-gradient-to-br from-red-50 to-white ring-red-200/70">
          <div className="text-sm/5 text-slate-700/80">Cancelled</div>
          <div className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">{cancelled}</div>
        </div>
      </div>

      <div className="rounded-2xl bg-white shadow-md ring-1 ring-slate-200/70 p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="text-slate-800 font-semibold">Appointments</div>
          <button onClick={exportCSV} className="px-3 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">Export CSV</button>
        </div>
        <ul className="divide-y divide-slate-100 text-sm">
          {filtered.map(r => (
            <li key={r.id} className="py-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-slate-800">{r.petName} • {r.ownerName}</div>
                <div className="text-xs text-slate-500">{r.doctor} • {r.date} {r.time}</div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-md ${r.status==='Completed'?'bg-emerald-100 text-emerald-700':r.status==='Cancelled'?'bg-red-100 text-red-700':'bg-amber-100 text-amber-700'}`}>{r.status}</span>
            </li>
          ))}
          {filtered.length===0 && (
            <li className="py-6 text-center text-slate-500">No matching records.</li>
          )}
        </ul>
      </div>
    </div>
  )
}