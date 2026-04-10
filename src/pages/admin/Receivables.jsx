import React, { useEffect, useState } from 'react'
import { receivablesAPI } from '../../services/api'

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-')
const todayStr = () => new Date().toISOString().slice(0,10)
const monthStartStr = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0,10) }

export default function Receivables() {
  const [portal, setPortal] = useState('all')
  const [status, setStatus] = useState('open')
  const [from, setFrom] = useState(todayStr())
  const [to, setTo] = useState(todayStr())
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [allocOpenId, setAllocOpenId] = useState('')
  const [allocAmount, setAllocAmount] = useState('')
  const [allocMethod, setAllocMethod] = useState('Cash')
  const [allocNote, setAllocNote] = useState('')

  const [form, setForm] = useState({ portal: 'reception', customerId: '', patientId: '', customerName: '', refType: '', refId: '', billDate: '', description: '', totalAmount: '' })

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await receivablesAPI.list(portal, status, from, to)
      setRows(res?.data || [])
    } catch (e) {
      setRows([])
      setError(e?.message || 'Failed to load')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [portal, status, from, to])

  const create = async () => {
    try {
      const payload = { ...form, totalAmount: Number(form.totalAmount||0), balance: Number(form.totalAmount||0) }
      await receivablesAPI.create(payload)
      setCreateOpen(false)
      await load()
    } catch (e) {
      alert(e?.response?.message || e?.message || 'Failed to create receivable')
    }
  }

  const allocate = async () => {
    try {
      await receivablesAPI.allocate(allocOpenId, portal === 'all' ? 'admin' : portal, Number(allocAmount||0), allocMethod, allocNote)
      setAllocOpenId(''); setAllocAmount(''); setAllocMethod('Cash'); setAllocNote('')
      await load()
    } catch (e) {
      alert(e?.response?.message || e?.message || 'Failed to allocate payment')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">Receivables</h1>
        <div className="flex items-center gap-2">
          <select className="border rounded-md px-3 py-2" value={portal} onChange={e=>setPortal(e.target.value)}>
            <option value="all">All Portals</option>
            <option value="reception">Reception</option>
            <option value="pharmacy">Pharmacy</option>
            <option value="lab">Lab</option>
            <option value="shop">Pet Shop</option>
          </select>
          <select className="border rounded-md px-3 py-2" value={status} onChange={e=>setStatus(e.target.value)}>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="">All</option>
          </select>
          <input type="date" className="border rounded-md px-3 py-2" value={from} onChange={e=>setFrom(e.target.value)} />
          <input type="date" className="border rounded-md px-3 py-2" value={to} onChange={e=>setTo(e.target.value)} />
          <button onClick={()=>setCreateOpen(true)} className="px-3 py-2 rounded-md bg-indigo-600 text-white">New</button>
          <button onClick={load} className="px-3 py-2 rounded-md border">Refresh</button>
          {loading && <span className="text-xs text-slate-500">Loading…</span>}
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-3 overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-2 pr-3">Portal</th>
              <th className="py-2 pr-3">Customer</th>
              <th className="py-2 pr-3">Ref</th>
              <th className="py-2 pr-3">Date</th>
              <th className="py-2 pr-3">Desc</th>
              <th className="py-2 pr-3 text-right">Total</th>
              <th className="py-2 pr-3 text-right">Balance</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {(rows||[]).map(r => (
              <tr key={r._id} className="border-t">
                <td className="py-2 pr-3">{r.portal}</td>
                <td className="py-2 pr-3">{r.customerName || r.customerId || '-'}</td>
                <td className="py-2 pr-3">{r.refType} {r.refId}</td>
                <td className="py-2 pr-3">{r.billDate ? new Date(r.billDate).toLocaleDateString() : ''}</td>
                <td className="py-2 pr-3">{r.description}</td>
                <td className="py-2 pr-3 text-right">{fmt(r.totalAmount)}</td>
                <td className="py-2 pr-3 text-right">{fmt(r.balance)}</td>
                <td className="py-2 pr-3">{r.status}</td>
                <td className="py-2 pr-3 text-right">
                  {r.status === 'open' && (
                    <button onClick={()=>{ setAllocOpenId(r._id); setAllocAmount(r.balance); setAllocMethod('Cash'); }} className="px-2 py-1 rounded-md border text-xs">Allocate</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-4">
            <div className="flex items-center justify-between mb-2"><div className="font-semibold">New Receivable</div><button onClick={()=>setCreateOpen(false)} className="h-7 w-7 grid place-items-center border rounded">✕</button></div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Portal</label>
                <select className="w-full border rounded-md px-2 py-1" value={form.portal} onChange={e=>setForm(f=>({...f, portal: e.target.value}))}>
                  <option value="reception">Reception</option>
                  <option value="pharmacy">Pharmacy</option>
                  <option value="lab">Lab</option>
                  <option value="shop">Pet Shop</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Bill Date</label>
                <input type="date" className="w-full border rounded-md px-2 py-1" value={form.billDate} onChange={e=>setForm(f=>({...f, billDate: e.target.value}))} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 mb-1">Customer Name</label>
                <input className="w-full border rounded-md px-2 py-1" value={form.customerName} onChange={e=>setForm(f=>({...f, customerName: e.target.value}))} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 mb-1">Description</label>
                <input className="w-full border rounded-md px-2 py-1" value={form.description} onChange={e=>setForm(f=>({...f, description: e.target.value}))} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 mb-1">Amount</label>
                <input type="number" min="0" className="w-full border rounded-md px-2 py-1" value={form.totalAmount} onChange={e=>setForm(f=>({...f, totalAmount: e.target.value}))} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-3">
              <button onClick={()=>setCreateOpen(false)} className="px-3 py-1.5 text-xs rounded-md border">Cancel</button>
              <button onClick={create} className="px-3 py-1.5 text-xs rounded-md bg-indigo-600 text-white">Create</button>
            </div>
          </div>
        </div>
      )}

      {allocOpenId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-4">
            <div className="flex items-center justify-between mb-2"><div className="font-semibold">Allocate Payment</div><button onClick={()=>setAllocOpenId('')} className="h-7 w-7 grid place-items-center border rounded">✕</button></div>
            <div className="space-y-2 text-sm">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Amount</label>
                <input type="number" min="0" className="w-full border rounded-md px-2 py-1" value={allocAmount} onChange={e=>setAllocAmount(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Payment Method</label>
                <select className="w-full border rounded-md px-2 py-1" value={allocMethod} onChange={e=>setAllocMethod(e.target.value)}>
                  <option>Cash</option>
                  <option>Bank</option>
                  <option>Card</option>
                  <option>Online</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Note</label>
                <input className="w-full border rounded-md px-2 py-1" value={allocNote} onChange={e=>setAllocNote(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-3">
              <button onClick={()=>setAllocOpenId('')} className="px-3 py-1.5 text-xs rounded-md border">Cancel</button>
              <button onClick={allocate} className="px-3 py-1.5 text-xs rounded-md bg-emerald-600 text-white">Allocate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
