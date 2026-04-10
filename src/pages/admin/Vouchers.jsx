import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSettings } from '../../context/SettingsContext'
import { accountingAPI, vouchersAPI, suppliersAPI, shopCustomersAPI, petsAPI } from '../../services/api'
import VendorSelect from '../../components/VendorSelect'

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-')
const todayStr = () => new Date().toISOString().slice(0, 10)

const TYPE_TABS = [
  { key: 'all', label: 'All Vouchers' },
  { key: 'RV', label: 'Receipts' },
  { key: 'PV', label: 'Payments' },
  { key: 'JV', label: 'Journal' },
  { key: 'CV', label: 'Contra' },
]

const typeLabel = (t) => {
  if (t === 'RV') return 'Receipt'
  if (t === 'PV') return 'Payment'
  if (t === 'JV') return 'Journal'
  if (t === 'CV') return 'Contra'
  return t
}

const portalOptions = [
  { value: 'all', label: 'All Portals' },
  { value: 'admin', label: 'Admin' },
  { value: 'reception', label: 'Reception' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'lab', label: 'Lab' },
  { value: 'shop', label: 'Pet Shop' },
]

const statusOptions = [
  { value: 'all', label: 'All Status' },
  { value: 'draft', label: 'Draft' },
  { value: 'posted', label: 'Posted' },
]

const partyOptions = [
  { value: 'none', label: 'No party' },
  { value: 'supplier', label: 'Vendor' },
  { value: 'customer', label: 'Customer' },
  { value: 'patient', label: 'Patient' },
]

const emptyLine = { accountCode: '', debit: '', credit: '' }

export default function Vouchers() {
  const { settings } = useSettings()
  const [tab, setTab] = useState('all')
  const [q, setQ] = useState('')
  const [portal, setPortal] = useState('all')
  const [status, setStatus] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState(todayStr())

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [viewVoucher, setViewVoucher] = useState(null)
  const [viewLoading, setViewLoading] = useState(false)

  const [accounts, setAccounts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [shopCustomers, setShopCustomers] = useState([])
  const [pets, setPets] = useState([])

  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    type: 'PV',
    date: todayStr(),
    portal: 'admin',
    receiptNo: '',
    description: '',
    partyType: 'none',
    partyId: '',
    partyName: '',
    quickAccountCode: '',
    quickCashAccountCode: '1001',
    quickAmount: '',
    contraFromAccountCode: '1001',
    contraToAccountCode: '1002',
    contraAmount: '',
    lines: [{ ...emptyLine }, { ...emptyLine }],
  })

  const loadLookups = useCallback(async (portalValue) => {
    try {
      const [accRes, sRes, cRes, pRes] = await Promise.all([
        accountingAPI.getAccounts(),
        suppliersAPI.getAll(portalValue),
        shopCustomersAPI.getAll(),
        petsAPI.getAll(),
      ])
      setAccounts(accRes?.data || [])
      setSuppliers(sRes?.data || [])
      setShopCustomers(cRes?.data || [])
      setPets(pRes?.data || [])
    } catch {
      setSuppliers([])
    }
  }, [])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const type = tab === 'all' ? 'all' : tab
      const res = await vouchersAPI.list({ type, portal, status, from, to, q })
      setRows(res?.data || [])
    } catch (e) {
      setRows([])
      setError(e?.response?.message || e?.message || 'Failed to load vouchers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [tab, portal, status, from, to])

  useEffect(() => {
    if (!createOpen) return
    loadLookups(form.portal)
  }, [createOpen, form.portal, loadLookups])

  const openNew = async () => {
    const nextPortal = portal !== 'all' ? portal : 'admin'
    setForm({
      type: 'PV',
      date: todayStr(),
      portal: nextPortal,
      receiptNo: '',
      description: '',
      partyType: 'none',
      partyId: '',
      partyName: '',
      quickAccountCode: '',
      quickCashAccountCode: '1001',
      quickAmount: '',
      contraFromAccountCode: '1001',
      contraToAccountCode: '1002',
      contraAmount: '',
      lines: [{ ...emptyLine }, { ...emptyLine }],
    })
    setCreateOpen(true)
    await loadLookups(nextPortal)
  }

  const openView = async (id) => {
    if (!id) return
    setViewOpen(true)
    setViewLoading(true)
    setViewVoucher(null)
    try {
      const res = await vouchersAPI.getById(id)
      setViewVoucher(res?.data || null)
    } catch (e) {
      setViewVoucher(null)
    } finally {
      setViewLoading(false)
    }
  }

  const normalizeFormLines = () => {
    const t = form.type
    if (t === 'JV') {
      const lines = (form.lines || [])
        .map(l => ({
          accountCode: String(l.accountCode || '').trim(),
          debit: Number(l.debit || 0),
          credit: Number(l.credit || 0),
        }))
        .filter(l => l.accountCode && (l.debit || l.credit))
      return lines
    }

    if (t === 'CV') {
      const fromAcc = String(form.contraFromAccountCode || '').trim()
      const toAcc = String(form.contraToAccountCode || '').trim()
      const amt = Number(form.contraAmount || 0)
      if (!fromAcc || !toAcc || !amt) return []
      return [
        { accountCode: toAcc, debit: amt, credit: 0 },
        { accountCode: fromAcc, debit: 0, credit: amt },
      ]
    }

    const acc = String(form.quickAccountCode || '').trim()
    const cashAcc = String(form.quickCashAccountCode || '').trim()
    const amt = Number(form.quickAmount || 0)
    if (!acc || !cashAcc || !amt) return []

    if (t === 'PV') {
      return [
        { accountCode: acc, debit: amt, credit: 0 },
        { accountCode: cashAcc, debit: 0, credit: amt },
      ]
    }
    if (t === 'RV') {
      return [
        { accountCode: cashAcc, debit: amt, credit: 0 },
        { accountCode: acc, debit: 0, credit: amt },
      ]
    }
    return []
  }

  const effectiveLines = useMemo(() => {
    return normalizeFormLines()
  }, [form])

  const total = useMemo(() => {
    const debit = (effectiveLines || []).reduce((s, l) => s + (Number(l.debit) || 0), 0)
    const credit = (effectiveLines || []).reduce((s, l) => s + (Number(l.credit) || 0), 0)
    return { debit, credit }
  }, [effectiveLines])

  const saveDraft = async () => {
    setSaving(true)
    setError('')
    try {
      const lines = normalizeFormLines()
      if (!lines.length) throw new Error('Please enter voucher details')
      await vouchersAPI.create({
        ...form,
        lines,
        post: false,
      })
      setCreateOpen(false)
      await load()
    } catch (e) {
      setError(e?.response?.message || e?.message || 'Failed to save draft')
    } finally {
      setSaving(false)
    }
  }

  const postVoucher = async () => {
    setSaving(true)
    setError('')
    try {
      const lines = normalizeFormLines()
      if (!lines.length) throw new Error('Please enter voucher details')
      await vouchersAPI.create({
        ...form,
        lines,
        post: true,
      })
      setCreateOpen(false)
      await load()
    } catch (e) {
      setError(e?.response?.message || e?.message || 'Failed to post voucher')
    } finally {
      setSaving(false)
    }
  }

  const postDraft = async (id) => {
    const ok = window.confirm('Post this voucher?')
    if (!ok) return
    try {
      await vouchersAPI.post(id)
      await load()
    } catch (e) {
      alert(e?.response?.message || e?.message || 'Failed to post')
    }
  }

  const deleteDraft = async (id) => {
    const ok = window.confirm('Delete this draft voucher?')
    if (!ok) return
    try {
      await vouchersAPI.delete(id)
      await load()
    } catch (e) {
      alert(e?.response?.message || e?.message || 'Failed to delete')
    }
  }

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
<title>${v.voucherNo}</title>
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
      <div class="title">Voucher</div>
      <div class="muted">${typeLabel(v.type)} • ${new Date(v.date).toLocaleDateString()} • Portal: ${v.portal}</div>
      ${v.partyName ? `<div class="muted">Party: ${v.partyName}</div>` : ''}
      ${v.receiptNo ? `<div class="muted">Receipt No: ${v.receiptNo}</div>` : ''}
      ${v.description ? `<div class="muted">${v.description}</div>` : ''}
    </div>
    <div style="text-align:right">
      <div class="title">${v.voucherNo}</div>
      <div class="muted">Status: ${v.status}</div>
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

  const accountOptions = useMemo(() => {
    return (accounts || [])
      .filter(a => a.active !== false && !a.isGroup)
      .slice()
      .sort((a, b) => String(a.code).localeCompare(String(b.code)))
  }, [accounts])

  const cashBankOptions = useMemo(() => {
    const list = (accounts || [])
      .filter(a => a.active !== false && !a.isGroup)
      .filter(a => ['cash', 'bank'].includes(String(a.subType || '').toLowerCase()) || ['1001', '1002'].includes(String(a.code)))
      .slice()
      .sort((a, b) => String(a.code).localeCompare(String(b.code)))
    return list.length ? list : accountOptions
  }, [accounts, accountOptions])

  const partyList = useMemo(() => {
    if (form.partyType === 'supplier') {
      return (suppliers || []).map(s => ({ id: s._id, name: s.supplierName }))
    }
    if (form.partyType === 'customer') {
      return (shopCustomers || []).map(c => ({ id: c._id, name: c.customerName || c.name || c.contact || String(c._id) }))
    }
    if (form.partyType === 'patient') {
      return (pets || []).map(p => ({ id: p.id || p._id, name: `${p.petName || ''}${p.ownerName ? ` (${p.ownerName})` : ''}`.trim() || String(p.id || p._id) }))
    }
    return []
  }, [form.partyType, suppliers, shopCustomers, pets])

  const updateParty = (partyId) => {
    const p = (partyList || []).find(x => x.id === partyId)
    setForm(f => ({ ...f, partyId, partyName: p?.name || '' }))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-semibold text-slate-800">Vouchers</div>
          <div className="text-sm text-slate-500">Manage all financial transactions and vouchers</div>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-2 rounded-md border" onClick={load}>Refresh</button>
          <button className="px-3 py-2 rounded-md bg-indigo-600 text-white" onClick={openNew}>New Voucher</button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-3">
        <div className="flex items-center gap-2 border-b pb-2">
          {TYPE_TABS.map(t => (
            <button
              key={t.key}
              className={`px-3 py-1.5 rounded-md text-sm ${tab === t.key ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-2 mt-3">
          <input className="border rounded-md px-3 py-2" placeholder="Search vouchers..." value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') load() }} />
          <select className="border rounded-md px-3 py-2" value={portal} onChange={e => setPortal(e.target.value)}>
            {portalOptions.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select className="border rounded-md px-3 py-2" value={status} onChange={e => setStatus(e.target.value)}>
            {statusOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <input type="date" className="border rounded-md px-3 py-2" value={from} onChange={e => setFrom(e.target.value)} />
          <input type="date" className="border rounded-md px-3 py-2" value={to} onChange={e => setTo(e.target.value)} />
          <button className="px-3 py-2 rounded-md border" onClick={load}>Search</button>
        </div>

        <div className="mt-2">
          {loading && <div className="text-xs text-slate-500">Loading…</div>}
          {error && <div className="text-xs text-red-600">{error}</div>}
        </div>

        <div className="overflow-auto mt-3">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2 pr-3">Voucher</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Description</th>
                <th className="py-2 pr-3 text-right">Debit</th>
                <th className="py-2 pr-3 text-right">Credit</th>
                <th className="py-2 pr-3">Vendor/Party</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(rows || []).map(r => (
                <tr key={r._id} className="border-t">
                  <td className="py-2 pr-3 font-mono">{r.voucherNo}</td>
                  <td className="py-2 pr-3">{typeLabel(r.type)}</td>
                  <td className="py-2 pr-3">{r.date ? new Date(r.date).toLocaleDateString() : ''}</td>
                  <td className="py-2 pr-3">{r.description || ''}</td>
                  <td className="py-2 pr-3 text-right">{fmt(r.totals?.debit || 0)}</td>
                  <td className="py-2 pr-3 text-right">{fmt(r.totals?.credit || 0)}</td>
                  <td className="py-2 pr-3">{r.partyName || ''}</td>
                  <td className="py-2 pr-3">{r.status}</td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center justify-end gap-2">
                      <button className="px-2 py-1 rounded-md border" onClick={() => openView(r._id)}>View</button>
                      <button className="px-2 py-1 rounded-md border" onClick={() => doPrint(r)}>Print</button>
                      {r.status === 'draft' && (
                        <>
                          <button className="px-2 py-1 rounded-md bg-emerald-600 text-white" onClick={() => postDraft(r._id)}>Post</button>
                          <button className="px-2 py-1 rounded-md border text-red-600" onClick={() => deleteDraft(r._id)}>Delete</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {(!rows || rows.length === 0) && !loading && (
                <tr>
                  <td className="py-6 text-center text-slate-500" colSpan={9}>No vouchers found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <div className="font-semibold">New Voucher</div>
                <div className="text-xs text-slate-500">Create a voucher draft or post immediately.</div>
              </div>
              <button className="h-8 w-8 grid place-items-center border rounded" onClick={() => !saving && setCreateOpen(false)}>✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                <div>
                  <div className="text-xs text-slate-500 mb-1">Type</div>
                  <select className="w-full border rounded-md px-2 py-2" value={form.type} onChange={e => {
                    const t = e.target.value
                    setForm(f => ({
                      ...f,
                      type: t,
                      quickAccountCode: t === 'JV' ? '' : f.quickAccountCode,
                      quickAmount: t === 'JV' ? '' : f.quickAmount,
                      lines: t === 'JV' ? (f.lines && f.lines.length ? f.lines : [{ ...emptyLine }, { ...emptyLine }]) : f.lines,
                    }))
                  }}>
                    <option value="PV">Payment (PV)</option>
                    <option value="RV">Receipt (RV)</option>
                    <option value="JV">Journal (JV)</option>
                    <option value="CV">Contra (CV)</option>
                  </select>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Date</div>
                  <input type="date" className="w-full border rounded-md px-2 py-2" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Receipt No.</div>
                  <input className="w-full border rounded-md px-2 py-2" placeholder="Optional" value={form.receiptNo} onChange={e => setForm(f => ({ ...f, receiptNo: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-xs text-slate-500 mb-1">Portal</div>
                  <select className="w-full border rounded-md px-2 py-2" value={form.portal} onChange={e => setForm(f => ({ ...f, portal: e.target.value }))}>
                    {portalOptions.filter(p => p.value !== 'all').map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Party Type</div>
                  <select className="w-full border rounded-md px-2 py-2" value={form.partyType} onChange={e => {
                    const pt = e.target.value
                    setForm(f => ({ ...f, partyType: pt, partyId: '', partyName: '' }))
                  }}>
                    {partyOptions.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>

              {form.partyType !== 'none' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Party</div>
                    {form.partyType === 'supplier' ? (
                      <VendorSelect
                        portal={form.portal}
                        value={form.partyId}
                        onChange={(id, v) => {
                          setForm(f => ({ ...f, partyId: id, partyName: v?.supplierName || '' }))
                        }}
                        options={suppliers}
                        setOptions={setSuppliers}
                        allowNone={false}
                        placeholder="Select…"
                      />
                    ) : (
                      <select className="w-full border rounded-md px-2 py-2" value={form.partyId} onChange={e => updateParty(e.target.value)}>
                        <option value="">Select…</option>
                        {(partyList || []).map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs text-slate-500 mb-1">Description</div>
                <input className="w-full border rounded-md px-2 py-2" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-600 mb-1">Lines</div>
                {form.type !== 'JV' ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                    {form.type === 'CV' ? (
                      <>
                        <div>
                          <div className="text-xs text-slate-500 mb-1">From Account</div>
                          <select className="w-full border rounded-md px-2 py-2" value={form.contraFromAccountCode} onChange={e => setForm(f => ({ ...f, contraFromAccountCode: e.target.value }))}>
                            {(cashBankOptions || []).map(a => (
                              <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-1">To Account</div>
                          <select className="w-full border rounded-md px-2 py-2" value={form.contraToAccountCode} onChange={e => setForm(f => ({ ...f, contraToAccountCode: e.target.value }))}>
                            {(cashBankOptions || []).map(a => (
                              <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-1">Amount</div>
                          <input type="number" className="w-full border rounded-md px-2 py-2" value={form.contraAmount} onChange={e => setForm(f => ({ ...f, contraAmount: e.target.value }))} />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <div className="text-xs text-slate-500 mb-1">Account</div>
                          <select className="w-full border rounded-md px-2 py-2" value={form.quickAccountCode} onChange={e => setForm(f => ({ ...f, quickAccountCode: e.target.value }))}>
                            <option value="">Select account…</option>
                            {(accountOptions || []).map(a => (
                              <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-1">Amount</div>
                          <input type="number" className="w-full border rounded-md px-2 py-2" value={form.quickAmount} onChange={e => setForm(f => ({ ...f, quickAmount: e.target.value }))} />
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 mb-1">Cash / Bank Account</div>
                          <select className="w-full border rounded-md px-2 py-2" value={form.quickCashAccountCode} onChange={e => setForm(f => ({ ...f, quickCashAccountCode: e.target.value }))}>
                            {(cashBankOptions || []).map(a => (
                              <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}
                    <div className="md:col-span-3 text-right font-semibold">Debit: {fmt(total.debit)} | Credit: {fmt(total.credit)}</div>
                  </div>
                ) : (
                  <>
                    <div className="border rounded-lg overflow-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-slate-500 bg-slate-50">
                            <th className="py-2 px-2">Account</th>
                            <th className="py-2 px-2 text-right">Debit</th>
                            <th className="py-2 px-2 text-right">Credit</th>
                            <th className="py-2 px-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(form.lines || []).map((l, idx) => (
                            <tr key={idx} className="border-t">
                              <td className="py-2 px-2">
                                <select className="w-full border rounded-md px-2 py-1" value={l.accountCode} onChange={e => {
                                  const v = e.target.value
                                  setForm(f => ({
                                    ...f,
                                    lines: f.lines.map((x, i) => i === idx ? { ...x, accountCode: v } : x)
                                  }))
                                }}>
                                  <option value="">Select account…</option>
                                  {(accountOptions || []).map(a => (
                                    <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2 px-2 text-right">
                                <input type="number" className="w-28 border rounded-md px-2 py-1 text-right" value={l.debit} onChange={e => {
                                  const v = e.target.value
                                  setForm(f => ({
                                    ...f,
                                    lines: f.lines.map((x, i) => i === idx ? { ...x, debit: v } : x)
                                  }))
                                }} />
                              </td>
                              <td className="py-2 px-2 text-right">
                                <input type="number" className="w-28 border rounded-md px-2 py-1 text-right" value={l.credit} onChange={e => {
                                  const v = e.target.value
                                  setForm(f => ({
                                    ...f,
                                    lines: f.lines.map((x, i) => i === idx ? { ...x, credit: v } : x)
                                  }))
                                }} />
                              </td>
                              <td className="py-2 px-2 text-right">
                                <button className="px-2 py-1 rounded-md border text-red-600" onClick={() => setForm(f => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) }))} disabled={(form.lines || []).length <= 2}>Remove</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <button className="px-3 py-2 rounded-md border" onClick={() => setForm(f => ({ ...f, lines: [...(f.lines || []), { ...emptyLine }] }))}>Add Line</button>
                      <div className="text-sm font-semibold">Debit: {fmt(total.debit)} | Credit: {fmt(total.credit)}</div>
                    </div>
                  </>
                )}
              </div>

              {error && <div className="text-sm text-red-600">{error}</div>}

              <div className="flex items-center justify-end gap-2">
                <button className="px-3 py-2 rounded-md border" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</button>
                <button className="px-3 py-2 rounded-md border" onClick={saveDraft} disabled={saving}>Save Draft</button>
                <button className="px-3 py-2 rounded-md bg-indigo-600 text-white" onClick={postVoucher} disabled={saving}>Post Voucher</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="p-4 border-b flex items-center justify-between">
              <div className="font-semibold">Voucher Detail</div>
              <button className="h-8 w-8 grid place-items-center border rounded" onClick={() => setViewOpen(false)}>✕</button>
            </div>
            <div className="p-4">
              {viewLoading && <div className="text-sm text-slate-500">Loading…</div>}
              {!viewLoading && !viewVoucher && <div className="text-sm text-slate-500">Not found</div>}
              {!viewLoading && viewVoucher && (
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-lg font-semibold">{viewVoucher.voucherNo}</div>
                      <div className="text-sm text-slate-500">{typeLabel(viewVoucher.type)} • {new Date(viewVoucher.date).toLocaleDateString()} • {viewVoucher.portal}</div>
                      {viewVoucher.partyName && <div className="text-sm text-slate-500">Party: {viewVoucher.partyName}</div>}
                      {viewVoucher.receiptNo && <div className="text-sm text-slate-500">Receipt: {viewVoucher.receiptNo}</div>}
                      {viewVoucher.description && <div className="text-sm text-slate-700">{viewVoucher.description}</div>}
                    </div>
                    <div className="text-right">
                      <div className="text-sm">Status: <span className="font-semibold">{viewVoucher.status}</span></div>
                      <button className="mt-2 px-3 py-2 rounded-md border" onClick={() => doPrint(viewVoucher)}>Print</button>
                    </div>
                  </div>

                  <div className="border rounded-lg overflow-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-500 bg-slate-50">
                          <th className="py-2 px-2">Account</th>
                          <th className="py-2 px-2 text-right">Debit</th>
                          <th className="py-2 px-2 text-right">Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(viewVoucher.lines || []).map((l, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="py-2 px-2">{l.accountCode} - {l.accountName}</td>
                            <td className="py-2 px-2 text-right">{fmt(l.debit)}</td>
                            <td className="py-2 px-2 text-right">{fmt(l.credit)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-end gap-4 font-semibold">
                    <div>Debit: {fmt(viewVoucher.totals?.debit || 0)}</div>
                    <div>Credit: {fmt(viewVoucher.totals?.credit || 0)}</div>
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
