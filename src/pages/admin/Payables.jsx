import React, { useEffect, useState } from 'react'
import { payablesAPI, suppliersAPI } from '../../services/api'
import VendorSelect from '../../components/VendorSelect'
import { useAlert } from '../../context/AlertContext'

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-')
const todayStr = () => new Date().toISOString().slice(0,10)
const monthStartStr = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0,10) }

export default function Payables() {
  const { error: showError, success } = useAlert()
  const [portal, setPortal] = useState('all')
  const [status, setStatus] = useState('open')
  const [supplierId, setSupplierId] = useState('')
  const [from, setFrom] = useState(monthStartStr())
  const [to, setTo] = useState(todayStr())
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ portal: 'pharmacy', supplierId: '', supplierName: '', billRef: '', billDate: '', description: '', totalAmount: '' })

  const [allocOpenId, setAllocOpenId] = useState('')
  const [allocAmount, setAllocAmount] = useState('')
  const [allocMethod, setAllocMethod] = useState('Cash')
  const [allocNote, setAllocNote] = useState('')
  const [allocPortal, setAllocPortal] = useState('admin')

  const [supplierList, setSupplierList] = useState([])
  const [supplierLoading, setSupplierLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await payablesAPI.list(portal, status, supplierId, from, to)
      setRows(res?.data || [])
    } catch (e) {
      setRows([])
      setError(e?.message || 'Failed to load')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [portal, status, supplierId, from, to])

  // Load suppliers for selected portal when creating a new payable
  useEffect(() => {
    if (!createOpen) return
    let active = true
    const run = async () => {
      setSupplierLoading(true)
      try {
        const res = await suppliersAPI.getAll(form.portal)
        if (!active) return
        setSupplierList(res?.data || [])
      } catch (_) {
        if (!active) return
        setSupplierList([])
      } finally {
        if (active) setSupplierLoading(false)
      }
    }
    run()
    return () => { active = false }
  }, [createOpen, form.portal])

  const create = async () => {
    try {
      const payload = { ...form, totalAmount: Number(form.totalAmount||0), balance: Number(form.totalAmount||0) }
      await payablesAPI.create(payload)
      setCreateOpen(false)
      success('Payable created successfully!')
      await load()
    } catch (e) {
      showError(e?.response?.message || e?.message || 'Failed to create payable')
    }
  }

  const allocate = async () => {
    try {
      await payablesAPI.allocate(allocOpenId, allocPortal, Number(allocAmount||0), allocMethod, allocNote)
      setAllocOpenId(''); setAllocAmount(''); setAllocMethod('Cash'); setAllocNote('')
      success('Payment allocated successfully!')
      await load()
    } catch (e) {
      showError(e?.response?.message || e?.message || 'Failed to allocate payment')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">Payables</h1>
        <div className="flex items-center gap-2">
          <select className="border rounded-md px-3 py-2" value={portal} onChange={e=>setPortal(e.target.value)}>
            <option value="all">All Portals</option>
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
          <input placeholder="Supplier Id/Name" className="border rounded-md px-3 py-2" value={supplierId} onChange={e=>setSupplierId(e.target.value)} />
          <input type="date" className="border rounded-md px-3 py-2" value={from} onChange={e=>setFrom(e.target.value)} />
          <input type="date" className="border rounded-md px-3 py-2" value={to} onChange={e=>setTo(e.target.value)} />
          <button onClick={()=>{ setForm({ portal: portal !== 'all' ? portal : 'pharmacy', supplierId: '', supplierName: '', billRef: '', billDate: todayStr(), description: '', totalAmount: '' }); setCreateOpen(true) }} className="px-3 py-2 rounded-md bg-indigo-600 text-white">New</button>
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
              <th className="py-2 pr-3">Supplier</th>
              <th className="py-2 pr-3">Bill</th>
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
                <td className="py-2 pr-3">{r.supplierName || r.supplierId || '-'}</td>
                <td className="py-2 pr-3">{r.billRef}</td>
                <td className="py-2 pr-3">{r.billDate ? new Date(r.billDate).toLocaleDateString() : ''}</td>
                <td className="py-2 pr-3">{r.description}</td>
                <td className="py-2 pr-3 text-right">{fmt(r.totalAmount)}</td>
                <td className="py-2 pr-3 text-right">{fmt(r.balance)}</td>
                <td className="py-2 pr-3">{r.status}</td>
                <td className="py-2 pr-3 text-right">
                  {r.status === 'open' && (
                    <button onClick={()=>{ setAllocOpenId(r._id); setAllocAmount(r.balance); setAllocMethod('Cash'); setAllocPortal(r.portal); }} className="px-2 py-1 rounded-md border text-xs">Pay</button>
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
            <div className="flex items-center justify-between mb-2"><div className="font-semibold">New Payable</div><button onClick={()=>setCreateOpen(false)} className="h-7 w-7 grid place-items-center border rounded">✕</button></div>
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
                <label className="block text-xs text-slate-500 mb-1">Bill Date</label>
                <input type="date" className="w-full border rounded-md px-2 py-1" value={form.billDate} onChange={e=>setForm(f=>({...f, billDate: e.target.value}))} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Supplier</label>
                <VendorSelect
                  portal={form.portal}
                  value={form.supplierId}
                  onChange={(id, v) => setForm(f => ({ ...f, supplierId: id, supplierName: v?.supplierName || '' }))}
                  options={supplierList}
                  setOptions={setSupplierList}
                  allowNone={false}
                  placeholder={supplierLoading ? 'Loading…' : '-- Select Supplier --'}
                  disabled={supplierLoading}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Bill Ref</label>
                <input className="w-full border rounded-md px-2 py-1" value={form.billRef} onChange={e=>setForm(f=>({...f, billRef: e.target.value}))} />
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
            <div className="flex items-center justify-between mb-2"><div className="font-semibold">Pay Supplier</div><button onClick={()=>setAllocOpenId('')} className="h-7 w-7 grid place-items-center border rounded">✕</button></div>
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
