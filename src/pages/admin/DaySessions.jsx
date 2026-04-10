import React, { useEffect, useMemo, useState } from 'react'
import { dayAPI } from '../../services/api'

const todayStr = () => new Date().toISOString().slice(0,10)
const monthStartStr = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0,10) }
const fmt = (n) => (typeof n === 'number' ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-')

export default function DaySessions() {
  const [portal, setPortal] = useState('all')
  const [from, setFrom] = useState(todayStr())
  const [to, setTo] = useState(todayStr())
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [sel, setSel] = useState(null) // selected session
  const [recon, setRecon] = useState(null)
  const [logs, setLogs] = useState([])

  const cashShortOverSummary = useMemo(() => {
    const diffs = (logs || []).filter(l => l.action === 'day_closing_difference' || l.action === 'day_opening_adjustment')
    const total = diffs.reduce((s, l) => s + Number(l.amount || 0), 0)
    const last = diffs[0] || null
    return { diffs, total, last }
  }, [logs])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await dayAPI.history(portal, from, to)
      setRows(res?.data || [])
    } catch (e) {
      setRows([])
      setError(e?.message || 'Failed to load')
    } finally { setLoading(false) }
  }

  const openRecon = async (session) => {
    setSel(session)
    setRecon(null)
    setLogs([])
    try {
      const r = await dayAPI.reconciliation(session.portal, session.date)
      setRecon(r?.data || null)
      const l = await dayAPI.logs(session.portal, session.date)
      setLogs(l?.data || [])
    } catch (e) {
      setRecon(null)
      setLogs([])
    }
  }

  useEffect(() => { load() }, [portal, from, to])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Day Sessions</h1>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Portal</label>
          <select className="w-full border rounded-md px-3 py-2" value={portal} onChange={e=>setPortal(e.target.value)}>
            <option value="all">All</option>
            <option value="admin">Admin</option>
            <option value="reception">Reception</option>
            <option value="pharmacy">Pharmacy</option>
            <option value="lab">Lab</option>
            <option value="shop">Pet Shop</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">From</label>
          <input type="date" className="w-full border rounded-md px-3 py-2" value={from} onChange={e=>setFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">To</label>
          <input type="date" className="w-full border rounded-md px-3 py-2" value={to} onChange={e=>setTo(e.target.value)} />
        </div>
        <div className="flex items-end gap-2">
          <button onClick={load} className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700">Refresh</button>
          {loading && <span className="text-xs text-slate-500">Loading…</span>}
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <div className="text-sm font-semibold mb-2">Sessions</div>
          <div className="overflow-auto max-h-[60vh]">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Portal</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3 text-right">Opening</th>
                  <th className="py-2 pr-3 text-right">Closing</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {(rows||[]).map((r) => (
                  <tr key={r._id} className="border-t">
                    <td className="py-2 pr-3">{r.date}</td>
                    <td className="py-2 pr-3">{r.portal}</td>
                    <td className="py-2 pr-3">{r.status}</td>
                    <td className="py-2 pr-3 text-right">{fmt(r.openingAmount)}</td>
                    <td className="py-2 pr-3 text-right">{fmt(r.closingAmount)}</td>
                    <td className="py-2 pr-3 text-right">
                      <button onClick={() => openRecon(r)} className="px-2 py-1 text-xs rounded-md border">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <div className="text-sm font-semibold mb-2">Reconciliation</div>
          {sel ? (
            recon ? (
              <div className="space-y-2 text-sm">
                <div className="text-slate-600">{sel.portal.toUpperCase()} • {sel.date}</div>
                {cashShortOverSummary.diffs.length > 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-2">
                    <div className="font-medium text-amber-800">Cash Short/Over (Adjustment Posted)</div>
                    <div className="text-xs text-amber-700 mt-1">
                      Total impact (signed): {fmt(cashShortOverSummary.total)}
                    </div>
                    {cashShortOverSummary.last && (
                      <div className="text-xs text-amber-700 mt-1">
                        Latest: {cashShortOverSummary.last.action} • {cashShortOverSummary.last.description}
                      </div>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border p-2">
                    <div className="font-medium">System</div>
                    <div className="flex justify-between"><span>Expected Cash</span><span>{fmt(recon.expectedClosingCash)}</span></div>
                    <div className="flex justify-between"><span>Expected Bank</span><span>{fmt(recon.expectedClosingBank)}</span></div>
                    <div className="flex justify-between"><span>Expected Total</span><span>{fmt(recon.expectedTotal)}</span></div>
                  </div>
                  <div className="rounded-md border p-2">
                    <div className="font-medium">Actual</div>
                    <div className="flex justify-between"><span>Cash Count</span><span>{fmt(sel.cashCount)}</span></div>
                    <div className="flex justify-between"><span>Bank Balance</span><span>{fmt(sel.bankBalance)}</span></div>
                    <div className="flex justify-between"><span>Closing Amount</span><span>{fmt(sel.closingAmount)}</span></div>
                  </div>
                </div>
                <div className="rounded-md border p-2">
                  <div className="font-medium">Tallies</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex justify-between"><span>Cash In</span><span>{fmt(recon.tallies.cashIn)}</span></div>
                    <div className="flex justify-between"><span>Cash Out</span><span>{fmt(recon.tallies.cashOut)}</span></div>
                    <div className="flex justify-between"><span>Bank In</span><span>{fmt(recon.tallies.bankIn)}</span></div>
                    <div className="flex justify-between"><span>Bank Out</span><span>{fmt(recon.tallies.bankOut)}</span></div>
                    <div className="flex justify-between"><span>Income</span><span>{fmt(recon.tallies.income)}</span></div>
                    <div className="flex justify-between"><span>Expenses</span><span>{fmt(recon.tallies.expenses)}</span></div>
                  </div>
                </div>
                <div className="rounded-md border p-2">
                  <div className="font-medium mb-1">Day Logs</div>
                  <div className="max-h-48 overflow-auto text-xs">
                    <ul className="space-y-1">
                      {(logs||[]).map(l => (
                        <li key={l._id} className="flex justify-between border-b pb-1">
                          <span>{new Date(l.createdAt).toLocaleTimeString()}</span>
                          <span className="flex-1 px-2 truncate">{l.action} • {l.description}</span>
                          <span>{fmt(l.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : <div className="text-sm text-slate-500">Select a session to view reconciliation</div>
          ) : <div className="text-sm text-slate-500">Select a session to view reconciliation</div>}
        </div>
      </div>
    </div>
  )
}
