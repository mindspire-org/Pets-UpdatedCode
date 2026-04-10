import React, { useEffect, useMemo, useState } from 'react'
import { useSettings } from '../../context/SettingsContext'
import { accountingAPI, suppliersAPI, vouchersAPI } from '../../services/api'
import VendorSelect from '../../components/VendorSelect'

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-')
const todayStr = () => new Date().toISOString().slice(0, 10)

export default function ERPExpenses() {
  const { settings } = useSettings()

  const [portal, setPortal] = useState('admin')
  const [date, setDate] = useState(todayStr())
  const [category, setCategory] = useState('')
  const [expenseAccount, setExpenseAccount] = useState('')
  const [payFrom, setPayFrom] = useState('1001')
  const [amount, setAmount] = useState('')
  const [vendorId, setVendorId] = useState('')
  const [receiptNo, setReceiptNo] = useState('')
  const [details, setDetails] = useState('')

  const [accounts, setAccounts] = useState([])
  const [vendors, setVendors] = useState([])

  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')

  const [recent, setRecent] = useState([])
  const [recentLoading, setRecentLoading] = useState(false)

  const expenseAccounts = useMemo(() => {
    return (accounts || [])
      .filter(a => a.active !== false && !a.isGroup)
      .filter(a => a.type === 'expense')
      .slice()
      .sort((a, b) => String(a.code).localeCompare(String(b.code)))
  }, [accounts])

  const cashBankAccounts = useMemo(() => {
    const list = (accounts || [])
      .filter(a => a.active !== false && !a.isGroup)
      .filter(a => ['cash', 'bank'].includes(String(a.subType || '').toLowerCase()) || ['1001', '1002'].includes(String(a.code)))
      .slice()
      .sort((a, b) => String(a.code).localeCompare(String(b.code)))
    return list
  }, [accounts])

  const vendorOptions = useMemo(() => {
    return (vendors || [])
      .slice()
      .sort((a, b) => String(a.supplierName || '').localeCompare(String(b.supplierName || '')))
  }, [vendors])

  const vendorName = useMemo(() => {
    return vendorOptions.find(v => v._id === vendorId)?.supplierName || ''
  }, [vendorId, vendorOptions])

  const payFromName = useMemo(() => {
    return cashBankAccounts.find(a => a.code === payFrom)?.name || payFrom
  }, [payFrom, cashBankAccounts])

  const paymentMethod = useMemo(() => {
    const acc = cashBankAccounts.find(a => a.code === payFrom)
    const st = String(acc?.subType || '').toLowerCase()
    if (st === 'bank' || payFrom === '1002') return 'Bank'
    return 'Cash'
  }, [payFrom, cashBankAccounts])

  const loadAccounts = async () => {
    try {
      const res = await accountingAPI.getAccounts()
      setAccounts(res?.data || [])
    } catch {
      setAccounts([])
    }
  }

  const loadVendors = async () => {
    try {
      const res = await suppliersAPI.getAll(portal)
      setVendors(res?.data || [])
    } catch {
      setVendors([])
    }
  }

  const loadRecent = async () => {
    setRecentLoading(true)
    try {
      const res = await vouchersAPI.list({ portal, limit: 15, q: 'Expense -' })
      setRecent(res?.data || [])
    } catch {
      setRecent([])
    } finally {
      setRecentLoading(false)
    }
  }

  useEffect(() => {
    loadAccounts()
  }, [])

  useEffect(() => {
    loadVendors()
    loadRecent()
  }, [portal])

  const draftVoucherPreview = useMemo(() => {
    const amt = Number(amount || 0)
    if (!expenseAccount || !payFrom || !amt || !category) return null

    const expName = accounts.find(a => a.code === expenseAccount)?.name || ''
    const payName = accounts.find(a => a.code === payFrom)?.name || ''

    const desc = `Expense - ${category}${details ? ` | ${details}` : ''}`

    return {
      voucherNo: 'DRAFT',
      type: 'PV',
      status: 'draft',
      date,
      portal,
      receiptNo,
      paymentMethod,
      expenseCategory: category,
      description: desc,
      partyType: vendorId ? 'supplier' : 'none',
      partyId: vendorId || '',
      partyName: vendorName || '',
      totals: { debit: amt, credit: amt },
      lines: [
        { accountCode: expenseAccount, accountName: expName, debit: amt, credit: 0 },
        { accountCode: payFrom, accountName: payName, debit: 0, credit: amt },
      ],
    }
  }, [amount, category, details, date, portal, expenseAccount, payFrom, accounts, vendorId, vendorName, receiptNo, paymentMethod])

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
<title>Expense</title>
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
  .sig{margin-top:28px; display:flex; justify-content:space-between; gap:16px;}
  .sig > div{width:32%; border-top:1px solid #aaa; padding-top:6px; font-size:12px; text-align:center;}
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
      <div class="title">Expense Voucher</div>
      <div class="muted">Payment • ${new Date(v.date).toLocaleDateString()} • Portal: ${v.portal}</div>
      ${v.expenseCategory ? `<div class="muted">Category: ${v.expenseCategory}</div>` : ''}
      ${v.partyName ? `<div class="muted">Vendor: ${v.partyName}</div>` : ''}
      ${v.receiptNo ? `<div class="muted">Receipt No: ${v.receiptNo}</div>` : ''}
      ${v.description ? `<div class="muted">${v.description}</div>` : ''}
    </div>
    <div style="text-align:right">
      <div class="title">${v.voucherNo || '(Preview)'}</div>
      <div class="muted">${v.status || 'draft'}</div>
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

  <div class="sig">
    <div>Prepared By</div>
    <div>Checked By</div>
    <div>Approved By</div>
  </div>

  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`

    w.document.open()
    w.document.write(html)
    w.document.close()
  }

  const postExpense = async () => {
    setPosting(true)
    setError('')
    try {
      const amt = Number(amount || 0)
      if (!category || !expenseAccount || !payFrom || !amt) {
        setError('Date, Category, Expense Account, Pay From, and Amount are required')
        return
      }

      const desc = `Expense - ${category}${details ? ` | ${details}` : ''}`

      const res = await vouchersAPI.create({
        type: 'PV',
        portal,
        date,
        receiptNo: receiptNo || undefined,
        paymentMethod,
        expenseCategory: category,
        description: desc,
        partyType: vendorId ? 'supplier' : 'none',
        partyId: vendorId || undefined,
        partyName: vendorName || undefined,
        lines: [
          { accountCode: expenseAccount, debit: amt, credit: 0 },
          { accountCode: payFrom, debit: 0, credit: amt },
        ],
        post: true,
      })

      const created = res?.data || null
      setCategory('')
      setExpenseAccount('')
      setAmount('')
      setVendorId('')
      setReceiptNo('')
      setDetails('')

      await loadRecent()

      // Use the top-right Print/Save button when needed
    } catch (e) {
      setError(e?.response?.message || e?.message || 'Failed to post expense')
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-semibold text-slate-800">Expenses</div>
          <div className="text-sm text-slate-500">Post expenses that flow into Vouchers and General Ledger.</div>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-2 rounded-md border" onClick={() => doPrint(draftVoucherPreview)} disabled={!draftVoucherPreview}>Print / Save PDF</button>
          <button className="px-3 py-2 rounded-md bg-indigo-600 text-white" onClick={postExpense} disabled={posting}>Post Expense</button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
          <div>
            <div className="text-xs text-slate-500 mb-1">Portal</div>
            <select className="w-full border rounded-md px-2 py-2" value={portal} onChange={e => setPortal(e.target.value)}>
              <option value="admin">Admin</option>
              <option value="reception">Reception</option>
              <option value="pharmacy">Pharmacy</option>
              <option value="lab">Lab</option>
              <option value="shop">Pet Shop</option>
            </select>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Date</div>
            <input type="date" className="w-full border rounded-md px-2 py-2" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <div className="text-xs text-slate-500 mb-1">Expense Category</div>
            <input className="w-full border rounded-md px-2 py-2" value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Rent, Salary, Utilities" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm mt-2">
          <div className="md:col-span-2">
            <div className="text-xs text-slate-500 mb-1">Expense Category (Debit)</div>
            <select className="w-full border rounded-md px-2 py-2" value={expenseAccount} onChange={e => setExpenseAccount(e.target.value)}>
              <option value="">Select expense account…</option>
              {(expenseAccounts || []).map(a => (
                <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Pay From (Credit)</div>
            <select className="w-full border rounded-md px-2 py-2" value={payFrom} onChange={e => setPayFrom(e.target.value)}>
              {(cashBankAccounts || []).map(a => (
                <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Amount</div>
            <input type="number" className="w-full border rounded-md px-2 py-2" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm mt-2">
          <div>
            <div className="text-xs text-slate-500 mb-1">Vendor (optional)</div>
            <VendorSelect
              portal={portal}
              value={vendorId}
              onChange={(id, v) => {
                setVendorId(id)
                if (v?.supplierName) {
                  // keep vendorName in sync via memo (vendors state)
                }
              }}
              options={vendorOptions}
              setOptions={setVendors}
              allowNone={true}
              noneLabel="No Vendor"
            />
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Receipt No.</div>
            <input className="w-full border rounded-md px-2 py-2" value={receiptNo} onChange={e => setReceiptNo(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Details</div>
            <input className="w-full border rounded-md px-2 py-2" value={details} onChange={e => setDetails(e.target.value)} placeholder="e.g. Cash paid for refreshments" />
          </div>
        </div>

        <div className="text-xs text-slate-500 mt-2">
          Posting as: Dr {expenseAccount || 'Expense'} / Cr {payFromName} ({paymentMethod})
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-slate-800">Recent Expenses</div>
          {recentLoading && <div className="text-xs text-slate-500">Loading…</div>}
        </div>
        <div className="overflow-auto mt-2">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Voucher</th>
                <th className="py-2 pr-3">Category</th>
                <th className="py-2 pr-3">Vendor</th>
                <th className="py-2 pr-3">Pay From</th>
                <th className="py-2 pr-3 text-right">Amount</th>
                <th className="py-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {(recent || []).map(r => (
                <tr key={r._id} className="border-t">
                  <td className="py-2 pr-3">{r.date ? new Date(r.date).toLocaleDateString() : ''}</td>
                  <td className="py-2 pr-3 font-mono">{r.voucherNo}</td>
                  <td className="py-2 pr-3">{r.expenseCategory || (r.description || '').replace(/^Expense\s*-\s*/i, '').split('|')[0].trim()}</td>
                  <td className="py-2 pr-3">{r.partyName || ''}</td>
                  <td className="py-2 pr-3">{(r.lines || []).find(l => Number(l.credit || 0) > 0)?.accountName || (r.lines || []).find(l => Number(l.credit || 0) > 0)?.accountCode || ''}</td>
                  <td className="py-2 pr-3 text-right">{fmt(r.totals?.debit || 0)}</td>
                  <td className="py-2 pr-3">{r.status}</td>
                </tr>
              ))}
              {(!recent || recent.length === 0) && !recentLoading && (
                <tr>
                  <td className="py-6 text-center text-slate-500" colSpan={7}>No expenses yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
