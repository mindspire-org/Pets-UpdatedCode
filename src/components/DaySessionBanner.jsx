import React, { useEffect, useMemo, useState } from 'react'
import { dayAPI } from '../services/api'
import { FiLock, FiUnlock, FiClock, FiX, FiCheck, FiAlertTriangle } from 'react-icons/fi'

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-')
const todayStr = () => new Date().toISOString().slice(0,10)

export default function DaySessionBanner({ portal = 'admin', userName = '' }) {
  const [status, setStatus] = useState(null) // session or null
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showOpen, setShowOpen] = useState(false)
  const [showClose, setShowClose] = useState(false)

  // open form state
  const [openingAmount, setOpeningAmount] = useState('')
  const [openingNote, setOpeningNote] = useState('')

  // close form state
  const [cashCount, setCashCount] = useState('')
  const [bankBalance, setBankBalance] = useState('')
  const [closingAmount, setClosingAmount] = useState('')
  const [closeType, setCloseType] = useState('regular')
  const [closeNote, setCloseNote] = useState('')
  const [adjustments, setAdjustments] = useState([])
  const [previousClosing, setPreviousClosing] = useState(null)
  const [showDifferenceInput, setShowDifferenceInput] = useState(false)
  const [differenceNote, setDifferenceNote] = useState('')

  const fetchStatus = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await dayAPI.status(portal)
      setStatus(res?.data || null)
      // Fetch previous day's closing amount if day is not open
      if (!res?.data || res?.data?.status !== 'open') {
        try {
          const yesterday = new Date()
          yesterday.setDate(yesterday.getDate() - 1)
          const dateStr = yesterday.toISOString().slice(0,10)
          const historyRes = await dayAPI.history(portal, dateStr, dateStr)
          const sessions = historyRes?.data || []
          if (sessions.length > 0) {
            const lastSession = sessions[0]
            const closingAmt = lastSession.closingAmount || lastSession.expectedClosingCash || 0
            setPreviousClosing(closingAmt)
            setOpeningAmount(closingAmt)
          }
        } catch {
          setPreviousClosing(null)
        }
      }
    } catch (e) {
      setStatus(null)
      setError(e?.message || 'Failed to get day status')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStatus() }, [portal])

  // Detect when opening amount differs from previous closing
  useEffect(() => {
    if (previousClosing !== null && Number(openingAmount) !== Number(previousClosing)) {
      setShowDifferenceInput(true)
    } else {
      setShowDifferenceInput(false)
      setDifferenceNote('')
    }
  }, [openingAmount, previousClosing])

  const openDay = async () => {
    setLoading(true)
    setError('')
    try {
      const note = openingNote || (showDifferenceInput && differenceNote ? `Difference: ${differenceNote}` : '')
      const res = await dayAPI.open({ portal, openingAmount: Number(openingAmount || 0), openedBy: userName || portal, openingNote: note })
      setStatus(res?.data || null)
      // refresh to include tallies
      try { await fetchStatus() } catch {}
      setShowOpen(false)
      setOpeningAmount('')
      setOpeningNote('')
      setDifferenceNote('')
      setShowDifferenceInput(false)
      setPreviousClosing(null)
    } catch (e) {
      setError(e?.response?.message || e?.message || 'Failed to open day')
    } finally { setLoading(false) }
  }

  const removeAdjustment = (idx) => {
    setAdjustments(prev => prev.filter((_, i) => i !== idx))
  }

  const addAdjustment = () => {
    setAdjustments(prev => [...prev, { label: '', type: 'add', amount: '' }])
  }

  const tallies = status?.tallies || null
  const expected = useMemo(() => {
    if (!status || status.status !== 'open') return { cash: 0, bank: 0, total: 0 }
    const cashIn = Number(tallies?.cashIn || 0)
    const cashOut = Number(tallies?.cashOut || 0)
    const bankIn = Number(tallies?.bankIn || 0)
    const bankOut = Number(tallies?.bankOut || 0)
    const opening = Number(status.openingAmount || 0)
    const adj = (status.adjustments || []).reduce((s,a)=> s + (a.type === 'subtract' ? -Math.abs(Number(a.amount||0)) : Math.abs(Number(a.amount||0))), 0)
    const cash = opening + cashIn - cashOut
    const bank = bankIn - bankOut
    return { cash, bank, total: cash + bank + adj }
  }, [status, tallies])

  const closeDay = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await dayAPI.close({
        portal,
        closingAmount: Number(closingAmount || cashCount || 0),
        cashCount: Number(cashCount || closingAmount || 0),
        bankBalance: Number(bankBalance || 0),
        closeType,
        closedBy: userName || portal,
        closeNote,
        adjustments: (adjustments||[]).map(a => ({ label: (a.label||'').trim(), type: a.type, amount: Number(a.amount||0) }))
      })
      setStatus(res?.data || null)
      try { await fetchStatus() } catch {}
      setShowClose(false)
      setCashCount(''); setBankBalance(''); setClosingAmount(''); setCloseType('regular'); setCloseNote(''); setAdjustments([])
    } catch (e) {
      setError(e?.response?.message || e?.message || 'Failed to close day')
    } finally { setLoading(false) }
  }

  const isOpen = status && status.status === 'open'

  return (
    <div className="mb-3 print:hidden">
      {/* Banner */}
      <div className={`rounded-xl border ${isOpen ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'} p-3 flex items-center justify-between gap-3`}>
        <div className="flex items-center gap-2">
          {isOpen ? <FiUnlock className="text-emerald-600" /> : <FiLock className="text-amber-600" />}
          <div className="text-sm">
            <div className="font-semibold text-slate-800">{portal.toUpperCase()} Day {isOpen ? 'Open' : 'Closed'}</div>
            <div className="text-slate-600 text-xs">
              {isOpen ? (
                <>
                  Opened by {status.openedBy || 'User'} at {new Date(status.openedAt).toLocaleString()} • Opening {fmt(status.openingAmount)}
                </>
              ) : 'Open the day to start working'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isOpen && (
            <button onClick={()=>setShowOpen(true)} className="px-3 py-1.5 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60" disabled={loading}>
              Open Day
            </button>
          )}
          {isOpen && (
            <button onClick={()=>setShowClose(true)} className="px-3 py-1.5 text-xs rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60" disabled={loading}>
              Close Day
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-2 text-xs text-red-600">{error}</div>
      )}

      {/* Open Modal */}
      {showOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Open Day - {portal.toUpperCase()}</div>
              <button onClick={()=>setShowOpen(false)} className="h-7 w-7 grid place-items-center rounded-md border">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Date</label>
                <input type="text" value={todayStr()} disabled className="w-full border rounded-md px-3 py-2 bg-slate-50" />
              </div>
              {previousClosing !== null && (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-2">
                  <div className="text-xs text-blue-700">
                    <span className="font-semibold">Previous Day Closing: </span>
                    Rs {fmt(previousClosing)}
                  </div>
                  <div className="text-xs text-blue-600 mt-1">
                    Auto-filled as today's opening amount
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Opening Amount (Cash in drawer)</label>
                <input type="number" min="0" value={openingAmount} onChange={e=>setOpeningAmount(e.target.value)} className="w-full border rounded-md px-3 py-2" />
              </div>
              {showDifferenceInput && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-2">
                  <div className="text-xs text-amber-700 mb-1">
                    <FiAlertTriangle className="inline mr-1" />
                    <span className="font-semibold">Amount Difference Detected</span>
                  </div>
                  <div className="text-xs text-amber-600 mb-2">
                    Expected: Rs {fmt(previousClosing)} | Entered: Rs {fmt(Number(openingAmount))}
                  </div>
                  <label className="block text-xs text-amber-700 mb-1">Explain the difference (required)</label>
                  <textarea 
                    value={differenceNote} 
                    onChange={e=>setDifferenceNote(e.target.value)} 
                    placeholder="e.g., Night shift used Rs 500 for emergency supplies, or Cash was short by Rs 200..."
                    className="w-full border border-amber-300 rounded-md px-3 py-2 text-sm" 
                    rows={2} 
                  />
                </div>
              )}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Opened By</label>
                <input type="text" value={userName || portal} onChange={()=>{}} disabled className="w-full border rounded-md px-3 py-2 bg-slate-50" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Additional Note (optional)</label>
                <textarea value={openingNote} onChange={e=>setOpeningNote(e.target.value)} className="w-full border rounded-md px-3 py-2" rows={2} />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button onClick={()=>setShowOpen(false)} className="px-3 py-1.5 text-xs rounded-md border">Cancel</button>
                <button 
                  onClick={openDay} 
                  disabled={showDifferenceInput && !differenceNote}
                  className="px-3 py-1.5 text-xs rounded-md bg-indigo-600 text-white disabled:opacity-60"
                >
                  Open
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Close Modal */}
      {showClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Close Day - {portal.toUpperCase()}</div>
              <button onClick={()=>setShowClose(false)} className="h-7 w-7 grid place-items-center rounded-md border">✕</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-600">Your Count</div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Cash Count</label>
                  <input type="number" min="0" value={cashCount} onChange={e=>setCashCount(e.target.value)} className="w-full border rounded-md px-3 py-2" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Bank Balance</label>
                  <input type="number" min="0" value={bankBalance} onChange={e=>setBankBalance(e.target.value)} className="w-full border rounded-md px-3 py-2" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Closing Amount (optional, defaults to Cash Count)</label>
                  <input type="number" min="0" value={closingAmount} onChange={e=>setClosingAmount(e.target.value)} className="w-full border rounded-md px-3 py-2" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Close Type</label>
                  <select value={closeType} onChange={e=>setCloseType(e.target.value)} className="w-full border rounded-md px-3 py-2">
                    <option value="regular">Regular</option>
                    <option value="early">Early Close</option>
                    <option value="late">Late Close</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Note</label>
                  <textarea value={closeNote} onChange={e=>setCloseNote(e.target.value)} className="w-full border rounded-md px-3 py-2" rows={2} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-600">System Expected</div>
                <div className="rounded-md border p-2 text-xs">
                  <div className="flex justify-between"><span>Opening</span><span>{fmt(status?.openingAmount)}</span></div>
                  <div className="flex justify-between"><span>Cash In</span><span>{fmt(tallies?.cashIn)}</span></div>
                  <div className="flex justify-between"><span>Cash Out</span><span>{fmt(tallies?.cashOut)}</span></div>
                  <div className="flex justify-between"><span>Bank In</span><span>{fmt(tallies?.bankIn)}</span></div>
                  <div className="flex justify-between"><span>Bank Out</span><span>{fmt(tallies?.bankOut)}</span></div>
                  <div className="flex justify-between"><span>Income</span><span>{fmt(tallies?.income)}</span></div>
                  <div className="flex justify-between"><span>Expenses</span><span>{fmt(tallies?.expenses)}</span></div>
                  <div className="border-t my-1" />
                  <div className="flex justify-between font-semibold"><span>Expected Cash</span><span>{fmt(expected.cash)}</span></div>
                  <div className="flex justify-between font-semibold"><span>Expected Bank</span><span>{fmt(expected.bank)}</span></div>
                  <div className="flex justify-between font-semibold"><span>Expected Total</span><span>{fmt(expected.total)}</span></div>
                </div>
                <div className="text-xs font-semibold text-slate-600 mt-3">Adjustments</div>
                <div className="space-y-2">
                  {(adjustments||[]).map((a, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <input placeholder="Label" className="col-span-5 border rounded-md px-2 py-1" value={a.label||''} onChange={e=>{
                        const v=e.target.value; setAdjustments(prev=>prev.map((x,i)=> i===idx?{...x,label:v}:x))
                      }} />
                      <select className="col-span-3 border rounded-md px-2 py-1" value={a.type} onChange={e=>{
                        const v=e.target.value; setAdjustments(prev=>prev.map((x,i)=> i===idx?{...x,type:v}:x))
                      }}>
                        <option value="add">Add</option>
                        <option value="subtract">Subtract</option>
                      </select>
                      <input type="number" min="0" placeholder="Amount" className="col-span-3 border rounded-md px-2 py-1" value={a.amount||''} onChange={e=>{
                        const v=e.target.value; setAdjustments(prev=>prev.map((x,i)=> i===idx?{...x,amount:v}:x))
                      }} />
                      <button className="col-span-1 text-red-600" onClick={()=>removeAdjustment(idx)} title="Remove">×</button>
                    </div>
                  ))}
                  <button onClick={addAdjustment} className="text-xs px-2 py-1 rounded-md border">Add Adjustment</button>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-3">
              <button onClick={()=>setShowClose(false)} className="px-3 py-1.5 text-xs rounded-md border">Cancel</button>
              <button onClick={closeDay} className="px-3 py-1.5 text-xs rounded-md bg-purple-600 text-white">Close Day</button>
            </div>
          </div>
        </div>
      )}

      {/* When day closed, show warning strip */}
      {!isOpen && (
        <div className="mt-2 text-xs text-amber-700 flex items-center gap-2">
          <FiAlertTriangle /> Actions are blocked until day is opened. Use the Open Day button above.
        </div>
      )}
    </div>
  )
}
