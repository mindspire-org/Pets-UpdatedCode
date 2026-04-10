import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiPackage, FiX, FiDownload, FiUpload } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { suppliersAPI, productsAPI, salesAPI } from '../../services/api';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [showModal, setShowModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierToDelete, setSupplierToDelete] = useState(null);
  const [toast, setToast] = useState('');
  const [sales, setSales] = useState([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    supplierName: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    category: '',
    notes: ''
  });

  const [purchaseData, setPurchaseData] = useState({
    productId: '',
    productName: '',
    quantity: 0,
    unitPrice: 0,
    invoiceNumber: ''
  });

  const [purchaseToDelete, setPurchaseToDelete] = useState(null);
  const [showPurchaseDeleteModal, setShowPurchaseDeleteModal] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentData, setPaymentData] = useState({ amount: 0, paymentMethod: 'Cash', notes: '', date: new Date().toISOString().slice(0, 10), invoiceNumber: '' });
  const [confirmDialog, setConfirmDialog] = useState({ show: false, title: '', message: '', onConfirm: null, type: 'danger' });
  const [customToast, setCustomToast] = useState({ show: false, message: '', type: 'success' });

  useEffect(() => {
    fetchSuppliers();
    fetchProducts();
    fetchSales();
  }, []);

  const fetchSuppliers = async () => {
    try {
      console.log('Fetching suppliers...');
      const response = await suppliersAPI.getAll('shop');
      console.log('Suppliers API response:', response);
      setSuppliers(response.data || []);
      console.log('Suppliers set:', response.data?.length || 0);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await productsAPI.getAll();
      setProducts(response.data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchSales = async () => {
    try {
      const response = await salesAPI.getAll();
      // API may return { data: [...] } or raw array
      setSales(response.data || response || []);
    } catch (error) {
      console.error('Error fetching sales for suppliers:', error);
    }
  };

  const showToast = (message, type = 'success') => {
    setCustomToast({ show: true, message, type });
    setTimeout(() => setCustomToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const normalizeKey = (v) => String(v || '').trim().toLowerCase();

  const filtered = useMemo(() => {
    const s = String(q || '').trim().toLowerCase();
    if (!s) return suppliers;
    const list = Array.isArray(suppliers) ? suppliers : [];
    return list.filter(x => [
      x?.supplierName,
      x?.contactPerson,
      x?.phone,
      x?.email,
      x?.address,
      x?.category,
      x?.notes,
    ].some(v => String(v || '').toLowerCase().includes(s)));
  }, [suppliers, q]);

  useEffect(() => {
    setPage(1);
  }, [q]);

  const totalPages = Math.max(1, Math.ceil((filtered?.length || 0) / pageSize));
  useEffect(() => {
    setPage(p => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);
  const paged = useMemo(() => {
    const list = Array.isArray(filtered) ? filtered : [];
    const start = (page - 1) * pageSize;
    return list.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const getRowValue = (row, keys) => {
    if (!row || typeof row !== 'object') return '';
    const map = new Map(Object.keys(row).map(k => [normalizeKey(k), row[k]]));
    for (const k of keys) {
      const v = map.get(normalizeKey(k));
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return '';
  };

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
        'Portal': s.portal || 'shop',
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Suppliers');
      XLSX.writeFile(wb, `shop-suppliers-${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (e) {
      console.error('Export suppliers failed', e);
      showToast('Export failed');
    }
  };

  const parseImportedFile = async (file) => {
    const name = String(file?.name || '').toLowerCase();
    if (name.endsWith('.csv')) {
      const text = await file.text();
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      if (parsed?.errors?.length) {
        throw new Error(parsed.errors[0]?.message || 'CSV parse error');
      }
      return Array.isArray(parsed?.data) ? parsed.data : [];
    }

    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const first = wb.SheetNames?.[0];
    if (!first) return [];
    const ws = wb.Sheets[first];
    const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
    return Array.isArray(json) ? json : [];
  };

  const importSuppliersFromFile = async (file) => {
    try {
      setImporting(true);
      const rows = await parseImportedFile(file);
      if (!rows.length) {
        showToast('No rows found in file');
        return;
      }

      const existingByName = new Map(
        (suppliers || []).map(s => [normalizeKey(s.supplierName), s]).filter(([k]) => k)
      );

      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const row of rows) {
        const supplierName = String(getRowValue(row, ['supplierName', 'Supplier Name', 'name', 'Supplier'])).trim();
        if (!supplierName) { skipped += 1; continue; }

        const payload = {
          portal: 'shop',
          supplierName,
          contactPerson: String(getRowValue(row, ['contactPerson', 'Contact Person', 'contact'])).trim(),
          phone: String(getRowValue(row, ['phone', 'Phone', 'mobile'])).trim(),
          email: String(getRowValue(row, ['email', 'Email'])).trim(),
          address: String(getRowValue(row, ['address', 'Address'])).trim(),
          category: String(getRowValue(row, ['category', 'Category'])).trim(),
          notes: String(getRowValue(row, ['notes', 'Notes', 'note'])).trim(),
        };

        const existing = existingByName.get(normalizeKey(supplierName));
        if (existing && existing._id) {
          await suppliersAPI.update(existing._id, payload);
          updated += 1;
        } else {
          await suppliersAPI.create(payload);
          created += 1;
        }
      }

      showToast(`Import done. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);
      await fetchSuppliers();
    } catch (e) {
      console.error('Import suppliers failed', e);
      showToast(e?.message ? `Import failed: ${e.message}` : 'Import failed');
    } finally {
      setImporting(false);
      try { if (fileInputRef.current) fileInputRef.current.value = ''; } catch {}
    }
  };

  const supplierSalesStats = useMemo(() => {
    if (!Array.isArray(products) || !Array.isArray(sales) || !sales.length) return {};

    const productMap = new Map();
    products.forEach(p => {
      if (p && p._id) {
        productMap.set(String(p._id), p);
      }
    });

    const stats = {};

    sales.forEach(sale => {
      const items = Array.isArray(sale?.items) ? sale.items : [];
      items.forEach(item => {
        const pid = item.productId ? String(item.productId) : null;
        const prod = pid ? productMap.get(pid) : null;
        const supplierName = prod?.supplier;
        if (!supplierName) return;

        if (!stats[supplierName]) {
          stats[supplierName] = {
            totalRevenue: 0,
            totalUnits: 0,
            products: {}
          };
        }

        const supStat = stats[supplierName];
        const qty = Number(item.quantity || 0);
        const perItemTotal = Number(
          item.totalPrice != null
            ? item.totalPrice
            : qty * Number(item.unitPrice || 0)
        );

        supStat.totalUnits += qty;
        supStat.totalRevenue += perItemTotal;

        const prodKey = pid || item.itemName || 'unknown';
        if (!supStat.products[prodKey]) {
          supStat.products[prodKey] = {
            productId: pid,
            productName: prod?.itemName || item.itemName || 'Unknown Product',
            unitsSold: 0,
            revenue: 0
          };
        }
        supStat.products[prodKey].unitsSold += qty;
        supStat.products[prodKey].revenue += perItemTotal;
      });
    });

    return stats;
  }, [products, sales]);

  const openModal = (supplier = null) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        supplierName: supplier.supplierName,
        contactPerson: supplier.contactPerson || '',
        phone: supplier.phone || '',
        email: supplier.email || '',
        address: supplier.address || '',
        category: supplier.category || '',
        notes: supplier.notes || ''
      });
    } else {
      setEditingSupplier(null);
      setFormData({
        supplierName: '',
        contactPerson: '',
        phone: '',
        email: '',
        address: '',
        category: '',
        notes: ''
      });
    }
    setShowModal(true);
  };

  const openPurchaseModal = async (supplier) => {
    try {
      // Optimistically set selected
      setSelectedSupplier(supplier);
      setPurchaseData({
        productId: '',
        productName: '',
        quantity: 0,
        unitPrice: 0,
        invoiceNumber: ''
      });
      setShowPurchaseModal(true);
      // Fetch latest supplier details to ensure full, up-to-date history
      const fresh = await suppliersAPI.getById(supplier._id);
      if (fresh?.data) setSelectedSupplier(fresh.data);
    } catch {
      // keep optimistic state on failure
    }
  };

  const closePurchaseModal = () => {
    setShowPurchaseModal(false);
    setSelectedSupplier(null);
    setEditingPurchase(null);
    setPurchaseData({
      productId: '',
      productName: '',
      quantity: 0,
      unitPrice: 0,
      invoiceNumber: ''
    });
  };

  const openPaymentModal = (supplier) => {
    setSelectedSupplier(supplier);
    setPaymentData({
      amount: 0,
      paymentMethod: 'Cash',
      notes: '',
      date: new Date().toISOString().slice(0, 10),
      invoiceNumber: ''
    });
    setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    console.log('Attempting to submit payment:', {
      supplierId: selectedSupplier?._id,
      paymentData
    });

    if (!selectedSupplier?._id || paymentData.amount <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }
    try {
      const response = await suppliersAPI.addPayment(selectedSupplier._id, paymentData);
      console.log('Payment response:', response);
      showToast('Payment recorded successfully');
      await fetchSuppliers();
      setShowPaymentModal(false);
    } catch (error) {
      console.error('Full payment error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: error.config
      });
      showToast(error?.response?.data?.message || 'Error recording payment', 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingSupplier) {
        await suppliersAPI.update(editingSupplier._id, { ...formData, portal: 'shop' });
        showToast('Supplier updated successfully');
      } else {
        await suppliersAPI.create({ ...formData, portal: 'shop' });
        showToast('Supplier added successfully');
      }
      fetchSuppliers();
      setShowModal(false);
    } catch (error) {
      showToast('Error saving supplier');
    }
  };

  const handlePurchaseSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPurchase?._id) {
        await suppliersAPI.updatePurchase(selectedSupplier._id, editingPurchase._id, purchaseData);
        showToast('Purchase updated');
      } else {
        await suppliersAPI.addPurchase(selectedSupplier._id, purchaseData);
        showToast('Purchase recorded and stock updated');
      }
      await fetchSuppliers();
      await fetchProducts();
      const fresh = await suppliersAPI.getById(selectedSupplier._id);
      console.log('Fresh supplier data after update:', fresh?.data);
      if (fresh?.data) setSelectedSupplier(fresh.data);
      cancelEditPurchase();
    } catch (error) {
      showToast(error?.response?.data?.message || 'Error saving purchase');
    }
  };

  const editPurchase = (p) => {
    setEditingPurchase(p);
    setPurchaseData({
      productId: p.productId || '',
      productName: p.productName || '',
      quantity: Number(p.quantity || 0),
      unitPrice: Number(p.unitPrice || 0),
      invoiceNumber: p.invoiceNumber || ''
    });
  };

  const cancelEditPurchase = () => {
    setEditingPurchase(null);
    setPurchaseData({
      productId: '',
      productName: '',
      quantity: 0,
      unitPrice: 0,
      invoiceNumber: ''
    });
  };

  const deletePurchase = (p) => {
    if (!selectedSupplier?._id || !p?._id) return;
    setPurchaseToDelete(p);
    setShowPurchaseDeleteModal(true);
  };

  const confirmDeletePurchase = async () => {
    if (!purchaseToDelete) return;
    try {
      await suppliersAPI.deletePurchase(selectedSupplier._id, purchaseToDelete._id);
      showToast('Purchase deleted');
      await fetchSuppliers();
      await fetchProducts();
      const fresh = await suppliersAPI.getById(selectedSupplier._id);
      if (fresh?.data) setSelectedSupplier(fresh.data);
      if (editingPurchase?._id === purchaseToDelete._id) cancelEditPurchase();
    } catch (e) {
      showToast(e?.response?.data?.message || 'Delete failed');
    } finally {
      setShowPurchaseDeleteModal(false);
      setPurchaseToDelete(null);
    }
  };

  const openDeleteModal = (supplier) => {
    setSupplierToDelete(supplier);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!supplierToDelete) return;
    
    try {
      await suppliersAPI.delete(supplierToDelete._id);
      showToast('Supplier deleted successfully');
      fetchSuppliers();
      setShowDeleteModal(false);
      setSupplierToDelete(null);
    } catch (error) {
      showToast('Error deleting supplier');
      setShowDeleteModal(false);
    }
  };

  const handleProductSelect = (e) => {
    const productId = e.target.value;
    const product = products.find(p => p._id === productId);
    if (product) {
      setPurchaseData({
        ...purchaseData,
        productId: product._id,
        productName: product.itemName,
        unitPrice: product.purchasePrice
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Custom Payment Modal */}

      {/* Record Payment Modal */}
      {showPaymentModal && selectedSupplier && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between text-white">
              <h2 className="text-xl font-bold">Record Payment</h2>
              <button onClick={() => setShowPaymentModal(false)}><FiX className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handlePaymentSubmit} className="p-6 space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl mb-4">
                <p className="text-sm text-slate-500">Paying To:</p>
                <p className="font-bold text-slate-900 text-lg">{selectedSupplier.supplierName}</p>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-slate-600">Current Balance:</span>
                  <span className="font-bold text-red-600">Rs{((selectedSupplier.totalPurchases || 0) - (selectedSupplier.totalPaid || 0)).toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Select Invoice to Pay (Optional)</label>
                <select
                  value={paymentData.invoiceNumber}
                  onChange={(e) => {
                    const val = e.target.value;
                    console.log('Selected value from dropdown:', val);
                    
                    const purchase = selectedSupplier.purchaseHistory?.find(p => 
                      (p.invoiceNumber === val || (p._id && p._id.toString() === val))
                    );
                    
                    console.log('Found purchase for selection:', purchase);
                    
                    const total = purchase ? (purchase.totalPrice || (purchase.quantity * purchase.unitPrice)) : 0;
                    const paid = purchase ? (purchase.paidAmount || 0) : 0;
                    const balance = Math.max(0, total - paid);
                    
                    setPaymentData(prev => ({ 
                      ...prev, 
                      invoiceNumber: val,
                      amount: balance
                    }));
                  }}
                  className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-0 transition-all mb-2"
                >
                  <option value="">Full/Partial Account Payment (No Specific Invoice)</option>
                  {selectedSupplier.purchaseHistory?.filter(p => {
                    const total = p.totalPrice || (p.quantity * p.unitPrice);
                    const paid = p.paidAmount || 0;
                    return (total - paid > 0);
                  }).map((p, idx) => {
                    const total = p.totalPrice || (p.quantity * p.unitPrice);
                    const paid = p.paidAmount || 0;
                    const balance = total - paid;
                    const displayLabel = p.invoiceNumber ? `Inv: ${p.invoiceNumber}` : `Purch: ${new Date(p.purchaseDate).toLocaleDateString()}`;
                    const optionValue = p.invoiceNumber || (p._id ? p._id.toString() : `idx-${idx}`);
                    return (
                      <option key={p._id || idx} value={optionValue}>
                        {displayLabel} - Bal: Rs{balance.toLocaleString()} (Total: Rs{total.toLocaleString()})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Amount to Pay (Rs) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: Number(e.target.value) })}
                  className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-0 transition-all text-lg font-bold"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={paymentData.paymentMethod}
                  onChange={(e) => setPaymentData({ ...paymentData, paymentMethod: e.target.value })}
                  className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-0 transition-all"
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Online">Online</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Notes</label>
                <textarea
                  rows="2"
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                  className="w-full px-4 py-2 bg-white border-2 border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-0 transition-all"
                  placeholder="Payment details, cheque number, etc."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Confirmation Dialog */}
      {confirmDialog.show && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className={`px-6 py-4 flex items-center gap-3 ${confirmDialog.type === 'danger' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
              <div className={`p-2 rounded-full ${confirmDialog.type === 'danger' ? 'bg-red-100' : 'bg-amber-100'}`}>
                {confirmDialog.type === 'danger' ? <FiTrash2 className="w-6 h-6" /> : <FiX className="w-6 h-6" />}
              </div>
              <h3 className="text-lg font-bold">{confirmDialog.title}</h3>
            </div>
            <div className="p-6 text-slate-600 leading-relaxed">
              {confirmDialog.message}
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
      {customToast.show && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl shadow-2xl z-[300] flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-300 ${
          customToast.type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'
        }`}>
          <div className={`w-2 h-2 rounded-full animate-pulse ${customToast.type === 'error' ? 'bg-white' : 'bg-emerald-400'}`}></div>
          <span className="font-medium">{customToast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Suppliers
          </h1>
          <p className="text-slate-500 mt-1">Manage supplier information and purchases</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search suppliers..."
            className="px-3 py-2 border border-slate-300 rounded-lg"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files && e.target.files[0];
              if (f) importSuppliersFromFile(f);
            }}
          />
          <button
            type="button"
            onClick={exportSuppliersToExcel}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg"
          >
            <FiDownload /> Export
          </button>
          <button
            type="button"
            disabled={importing}
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 text-slate-700 rounded-lg"
          >
            <FiUpload /> {importing ? 'Importing...' : 'Import'}
          </button>
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
          >
            <FiPlus /> Add Supplier
          </button>
        </div>
      </div>

      {/* Suppliers Grid */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="text-sm text-slate-600 font-medium">
          Showing {filtered.length===0 ? 0 : ((page - 1) * pageSize + 1)}-{Math.min(page * pageSize, filtered.length)} of {filtered.length}
        </div>
        <div className="flex items-center gap-2">
          <select value={pageSize} onChange={e=>setPageSize(Number(e.target.value)||12)} className="h-9 px-2 rounded-lg border border-slate-300 bg-white text-sm">
            <option value={6}>6 / page</option>
            <option value={12}>12 / page</option>
            <option value={24}>24 / page</option>
            <option value={48}>48 / page</option>
          </select>
          <button type="button" onClick={()=>setPage(p=>Math.max(1, p-1))} disabled={page<=1} className={`h-9 px-3 rounded-lg border text-sm ${page<=1?'border-slate-200 text-slate-400 cursor-not-allowed':'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
            Prev
          </button>
          <div className="text-sm text-slate-700 font-semibold min-w-[84px] text-center">{page} / {totalPages}</div>
          <button type="button" onClick={()=>setPage(p=>Math.min(totalPages, p+1))} disabled={page>=totalPages} className={`h-9 px-3 rounded-lg border text-sm ${page>=totalPages?'border-slate-200 text-slate-400 cursor-not-allowed':'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
            Next
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {paged.map((supplier) => (
          <div key={supplier._id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">{supplier.supplierName}</h3>
                {supplier.category && (
                  <span className="inline-block mt-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                    {supplier.category}
                  </span>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => openModal(supplier)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  <FiEdit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => openDeleteModal(supplier)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2 text-sm text-slate-600 mb-4">
              {supplier.contactPerson && (
                <p><strong>Contact:</strong> {supplier.contactPerson}</p>
              )}
              {supplier.phone && (
                <p><strong>Phone:</strong> {supplier.phone}</p>
              )}
              {supplier.email && (
                <p><strong>Email:</strong> {supplier.email}</p>
              )}
              {supplier.address && (
                <p><strong>Address:</strong> {supplier.address}</p>
              )}
            </div>

            <div className="border-t border-slate-200 pt-4 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Total Payable:</span>
                <span className="font-bold text-red-600">
                  Rs{((supplier.totalPurchases || 0) - (supplier.totalPaid || 0)).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-slate-600">Total Paid:</span>
                <span className="font-semibold text-emerald-600">
                  Rs{supplier.totalPaid?.toLocaleString() || 0}
                </span>
              </div>
              <div className="flex justify-between text-sm mt-1 border-t border-slate-100 pt-1">
                <span className="text-slate-600">Purchase Total:</span>
                <span className="font-semibold text-slate-800">
                  Rs{supplier.totalPurchases?.toLocaleString() || 0}
                </span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-slate-600">Purchase Records:</span>
                <span className="font-semibold text-slate-800">
                  {supplier.purchaseHistory?.length || 0}
                </span>
              </div>
              {(() => {
                const perf = supplierSalesStats[supplier.supplierName] || null;
                if (!perf) return null;
                return (
                  <>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-slate-600">Units Sold (Shop):</span>
                      <span className="font-semibold text-emerald-700">
                        {perf.totalUnits.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-slate-600">Sales Revenue:</span>
                      <span className="font-semibold text-emerald-700">
                        Rs{perf.totalRevenue.toLocaleString()}
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => openPurchaseModal(supplier)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 shadow-lg shadow-purple-100 transition-all"
              >
                <FiPackage className="w-4 h-4" /> Record Purchase
              </button>
            </div>

            {supplier.purchaseHistory && supplier.purchaseHistory.length > 0 && (
              <div className="mt-4 border-t border-slate-200 pt-4">
                <p className="text-xs font-semibold text-slate-700 mb-2">Recent Purchases:</p>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {supplier.purchaseHistory.slice(-3).reverse().map((purchase, idx) => (
                    <div key={idx} className="text-xs bg-slate-50 p-2 rounded">
                      <p className="font-medium">{purchase.productName}</p>
                      <p className="text-slate-600">
                        Qty: {purchase.quantity} • Rs{purchase.totalPrice?.toLocaleString()}
                      </p>
                      <p className="text-slate-500">
                        {new Date(purchase.purchaseDate).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <FiPackage className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No suppliers yet. Add your first supplier.</p>
        </div>
      )}

      {/* Add/Edit Supplier Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-800">
                {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <FiX className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Supplier Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.supplierName}
                    onChange={(e) => setFormData({...formData, supplierName: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({...formData, contactPerson: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g., Pet Food, Accessories"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Address
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  rows="2"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  rows="3"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
                >
                  {editingSupplier ? 'Update Supplier' : 'Add Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Purchase Modal */}
      {showPurchaseModal && selectedSupplier && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-800">
                Record Purchase - {selectedSupplier.supplierName}
              </h2>
              <button onClick={closePurchaseModal} className="text-slate-400 hover:text-slate-600">
                <FiX className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Purchase Form */}
                <form onSubmit={handlePurchaseSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Select Product *</label>
                    <select
                      required
                      value={purchaseData.productId}
                      onChange={handleProductSelect}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Choose a product</option>
                      {products.map(product => (
                        <option key={product._id} value={product._id}>
                          {product.itemName} (Stock: {product.quantity})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Quantity *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={purchaseData.quantity}
                      onChange={(e) => setPurchaseData({...purchaseData, quantity: Number(e.target.value)})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Unit Price *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={purchaseData.unitPrice}
                      onChange={(e) => setPurchaseData({...purchaseData, unitPrice: Number(e.target.value)})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Number</label>
                    <input
                      type="text"
                      value={purchaseData.invoiceNumber}
                      onChange={(e) => setPurchaseData({...purchaseData, invoiceNumber: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Total Amount:</span>
                      <span className="font-semibold text-slate-800">Rs{(purchaseData.quantity * purchaseData.unitPrice).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={closePurchaseModal}
                      className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
                    >
                      Record Purchase
                    </button>
                  </div>
                </form>

                {/* Purchase History */}
                <div className="border rounded-lg min-w-0">
                  <div className="px-3 py-2 border-b bg-slate-50 font-semibold text-slate-700 text-sm">Purchase History</div>
                  <div className="max-h-80 overflow-y-auto overflow-x-hidden">
                    {selectedSupplier.purchaseHistory && selectedSupplier.purchaseHistory.length > 0 ? (
                      <table className="w-full text-xs table-fixed">
                        <thead className="bg-slate-100 sticky top-0">
                          <tr>
                            <th className="p-2 text-left w-16">Date</th>
                            <th className="p-2 text-left w-16">Invoice</th>
                            <th className="p-2 text-left">Product</th>
                            <th className="p-2 text-right w-10">Qty</th>
                            <th className="p-2 text-right w-16">Unit</th>
                            <th className="p-2 text-right w-16">Total</th>
                            <th className="p-2 text-right w-16">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedSupplier.purchaseHistory.slice().reverse().map((p, idx) => {
                            const unit = Number(p.unitPrice || 0);
                            const qty = Number(p.quantity || 0);
                            const total = Number(p.totalPrice != null ? p.totalPrice : unit * qty);
                            const when = p.purchaseDate || p.createdAt || new Date().toISOString();
                            return (
                              <tr key={p._id || idx} className="border-t">
                                <td className="p-2 whitespace-nowrap">{new Date(when).toLocaleDateString()}</td>
                                <td className="p-2 truncate">{p.invoiceNumber || '-'}</td>
                                <td className="p-2 truncate" title={p.productName}>{p.productName}</td>
                                <td className="p-2 text-right">{qty}</td>
                                <td className="p-2 text-right whitespace-nowrap">Rs{unit.toLocaleString()}</td>
                                <td className="p-2 text-right font-semibold whitespace-nowrap">Rs{total.toLocaleString()}</td>
                                <td className="p-2 text-right whitespace-nowrap">
                                  <button type="button" onClick={() => deletePurchase(p)} className="inline-flex items-center justify-center p-1 text-red-600 hover:bg-red-50 rounded" title="Delete">
                                    <FiTrash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <div className="p-4 text-sm text-slate-500">No purchase records yet for this supplier.</div>
                    )}
                  </div>
                  {(() => {
                    if (!selectedSupplier) return null;
                    const perf = supplierSalesStats[selectedSupplier.supplierName];
                    if (!perf) return null;
                    const topProducts = Object.values(perf.products || {})
                      .sort((a, b) => b.revenue - a.revenue)
                      .slice(0, 3);
                    if (!topProducts.length) return null;
                    return (
                      <div className="border-t bg-slate-50">
                        <div className="px-3 py-2 font-semibold text-slate-700 text-sm flex justify-between">
                          <span>Sales Summary</span>
                          <span className="text-emerald-700">Rs{perf.totalRevenue.toLocaleString()}</span>
                        </div>
                        <div className="px-3 pb-3 text-xs text-slate-600 space-y-1">
                          <div>Total units sold: <span className="font-semibold">{perf.totalUnits.toLocaleString()}</span></div>
                          <div className="mt-1 font-semibold text-slate-700">Top Products:</div>
                          <ul className="space-y-1">
                            {topProducts.map((p, idx) => (
                              <li key={idx} className="flex justify-between">
                                <span className="truncate mr-2">{p.productName}</span>
                                <span className="whitespace-nowrap">{p.unitsSold} pcs • Rs{p.revenue.toLocaleString()}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Delete Confirmation Modal */}
      {showPurchaseDeleteModal && purchaseToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
              <div className="flex items-center gap-3 text-white">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <FiTrash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Delete Purchase Record</h3>
                  <p className="text-sm text-red-100">This action cannot be undone</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-6">
              <p className="text-slate-700 mb-4">
                Are you sure you want to delete this purchase record from <span className="font-bold text-slate-900">{selectedSupplier?.supplierName}</span>?
              </p>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                  </svg>
                  <div className="text-sm text-red-800">
                    <p className="font-semibold mb-1">Warning:</p>
                    <p>This will also adjust product stock and supplier totals.</p>
                  </div>
                </div>
              </div>

              {/* Purchase Info */}
              <div className="bg-slate-50 rounded-lg p-4 mb-6">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Product:</span>
                    <span className="font-medium text-slate-800">{purchaseToDelete.productName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Quantity:</span>
                    <span className="font-medium text-slate-800">{purchaseToDelete.quantity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Unit Price:</span>
                    <span className="font-medium text-slate-800">Rs{purchaseToDelete.unitPrice?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2">
                    <span className="text-slate-600">Total:</span>
                    <span className="font-semibold text-slate-900">Rs{purchaseToDelete.totalPrice?.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowPurchaseDeleteModal(false);
                    setPurchaseToDelete(null);
                  }}
                  className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeletePurchase}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl font-semibold shadow-lg transition-all"
                >
                  Delete Purchase
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && supplierToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
              <div className="flex items-center gap-3 text-white">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <FiTrash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Delete Supplier</h3>
                  <p className="text-sm text-red-100">This action cannot be undone</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-6">
              <p className="text-slate-700 mb-4">
                Are you sure you want to delete <span className="font-bold text-slate-900">{supplierToDelete.supplierName}</span>?
              </p>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                  </svg>
                  <div className="text-sm text-red-800">
                    <p className="font-semibold mb-1">Warning:</p>
                    <p>Deleting this supplier will remove all associated purchase history and records.</p>
                  </div>
                </div>
              </div>

              {/* Supplier Info */}
              <div className="bg-slate-50 rounded-lg p-4 mb-6">
                <div className="space-y-2 text-sm">
                  {supplierToDelete.contactPerson && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Contact:</span>
                      <span className="font-medium text-slate-800">{supplierToDelete.contactPerson}</span>
                    </div>
                  )}
                  {supplierToDelete.phone && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Phone:</span>
                      <span className="font-medium text-slate-800">{supplierToDelete.phone}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-slate-200 pt-2">
                    <span className="text-slate-600">Total Purchases:</span>
                    <span className="font-semibold text-slate-900">Rs{supplierToDelete.totalPurchases?.toLocaleString() || 0}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSupplierToDelete(null);
                  }}
                  className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl font-semibold shadow-lg transition-all"
                >
                  Delete Supplier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
