import React, { useMemo, useState } from 'react'
import { suppliersAPI } from '../services/api'

export default function VendorSelect({
  portal,
  value,
  onChange,
  options,
  setOptions,
  placeholder = 'Select vendor…',
  allowNone = true,
  noneLabel = 'No Vendor',
  disabled = false,
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    supplierName: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    category: 'General',
    notes: '',
  })

  const sorted = useMemo(() => {
    const list = Array.isArray(options) ? options : []
    return list.slice().sort((a, b) => String(a.supplierName || '').localeCompare(String(b.supplierName || '')))
  }, [options])

  const reset = () => {
    setForm({
      supplierName: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      category: 'General',
      notes: '',
    })
    setError('')
  }

  const create = async () => {
    setSaving(true)
    setError('')
    try {
      const supplierName = String(form.supplierName || '').trim()
      if (!supplierName) {
        setError('Vendor name is required')
        return
      }

      const payload = {
        portal: portal || 'admin',
        supplierName,
        contactPerson: String(form.contactPerson || '').trim(),
        phone: String(form.phone || '').trim(),
        email: String(form.email || '').trim(),
        address: String(form.address || '').trim(),
        city: String(form.city || '').trim(),
        category: String(form.category || 'General').trim() || 'General',
        notes: String(form.notes || '').trim(),
      }

      const res = await suppliersAPI.create(payload)
      const created = res?.data || null
      if (!created?._id) {
        setError('Failed to create vendor')
        return
      }

      if (typeof setOptions === 'function') {
        setOptions((prev) => {
          const list = Array.isArray(prev) ? prev : []
          const next = [created, ...list.filter(x => x?._id !== created._id)]
          return next
        })
      }

      if (typeof onChange === 'function') {
        onChange(created._id, created)
      }

      setOpen(false)
      reset()
    } catch (e) {
      setError(e?.response?.message || e?.message || 'Failed to create vendor')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <select
          className="w-full border rounded-md px-2 py-2"
          value={value || ''}
          onChange={(e) => {
            const id = e.target.value
            const v = (sorted || []).find(x => x?._id === id)
            onChange?.(id, v)
          }}
          disabled={disabled}
        >
          {allowNone && <option value="">{noneLabel}</option>}
          {!allowNone && <option value="">{placeholder}</option>}
          {sorted.map((v) => (
            <option key={v._id} value={v._id}>{v.supplierName}</option>
          ))}
        </select>
        <button
          type="button"
          className="px-2 py-2 rounded-md border whitespace-nowrap"
          onClick={() => { reset(); setOpen(true) }}
          disabled={disabled}
        >
          Add Vendor
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <div className="font-semibold">Add New Vendor</div>
                <div className="text-xs text-slate-500">Create a vendor and auto-select it.</div>
              </div>
              <button className="h-8 w-8 grid place-items-center border rounded" onClick={() => !saving && setOpen(false)}>✕</button>
            </div>

            <div className="p-4 space-y-3 text-sm">
              {error && <div className="text-sm text-red-600">{error}</div>}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="md:col-span-2">
                  <div className="text-xs text-slate-500 mb-1">Vendor Name</div>
                  <input className="w-full border rounded-md px-2 py-2" value={form.supplierName} onChange={e => setForm(f => ({ ...f, supplierName: e.target.value }))} />
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Contact Person</div>
                  <input className="w-full border rounded-md px-2 py-2" value={form.contactPerson} onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))} />
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Phone</div>
                  <input className="w-full border rounded-md px-2 py-2" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Email</div>
                  <input className="w-full border rounded-md px-2 py-2" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Category</div>
                  <input className="w-full border rounded-md px-2 py-2" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
                </div>
                <div className="md:col-span-2">
                  <div className="text-xs text-slate-500 mb-1">Address</div>
                  <input className="w-full border rounded-md px-2 py-2" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">City</div>
                  <input className="w-full border rounded-md px-2 py-2" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                </div>
                <div className="md:col-span-2">
                  <div className="text-xs text-slate-500 mb-1">Notes</div>
                  <input className="w-full border rounded-md px-2 py-2" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button className="px-3 py-2 rounded-md border" onClick={() => !saving && setOpen(false)}>Cancel</button>
                <button className="px-3 py-2 rounded-md bg-indigo-600 text-white" onClick={create} disabled={saving}>{saving ? 'Saving…' : 'Create Vendor'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
