import React, { useEffect, useRef, useState, useMemo } from 'react'
import { FiPlus, FiEdit2, FiTrash2, FiX, FiDownload, FiUpload, FiPackage } from 'react-icons/fi'
import * as XLSX from 'xlsx'
import { suppliersAPI, payablesAPI, inventoryAPI } from '../../services/api'

export default function LabSuppliers(){
  const [suppliers, setSuppliers] = useState([])
  const [medicines, setMedicines] = useState([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef(null)
  const [showModal, setShowModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [toDelete, setToDelete] = useState(null)

  const [form, setForm] = useState({
    supplierName:'', contactPerson:'', phone:'', email:'', address:'', category:'', notes:''
  })

  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState(null)
  const [showMedDropdown, setShowMedDropdown] = useState(false)
  const [purchaseData, setPurchaseData] = useState({
    productName: '',
    quantity: 0,
    unitPrice: 0,
    invoiceNumber: ''
  })

  useEffect(()=>{ 
    fetchSuppliers();
    fetchMedicines();
  },[])

  const fetchMedicines = async () => {
    try {
      const res = await inventoryAPI.getAll();
      const items = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      // Filter for lab department if needed, or use all inventory items
      setMedicines(items);
    } catch (e) {
      console.error('Fetch inventory error:', e);
    }
  };

  const openPurchaseModal = (s) => {
    setSelectedSupplier(s)
    setPurchaseData({
      productName: '',
      quantity: 0,
      unitPrice: 0,
      invoiceNumber: '',
      medicineId: ''
    })
    setShowPurchaseModal(true)
  }

  const handlePurchaseSubmit = async (e) => {
    e.preventDefault()
    try {
      const totalAmount = purchaseData.quantity * purchaseData.unitPrice
      
      // 1. Create Payable in Admin
      await payablesAPI.create({
        supplierId: selectedSupplier._id || selectedSupplier.id,
        supplierName: selectedSupplier.supplierName,
        billRef: purchaseData.invoiceNumber || `LAB-PUR-${Date.now()}`,
        totalAmount: totalAmount,
        balance: totalAmount,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        portal: 'lab',
        status: 'open',
        description: `Lab Purchase: ${purchaseData.productName}`
      })

      // 2. Add to Supplier Purchase History
      await suppliersAPI.addPurchase(selectedSupplier._id || selectedSupplier.id, {
        productId: purchaseData.medicineId,
        productName: purchaseData.productName,
        quantity: purchaseData.quantity,
        unitPrice: purchaseData.unitPrice,
        invoiceNumber: purchaseData.invoiceNumber,
        totalPrice: totalAmount,
        portal: 'lab'
      })

      // 3. Update Supplier Totals locally or refetch
      await fetchSuppliers()

      setToast('Purchase recorded and payable created in Admin')
      setShowPurchaseModal(false)
      setTimeout(()=>setToast(''), 3000)
    } catch (error) {
      console.error('Purchase error:', error)
      setToast('Error recording purchase')
      setTimeout(()=>setToast(''), 3000)
    }
  }

  const fetchSuppliers = async ()=>{
    try {
      setLoading(true)
      const res = await suppliersAPI.getAll('lab')
      setSuppliers(res?.data || [])
    } catch (e) {
      setSuppliers([])
    } finally { setLoading(false) }
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

  const exportSuppliersToExcel = () => {
    try {
      const rows = (suppliers || []).map(s => ({
        'Supplier Name': s.supplierName || '',
        'Contact Person': s.contactPerson || '',
        'Phone': s.phone || '',
        'Email': s.email || '',
        'Address': s.address || '',
        'Category': s.category || '',
        'Notes': s.notes || '',
        'Portal': s.portal || 'lab',
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Suppliers')
      XLSX.writeFile(wb, `lab-suppliers-${new Date().toISOString().slice(0,10)}.xlsx`)
    } catch (e) {
      console.error('Export suppliers failed', e)
      setToast('Export failed')
      setTimeout(()=>setToast(''), 2200)
    }
  }

  const importSuppliersFromExcel = async (file) => {
    if (!file) return
    try {
      setImporting(true)
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheetName = wb.SheetNames?.[0]
      const ws = sheetName ? wb.Sheets[sheetName] : null
      if (!ws) {
        setToast('No sheet found')
        setTimeout(()=>setToast(''), 2200)
        return
      }
      const json = XLSX.utils.sheet_to_json(ws, { defval: '' })
      const items = (json || []).map(row => {
        const supplierName = String(getRowValue(row, ['supplierName','supplier name','name','supplier']) || '').trim()
        const contactPerson = String(getRowValue(row, ['contactPerson','contact person','contact']) || '').trim()
        const phone = String(getRowValue(row, ['phone','mobile']) || '').trim()
        const email = String(getRowValue(row, ['email']) || '').trim()
        const address = String(getRowValue(row, ['address']) || '').trim()
        const category = String(getRowValue(row, ['category']) || '').trim()
        const notes = String(getRowValue(row, ['notes','note']) || '').trim()
        const portal = String(getRowValue(row, ['portal']) || 'lab').trim() || 'lab'
        return { supplierName, contactPerson, phone, email, address, category, notes, portal }
      }).filter(x => x.supplierName)

      if (!items.length) {
        setToast('No valid rows found')
        setTimeout(()=>setToast(''), 2200)
        return
      }

      const res = await suppliersAPI.bulkUpsert(items)
      const created = res?.created ?? 0
      const updated = res?.updated ?? 0
      const failed = res?.failed ?? 0
      setToast(`Imported: ${created} created, ${updated} updated, ${failed} failed`)
      await fetchSuppliers()
      setTimeout(()=>setToast(''), 3000)
    } catch (e) {
      console.error('Import suppliers failed', e)
      setToast('Import failed')
      setTimeout(()=>setToast(''), 2200)
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const openModal = (s=null)=>{
    if (s) { setEditing(s); setForm({
      supplierName: s.supplierName||'', contactPerson: s.contactPerson||'', phone: s.phone||'', email: s.email||'', address: s.address||'', category: s.category||'', notes: s.notes||''
    }) }
    else { setEditing(null); setForm({ supplierName:'', contactPerson:'', phone:'', email:'', address:'', category:'', notes:'' }) }
    setShowModal(true)
  }

  const saveSupplier = async (e)=>{
    e.preventDefault()
    try {
      if (editing && editing._id) {
        await suppliersAPI.update(editing._id, { ...form, portal: 'lab' })
        setToast('Supplier updated')
      } else {
        await suppliersAPI.create({ ...form, portal: 'lab' })
        setToast('Supplier added')
      }
      setShowModal(false)
      setEditing(null)
      await fetchSuppliers()
      setTimeout(()=>setToast(''), 2200)
    } catch (e) {
      setToast('Failed to save supplier')
      setTimeout(()=>setToast(''), 2200)
    }
  }

  const askDelete = (s)=>{ setToDelete(s); setShowDeleteModal(true) }
  const doDelete = async ()=>{
    if (!toDelete) return
    try { await suppliersAPI.delete(toDelete._id); setToast('Supplier deleted'); await fetchSuppliers() } catch (e) { setToast('Delete failed') }
    setShowDeleteModal(false); setToDelete(null); setTimeout(()=>setToast(''), 2200)
  }

  return (
    <div className="space-y-6">
      {toast && (<div className="fixed top-4 right-4 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow z-50">{toast}</div>)}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">Suppliers</h1>
          <p className="text-slate-500">Manage lab suppliers for inventory purchases</p>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1">
          <button onClick={exportSuppliersToExcel} className="inline-flex items-center gap-2 px-4 h-10 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold whitespace-nowrap shrink-0"><FiDownload/> Export Excel</button>
          <button onClick={()=>fileInputRef.current?.click()} disabled={importing} className="inline-flex items-center gap-2 px-4 h-10 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-sm font-semibold whitespace-nowrap shrink-0"><FiUpload/> {importing ? 'Importing...' : 'Import Excel'}</button>
          <button onClick={()=>openModal()} className="inline-flex items-center gap-2 px-4 h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold whitespace-nowrap shrink-0"><FiPlus/> Add Supplier</button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e)=>importSuppliersFromExcel(e.target.files?.[0])} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(loading? [] : suppliers).map(s=> (
          <div key={s._id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold text-slate-900 text-lg">{s.supplierName}</div>
                {s.category && <div className="text-xs text-emerald-700 mt-1">{s.category}</div>}
                {s.contactPerson && <div className="text-xs text-slate-600 mt-1">Contact: {s.contactPerson}</div>}
                {s.phone && <div className="text-xs text-slate-600">Phone: {s.phone}</div>}
              </div>
              <div className="flex gap-1">
                <button onClick={()=>openModal(s)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><FiEdit2 className="w-4 h-4"/></button>
                <button onClick={()=>askDelete(s)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><FiTrash2 className="w-4 h-4"/></button>
              </div>
            </div>
            {s.address && <div className="text-xs text-slate-500 mt-2">{s.address}</div>}
            
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Total Purchases:</span>
                    <span className="font-bold text-slate-800">Rs {(s.totalPurchases || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Total Paid:</span>
                    <span className="font-semibold text-emerald-600">Rs {(s.totalPaid || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs pt-1 border-t border-slate-50">
                    <span className="text-slate-500 font-medium">Balance Payable:</span>
                    <span className="font-bold text-red-600">Rs {Math.max(0, (s.totalPurchases || 0) - (s.totalPaid || 0)).toLocaleString()}</span>
                  </div>
                  
                  <button
                    onClick={() => openPurchaseModal(s)}
                    className="w-full mt-2 flex items-center justify-center gap-2 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                  >
                    <FiPackage className="w-3.5 h-3.5" /> Record Purchase
                  </button>
                </div>
          </div>
        ))}
        {!loading && suppliers.length===0 && (
          <div className="col-span-full text-center text-slate-500 bg-white border border-slate-200 rounded-xl p-10">No suppliers yet</div>
        )}
      </div>

      {/* Record Purchase Modal */}
      {showPurchaseModal && selectedSupplier && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={()=>setShowPurchaseModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e=>e.stopPropagation()}>
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between text-white">
              <div className="text-lg font-bold">Record Lab Purchase</div>
              <button onClick={() => setShowPurchaseModal(false)} className="text-white hover:bg-white/20 p-2 rounded-lg"><FiX /></button>
            </div>

            <form onSubmit={handlePurchaseSubmit} className="p-6 space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl mb-2">
                <p className="text-xs text-slate-500">Supplier:</p>
                <p className="font-bold text-slate-900">{selectedSupplier.supplierName}</p>
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-slate-700 mb-1">Item Description *</label>
                <div className="flex gap-2">
                  <input
                  required
                  value={purchaseData.productName}
                  onChange={e=>{
                    setPurchaseData({...purchaseData, productName:e.target.value});
                    setShowMedDropdown(true);
                  }}
                  onFocus={() => setShowMedDropdown(true)}
                  className="flex-1 h-11 px-3 border-2 border-slate-200 rounded-lg focus:border-emerald-500 focus:outline-none transition-colors"
                  placeholder="e.g. Chemicals, Glassware"
                />
                  {medicines.some(m => (m.supplierName === selectedSupplier.supplierName || m.supplierName === selectedSupplier.name || m.supplier === selectedSupplier.supplierName || m.supplier === selectedSupplier.name)) && (
                    <select
                      onChange={(e) => {
                        const medName = e.target.value;
                        if (!medName) return;
                        const m = medicines.find(med => (med.itemName || med.name || med.medicineName) === medName && (med.supplierName === selectedSupplier.supplierName || med.supplierName === selectedSupplier.name || med.supplier === selectedSupplier.supplierName || med.supplier === selectedSupplier.name));
                        if (m) {
                          setPurchaseData({
                            ...purchaseData,
                            productName: m.itemName || m.name || m.medicineName,
                            unitPrice: Number(m.unitCost || m.purchasePrice || 0),
                            medicineId: m._id || m.id
                          });
                          setShowMedDropdown(false);
                        }
                      }}
                      className="w-40 px-2 h-11 border-2 border-slate-200 rounded-lg text-sm bg-slate-50 focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="">History...</option>
                      {[...new Set(medicines
                        .filter(m => (m.supplierName === selectedSupplier.supplierName || m.supplierName === selectedSupplier.name || m.supplier === selectedSupplier.supplierName || m.supplier === selectedSupplier.name))
                        .map(m => m.itemName || m.name || m.medicineName))].map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  )}
                </div>
                {showMedDropdown && purchaseData.productName && (
                  <div className="absolute z-[60] w-full mt-1 bg-white border-2 border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {medicines
                      .filter(m => (m.itemName || m.name || m.medicineName || '').toLowerCase().includes(purchaseData.productName.toLowerCase()))
                      .map((m, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="w-full text-left px-4 py-2 hover:bg-emerald-50 text-sm border-b last:border-0"
                          onClick={() => {
                            setPurchaseData({ 
                              ...purchaseData, 
                              productName: m.itemName || m.name || m.medicineName,
                              unitPrice: Number(m.unitCost || m.purchasePrice || 0),
                              medicineId: m._id || m.id
                            });
                            setShowMedDropdown(false);
                          }}
                        >
                          <div className="font-bold">{m.itemName || m.name || m.medicineName}</div>
                          <div className="text-xs text-slate-500">Stock: {m.totalUnits || m.quantity} | Purchase Price: Rs {m.unitCost || m.purchasePrice || 'N/A'}</div>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Quantity *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={purchaseData.quantity}
                    onChange={e=>setPurchaseData({...purchaseData, quantity:Number(e.target.value)})}
                    className="w-full h-11 px-3 border-2 border-slate-200 rounded-lg focus:border-emerald-500 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Unit Cost *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={purchaseData.unitPrice}
                    onChange={e=>setPurchaseData({...purchaseData, unitPrice:Number(e.target.value)})}
                    className="w-full h-11 px-3 border-2 border-slate-200 rounded-lg focus:border-emerald-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Number</label>
                <input
                  value={purchaseData.invoiceNumber}
                  onChange={e=>setPurchaseData({...purchaseData, invoiceNumber:e.target.value})}
                  className="w-full h-11 px-3 border-2 border-slate-200 rounded-lg focus:border-emerald-500 focus:outline-none transition-colors"
                  placeholder="Optional"
                />
              </div>

              <div className="bg-emerald-50 p-4 rounded-xl">
                <div className="flex justify-between items-center text-emerald-900 font-bold">
                  <span>Total Amount:</span>
                  <span className="text-lg">Rs {(purchaseData.quantity * purchaseData.unitPrice).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={()=>setShowPurchaseModal(false)} className="flex-1 h-11 rounded-lg border-2 border-slate-200 font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" className="flex-1 h-11 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-100">Record Purchase</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={()=>setShowModal(false)}>
          <form onSubmit={saveSupplier} className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="sticky top-0 z-10 bg-white flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="text-lg font-semibold">{editing? 'Edit Supplier' : 'Add Supplier'}</div>
              <button type="button" onClick={()=>setShowModal(false)} className="text-slate-500 hover:text-slate-700"><FiX/></button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Supplier Name *</label>
                <input required value={form.supplierName} onChange={e=>setForm(f=>({...f, supplierName:e.target.value}))} className="h-11 px-3 rounded-lg border-2 border-slate-200 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contact Person</label>
                <input value={form.contactPerson} onChange={e=>setForm(f=>({...f, contactPerson:e.target.value}))} className="h-11 px-3 rounded-lg border-2 border-slate-200 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input value={form.phone} onChange={e=>setForm(f=>({...f, phone:e.target.value}))} className="h-11 px-3 rounded-lg border-2 border-slate-200 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input type="email" value={form.email} onChange={e=>setForm(f=>({...f, email:e.target.value}))} className="h-11 px-3 rounded-lg border-2 border-slate-200 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <input value={form.category} onChange={e=>setForm(f=>({...f, category:e.target.value}))} className="h-11 px-3 rounded-lg border-2 border-slate-200 w-full" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <input value={form.address} onChange={e=>setForm(f=>({...f, address:e.target.value}))} className="h-11 px-3 rounded-lg border-2 border-slate-200 w-full" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea rows={3} value={form.notes} onChange={e=>setForm(f=>({...f, notes:e.target.value}))} className="px-3 py-2 rounded-lg border-2 border-slate-200 w-full"/>
              </div>
            </div>
            <div className="sticky bottom-0 z-10 px-6 py-4 border-t border-slate-200 flex justify-end gap-2 bg-slate-50">
              <button type="button" onClick={()=>setShowModal(false)} className="h-10 px-4 rounded-lg border border-slate-300">Cancel</button>
              <button className="h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white">{editing? 'Update' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}

      {showDeleteModal && toDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={()=>setShowDeleteModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="bg-red-600 text-white px-6 py-3 flex items-center justify-between">
              <div className="font-semibold">Delete Supplier</div>
              <button onClick={()=>setShowDeleteModal(false)} className="text-white/90 hover:text-white"><FiX/></button>
            </div>
            <div className="p-6 text-sm">
              Are you sure you want to delete <b>{toDelete.supplierName}</b>?
            </div>
            <div className="sticky bottom-0 px-6 py-4 flex justify-end gap-2 bg-slate-50">
              <button onClick={()=>setShowDeleteModal(false)} className="h-9 px-3 rounded-lg border border-slate-300">Cancel</button>
              <button onClick={doDelete} className="h-9 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
