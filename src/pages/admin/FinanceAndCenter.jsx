import React, { useEffect, useMemo, useState } from 'react'
import { accountingAPI } from '../../services/api'

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-')
const dateInputStr = (d) => {
  const yr = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${yr}-${mo}-${da}`
}
const todayStr = () => dateInputStr(new Date())
const monthStartStr = () => {
  const d = new Date()
  d.setDate(1)
  return dateInputStr(d)
}

export default function FinanceAndCenter() {
  const [from, setFrom] = useState(todayStr())
  const [to, setTo] = useState(todayStr())
  const [portal, setPortal] = useState('all')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncSummary, setSyncSummary] = useState('')

  const [accounts, setAccounts] = useState([])
  const [trialBalance, setTrialBalance] = useState([])
  const [income, setIncome] = useState(null)
  const [balanceSheet, setBalanceSheet] = useState(null)
  const [cashFlow, setCashFlow] = useState(null)

  const [glAccount, setGlAccount] = useState('')
  const [glRows, setGlRows] = useState([])
  const [glLoading, setGlLoading] = useState(false)

  const [customerId, setCustomerId] = useState('')
  const [customerRows, setCustomerRows] = useState([])

  const [supplierId, setSupplierId] = useState('')
  const [supplierRows, setSupplierRows] = useState([])

  const [patientId, setPatientId] = useState('')
  const [patientRows, setPatientRows] = useState([])
  const [activeSection, setActiveSection] = useState('')

  const [entryOpen, setEntryOpen] = useState(false)
  const [entryLoading, setEntryLoading] = useState(false)
  const [entryError, setEntryError] = useState('')
  const [entryDetail, setEntryDetail] = useState(null)

  // derived
  const netTrial = useMemo(() => {
    const d = trialBalance.reduce((s, r) => s + (r.debit || 0), 0)
    const c = trialBalance.reduce((s, r) => s + (r.credit || 0), 0)
    return { debit: d, credit: c }
  }, [trialBalance])

  const refreshCore = async () => {
    setLoading(true)
    setError('')
    try {
      const [accRes, tbRes, isRes, bsRes, cfRes] = await Promise.all([
        accountingAPI.getAccounts(),
        accountingAPI.getTrialBalance(from, to, portal),
        accountingAPI.getIncomeStatement(from, to, portal),
        accountingAPI.getBalanceSheet(from, to, portal),
        accountingAPI.getCashFlow(from, to, portal),
      ])
      setAccounts(accRes?.data || [])
      setTrialBalance(tbRes?.data || [])
      setIncome(isRes?.data || null)
      setBalanceSheet(bsRes?.data || null)
      setCashFlow(cfRes?.data || null)
      // Default GL account to cash if empty
      if (!glAccount && (accRes?.data || []).length) {
        const cash = accRes.data.find(a => a.code === '1001') || accRes.data[0]
        setGlAccount(cash.code)
      }
    } catch (e) {
      setError(e?.response?.message || e?.message || 'Failed to load accounting data')
    } finally {
      setLoading(false)
    }
  }

  const refreshGL = async () => {
    if (!glAccount) return
    setGlLoading(true)
    try {
      const res = await accountingAPI.getGeneralLedger(glAccount, from, to, portal)
      setGlRows(res?.data || [])
    } catch (e) {
      setGlRows([])
    } finally {
      setGlLoading(false)
    }
  }

  const doSync = async () => {
    setSyncing(true)
    setSyncSummary('')
    setError('')
    try {
      const res = await accountingAPI.sync(from, to)
      const data = res?.data || {}
      setSyncSummary(`Created ${data.created || 0}, skipped ${data.skipped || 0}, errors ${data.errors || 0}`)
      await refreshCore()
      if (activeSection === 'gl') await refreshGL()
      if (activeSection === 'customer') await fetchCustomer()
      if (activeSection === 'supplier') await fetchSupplier()
      if (activeSection === 'patient') await fetchPatient()
    } catch (e) {
      setSyncSummary('')
      setError(e?.response?.message || e?.message || 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const fetchCustomer = async () => {
    if (!customerId) { setCustomerRows([]); return }
    try {
      const res = await accountingAPI.getCustomerLedger(customerId, from, to, portal)
      setCustomerRows(res?.data || [])
    } catch {
      setCustomerRows([])
    }
  }

  const fetchSupplier = async () => {
    if (!supplierId) { setSupplierRows([]); return }
    try {
      const res = await accountingAPI.getSupplierLedger(supplierId, from, to, portal)
      setSupplierRows(res?.data || [])
    } catch {
      setSupplierRows([])
    }
  }

  const fetchPatient = async () => {
    if (!patientId) { setPatientRows([]); return }
    try {
      const res = await accountingAPI.getPatientLedger(patientId, from, to, portal)
      setPatientRows(res?.data || [])
    } catch {
      setPatientRows([])
    }
  }

  // CSV utilities
  const escapeCSV = (val) => {
    const v = (val ?? '').toString()
    if (/[",\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"'
    return v
  }
  const exportCSV = (filename, headers, rows) => {
    const csv = [headers.join(',')]
      .concat(rows.map(r => r.map(escapeCSV).join(',')))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
  const exportTrialBalance = () => {
    const headers = ['Code','Account','Type','Debit','Credit']
    const rows = (trialBalance||[]).map(r => [r.code, r.name, r.type||'', r.debit||0, r.credit||0])
    exportCSV(`trial_balance_${from}_${to}_${portal}.csv`, headers, rows)
  }
  const exportGL = () => {
    const headers = ['EntryId','Date','Portal','Source','Description','Debit','Credit','RunningDebit','RunningCredit']
    const rows = (glRows||[]).map(r => [r.entryId||'', new Date(r.date).toISOString(), r.portal||'', r.sourceType||'', r.description||'', r.debit||0, r.credit||0, r.runningDebit||0, r.runningCredit||0])
    exportCSV(`general_ledger_${glAccount}_${from}_${to}_${portal}.csv`, headers, rows)
  }
  const exportCustomer = () => {
    const headers = ['EntryId','Date','Portal','Source','Description','Debit','Credit','Balance']
    const rows = (customerRows||[]).map(r => [r.entryId||'', new Date(r.date).toISOString(), r.portal||'', r.sourceType||'', r.description||'', r.debit||0, r.credit||0, r.balance||0])
    exportCSV(`customer_ledger_${customerId}_${from}_${to}_${portal}.csv`, headers, rows)
  }
  const exportSupplier = () => {
    const headers = ['EntryId','Date','Portal','Source','Description','Debit','Credit','Balance']
    const rows = (supplierRows||[]).map(r => [r.entryId||'', new Date(r.date).toISOString(), r.portal||'', r.sourceType||'', r.description||'', r.debit||0, r.credit||0, r.balance||0])
    exportCSV(`supplier_ledger_${supplierId}_${from}_${to}_${portal}.csv`, headers, rows)
  }
  const exportPatient = () => {
    const headers = ['EntryId','Date','Portal','Source','Description','Debit','Credit','Balance']
    const rows = (patientRows||[]).map(r => [r.entryId||'', new Date(r.date).toISOString(), r.portal||'', r.sourceType||'', r.description||'', r.debit||0, r.credit||0, r.balance||0])
    exportCSV(`patient_ledger_${patientId}_${from}_${to}_${portal}.csv`, headers, rows)
  }

  const openEntry = async (entryId) => {
    if (!entryId) return
    setEntryOpen(true)
    setEntryLoading(true)
    setEntryError('')
    setEntryDetail(null)
    try {
      const res = await accountingAPI.getJournalEntryDetail(entryId)
      setEntryDetail(res?.data || null)
    } catch (e) {
      setEntryError(e?.response?.message || e?.message || 'Failed to load journal entry')
      setEntryDetail(null)
    } finally {
      setEntryLoading(false)
    }
  }

  useEffect(() => {
    refreshCore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // refresh trial + income on date change
    refreshCore()
    if (glAccount) refreshGL()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, portal])

  useEffect(() => {
    if (glAccount) refreshGL()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glAccount])

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-semibold text-slate-800">Finance and Center</h1>
      </div>

      {/* Global Date Filters (only) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">From</label>
          <input type="date" className="w-full border rounded-md px-3 py-2" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">To</label>
          <input type="date" className="w-full border rounded-md px-3 py-2" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <button onClick={() => { refreshCore(); if (activeSection === 'gl') refreshGL(); }} className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700">Apply</button>
          <button onClick={doSync} disabled={syncing} className="px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60">Sync Accounting</button>
          {loading && <span className="text-slate-500 text-sm">Loading…</span>}
          {syncing && <span className="text-slate-500 text-sm">Syncing…</span>}
          {syncSummary && <span className="text-slate-600 text-xs">{syncSummary}</span>}
          {error && <span className="text-red-600 text-xs">{error}</span>}
        </div>
      </div>

      {/* Section Buttons */}
      {!activeSection && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button onClick={() => setActiveSection('balanceSheet')} className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:shadow">
            <div className="font-medium">Balance Sheet</div>
            <div className="text-xs text-slate-500">As of selected To date</div>
          </button>
          <button onClick={() => setActiveSection('cashFlow')} className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:shadow">
            <div className="font-medium">Cash Flow</div>
            <div className="text-xs text-slate-500">Period inflows/outflows</div>
          </button>
          <button onClick={() => setActiveSection('income')} className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:shadow">
            <div className="font-medium">Income Statement</div>
            <div className="text-xs text-slate-500">Revenue, COGS, Expenses</div>
          </button>
          <button onClick={() => setActiveSection('trialBalance')} className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:shadow">
            <div className="font-medium">Trial Balance</div>
            <div className="text-xs text-slate-500">Debits and credits</div>
          </button>
          <button onClick={() => setActiveSection('gl')} className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:shadow">
            <div className="font-medium">General Ledger</div>
            <div className="text-xs text-slate-500">Account movements</div>
          </button>
          <button onClick={() => setActiveSection('customer')} className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:shadow">
            <div className="font-medium">Customer Ledger</div>
            <div className="text-xs text-slate-500">Receivables activity</div>
          </button>
          <button onClick={() => setActiveSection('supplier')} className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:shadow">
            <div className="font-medium">Supplier Ledger</div>
            <div className="text-xs text-slate-500">Payables activity</div>
          </button>
          <button onClick={() => setActiveSection('patient')} className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:shadow">
            <div className="font-medium">Patient Ledger</div>
            <div className="text-xs text-slate-500">Patient dues</div>
          </button>
        </div>
      )}

      {/* Balance Sheet Section */}
      {activeSection === 'balanceSheet' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">Balance Sheet (as of {to || todayStr()})</h2>
            <div className="flex items-center gap-2">
              <select className="border rounded-md px-3 py-2" value={portal} onChange={e=>setPortal(e.target.value)}>
                <option value="all">All Portals</option>
                <option value="admin">Admin</option>
                <option value="reception">Reception</option>
                <option value="doctor">Doctor</option>
                <option value="pharmacy">Pharmacy</option>
                <option value="lab">Lab</option>
                <option value="shop">Pet Shop</option>
              </select>
              <button onClick={refreshCore} className="px-3 py-2 rounded-md border">Refresh</button>
              <button onClick={()=>setActiveSection('')} className="px-3 py-2 rounded-md border">Back</button>
            </div>
          </div>
          {balanceSheet ? (
            <div className="text-sm space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between"><span>Total Assets</span><span className="font-semibold">{fmt(balanceSheet.totals.assets)}</span></div>
                <div className="flex justify-between"><span>Total Liabilities</span><span className="font-semibold">{fmt(balanceSheet.totals.liabilities)}</span></div>
                <div className="flex justify-between"><span>Retained Earnings</span><span className="font-semibold">{fmt(balanceSheet.totals.retainedEarnings)}</span></div>
                <div className="flex justify-between border-t pt-2 mt-2"><span>Total Equity</span><span className="font-semibold">{fmt(balanceSheet.totals.equity)}</span></div>
                <div className="flex justify-between"><span>Liabilities + Equity</span><span className="font-semibold">{fmt(balanceSheet.totals.liabilitiesAndEquity)}</span></div>
                <div className="flex justify-between"><span>Difference</span><span className={"font-semibold " + (Math.abs(balanceSheet.totals.difference || 0) < 0.01 ? 'text-emerald-600' : 'text-red-600')}>{fmt(balanceSheet.totals.difference || 0)}</span></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="border rounded-lg p-3">
                  <div className="font-medium mb-2">Assets</div>
                  <div className="overflow-auto max-h-80">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="text-left text-slate-500">
                          <th className="py-1 pr-3">Code</th>
                          <th className="py-1 pr-3">Account</th>
                          <th className="py-1 pr-3 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(balanceSheet.assets || []).map(r => (
                          <tr key={r.code} className="border-t">
                            <td className="py-1 pr-3">{r.code}</td>
                            <td className="py-1 pr-3">{r.name}</td>
                            <td className="py-1 pr-3 text-right">{fmt(r.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="border rounded-lg p-3">
                  <div className="font-medium mb-2">Liabilities</div>
                  <div className="overflow-auto max-h-80">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="text-left text-slate-500">
                          <th className="py-1 pr-3">Code</th>
                          <th className="py-1 pr-3">Account</th>
                          <th className="py-1 pr-3 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(balanceSheet.liabilities || []).map(r => (
                          <tr key={r.code} className="border-t">
                            <td className="py-1 pr-3">{r.code}</td>
                            <td className="py-1 pr-3">{r.name}</td>
                            <td className="py-1 pr-3 text-right">{fmt(r.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="border rounded-lg p-3">
                  <div className="font-medium mb-2">Equity</div>
                  <div className="overflow-auto max-h-80">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="text-left text-slate-500">
                          <th className="py-1 pr-3">Code</th>
                          <th className="py-1 pr-3">Account</th>
                          <th className="py-1 pr-3 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(balanceSheet.equity || []).map(r => (
                          <tr key={r.code} className="border-t">
                            <td className="py-1 pr-3">{r.code}</td>
                            <td className="py-1 pr-3">{r.name}</td>
                            <td className="py-1 pr-3 text-right">{fmt(r.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ) : <div className="text-sm text-slate-500">No data</div>}
        </div>
      )}

      {/* Cash Flow Section */}
      {activeSection === 'cashFlow' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">Cash Flow</h2>
            <div className="flex items-center gap-2">
              <select className="border rounded-md px-3 py-2" value={portal} onChange={e=>setPortal(e.target.value)}>
                <option value="all">All Portals</option>
                <option value="admin">Admin</option>
                <option value="reception">Reception</option>
                <option value="doctor">Doctor</option>
                <option value="pharmacy">Pharmacy</option>
                <option value="lab">Lab</option>
                <option value="shop">Pet Shop</option>
              </select>
              <button onClick={refreshCore} className="px-3 py-2 rounded-md border">Refresh</button>
              <button onClick={()=>setActiveSection('')} className="px-3 py-2 rounded-md border">Back</button>
            </div>
          </div>
          {cashFlow ? (
            <div className="space-y-4">
              <div className="text-sm space-y-1">
                <div className="flex justify-between"><span>Opening Cash + Bank</span><span className="font-semibold">{fmt(cashFlow.opening?.total || 0)}</span></div>
                {cashFlow.opening?.cashInHand !== undefined && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-slate-600">
                    <div className="flex justify-between"><span>Cash in Hand</span><span className="font-semibold">{fmt(cashFlow.opening?.cashInHand || 0)}</span></div>
                    <div className="flex justify-between"><span>Petty Cash</span><span className="font-semibold">{fmt(cashFlow.opening?.pettyCash || 0)}</span></div>
                    <div className="flex justify-between"><span>Bank</span><span className="font-semibold">{fmt(cashFlow.opening?.bank || 0)}</span></div>
                  </div>
                )}
                <div className="flex justify-between"><span>Total Inflows</span><span className="font-semibold">{fmt(cashFlow.totals?.inflows || 0)}</span></div>
                <div className="flex justify-between"><span>Total Outflows</span><span className="font-semibold">{fmt(cashFlow.totals?.outflows || 0)}</span></div>
                <div className="flex justify-between border-t pt-2 mt-2"><span>Net Change</span><span className="font-semibold">{fmt(cashFlow.totals?.netChange || 0)}</span></div>
                <div className="flex justify-between"><span>Closing Cash + Bank</span><span className="font-semibold">{fmt(cashFlow.closing?.total || 0)}</span></div>
                {cashFlow.closing?.cashInHand !== undefined && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-slate-600">
                    <div className="flex justify-between"><span>Cash in Hand</span><span className="font-semibold">{fmt(cashFlow.closing?.cashInHand || 0)}</span></div>
                    <div className="flex justify-between"><span>Petty Cash</span><span className="font-semibold">{fmt(cashFlow.closing?.pettyCash || 0)}</span></div>
                    <div className="flex justify-between"><span>Bank</span><span className="font-semibold">{fmt(cashFlow.closing?.bank || 0)}</span></div>
                  </div>
                )}
              </div>

              {['operating', 'investing', 'financing', 'uncategorized'].map((k) => {
                const sec = cashFlow.sections?.[k]
                if (!sec) return null
                const title = k.charAt(0).toUpperCase() + k.slice(1)
                const hasRows = (sec.inflows || []).length || (sec.outflows || []).length
                if (!hasRows) return null
                return (
                  <div key={k} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{title} Activities</div>
                      <div className="text-xs text-slate-600">Net: {fmt(sec.net || 0)}</div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Inflows</div>
                        <div className="overflow-auto max-h-72">
                          <table className="min-w-full text-xs">
                            <thead>
                              <tr className="text-left text-slate-500">
                                <th className="py-1 pr-3">Date</th>
                                <th className="py-1 pr-3">Desc</th>
                                <th className="py-1 pr-3 text-right">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(sec.inflows || []).map((r) => (
                                <tr key={r.entryId} className="border-t hover:bg-slate-50 cursor-pointer" onClick={() => openEntry(r.entryId)}>
                                  <td className="py-1 pr-3">{new Date(r.date).toLocaleDateString()}</td>
                                  <td className="py-1 pr-3">{r.description}</td>
                                  <td className="py-1 pr-3 text-right">{fmt(r.inflow)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Outflows</div>
                        <div className="overflow-auto max-h-72">
                          <table className="min-w-full text-xs">
                            <thead>
                              <tr className="text-left text-slate-500">
                                <th className="py-1 pr-3">Date</th>
                                <th className="py-1 pr-3">Desc</th>
                                <th className="py-1 pr-3 text-right">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(sec.outflows || []).map((r) => (
                                <tr key={r.entryId} className="border-t hover:bg-slate-50 cursor-pointer" onClick={() => openEntry(r.entryId)}>
                                  <td className="py-1 pr-3">{new Date(r.date).toLocaleDateString()}</td>
                                  <td className="py-1 pr-3">{r.description}</td>
                                  <td className="py-1 pr-3 text-right">{fmt(r.outflow)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : <div className="text-sm text-slate-500">No data</div>}
        </div>
      )}

      {/* Income Statement Section */}
      {activeSection === 'income' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">Income Statement</h2>
            <div className="flex items-center gap-2">
              <select className="border rounded-md px-3 py-2" value={portal} onChange={e=>setPortal(e.target.value)}>
                <option value="all">All Portals</option>
                <option value="admin">Admin</option>
                <option value="reception">Reception</option>
                <option value="doctor">Doctor</option>
                <option value="pharmacy">Pharmacy</option>
                <option value="lab">Lab</option>
                <option value="shop">Pet Shop</option>
              </select>
              <button onClick={refreshCore} className="px-3 py-2 rounded-md border">Refresh</button>
              <button onClick={()=>setActiveSection('')} className="px-3 py-2 rounded-md border">Back</button>
            </div>
          </div>
          {income ? (
            <div className="text-sm space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between"><span>Total Revenue</span><span className="font-semibold">{fmt(income.totalRevenue)}</span></div>
                <div className="flex justify-between"><span>COGS</span><span className="font-semibold">{fmt(income.totalCOGS)}</span></div>
                <div className="flex justify-between"><span>Gross Profit</span><span className="font-semibold">{fmt(income.grossProfit)}</span></div>
                <div className="flex justify-between"><span>Operating Expenses</span><span className="font-semibold">{fmt(income.totalExpenses)}</span></div>
                <div className="flex justify-between border-t pt-2 mt-2"><span>Net Profit</span><span className="font-semibold">{fmt(income.netProfit)}</span></div>
              </div>

              {income.operatingExpenseBreakdown && (
                <div className="border rounded-lg p-3">
                  <div className="font-medium mb-2">Operating Expense Breakdown</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-slate-50 rounded-md p-3">
                      <div className="text-xs text-slate-500">Staff Salaries</div>
                      <div className="font-semibold">{fmt(income.operatingExpenseBreakdown.staffSalaries || 0)}</div>
                    </div>
                    <div className="bg-slate-50 rounded-md p-3">
                      <div className="text-xs text-slate-500">Building-Related</div>
                      <div className="font-semibold">{fmt(income.operatingExpenseBreakdown.buildingRelated || 0)}</div>
                    </div>
                    <div className="bg-slate-50 rounded-md p-3">
                      <div className="text-xs text-slate-500">Other Operational</div>
                      <div className="font-semibold">{fmt(income.operatingExpenseBreakdown.otherOperational || 0)}</div>
                    </div>
                  </div>

                  {income.operatingExpenseBreakdown.entries && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                      {[
                        { key: 'staffSalaries', title: 'Staff Salaries' },
                        { key: 'buildingRelated', title: 'Building-Related' },
                        { key: 'otherOperational', title: 'Other Operational' },
                      ].map(h => (
                        <div key={h.key} className="border rounded-lg p-2">
                          <div className="text-xs text-slate-500 mb-1">{h.title}</div>
                          <div className="overflow-auto max-h-60">
                            <table className="min-w-full text-xs">
                              <thead>
                                <tr className="text-left text-slate-500">
                                  <th className="py-1 pr-3">Date</th>
                                  <th className="py-1 pr-3">Category</th>
                                  <th className="py-1 pr-3 text-right">Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(income.operatingExpenseBreakdown.entries?.[h.key]?.entries || []).map((r) => (
                                  <tr key={r.entryId} className="border-t hover:bg-slate-50 cursor-pointer" onClick={() => openEntry(r.entryId)}>
                                    <td className="py-1 pr-3">{new Date(r.date).toLocaleDateString()}</td>
                                    <td className="py-1 pr-3">{r.category}</td>
                                    <td className="py-1 pr-3 text-right">{fmt(r.amount)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : <div className="text-sm text-slate-500">No data</div>}
        </div>
      )}

      {/* Trial Balance Section */}
      {activeSection === 'trialBalance' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h2 className="font-medium">Trial Balance</h2>
              <select className="border rounded-md px-3 py-2" value={portal} onChange={e=>setPortal(e.target.value)}>
                <option value="all">All Portals</option>
                <option value="admin">Admin</option>
                <option value="reception">Reception</option>
                <option value="doctor">Doctor</option>
                <option value="pharmacy">Pharmacy</option>
                <option value="lab">Lab</option>
                <option value="shop">Pet Shop</option>
              </select>
              <button onClick={refreshCore} className="px-3 py-2 rounded-md border">Refresh</button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={exportTrialBalance} className="px-3 py-1.5 rounded-md border text-xs">Export CSV</button>
              <button onClick={()=>setActiveSection('')} className="px-3 py-1.5 rounded-md border">Back</button>
            </div>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-2 pr-4">Code</th>
                  <th className="py-2 pr-4">Account</th>
                  <th className="py-2 pr-4 text-right">Debit</th>
                  <th className="py-2 pr-4 text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {(trialBalance||[]).map((r) => (
                  <tr key={r.code} className="border-t">
                    <td className="py-2 pr-4">{r.code}</td>
                    <td className="py-2 pr-4">{r.name}</td>
                    <td className="py-2 pr-4 text-right">{fmt(r.debit)}</td>
                    <td className="py-2 pr-4 text-right">{fmt(r.credit)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-semibold">
                  <td className="py-2 pr-4" colSpan={2}>Totals</td>
                  <td className="py-2 pr-4 text-right">{fmt(netTrial.debit)}</td>
                  <td className="py-2 pr-4 text-right">{fmt(netTrial.credit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* General Ledger Section */}
      {activeSection === 'gl' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-medium">General Ledger</h2>
              <select className="border rounded-md px-3 py-2" value={portal} onChange={e=>setPortal(e.target.value)}>
                <option value="all">All Portals</option>
                <option value="admin">Admin</option>
                <option value="reception">Reception</option>
                <option value="doctor">Doctor</option>
                <option value="pharmacy">Pharmacy</option>
                <option value="lab">Lab</option>
                <option value="shop">Pet Shop</option>
              </select>
              <select className="border rounded-md px-3 py-2" value={glAccount} onChange={e => setGlAccount(e.target.value)}>
                {(accounts||[]).map(a => (
                  <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                ))}
              </select>
              <button onClick={refreshGL} className="px-3 py-2 rounded-md border">Show</button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={exportGL} className="px-3 py-2 rounded-md border text-xs">Export CSV</button>
              <button onClick={()=>setActiveSection('')} className="px-3 py-2 rounded-md border">Back</button>
              {glLoading && <span className="text-slate-500 text-sm">Loading…</span>}
            </div>
          </div>
          <div className="overflow-auto mt-3">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Portal</th>
                  <th className="py-2 pr-4">Source</th>
                  <th className="py-2 pr-4">Description</th>
                  <th className="py-2 pr-4 text-right">Debit</th>
                  <th className="py-2 pr-4 text-right">Credit</th>
                  <th className="py-2 pr-4 text-right">Run. Dr</th>
                  <th className="py-2 pr-4 text-right">Run. Cr</th>
                </tr>
              </thead>
              <tbody>
                {(glRows||[]).map((r, idx) => (
                  <tr key={idx} className="border-t hover:bg-slate-50 cursor-pointer" onClick={() => openEntry(r.entryId)}>
                    <td className="py-2 pr-4">{new Date(r.date).toLocaleString()}</td>
                    <td className="py-2 pr-4">{r.portal}</td>
                    <td className="py-2 pr-4">{r.sourceType}</td>
                    <td className="py-2 pr-4">{r.description}</td>
                    <td className="py-2 pr-4 text-right">{fmt(r.debit)}</td>
                    <td className="py-2 pr-4 text-right">{fmt(r.credit)}</td>
                    <td className="py-2 pr-4 text-right">{fmt(r.runningDebit)}</td>
                    <td className="py-2 pr-4 text-right">{fmt(r.runningCredit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Customer Ledger Section */}
      {activeSection === 'customer' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h3 className="font-medium">Customer Ledger</h3>
              <select className="border rounded-md px-3 py-2" value={portal} onChange={e=>setPortal(e.target.value)}>
                <option value="all">All Portals</option>
                <option value="admin">Admin</option>
                <option value="reception">Reception</option>
                <option value="doctor">Doctor</option>
                <option value="pharmacy">Pharmacy</option>
                <option value="lab">Lab</option>
                <option value="shop">Pet Shop</option>
              </select>
              <input className="border rounded-md px-3 py-2" placeholder="Customer ID" value={customerId} onChange={e=>setCustomerId(e.target.value)} />
              <button onClick={fetchCustomer} className="px-3 py-2 rounded-md border">Show</button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={exportCustomer} className="px-3 py-2 rounded-md border text-xs">Export CSV</button>
              <button onClick={()=>setActiveSection('')} className="px-3 py-2 rounded-md border">Back</button>
            </div>
          </div>
          <div className="overflow-auto max-h-72">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-1 pr-3">Date</th>
                  <th className="py-1 pr-3">Desc</th>
                  <th className="py-1 pr-3 text-right">Debit</th>
                  <th className="py-1 pr-3 text-right">Credit</th>
                  <th className="py-1 pr-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {(customerRows||[]).map((r, i) => (
                  <tr key={i} className="border-t hover:bg-slate-50 cursor-pointer" onClick={() => openEntry(r.entryId)}>
                    <td className="py-1 pr-3">{new Date(r.date).toLocaleDateString()}</td>
                    <td className="py-1 pr-3">{r.description}</td>
                    <td className="py-1 pr-3 text-right">{fmt(r.debit)}</td>
                    <td className="py-1 pr-3 text-right">{fmt(r.credit)}</td>
                    <td className="py-1 pr-3 text-right">{fmt(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Supplier Ledger Section */}
      {activeSection === 'supplier' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h3 className="font-medium">Supplier Ledger</h3>
              <select className="border rounded-md px-3 py-2" value={portal} onChange={e=>setPortal(e.target.value)}>
                <option value="all">All Portals</option>
                <option value="admin">Admin</option>
                <option value="reception">Reception</option>
                <option value="doctor">Doctor</option>
                <option value="pharmacy">Pharmacy</option>
                <option value="lab">Lab</option>
                <option value="shop">Pet Shop</option>
              </select>
              <input className="border rounded-md px-3 py-2" placeholder="Supplier ID/Name" value={supplierId} onChange={e=>setSupplierId(e.target.value)} />
              <button onClick={fetchSupplier} className="px-3 py-2 rounded-md border">Show</button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={exportSupplier} className="px-3 py-2 rounded-md border text-xs">Export CSV</button>
              <button onClick={()=>setActiveSection('')} className="px-3 py-2 rounded-md border">Back</button>
            </div>
          </div>
          <div className="overflow-auto max-h-72">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-1 pr-3">Date</th>
                  <th className="py-1 pr-3">Desc</th>
                  <th className="py-1 pr-3 text-right">Debit</th>
                  <th className="py-1 pr-3 text-right">Credit</th>
                  <th className="py-1 pr-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {(supplierRows||[]).map((r, i) => (
                  <tr key={i} className="border-t hover:bg-slate-50 cursor-pointer" onClick={() => openEntry(r.entryId)}>
                    <td className="py-1 pr-3">{new Date(r.date).toLocaleDateString()}</td>
                    <td className="py-1 pr-3">{r.description}</td>
                    <td className="py-1 pr-3 text-right">{fmt(r.debit)}</td>
                    <td className="py-1 pr-3 text-right">{fmt(r.credit)}</td>
                    <td className="py-1 pr-3 text-right">{fmt(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Patient Ledger Section */}
      {activeSection === 'patient' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h3 className="font-medium">Patient Ledger</h3>
              <select className="border rounded-md px-3 py-2" value={portal} onChange={e=>setPortal(e.target.value)}>
                <option value="all">All Portals</option>
                <option value="admin">Admin</option>
                <option value="reception">Reception</option>
                <option value="doctor">Doctor</option>
                <option value="pharmacy">Pharmacy</option>
                <option value="lab">Lab</option>
                <option value="shop">Pet Shop</option>
              </select>
              <input className="border rounded-md px-3 py-2" placeholder="Patient ID" value={patientId} onChange={e=>setPatientId(e.target.value)} />
              <button onClick={fetchPatient} className="px-3 py-2 rounded-md border">Show</button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={exportPatient} className="px-3 py-2 rounded-md border text-xs">Export CSV</button>
              <button onClick={()=>setActiveSection('')} className="px-3 py-2 rounded-md border">Back</button>
            </div>
          </div>
          <div className="overflow-auto max-h-72">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-1 pr-3">Date</th>
                  <th className="py-1 pr-3">Desc</th>
                  <th className="py-1 pr-3 text-right">Debit</th>
                  <th className="py-1 pr-3 text-right">Credit</th>
                  <th className="py-1 pr-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {(patientRows||[]).map((r, i) => (
                  <tr key={i} className="border-t hover:bg-slate-50 cursor-pointer" onClick={() => openEntry(r.entryId)}>
                    <td className="py-1 pr-3">{new Date(r.date).toLocaleDateString()}</td>
                    <td className="py-1 pr-3">{r.description}</td>
                    <td className="py-1 pr-3 text-right">{fmt(r.debit)}</td>
                    <td className="py-1 pr-3 text-right">{fmt(r.credit)}</td>
                    <td className="py-1 pr-3 text-right">{fmt(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {entryOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setEntryOpen(false)}>
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-3xl max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between">
              <div className="font-medium">Journal Entry Detail</div>
              <button className="px-3 py-1.5 rounded-md border" onClick={() => setEntryOpen(false)}>Close</button>
            </div>
            <div className="p-4 space-y-3">
              {entryLoading && <div className="text-sm text-slate-500">Loading…</div>}
              {entryError && <div className="text-sm text-red-600">{entryError}</div>}
              {entryDetail && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div className="border rounded-lg p-3">
                      <div className="text-xs text-slate-500">What</div>
                      <div className="font-medium">{entryDetail.description || '-'}</div>
                      <div className="text-xs text-slate-500 mt-2">When</div>
                      <div>{entryDetail.date ? new Date(entryDetail.date).toLocaleString() : '-'}</div>
                      <div className="text-xs text-slate-500 mt-2">Where</div>
                      <div>{entryDetail.portal || '-'}</div>
                    </div>
                    <div className="border rounded-lg p-3">
                      <div className="text-xs text-slate-500">Why / Source</div>
                      <div className="font-medium">{entryDetail.sourceType || '-'}</div>
                      <div className="text-xs text-slate-500 mt-2">Reference</div>
                      <div>{entryDetail.sourceId || '-'}</div>
                      <div className="text-xs text-slate-500 mt-2">Payment Status</div>
                      <div className="font-medium">{entryDetail.paymentStatus || '-'}</div>
                    </div>
                  </div>

                  <div className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium">Components</div>
                      <div className="text-xs text-slate-600">Debit {fmt(entryDetail.totals?.debit || 0)} | Credit {fmt(entryDetail.totals?.credit || 0)}</div>
                    </div>
                    <div className="overflow-auto">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="text-left text-slate-500">
                            <th className="py-1 pr-3">Account</th>
                            <th className="py-1 pr-3">Type</th>
                            <th className="py-1 pr-3 text-right">Debit</th>
                            <th className="py-1 pr-3 text-right">Credit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(entryDetail.lines || []).map((l) => (
                            <tr key={l.accountCode} className="border-t">
                              <td className="py-1 pr-3">{l.accountCode} - {l.accountName}</td>
                              <td className="py-1 pr-3">{l.accountType || '-'}</td>
                              <td className="py-1 pr-3 text-right">{fmt(l.debit || 0)}</td>
                              <td className="py-1 pr-3 text-right">{fmt(l.credit || 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
