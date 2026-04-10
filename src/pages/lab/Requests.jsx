import React, { useEffect, useMemo, useState } from 'react'
import { FiSearch } from 'react-icons/fi'

export default function LabRequests(){
  const [items, setItems] = useState(()=>{
    try { return JSON.parse(localStorage.getItem('lab_requests')||'[]') } catch { return [] }
  })
  const [q, setQ] = useState('')

  useEffect(()=>{ localStorage.setItem('lab_requests', JSON.stringify(items)) }, [items])

  const filtered = useMemo(()=> items.filter(r=> (r.petName+r.ownerName+r.testType+r.doctorName).toLowerCase().includes(q.toLowerCase())), [items, q])

  const updateStatus = (id, status) => {
    setItems(prev => prev.map(r => r.id===id ? { ...r, status } : r))
    const acts = JSON.parse(localStorage.getItem('lab_activities')||'[]')
    acts.unshift({ text: `Updated ${id} to ${status}`, time: new Date().toLocaleString() })
    localStorage.setItem('lab_activities', JSON.stringify(acts))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Test Requests</h1>
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="h-10 pl-9 pr-4 w-64 rounded-lg border border-slate-300" placeholder="Search..." value={q} onChange={e=>setQ(e.target.value)} />
        </div>
      </div>
      <div className="rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500">
              <th className="py-3 px-4 font-medium">Pet</th>
              <th className="py-3 px-4 font-medium">Owner</th>
              <th className="py-3 px-4 font-medium">Test</th>
              <th className="py-3 px-4 font-medium">Doctor</th>
              <th className="py-3 px-4 font-medium">Request Date</th>
              <th className="py-3 px-4 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="py-3 px-4 font-medium text-slate-800">{r.petName}</td>
                <td className="py-3 px-4">{r.ownerName}</td>
                <td className="py-3 px-4">{r.testType}</td>
                <td className="py-3 px-4">{r.doctorName}</td>
                <td className="py-3 px-4">{r.requestDate}</td>
                <td className="py-3 px-4">
                  <select value={r.status||'Pending'} onChange={e=>updateStatus(r.id, e.target.value)} className="border border-slate-300 rounded-md h-9 px-2">
                    <option>Pending</option>
                    <option>Completed</option>
                  </select>
                </td>
              </tr>
            ))}
            {filtered.length===0 && (
              <tr><td className="py-6 px-4 text-center text-slate-500" colSpan={6}>No requests</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
