import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSettings } from '../../context/SettingsContext'
import { accountingAPI, vouchersAPI } from '../../services/api'

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-')
const todayStr = () => new Date().toISOString().slice(0, 10)

export default function AccountingOverview() {
  const { settings } = useSettings()
  const [accounts, setAccounts] = useState([])

  const [portal, setPortal] = useState('admin')
  const [date, setDate] = useState(todayStr())
  const [fromAccount, setFromAccount] = useState('')
  const [toAccount, setToAccount] = useState('')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')

  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState('')

  const [recent, setRecent] = useState([])
  const [loadingRecent, setLoadingRecent] = useState(false)

  const accountOptions = useMemo(() => {
    return (accounts || [])
      .filter(a => a.active !== false && !a.isGroup)
      .slice()
      .sort((a, b) => String(a.code).localeCompare(String(b.code)))
  }, [accounts])

  const loadAccounts = useCallback(async () => {
    try {
      const res = await accountingAPI.getAccounts()
      setAccounts(res?.data || [])
    } catch {
      setAccounts([])
    }
  }, [])

  const loadRecent = useCallback(async (portalValue) => {
    setLoadingRecent(true)
    try {
      const res = await vouchersAPI.list({ portal: portalValue, limit: 10 })
      setRecent(res?.data || [])
    } catch {
      setRecent([])
    } finally {
      setLoadingRecent(false)
    }
  }, [])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  useEffect(() => {
    loadRecent(portal)
  }, [portal, loadRecent])

  const draftVoucherPreview = useMemo(() => {
    const amt = Number(amount || 0)
    if (!fromAccount || !toAccount || !amt) return null
    const fromName = accountOptions.find(a => a.code === fromAccount)?.name || ''
    const toName = accountOptions.find(a => a.code === toAccount)?.name || ''
    return {
      voucherNo: 'DRAFT',
      type: 'JV',
      status: 'draft',
      date,
      portal,
      description: memo,
      partyName: '',
      receiptNo: '',
      totals: { debit: amt, credit: amt },
      lines: [
        { accountCode: toAccount, accountName: toName, debit: amt, credit: 0 },
        { accountCode: fromAccount, accountName: fromName, debit: 0, credit: amt },
      ],
    }
  }, [amount, fromAccount, toAccount, date, portal, memo, accountOptions])

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
<title>Quick Transaction</title>
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
      <div class="title">Quick Transaction</div>
      <div class="muted">Journal • ${new Date(v.date).toLocaleDateString()} • Portal: ${v.portal}</div>
      ${v.description ? `<div class="muted">${v.description}</div>` : ''}
    </div>
    <div style="text-align:right">
      <div class="title">(Preview)</div>
      <div class="muted">Not yet posted</div>
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

  const postTransaction = async () => {
    setPosting(true)
    setPostError('')
    try {
      const amt = Number(amount || 0)
      if (!fromAccount || !toAccount || !amt) {
        setPostError('From account, To account and Amount are required')
        return
      }
      if (fromAccount === toAccount) {
        setPostError('From account and To account cannot be same')
        return
      }

      await vouchersAPI.create({
        type: 'JV',
        portal,
        date,
        description: memo,
        partyType: 'none',
        lines: [
          { accountCode: toAccount, debit: amt, credit: 0 },
          { accountCode: fromAccount, debit: 0, credit: amt },
        ],
        post: true,
      })

      setFromAccount('')
      setToAccount('')
      setAmount('')
      setMemo('')
      await loadRecent(portal)
    } catch (e) {
      setPostError(e?.response?.message || e?.message || 'Failed to post')
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-semibold text-slate-800">Accounting Dashboard</div>
          <div className="text-sm text-slate-500">QuickBooks-style quick entry. This creates a balanced double-entry voucher and posts it to the ledger.</div>
        </div>
        <div className="flex items-center gap-2">
          <select className="border rounded-md px-3 py-2" value={portal} onChange={e => setPortal(e.target.value)}>
            <option value="admin">Admin</option>
            <option value="reception">Reception</option>
            <option value="pharmacy">Pharmacy</option>
            <option value="lab">Lab</option>
            <option value="shop">Pet Shop</option>
          </select>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="font-semibold text-slate-800 mb-2">Quick Transaction</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
          <div>
            <div className="text-xs text-slate-500 mb-1">Date</div>
            <input type="date" className="w-full border rounded-md px-2 py-2" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">From account (Credit)</div>
            <select className="w-full border rounded-md px-2 py-2" value={fromAccount} onChange={e => setFromAccount(e.target.value)}>
              <option value="">Select account…</option>
              {(accountOptions || []).map(a => (
                <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">To account (Debit)</div>
            <select className="w-full border rounded-md px-2 py-2" value={toAccount} onChange={e => setToAccount(e.target.value)}>
              <option value="">Select account…</option>
              {(accountOptions || []).map(a => (
                <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Amount</div>
            <input type="number" className="w-full border rounded-md px-2 py-2" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
        </div>

        <div className="mt-2">
          <div className="text-xs text-slate-500 mb-1">Memo / Description</div>
          <input className="w-full border rounded-md px-2 py-2" placeholder="e.g. office rent payment" value={memo} onChange={e => setMemo(e.target.value)} />
        </div>

        {postError && <div className="text-sm text-red-600 mt-2">{postError}</div>}

        <div className="flex items-center justify-end gap-2 mt-3">
          <button className="px-3 py-2 rounded-md border" onClick={() => doPrint(draftVoucherPreview)} disabled={!draftVoucherPreview}>Print / Save PDF</button>
          <button className="px-3 py-2 rounded-md bg-indigo-600 text-white" onClick={postTransaction} disabled={posting}>Post Transaction</button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-slate-800">Recent Transactions</div>
          {loadingRecent && <div className="text-xs text-slate-500">Loading…</div>}
        </div>
        <div className="overflow-auto mt-2">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Description</th>
                <th className="py-2 pr-3">Voucher</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3 text-right">Debit</th>
                <th className="py-2 pr-3 text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {(recent || []).map(r => (
                <tr key={r._id} className="border-t">
                  <td className="py-2 pr-3">{r.date ? new Date(r.date).toLocaleDateString() : ''}</td>
                  <td className="py-2 pr-3">{r.type}</td>
                  <td className="py-2 pr-3">{r.description || ''}</td>
                  <td className="py-2 pr-3 font-mono">{r.voucherNo}</td>
                  <td className="py-2 pr-3">{r.status}</td>
                  <td className="py-2 pr-3 text-right">{fmt(r.totals?.debit || 0)}</td>
                  <td className="py-2 pr-3 text-right">{fmt(r.totals?.credit || 0)}</td>
                </tr>
              ))}
              {(!recent || recent.length === 0) && !loadingRecent && (
                <tr>
                  <td className="py-6 text-center text-slate-500" colSpan={7}>No transactions yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
