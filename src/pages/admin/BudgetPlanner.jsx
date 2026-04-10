import React, { useMemo, useState } from 'react'
import { budgetsAPI } from '../../services/api'

const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const todayFY = () => {
  const d = new Date()
  return String(d.getFullYear())
}

const normalizeMonths = (months) => {
  const arr = Array.isArray(months) ? months : []
  const out = new Array(12).fill(0)
  for (let i = 0; i < 12; i++) out[i] = Math.max(0, Number(arr[i]) || 0)
  return out
}

const emptyRow = () => ({ category: '', description: '', months: new Array(12).fill(0) })

const nextFiscalYear = (fy) => {
  const s = String(fy || '').trim()
  if (/^\d{4}-\d{2}$/.test(s)) {
    const start = Number(s.slice(0, 4))
    const end2 = Number(s.slice(5, 7))
    const nextStart = start + 1
    const nextEnd2 = (end2 + 1) % 100
    return `${nextStart}-${String(nextEnd2).padStart(2, '0')}`
  }
  const n = Number(s)
  if (Number.isFinite(n) && n > 0) return String(n + 1)
  return s
}

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0')

export default function BudgetPlanner() {
  const [fiscalYear, setFiscalYear] = useState(todayFY())
  const [project, setProject] = useState('all')
  const [branch, setBranch] = useState('all')
  const [status, setStatus] = useState('Draft')
  const [tab, setTab] = useState('income')

  const [incomeRows, setIncomeRows] = useState([emptyRow()])
  const [expenseRows, setExpenseRows] = useState([emptyRow()])

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const rowTotal = (r) => (normalizeMonths(r?.months).reduce((a, b) => a + (Number(b) || 0), 0))

  const incomeTotal = useMemo(() => (incomeRows || []).reduce((acc, r) => acc + rowTotal(r), 0), [incomeRows])
  const expenseTotal = useMemo(() => (expenseRows || []).reduce((acc, r) => acc + rowTotal(r), 0), [expenseRows])
  const netBudget = useMemo(() => incomeTotal - expenseTotal, [incomeTotal, expenseTotal])

  const incomeMonthTotals = useMemo(() => {
    const out = new Array(12).fill(0)
    for (const r of incomeRows || []) {
      const m = normalizeMonths(r?.months)
      for (let i = 0; i < 12; i++) out[i] += (Number(m[i]) || 0)
    }
    return out
  }, [incomeRows])

  const expenseMonthTotals = useMemo(() => {
    const out = new Array(12).fill(0)
    for (const r of expenseRows || []) {
      const m = normalizeMonths(r?.months)
      for (let i = 0; i < 12; i++) out[i] += (Number(m[i]) || 0)
    }
    return out
  }, [expenseRows])

  const netMonthTotals = useMemo(() => {
    const out = new Array(12).fill(0)
    for (let i = 0; i < 12; i++) out[i] = (incomeMonthTotals[i] || 0) - (expenseMonthTotals[i] || 0)
    return out
  }, [incomeMonthTotals, expenseMonthTotals])

  const monthlyAverage = useMemo(() => {
    return (incomeTotal - expenseTotal) / 12
  }, [incomeTotal, expenseTotal])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await budgetsAPI.get({ fiscalYear, branch, project })
      const plan = res?.data || null
      if (!plan) {
        setIncomeRows([emptyRow()])
        setExpenseRows([emptyRow()])
        setStatus('Draft')
        return
      }
      setStatus(plan.status || 'Draft')
      setIncomeRows((plan.incomeRows || []).map(r => ({
        category: r.category || '',
        description: r.description || '',
        months: normalizeMonths(r.months),
      })).concat((plan.incomeRows || []).length ? [] : [emptyRow()]))
      setExpenseRows((plan.expenseRows || []).map(r => ({
        category: r.category || '',
        description: r.description || '',
        months: normalizeMonths(r.months),
      })).concat((plan.expenseRows || []).length ? [] : [emptyRow()]))
    } catch (e) {
      setError(e?.response?.message || e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const payload = {
        fiscalYear,
        branch,
        project,
        status,
        incomeRows: (incomeRows || []).map(r => ({
          category: String(r.category || '').trim(),
          description: String(r.description || '').trim(),
          months: normalizeMonths(r.months),
        })).filter(r => r.category || r.description || r.months.some(x => Number(x) > 0)),
        expenseRows: (expenseRows || []).map(r => ({
          category: String(r.category || '').trim(),
          description: String(r.description || '').trim(),
          months: normalizeMonths(r.months),
        })).filter(r => r.category || r.description || r.months.some(x => Number(x) > 0)),
      }
      await budgetsAPI.upsert(payload)
      await load()
    } catch (e) {
      setError(e?.response?.message || e?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const clearAll = () => {
    setIncomeRows([emptyRow()])
    setExpenseRows([emptyRow()])
    setStatus('Draft')
    setError('')
  }

  const goNextYear = () => {
    const next = nextFiscalYear(fiscalYear)
    setFiscalYear(next)
    setIncomeRows([emptyRow()])
    setExpenseRows([emptyRow()])
    setStatus('Draft')
    setError('')
  }

  const print = () => {
    const html = document.getElementById('budget-print-area')?.innerHTML || ''
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!doctype html><html><head><title>Budget Planner</title><style>body{font-family:Arial,Helvetica,sans-serif;padding:16px} table{width:100%;border-collapse:collapse} th,td{border:1px solid #ddd;padding:6px;font-size:12px} th{background:#f5f5f5} .muted{color:#666;font-size:12px} .h{font-size:18px;font-weight:700}</style></head><body>${html}</body></html>`)
    w.document.close()
    w.focus()
    w.print()
  }

  const fiscalYearOptions = useMemo(() => {
    const now = new Date().getFullYear()
    const ys = []
    for (let y = now - 2; y <= now + 5; y++) ys.push(String(y))
    return ys
  }, [])

  const statusOptions = ['Draft', 'Final']

  const categoryOptionsIncome = [
    'Program Grants',
    'Donations',
    'Service Income',
    'Other Income',
  ]

  const categoryOptionsExpense = [
    'Salaries',
    'Rent',
    'Utilities',
    'Supplies',
    'Marketing',
    'Other Expenses',
  ]

  const RowsTable = ({ rows, setRows, categoryOptions, title }) => {
    return (
      <div className="bg-white border border-slate-200 rounded-xl">
        <div className="p-3 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div className="font-semibold text-slate-800">{title}</div>
          <div className="flex items-center justify-end">
            <button className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm" onClick={() => setRows(prev => [...(prev || []), emptyRow()])}>+ Add</button>
          </div>
        </div>
        <div className="overflow-x-auto overflow-y-hidden w-full">
          <table className="min-w-[980px] w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2 px-3 w-56">Category</th>
                <th className="py-2 px-3 w-56">Description</th>
                {monthLabels.map(m => <th key={m} className="py-2 px-3 w-24 text-right">{m}</th>)}
                <th className="py-2 px-3 w-28 text-right">Total</th>
                <th className="py-2 px-3 w-14"></th>
              </tr>
            </thead>
            <tbody>
              {(rows || []).map((r, idx) => (
                <tr key={idx} className="border-t">
                  <td className="py-2 px-3">
                    <select className="w-full border rounded-md px-2 py-2" value={r.category} onChange={e => setRows(prev => prev.map((x, i) => i === idx ? { ...x, category: e.target.value } : x))}>
                      <option value="">Select…</option>
                      {(categoryOptions || []).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="py-2 px-3">
                    <input className="w-full border rounded-md px-2 py-2" value={r.description} onChange={e => setRows(prev => prev.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))} />
                  </td>
                  {monthLabels.map((m, mi) => (
                    <td key={m} className="py-2 px-3 text-right">
                      <input
                        type="number"
                        min="0"
                        className="w-20 md:w-24 border rounded-md px-2 py-2 text-right"
                        value={Number(normalizeMonths(r.months)[mi] || 0)}
                        onChange={e => {
                          const val = Math.max(0, Number(e.target.value) || 0)
                          setRows(prev => prev.map((x, i) => {
                            if (i !== idx) return x
                            const months = normalizeMonths(x.months)
                            months[mi] = val
                            return { ...x, months }
                          }))
                        }}
                      />
                    </td>
                  ))}
                  <td className="py-2 px-3 text-right font-semibold">Rs {fmt(rowTotal(r))}</td>
                  <td className="py-2 px-3 text-right">
                    <button className="text-red-600" onClick={() => setRows(prev => (prev || []).filter((_, i) => i !== idx))}>🗑</button>
                  </td>
                </tr>
              ))}
              {(!rows || rows.length === 0) && (
                <tr>
                  <td className="py-6 px-3 text-center text-slate-500" colSpan={monthLabels.length + 4}>No rows</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
        <div>
          <div className="text-xl font-semibold text-slate-800">Annual Budget Planner</div>
          <div className="text-sm text-slate-500">Plan and manage annual budget</div>
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-start lg:justify-end">
          <button className="px-3 py-2 rounded-md border" onClick={load} disabled={loading || saving}>{loading ? 'Loading…' : 'Load'}</button>
          <button className="px-3 py-2 rounded-md border" onClick={save} disabled={saving || loading}>{saving ? 'Saving…' : 'Save'}</button>
          <button className="px-3 py-2 rounded-md border" onClick={goNextYear} disabled={saving || loading}>Next Year</button>
          <button className="px-3 py-2 rounded-md border" onClick={clearAll} disabled={saving || loading}>Clear</button>
          <button className="px-3 py-2 rounded-md bg-indigo-600 text-white" onClick={print}>Print</button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="bg-white border border-slate-200 rounded-xl p-3">
        <div className="font-semibold text-slate-700 mb-2">Budget Configuration</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
          <div>
            <div className="text-xs text-slate-500 mb-1">Fiscal Year</div>
            <select className="w-full border rounded-md px-2 py-2" value={fiscalYear} onChange={e => setFiscalYear(e.target.value)}>
              {fiscalYearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Project</div>
            <select className="w-full border rounded-md px-2 py-2" value={project} onChange={e => setProject(e.target.value)}>
              <option value="all">All Projects</option>
            </select>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Branch</div>
            <select className="w-full border rounded-md px-2 py-2" value={branch} onChange={e => setBranch(e.target.value)}>
              <option value="all">All Branches</option>
            </select>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Status</div>
            <select className="w-full border rounded-md px-2 py-2" value={status} onChange={e => setStatus(e.target.value)}>
              {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-2">
        <div className="flex items-center gap-2">
          <button className={`px-3 py-2 rounded-md text-sm ${tab === 'income' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`} onClick={() => setTab('income')}>Income Budget</button>
          <button className={`px-3 py-2 rounded-md text-sm ${tab === 'expense' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`} onClick={() => setTab('expense')}>Expense Budget</button>
        </div>
      </div>

      {tab === 'income' ? (
        <RowsTable rows={incomeRows} setRows={setIncomeRows} categoryOptions={categoryOptionsIncome} title="Income Categories" />
      ) : (
        <RowsTable rows={expenseRows} setRows={setExpenseRows} categoryOptions={categoryOptionsExpense} title="Expense Categories" />
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-3">
        <div className="font-semibold text-slate-700 mb-2">Budget Summary</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <div className="border rounded-lg p-3">
            <div className="text-xs text-slate-500">Total Income</div>
            <div className="font-semibold text-emerald-700">Rs {fmt(incomeTotal)}</div>
          </div>
          <div className="border rounded-lg p-3">
            <div className="text-xs text-slate-500">Total Expenses</div>
            <div className="font-semibold text-red-600">Rs {fmt(expenseTotal)}</div>
          </div>
          <div className="border rounded-lg p-3">
            <div className="text-xs text-slate-500">Net Budget</div>
            <div className="font-semibold text-slate-800">Rs {fmt(netBudget)}</div>
          </div>
          <div className="border rounded-lg p-3">
            <div className="text-xs text-slate-500">Monthly Average</div>
            <div className="font-semibold text-slate-800">Rs {fmt(monthlyAverage)}</div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-3">
        <div className="font-semibold text-slate-700 mb-2">Monthly Breakdown</div>
        <div className="overflow-x-auto overflow-y-hidden w-full">
          <table className="min-w-[760px] w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2 pr-3">Month</th>
                {monthLabels.map(m => <th key={m} className="py-2 pr-3 text-right">{m}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="py-2 pr-3 font-semibold">Income</td>
                {incomeMonthTotals.map((v, i) => <td key={i} className="py-2 pr-3 text-right text-emerald-700">Rs {fmt(v)}</td>)}
              </tr>
              <tr className="border-t">
                <td className="py-2 pr-3 font-semibold">Expenses</td>
                {expenseMonthTotals.map((v, i) => <td key={i} className="py-2 pr-3 text-right text-red-600">Rs {fmt(v)}</td>)}
              </tr>
              <tr className="border-t">
                <td className="py-2 pr-3 font-semibold">Net</td>
                {netMonthTotals.map((v, i) => <td key={i} className="py-2 pr-3 text-right font-semibold">Rs {fmt(v)}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="hidden">
        <div id="budget-print-area">
          <div className="h">Annual Budget Planner</div>
          <div className="muted">Fiscal Year: {fiscalYear} | Project: {project === 'all' ? 'All Projects' : project} | Branch: {branch === 'all' ? 'All Branches' : branch} | Status: {status}</div>
          <h3>Income Budget</h3>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Description</th>
                {monthLabels.map(m => <th key={m}>{m}</th>)}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {(incomeRows || []).filter(r => r.category || r.description || rowTotal(r) > 0).map((r, i) => (
                <tr key={i}>
                  <td>{r.category}</td>
                  <td>{r.description}</td>
                  {normalizeMonths(r.months).map((v, mi) => <td key={mi}>{fmt(v)}</td>)}
                  <td>{fmt(rowTotal(r))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>Expense Budget</h3>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Description</th>
                {monthLabels.map(m => <th key={m}>{m}</th>)}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {(expenseRows || []).filter(r => r.category || r.description || rowTotal(r) > 0).map((r, i) => (
                <tr key={i}>
                  <td>{r.category}</td>
                  <td>{r.description}</td>
                  {normalizeMonths(r.months).map((v, mi) => <td key={mi}>{fmt(v)}</td>)}
                  <td>{fmt(rowTotal(r))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>Summary</h3>
          <table>
            <tbody>
              <tr><td>Total Income</td><td>{fmt(incomeTotal)}</td></tr>
              <tr><td>Total Expenses</td><td>{fmt(expenseTotal)}</td></tr>
              <tr><td>Net Budget</td><td>{fmt(netBudget)}</td></tr>
              <tr><td>Monthly Average</td><td>{fmt(monthlyAverage)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
