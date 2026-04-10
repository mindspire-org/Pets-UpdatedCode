import React, { useEffect, useMemo, useRef, useState } from 'react'
import { FiTrash2, FiEdit2, FiPlus, FiX, FiCheck, FiAlertTriangle } from 'react-icons/fi'
import * as XLSX from 'xlsx'
import { inventoryAPI, suppliersAPI } from '../../services/api'

export default function LabInventory(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [suppliers, setSuppliers] = useState([])
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef(null)
  const [categories, setCategories] = useState(['Reagents','Test Kits','Chemicals','Consumables','Glassware','Equipment','Stains & Dyes','Calibrators','Controls','Buffers','Tubes & Vials','Other'])
  const [customCategories, setCustomCategories] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('lab_inventory_categories_custom') || '[]')
      return Array.isArray(raw) ? raw.filter(Boolean).map(s => String(s).trim()).filter(Boolean) : []
    } catch {
      return []
    }
  })
  const [showManageCategories, setShowManageCategories] = useState(false)
  const [editCategory, setEditCategory] = useState({ old: '', value: '' })
  const [confirmDialog, setConfirmDialog] = useState({ show: false, title: '', message: '', onConfirm: null, type: 'danger' })
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })
  const [manageNewCategory, setManageNewCategory] = useState('')
  const [manageBusy, setManageBusy] = useState(false)

  useEffect(() => {
    fetchInventory()
    fetchSuppliers()
    fetchCategories()
  }, [])
  
  const fetchInventory = async () => {
    try {
      setLoading(true)
      const response = await inventoryAPI.getAll()
      // Backend schema uses department, itemName, quantity, price, minStockLevel, expiryDate
      const labItems = (response.data || [])
        .filter(item => item.department === 'lab' || !item.department)
        .map(item => ({
          _id: item._id,
          id: item.id,
          invoice: item.invoice || '',
          name: item.itemName || item.name || '',
          category: item.category || '',
          packs: item.packs || 0,
          unitsPerPack: item.unitsPerPack || 0,
          unitPurchase: item.price ?? item.purchasePrice ?? 0,
          unitSale: item.unitSale ?? 0,
          qty: item.quantity ?? item.qty ?? 0,
          min: item.minStockLevel ?? item.min ?? 0,
          expiry: item.expiryDate ? new Date(item.expiryDate).toISOString().slice(0,10) : (item.expiry || ''),
          supplier: item.supplier || '',
          status: item.status || 'OK'
        }))
      setItems(labItems)
    } catch (err) {
      console.error('Error fetching lab inventory:', err)
    } finally {
      setLoading(false)
    }
  };
  async function fetchCategories(){
    try {
      const res = await inventoryAPI.getCategories('lab')
      const list = res?.data || []
      if (Array.isArray(list) && list.length) {
        const merged = Array.from(new Set([...(list || []), ...(customCategories || [])].map(s => String(s || '').trim()).filter(Boolean))).sort()
        setCategories(merged)
      }
    } catch (e) {
      const derived = Array.from(new Set((items||[]).map(i=>i.category).filter(Boolean)))
      const merged = Array.from(new Set([...(derived || []), ...(customCategories || [])].map(s => String(s || '').trim()).filter(Boolean))).sort()
      if (merged.length) setCategories(merged)
    }
  }
  async function fetchSuppliers() {
    try {
      const res = await suppliersAPI.getAll('lab')
      const list = res?.data || []
      setSuppliers(list)
    } catch (e) {
      setSuppliers([])
    }
  }
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('All') // All | Low | Expiring | Out
  const [showForm, setShowForm] = useState(false)
  const empty = { id:'', invoice:'', name:'', category:'', packs:'', unitsPerPack:'', unitPurchase:'', unitSale:'', qty:'', min:'', expiry:'', supplier:'', status:'OK' }
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [toDelete, setToDelete] = useState(null)
  const [showAddSupplier, setShowAddSupplier] = useState(false)
  const [savingSupplier, setSavingSupplier] = useState(false)
  const [newSupplier, setNewSupplier] = useState({ supplierName:'', contactPerson:'', phone:'', email:'', address:'', category:'', notes:'' })


  const isExpiringSoon = (dateStr) => {
    if (!dateStr) return false
    const now = new Date()
    const target = new Date(dateStr)
    return (target - now)/(1000*60*60*24) <= 30
  }

  const filtered = useMemo(()=>{
    return items.filter(i => {
      const text = (i.invoice+i.name+i.category+i.supplier).toLowerCase()
      const matchQ = q ? text.includes(q.toLowerCase()) : true
      const matchTab = tab==='All' ? true : tab==='Low' ? Number(i.qty||0) <= Number(i.min||0) : tab==='Expiring' ? isExpiringSoon(i.expiry) : Number(i.qty||0)===0
      return matchQ && matchTab
    })
  }, [items, q, tab])

  const totals = useMemo(()=>{
    const totalItems = items.length
    const low = items.filter(i => Number(i.qty||0) <= Number(i.min||0)).length
    const exp = items.filter(i => isExpiringSoon(i.expiry)).length
    const value = items.reduce((s,i)=> s + (Number(i.qty||0) * Number(i.unitPurchase||0)), 0)
    return { totalItems, low, exp, value }
  }, [items])

  const openAdd = () => { setForm(empty); setEditing(false); setShowForm(true) }
  const openEdit = (i) => { setForm(i); setEditing(true); if(i.category && !categories.includes(i.category)){ setCategories(prev=>Array.from(new Set([...(prev||[]), i.category])).sort()) } setShowForm(true) }
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000)
  }

  const askDelete = (item) => { setToDelete(item); setShowDeleteConfirm(true) }
  const confirmDelete = async () => { 
    if(toDelete){ 
      try {
        await inventoryAPI.delete(toDelete.id)
        await fetchInventory()
        setToDelete(null)
        setShowDeleteConfirm(false)
      } catch (err) {
        console.error('Error deleting inventory item:', err)
        showToast('Failed to delete item', 'error')
      }
    } 
  }
  const cancelDelete = () => { setShowDeleteConfirm(false); setToDelete(null) }

  const save = async (e) => {
    e.preventDefault()
    try {
      // Map UI form to backend schema
      const packsNum = Number(form.packs || 0)
      const unitsPerPackNum = Number(form.unitsPerPack || 0)
      let computedQty = Number(form.qty || 0)
      if ((!Number.isFinite(computedQty) || computedQty === 0) && Number.isFinite(packsNum) && Number.isFinite(unitsPerPackNum) && packsNum > 0 && unitsPerPackNum > 0) {
        computedQty = packsNum * unitsPerPackNum
      }
      const computedMin = Number(form.min || 0)
      const status = computedQty === 0 ? 'Out of Stock' : (computedQty <= computedMin ? 'Low Stock' : 'In Stock')

      const entry = {
        id: editing ? form.id : `LAB-INV-${Date.now()}`,
        invoice: form.invoice || '',
        itemName: form.name?.trim(),
        category: form.category || 'Other',
        quantity: computedQty,
        packs: packsNum,
        unitsPerPack: unitsPerPackNum,
        unit: 'unit',
        price: Number(form.unitPurchase || 0),
        unitSale: Number(form.unitSale || 0),
        supplier: form.supplier || '',
        expiryDate: form.expiry ? new Date(form.expiry) : undefined,
        minStockLevel: computedMin,
        department: 'lab',
        status
      }

      if (editing) {
        await inventoryAPI.update(form.id, entry)
      } else {
        await inventoryAPI.create(entry)
        
        // Auto-create purchase record for supplier if price and qty provided
        if (entry.price > 0 && entry.quantity > 0 && entry.supplier) {
          try {
            const supplier = suppliers.find(s => (s.supplierName || s.name) === entry.supplier);
            if (supplier) {
              await suppliersAPI.addPurchase(supplier._id || supplier.id, {
                productName: entry.itemName,
                quantity: Number(entry.quantity),
                unitPrice: Number(entry.price),
                invoiceNumber: entry.invoice || `LAB-${Date.now()}`,
                totalPrice: Number(entry.price) * Number(entry.quantity),
                portal: 'lab'
              });
            }
          } catch (supErr) {
            console.error('Error updating supplier purchase history from inventory:', supErr);
          }
        }
      }
      await fetchInventory()
      await fetchCategories()
      setShowForm(false)
    } catch (err) {
      console.error('Error saving inventory item:', err)
      showToast('Failed to save item', 'error')
    }
  }

  const openAddSupplierModal = () => {
    setNewSupplier({ supplierName:'', contactPerson:'', phone:'', email:'', address:'', category:'', notes:'' })
    setShowAddSupplier(true)
  }

  const closeAddSupplierModal = () => {
    if (savingSupplier) return
    setShowAddSupplier(false)
  }

  const saveNewSupplier = async (e) => {
    e.preventDefault()
    if (savingSupplier) return
    try {
      const payload = {
        ...newSupplier,
        supplierName: String(newSupplier.supplierName || '').trim(),
        portal: 'lab'
      }
      if (!payload.supplierName) {
        showToast('Supplier name is required', 'error')
        return
      }
      setSavingSupplier(true)
      await suppliersAPI.create(payload)
      await fetchSuppliers()
      setForm(f => ({ ...f, supplier: payload.supplierName }))
      setShowAddSupplier(false)
      setNewSupplier({ supplierName:'', contactPerson:'', phone:'', email:'', address:'', category:'', notes:'' })
    } catch (e2) {
      console.error('Failed to save supplier', e2)
      showToast(e2?.message || 'Failed to save supplier', 'error')
    } finally {
      setSavingSupplier(false)
    }
  }

  const normCat = (v) => String(v || '').trim().toLowerCase()

  const persistCustomCategories = (next) => {
    setCustomCategories(next)
    try { localStorage.setItem('lab_inventory_categories_custom', JSON.stringify(next)) } catch {}
  }

  const computeStatus = (qty, min) => {
    const qv = Number(qty || 0)
    const mv = Number(min || 0)
    return qv === 0 ? 'Out of Stock' : (qv <= mv ? 'Low Stock' : 'In Stock')
  }

  const updateItemsCategory = async (oldName, newName) => {
    const oldKey = normCat(oldName)
    const nextName = String(newName || '').trim() || 'Other'
    const affected = (items || []).filter(it => normCat(it.category) === oldKey)
    for (const it of affected) {
      const entry = {
        id: it.id,
        itemName: String(it.name || '').trim(),
        category: nextName,
        quantity: Number(it.qty || 0),
        unit: 'pcs',
        price: Number(it.unitPurchase || 0),
        supplier: it.supplier || '',
        expiryDate: it.expiry ? new Date(it.expiry) : undefined,
        minStockLevel: Number(it.min || 0),
        department: 'lab',
        status: computeStatus(it.qty, it.min)
      }
      await inventoryAPI.update(it.id, entry)
    }
  }

  const openManage = () => {
    setEditCategory({ old: '', value: '' })
    setManageNewCategory('')
    setShowManageCategories(true)
  }

  const closeManage = () => {
    if (manageBusy) return
    setShowManageCategories(false)
    setEditCategory({ old: '', value: '' })
    setManageNewCategory('')
  }

  const addCategoryFromManage = () => {
    const val = String(manageNewCategory || '').trim()
    if (!val) { showToast('Enter category', 'error'); return }
    const exists = (categories || []).find(c => normCat(c) === normCat(val))
    const chosen = exists || val
    const nextCats = Array.from(new Set([...(categories || []), chosen])).sort()
    setCategories(nextCats)
    if (!(customCategories || []).some(c => normCat(c) === normCat(chosen))) {
      const nextCustom = Array.from(new Set([...(customCategories || []), chosen])).sort()
      persistCustomCategories(nextCustom)
    }
    setManageNewCategory('')
  }

  const startRename = (c) => {
    if (manageBusy) return
    setEditCategory({ old: c, value: c })
  }

  const cancelRename = () => setEditCategory({ old: '', value: '' })

  const confirmRename = async () => {
    const oldName = editCategory.old
    const newName = String(editCategory.value || '').trim()
    if (!oldName) return
    if (!newName) { showToast('Enter category name', 'error'); return }
    if (normCat(oldName) === normCat(newName)) { setEditCategory({ old: '', value: '' }); return }
    if ((categories || []).some(c => normCat(c) === normCat(newName))) {
      showToast('Category already exists', 'error')
      return
    }
    try {
      setManageBusy(true)
      await updateItemsCategory(oldName, newName)
      const nextCats = (categories || []).map(c => (normCat(c) === normCat(oldName) ? newName : c))
      setCategories(Array.from(new Set(nextCats)).sort())
      const nextCustom = (customCategories || []).map(c => (normCat(c) === normCat(oldName) ? newName : c))
      persistCustomCategories(Array.from(new Set(nextCustom)).sort())
      setForm(f => (normCat(f.category) === normCat(oldName) ? { ...f, category: newName } : f))
      setEditCategory({ old: '', value: '' })
      await fetchInventory()
      await fetchCategories()
    } catch (e) {
      console.error('Rename category failed', e)
      showToast('Failed to rename category', 'error')
    } finally {
      setManageBusy(false)
    }
  }

  const confirmDeleteCategory = async (cat) => {
    if (!cat) return
    if (normCat(cat) === 'other') { showToast('Cannot delete Other', 'error'); return }
    if (manageBusy) return
    
    setConfirmDialog({
      show: true,
      title: 'Delete Category',
      message: `Delete category "${cat}"? Items in this category will be moved to "Other".`,
      type: 'danger',
      onConfirm: async () => {
        try {
          setManageBusy(true)
          await inventoryAPI.deleteCategory(cat)
          await fetchCategories()
          showToast('Category deleted')
        } catch (e) {
          console.error('Delete category failed', e)
          showToast('Failed to delete category', 'error')
        } finally {
          setManageBusy(false)
          setConfirmDialog(prev => ({ ...prev, show: false }))
        }
      }
    })
  }

  const exportCSV = () => {
    const headers = ['Invoice','Item','Category','Packs','Units/Pack','Unit Purchase','Unit Sale','Total Units','Min Stock','Expiry','Supplier','Status']
    const rows = filtered.map(i => [i.invoice, i.name, i.category, i.packs, i.unitsPerPack, i.unitPurchase, i.unitSale, i.qty, i.min, i.expiry||'-', i.supplier||'', i.status||'OK'])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download='lab-inventory.csv'; a.click(); URL.revokeObjectURL(url)
  }

  const exportExcel = () => {
    try {
      const rows = filtered.map(i => ({
        'ID': i.id || '',
        'Department': 'lab',
        'Invoice': i.invoice || '',
        'Item Name': i.name || '',
        'Category': i.category || '',
        'Packs': Number(i.packs || 0),
        'Units/Pack': Number(i.unitsPerPack || 0),
        'Unit Purchase': Number(i.unitPurchase || 0),
        'Unit Sale': Number(i.unitSale || 0),
        'Total Units': Number(i.qty || 0),
        'Min Stock': Number(i.min || 0),
        'Expiry': i.expiry || '',
        'Supplier': i.supplier || '',
        'Status': i.status || '',
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Lab Inventory')
      XLSX.writeFile(wb, `lab-inventory-${new Date().toISOString().slice(0,10)}.xlsx`)
    } catch (e) {
      console.error('Export excel failed', e)
      showToast('Export failed', 'error')
    }
  }

  const normalizeKey = (v) => String(v || '').trim().toLowerCase()

  const getRowValue = (row, keys) => {
    if (!row || typeof row !== 'object') return ''
    const map = new Map(Object.keys(row).map(k => [normalizeKey(k), row[k]]))
    for (const k of keys) {
      const v = map.get(normalizeKey(k))
      if (v !== undefined && v !== null && String(v).trim() !== '') return v
    }
    return ''
  }

  const importFromExcel = async (file) => {
    if (!file) return
    try {
      setImporting(true)
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheetName = wb.SheetNames?.[0]
      const ws = sheetName ? wb.Sheets[sheetName] : null
      if (!ws) {
        showToast('No sheet found', 'error')
        return
      }

      const json = XLSX.utils.sheet_to_json(ws, { defval: '' })
      const payload = (json || []).map(row => {
        const id = String(getRowValue(row, ['id','ID']) || '').trim()
        const department = String(getRowValue(row, ['department','Department','portal','Portal']) || 'lab').trim() || 'lab'
        const invoice = String(getRowValue(row, ['invoice','Invoice','invoice #','Invoice #']) || '').trim()
        const itemName = String(getRowValue(row, ['itemName','item name','Item Name','name','Item']) || '').trim()
        const category = String(getRowValue(row, ['category','Category']) || 'Other').trim() || 'Other'

        const packs = Number(getRowValue(row, ['packs','Packs']) || 0) || 0
        const unitsPerPack = Number(getRowValue(row, ['unitsPerPack','units/pack','Units/Pack','Units per Pack']) || 0) || 0
        const price = Number(getRowValue(row, ['price','unitPurchase','Unit Purchase','purchasePrice']) || 0) || 0
        const unitSale = Number(getRowValue(row, ['unitSale','Unit Sale','salePrice']) || 0) || 0
        const quantity = Number(getRowValue(row, ['quantity','qty','Total Units','Total units','Total']) || 0) || 0
        const minStockLevel = Number(getRowValue(row, ['minStockLevel','min','Min Stock']) || 0) || 0
        const expiry = getRowValue(row, ['expiryDate','expiry','Expiry'])
        const supplier = String(getRowValue(row, ['supplier','Supplier']) || '').trim()
        const status = String(getRowValue(row, ['status','Status']) || '').trim()

        const out = {
          id: id || undefined,
          department,
          invoice,
          itemName,
          category,
          packs,
          unitsPerPack,
          price,
          unitSale,
          quantity,
          minStockLevel,
          expiryDate: expiry,
          supplier,
        }
        if (status) out.status = status
        return out
      }).filter(r => r.itemName)

      if (!payload.length) {
        showToast('No valid rows found', 'error')
        return
      }

      const res = await inventoryAPI.bulkUpsert(payload)
      const created = res?.created ?? 0
      const updated = res?.updated ?? 0
      const failed = res?.failed ?? 0
      const errs = Array.isArray(res?.errors) ? res.errors : []
      const firstFew = errs.slice(0, 3).map(e => e?.message).filter(Boolean)
      const suffix = firstFew.length ? `\nErrors: ${firstFew.join(' | ')}${errs.length > 3 ? ' ...' : ''}` : ''
      showToast(`Imported: ${created} created, ${updated} updated, ${failed} failed${suffix}`)
      setQ('')
      setTab('All')
      await fetchInventory()
      await fetchCategories()
    } catch (e) {
      console.error('Import excel failed', e)
      showToast('Import failed', 'error')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Inventory Management</h1>
        <p className="text-slate-500 text-xs">Track and manage laboratory supplies</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl p-3 bg-white ring-1 ring-slate-200 shadow-sm"><div className="text-xs text-slate-500">Total Items</div><div className="text-xl font-bold">{totals.totalItems}</div></div>
        <div className="rounded-2xl p-3 bg-white ring-1 ring-slate-200 shadow-sm"><div className="text-xs text-slate-500">Low Stock</div><div className="text-xl font-bold text-amber-600">{totals.low}</div></div>
        <div className="rounded-2xl p-3 bg-white ring-1 ring-slate-200 shadow-sm"><div className="text-xs text-slate-500">Expiring Soon</div><div className="text-xl font-bold text-rose-600">{totals.exp}</div></div>
        <div className="rounded-2xl p-3 bg-white ring-1 ring-slate-200 shadow-sm"><div className="text-xs text-slate-500">Total Value</div><div className="text-xl font-bold text-emerald-600">PKR {totals.value.toLocaleString()}</div></div>
      </div>

      <div className="rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm p-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-2">
            <input className="h-10 px-3 rounded-lg border border-slate-300 w-full lg:w-80" placeholder="Search (name, category, invoice)" value={q} onChange={e=>setQ(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1">
            <button onClick={()=>{ fetchInventory(); fetchCategories(); fetchSuppliers(); }} className="px-3 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 whitespace-nowrap shrink-0">Refresh</button>
            <button onClick={exportExcel} className="px-3 h-10 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white whitespace-nowrap shrink-0">Export Excel</button>
            <button onClick={()=>fileInputRef.current?.click()} disabled={importing} className="px-3 h-10 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white whitespace-nowrap shrink-0">{importing ? 'Importing...' : 'Import Excel'}</button>
            <button onClick={openAdd} className="px-3 h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white whitespace-nowrap shrink-0">+ Add New Item</button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e)=>importFromExcel(e.target.files?.[0])} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {['All','Low','Expiring','Out'].map(t => (
            <button key={t} onClick={()=>setTab(t)} className={`px-3 h-8 rounded-lg border text-xs ${tab===t? 'bg-slate-900 text-white border-slate-900':'bg-white border-slate-300 text-slate-700'}`}>{t==='All'?'All Items':t==='Low'?'Low Stock':t==='Expiring'?'Expiring Soon':'Out of Stock'}</button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-500">
                <th className="py-2 px-3">Invoice #</th>
                <th className="py-2 px-3">Item</th>
                <th className="py-2 px-3">Category</th>
                <th className="py-2 px-3">Packs</th>
                <th className="py-2 px-3">Units/Pack</th>
                <th className="py-2 px-3">Unit Sale</th>
                <th className="py-2 px-3">Total Units</th>
                <th className="py-2 px-3">Min Stock</th>
                <th className="py-2 px-3">Expiry</th>
                <th className="py-2 px-3">Supplier</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(i => (
                <tr key={i.id} className="border-t border-slate-100">
                  <td className="py-2 px-3">{i.invoice||'-'}</td>
                  <td className="py-2 px-3 font-medium text-slate-900">{i.name}</td>
                  <td className="py-2 px-3">{i.category||'-'}</td>
                  <td className="py-2 px-3">{i.packs||0}</td>
                  <td className="py-2 px-3">{i.unitsPerPack||0}</td>
                  <td className="py-2 px-3">{Number(i.unitSale||0).toLocaleString()}</td>
                  <td className="py-2 px-3">{i.qty||0}</td>
                  <td className="py-2 px-3">{i.min||0}</td>
                  <td className="py-2 px-3">{i.expiry||'-'}</td>
                  <td className="py-2 px-3">{i.supplier||'-'}</td>
                  <td className="py-2 px-3">{Number(i.qty||0)===0 ? 'Out' : Number(i.qty||0) <= Number(i.min||0) ? 'Low' : isExpiringSoon(i.expiry) ? 'Expiring' : 'OK'}</td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <button onClick={()=>openEdit(i)} className="px-3 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50">Edit</button>
                      <button onClick={()=>askDelete(i)} className="px-3 h-8 rounded-lg bg-red-600 hover:bg-red-700 text-white">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length===0 && (
                <tr><td colSpan={12} className="py-6 text-center text-slate-500">No items found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setShowForm(false)}></div>
          <form onSubmit={save} className="relative w-[95%] max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white ring-1 ring-slate-200 shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-lg font-semibold text-slate-800">{editing? 'Update Stock Item' : 'Add New Stock Item'}</div>
              <button type="button" onClick={()=>setShowForm(false)} className="h-8 w-8 grid place-items-center rounded-md border border-slate-300">×</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Invoice #</label>
                <input value={form.invoice} onChange={e=>setForm(f=>({...f, invoice:e.target.value}))} placeholder="e.g., 123" className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Item Name</label>
                <input value={form.name} onChange={e=>setForm(f=>({...f, name:e.target.value}))} placeholder="Item Name" className="h-10 px-3 rounded-lg border border-slate-300 w-full" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <div className="flex gap-2 items-center">
                  <select value={form.category} onChange={e=>setForm(f=>({...f, category:e.target.value}))} className="h-10 px-3 rounded-lg border border-slate-300 flex-1 min-w-0 bg-white">
                    <option value="">Select Category</option>
                    {(categories||[]).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <button type="button" onClick={openManage} className="px-4 h-10 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 whitespace-nowrap shrink-0">Manage</button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Packs</label>
                <input type="number" value={form.packs} onChange={e=>{
                  const packs = e.target.value;
                  const unitsPerPack = form.unitsPerPack;
                  const qty = (Number(packs || 0) * Number(unitsPerPack || 0)) || '';
                  setForm(f=>({...f, packs, qty}))
                }} placeholder="0" className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Units per Pack</label>
                <input type="number" value={form.unitsPerPack} onChange={e=>{
                  const unitsPerPack = e.target.value;
                  const packs = form.packs;
                  const qty = (Number(packs || 0) * Number(unitsPerPack || 0)) || '';
                  setForm(f=>({...f, unitsPerPack, qty}))
                }} placeholder="0" className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Unit Purchase Price (PKR)</label>
                <input type="number" value={form.unitPurchase} onChange={e=>setForm(f=>({...f, unitPurchase:e.target.value}))} placeholder="0" className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Unit Sale Price (PKR)</label>
                <input type="number" value={form.unitSale} onChange={e=>setForm(f=>({...f, unitSale:e.target.value}))} placeholder="0" className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Total Units in Stock</label>
                <input type="number" value={form.qty} onChange={e=>setForm(f=>({...f, qty:e.target.value}))} placeholder="0" className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Min Stock</label>
                <input type="number" value={form.min} onChange={e=>setForm(f=>({...f, min:e.target.value}))} placeholder="0" className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Expiry</label>
                <input type="date" value={form.expiry} onChange={e=>setForm(f=>({...f, expiry:e.target.value}))} className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Supplier</label>
                <div className="flex gap-2 items-center">
                  <select value={form.supplier} onChange={e=>{
                    const val = e.target.value
                    if (val === '__add__') { openAddSupplierModal(); return }
                    setForm(f=>({ ...f, supplier: val }))
                  }} className="h-10 px-3 rounded-lg border border-slate-300 flex-1 min-w-0 bg-white">
                    <option value="">Select Supplier</option>
                    {suppliers.map(s=> (
                      <option key={s._id} value={s.supplierName}>{s.supplierName}</option>
                    ))}
                    <option value="__add__">+ Add new supplier…</option>
                  </select>
                  <button type="button" onClick={openAddSupplierModal} className="px-4 h-10 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 whitespace-nowrap shrink-0">Add</button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select value={form.status} onChange={e=>setForm(f=>({...f, status:e.target.value}))} className="h-10 px-3 rounded-lg border border-slate-300 w-full">
                  <option>OK</option>
                  <option>Low</option>
                  <option>Expiring</option>
                  <option>Out</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={()=>setShowForm(false)} className="px-4 h-10 rounded-lg border border-slate-300">Cancel</button>
              <button className="px-4 h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white">{editing ? 'Update Item' : 'Add Item'}</button>
            </div>
          </form>
        </div>
      )}

      {showDeleteConfirm && toDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={cancelDelete}></div>
          <div className="relative w-[95%] max-w-md rounded-2xl bg-white ring-1 ring-slate-200 shadow-xl p-6">
            <div className="text-lg font-bold text-slate-900 mb-2">Delete Item</div>
            <div className="text-sm text-slate-600 mb-4">Are you sure you want to delete <span className="font-medium">{toDelete.name}</span> (Invoice #{toDelete.invoice || '-'})?</div>
            <div className="flex justify-end gap-3">
              <button onClick={cancelDelete} className="px-4 h-10 rounded-lg border border-slate-300">Cancel</button>
              <button onClick={confirmDelete} className="px-4 h-10 rounded-lg bg-red-600 hover:bg-red-700 text-white">Delete</button>
            </div>
          </div>
        </div>
      )}

      {showManageCategories && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeManage}></div>
          <div className="relative w-[95%] max-w-2xl rounded-2xl bg-white ring-1 ring-slate-200 shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-semibold text-slate-800">Manage Categories</div>
              <button type="button" onClick={closeManage} className="h-8 w-8 grid place-items-center rounded-md border border-slate-300">×</button>
            </div>

            <div className="flex gap-2 mb-4">
              <input value={manageNewCategory} onChange={e=>setManageNewCategory(e.target.value)} placeholder="New category name" className="h-10 px-3 rounded-lg border border-slate-300 w-full" disabled={manageBusy} />
              <button type="button" onClick={addCategoryFromManage} className="px-4 h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white" disabled={manageBusy}>Add</button>
            </div>

            <div className="max-h-[55vh] overflow-y-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-slate-500">
                    <th className="py-2 px-3">Category</th>
                    <th className="py-2 px-3 w-[220px]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(categories || []).map((c) => (
                    <tr key={c} className="border-t border-slate-100">
                      <td className="py-2 px-3">
                        {editCategory.old === c ? (
                          <input value={editCategory.value} onChange={e=>setEditCategory(x=>({ ...x, value: e.target.value }))} className="h-9 px-2 rounded-lg border border-slate-300 w-full" disabled={manageBusy} />
                        ) : (
                          <span className="text-slate-800">{c}</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2 justify-end">
                          {editCategory.old === c ? (
                            <>
                              <button type="button" onClick={cancelRename} className="px-3 h-9 rounded-lg border border-slate-300" disabled={manageBusy}>Cancel</button>
                              <button type="button" onClick={confirmRename} className="px-3 h-9 rounded-lg bg-slate-900 text-white" disabled={manageBusy}>Save</button>
                            </>
                          ) : (
                            <>
                              <button type="button" onClick={()=>startRename(c)} className="px-3 h-9 rounded-lg border border-slate-300" disabled={manageBusy}>Edit</button>
                              <button type="button" onClick={()=>confirmDeleteCategory(c)} className="px-3 h-9 rounded-lg bg-red-600 hover:bg-red-700 text-white" disabled={manageBusy}>Delete</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end">
              <button type="button" onClick={closeManage} className="px-4 h-10 rounded-lg border border-slate-300" disabled={manageBusy}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Dialog */}
      {confirmDialog.show && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className={`px-6 py-4 flex items-center gap-3 ${confirmDialog.type === 'danger' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
              <div className={`p-2 rounded-full ${confirmDialog.type === 'danger' ? 'bg-red-100' : 'bg-amber-100'}`}>
                <FiTrash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold">{confirmDialog.title}</h3>
            </div>
            <div className="p-6">
              <p className="text-slate-600 leading-relaxed">{confirmDialog.message}</p>
            </div>
            <div className="px-6 py-4 bg-slate-50 flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDialog(prev => ({ ...prev, show: false }))}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDialog.onConfirm()}
                className={`px-6 py-2 text-white rounded-lg font-bold shadow-lg transition-all ${
                  confirmDialog.type === 'danger' 
                    ? 'bg-red-600 hover:bg-red-700 shadow-red-200' 
                    : 'bg-amber-600 hover:bg-amber-700 shadow-amber-200'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Toast Notification */}
      {toast.show && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl shadow-2xl z-[300] flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-300 ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'
        }`}>
          <div className={`w-2 h-2 rounded-full animate-pulse ${toast.type === 'error' ? 'bg-white' : 'bg-emerald-400'}`}></div>
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      {showAddSupplier && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeAddSupplierModal}></div>
          <form onSubmit={saveNewSupplier} className="relative w-[95%] max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white ring-1 ring-slate-200 shadow-xl">
            <div className="sticky top-0 z-10 bg-white flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="text-lg font-semibold">Add Supplier</div>
              <button type="button" onClick={closeAddSupplierModal} className="h-8 w-8 grid place-items-center rounded-md border border-slate-300">×</button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Supplier Name *</label>
                <input required value={newSupplier.supplierName} onChange={e=>setNewSupplier(s=>({ ...s, supplierName: e.target.value }))} className="h-11 px-3 rounded-lg border-2 border-slate-200 w-full" disabled={savingSupplier} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contact Person</label>
                <input value={newSupplier.contactPerson} onChange={e=>setNewSupplier(s=>({ ...s, contactPerson: e.target.value }))} className="h-11 px-3 rounded-lg border-2 border-slate-200 w-full" disabled={savingSupplier} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input value={newSupplier.phone} onChange={e=>setNewSupplier(s=>({ ...s, phone: e.target.value }))} className="h-11 px-3 rounded-lg border-2 border-slate-200 w-full" disabled={savingSupplier} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input type="email" value={newSupplier.email} onChange={e=>setNewSupplier(s=>({ ...s, email: e.target.value }))} className="h-11 px-3 rounded-lg border-2 border-slate-200 w-full" disabled={savingSupplier} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <input value={newSupplier.category} onChange={e=>setNewSupplier(s=>({ ...s, category: e.target.value }))} className="h-11 px-3 rounded-lg border-2 border-slate-200 w-full" disabled={savingSupplier} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <input value={newSupplier.address} onChange={e=>setNewSupplier(s=>({ ...s, address: e.target.value }))} className="h-11 px-3 rounded-lg border-2 border-slate-200 w-full" disabled={savingSupplier} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea rows={3} value={newSupplier.notes} onChange={e=>setNewSupplier(s=>({ ...s, notes: e.target.value }))} className="px-3 py-2 rounded-lg border-2 border-slate-200 w-full" disabled={savingSupplier} />
              </div>
            </div>
            <div className="sticky bottom-0 z-10 px-6 py-4 border-t border-slate-200 flex justify-end gap-2 bg-slate-50">
              <button type="button" onClick={closeAddSupplierModal} className="h-10 px-4 rounded-lg border border-slate-300" disabled={savingSupplier}>Cancel</button>
              <button className="h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60" disabled={savingSupplier}>{savingSupplier ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
