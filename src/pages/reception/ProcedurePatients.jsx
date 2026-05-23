import React, { useEffect, useMemo, useState } from 'react'
import { FiRefreshCw, FiSearch, FiEye } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import { procedurePatientsAPI } from '../../services/api'

export default function ProcedurePatients() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('active') // active | unpaid | completed
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(25)
  const [page, setPage] = useState(1)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)

  const totalPages = Math.max(1, Math.ceil((Number(total) || 0) / (Number(limit) || 25)))

  const fetchList = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true)
      setError('')
      const res = await procedurePatientsAPI.getAll({
        tab,
        search: q,
        page,
        limit,
      })
      setRows(res?.data || [])
      setTotal(Number(res?.total || 0))
    } catch (e) {
      setError(e?.message || 'Failed to load patients')
      setRows([])
      setTotal(0)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    fetchList()
  }, [tab, q, page, limit])

  useEffect(() => {
    setPage(1)
  }, [tab, q, limit])

  const openDetails = (r) => {
    const id = String(r?.petId || '').trim()
    if (!id) return
    navigate(`/reception/procedure-patients/${id}`)
  }

  const pageLabel = useMemo(() => {
    if (!total) return `0 - 0 of 0`
    const start = (page - 1) * limit + 1
    const end = Math.min(page * limit, total)
    return `${start} - ${end} of ${total}`
  }, [page, limit, total])

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-2xl font-bold text-slate-900">Procedure Patients</div>
          <div className="text-sm text-slate-500">Backend-driven list with balances and last visit</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchList()}
            className="h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold inline-flex items-center gap-2"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'active', label: 'Active' },
              { key: 'unpaid', label: 'Unpaid' },
              { key: 'completed', label: 'Completed' },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`h-9 px-4 rounded-xl text-sm font-bold transition border ${
                  tab === t.key
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by Pet ID, name, phone..."
                className="h-10 w-72 max-w-full pl-10 pr-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-slate-100"
              />
            </div>

            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value || 25))}
              className="h-10 px-3 rounded-xl border border-slate-200 text-sm font-semibold"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {error ? (
          <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>
        ) : null}

        <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-bold text-slate-600">Pet ID</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-slate-600">Name</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-slate-600">Owner</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-slate-600">Phone</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-slate-600">Last Visit</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-slate-600">Next Appointment</th>
                <th className="px-3 py-2 text-right text-xs font-bold text-slate-600">Paid</th>
                <th className="px-3 py-2 text-right text-xs font-bold text-slate-600">Remaining Dues</th>
                <th className="px-3 py-2 text-right text-xs font-bold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.petId || r._id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold text-slate-800">{r.petId || '—'}</td>
                  <td className="px-3 py-2">{r.name || '—'}</td>
                  <td className="px-3 py-2">{r.ownerName || '—'}</td>
                  <td className="px-3 py-2">{r.phone || '—'}</td>
                  <td className="px-3 py-2">{r.lastVisit ? new Date(r.lastVisit).toLocaleDateString() : '—'}</td>
                  <td className="px-3 py-2">
                    {r?.nextAppointment
                      ? `${r.nextAppointment.date || ''}${r.nextAppointment.time ? ` • ${r.nextAppointment.time}` : ''}`.trim() || '—'
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-slate-600">
                    Rs {Number(r.totalPaid || 0).toLocaleString()}
                  </td>
                  <td className={`px-3 py-2 text-right font-bold ${Number(r.remainingDues || 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    Rs {Number(r.remainingDues || 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => openDetails(r)}
                      className="h-9 px-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 inline-flex items-center gap-2 text-xs font-bold"
                    >
                      <FiEye />
                      View Details
                    </button>
                  </td>
                </tr>
              ))}

              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-slate-500">
                    No patients found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-slate-500 font-semibold">{pageLabel}</div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-9 px-3 rounded-xl border border-slate-200 text-xs font-bold disabled:opacity-50"
            >
              Prev
            </button>
            <div className="text-xs font-bold text-slate-700">
              {page} / {totalPages}
            </div>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="h-9 px-3 rounded-xl border border-slate-200 text-xs font-bold disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}
