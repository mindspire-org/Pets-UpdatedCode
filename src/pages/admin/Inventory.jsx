import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { FiPackage, FiAlertTriangle, FiClock, FiDollarSign, FiDownload, FiSearch, FiTrendingUp, FiCalendar } from 'react-icons/fi'
import { MdLocalPharmacy } from 'react-icons/md'
import { TbMicroscope } from 'react-icons/tb'
import { FiShoppingCart } from 'react-icons/fi'
import { inventoryAPI, productsAPI, pharmacyMedicinesAPI } from '../../services/api'
import DateRangePicker from '../../components/DateRangePicker'

export default function Inventory(){
  const [items, setItems] = useState([])
  const [shopProducts, setShopProducts] = useState([])
  const [pharmacyMedicines, setPharmacyMedicines] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({
    fromDate: new Date().toISOString().slice(0,10),
    toDate: new Date().toISOString().slice(0,10)
  })
  
  // Load inventory from MongoDB
  useEffect(()=>{
    loadInventory()
  }, [])

  const loadInventory = async () => {
    try {
      setLoading(true)
      const [inventoryRes, productsRes, medicinesRes] = await Promise.all([
        inventoryAPI.getAll().catch(() => ({ data: [] })),
        productsAPI.getAll().catch(() => ({ data: [] })),
        pharmacyMedicinesAPI.getAll().catch(() => ({ data: [] }))
      ])
      setItems(inventoryRes.data || [])
      setShopProducts(productsRes.data || [])
      setPharmacyMedicines(medicinesRes.data || [])
    } catch (err) {
      console.error('Error loading inventory:', err)
    } finally {
      setLoading(false)
    }
  }
  const [q, setQ] = useState('')
  const [filterType, setFilterType] = useState('All')
  
  // Date filtering function
  const isDateInRange = (dateStr) => {
    if (!dateStr) return false
    const date = new Date(dateStr).toISOString().slice(0,10)
    return date >= dateRange.fromDate && date <= dateRange.toDate
  }
  
  const handleDateRangeChange = useCallback((newDateRange) => {
    setDateRange(newDateRange)
  }, [])

  const isExpiringSoon = (dateStr) => {
    if (!dateStr || dateStr === '-') return false
    const now = new Date()
    const target = new Date(dateStr)
    const diffDays = (target - now) / (1000*60*60*24)
    return diffDays <= 60
  }

  // Merge inventory items with shop products and pharmacy medicines
  const allItems = useMemo(() => {
    // Convert shop products to inventory format
    const shopItems = shopProducts.map(product => ({
      id: product._id,
      type: 'Shop',
      name: product.itemName,
      qty: product.quantity,
      min: product.lowStockThreshold || 10,
      expiry: '-', // Shop products don't have expiry
      price: product.salePrice,
      category: product.category,
      barcode: product.barcode,
      supplier: product.supplier,
      createdAt: product.createdAt || product.updatedAt || new Date().toISOString(),
      lastUpdated: product.updatedAt || product.createdAt || new Date().toISOString()
    }))
    
    // Convert pharmacy medicines to inventory format
    const pharmacyItems = pharmacyMedicines.map(medicine => ({
      id: medicine._id,
      type: 'Pharmacy',
      name: medicine.medicineName,
      qty: medicine.quantity,
      min: medicine.lowStockThreshold || 10,
      expiry: medicine.expiryDate,
      price: medicine.salePrice,
      category: medicine.category,
      barcode: medicine.barcode,
      supplier: medicine.supplierName,
      batchNo: medicine.batchNo,
      unit: medicine.unit,
      containerType: medicine.containerType,
      mlPerVial: medicine.mlPerVial,
      remainingMl: medicine.remainingMl,
      createdAt: medicine.createdAt || medicine.updatedAt || new Date().toISOString(),
      lastUpdated: medicine.updatedAt || medicine.createdAt || new Date().toISOString()
    }))
    
    // Convert lab inventory items to proper format
    const labItems = items.filter(item => item.department === 'lab').map(item => ({
      id: item._id || item.id,
      type: 'Laboratory',
      name: item.itemName,
      qty: item.quantity,
      min: item.minStockLevel || 10,
      expiry: item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : '-',
      price: item.price || item.purchasePrice || 0,
      category: item.category,
      supplier: item.supplier,
      status: item.status,
      createdAt: item.createdAt || item.updatedAt || new Date().toISOString(),
      lastUpdated: item.updatedAt || item.createdAt || new Date().toISOString()
    }))
    
    // Include other inventory items (non-lab)
    const otherItems = items.filter(item => item.department !== 'lab').map(item => ({
      id: item._id || item.id,
      type: item.department ? item.department.charAt(0).toUpperCase() + item.department.slice(1) : 'General',
      name: item.itemName,
      qty: item.quantity,
      min: item.minStockLevel || 10,
      expiry: item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : '-',
      price: item.price || item.purchasePrice || 0,
      category: item.category,
      supplier: item.supplier,
      status: item.status,
      createdAt: item.createdAt || item.updatedAt || new Date().toISOString(),
      lastUpdated: item.updatedAt || item.createdAt || new Date().toISOString()
    }))
    
    return [...otherItems, ...shopItems, ...pharmacyItems, ...labItems]
  }, [items, shopProducts, pharmacyMedicines])

  const filtered = useMemo(()=> {
    return allItems.filter(x => {
      const matchesText = q ? (x.type + x.name + (x.category || '') + (x.supplier || '')).toLowerCase().includes(q.toLowerCase()) : true
      const matchesType = filterType === 'All' ? true : x.type === filterType
      return matchesText && matchesType
    })
  }, [allItems, q, filterType])

  const totals = useMemo(() => {
    const totalItems = filtered.length
    const lowStock = filtered.filter(x => x.qty <= x.min).length
    const expiringSoon = filtered.filter(x => isExpiringSoon(x.expiry)).length
    const inventoryValue = filtered.reduce((acc, x) => acc + (x.qty * (x.price || 0)), 0)
    return { totalItems, lowStock, expiringSoon, inventoryValue }
  }, [filtered])

  

  const exportCSV = () => {
    const headers = [
      'Type',
      'Item',
      'Category',
      'Quantity',
      'Min Stock',
      'Expiry',
      'Status',
      'Price (Rs.)',
      'Supplier',
      'Barcode',
      'Batch No',
      'Unit',
      'ML Per Container',
      'Remaining Ml',
      'Created At',
      'Last Updated'
    ]

    const formatDate = (value) => {
      if (!value) return ''
      const d = new Date(value)
      if (isNaN(d.getTime())) return value
      return d.toISOString().slice(0,10)
    }

    const escapeCsvValue = (value) => {
      if (value === null || value === undefined) return '""'
      const str = String(value).replace(/"/g, '""')
      return `"${str}"`
    }

    const rows = filtered.map(x => {
      const status =
        x.qty <= x.min
          ? 'Low Stock'
          : isExpiringSoon(x.expiry)
            ? 'Expiring Soon'
            : 'OK'

      const price =
        typeof x.price === 'number'
          ? x.price.toFixed(2)
          : (x.price ?? '')

      return [
        x.type,
        x.name,
        x.category || '',
        x.qty,
        x.min,
        x.expiry,
        status,
        price,
        x.supplier || '',
        x.barcode || '',
        x.batchNo || '',
        x.unit || '',
        x.mlPerVial || '',
        x.remainingMl || '',
        formatDate(x.createdAt || x.lastUpdated),
        formatDate(x.lastUpdated || x.createdAt)
      ]
    })

    const csvContent = [
      headers.map(escapeCsvValue).join(','),
      ...rows.map(row => row.map(escapeCsvValue).join(',')),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'inventory.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Professional Header */}
      <div className="text-center mb-6">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">Inventory Management</h1>
        <p className="text-slate-600 text-lg">Track stock across Pharmacy, Laboratory and Shop</p>
      </div>

      {/* Date Range Filter */}
      <div className="rounded-2xl bg-gradient-to-br from-white via-indigo-50 to-purple-50 shadow-xl ring-1 ring-indigo-200 border border-indigo-100 p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <FiCalendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-indigo-600">Filter by Stock Movement Date</div>
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

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <div className="text-slate-500 font-medium">Loading inventory data...</div>
        </div>
      ) : (
      <>

      {/* Animated Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="rounded-2xl bg-gradient-to-br from-indigo-50 via-blue-50 to-cyan-50 shadow-xl ring-1 ring-indigo-200/70 p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 group cursor-pointer">
          <div className="flex items-center justify-between mb-3">
            <div className="w-14 h-14 rounded-xl bg-indigo-500 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <FiPackage className="w-7 h-7 text-white" />
            </div>
            <div className="text-xs font-semibold text-indigo-600 bg-indigo-100 px-2 py-1 rounded-full">Active</div>
          </div>
          <div>
            <div className="text-sm font-medium text-slate-600 mb-1">Total Items</div>
            <div className="text-3xl font-bold text-slate-900">{totals.totalItems}</div>
          </div>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 shadow-xl ring-1 ring-amber-200/70 p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 group cursor-pointer">
          <div className="flex items-center justify-between mb-3">
            <div className="w-14 h-14 rounded-xl bg-amber-500 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <FiAlertTriangle className="w-7 h-7 text-white" />
            </div>
            {totals.lowStock > 0 && <div className="text-xs font-semibold text-amber-600 bg-amber-100 px-2 py-1 rounded-full">Alert</div>}
          </div>
          <div>
            <div className="text-sm font-medium text-slate-600 mb-1">Low Stock Alerts</div>
            <div className="text-3xl font-bold text-amber-700">{totals.lowStock}</div>
          </div>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-rose-50 via-red-50 to-pink-50 shadow-xl ring-1 ring-rose-200/70 p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 group cursor-pointer">
          <div className="flex items-center justify-between mb-3">
            <div className="w-14 h-14 rounded-xl bg-rose-500 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <FiClock className="w-7 h-7 text-white" />
            </div>
            {totals.expiringSoon > 0 && <div className="text-xs font-semibold text-rose-600 bg-rose-100 px-2 py-1 rounded-full">Urgent</div>}
          </div>
          <div>
            <div className="text-sm font-medium text-slate-600 mb-1">Expiring Soon</div>
            <div className="text-3xl font-bold text-rose-700">{totals.expiringSoon}</div>
          </div>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 shadow-xl ring-1 ring-emerald-200/70 p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 group cursor-pointer">
          <div className="flex items-center justify-between mb-3">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <FiDollarSign className="w-7 h-7 text-white" />
            </div>
            <div className="text-xs font-semibold text-green-600 bg-green-100 px-2 py-1 rounded-full flex items-center gap-1">
              <FiTrendingUp className="w-3 h-3" /> Value
            </div>
          </div>
          <div>
            <div className="text-sm font-medium text-slate-600 mb-1">Inventory Value</div>
            <div className="text-3xl font-bold text-slate-900">Rs. {totals.inventoryValue.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="rounded-2xl bg-white shadow-xl ring-1 ring-slate-200/70 p-6 hover:shadow-2xl transition-shadow duration-300">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="flex gap-3">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input className="h-10 pl-10 pr-3 rounded-lg border-2 border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 w-56 transition-all" placeholder="Search items" value={q} onChange={e=>setQ(e.target.value)} />
            </div>
            <select className="h-10 px-3 rounded-lg border-2 border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 w-40 transition-all" value={filterType} onChange={e=>setFilterType(e.target.value)}>
              <option>All</option>
              <option>Pharmacy</option>
              <option>Laboratory</option>
              <option>Shop</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={exportCSV} className="px-4 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-all flex items-center gap-2">
              <FiDownload className="w-4 h-4" /> Export
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-600 bg-slate-50">
                <th className="py-3 px-4 font-semibold">Type</th>
                <th className="py-3 px-4 font-semibold">Item</th>
                <th className="py-3 px-4 font-semibold">Quantity</th>
                <th className="py-3 px-4 font-semibold">Min</th>
                <th className="py-3 px-4 font-semibold">Expiry</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Price</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(x => {
                const low = x.qty <= x.min
                const soon = isExpiringSoon(x.expiry)
                const typeIcon = x.type === 'Pharmacy' ? <MdLocalPharmacy className="w-4 h-4" /> : x.type === 'Laboratory' ? <TbMicroscope className="w-4 h-4" /> : <FiShoppingCart className="w-4 h-4" />
                return (
                  <tr key={x.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <span className={
                        `px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 w-fit ` +
                        (x.type === 'Pharmacy' ? 'bg-violet-100 text-violet-700' : x.type === 'Laboratory' ? 'bg-cyan-100 text-cyan-700' : 'bg-emerald-100 text-emerald-700')
                      }>
                        {typeIcon}
                        {x.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{x.name}</td>
                    <td className="py-3 px-4 font-medium">
                      {x.category === 'Injection' ? (
                        <div>
                          <div>
                            {x.qty} {(() => { const c = x.containerType || 'Vial'; return c.endsWith('s') ? c : `${c}s`; })()}
                          </div>
                          <div className="text-xs text-slate-500">{x.mlPerVial || 0} ml per {x.containerType || 'Vial'}</div>
                          <div className="text-xs text-blue-600 font-medium">
                            Remaining: {x.remainingMl || x.mlPerVial || 0} ml
                          </div>
                        </div>
                      ) : (
                        `${x.qty} ${x.unit || ''}`
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{x.min}</td>
                    <td className="py-3 px-4 text-slate-600">{x.expiry}</td>
                    <td className="py-3 px-4">
                      {low ? (
                        <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-100 text-amber-700 flex items-center gap-1.5 w-fit">
                          <FiAlertTriangle className="w-3 h-3" /> Low Stock
                        </span>
                      ) : soon ? (
                        <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-100 text-rose-700 flex items-center gap-1.5 w-fit">
                          <FiClock className="w-3 h-3" /> Expiring Soon
                        </span>
                      ) : (
                        <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-700 w-fit">OK</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">Rs {x.price?.toLocaleString?.() ?? '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}
    </div>
  )
}
