import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiPackage, FiX, FiCamera, FiUpload, FiDownload } from 'react-icons/fi';
import { productsAPI, suppliersAPI } from '../../services/api';
import * as XLSX from 'xlsx';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productToDelete, setProductToDelete] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showOtherSupplier, setShowOtherSupplier] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef(null);
  const scanRAF = useRef(null);
  const barcodeInputRef = useRef(null);
  const importFileRef = useRef(null);
  const scanTimerRef = useRef(null);
  const [showStickerDialog, setShowStickerDialog] = useState(false);
  const [stickerInfo, setStickerInfo] = useState({ itemName: '', salePrice: 0, barcode: '' });
  const [categories, setCategories] = useState(['Food', 'Toy', 'Collar', 'Shampoo', 'Accessory', 'Medicine', 'Grooming', 'Other']);
  const [customCategories, setCustomCategories] = useState([]);
  const [hiddenCategories, setHiddenCategories] = useState([]);
  const [categoryRenames, setCategoryRenames] = useState({});
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [categoryEdit, setCategoryEdit] = useState({ oldValue: '', value: '' });
  const [confirmDialog, setConfirmDialog] = useState({ show: false, title: '', message: '', onConfirm: null, type: 'danger' });
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (showScanner) {
      startScanner();
      return () => stopScanner();
    }
    // ensure stopped if toggled off
    stopScanner();
  }, [showScanner]);

  

  const [formData, setFormData] = useState({
    itemName: '',
    category: 'Food',
    barcode: '',
    quantity: 0,
    purchasePrice: 0,
    salePrice: 0,
    minSalePrice: 0,
    supplier: '',
    otherSupplier: '',
    description: '',
    lowStockThreshold: 10,
    batchNo: '',
    expiryDate: ''
  });

  useEffect(() => {
    fetchProducts();
    fetchSuppliers();
    fetchCategories();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [searchQuery, selectedCategory, products]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedCategory]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil((filteredProducts?.length || 0) / pageSize));
  }, [filteredProducts, pageSize]);
  useEffect(() => {
    setPage(p => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);
  const pagedProducts = useMemo(() => {
    const list = Array.isArray(filteredProducts) ? filteredProducts : [];
    const start = (page - 1) * pageSize;
    return list.slice(start, start + pageSize);
  }, [filteredProducts, page, pageSize]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      console.log('Fetching products...');
      const response = await productsAPI.getAll();
      console.log('Products API response:', response);
      setProducts(response.data || []);
      console.log('Products set:', response.data?.length || 0);
    } catch (error) {
      showToast('Error fetching products');
      console.error('Fetch products error:', error);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const handleClearAll = async () => {
    try {
      if ((products || []).length === 0) { setToast({ show: true, message: 'No products to delete', type: 'info' }); return; }
      
      setConfirmDialog({
        show: true,
        title: 'Delete All Products',
        message: 'Are you sure you want to delete ALL products? This action cannot be undone.',
        type: 'danger',
        onConfirm: async () => {
          try {
            setClearing(true);
            await productsAPI.clearAll();
            showToast('All products deleted');
            await fetchProducts();
          } catch (err) {
            showToast(err?.message || 'Failed to clear products');
          } finally {
            setClearing(false);
            setConfirmDialog(prev => ({ ...prev, show: false }));
          }
        }
      });
    } catch (err) {
      showToast(err?.message || 'Failed to initiate clear all');
    }
  };

  const persistCategoryPrefs = (prefs = {}) => {
    try { localStorage.setItem('shop_custom_categories', JSON.stringify(prefs.custom || [])); } catch {}
    try { localStorage.setItem('shop_hidden_categories', JSON.stringify(prefs.hidden || [])); } catch {}
    try { localStorage.setItem('shop_category_renames', JSON.stringify(prefs.renames || {})); } catch {}
  };

  const loadCategoryPrefs = () => {
    let custom = [];
    let hidden = [];
    let renames = {};
    try { const x = JSON.parse(localStorage.getItem('shop_custom_categories') || '[]'); if (Array.isArray(x)) custom = x.filter(Boolean); } catch {}
    try { const x = JSON.parse(localStorage.getItem('shop_hidden_categories') || '[]'); if (Array.isArray(x)) hidden = x.filter(Boolean); } catch {}
    try { const x = JSON.parse(localStorage.getItem('shop_category_renames') || '{}'); if (x && typeof x === 'object') renames = x; } catch {}
    return { custom, hidden, renames };
  };

  const applyRenames = (list = [], renames = {}) => {
    const out = [];
    for (const c of list || []) {
      const raw = String(c || '').trim();
      if (!raw) continue;
      const mapped = String(renames?.[raw] || raw).trim();
      if (!mapped) continue;
      out.push(mapped);
    }
    return Array.from(new Set(out));
  };

  const handleAddCategory = () => {
    const val = (newCategory || '').trim();
    if (!val) { showToast('Enter category name'); return; }
    const existing = (categories || []).find(c => c.toLowerCase() === val.toLowerCase());
    const chosen = existing || val;
    setCategories(prev => Array.from(new Set([...(prev || []), chosen])).sort());
    setCustomCategories(prev => {
      const next = Array.from(new Set([...(prev || []), chosen])).sort();
      persistCategoryPrefs({ custom: next, hidden: hiddenCategories, renames: categoryRenames });
      return next;
    });
    setFormData(prev => ({ ...prev, category: chosen }));
    setShowAddCategory(false);
    setNewCategory('');
    showToast('Category added');
  };

  const fetchCategories = async () => {
    const prefs = loadCategoryPrefs();
    setCustomCategories(prefs.custom);
    setHiddenCategories(prefs.hidden);
    setCategoryRenames(prefs.renames);
    try {
      const res = await productsAPI.getCategories();
      const list = (res?.data || res || []).filter(Boolean);
      if (Array.isArray(list) && list.length) {
        const merged = Array.from(new Set([...(list || []), ...(prefs.custom || [])]));
        const renamed = applyRenames(merged, prefs.renames);
        setCategories(renamed.sort());
        return;
      }
    } catch (error) {
      const derived = Array.from(new Set((products || []).map(p => p.category).filter(Boolean)));
      const merged = Array.from(new Set([...(derived || []), ...(prefs.custom || [])]));
      const renamed = applyRenames(merged, prefs.renames);
      if (renamed.length) setCategories(renamed.sort());
    }
  };

  const visibleCategories = useMemo(() => {
    const hidden = (hiddenCategories || []).map(x => String(x || '').trim()).filter(Boolean);
    const base = (categories || []).map(x => String(x || '').trim()).filter(Boolean);
    return base.filter(c => !hidden.includes(c));
  }, [categories, hiddenCategories]);

  const filterCategoryOptions = useMemo(() => {
    const list = [...(visibleCategories || [])];
    if (selectedCategory && selectedCategory !== 'All' && !list.includes(selectedCategory)) list.push(selectedCategory);
    return list;
  }, [visibleCategories, selectedCategory]);

  const formCategoryOptions = useMemo(() => {
    const list = [...(visibleCategories || [])];
    if (formData?.category && !list.includes(formData.category)) list.push(formData.category);
    return list;
  }, [visibleCategories, formData?.category]);

  const hideCategory = (name) => {
    const val = String(name || '').trim();
    if (!val) return;
    
    setConfirmDialog({
      show: true,
      title: 'Hide Category',
      message: `Hide category "${val}" from dropdowns?`,
      type: 'warning',
      onConfirm: () => {
        setHiddenCategories(prev => {
          const next = Array.from(new Set([...(prev || []), val])).filter(Boolean);
          persistCategoryPrefs({ custom: customCategories, hidden: next, renames: categoryRenames });
          return next;
        });
        if (selectedCategory === val) setSelectedCategory('All');
        if (formData.category === val) {
          const fallback = (visibleCategories.filter(c => c !== val)[0]) || 'Other';
          setFormData(prev => ({ ...prev, category: fallback }));
        }
        setConfirmDialog(prev => ({ ...prev, show: false }));
      }
    });
  };

  const unhideCategory = (name) => {
    const val = String(name || '').trim();
    if (!val) return;
    setHiddenCategories(prev => {
      const next = (prev || []).filter(x => String(x || '').trim() !== val);
      persistCategoryPrefs({ custom: customCategories, hidden: next, renames: categoryRenames });
      return next;
    });
  };

  const renameCategory = async (oldValue, nextValue) => {
    const oldName = String(oldValue || '').trim();
    const newName = String(nextValue || '').trim();
    if (!oldName || !newName) return;
    if (oldName === newName) return;
    if ((categories || []).some(c => String(c || '').trim().toLowerCase() === newName.toLowerCase())) {
      showToast('Category already exists');
      return;
    }

    setCategoryRenames(prev => {
      const next = { ...(prev || {}), [oldName]: newName };
      persistCategoryPrefs({ custom: customCategories, hidden: hiddenCategories, renames: next });
      return next;
    });

    setCategories(prev => Array.from(new Set((prev || []).map(c => String(c || '').trim() === oldName ? newName : c))).filter(Boolean).sort());
    setCustomCategories(prev => {
      const next = (prev || []).map(c => String(c || '').trim() === oldName ? newName : c);
      const uniq = Array.from(new Set(next)).filter(Boolean).sort();
      persistCategoryPrefs({ custom: uniq, hidden: hiddenCategories, renames: { ...(categoryRenames || {}), [oldName]: newName } });
      return uniq;
    });
    setHiddenCategories(prev => {
      const next = (prev || []).map(c => String(c || '').trim() === oldName ? newName : c);
      const uniq = Array.from(new Set(next)).filter(Boolean);
      persistCategoryPrefs({ custom: customCategories, hidden: uniq, renames: { ...(categoryRenames || {}), [oldName]: newName } });
      return uniq;
    });
    if (selectedCategory === oldName) setSelectedCategory(newName);
    if (formData.category === oldName) setFormData(prev => ({ ...prev, category: newName }));
    setProducts(prev => (prev || []).map(p => (p.category === oldName ? { ...p, category: newName } : p)));
    setFilteredProducts(prev => (prev || []).map(p => (p.category === oldName ? { ...p, category: newName } : p)));

    try {
      setLoading(true);
      const affected = (products || []).filter(p => p.category === oldName);
      for (const p of affected) {
        try {
          await productsAPI.update(p._id, { ...p, category: newName });
        } catch {}
      }
      await fetchProducts();
      showToast('Category updated');
    } catch {
      showToast('Category updated (local only)');
    } finally {
      setLoading(false);
      setCategoryEdit({ oldValue: '', value: '' });
    }
  };

  // Start camera barcode scanner using BarcodeDetector API
  const startScanner = async () => {
    if (scanning) return;
    try {
      if (!('BarcodeDetector' in window)) {
        showToast('Barcode scanner not supported in this browser');
        return;
      }
      setScanning(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const detector = new window.BarcodeDetector({ formats: ['code_128','code_39','ean_13','ean_8','qr_code','upc_a','upc_e','itf'] });
      const loop = async () => {
        try {
          if (!videoRef.current) return;
          const codes = await detector.detect(videoRef.current);
          if (codes && codes.length > 0) {
            const value = codes[0].rawValue || codes[0].displayValue;
            setFormData(prev => ({ ...prev, barcode: value }));
            showToast('Barcode scanned');
            stopScanner();
            setShowScanner(false);
            return;
          }
        } catch {}
        scanRAF.current = requestAnimationFrame(loop);
      };
      scanRAF.current = requestAnimationFrame(loop);
    } catch (e) {
      showToast('Camera access failed');
      setScanning(false);
    }
  };

  const stopScanner = () => {
    try {
      if (scanRAF.current) cancelAnimationFrame(scanRAF.current);
      const v = videoRef.current;
      const stream = v && v.srcObject;
      if (stream && stream.getTracks) stream.getTracks().forEach(t => t.stop());
      if (v) v.srcObject = null;
    } catch {}
    setScanning(false);
  };

  const fetchSuppliers = async () => {
    try {
      const response = await suppliersAPI.getAll('shop');
      setSuppliers(response.data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const filterProducts = () => {
    let filtered = products;

    if (selectedCategory !== 'All') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.itemName?.toLowerCase().includes(query) ||
        p.barcode?.toLowerCase().includes(query) ||
        p.supplier?.toLowerCase().includes(query)
      );
    }

    setFilteredProducts(filtered);
  };

  const findByBarcode = (code) => {
    if (!code) return null;
    const q = String(code).trim().toLowerCase();
    return (products || []).find(p => (p.barcode || '').trim().toLowerCase() === q) || null;
  };

  const scheduleFilterByBarcode = (val) => {
    try { if (scanTimerRef.current) clearTimeout(scanTimerRef.current); } catch {}
    scanTimerRef.current = setTimeout(() => {
      const prod = findByBarcode(val);
      if (prod && prod.barcode) {
        setSearchQuery(String(prod.barcode));
      }
    }, 120);
  };

  const handleImportClick = () => {
    try { importFileRef.current?.click(); } catch {}
  };

  const resolveField = (row, names = []) => {
    for (const n of names) {
      const key = Object.keys(row).find(k => String(k).trim().toLowerCase() === String(n).trim().toLowerCase());
      if (key) return row[key];
    }
    return undefined;
  };

  const parseRowsToProducts = (rows) => {
    const out = [];
    for (const r of rows) {
      const isEmptyRow = !r || Object.values(r).every(v => (
        v === undefined || v === null || String(v).trim() === ''
      ));
      if (isEmptyRow) continue;

      const itemName = (resolveField(r, ['itemName','item_name','name','product','product name']) || '').toString().trim();
      const category = (resolveField(r, ['category','cat']) || '').toString().trim();
      const barcodeVal = resolveField(r, ['barcode','code','sku']);
      const barcode = barcodeVal == null ? '' : String(barcodeVal).trim();
      const toNum = (v, def=0) => {
        if (v === undefined || v === null || String(v).trim() === '') return def;
        const n = Number(String(v).toString().replace(/[^0-9.\-]/g,''));
        return Number.isFinite(n) ? n : def;
      };
      const quantity = toNum(resolveField(r, ['quantity','qty','stock']), 0);
      const purchasePrice = toNum(resolveField(r, ['purchasePrice','purchase_price','cost','buy price','buy']), 0);
      const salePrice = toNum(resolveField(r, ['salePrice','sale_price','price','sell price','mrp']), 0);
      const supplier = (resolveField(r, ['supplier','vendor']) || '').toString();
      const description = (resolveField(r, ['description','desc','details']) || '').toString();
      const lowStockThreshold = toNum(resolveField(r, ['lowStockThreshold','low_stock','reorder level','reorder']), 10) || 10;
      out.push({ itemName, category, barcode, quantity, purchasePrice, salePrice, supplier, description, lowStockThreshold });
    }
    return out;
  };

  const handleImportFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    try {
      if (!file) return;
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (!['xlsx','csv','xls'].includes(ext)) {
        showToast('Invalid file. Please upload .xlsx or .csv');
        return;
      }
      setImporting(true);
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const firstSheet = wb.SheetNames[0];
      const ws = wb.Sheets[firstSheet];
      if (!ws) { showToast('No sheet found in file'); return; }
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const items = parseRowsToProducts(rows);
      if (!items.length) { showToast('No valid rows found'); return; }
      const res = await productsAPI.bulkUpsert(items);
      const serverCount = (res && (res.count != null ? res.count : (Array.isArray(res.data) ? res.data.length : items.length))) || items.length;
      showToast(`Imported ${serverCount} products`);
      fetchProducts();
    } catch (err) {
      showToast(err?.message || 'Import failed');
    } finally {
      setImporting(false);
      try { if (importFileRef.current) importFileRef.current.value = ''; } catch {}
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const data = (filteredProducts || []).map(p => ({
        'Item Name': p.itemName,
        'Category': p.category,
        'Barcode': p.barcode || '',
        'Quantity': p.quantity,
        'Purchase Price': p.purchasePrice,
        'Sale Price': p.salePrice,
        'Supplier': p.supplier || '',
        'Description': p.description || '',
        'Low Stock Threshold': p.lowStockThreshold || 10,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Products');
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ts = new Date().toISOString().slice(0,10);
      a.href = url;
      a.download = `products_export_${ts}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Export started');
    } catch (err) {
      showToast(err?.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const openModal = (product = null) => {
    if (product) {
      setEditingProduct(product);
      const isOtherSupplier = product.supplier && !suppliers.find(s => s.supplierName === product.supplier);
      setShowOtherSupplier(isOtherSupplier);
      setFormData({
        itemName: product.itemName,
        category: product.category,
        barcode: product.barcode || '',
        quantity: product.quantity,
        purchasePrice: product.purchasePrice,
        salePrice: product.salePrice,
        minSalePrice: product.minSalePrice || 0,
        supplier: isOtherSupplier ? 'Other' : product.supplier || '',
        otherSupplier: isOtherSupplier ? product.supplier : '',
        description: product.description || '',
        lowStockThreshold: product.lowStockThreshold || 10,
        batchNo: product.batchNo || '',
        expiryDate: product.expiryDate ? new Date(product.expiryDate).toISOString().slice(0, 10) : ''
      });
      if (product.category && !categories.includes(product.category)) {
        setCategories(prev => Array.from(new Set([...(prev||[]), product.category])).sort());
      }
    } else {
      setEditingProduct(null);
      setShowOtherSupplier(false);
      setFormData({
        itemName: '',
        category: 'Food',
        barcode: '',
        quantity: 0,
        purchasePrice: 0,
        salePrice: 0,
        minSalePrice: 0,
        supplier: '',
        otherSupplier: '',
        description: '',
        lowStockThreshold: 10,
        batchNo: '',
        expiryDate: ''
      });
    }
    setShowModal(true);
    // Focus barcode field when modal opens
    setTimeout(() => {
      try { barcodeInputRef.current?.focus(); } catch {}
    }, 50);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProduct(null);
    setShowOtherSupplier(false);
    if (scanning) stopScanner();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        supplier: formData.supplier === 'Other' ? formData.otherSupplier : formData.supplier
      };
      delete submitData.otherSupplier;
      if (editingProduct) {
        const resp = await productsAPI.update(editingProduct._id, submitData);
        const updated = resp?.data || resp || submitData;
        showToast('Product updated successfully');
        setStickerInfo({
          itemName: updated.itemName || submitData.itemName,
          salePrice: (updated.salePrice ?? submitData.salePrice) || 0,
          barcode: updated.barcode || submitData.barcode || editingProduct?.barcode || updated._id || editingProduct?._id || ''
        });
        setShowStickerDialog(true);
      } else {
        const resp = await productsAPI.create(submitData);
        const created = resp?.data || resp || submitData;
        showToast('Product added successfully');
        setStickerInfo({
          itemName: created.itemName || submitData.itemName,
          salePrice: (created.salePrice ?? submitData.salePrice) || 0,
          barcode: created.barcode || submitData.barcode || created._id || ''
        });
        setShowStickerDialog(true);
      }

      setCategories(prev => Array.from(new Set([...(prev||[]), submitData.category])).sort());
      fetchProducts();
      closeModal();
    } catch (error) {
      showToast(error.message || 'Error saving product');
    }
  };

  const printSticker = ({ itemName = '', salePrice = 0, barcode = '' }) => {
    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      // Get hospital/shop name and phone from settings or use defaults
      const hospitalName = localStorage.getItem('companyName') || 'Abbottabad Pet Hospital';
      const hospitalPhone = localStorage.getItem('phone') || '0345-0520451';
      
      const safeName = String(itemName).slice(0, 35);
      const priceText = `Rs. ${Number(salePrice || 0).toLocaleString()}`;
      const barcodeValue = String(barcode || '').trim() || safeName;
      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { 
      size: A4 portrait; 
      margin: 0; 
    }
    * { 
      box-sizing: border-box; 
      margin: 0;
      padding: 0;
    }
    html, body { 
      width: 210mm; 
      height: 297mm; 
      margin: 0; 
      padding: 0; 
      font-family: Arial, sans-serif; 
    }
    .page {
      width: 210mm;
      height: 297mm;
      position: relative;
    }
    .label { 
      position: absolute;
      top: 0;
      left: 0;
      width: 58mm; 
      height: 30mm; 
      display: flex; 
      flex-direction: column; 
      justify-content: space-between; 
      align-items: center; 
      padding: 1.5mm 2mm; 
      overflow: hidden;
      border: 1px solid #000;
    }
    .header { 
      width: 100%; 
      text-align: center; 
      flex-shrink: 0;
    }
    .hospital-name { 
      font-size: 8pt; 
      font-weight: 700; 
      line-height: 1.1;
    }
    .hospital-phone { 
      font-size: 6.5pt; 
      line-height: 1.1;
    }
    .barcode { 
      width: 100%; 
      display: flex; 
      justify-content: center; 
      flex-shrink: 0;
    }
    .barcode svg { 
      width: 90%; 
      height: 8mm; 
    }
    .code { 
      width: 100%; 
      text-align: center; 
      font-size: 6pt; 
      line-height: 1;
      flex-shrink: 0;
    }
    .product-name { 
      width: 100%; 
      font-size: 7.5pt; 
      font-weight: 700; 
      text-align: center; 
      line-height: 1.1; 
      white-space: nowrap; 
      overflow: hidden; 
      text-overflow: ellipsis;
      flex-shrink: 0;
    }
    .price { 
      width: 100%; 
      text-align: center; 
      font-size: 10pt; 
      font-weight: 800;
      flex-shrink: 0;
    }
  </style>
  <title>Product Sticker</title>
  </head>
<body>
  <div class="page">
    <div class="label">
      <div class="header">
        <div class="hospital-name">${hospitalName}</div>
        <div class="hospital-phone">${hospitalPhone}</div>
      </div>
      <div class="barcode"><svg id="barcode"></svg></div>
      <div class="code">${barcodeValue}</div>
      <div class="product-name">${safeName}</div>
      <div class="price">${priceText}</div>
    </div>
  </div>
</body>
</html>`;

      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(html);
      doc.close();
      const s = doc.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js';
      s.onload = () => {
        try {
          if (iframe.contentWindow?.JsBarcode) {
            iframe.contentWindow.JsBarcode(
              doc.getElementById('barcode'),
              barcodeValue,
              { format: 'CODE128', lineColor: '#000', width: 1.2, height: 22, displayValue: false, margin: 0 }
            );
          }
        } catch {}
        setTimeout(() => {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
          setTimeout(() => document.body.removeChild(iframe), 1000);
        }, 80);
      };
      doc.head.appendChild(s);
    } catch {}
  };

  const openDeleteModal = (product) => {
    setProductToDelete(product);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!productToDelete) return;
    
    try {
      await productsAPI.delete(productToDelete._id);
      showToast('Product deleted successfully');
      fetchProducts();
      setShowDeleteModal(false);
      setProductToDelete(null);
    } catch (error) {
      showToast('Error deleting product');
      setShowDeleteModal(false);
    }
  };

  return (
    <div className="space-y-6">
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

      {/* Sticker Print Dialog */}
      {showStickerDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="border-b border-slate-200 px-5 py-3 flex items-center justify-between">
              <div className="font-semibold">Print Sticker</div>
              <button onClick={() => setShowStickerDialog(false)} className="text-slate-400 hover:text-slate-600">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <div className="border border-slate-300 rounded-lg p-4 bg-slate-50">
                <div className="text-center mb-2">
                  <div className="font-bold text-sm text-slate-900">{localStorage.getItem('companyName') || 'Abbottabad Pet Hospital'}</div>
                  <div className="text-xs text-slate-600">{localStorage.getItem('phone') || '0345-0520451'}</div>
                </div>
                <div className="flex justify-center my-2">
                  <div className="text-xs text-slate-400">[Barcode Preview]</div>
                </div>
                {!!String(stickerInfo.barcode || '').trim() && (
                  <div className="text-center text-xs text-slate-500 mb-1">{String(stickerInfo.barcode || '').trim()}</div>
                )}
                <div className="text-center">
                  <div className="font-bold text-sm text-slate-900">{stickerInfo.itemName}</div>
                  <div className="text-lg font-extrabold text-slate-900">Rs. {Number(stickerInfo.salePrice||0).toLocaleString()}</div>
                </div>
              </div>
              <div className="text-center text-xs text-slate-500 mt-3">Label size: 58mm x 30mm</div>
            </div>
            <div className="border-t border-slate-200 px-5 py-4 flex gap-3">
              <button
                onClick={() => setShowStickerDialog(false)}
                className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-semibold"
              >
                OK
              </button>
              <button
                onClick={() => { setShowStickerDialog(false); setTimeout(() => printSticker(stickerInfo), 10); }}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
              >
                Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Products
          </h1>
          <p className="text-slate-500 mt-1">Manage your shop inventory</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={importFileRef}
            type="file"
            accept=".xlsx,.csv"
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            onClick={handleImportClick}
            disabled={importing}
            className={`flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors ${importing ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <FiUpload /> Import
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || filteredProducts.length === 0}
            className={`flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors ${exporting ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <FiDownload /> Export
          </button>
          <button
            onClick={handleClearAll}
            disabled={clearing || (products || []).length === 0}
            className={`flex items-center gap-2 px-4 py-2 border border-red-300 text-red-700 hover:bg-red-50 rounded-lg transition-colors ${clearing ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <FiTrash2 /> Clear All
          </button>
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <FiPlus /> Add Product
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, barcode, or supplier..."
              value={searchQuery}
              onChange={(e) => { const v = e.target.value; setSearchQuery(v); scheduleFilterByBarcode(v); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Tab' || e.key === 'NumpadEnter') {
                  const exact = findByBarcode(searchQuery);
                  if (exact && exact.barcode) {
                    e.preventDefault();
                    setSearchQuery(String(exact.barcode));
                  }
                }
              }}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All</option>
            {filterCategoryOptions.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => { setShowManageCategories(true); setCategoryEdit({ oldValue: '', value: '' }); }}
            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 relative z-20"
          >
            Manage Categories
          </button>
        </div>
      </div>

      {/* Manage Categories Modal - Moved outside the form and filter areas to ensure visibility */}
      {showManageCategories && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" 
          onClick={() => { setShowManageCategories(false); setCategoryEdit({ oldValue: '', value: '' }); }}
        >
          <div 
            className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" 
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Manage Categories</h2>
              <button onClick={() => { setShowManageCategories(false); setCategoryEdit({ oldValue: '', value: '' }); }} className="text-slate-400 hover:text-slate-600">
                <FiX className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                {(categories || []).map((cat) => (
                  <div key={cat} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-100 transition-colors">
                    {categoryEdit.oldValue === cat ? (
                      <input
                        autoFocus
                        value={categoryEdit.value}
                        onChange={(e) => setCategoryEdit(v => ({ ...v, value: e.target.value }))}
                        className="flex-1 px-3 py-1.5 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none"
                      />
                    ) : (
                      <div className="flex-1 text-sm font-medium text-slate-700">{cat}</div>
                    )}
                    <div className="flex gap-1">
                      {categoryEdit.oldValue === cat ? (
                        <>
                          <button type="button" onClick={() => renameCategory(categoryEdit.oldValue, categoryEdit.value)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold">Save</button>
                          <button type="button" onClick={() => setCategoryEdit({ oldValue: '', value: '' })} className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold">Cancel</button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => setCategoryEdit({ oldValue: cat, value: cat })} className="px-3 py-1.5 border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-semibold">Edit</button>
                          {visibleCategories.includes(cat) ? (
                            <button type="button" onClick={() => hideCategory(cat)} className="px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold">Hide</button>
                          ) : (
                            <button type="button" onClick={() => unhideCategory(cat)} className="px-3 py-1.5 border border-green-200 text-green-600 hover:bg-green-50 rounded-lg text-xs font-semibold">Restore</button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {(categories || []).length === 0 && (
                  <div className="text-center py-8 text-slate-500 italic">No categories available</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Products Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="text-sm text-slate-600 font-medium">
            Showing {filteredProducts.length===0 ? 0 : ((page - 1) * pageSize + 1)}-{Math.min(page * pageSize, filteredProducts.length)} of {filteredProducts.length}
          </div>
          <div className="flex items-center gap-2">
            <select value={pageSize} onChange={e=>setPageSize(Number(e.target.value)||15)} className="h-9 px-2 rounded-lg border border-slate-300 bg-white text-sm">
              <option value={10}>10 / page</option>
              <option value={15}>15 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
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
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <FiPackage className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No products found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">#</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Barcode</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Batch No</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Expiry</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Purchase Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Sale Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Supplier</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pagedProducts.map((product, idx) => (
                  <tr key={product._id} className="hover:bg-slate-50">
                    <td className="px-4 py-4 text-slate-500">{((page - 1) * pageSize) + idx + 1}</td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-slate-800">{product.itemName}</p>
                        {product.description && (
                          <p className="text-sm text-slate-500 truncate max-w-xs">{product.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        {product.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{product.batchNo || '-'}</td>
                    <td className="px-6 py-4 text-slate-600">
                      {product.expiryDate ? new Date(product.expiryDate).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-semibold ${
                        product.quantity <= product.lowStockThreshold 
                          ? 'text-orange-600' 
                          : 'text-green-600'
                      }`}>
                        {product.quantity}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">Rs{product.purchasePrice.toLocaleString()}</td>
                    <td className="px-6 py-4 font-semibold text-slate-800">Rs{product.salePrice.toLocaleString()}</td>
                    <td className="px-6 py-4 text-slate-600">{product.supplier || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openModal(product)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <FiEdit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(product)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-800">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <FiX className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.itemName}
                    onChange={(e) => setFormData({...formData, itemName: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Category *
                  </label>
                  <div className="flex gap-2">
                    <select
                      required
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {formCategoryOptions.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => { setShowAddCategory(s => !s); setNewCategory(''); }}
                      className="px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                    >
                      Add New
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowManageCategories(true); setCategoryEdit({ oldValue: '', value: '' }); }}
                      className="px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                    >
                      Manage
                    </button>
                  </div>
                  {showAddCategory && (
                    <div className="mt-2 flex gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <input
                        type="text"
                        autoFocus
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        placeholder="New category name"
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                      <button type="button" onClick={handleAddCategory} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold">Save</button>
                      <button type="button" onClick={() => { setShowAddCategory(false); setNewCategory(''); }} className="px-3 py-2 border border-slate-300 bg-white rounded-lg font-semibold">Cancel</button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Barcode
                  </label>
                  <div className="flex gap-2">
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      value={formData.barcode}
                      onChange={(e) => setFormData({...formData, barcode: e.target.value})}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Scan or enter barcode"
                    />
                    <button
                      type="button"
                      onClick={() => setShowScanner(true)}
                      className="px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                      title="Scan Barcode"
                    >
                      <FiCamera className="w-4 h-4"/> Scan
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.quantity}
                    onChange={(e) => setFormData({...formData, quantity: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Purchase Price *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({...formData, purchasePrice: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Sale Price *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.salePrice}
                    onChange={(e) => setFormData({...formData, salePrice: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Minimum Sale Price
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.minSalePrice}
                    onChange={(e) => setFormData({...formData, minSalePrice: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Min price allowed in POS"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Supplier
                  </label>
                  <select
                    value={formData.supplier}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData({...formData, supplier: value, otherSupplier: ''});
                      setShowOtherSupplier(value === 'Other');
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map(supplier => (
                      <option key={supplier._id} value={supplier.supplierName}>
                        {supplier.supplierName}
                      </option>
                    ))}
                    <option value="Other">Other</option>
                  </select>
                </div>

                {showOtherSupplier && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Other Supplier Name
                    </label>
                    <input
                      type="text"
                      value={formData.otherSupplier}
                      onChange={(e) => setFormData({...formData, otherSupplier: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter supplier name"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Batch Number
                  </label>
                  <input
                    type="text"
                    value={formData.batchNo}
                    onChange={(e) => setFormData({...formData, batchNo: e.target.value})}
                    placeholder="Enter batch number"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({...formData, expiryDate: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Low Stock Threshold
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.lowStockThreshold}
                    onChange={(e) => setFormData({...formData, lowStockThreshold: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows="3"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  {editingProduct ? 'Update Product' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="font-semibold">Scan Barcode</div>
              <button onClick={() => { setShowScanner(false); }} className="p-1 rounded hover:bg-slate-100"><FiX className="w-5 h-5"/></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="rounded-lg overflow-hidden bg-black">
                <video ref={videoRef} playsInline style={{ width: '100%', height: 'auto' }} />
              </div>
              <p className="text-sm text-slate-600">Align the barcode within the frame. The code will auto-fill into the field.</p>
              <div className="flex gap-2 justify-end">
                <button onClick={stopScanner} className="px-3 py-1.5 border rounded-lg">Stop</button>
                <button onClick={startScanner} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg">Start</button>
                <button onClick={() => setShowScanner(false)} className="px-3 py-1.5 border rounded-lg">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && productToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
              <div className="flex items-center gap-3 text-white">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <FiTrash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Delete Product</h3>
                  <p className="text-sm text-red-100">This action cannot be undone</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-6">
              <p className="text-slate-700 mb-4">
                Are you sure you want to delete <span className="font-bold text-slate-900">{productToDelete.itemName}</span>?
              </p>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                  </svg>
                  <div className="text-sm text-red-800">
                    <p className="font-semibold mb-1">Warning:</p>
                    <p>Deleting this product will permanently remove it from your inventory and all associated records.</p>
                  </div>
                </div>
              </div>

              {/* Product Info */}
              <div className="bg-slate-50 rounded-lg p-4 mb-6">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Category:</span>
                    <span className="font-medium text-slate-800">{productToDelete.category}</span>
                  </div>
                  {productToDelete.barcode && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Barcode:</span>
                      <span className="font-medium text-slate-800">{productToDelete.barcode}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-600">Current Stock:</span>
                    <span className={`font-semibold ${
                      productToDelete.quantity <= productToDelete.lowStockThreshold 
                        ? 'text-orange-600' 
                        : 'text-green-600'
                    }`}>
                      {productToDelete.quantity} units
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2">
                    <span className="text-slate-600">Sale Price:</span>
                    <span className="font-semibold text-slate-900">Rs{productToDelete.salePrice.toLocaleString()}</span>
                  </div>
                  {productToDelete.supplier && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Supplier:</span>
                      <span className="font-medium text-slate-800">{productToDelete.supplier}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setProductToDelete(null);
                  }}
                  className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl font-semibold shadow-lg transition-all"
                >
                  Delete Product
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
