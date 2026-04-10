import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSettings } from '../../context/SettingsContext'
import { accountingAPI, vouchersAPI, suppliersAPI } from '../../services/api'
import VendorSelect from '../../components/VendorSelect'

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-')
const todayStr = () => new Date().toISOString().slice(0, 10)

const PETTY_CODE = '1003'

export default function PettyCash() {
  const { settings } = useSettings()

  const [portal, setPortal] = useState('admin')
  const [asOf, setAsOf] = useState(todayStr())

  const [balance, setBalance] = useState(null)
  const [balanceLoading, setBalanceLoading] = useState(false)

  const [accounts, setAccounts] = useState([])
  const [vendors, setVendors] = useState([])

  const [activity, setActivity] = useState([])
  const [activityLoading, setActivityLoading] = useState(false)

  // Fund/Replenish
  const [fundSource, setFundSource] = useState('1002')
  const [fundAmount, setFundAmount] = useState('')
  const [fundNote, setFundNote] = useState('')

  // Spend
  const [expCategory, setExpCategory] = useState('')
  const [expAccount, setExpAccount] = useState('')
  const [expAmount, setExpAmount] = useState('')
  const [vendorId, setVendorId] = useState('')
  const [receiptNo, setReceiptNo] = useState('')
  const [details, setDetails] = useState('')

  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')

  const accountOptions = useMemo(() => {
    return (accounts || [])
      .filter(a => a.active !== false && !a.isGroup)
      .slice()
      .sort((a, b) => String(a.code).localeCompare(String(b.code)))
  }, [accounts])

  const cashBankOptions = useMemo(() => {
    return (accounts || [])
      .filter(a => a.active !== false && !a.isGroup)
      .filter(a => ['cash', 'bank'].includes(String(a.subType || '').toLowerCase()) || ['1001', '1002', '1003'].includes(String(a.code)))
      .slice()
      .sort((a, b) => String(a.code).localeCompare(String(b.code)))
  }, [accounts])

  const expenseOptions = useMemo(() => {
    return (accounts || [])
      .filter(a => a.active !== false && !a.isGroup)
      .filter(a => a.type === 'expense')
      .slice()
      .sort((a, b) => String(a.code).localeCompare(String(b.code)))
  }, [accounts])

  const vendorName = useMemo(() => {
    return (vendors || []).find(v => v._id === vendorId)?.supplierName || ''
  }, [vendors, vendorId])

  const loadAccounts = useCallback(async () => {
    try {
      const res = await accountingAPI.getAccounts()
      setAccounts(res?.data || [])
    } catch {
      setAccounts([])
    }
  }, [])

  const loadVendors = useCallback(async () => {
    try {
      const res = await suppliersAPI.getAll(portal)
      setVendors(res?.data || [])
    } catch {
      setVendors([])
    }
  }, [portal])

  const loadBalance = useCallback(async () => {
    setBalanceLoading(true)
    try {
      const res = await accountingAPI.getAccountBalance(PETTY_CODE, asOf, portal)
      setBalance(res?.data || null)
    } catch {
      setBalance(null)
    } finally {
      setBalanceLoading(false)
    }
  }, [asOf, portal])

  const loadActivity = useCallback(async () => {
    setActivityLoading(true)
    try {
      const res = await vouchersAPI.list({ portal, accountCode: PETTY_CODE, limit: 20 })
      setActivity(res?.data || [])
    } catch {
      setActivity([])
    } finally {
      setActivityLoading(false)
    }
  }, [portal])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  useEffect(() => {
    loadVendors()
    loadBalance()
    loadActivity()
  }, [loadActivity, loadBalance, loadVendors])

  const doPrint = (v) => {
    if (!v) return
    const w = window.open('', '_blank')
    if (!w) return

    const headerName = settings?.companyName || 'Abbottabad Pet Hospital'
    const headerAddr = settings?.address || ''
    const headerPhone = settings?.phone || ''
    const headerLogo = settings?.companyLogo || ''

    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${v.voucherNo || 'Petty Cash'}</title>
<style>
  body{font-family: Arial, sans-serif; padding:24px; color:#111;}
  .brand{display:flex; align-items:center; gap:12px; margin-bottom:12px;}
  .brand img{height:44px; width:44px; object-fit:cover; border-radius:8px; border:1px solid #e5e7eb;}
  .brand .nm{font-size:18px; font-weight:800; line-height:1.1;}
  .brand .meta{color:#555; font-size:12px; line-height:1.35;}
  .sep{border-top:1px solid #e5e7eb; margin:12px 0;}
  .hdr{display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;}
  .title{font-size:18px; font-weight:700;}
  .muted{color:#555; font-size:12px;}
  table{width:100%; border-collapse:collapse; margin-top:10px;}
  th,td{border:1px solid #ddd; padding:8px; font-size:12px;}
  th{background:#f5f5f5; text-align:left;}
  .right{text-align:right;}
  .tot{margin-top:10px; display:flex; justify-content:flex-end; gap:16px; font-weight:700;}
</style>
</head>
<body>
  <div class="brand">
    ${headerLogo ? `<img src="${headerLogo}" alt="Logo" />` : ''}
    <div>
      <div class="nm">${headerName}</div>
      ${(headerAddr || headerPhone) ? `<div class="meta">${headerAddr ? headerAddr : ''}${headerAddr && headerPhone ? ' • ' : ''}${headerPhone ? headerPhone : ''}</div>` : ''}
    </div>
  </div>
  <div class="sep"></div>

  <div class="hdr">
    <div>
      <div class="title">Petty Cash Voucher</div>
      <div class="muted">${v.type || ''} • ${v.date ? new Date(v.date).toLocaleDateString() : ''} • Portal: ${v.portal || ''}</div>
      ${v.description ? `<div class="muted">${v.description}</div>` : ''}
      ${v.partyName ? `<div class="muted">Vendor: ${v.partyName}</div>` : ''}
      ${v.receiptNo ? `<div class="muted">Receipt No: ${v.receiptNo}</div>` : ''}
    </div>
    <div style="text-align:right">
      <div class="title">${v.voucherNo || ''}</div>
      <div class="muted">${v.status || ''}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Account</th>
        <th class="right">Debit</th>
        <th class="right">Credit</th>
      </tr>
    </thead>
    <tbody>
      ${(v.lines || []).map(l => `
        <tr>
          <td>${l.accountCode} - ${(l.accountName || '')}</td>
          <td class="right">${fmt(Number(l.debit||0))}</td>
          <td class="right">${fmt(Number(l.credit||0))}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="tot">
    <div>Debit: ${fmt(v.totals?.debit || 0)}</div>
    <div>Credit: ${fmt(v.totals?.credit || 0)}</div>
  </div>

  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`

    w.document.open()
    w.document.write(html)
    w.document.close()
  }

  const fundPetty = async () => {
    setPosting(true)
    setError('')
    try {
      const amt = Number(fundAmount || 0)
      if (!fundSource || !amt) {
        setError('Source account and amount are required')
        return
      }
      if (fundSource === PETTY_CODE) {
        setError('Source cannot be Petty Cash')
        return
      }

      const srcName = accountOptions.find(a => a.code === fundSource)?.name || fundSource
      const desc = `Petty Cash Fund - ${srcName}${fundNote ? ` | ${fundNote}` : ''}`

      const res = await vouchersAPI.create({
        type: 'CV',
        portal,
        date: asOf,
        description: desc,
        lines: [
          { accountCode: PETTY_CODE, debit: amt, credit: 0 },
          { accountCode: fundSource, debit: 0, credit: amt },
        ],
        post: true,
      })

      setFundAmount('')
      setFundNote('')
      await loadBalance()
      await loadActivity()

      if (res?.data) doPrint(res.data)
    } catch (e) {
      setError(e?.response?.message || e?.message || 'Failed to fund petty cash')
    } finally {
      setPosting(false)
    }
  }

  const spendPetty = async () => {
    setPosting(true)
    setError('')
    try {
      const amt = Number(expAmount || 0)
      if (!expCategory || !expAccount || !amt) {
        setError('Category, Expense account and amount are required')
        return
      }

      const desc = `Expense - ${expCategory}${details ? ` | ${details}` : ''}`

      const res = await vouchersAPI.create({
        type: 'PV',
        portal,
        date: asOf,
        receiptNo: receiptNo || undefined,
        paymentMethod: 'Petty Cash',
        expenseCategory: expCategory,
        description: desc,
        partyType: vendorId ? 'supplier' : 'none',
        partyId: vendorId || undefined,
        partyName: vendorName || undefined,
        lines: [
          { accountCode: expAccount, debit: amt, credit: 0 },
          { accountCode: PETTY_CODE, debit: 0, credit: amt },
        ],
        post: true,
      })

      setExpCategory('')
      setExpAccount('')
      setExpAmount('')
      setVendorId('')
      setReceiptNo('')
      setDetails('')

      await loadBalance()
      await loadActivity()

      if (res?.data) doPrint(res.data)
    } catch (e) {
      setError(e?.response?.message || e?.message || 'Failed to spend petty cash')
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-semibold text-slate-800">Petty Cash</div>
          <div className="text-sm text-slate-500">Manage petty cash funding and petty expenses.</div>
        </div>
        <div className="flex items-center gap-2">
          <select className="border rounded-md px-3 py-2" value={portal} onChange={e => setPortal(e.target.value)}>
            <option value="admin">Admin</option>
            <option value="reception">Reception</option>
            <option value="pharmacy">Pharmacy</option>
            <option value="lab">Lab</option>
            <option value="shop">Pet Shop</option>
          </select>
          <input type="date" className="border rounded-md px-3 py-2" value={asOf} onChange={e => setAsOf(e.target.value)} />
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-slate-800">Petty Cash Balance</div>
          {balanceLoading && <div className="text-xs text-slate-500">Loading…</div>}
        </div>
        <div className="mt-2 text-2xl font-bold">{fmt(balance?.balance || 0)}</div>
        <div className="text-xs text-slate-500">Account: {PETTY_CODE} • As of: {asOf}</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="font-semibold text-slate-800 mb-2">Fund / Replenish Petty Cash</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div>
              <div className="text-xs text-slate-500 mb-1">Source (Credit)</div>
              <select className="w-full border rounded-md px-2 py-2" value={fundSource} onChange={e => setFundSource(e.target.value)}>
                {(cashBankOptions || []).filter(a => a.code !== PETTY_CODE).map(a => (
                  <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Amount</div>
              <input type="number" className="w-full border rounded-md px-2 py-2" value={fundAmount} onChange={e => setFundAmount(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <div className="text-xs text-slate-500 mb-1">Note</div>
              <input className="w-full border rounded-md px-2 py-2" value={fundNote} onChange={e => setFundNote(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <button className="px-3 py-2 rounded-md bg-indigo-600 text-white" onClick={fundPetty} disabled={posting}>Post Fund</button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="font-semibold text-slate-800 mb-2">Spend from Petty Cash</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div className="md:col-span-2">
              <div className="text-xs text-slate-500 mb-1">Expense Category</div>
              <input className="w-full border rounded-md px-2 py-2" value={expCategory} onChange={e => setExpCategory(e.target.value)} placeholder="e.g. Refreshments" />
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Expense Account (Debit)</div>
              <select className="w-full border rounded-md px-2 py-2" value={expAccount} onChange={e => setExpAccount(e.target.value)}>
                <option value="">Select expense account…</option>
                {(expenseOptions || []).map(a => (
                  <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Amount</div>
              <input type="number" className="w-full border rounded-md px-2 py-2" value={expAmount} onChange={e => setExpAmount(e.target.value)} />
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Vendor (optional)</div>
              <VendorSelect
                portal={portal}
                value={vendorId}
                onChange={(id) => setVendorId(id)}
                options={vendors}
                setOptions={setVendors}
                allowNone={true}
                noneLabel="No Vendor"
              />
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Receipt No.</div>
              <input className="w-full border rounded-md px-2 py-2" value={receiptNo} onChange={e => setReceiptNo(e.target.value)} placeholder="Optional" />
            </div>
            <div className="md:col-span-2">
              <div className="text-xs text-slate-500 mb-1">Details</div>
              <input className="w-full border rounded-md px-2 py-2" value={details} onChange={e => setDetails(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <button className="px-3 py-2 rounded-md bg-indigo-600 text-white" onClick={spendPetty} disabled={posting}>Post Expense</button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-slate-800">Recent Petty Cash Activity</div>
          {activityLoading && <div className="text-xs text-slate-500">Loading…</div>}
        </div>
        <div className="overflow-auto mt-2">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Voucher</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Description</th>
                <th className="py-2 pr-3 text-right">Debit</th>
                <th className="py-2 pr-3 text-right">Credit</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {(activity || []).map(v => (
                <tr key={v._id} className="border-t">
                  <td className="py-2 pr-3">{v.date ? new Date(v.date).toLocaleDateString() : ''}</td>
                  <td className="py-2 pr-3 font-mono">{v.voucherNo}</td>
                  <td className="py-2 pr-3">{v.type}</td>
                  <td className="py-2 pr-3">{v.description || ''}</td>
                  <td className="py-2 pr-3 text-right">{fmt(v.totals?.debit || 0)}</td>
                  <td className="py-2 pr-3 text-right">{fmt(v.totals?.credit || 0)}</td>
                  <td className="py-2 pr-3 text-right">
                    <button className="px-2 py-1 rounded-md border" onClick={() => doPrint(v)}>Print</button>
                  </td>
                </tr>
              ))}
              {(!activity || activity.length === 0) && !activityLoading && (
                <tr>
                  <td className="py-6 text-center text-slate-500" colSpan={7}>No activity yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
