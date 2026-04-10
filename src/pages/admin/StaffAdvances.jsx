import React, { useEffect, useState } from 'react'
import { staffAdvancesAPI, payablesAPI } from '../../services/api'

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-')
const todayStr = () => new Date().toISOString().slice(0,10)

export default function StaffAdvances() {
  const [portal, setPortal] = useState('admin')
  const [status, setStatus] = useState('open')
  const [from, setFrom] = useState(todayStr())
  const [to, setTo] = useState(todayStr())
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ portal: 'admin', staffId: '', staffName: '', amount: '' })

  const [adjustOpenId, setAdjustOpenId] = useState('')
  const [adjType, setAdjType] = useState('salary_deduction')
  const [adjAmount, setAdjAmount] = useState('')
  const [adjNote, setAdjNote] = useState('')
  const [payableId, setPayableId] = useState('')
  const [openPayables, setOpenPayables] = useState([])
  const [returnPaymentMethod, setReturnPaymentMethod] = useState('Cash')
  const [allocRows, setAllocRows] = useState([{ accountCode: '5910', amount: '' }])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await staffAdvancesAPI.list(portal, status, '', from, to)
      setRows(res?.data || [])
    } catch (e) {
      setRows([])
      setError(e?.message || 'Failed to load')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [portal, status, from, to])

  useEffect(() => {
    const fetchOpenPayables = async () => {
      try {
        const res = await payablesAPI.list(portal, 'open')
        setOpenPayables(res?.data || [])
      } catch { setOpenPayables([]) }
    }
    if (adjustOpenId && adjType === 'bill_settlement') fetchOpenPayables()
  }, [adjustOpenId, adjType, portal])

  const create = async () => {
    try {
      await staffAdvancesAPI.create({ ...form, portal, amount: Number(form.amount||0) })
      setCreateOpen(false)
      setForm({ portal: 'admin', staffId: '', staffName: '', amount: '' })
      await load()
    } catch (e) {
      alert(e?.response?.message || e?.message || 'Failed to create staff advance')
    }
  }

  const adjust = async () => {
    try {
      let payload = { type: adjType, note: adjNote }
      if (adjType === 'bill_settlement') {
        payload = { ...payload, amount: Number(adjAmount||0), payableId }
      } else if (adjType === 'salary_deduction') {
        payload = { ...payload, amount: Number(adjAmount||0) }
      } else if (adjType === 'return_cash') {
        payload = { ...payload, amount: Number(adjAmount||0), paymentMethod: returnPaymentMethod }
      } else if (adjType === 'expense_allocation') {
        const lines = (allocRows||[])
          .map(r => ({ accountCode: String(r.accountCode||'').trim(), amount: Number(r.amount||0) }))
          .filter(r => r.accountCode && r.amount > 0)
        const total = lines.reduce((s, l) => s + l.amount, 0)
        payload = { ...payload, amount: total, lines }
      }
      if (!payload.amount || payload.amount <= 0) { alert('Enter a valid amount'); return }
      await staffAdvancesAPI.adjust(adjustOpenId, portal, payload)
      setAdjustOpenId(''); setAdjType('salary_deduction'); setAdjAmount(''); setAdjNote(''); setPayableId(''); setReturnPaymentMethod('Cash'); setAllocRows([{ accountCode: '5910', amount: '' }])
      await load()
    } catch (e) {
      alert(e?.response?.message || e?.message || 'Failed to adjust staff advance')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">Staff Advances</h1>
        <div className="flex items-center gap-2">
          <select className="border rounded-md px-3 py-2" value={portal} onChange={e=>setPortal(e.target.value)}>
            <option value="admin">Admin</option>
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
          <button onClick={()=>setCreateOpen(true)} className="px-3 py-2 rounded-md bg-indigo-600 text-white">New Advance</button>
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
              <th className="py-2 pr-3">Staff</th>
              <th className="py-2 pr-3 text-right">Amount</th>
              <th className="py-2 pr-3 text-right">Balance</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {(rows||[]).map(r => (
              <tr key={r._id} className="border-t">
                <td className="py-2 pr-3">{r.portal}</td>
                <td className="py-2 pr-3">{r.staffName || r.staffId}</td>
                <td className="py-2 pr-3 text-right">{fmt(r.amount)}</td>
                <td className="py-2 pr-3 text-right">{fmt(r.balance)}</td>
                <td className="py-2 pr-3">{r.status}</td>
                <td className="py-2 pr-3 text-right">
                  {r.status === 'open' && (
                    <button className="px-2 py-1 rounded-md border text-xs" onClick={()=>{ setAdjustOpenId(r._id); setAdjType('salary_deduction'); setAdjAmount(r.balance); }}>Adjust</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-4">
            <div className="flex items-center justify-between mb-2"><div className="font-semibold">New Advance</div><button onClick={()=>setCreateOpen(false)} className="h-7 w-7 grid place-items-center border rounded">✕</button></div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Portal</label>
                <select className="w-full border rounded-md px-2 py-1" value={form.portal} onChange={e=>setForm(f=>({...f, portal: e.target.value}))}>
                  <option value="admin">Admin</option>
                  <option value="pharmacy">Pharmacy</option>
                  <option value="lab">Lab</option>
                  <option value="shop">Pet Shop</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Staff Name/ID</label>
                <input className="w-full border rounded-md px-2 py-1" value={form.staffName} onChange={e=>setForm(f=>({...f, staffName: e.target.value, staffId: e.target.value}))} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 mb-1">Amount</label>
                <input type="number" min="0" className="w-full border rounded-md px-2 py-1" value={form.amount} onChange={e=>setForm(f=>({...f, amount: e.target.value}))} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-3">
              <button onClick={()=>setCreateOpen(false)} className="px-3 py-1.5 text-xs rounded-md border">Cancel</button>
              <button onClick={create} className="px-3 py-1.5 text-xs rounded-md bg-indigo-600 text-white">Create</button>
            </div>
          </div>
        </div>
      )}

      {adjustOpenId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-4">
            <div className="flex items-center justify-between mb-2"><div className="font-semibold">Adjust Advance</div><button onClick={()=>setAdjustOpenId('')} className="h-7 w-7 grid place-items-center border rounded">✕</button></div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Type</label>
                <select className="w-full border rounded-md px-2 py-1" value={adjType} onChange={e=>setAdjType(e.target.value)}>
                  <option value="salary_deduction">Salary Deduction</option>
                  <option value="bill_settlement">Bill Settlement</option>
                  <option value="expense_allocation">Expense Allocation</option>
                  <option value="return_cash">Return Cash</option>
                </select>
              </div>
              {adjType !== 'expense_allocation' && (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Amount</label>
                  <input type="number" min="0" className="w-full border rounded-md px-2 py-1" value={adjAmount} onChange={e=>setAdjAmount(e.target.value)} />
                </div>
              )}
              {adjType === 'bill_settlement' && (
                <div className="col-span-2">
                  <label className="block text-xs text-slate-500 mb-1">Select Payable</label>
                  <select className="w-full border rounded-md px-2 py-1" value={payableId} onChange={e=>setPayableId(e.target.value)}>
                    <option value="">Choose…</option>
                    {(openPayables||[]).map(p => (
                      <option key={p._id} value={p._id}>{p.portal} • {p.billRef} • {p.supplierName} • Bal {fmt(p.balance)}</option>
                    ))}
                  </select>
                </div>
              )}
              {adjType === 'return_cash' && (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Payment Method</label>
                  <select className="w-full border rounded-md px-2 py-1" value={returnPaymentMethod} onChange={e=>setReturnPaymentMethod(e.target.value)}>
                    <option>Cash</option>
                    <option>Bank Transfer</option>
                    <option>Card</option>
                    <option>Online</option>
                  </select>
                </div>
              )}
              {adjType === 'expense_allocation' && (
                <div className="col-span-2">
                  <label className="block text-xs text-slate-500 mb-1">Expense Allocations</label>
                  <div className="space-y-2">
                    {(allocRows||[]).map((row, idx) => (
                      <div key={idx} className="grid grid-cols-3 gap-2">
                        <select className="border rounded-md px-2 py-1" value={row.accountCode} onChange={e=>setAllocRows(rs=>rs.map((r,i)=>i===idx?{...r, accountCode:e.target.value}:r))}>
                          <option value="5910">Travel (5910)</option>
                          <option value="5920">Food (5920)</option>
                          <option value="5990">Misc (5990)</option>
                          <option value="5900">Admin Expense (5900)</option>
                          <option value="5999">General Expense (5999)</option>
                        </select>
                        <input type="number" min="0" placeholder="Amount" className="border rounded-md px-2 py-1" value={row.amount} onChange={e=>setAllocRows(rs=>rs.map((r,i)=>i===idx?{...r, amount:e.target.value}:r))} />
                        <div className="flex items-center gap-2">
                          <button className="px-2 py-1 border rounded" onClick={()=>setAllocRows(rs=>rs.filter((_,i)=>i!==idx))}>Remove</button>
                          {idx===allocRows.length-1 && (
                            <button className="px-2 py-1 border rounded" onClick={()=>setAllocRows(rs=>[...rs, { accountCode: '5910', amount: '' }])}>Add</button>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="text-xs text-slate-500">Total: {fmt((allocRows||[]).reduce((s,r)=>s+Number(r.amount||0),0))}</div>
                  </div>
                </div>
              )}
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 mb-1">Note</label>
                <input className="w-full border rounded-md px-2 py-1" value={adjNote} onChange={e=>setAdjNote(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-3">
              <button onClick={()=>setAdjustOpenId('')} className="px-3 py-1.5 text-xs rounded-md border">Cancel</button>
              <button onClick={adjust} className="px-3 py-1.5 text-xs rounded-md bg-emerald-600 text-white">Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
