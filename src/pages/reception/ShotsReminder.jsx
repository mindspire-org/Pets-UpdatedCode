import React, { useEffect, useMemo, useState } from 'react'
import { FiBell, FiRefreshCw, FiPhone, FiCalendar, FiFilter } from 'react-icons/fi'
import { shotRemindersAPI } from '../../services/api'

export default function ShotsReminder() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [shots, setShots] = useState([])
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('Pending') // Pending | Completed | Cancelled | All
  const [windowFilter, setWindowFilter] = useState('2') // days
  const [toast, setToast] = useState('')
  const [updatingId, setUpdatingId] = useState(null) // key of shot being updated
  const [confirmDialog, setConfirmDialog] = useState(null) // { shot, status, message }

  const showToast = (message) => {
    setToast(message)
    setTimeout(() => setToast(''), 3000)
  }

  const load = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true)
      setError('')

      const res = await shotRemindersAPI.getAll({
        status: tab,
        search: q,
      })
      
      let fetched = res?.data || []
      
      // Local filtering for time window
      if (windowFilter !== 'all') {
        const days = parseInt(windowFilter)
        const now = new Date()
        now.setHours(0, 0, 0, 0)
        
        const end = new Date(now)
        end.setDate(end.getDate() + days)
        end.setHours(23, 59, 59, 999)
        
        fetched = fetched.filter(s => {
          const d = new Date(s.dueDate)
          return d >= now && d <= end
        })
      }

      setShots(fetched)
    } catch (e) {
      setError(e?.message || 'Failed to load shots')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const handleUpdateStatus = async (shot, newStatus) => {
    try {
      setUpdatingId(shot.key)
      await shotRemindersAPI.updateStatus(shot.id, newStatus)
      showToast(`Status updated to ${newStatus}`)
      load({ silent: true }) 
    } catch (e) {
      showToast(`Error: ${e.message}`)
    } finally {
      setUpdatingId(null)
      setConfirmDialog(null)
    }
  }

  const triggerConfirm = (shot, status) => {
    const message = status === 'Completed' 
      ? `Are you sure you want to mark ${shot.vaccineName} for ${shot.petName} as Completed?`
      : `Are you sure you want to cancel the reminder for ${shot.vaccineName}?`
    
    setConfirmDialog({ shot, status, message })
  }

  useEffect(() => {
    load()
  }, [tab, q, windowFilter])

  const list = shots

  return (
    <div className="space-y-6">
      {toast ? (
        <div className="fixed top-4 right-4 bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      ) : null}

      <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-100 shadow-xl ring-1 ring-amber-200/50 p-6 border border-amber-100">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
              <FiBell className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-900">Shots Reminder</div>
              <div className="text-sm text-amber-800">Backend driven vaccine shot management system</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => load()}
              className="h-10 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow flex items-center gap-2"
            >
              <FiRefreshCw className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="mt-6 flex flex-wrap gap-2">
          {['Pending', 'Completed', 'Cancelled', 'All'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${
                tab === t 
                  ? 'bg-amber-600 text-white shadow-lg scale-105' 
                  : 'bg-white text-slate-600 hover:bg-amber-50 border border-amber-100'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Search</label>
            <input
              className="h-11 px-4 rounded-xl border-2 border-slate-200 focus:border-amber-400 focus:ring-4 focus:ring-amber-100 w-full transition-all bg-white"
              placeholder="Search by pet, owner, vaccine..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Time Window</label>
            <select
              className="h-11 px-4 rounded-xl border-2 border-slate-200 focus:border-amber-400 focus:ring-4 focus:ring-amber-100 w-full transition-all bg-white font-semibold text-slate-700"
              value={windowFilter}
              onChange={(e) => setWindowFilter(e.target.value)}
            >
              <option value="0">Due Today</option>
              <option value="1">Due in 1 Day</option>
              <option value="2">Due in 2 Days</option>
              <option value="3">Due in 3 Days</option>
              <option value="4">Due in 4 Days</option>
              <option value="7">Due in a Week</option>
              <option value="all">All Dates</option>
            </select>
          </div>
          <div className="flex items-end">
            <div className="text-sm font-bold text-amber-800 bg-amber-100/50 px-4 py-2 rounded-lg border border-amber-200">
              {loading ? '...' : `${list.length} Found`}
            </div>
          </div>
        </div>

        {error ? (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3">{error}</div>
        ) : null}
      </div>

      <div className="space-y-3">
        {list.map((s) => (
          <div key={s.key} className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="font-bold text-slate-800">{s.petName || '—'} <span className="text-slate-500 text-sm font-semibold">({s.patientId || '—'})</span></div>
                <div className="text-xs text-slate-500 mt-1">Owner: {s.ownerName || '—'}</div>
                <div className="text-xs text-slate-500">Doctor: {s.doctorName || '—'}</div>
              </div>

              <div className="text-right flex flex-col items-end gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-700">{s.vaccineName || '—'}</div>
                  <div className="text-xs text-slate-500">{s.shotStage || '—'}</div>
                </div>
                <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  s.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                  s.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {s.status}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 flex items-center gap-2">
                <FiCalendar className="text-amber-600" />
                <div>
                  <div className="text-xs text-slate-500">Due Date</div>
                  <div className="text-sm font-semibold text-slate-700">{new Date(s.dueDate).toLocaleDateString()}</div>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 flex items-center gap-2">
                <FiPhone className="text-emerald-600" />
                <div>
                  <div className="text-xs text-slate-500">Owner Phone</div>
                  <div className="text-sm font-semibold text-slate-700">{s.ownerPhone || '—'}</div>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <div className="text-xs text-slate-500 mb-1">Vaccine Stats</div>
                <div className="flex gap-2">
                  <div className="flex-1 text-center border-r border-slate-200 last:border-0">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Total</div>
                    <div className="text-sm font-bold text-slate-700">{s.vaccineSummary?.total || 1}</div>
                  </div>
                  <div className="flex-1 text-center border-r border-slate-200 last:border-0">
                    <div className="text-[10px] font-bold text-amber-500 uppercase">Due</div>
                    <div className="text-sm font-bold text-amber-600">{s.vaccineSummary?.pending || 0}</div>
                  </div>
                  <div className="flex-1 text-center border-r border-slate-200 last:border-0">
                    <div className="text-[10px] font-bold text-emerald-500 uppercase">Done</div>
                    <div className="text-sm font-bold text-emerald-600">{s.vaccineSummary?.completed || 0}</div>
                  </div>
                  <div className="flex-1 text-center">
                    <div className="text-[10px] font-bold text-red-400 uppercase">X</div>
                    <div className="text-sm font-bold text-red-500">{s.vaccineSummary?.cancelled || 0}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 overflow-hidden">
                <div className="text-xs text-slate-500 mb-1 font-bold">Doctor's Note</div>
                <div className="text-xs text-slate-700 italic leading-tight line-clamp-2" title={s.instructions}>
                  {s.instructions ? `"${s.instructions}"` : "No specific instructions provided."}
                </div>
              </div>

              <div className="flex flex-col gap-1 justify-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase ml-1">Update Status</div>
                <div className="flex gap-1">
                  <button
                    disabled={updatingId === s.key || s.status === 'Completed'}
                    onClick={() => triggerConfirm(s, 'Completed')}
                    className="flex-1 h-8 text-[11px] font-bold bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg transition-colors border border-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Done
                  </button>
                  <button
                    disabled={updatingId === s.key || s.status === 'Cancelled'}
                    onClick={() => triggerConfirm(s, 'Cancelled')}
                    className="flex-1 h-8 text-[11px] font-bold bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition-colors border border-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={updatingId === s.key || s.status === 'Pending'}
                    onClick={() => handleUpdateStatus(s, 'Pending')}
                    className="flex-1 h-8 text-[11px] font-bold bg-slate-50 text-slate-600 hover:bg-slate-600 hover:text-white rounded-lg transition-colors border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {!loading && list.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-300 text-slate-500 p-12 text-center">
            No shot reminders found.
          </div>
        ) : null}
      </div>

      {/* Custom Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className={`w-12 h-12 rounded-xl mb-4 flex items-center justify-center ${
                confirmDialog.status === 'Completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
              }`}>
                <FiBell className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Confirm Status Update</h3>
              <p className="text-slate-600 leading-relaxed">
                {confirmDialog.message}
              </p>
            </div>
            <div className="bg-slate-50 p-4 flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors"
              >
                Go Back
              </button>
              <button
                disabled={updatingId === confirmDialog.shot.key}
                onClick={() => handleUpdateStatus(confirmDialog.shot, confirmDialog.status)}
                className={`px-6 py-2 rounded-xl text-sm font-bold text-white shadow-lg transition-all active:scale-95 flex items-center gap-2 ${
                  confirmDialog.status === 'Completed' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {updatingId === confirmDialog.shot.key ? (
                  <>
                    <FiRefreshCw className="animate-spin" />
                    Updating...
                  </>
                ) : (
                  `Yes, ${confirmDialog.status}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
