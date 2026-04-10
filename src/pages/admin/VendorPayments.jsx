import React, { useEffect, useMemo, useState } from 'react'
import { vendorPaymentsAPI, payablesAPI, suppliersAPI } from '../../services/api'
import VendorSelect from '../../components/VendorSelect'

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-')
const todayStr = () => new Date().toISOString().slice(0,10)
const monthStartStr = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0,10) }

export default function VendorPayments() {
  const [portal, setPortal] = useState('pharmacy')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [supplierId, setSupplierId] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [notes, setNotes] = useState('')
  const [allocations, setAllocations] = useState([]) // { payableId, amount }

  const [openPayables, setOpenPayables] = useState([])
  const [from, setFrom] = useState(todayStr())
  const [to, setTo] = useState(todayStr())
  const [suppliers, setSuppliers] = useState([])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await vendorPaymentsAPI.list(portal, from, to)
      setRows(res?.data || [])
    } catch (e) {
      setRows([])
      setError(e?.message || 'Failed to load')
    } finally { setLoading(false) }
  }

  const backfill = async () => {
    try {
      await vendorPaymentsAPI.backfill(portal, from, to)
      await load()
    } catch (e) {
      alert(e?.response?.message || e?.message || 'Backfill failed')
    }
  }

  const loadOpenPayables = async () => {
    try {
      // Use portal and supplierId from state to fetch specific unpaid payables
      const res = await payablesAPI.list(portal, 'open', supplierId || supplierName)
      setOpenPayables(res?.data || [])
    } catch { 
      setOpenPayables([]) 
    }
  }

  useEffect(() => { load() }, [portal, from, to])
  useEffect(() => { if (createOpen) loadOpenPayables() }, [createOpen, portal, supplierId])
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const res = await suppliersAPI.getAll(portal)
        setSuppliers(res?.data || [])
      } catch { setSuppliers([]) }
    }
    if (createOpen) fetchSuppliers()
  }, [createOpen, portal])

  const addAlloc = (p) => {
    setAllocations(prev => [...prev, { payableId: p._id, amount: p.balance }])
  }
  const removeAlloc = (idx) => setAllocations(prev => prev.filter((_, i) => i !== idx))

  const create = async () => {
    try {
      // Use manually entered amount, or sum of allocations if amount is empty/0
      const finalAmount = Number(amount) || (allocations || []).reduce((sum, a) => sum + Number(a.amount || 0), 0);
      
      if (finalAmount <= 0) {
        alert('Please enter a valid amount or add allocations.');
        return;
      }

      const payload = { 
        portal, 
        supplierId: supplierId || supplierName, 
        supplierName, 
        amount: finalAmount, 
        paymentMethod, 
        notes, 
        allocations: (allocations||[]).map(a => {
          const pInfo = openPayables.find(op => op._id === a.payableId);
          return { 
            payableId: a.payableId, 
            amount: Number(a.amount||0),
            billRef: pInfo?.billRef || ''
          };
        }) 
      }
      await vendorPaymentsAPI.create(payload)
      setCreateOpen(false)
      setSupplierId(''); setSupplierName(''); setAmount(''); setPaymentMethod('Cash'); setNotes(''); setAllocations([])
      await load()
    } catch (e) {
      alert(e?.response?.message || e?.message || 'Failed to create vendor payment')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">Vendor Payments</h1>
        <div className="flex items-center gap-2">
          <select className="border rounded-md px-3 py-2" value={portal} onChange={e=>setPortal(e.target.value)}>
            <option value="pharmacy">Pharmacy</option>
            <option value="lab">Lab</option>
            <option value="shop">Pet Shop</option>
            <option value="admin">Admin</option>
          </select>
          <input type="date" className="border rounded-md px-3 py-2" value={from} onChange={e=>setFrom(e.target.value)} />
          <input type="date" className="border rounded-md px-3 py-2" value={to} onChange={e=>setTo(e.target.value)} />
          <button onClick={()=>setCreateOpen(true)} className="px-3 py-2 rounded-md bg-indigo-600 text-white">New Payment</button>
          <button onClick={backfill} className="px-3 py-2 rounded-md border">Backfill</button>
          <button onClick={load} className="px-3 py-2 rounded-md border">Refresh</button>
          {loading && <span className="text-xs text-slate-500">Loading…</span>}
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-3 overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-2 pr-3">Date</th>
              <th className="py-2 pr-3">Portal</th>
              <th className="py-2 pr-3">Supplier</th>
              <th className="py-2 pr-3 text-right">Amount</th>
              <th className="py-2 pr-3">Method</th>
            </tr>
          </thead>
          <tbody>
            {(rows||[]).map(r => (
              <tr key={r._id} className="border-t">
                <td className="py-2 pr-3">{r.date ? new Date(r.date).toLocaleDateString() : ''}</td>
                <td className="py-2 pr-3">{r.portal}</td>
                <td className="py-2 pr-3">{r.supplierName || r.supplierId}</td>
                <td className="py-2 pr-3 text-right">{fmt(r.amount)}</td>
                <td className="py-2 pr-3">{r.paymentMethod}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-4">
            <div className="flex items-center justify-between mb-2"><div className="font-semibold">New Vendor Payment</div><button onClick={()=>setCreateOpen(false)} className="h-7 w-7 grid place-items-center border rounded">✕</button></div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Portal</label>
                <select className="w-full border rounded-md px-2 py-1" value={portal} onChange={e=>setPortal(e.target.value)}>
                  <option value="pharmacy">Pharmacy</option>
                  <option value="lab">Lab</option>
                  <option value="shop">Pet Shop</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Supplier</label>
                <VendorSelect
                  portal={portal}
                  value={supplierId}
                  onChange={(id, v) => {
                    setSupplierId(id)
                    setSupplierName(v?.supplierName || '')
                  }}
                  options={suppliers}
                  setOptions={setSuppliers}
                  allowNone={false}
                  placeholder="Select supplier…"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Amount</label>
                <input type="number" min="0" className="w-full border rounded-md px-2 py-1" value={amount} onChange={e=>setAmount(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Payment Method</label>
                <select className="w-full border rounded-md px-2 py-1" value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}>
                  <option>Cash</option>
                  <option>Bank</option>
                  <option>Card</option>
                  <option>Online</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 mb-1">Notes</label>
                <input className="w-full border rounded-md px-2 py-1" value={notes} onChange={e=>setNotes(e.target.value)} />
              </div>
            </div>

            <div className="mt-3">
              <div className="text-xs font-semibold text-slate-600 mb-1">Open Payables</div>
              <div className="rounded border p-2 max-h-40 overflow-auto text-xs bg-slate-50">
                <table className="min-w-full">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="py-1 pr-2">Bill</th>
                      <th className="py-1 pr-2">Supplier</th>
                      <th className="py-1 pr-2 text-right">Balance</th>
                      <th className="py-1 pr-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(openPayables || []).map(p => (
                      <tr key={p._id} className="border-t bg-white">
                        <td className="py-1 px-2">{p.billRef}</td>
                        <td className="py-1 px-2">{p.supplierName}</td>
                        <td className="py-1 px-2 text-right font-bold text-red-600">Rs{fmt(p.balance)}</td>
                        <td className="py-1 px-2 text-right">
                          <button 
                            type="button"
                            className="px-2 py-1 rounded-md border bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold" 
                            onClick={() => addAlloc(p)}
                          >
                            Add
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(openPayables || []).length === 0 && (
                      <tr>
                        <td colSpan="4" className="py-4 text-center text-slate-400 italic bg-white">No open payables found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-3">
              <div className="text-xs font-semibold text-slate-600 mb-1">Allocations</div>
              <div className="space-y-2 text-xs">
                {(allocations || []).map((a, idx) => {
                  const pInfo = openPayables.find(op => op._id === a.payableId);
                  return (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded border border-emerald-100 shadow-sm">
                      <div className="col-span-7 font-medium">
                        {pInfo?.billRef || 'Bill'} ({pInfo?.supplierName || 'Supplier'})
                      </div>
                      <div className="col-span-3">
                        <input 
                          type="number" 
                          min="0" 
                          className="w-full border rounded-md px-2 py-1 focus:ring-1 focus:ring-emerald-500 outline-none font-bold" 
                          value={a.amount} 
                          onChange={e => setAllocations(prev => prev.map((x, i) => i === idx ? { ...x, amount: e.target.value } : x))} 
                        />
                      </div>
                      <div className="col-span-2 text-right">
                        <button type="button" className="text-red-600 hover:text-red-800 font-semibold" onClick={() => removeAlloc(idx)}>Remove</button>
                      </div>
                    </div>
                  );
                })}
                {(allocations || []).length === 0 && (
                  <div className="text-slate-400 italic text-center py-2 bg-slate-50 rounded border border-dashed">No bills selected for allocation</div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-3">
              <button onClick={()=>setCreateOpen(false)} className="px-3 py-1.5 text-xs rounded-md border">Cancel</button>
              <button onClick={create} className="px-3 py-1.5 text-xs rounded-md bg-emerald-600 text-white">Create Payment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
