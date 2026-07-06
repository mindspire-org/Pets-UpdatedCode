import React, { useEffect, useMemo, useRef, useState } from 'react'
import { FiEdit2, FiPlus, FiSearch, FiTrash2, FiUpload, FiX } from 'react-icons/fi'
import * as XLSX from 'xlsx'
import { procedureCatalogAPI } from '../../services/api'

export default function ProcedureCatalog() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [items, setItems] = useState([])
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(null)

  const [mainCategory, setMainCategory] = useState('')
  const [subCategory, setSubCategory] = useState('')
  const [drug, setDrug] = useState('')
  const [unit, setUnit] = useState('No')
  const [price, setPrice] = useState(0)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [itemToDelete, setItemToDelete] = useState(null)
  const [importLoading, setImportLoading] = useState(false)
  const importInputRef = useRef(null)

  const resetForm = () => {
    setEditing(null)
    setMainCategory('')
    setSubCategory('')
    setDrug('')
    setUnit('No')
    setPrice(0)
  }

  const openAdd = () => {
    resetForm()
    setOpen(true)
  }

  const openEdit = (it) => {
    setEditing(it)
    setMainCategory(String(it?.mainCategory || ''))
    setSubCategory(String(it?.subCategory || ''))
    setDrug(String(it?.drug || ''))
    setUnit(String(it?.unit || 'No') || 'No')
    setPrice(Number(it?.defaultAmount || 0))
    setOpen(true)
  }

  const close = () => {
    setOpen(false)
    setSaving(false)
    setError('')
  }

  const load = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true)
      setError('')
      const res = await procedureCatalogAPI.getAll()
      setItems(Array.isArray(res?.data) ? res.data : [])
    } catch (e) {
      setItems([])
      setError(e?.message || 'Failed to load procedure catalog')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    setPage(1)
  }, [q, pageSize])

  const filtered = useMemo(() => {
    const term = String(q || '').trim().toLowerCase()
    if (!term) return items
    return (items || []).filter(it => {
      const a = String(it?.mainCategory || '').toLowerCase()
      const b = String(it?.subCategory || '').toLowerCase()
      const c = String(it?.drug || '').toLowerCase()
      const d = String(it?.unit || '').toLowerCase()
      return a.includes(term) || b.includes(term) || c.includes(term) || d.includes(term)
    })
  }, [items, q])

  const totalRows = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalRows / Math.max(1, Number(pageSize || 50))))
  const currentPage = Math.min(Math.max(1, Number(page || 1)), totalPages)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = Math.min(totalRows, startIndex + pageSize)

  const paged = useMemo(() => {
    return filtered.slice(startIndex, endIndex)
  }, [filtered, startIndex, endIndex])

  const pageNumbers = useMemo(() => {
    const maxButtons = 7
    const p = currentPage
    const t = totalPages
    if (t <= maxButtons) return Array.from({ length: t }, (_, i) => i + 1)
    const nums = new Set([1, t, p])
    nums.add(Math.max(1, p - 1))
    nums.add(Math.max(1, p - 2))
    nums.add(Math.min(t, p + 1))
    nums.add(Math.min(t, p + 2))
    const arr = Array.from(nums).filter(n => n >= 1 && n <= t).sort((a, b) => a - b)
    return arr
  }, [currentPage, totalPages])

  const submit = async () => {
    try {
      setSaving(true)
      setError('')
      const payload = {
        mainCategory: String(mainCategory || '').trim(),
        subCategory: String(subCategory || '').trim(),
        drug: String(drug || '').trim(),
        unit: String(unit || '').trim(),
        defaultAmount: Number(price || 0),
        defaultQuantity: 1,
        active: true,
      }
      if (!payload.mainCategory || !payload.subCategory || !payload.drug) {
        throw new Error('Main Category, Sub-Category and Procedure are required')
      }

      if (editing?._id) {
        await procedureCatalogAPI.update(editing._id, payload)
      } else {
        await procedureCatalogAPI.create(payload)
      }

      setOpen(false)
      resetForm()
      await load({ silent: true })
    } catch (e) {
      setError(e?.message || 'Failed to save procedure')
    } finally {
      setSaving(false)
    }
  }

  const requestDelete = (it) => {
    const id = String(it?._id || '').trim()
    if (!id) return
    setItemToDelete(it)
    setConfirmOpen(true)
  }

  const closeConfirm = () => {
    if (deleting) return
    setConfirmOpen(false)
    setItemToDelete(null)
  }

  const confirmDelete = async () => {
    const id = String(itemToDelete?._id || '').trim()
    if (!id) return
    try {
      setDeleting(true)
      setError('')
      await procedureCatalogAPI.delete(id)
      setItems(prev => prev.filter(x => String(x?._id) !== String(id)))
      setConfirmOpen(false)
      setItemToDelete(null)
    } catch (e) {
      setError(e?.message || 'Failed to delete procedure')
    } finally {
      setDeleting(false)
    }
  }

  const handleImportFile = async (e) => {
    try {
      const file = e.target.files?.[0]
      if (!file) return
      setImportLoading(true)
      setError('')

      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: 'array' })

      const toNum = (v, d = 0) => {
        if (typeof v === 'number') return isFinite(v) ? v : d
        if (!v) return d
        const n = parseFloat(String(v).replace(/,/g, ''))
        return isNaN(n) ? d : n
      }

      // Case-insensitive, whitespace/symbol-insensitive column lookup
      const colMap = (row) => {
        const map = {}
        Object.keys(row).forEach((k) => {
          map[k] = row[k]
          const lower = String(k).toLowerCase().replace(/[\s_]+/g, '')
          if (!(lower in map)) map[lower] = row[k]
        })
        return map
      }
      const pick = (row, ...keys) => {
        const m = row.__cm || (row.__cm = colMap(row))
        for (const k of keys) {
          const lk = String(k).toLowerCase().replace(/[\s_]+/g, '')
          if (m[lk] !== undefined && m[lk] !== '') return m[lk]
        }
        return ''
      }

      // Read ALL sheets so categories on separate sheets are imported too
      const allRows = []
      wb.SheetNames.forEach((sheetName) => {
        const ws = wb.Sheets[sheetName]
        const json = XLSX.utils.sheet_to_json(ws, { defval: '', cellDates: true })
        allRows.push(...json)
      })

      const rows = allRows.map((row) => ({
        mainCategory: pick(row, 'MainCategory', 'Main Category', 'Category', 'Cat'),
        subCategory: pick(row, 'SubCategory', 'Sub Category', 'SubCat', 'Type', 'Sub Type'),
        drug: pick(row, 'Procedure', 'Drug', 'Name', 'Item', 'ProcedureName'),
        unit: pick(row, 'Unit', 'UOM') || 'No',
        defaultAmount: toNum(pick(row, 'Price', 'Amount', 'Cost', 'Rate', 'DefaultAmount', 'Fee'), 0),
        defaultQuantity: toNum(pick(row, 'Quantity', 'Qty', 'DefaultQuantity'), 1),
        active: true,
      })).filter(r => r.mainCategory && r.subCategory && r.drug)

      if (rows.length === 0) {
        throw new Error('No valid rows found. Required columns: MainCategory, SubCategory, Procedure/Drug')
      }

      const res = await procedureCatalogAPI.bulkUpsert(rows)
      await load({ silent: true })
      setError('')
      alert(`Import complete: ${res?.data?.count || rows.length} procedures imported`)
    } catch (err) {
      console.error('Import error:', err)
      setError(err?.message || 'Import failed')
    } finally {
      setImportLoading(false)
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-2xl font-bold text-slate-900">Procedure Catalog</div>
          <div className="text-sm text-slate-500">Manage procedures used across reception</div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            ref={importInputRef}
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            disabled={importLoading}
            className="h-10 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:bg-sky-300 text-white text-sm font-semibold inline-flex items-center gap-2"
          >
            <FiUpload />
            {importLoading ? 'Importing…' : 'Import'}
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="h-10 px-4 rounded-xl bg-emerald-600 text-white text-sm font-semibold inline-flex items-center gap-2"
          >
            <FiPlus />
            Add Procedure
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by category, procedure, unit..."
              className="h-10 w-80 max-w-full pl-10 pr-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-slate-100"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => load()}
              className="h-10 px-4 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50"
            >
              Refresh
            </button>

            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value || 50))}
              className="h-10 px-3 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold bg-white"
              aria-label="Rows per page"
            >
              {[20, 50, 100, 200].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
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
                <th className="px-3 py-2 text-left text-xs font-bold text-slate-600">Main Category</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-slate-600">Sub-Category</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-slate-600">Procedure</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-slate-600">Unit</th>
                <th className="px-3 py-2 text-right text-xs font-bold text-slate-600">Price</th>
                <th className="px-3 py-2 text-right text-xs font-bold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((it) => (
                <tr key={it._id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold text-slate-800">{it.mainCategory || '—'}</td>
                  <td className="px-3 py-2">{it.subCategory || '—'}</td>
                  <td className="px-3 py-2">{it.drug || '—'}</td>
                  <td className="px-3 py-2">{it.unit || '—'}</td>
                  <td className="px-3 py-2 text-right font-semibold">Rs {Number(it.defaultAmount || 0).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(it)}
                        className="h-9 w-9 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 inline-flex items-center justify-center"
                        title="Edit"
                      >
                        <FiEdit2 />
                      </button>
                      <button
                        type="button"
                        onClick={() => requestDelete(it)}
                        className="h-9 w-9 rounded-xl border border-slate-200 text-red-600 hover:bg-red-50 inline-flex items-center justify-center"
                        title="Delete"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-slate-500">
                    No procedures found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 ? (
          <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm text-slate-600">
              Showing <span className="font-semibold">{startIndex + 1}</span>–<span className="font-semibold">{endIndex}</span> of <span className="font-semibold">{totalRows}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage(p => Math.max(1, Number(p || 1) - 1))}
                className="h-9 px-3 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold disabled:opacity-50"
              >
                Prev
              </button>

              <div className="flex items-center gap-1">
                {pageNumbers.map((n, idx) => {
                  const prev = pageNumbers[idx - 1]
                  const showDots = idx > 0 && prev != null && n - prev > 1
                  return (
                    <React.Fragment key={n}>
                      {showDots ? (
                        <span className="px-1 text-slate-400">…</span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setPage(n)}
                        className={`h-9 w-9 rounded-xl border text-sm font-bold ${n === currentPage ? 'bg-slate-900 border-slate-900 text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                      >
                        {n}
                      </button>
                    </React.Fragment>
                  )
                })}
              </div>

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, Number(p || 1) + 1))}
                className="h-9 px-3 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-[640px] max-w-full">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="font-bold text-slate-900">{editing ? 'Edit Procedure' : 'Add Procedure'}</div>
              <button type="button" onClick={close} className="h-9 w-9 rounded-xl border border-slate-200 inline-flex items-center justify-center">
                <FiX />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {error ? (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Main Category</label>
                  <input
                    value={mainCategory}
                    onChange={(e) => setMainCategory(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200"
                    placeholder="e.g. Grooming"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Sub-Category</label>
                  <input
                    value={subCategory}
                    onChange={(e) => setSubCategory(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200"
                    placeholder="e.g. Grooming"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Procedure (Drug)</label>
                <input
                  value={drug}
                  onChange={(e) => setDrug(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200"
                  placeholder="e.g. Bathing (Cat)"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Unit</label>
                  <input
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200"
                    placeholder="e.g. No / ml / Per Day"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Price</label>
                  <input
                    type="number"
                    min={0}
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value || 0))}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200"
                    placeholder="0"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={submit}
                className="w-full h-11 rounded-xl bg-slate-900 text-white font-extrabold disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-[520px] max-w-full">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="font-bold text-slate-900">Delete Procedure</div>
              <button type="button" onClick={closeConfirm} className="h-9 w-9 rounded-xl border border-slate-200 inline-flex items-center justify-center">
                <FiX />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="text-sm text-slate-600">
                Are you sure you want to delete this procedure?
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="text-xs text-slate-500">Procedure</div>
                <div className="font-bold text-slate-900">{itemToDelete?.drug || '—'}</div>
                <div className="mt-1 text-xs text-slate-500">{itemToDelete?.mainCategory || '—'} • {itemToDelete?.subCategory || '—'}</div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={closeConfirm}
                  className="h-10 px-4 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={confirmDelete}
                  className="h-10 px-4 rounded-xl bg-red-600 text-white text-sm font-extrabold disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
