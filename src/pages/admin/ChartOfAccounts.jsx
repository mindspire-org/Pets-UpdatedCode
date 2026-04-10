import React, { useEffect, useMemo, useState } from 'react'
import { accountingAPI } from '../../services/api'

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-');

const todayStr = () => {
  const d = new Date();
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${da}`;
};

const emptyForm = {
  code: '',
  name: '',
  type: 'asset',
  portal: 'global',
  parentCode: '',
  isGroup: false,
  openingDebit: 0,
  openingCredit: 0,
  active: true,
};

export default function ChartOfAccounts() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(todayStr());
  const [portal, setPortal] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [query, setQuery] = useState('');

  const [sanity, setSanity] = useState(null);
  const [sanityLoading, setSanityLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [flatAccounts, setFlatAccounts] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const refreshSanity = async () => {
    setSanityLoading(true);
    try {
      const res = await accountingAPI.getSanityChecks(from || undefined, to || undefined, portal);
      setSanity(res?.data || null);
    } catch {
      setSanity(null);
    } finally {
      setSanityLoading(false);
    }
  };

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const [coaRes, accRes] = await Promise.all([
        accountingAPI.getChartOfAccounts(from || undefined, to || undefined, portal),
        accountingAPI.getAccounts(),
      ]);
      setRows(coaRes?.data || []);
      setFlatAccounts(accRes?.data || []);
    } catch (e) {
      setError(e?.response?.message || e?.message || 'Failed to load Chart of Accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    refreshSanity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refresh();
    refreshSanity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, portal]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows || []).filter(r => {
      if (typeFilter !== 'all' && r.type !== typeFilter) return false;
      if (!q) return true;
      return String(r.code).toLowerCase().includes(q) || String(r.name || '').toLowerCase().includes(q);
    });
  }, [rows, query, typeFilter]);

  const openCreate = (parent) => {
    setModalMode('create');
    setForm({
      ...emptyForm,
      type: parent?.type || 'asset',
      portal: parent?.portal || 'global',
      parentCode: parent?.code || '',
    });
    setModalOpen(true);
  };

  const openEdit = (row) => {
    const acc = (flatAccounts || []).find(a => a.code === row.code);
    setModalMode('edit');
    setForm({
      code: row.code,
      name: acc?.name || row.name || '',
      type: acc?.type || row.type || 'asset',
      portal: acc?.portal || row.portal || 'global',
      parentCode: acc?.parentCode || row.parentCode || '',
      isGroup: Boolean(acc?.isGroup || row.isGroup),
      openingDebit: Number(acc?.openingDebit || 0),
      openingCredit: Number(acc?.openingCredit || 0),
      active: acc?.active !== undefined ? Boolean(acc.active) : true,
    });
    setModalOpen(true);
  };

  const onSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        code: String(form.code || '').trim(),
        name: String(form.name || '').trim(),
        parentCode: String(form.parentCode || '').trim() || undefined,
        openingDebit: Number(form.openingDebit || 0),
        openingCredit: Number(form.openingCredit || 0),
      };

      if (!payload.code || !payload.name || !payload.type) {
        setError('code, name, type are required');
        return;
      }

      if (modalMode === 'create') {
        await accountingAPI.createAccount(payload);
      } else {
        await accountingAPI.updateAccount(payload.code, payload);
      }

      setModalOpen(false);
      await refresh();
    } catch (e) {
      setError(e?.response?.message || e?.message || 'Failed to save account');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (code) => {
    if (!code) return;
    const ok = window.confirm(`Delete account ${code}?`);
    if (!ok) return;

    setSaving(true);
    setError('');
    try {
      await accountingAPI.deleteAccount(code);
      await refresh();
    } catch (e) {
      setError(e?.response?.message || e?.message || 'Failed to delete account');
    } finally {
      setSaving(false);
    }
  };

  const accountOptions = useMemo(() => {
    const opts = (flatAccounts || [])
      .filter(a => a.active !== false)
      .slice()
      .sort((a, b) => String(a.code).localeCompare(String(b.code)));
    return opts;
  }, [flatAccounts]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-semibold">Chart of Accounts</div>
          <div className="text-sm text-slate-500">Manage account structure</div>
        </div>
        <button className="px-3 py-2 rounded-md bg-indigo-600 text-white" onClick={() => openCreate(null)}>Add Account</button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-700">Sanity Checks</div>
          <div className="text-xs text-slate-500">{sanityLoading ? 'Loading…' : ''}</div>
        </div>
        {!sanity && !sanityLoading && (
          <div className="text-sm text-slate-500 mt-2">No data</div>
        )}
        {sanity && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2 text-sm">
            <div className={`rounded-lg border p-3 ${sanity.opening?.ok ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
              <div className="text-xs text-slate-500">Opening Balances (Total)</div>
              <div className="mt-1 font-semibold">Dr {fmt(sanity.opening?.debit || 0)} / Cr {fmt(sanity.opening?.credit || 0)}</div>
              <div className="text-xs mt-1">Diff: {fmt(sanity.opening?.difference || 0)}</div>
            </div>
            <div className={`rounded-lg border p-3 ${sanity.trialBalance?.ok ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
              <div className="text-xs text-slate-500">Trial Balance (Selected Range)</div>
              <div className="mt-1 font-semibold">Dr {fmt(sanity.trialBalance?.debit || 0)} / Cr {fmt(sanity.trialBalance?.credit || 0)}</div>
              <div className="text-xs mt-1">Diff: {fmt(sanity.trialBalance?.difference || 0)}</div>
            </div>
            <div className={`rounded-lg border p-3 ${sanity.balanceSheet?.ok ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
              <div className="text-xs text-slate-500">Balance Sheet (As of To)</div>
              <div className="mt-1 font-semibold">Assets {fmt(sanity.balanceSheet?.assets || 0)}</div>
              <div className="text-xs mt-1">Diff: {fmt(sanity.balanceSheet?.difference || 0)}</div>
            </div>
          </div>
        )}
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <input
            className="border rounded-md px-3 py-2"
            placeholder="Search by code or name"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <select className="border rounded-md px-3 py-2" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="all">All Types</option>
            <option value="asset">Asset</option>
            <option value="liability">Liability</option>
            <option value="equity">Equity</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
          <select className="border rounded-md px-3 py-2" value={portal} onChange={e => setPortal(e.target.value)}>
            <option value="all">All Portals</option>
            <option value="global">Global</option>
            <option value="admin">Admin</option>
            <option value="reception">Reception</option>
            <option value="doctor">Doctor</option>
            <option value="pharmacy">Pharmacy</option>
            <option value="lab">Lab</option>
            <option value="shop">Pet Shop</option>
          </select>
          <input className="border rounded-md px-3 py-2" type="date" value={from} onChange={e => setFrom(e.target.value)} />
          <input className="border rounded-md px-3 py-2" type="date" value={to} onChange={e => setTo(e.target.value)} />
        </div>

        <div className="flex items-center justify-between mt-3">
          <div className="text-sm text-slate-500">Accounts ({filtered.length})</div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-2 rounded-md border" onClick={refresh}>Refresh</button>
            {loading && <span className="text-sm text-slate-500">Loading…</span>}
          </div>
        </div>

        <div className="overflow-auto mt-3">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2 pr-4">Code</th>
                <th className="py-2 pr-4">Account</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4 text-right">Opening</th>
                <th className="py-2 pr-4 text-right">Current</th>
                <th className="py-2 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(filtered || []).map((r) => {
                const indent = r.level ? `${r.level * 18}px` : '0px';
                return (
                  <tr key={r.code} className="border-t">
                    <td className="py-2 pr-4 font-mono">{r.code}</td>
                    <td className="py-2 pr-4">
                      <div style={{ paddingLeft: indent }} className={r.isGroup ? 'font-semibold' : ''}>
                        {r.name}
                      </div>
                    </td>
                    <td className="py-2 pr-4">{r.type}</td>
                    <td className="py-2 pr-4 text-right">{fmt(r.opening)}</td>
                    <td className="py-2 pr-4 text-right">{fmt(r.current)}</td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center justify-end gap-2">
                        <button className="px-2 py-1 rounded-md border" onClick={() => openCreate(r)}>+</button>
                        <button className="px-2 py-1 rounded-md border" onClick={() => openEdit(r)}>Edit</button>
                        <button className="px-2 py-1 rounded-md border text-red-600" onClick={() => onDelete(r.code)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => !saving && setModalOpen(false)}>
          <div className="bg-white rounded-xl border border-slate-200 w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between">
              <div className="font-medium">{modalMode === 'create' ? 'Add Account' : 'Edit Account'}</div>
              <button className="px-3 py-1.5 rounded-md border" onClick={() => setModalOpen(false)} disabled={saving}>Close</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-slate-500 mb-1">Code</div>
                  <input className="border rounded-md px-3 py-2 w-full" value={form.code} onChange={e => setForm(s => ({ ...s, code: e.target.value }))} disabled={modalMode === 'edit'} />
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Name</div>
                  <input className="border rounded-md px-3 py-2 w-full" value={form.name} onChange={e => setForm(s => ({ ...s, name: e.target.value }))} />
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Type</div>
                  <select className="border rounded-md px-3 py-2 w-full" value={form.type} onChange={e => setForm(s => ({ ...s, type: e.target.value }))}>
                    <option value="asset">Asset</option>
                    <option value="liability">Liability</option>
                    <option value="equity">Equity</option>
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                  </select>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Portal</div>
                  <select className="border rounded-md px-3 py-2 w-full" value={form.portal} onChange={e => setForm(s => ({ ...s, portal: e.target.value }))}>
                    <option value="global">Global</option>
                    <option value="admin">Admin</option>
                    <option value="reception">Reception</option>
                    <option value="doctor">Doctor</option>
                    <option value="pharmacy">Pharmacy</option>
                    <option value="lab">Lab</option>
                    <option value="shop">Pet Shop</option>
                  </select>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Parent Account</div>
                  <select className="border rounded-md px-3 py-2 w-full" value={form.parentCode} onChange={e => setForm(s => ({ ...s, parentCode: e.target.value }))}>
                    <option value="">(none)</option>
                    {(accountOptions || []).map(a => (
                      <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={Boolean(form.isGroup)} onChange={e => setForm(s => ({ ...s, isGroup: e.target.checked }))} />
                    Group Account
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-slate-500 mb-1">Opening Debit</div>
                  <input className="border rounded-md px-3 py-2 w-full" type="number" value={form.openingDebit} onChange={e => setForm(s => ({ ...s, openingDebit: e.target.value }))} />
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Opening Credit</div>
                  <input className="border rounded-md px-3 py-2 w-full" type="number" value={form.openingCredit} onChange={e => setForm(s => ({ ...s, openingCredit: e.target.value }))} />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={Boolean(form.active)} onChange={e => setForm(s => ({ ...s, active: e.target.checked }))} />
                Active
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button className="px-3 py-2 rounded-md border" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
                <button className="px-3 py-2 rounded-md bg-indigo-600 text-white" onClick={onSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
