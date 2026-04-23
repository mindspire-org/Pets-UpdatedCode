import React, { useState, useEffect } from 'react';
import { 
  FiPlus, FiSearch, FiFileText, FiTrash2, FiEdit2, FiX, 
  FiCheck, FiDownload, FiSend, FiClock, FiAlertCircle, FiPrinter 
} from 'react-icons/fi';
import * as XLSX from 'xlsx';
import { 
  purchaseOrdersAPI, 
  suppliersAPI, 
  pharmacyMedicinesAPI,
  companiesAPI 
} from '../../services/api';

export default function PurchaseOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [limit, setLimit] = useState(10);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [activeItemIndex, setActiveItemIndex] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [printingOrder, setPrintingOrder] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const authData = localStorage.getItem('pharmacy_auth');
    if (authData) {
      try {
        const user = JSON.parse(authData);
        setCurrentUser(user);
      } catch (err) {
        console.error('Error parsing auth data:', err);
      }
    }
  }, []);

  const [formData, setFormData] = useState({
    poNumber: '',
    date: new Date().toISOString().split('T')[0],
    expectedDelivery: '',
    companyName: 'Abbottabad Pet Hospital',
    deliveryAddress: 'Pharmacy Department',
    supplierId: '',
    supplierName: '',
    supplierPhone: '',
    items: [],
    notes: '',
    terms: '',
    authorizedBy: '',
    status: 'Pending'
  });

  const [companies, setCompanies] = useState([]);

  useEffect(() => {
    fetchOrders();
    fetchSuppliers();
    fetchMedicines();
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const res = await companiesAPI.getAll('pharmacy');
      setCompanies(res.data || []);
    } catch (err) {
      console.error('Error fetching companies:', err);
    }
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await purchaseOrdersAPI.getAll();
      setOrders(res.data || []);
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await suppliersAPI.getAll('pharmacy');
      setSuppliers(res.data || []);
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    }
  };

  const fetchMedicines = async () => {
    try {
      const res = await pharmacyMedicinesAPI.getAll();
      setMedicines(res.data || []);
    } catch (err) {
      console.error('Error fetching medicines:', err);
    }
  };

  const handleMedicineSearch = (term, index) => {
    setActiveItemIndex(index);
    updateItem(index, 'medicineName', term);
    
    if (term.trim().length > 1) {
      const filtered = medicines.filter(m => 
        m.medicineName.toLowerCase().includes(term.toLowerCase())
      );
      setSearchResults(filtered);
    } else {
      setSearchResults([]);
    }
  };

  const addItem = () => {
    const newItem = {
      medicineId: '',
      medicineName: '',
      category: '',
      quantity: 1,
      unit: 'packs'
    };
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  const selectMedicine = (med, index) => {
    updateItem(index, 'medicineId', med._id);
    updateItem(index, 'medicineName', med.medicineName);
    updateItem(index, 'category', med.category || '');
    updateItem(index, 'unit', med.unit || 'packs');
    setSearchResults([]);
    setActiveItemIndex(null);
  };

  const removeItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateItem = (index, field, value) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, items: newItems };
    });
  };

  const handleSupplierChange = async (e) => {
    const supplierId = e.target.value;
    const supplier = suppliers.find(s => s._id === supplierId);
    if (supplier) {
      let companyName = '';
      if (supplier.companyId) {
        const found = companies.find(c => c._id === supplier.companyId);
        if (found) companyName = found.companyName;
      }

      setFormData(prev => ({
        ...prev,
        supplierId: supplier._id,
        supplierName: supplier.supplierName || supplier.name,
        supplierPhone: supplier.phone || '',
        companyName: companyName || prev.companyName
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await purchaseOrdersAPI.update(currentOrder._id, formData);
      } else {
        await purchaseOrdersAPI.create(formData);
      }
      setShowAddModal(false);
      resetForm();
      fetchOrders();
    } catch (err) {
      console.error('Error saving order:', err);
      alert('Error saving order');
    }
  };

  const handleEdit = (order) => {
    setIsEditing(true);
    setCurrentOrder(order);
    setFormData({
      ...order,
      date: new Date(order.date).toISOString().split('T')[0],
      expectedDelivery: order.expectedDelivery ? new Date(order.expectedDelivery).toISOString().split('T')[0] : ''
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this order?')) return;
    try {
      await purchaseOrdersAPI.delete(id);
      fetchOrders();
    } catch (err) {
      console.error('Error deleting order:', err);
    }
  };

  const [showStatusDropdown, setShowStatusDropdown] = useState(null);

  const statusOptions = ['Pending', 'Sent', 'Completed', 'Delivered', 'Cancelled'];

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const order = orders.find(o => o._id === orderId);
      if (!order) return;
      
      // Ensure we preserve existing fields but only update status
      const updateData = {
        ...order,
        status: newStatus,
        // Ensure date fields are properly formatted strings for the API if they are objects
        date: new Date(order.date).toISOString(),
        expectedDelivery: order.expectedDelivery ? new Date(order.expectedDelivery).toISOString() : undefined
      };
      
      await purchaseOrdersAPI.update(orderId, updateData);
      fetchOrders();
      setShowStatusDropdown(null);
    } catch (err) {
      console.error('Error updating status:', err);
      // More detailed error logging
      if (err.response) {
        console.error('API Error details:', err.response.data);
      }
      alert('Failed to update status. Please check console for details.');
    }
  };

  const confirmDelete = (order) => {
    setOrderToDelete(order);
    setShowDeleteModal(true);
  };

  const executeDelete = async () => {
    if (!orderToDelete) return;
    try {
      await purchaseOrdersAPI.delete(orderToDelete._id);
      fetchOrders();
      setShowDeleteModal(false);
      setOrderToDelete(null);
    } catch (err) {
      console.error('Error deleting order:', err);
      alert('Failed to delete order');
    }
  };

  const handleDownload = (order) => {
    try {
      const exportData = order.items.map(item => ({
        'Item Name': item.medicineName,
        'Category': item.category,
        'Quantity': item.quantity,
        'Unit': item.unit
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Purchase Order");

      // Add header info
      XLSX.utils.sheet_add_aoa(ws, [
        ["Purchase Order", order.poNumber],
        ["Date", new Date(order.date).toLocaleDateString()],
        ["Supplier", order.supplierName],
        ["Phone", order.supplierPhone],
        ["", ""], // spacer
      ], { origin: "A1" });

      XLSX.writeFile(wb, `${order.poNumber}_PurchaseOrder.xlsx`);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed');
    }
  };

  const handleSend = async (order) => {
    if (order.status !== 'Pending') return;
    try {
      await purchaseOrdersAPI.update(order._id, { ...order, status: 'Sent' });
      fetchOrders();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const handlePrint = (order) => {
    setPrintingOrder(order);
    setShowPrintModal(true);
  };

  const PrintView = ({ order }) => (
    <div id="printable-po" className="p-8 bg-white text-slate-800">
      <div className="flex justify-between items-start border-b-2 border-slate-800 pb-6 mb-8">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900 mb-1">Purchase Order</h1>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">{order.poNumber}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-12 mb-10">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Supplier Information</h3>
          <p className="font-bold text-slate-800 text-lg">{order.supplierName}</p>
          <p className="text-sm text-slate-700 font-bold">{order.companyName}</p>
          <p className="text-sm text-slate-500 font-medium">{order.supplierPhone}</p>
          
          <div className="mt-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Delivery Address</h3>
            <p className="text-sm text-slate-600 font-medium leading-tight">{order.deliveryAddress}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="space-y-1">
            <p className="text-sm font-bold"><span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-2">Order Date:</span> {new Date(order.date).toLocaleDateString()}</p>
            {order.expectedDelivery && (
              <p className="text-sm font-bold"><span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-2">Expected Delivery:</span> {new Date(order.expectedDelivery).toLocaleDateString()}</p>
            )}
          </div>
        </div>
      </div>

      <table className="w-full mb-10">
        <thead>
          <tr className="border-b-2 border-slate-800">
            <th className="py-3 text-left text-[10px] font-black uppercase tracking-widest">#</th>
            <th className="py-3 text-left text-[10px] font-black uppercase tracking-widest">Description / Item Name</th>
            <th className="py-3 text-left text-[10px] font-black uppercase tracking-widest">Category</th>
            <th className="py-3 text-right text-[10px] font-black uppercase tracking-widest">Quantity</th>
            <th className="py-3 text-right text-[10px] font-black uppercase tracking-widest">Unit</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {order.items.map((item, idx) => (
            <tr key={idx}>
              <td className="py-4 text-sm font-bold text-slate-400">{String(idx + 1).padStart(2, '0')}</td>
              <td className="py-4 text-sm font-bold text-slate-800">{item.medicineName}</td>
              <td className="py-4 text-sm font-medium text-slate-500">{item.category}</td>
              <td className="py-4 text-sm font-black text-right">{item.quantity}</td>
              <td className="py-4 text-sm font-bold text-slate-500 text-right uppercase tracking-wider">{item.unit}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {(order.notes || order.terms) && (
        <div className="grid grid-cols-2 gap-12 pt-8 border-t border-slate-100">
          {order.notes && (
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Order Notes</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium bg-slate-50 p-4 rounded-lg">{order.notes}</p>
            </div>
          )}
          {order.terms && (
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Terms & Conditions</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-medium bg-slate-50 p-4 rounded-lg">{order.terms}</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-20 pt-10 flex justify-between items-end border-t border-dashed border-slate-200">
        <div className="text-center">
          <p className="text-sm font-mono mb-2">{currentUser?.name || '...........................'}</p>
          <div className="w-48 border-b-2 border-slate-800 mb-2"></div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Prepared By</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-mono mb-2">{order.authorizedBy || '...........................'}</p>
          <div className="w-48 border-b-2 border-slate-800 mb-2"></div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Authorized Signature</p>
        </div>
      </div>
    </div>
  );

  const handlePrintAction = () => {
    const printContent = document.getElementById('printable-po');
    const winPrint = window.open('', '', 'left=0,top=0,width=900,height=900,toolbar=0,scrollbars=0,status=0');
    
    winPrint.document.write(`
      <html>
        <head>
          <title>Purchase Order - ${printingOrder?.poNumber}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @media print {
              body { padding: 0; margin: 0; }
              #printable-po { width: 100%; box-shadow: none; border: none; }
              .no-print { display: none; }
            }
            body { font-family: sans-serif; }
          </style>
        </head>
        <body class="bg-white">
          <div id="print-wrapper">
            ${printContent.innerHTML}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 800);
            };
          </script>
        </body>
      </html>
    `);
    
    winPrint.document.close();
    winPrint.focus();
  };

  const resetForm = () => {
    setFormData({
      poNumber: '',
      date: new Date().toISOString().split('T')[0],
      expectedDelivery: '',
      companyName: 'Abbottabad Pet Hospital',
      deliveryAddress: 'Pharmacy Department',
      supplierId: '',
      supplierName: '',
      supplierPhone: '',
      items: [],
      notes: '',
      terms: '',
      authorizedBy: '',
      status: 'Pending'
    });
    setIsEditing(false);
    setCurrentOrder(null);
  };

  const filteredOrders = orders.filter(o => 
    o.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.supplierName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending': return 'bg-amber-100 text-amber-600';
      case 'Sent': return 'bg-blue-100 text-blue-600';
      case 'Delivered': return 'bg-indigo-100 text-indigo-600';
      case 'Completed': return 'bg-green-100 text-green-600';
      case 'Received': return 'bg-emerald-100 text-emerald-600';
      case 'Cancelled': return 'bg-red-100 text-red-600';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
            <FiFileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Purchase Orders</h1>
            <p className="text-sm text-slate-500 font-medium">Manage medicine orders from suppliers</p>
          </div>
        </div>
        <button 
          onClick={() => { resetForm(); setShowAddModal(true); }}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-200"
        >
          <FiPlus className="w-5 h-5" /> Create New Order
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-lg">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by PO#, supplier or medicine..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Show:</span>
            <select 
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[10, 25, 50, 100].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                <th className="px-6 py-4 text-left font-bold text-slate-600">PO Number</th>
                <th className="px-6 py-4 text-left font-bold text-slate-600">Date</th>
                <th className="px-6 py-4 text-left font-bold text-slate-600">Supplier</th>
                <th className="px-6 py-4 text-left font-bold text-slate-600">Items</th>
                <th className="px-6 py-4 text-left font-bold text-slate-600">Status</th>
                <th className="px-6 py-4 text-right font-bold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-20 text-center">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <FiFileText className="w-12 h-12 text-slate-200" />
                      <p className="font-bold text-slate-400">No purchase orders found</p>
                      <button 
                        onClick={() => { resetForm(); setShowAddModal(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all"
                      >
                        <FiPlus /> Create New Order
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order) => (
                  <tr key={order._id} className="hover:bg-slate-50 transition-all group">
                    <td className="px-6 py-4 font-bold text-slate-700">{order.poNumber}</td>
                    <td className="px-6 py-4 text-slate-500">{new Date(order.date).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-700">{order.supplierName}</span>
                        <span className="text-xs text-slate-400">{order.supplierPhone}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-medium">{order.items?.length || 0} items</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="relative">
                          <button 
                            onClick={() => setShowStatusDropdown(showStatusDropdown === order._id ? null : order._id)}
                            className={`p-2 rounded-lg transition-all ${showStatusDropdown === order._id ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
                            title="Update Status"
                          >
                            <FiSend className="w-4 h-4" />
                          </button>
                          
                          {showStatusDropdown === order._id && (
                            <>
                              <div 
                                className="fixed inset-0 z-[65]" 
                                onClick={() => setShowStatusDropdown(null)}
                              ></div>
                              <div className="absolute right-0 mt-2 w-40 bg-white border border-slate-200 rounded-xl shadow-2xl z-[70] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                                <div className="p-1.5 space-y-0.5">
                                  <div className="px-3 py-1.5 border-b border-slate-100 mb-1">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Update Status</span>
                                  </div>
                                  {statusOptions.map((status) => (
                                    <button
                                      key={status}
                                      onClick={() => updateOrderStatus(order._id, status)}
                                      className={`w-full text-left px-3 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-colors ${
                                        order.status === status 
                                          ? 'bg-blue-50 text-blue-600' 
                                          : 'text-slate-600 hover:bg-slate-50'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        {status}
                                        {order.status === status && <FiCheck className="w-3 h-3" />}
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}
                        </div>

                        <button 
                          onClick={() => handleDownload(order)}
                          className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all" 
                          title="Download Excel"
                        >
                          <FiDownload className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handlePrint(order)}
                          className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all" 
                          title="Print Purchase Order"
                        >
                          <FiPrinter className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleEdit(order)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><FiEdit2 className="w-4 h-4" /></button>
                        <button onClick={() => confirmDelete(order)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><FiTrash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredOrders.length > itemsPerPage && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/30">
            <p className="text-sm text-slate-500">
              Showing{" "}
              <span className="font-bold text-slate-700">
                {(currentPage - 1) * itemsPerPage + 1}
              </span>{" "}
              –{" "}
              <span className="font-bold text-slate-700">
                {Math.min(currentPage * itemsPerPage, filteredOrders.length)}
              </span>{" "}
              of{" "}
              <span className="font-bold text-slate-700">
                {filteredOrders.length}
              </span>
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Previous
              </button>
              {Array.from(
                { length: Math.ceil(filteredOrders.length / itemsPerPage) },
                (_, i) => i + 1
              )
                .filter((page) => {
                  const total = Math.ceil(filteredOrders.length / itemsPerPage);
                  if (total <= 5) return true;
                  if (page === 1 || page === total) return true;
                  if (page >= currentPage - 1 && page <= currentPage + 1) return true;
                  return false;
                })
                .map((page, idx, arr) => (
                  <React.Fragment key={page}>
                    {idx > 0 && arr[idx - 1] !== page - 1 && (
                      <span className="px-1 text-slate-400 text-xs font-bold">…</span>
                    )}
                    <button
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        currentPage === page
                          ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100"
                          : "border-slate-200 hover:bg-white text-slate-600"
                      }`}
                    >
                      {page}
                    </button>
                  </React.Fragment>
                ))}
              <button
                onClick={() =>
                  setCurrentPage((p) =>
                    Math.min(Math.ceil(filteredOrders.length / itemsPerPage), p + 1)
                  )
                }
                disabled={
                  currentPage >= Math.ceil(filteredOrders.length / itemsPerPage)
                }
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-800">{isEditing ? 'Edit Purchase Order' : 'Create Purchase Order'}</h3>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-white rounded-full transition-all group">
                <FiX className="w-5 h-5 text-slate-400 group-hover:text-slate-600" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b pb-1">Company Information</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">Company Name</label>
                      <input 
                        type="text" 
                        value={formData.companyName}
                        onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">Delivery Address</label>
                      <textarea 
                        rows="2"
                        value={formData.deliveryAddress}
                        onChange={(e) => setFormData({...formData, deliveryAddress: e.target.value})}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 resize-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b pb-1">Supplier Information</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">Select Supplier</label>
                      <select 
                        required
                        value={formData.supplierId}
                        onChange={handleSupplierChange}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500"
                      >
                        <option value="">Search or select supplier name</option>
                        {suppliers.map(s => <option key={s._id} value={s._id}>{s.supplierName || s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">Supplier Phone</label>
                      <input 
                        type="text" 
                        readOnly
                        value={formData.supplierPhone}
                        className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm outline-none text-slate-500 cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b pb-1">Order Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">Order Date</label>
                      <input 
                        type="date" 
                        value={formData.date}
                        onChange={(e) => setFormData({...formData, date: e.target.value})}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">Expected Delivery</label>
                      <input 
                        type="date" 
                        value={formData.expectedDelivery}
                        onChange={(e) => setFormData({...formData, expectedDelivery: e.target.value})}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-1">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Order Items</h4>
                  <button 
                    type="button" 
                    onClick={addItem}
                    className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1 hover:underline"
                  >
                    <FiPlus /> Add Item
                  </button>
                </div>
                
                <div className="space-y-3">
                  <div className="grid grid-cols-12 gap-3 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">
                    <div className="col-span-5">Item Name</div>
                    <div className="col-span-3">Category</div>
                    <div className="col-span-2 text-center">Qty</div>
                    <div className="col-span-1">Unit</div>
                    <div className="col-span-1"></div>
                  </div>

                  <div className="space-y-2">
                    {formData.items.map((item, index) => (
                      <div key={index} className="grid grid-cols-12 gap-3 bg-slate-50 p-2 rounded-lg items-center group animate-in slide-in-from-left-2 duration-200">
                        <div className="col-span-5 relative">
                          <input 
                            type="text" 
                            placeholder="Type to search medicines..."
                            value={item.medicineName}
                            onChange={(e) => handleMedicineSearch(e.target.value, index)}
                            className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-sm font-bold text-slate-700 outline-none focus:border-blue-500"
                          />
                          {activeItemIndex === index && searchResults.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden divide-y divide-slate-100">
                              {searchResults.map(med => (
                                <button 
                                  key={med._id}
                                  type="button"
                                  onClick={() => selectMedicine(med, index)}
                                  className="w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center justify-between group"
                                >
                                  <div className="flex flex-col">
                                    <span className="font-bold text-slate-700 group-hover:text-blue-600 transition-colors">{med.medicineName}</span>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{med.category} • Stock: {med.quantity} {med.unit}</span>
                                  </div>
                                  <FiPlus className="text-slate-300 group-hover:text-blue-500" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="col-span-3">
                          <input 
                            type="text" 
                            placeholder="e.g. Capsule"
                            value={item.category}
                            onChange={(e) => updateItem(index, 'category', e.target.value)}
                            className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-sm outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="col-span-2 text-center">
                          <input 
                            type="number" 
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                            className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-sm text-center font-bold outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="col-span-1">
                          <select 
                            value={item.unit}
                            onChange={(e) => updateItem(index, 'unit', e.target.value)}
                            className="w-full bg-transparent text-[10px] font-black uppercase text-slate-500 outline-none cursor-pointer"
                          >
                            <option value="packs">packs</option>
                            <option value="boxes">boxes</option>
                            <option value="units">units</option>
                            <option value="tubes">tubes</option>
                            <option value="bottles">bottles</option>
                          </select>
                        </div>
                        <div className="col-span-1 text-right">
                          <button 
                            type="button"
                            onClick={() => removeItem(index)}
                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                          >
                            <FiTrash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {formData.items.length === 0 && (
                      <div className="py-8 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                        <FiAlertCircle className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No items added to order</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b pb-1">Notes</h4>
                  <textarea 
                    rows="3"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    placeholder="Any special instructions..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 resize-none"
                  />
                </div>
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b pb-1">Terms & Conditions</h4>
                  <textarea 
                    rows="3"
                    value={formData.terms}
                    onChange={(e) => setFormData({...formData, terms: e.target.value})}
                    placeholder="Terms of the purchase order..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 resize-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">Authorized By (Sign/Label)</label>
                  <input 
                    type="text" 
                    value={formData.authorizedBy}
                    onChange={(e) => setFormData({...formData, authorizedBy: e.target.value})}
                    placeholder="Signature"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t sticky bottom-0 bg-white">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={formData.items.length === 0 || !formData.supplierId}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-100 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed"
                >
                  {isEditing ? 'Update Order' : 'Create Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Custom Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiTrash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Confirm Delete</h3>
              <p className="text-slate-500 mb-6">Are you sure you want to delete purchase order <span className="font-bold text-slate-700">{orderToDelete?.poNumber}</span>? This action cannot be undone.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all"
                >
                  No, Keep it
                </button>
                <button 
                  onClick={executeDelete}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100"
                >
                  Yes, Delete PO
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {showPrintModal && printingOrder && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800">Purchase Order Print Preview</h3>
              <div className="flex gap-2">
                <button 
                  onClick={handlePrintAction}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition-all"
                >
                  <FiPrinter /> Print Now
                </button>
                <button 
                  onClick={() => { setShowPrintModal(false); setPrintingOrder(null); }}
                  className="p-2 hover:bg-white rounded-full transition-all group border"
                >
                  <FiX className="w-5 h-5 text-slate-400 group-hover:text-slate-600" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-slate-100 p-8">
              <div className="bg-white shadow-lg mx-auto w-[210mm] min-h-[297mm]">
                <PrintView order={printingOrder} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
