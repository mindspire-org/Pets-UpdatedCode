import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiCalendar, FiPackage, FiHome, FiTool, FiMonitor, FiHeart, FiDownload, FiDollarSign } from 'react-icons/fi'
import { MdLocalHospital, MdBed, MdDoorFront, MdChair } from 'react-icons/md'
import { hospitalInventoryAPI, suppliersAPI } from '../../services/api'
import DateRangePicker from '../../components/DateRangePicker'

const CATEGORIES = [
  { value: 'furniture', label: 'Furniture', icon: MdChair, color: 'blue' },
  { value: 'medical_equipment', label: 'Medical Equipment', icon: FiHeart, color: 'red' },
  { value: 'electronics', label: 'Electronics', icon: FiMonitor, color: 'purple' },
  { value: 'infrastructure', label: 'Infrastructure', icon: MdDoorFront, color: 'green' },
  { value: 'beds', label: 'Beds & Bedding', icon: MdBed, color: 'indigo' },
  { value: 'tools', label: 'Tools & Utilities', icon: FiTool, color: 'orange' },
  { value: 'other', label: 'Other Items', icon: FiPackage, color: 'gray' }
]

const CONDITIONS = [
  { value: 'excellent', label: 'Excellent', color: 'emerald' },
  { value: 'good', label: 'Good', color: 'blue' },
  { value: 'fair', label: 'Fair', color: 'yellow' },
  { value: 'poor', label: 'Poor', color: 'orange' },
  { value: 'damaged', label: 'Damaged', color: 'red' }
]

export default function HospitalInventory() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterCondition, setFilterCondition] = useState('all')
  const [dateRange, setDateRange] = useState({
    fromDate: new Date().toISOString().slice(0,10),
    toDate: new Date().toISOString().slice(0,10)
  })

  const [form, setForm] = useState({
    itemName: '',
    category: 'furniture',
    description: '',
    quantity: 1,
    condition: 'good',
    location: '',
    purchaseDate: new Date().toISOString().slice(0,10),
    purchasePrice: '',
    supplier: '',
    warrantyExpiry: '',
    serialNumber: '',
    notes: ''
  })
  const [suppliers, setSuppliers] = useState([])
  const [useOtherSupplier, setUseOtherSupplier] = useState(false)
  const supplierNames = useMemo(() => suppliers.map(s => s.supplierName), [suppliers])
  useEffect(() => {
    setUseOtherSupplier(Boolean(form.supplier) && !supplierNames.includes(form.supplier))
  }, [form.supplier, supplierNames])

  useEffect(() => {
    loadInventory()
    loadSuppliers()
  }, [])

  const loadInventory = async () => {
    try {
      setLoading(true)
      const response = await hospitalInventoryAPI.getAll()
      setItems(response.data || [])
    } catch (error) {
      console.error('Error loading hospital inventory:', error)
      // Fallback to localStorage
      const stored = localStorage.getItem('hospital_inventory')
      if (stored) {
        setItems(JSON.parse(stored))
      }
    } finally {
      setLoading(false)
    }
  }
  const loadSuppliers = async () => {
    try {
      const res = await suppliersAPI.getAll('admin')
      const list = res?.data || []
      setSuppliers(list)
    } catch (error) {
      setSuppliers([])
    }
  }

  // Date filtering function
  const isDateInRange = (dateStr) => {
    if (!dateStr) return false
    const date = new Date(dateStr).toISOString().slice(0,10)
    return date >= dateRange.fromDate && date <= dateRange.toDate
  }
  
  const handleDateRangeChange = useCallback((newDateRange) => {
    setDateRange(newDateRange)
  }, [])

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = !searchQuery || 
        item.itemName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.location?.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesCategory = filterCategory === 'all' || item.category === filterCategory
      const matchesCondition = filterCondition === 'all' || item.condition === filterCondition
      const matchesDate = isDateInRange(item.purchaseDate || item.createdAt)
      
      return matchesSearch && matchesCategory && matchesCondition && matchesDate
    })
  }, [items, searchQuery, filterCategory, filterCondition, dateRange.fromDate, dateRange.toDate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      
      // Generate a unique ID if this is a new item
      const itemId = editingId || `item-${Date.now()}`
      
      const itemData = {
        ...form,
        id: itemId,  // Add the ID to the item data
        itemName: form.itemName,
        category: form.category,
        quantity: parseInt(form.quantity),
        price: parseFloat(form.purchasePrice) || 0,  // Map purchasePrice to price for backend
        purchasePrice: parseFloat(form.purchasePrice) || 0,  // Keep for frontend
        status: 'In Stock',  // Add default status
        department: 'admin',  // Must be one of: 'admin', 'lab', 'pharmacy', 'shop'
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      if (editingId) {
        await hospitalInventoryAPI.update(editingId, itemData)
        setItems(prev => prev.map(item => 
          (item.id === editingId || item._id === editingId) ? { ...itemData, id: editingId } : item
        ))
      } else {
        const response = await hospitalInventoryAPI.create(itemData)
        setItems(prev => [...prev, { ...response.data, id: itemId }])
      }

      // Update localStorage as backup
      const updatedItems = editingId 
        ? items.map(item => (item.id === editingId || item._id === editingId) ? { ...itemData, id: editingId } : item)
        : [...items, { ...itemData, id: Date.now() }]
      localStorage.setItem('hospital_inventory', JSON.stringify(updatedItems))

      resetForm()
    } catch (error) {
      console.error('Error saving inventory item:', error)
      alert('Error saving item. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (item) => {
    const rawPurchaseDate = item.purchaseDate || item.createdAt || item.updatedAt || ''
    setForm({
      itemName: item.itemName || '',
      category: item.category || 'furniture',
      description: item.description || '',
      quantity: item.quantity || 1,
      condition: item.condition || 'good',
      location: item.location || '',
      purchaseDate: rawPurchaseDate ? new Date(rawPurchaseDate).toISOString().slice(0,10) : new Date().toISOString().slice(0,10),
      purchasePrice: item.price || item.purchasePrice || '', // Use price or fallback to purchasePrice
      supplier: item.supplier || '',
      warrantyExpiry: item.warrantyExpiry?.slice(0,10) || '',
      serialNumber: item.serialNumber || '',
      notes: item.notes || ''
    })
    setEditingId(item.id || item._id)
    setShowForm(true)
  }

  const openDeleteConfirm = (item) => {
    setDeleteTarget(item)
    setShowDeleteConfirm(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    try {
      setLoading(true)
      const id = deleteTarget.id || deleteTarget._id
      await hospitalInventoryAPI.delete(id)
      setItems(prev => {
        const updated = prev.filter(item => item.id !== id && item._id !== id)
        localStorage.setItem('hospital_inventory', JSON.stringify(updated))
        return updated
      })
    } catch (error) {
      console.error('Error deleting item:', error)
      alert('Error deleting item. Please try again.')
    } finally {
      setLoading(false)
      setShowDeleteConfirm(false)
      setDeleteTarget(null)
    }
  }

  const resetForm = () => {
    setForm({
      itemName: '',
      category: 'furniture',
      description: '',
      quantity: 1,
      condition: 'good',
      location: '',
      purchaseDate: new Date().toISOString().slice(0,10),
      purchasePrice: '',
      supplier: '',
      warrantyExpiry: '',
      serialNumber: '',
      notes: ''
    })
    setEditingId(null)
    setUseOtherSupplier(false)
    setShowForm(false)
  }

  const exportCSV = () => {
    const headers = ['Item Name', 'Category', 'Quantity', 'Condition', 'Location', 'Purchase Date', 'Price', 'Supplier']
    const rows = filteredItems.map(item => [
      item.itemName,
      item.category,
      item.quantity,
      item.condition,
      item.location,
      item.purchaseDate,
      (item.price ?? item.purchasePrice ?? 0),
      item.supplier
    ])
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hospital-inventory-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getCategoryIcon = (category) => {
    const cat = CATEGORIES.find(c => c.value === category)
    return cat ? cat.icon : FiPackage
  }

  const getCategoryColor = (category) => {
    const cat = CATEGORIES.find(c => c.value === category)
    return cat ? cat.color : 'gray'
  }

  const getConditionColor = (condition) => {
    const cond = CONDITIONS.find(c => c.value === condition)
    return cond ? cond.color : 'gray'
  }

  const totalValue = filteredItems.reduce((sum, item) => {
    const price = Number(item.price ?? item.purchasePrice ?? 0)
    const qty = Number(item.quantity ?? 0)
    return sum + (price * qty)
  }, 0)
  const totalItems = filteredItems.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Hospital Inventory Management
          </h1>
          <p className="text-slate-600 mt-1">Manage hospital equipment, furniture, and infrastructure</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
        >
          <FiPlus className="w-5 h-5" />
          Add Item
        </button>
      </div>

      {/* Date Range Filter */}
      <div className="rounded-2xl bg-gradient-to-br from-white via-indigo-50 to-purple-50 shadow-xl ring-1 ring-indigo-200 border border-indigo-100 p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <FiCalendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-indigo-600">Filter by Purchase Date</div>
              <div className="text-lg font-bold text-slate-800">
                {dateRange.fromDate === dateRange.toDate 
                  ? new Date(dateRange.fromDate).toLocaleDateString()
                  : `${new Date(dateRange.fromDate).toLocaleDateString()} - ${new Date(dateRange.toDate).toLocaleDateString()}`
                }
              </div>
            </div>
          </div>
          
          <DateRangePicker 
            onDateChange={handleDateRangeChange}
            defaultFromDate={dateRange.fromDate}
            defaultToDate={dateRange.toDate}
            showAllButton={true}
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
              <FiPackage className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-800">{filteredItems.length}</div>
              <div className="text-sm text-slate-600">Total Items</div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
              <FiHome className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-800">{totalItems}</div>
              <div className="text-sm text-slate-600">Total Quantity</div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-6 border border-purple-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center">
              <MdLocalHospital className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-800">{CATEGORIES.length}</div>
              <div className="text-sm text-slate-600">Categories</div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-6 border border-orange-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center">
              <FiDollarSign className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-800">Rs. {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="text-sm text-slate-600">Total Value</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-xl shadow-lg ring-1 ring-slate-200 p-6">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>

            <select
              value={filterCondition}
              onChange={(e) => setFilterCondition(e.target.value)}
              className="px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Conditions</option>
              {CONDITIONS.map(cond => (
                <option key={cond.value} value={cond.value}>{cond.label}</option>
              ))}
            </select>
          </div>

          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
          >
            <FiDownload className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map(item => {
          const CategoryIcon = getCategoryIcon(item.category)
          const categoryColor = getCategoryColor(item.category)
          const conditionColor = getConditionColor(item.condition)
          
          return (
            <div key={item.id || item._id} className="bg-white rounded-xl shadow-lg ring-1 ring-slate-200 p-6 hover:shadow-xl transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 bg-${categoryColor}-100 rounded-xl flex items-center justify-center`}>
                  <CategoryIcon className={`w-6 h-6 text-${categoryColor}-600`} />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(item)}
                    className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                  >
                    <FiEdit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openDeleteConfirm(item)}
                    className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-slate-800 mb-2">{item.itemName}</h3>
              <p className="text-slate-600 text-sm mb-3 line-clamp-2">{item.description}</p>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Quantity:</span>
                  <span className="font-medium">{item.quantity}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Location:</span>
                  <span className="font-medium">{item.location}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Purchase Date:</span>
                  <span className="font-medium">{(() => { const dateVal = item.purchaseDate || item.createdAt; if (!dateVal) return '-'; const d = new Date(dateVal); return isNaN(d.getTime()) ? '-' : d.toLocaleDateString(); })()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Price:</span>
                  <span className="font-medium">
                    Rs. {item.price !== undefined ? 
                      Number(item.price).toFixed(2) : 
                      item.purchasePrice !== undefined ? 
                        Number(item.purchasePrice).toFixed(2) : 
                        '0.00'}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold bg-${conditionColor}-100 text-${conditionColor}-700`}>
                  {item.condition}
                </span>
                <span className="text-xs text-slate-500">
                  {CATEGORIES.find(c => c.value === item.category)?.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-12">
          <FiPackage className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">No inventory items found</p>
          <p className="text-slate-400 text-sm">Add your first item or adjust your filters</p>
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-800">
                {editingId ? 'Edit Item' : 'Add New Item'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Item Name *</label>
                  <input
                    type="text"
                    required
                    value={form.itemName}
                    onChange={(e) => setForm({...form, itemName: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g., Hospital Bed, Office Chair"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Category *</label>
                  <select
                    required
                    value={form.category}
                    onChange={(e) => setForm({...form, category: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({...form, description: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Detailed description of the item"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Quantity *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={form.quantity}
                    onChange={(e) => setForm({...form, quantity: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Condition *</label>
                  <select
                    required
                    value={form.condition}
                    onChange={(e) => setForm({...form, condition: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    {CONDITIONS.map(cond => (
                      <option key={cond.value} value={cond.value}>{cond.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Location *</label>
                  <input
                    type="text"
                    required
                    value={form.location}
                    onChange={(e) => setForm({...form, location: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g., Room 101, Reception Area"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Purchase Date</label>
                  <input
                    type="date"
                    value={form.purchaseDate}
                    onChange={(e) => setForm({...form, purchaseDate: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Price (Rs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.purchasePrice}
                    onChange={(e) => {
                      // Ensure proper number parsing with 2 decimal places
                      const value = e.target.value;
                      if (value === '') {
                        setForm({...form, purchasePrice: ''});
                      } else {
                        const num = parseFloat(value);
                        if (!isNaN(num)) {
                          setForm({...form, purchasePrice: num.toFixed(2)});
                        }
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Supplier</label>
                  <select
                    value={useOtherSupplier ? '__other__' : (form.supplier || '')}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === '__other__') {
                        setUseOtherSupplier(true)
                        if (supplierNames.includes(form.supplier)) {
                          setForm({ ...form, supplier: '' })
                        }
                      } else {
                        setUseOtherSupplier(false)
                        setForm({ ...form, supplier: val })
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map(s => (
                      <option key={s._id} value={s.supplierName}>{s.supplierName}</option>
                    ))}
                    <option value="__other__">Other (type manually)</option>
                  </select>
                  {useOtherSupplier && (
                    <input
                      type="text"
                      value={form.supplier}
                      onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                      className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Enter supplier name"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Warranty Expiry</label>
                  <input
                    type="date"
                    value={form.warrantyExpiry}
                    onChange={(e) => setForm({...form, warrantyExpiry: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Serial Number</label>
                  <input
                    type="text"
                    value={form.serialNumber}
                    onChange={(e) => setForm({...form, serialNumber: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Serial/Model number"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({...form, notes: e.target.value})}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Additional notes or comments"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-all duration-200 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : (editingId ? 'Update Item' : 'Add Item')}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-3 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirm && deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-800">Delete Item</h2>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-slate-700">
                Are you sure you want to delete <span className="font-semibold">{deleteTarget.itemName}</span>?
              </p>
              <p className="text-sm text-slate-500">
                This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-3 px-6 pb-6">
              <button
                type="button"
                onClick={() => { setShowDeleteConfirm(false); setDeleteTarget(null) }}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
