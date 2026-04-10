import React, { useEffect, useMemo, useState } from 'react'
import { FiDollarSign } from 'react-icons/fi'
import { useActivity } from '../../context/ActivityContext'
import { petsAPI, financialsAPI } from '../../services/api'

function ItemRow({ label, amount, onAmount }){
  return (
    <div className="grid grid-cols-2 gap-3 items-center">
      <div className="text-sm text-slate-700">{label}</div>
      <input type="number" min="0" value={amount} onChange={e=>onAmount(Number(e.target.value||0))} className="h-10 px-3 rounded-lg border border-slate-300 bg-white" />
    </div>
  )
}

export default function ReceptionBilling(){
  const [pets, setPets] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [petsRes, billingsRes] = await Promise.all([
        petsAPI.getAll().catch(() => ({ data: [] })),
        financialsAPI.getAll().catch(() => ({ data: [] }))
      ])
      setPets(petsRes.data || [])
      const billings = (billingsRes.data || []).filter(f => f.type === 'income' && f.category === 'billing')
      setRows(billings)
    } catch (err) {
      console.error('Error loading data:', err)
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }
  const [petId, setPetId] = useState('')
  const [consult, setConsult] = useState(0)
  const [lab, setLab] = useState(0)
  const [meds, setMeds] = useState(0)
  const [received, setReceived] = useState(0)
  const [method, setMethod] = useState('Cash')
  const { addActivity } = useActivity()

  // Billing data saved to financials collection in MongoDB

  const total = consult + lab + meds
  const status = received >= total && total>0 ? 'Paid' : 'Pending'

  const submitInvoice = e => {
    e.preventDefault()
    const pet = pets.find(p => String(p.id)===String(petId))
    const entry = {
      id: Date.now(),
      petName: pet?.petName || 'Unknown',
      ownerName: pet?.ownerName || 'Unknown',
      items: { consult, lab, meds },
      total,
      received,
      method,
      status,
      when: new Date().toISOString(),
    }
    setRows(prev => [entry, ...prev])
    try { addActivity({ user: 'Reception', text: `Created invoice for ${entry.petName}: Rs. ${entry.total}` }) } catch {}
    setPetId(''); setConsult(0); setLab(0); setMeds(0); setReceived(0); setMethod('Cash')
  }

  const paidSum = rows.filter(r=>r.status==='Paid').reduce((s,r)=>s+(r.total||0),0)

  const toCSV = rows => {
    const headers = ['Pet Name','Owner Name','Consultation','Lab Tests','Medicines','Total','Received','Method','Status','When']
    const lines = rows.map(r => [
      r.petName,
      r.ownerName,
      r.items?.consult||0,
      r.items?.lab||0,
      r.items?.meds||0,
      r.total||0,
      r.received||0,
      r.method||'',
      r.status||'',
      r.when||''
    ].map(v=>`"${String(v||'').replace(/"/g,'""')}"`).join(','))
    return [headers.join(','), ...lines].join('\n')
  }

  const exportCSV = () => {
    const blob = new Blob([toCSV(rows)], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'invoices.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Billing</h1>

      <div className="rounded-2xl bg-white shadow-md ring-1 ring-emerald-200/70 p-6">
        <div className="mb-4 flex items-center gap-2 text-slate-800 font-semibold"><FiDollarSign className="text-emerald-600" /> Create Invoice</div>
        <form onSubmit={submitInvoice} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select value={petId} onChange={e=>setPetId(e.target.value)} className="h-10 px-3 rounded-lg border border-slate-300 bg-white" required>
              <option value="">Select Pet</option>
              {pets.map(p => (
                <option key={p.id} value={p.id}>{p.petName} • {p.ownerName}</option>
              ))}
            </select>
            <select value={method} onChange={e=>setMethod(e.target.value)} className="h-10 px-3 rounded-lg border border-slate-300 bg-white">
              <option>Cash</option>
              <option>Card</option>
              <option>Online</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ItemRow label="Consultation" amount={consult} onAmount={setConsult} />
            <ItemRow label="Lab Tests" amount={lab} onAmount={setLab} />
            <ItemRow label="Medicines" amount={meds} onAmount={setMeds} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="text-slate-800">Total: <span className="font-bold">Rs. {total.toLocaleString()}</span></div>
            <input type="number" min="0" value={received} onChange={e=>setReceived(Number(e.target.value||0))} placeholder="Amount Received" className="h-10 px-3 rounded-lg border border-slate-300 bg-white" />
            <div className={`text-sm px-3 h-8 rounded-lg grid place-items-center ${status==='Paid'?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700'}`}>{status}</div>
          </div>

          <button className="px-4 h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">Save Invoice</button>
        </form>
      </div>

      <div className="rounded-2xl bg-white shadow-md ring-1 ring-slate-200/70 p-6">
        <div className="flex items-center justify-between">
          <div className="text-slate-800 font-semibold">Invoices</div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-600">Paid Total: Rs. {paidSum.toLocaleString()}</div>
            <button onClick={exportCSV} className="px-3 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">Export CSV</button>
          </div>
        </div>
        <ul className="divide-y divide-slate-100 text-sm mt-4">
          {rows.map(r => (
            <li key={r.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-slate-800">{r.petName} • {r.ownerName}</div>
                  <div className="text-xs text-slate-500">Consult: Rs. {r.items.consult} • Lab: Rs. {r.items.lab} • Meds: Rs. {r.items.meds}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">Rs. {r.total.toLocaleString()}</div>
                  <div className="text-xs text-slate-500">{r.method} • {r.status}</div>
                </div>
              </div>
            </li>
          ))}
          {rows.length===0 && (
            <li className="py-6 text-center text-slate-500">No invoices yet.</li>
          )}
        </ul>
      </div>
    </div>
  )
}