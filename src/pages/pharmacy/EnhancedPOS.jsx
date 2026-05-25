import React, { useState, useEffect, useRef } from 'react';
import { FiSearch, FiPlus, FiMinus, FiTrash2, FiPrinter, FiShoppingCart, FiX, FiGrid, FiList, FiEyeOff, FiMaximize2, FiEdit3, FiSave, FiDownload } from 'react-icons/fi';
import { pharmacyMedicinesAPI, pharmacySalesAPI, pharmacySettingsAPI } from '../../services/api';
import ReceiptGenerator from '../../components/pharmacy/ReceiptGenerator';

export default function EnhancedPharmacyPOS() {
  const [medicines, setMedicines] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [customerInfo, setCustomerInfo] = useState({
    customerName: '',
    customerContact: '',
    petName: ''
  });
  const [discount, setDiscount] = useState(0);
  const [billDiscountPercent, setBillDiscountPercent] = useState(0);
  const [salesTaxPercent, setSalesTaxPercent] = useState(0);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [toast, setToast] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [hideInventory, setHideInventory] = useState(false);
  const [hospitalSettings, setHospitalSettings] = useState(null);
  const [pharmacySettings, setPharmacySettings] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentCharge, setPaymentCharge] = useState(0);
  const [isChargeManual, setIsChargeManual] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const receiptRef = useRef();

  useEffect(() => {
    fetchMedicines();
    fetchHospitalSettings();
    fetchPharmacySettings();
    loadPrescriptionData();
  }, []);

  // Calculate discount amount when percentage changes
  useEffect(() => {
    const subtotal = calculateSubtotal();
    const discountAmount = (subtotal * billDiscountPercent) / 100;
    setDiscount(discountAmount);
  }, [billDiscountPercent, cart]);

  useEffect(() => {
    const posData = localStorage.getItem('pharmacy_pos_data');
    if (posData && medicines.length > 0) {
      const data = JSON.parse(posData);
      if (Date.now() - data.timestamp < 300000) {
        autoAddPrescriptionMedicines(data);
      }
    }
  }, [medicines]);

  // Debounced auto-add on exact barcode match (works even if scanner doesn't send Enter)
  useEffect(() => {
    const q = (searchQuery || '').trim();
    if (!q) return;
    const timer = setTimeout(() => {
      const exact = medicines.find(m => (m.barcode || '').toLowerCase() === q.toLowerCase());
      if (exact) {
        addToCart(exact);
        setSearchQuery('');
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, medicines]);

  const fetchMedicines = async () => {
    try {
      const response = await pharmacyMedicinesAPI.getAll();
      setMedicines(response.data || []);
    } catch (error) {
      console.error('Error fetching medicines:', error);
      showToast('Error loading medicines', 'error');
    }
  };

  // Auto-calc 2% payment charge for non-cash methods unless manually overridden
  useEffect(() => {
    if (isChargeManual) return;
    const method = (paymentMethod || '').toLowerCase();
    const nonCash = method && method !== 'cash';
    const subtotal = calculateSubtotal();
    const base = Math.max(0, subtotal - Number(discount||0));
    const auto = nonCash ? Number((base * 0.02).toFixed(2)) : 0;
    setPaymentCharge(auto);
  }, [paymentMethod, cart, discount, isChargeManual]);

  const fetchHospitalSettings = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const response = await settingsAPI.get(user.username || 'admin');
      setHospitalSettings(response.data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchPharmacySettings = async () => {
    try {
      const response = await pharmacySettingsAPI.get();
      const settings = response?.data || response || {};
      
      console.log('POS: Settings received from DB:', settings);
      
      // Update the settings object
      setPharmacySettings(settings);
      
      // IMPORTANT: Extract and cast to numbers immediately
      const defaultDisc = Number(settings.billDiscountPercent) || 0;
      const defaultTax = Number(settings.salesTaxPercent) || 0;

      // Update the specific state variables that drive the UI inputs
      setBillDiscountPercent(defaultDisc);
      setSalesTaxPercent(defaultTax);
      
      console.log('POS: Defaults applied to state:', { defaultDisc, defaultTax });
    } catch (error) {
      console.error('POS: Error fetching pharmacy settings:', error);
    }
  };

  const showToast = (message, type = 'info') => {
    if (type === 'success') {
      toast.success(message);
    } else if (type === 'error') {
      toast.error(message);
    } else {
      toast(message);
    }
  };

  const calcUnitsForMl = (ml, unitMl) => {
    const cap = Math.max(1, Number(unitMl || 1));
    const dose = Math.max(0, Number(ml || 0));
    return Math.max(1, Math.ceil(dose / cap));
  };

  const calcTotalAvailableMl = (remainingMl, stockUnits, unitMl) => {
    const cap = Math.max(1, Number(unitMl || 1));
    const rem = Math.max(0, Number(remainingMl || 0));
    const units = Math.max(0, Number(stockUnits || 0));
    return rem + Math.max(0, units - 1) * cap;
  };

  const loadPrescriptionData = () => {
    const posData = localStorage.getItem('pharmacy_pos_data');
    if (posData) {
      try {
        const data = JSON.parse(posData);
        if (Date.now() - data.timestamp < 300000) {
          setCustomerInfo({
            customerName: data.customerName || '',
            customerContact: data.customerContact || '',
            petName: data.petName || ''
          });
          showToast(`Prescription loaded for ${data.petName || 'patient'}`, 'success');
        }
      } catch (error) {
        console.error('Error loading prescription data:', error);
      }
    }
  };

  const normalizeMedicineName = (value = '') => {
    // Keep only lettePKR so we ignore strengths/units when matching
    return String(value || '').toLowerCase().replace(/[^a-z]/g, '');
  };

  const autoAddPrescriptionMedicines = (data) => {
    if (!data.cartItems || data.cartItems.length === 0) return;
    let addedCount = 0;
    const notFound = [];
    const outOfStock = [];
    const newCart = [...cart];

    const pushOrAccumulatePlaceholder = (name, qty, dosage, unitHint = 'unit', note = '') => {
      const idx = newCart.findIndex(c => !c.medicineId && (c.medicineName||'').toLowerCase() === String(name||'').toLowerCase());
      if (idx >= 0) {
        newCart[idx].quantity = Number(newCart[idx].quantity||0) + Number(qty||0);
        newCart[idx].dosage = newCart[idx].dosage || dosage;
        newCart[idx].unit = unitHint;
      } else {
        newCart.push({
          medicineId: null,
          medicineName: name,
          batchNo: '',
          category: 'Unknown',
          quantity: Number(qty||0) || 1,
          unit: unitHint,
          pricePerUnit: 0,
          availableStock: 0,
          expiryDate: '',
          dosage: dosage,
          totalPrice: 0,
          isEditable: true,
          isPlaceholder: true,
          note
        });
      }
    };

    data.cartItems.forEach(item => {
      const rawName = item.medicineName || item.searchTerm || '';
      const name = normalizeMedicineName(rawName);
      let medicine = medicines.find(m => {
        const inv = normalizeMedicineName(m.medicineName);
        if (!inv || !name) return false;
        return inv === name || inv.includes(name) || name.includes(inv);
      });

      // Fallback: try just the first word (brand) if full string didn't match
      if (!medicine) {
        const firstToken = normalizeMedicineName(String(rawName).split(/[^A-Za-z0-9]+/)[0] || '');
        if (firstToken) {
          medicine = medicines.find(m => {
            const inv = normalizeMedicineName(m.medicineName);
            if (!inv) return false;
            return inv.includes(firstToken) || firstToken.includes(inv);
          });
        }
      }

      if (!medicine) {
        notFound.push(item.medicineName);
        pushOrAccumulatePlaceholder(item.medicineName, item.quantity, item.dosage, item.unitHint||'unit', 'Not in inventory');
        return;
      }

      const isInjection = medicine.category === 'Injection';
      const cap = Number(medicine.mlPerVial || 0);
      const hasStock = isInjection ? (Number(medicine.remainingMl||0) > 0 || cap > 0) : Number(medicine.quantity||0) > 0;
      if (!hasStock) {
        outOfStock.push(item.medicineName);
        pushOrAccumulatePlaceholder(item.medicineName, item.quantity, item.dosage, item.unitHint||medicine.unit||'unit', 'Out of stock');
        return;
      }

      const existingIndex = newCart.findIndex(c => c.medicineId === medicine._id);
      // Map unitHint to dose used
      const doseFromUnitHint = (() => {
        const q = Number(item.quantity||0);
        if (!isInjection) return q; // tablets/capsules/drops/syrups (units or ml)
        if ((item.unitHint||'').toLowerCase() === 'container') return q * (cap || 1);
        return q; // ml by default
      })();

      if (existingIndex >= 0) {
        if (isInjection) {
          newCart[existingIndex].mlUsed = Number(newCart[existingIndex].mlUsed||0) + Number(doseFromUnitHint||0);
          const units = calcUnitsForMl(newCart[existingIndex].mlUsed, newCart[existingIndex].mlPerVial || cap || 1);
          const stock = Number(newCart[existingIndex].availableStock || 0);
          if (units > stock) {
            showToast('Insufficient stock', 'error');
            newCart[existingIndex].mlUsed = Number(newCart[existingIndex].mlUsed||0) - Number(doseFromUnitHint||0);
            return;
          }
          newCart[existingIndex].totalPrice = calculateItemTotal(newCart[existingIndex]);
        } else {
          if (cap > 0) {
            const prevDose = Number(newCart[existingIndex].doseRequested || 0);
            const newDose = prevDose + Number(doseFromUnitHint || 0);
            newCart[existingIndex].doseRequested = newDose;
            newCart[existingIndex].quantity = Math.max(1, Math.ceil(newDose / cap));
            newCart[existingIndex].totalPrice = calculateItemTotal(newCart[existingIndex]);
          } else {
            newCart[existingIndex].quantity = Number(newCart[existingIndex].quantity||0) + Number(doseFromUnitHint||0);
            newCart[existingIndex].totalPrice = calculateItemTotal(newCart[existingIndex]);
          }
        }
      } else {
        // Build new item with computed dose
        if (isInjection) {
          newCart.push(createCartItem(medicine, doseFromUnitHint));
        } else {
          newCart.push(createCartItem(medicine, doseFromUnitHint));
        }
      }
      addedCount++;
    });

    setCart(newCart);
    const notes = [];
    if (addedCount > 0) notes.push(`${addedCount} medicine(s) added from prescription`);
    if (notFound.length) notes.push(`Not in inventory: ${notFound.slice(0,3).join(', ')}${notFound.length>3?'…':''}`);
    if (outOfStock.length) notes.push(`Out of stock: ${outOfStock.slice(0,3).join(', ')}${outOfStock.length>3?'…':''}`);
    showToast(notes.join(' | '), notFound.length || outOfStock.length ? 'warning' : 'success');
    localStorage.removeItem('pharmacy_pos_data');
  };

  const createCartItem = (medicine, quantity = 1) => {
    const isInjection = medicine.category === 'Injection';
    const capacity = Number(medicine.mlPerVial || 0);
    const unitPrice = Number(medicine.salePrice || 0);
    const base = {
      medicineId: medicine._id,
      medicineName: medicine.medicineName,
      batchNo: medicine.batchNo,
      category: medicine.category,
      unit: medicine.unit,
      pricePerUnit: unitPrice,
      availableStock: medicine.quantity,
      remainingMl: medicine.remainingMl || medicine.mlPerVial || 0,
      mlPerVial: capacity,
      expiryDate: medicine.expiryDate,
      dosage: medicine.dosage
    };

    if (isInjection) {
      const raw = Number(quantity) || 0;
      const used = raw > 0 ? raw : 1;
      const units = calcUnitsForMl(used, capacity);
      return {
        ...base,
        mlUsed: used,
        totalPrice: units * unitPrice,
        isEditable: true
      };
    }

    if (capacity > 0 && Number(quantity) > 0) {
      const dose = Number(quantity) || 0;
      const units = Math.max(1, Math.ceil(dose / capacity));
      return {
        ...base,
        doseRequested: dose,
        quantity: units,
        totalPrice: units * unitPrice,
        isEditable: false
      };
    }

    return {
      ...base,
      quantity: Number(quantity) || 1,
      totalPrice: (Number(quantity) || 1) * unitPrice,
      isEditable: false
    };
  };

  const calculateItemTotal = (item) => {
    if (item.category === 'Injection') {
      const dose = Number(item.mlUsed || 0);
      const units = calcUnitsForMl(dose, item.mlPerVial || 1);
      return units * Number(item.pricePerUnit || 0);
    }
    if (Number(item.mlPerVial || 0) > 0 && Number(item.doseRequested || 0) > 0) {
      const cap = Number(item.mlPerVial || 1);
      const dose = Number(item.doseRequested || 0);
      const units = Math.max(1, Math.ceil(dose / cap));
      return units * Number(item.pricePerUnit || 0);
    }
    return Number(item.quantity || 0) * Number(item.pricePerUnit || 0);
  };

  const searchMedicines = medicines.filter(m =>
    (m.medicineName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     m.barcode?.toLowerCase().includes(searchQuery.toLowerCase())) &&
    (m.quantity > 0 || (m.category === 'Injection' && m.remainingMl > 0))
  ).slice(0, 8);

  const addToCart = (medicine) => {
    const existing = cart.find(item => item.medicineId === medicine._id);
    
    if (existing) {
      if (medicine.category === 'Injection') {
        // For injections, increase ML used; price per vial rounding up
        const currentMlUsed = existing.mlUsed || 1;
        const cap = Math.max(1, Number(existing.mlPerVial || medicine.mlPerVial || 1));
        const totalAvailableMl = calcTotalAvailableMl(existing.remainingMl || medicine.remainingMl || cap, existing.availableStock || medicine.quantity || 0, cap);
        if (currentMlUsed >= totalAvailableMl) { showToast(`No more ${String(existing.unit || medicine.unit || 'ml').toUpperCase()} available in this batch`); return; }
        const newMlUsed = currentMlUsed + 1;
        const units = calcUnitsForMl(newMlUsed, cap);
        const stock = Number(existing.availableStock || medicine.quantity || 0);
        if (units > stock) { showToast('Insufficient stock', 'error'); return; }
        const newTotalPrice = units * Number(medicine.salePrice || 0);
        setCart(cart.map(item => item.medicineId === medicine._id ? { ...item, mlUsed: newMlUsed, totalPrice: newTotalPrice } : item));
        showToast(`${medicine.medicineName} ${String(existing.unit || medicine.unit || 'ml').toUpperCase()} updated`);
      } else {
        const cap = Number(medicine.mlPerVial || 0);
        if (cap > 0 && Number(existing.doseRequested || 0) > 0) {
          const newDose = Number(existing.doseRequested || 0) + 1;
          const units = Math.max(1, Math.ceil(newDose / cap));
          setCart(cart.map(item => item.medicineId === medicine._id 
            ? { ...item, doseRequested: newDose, quantity: units, totalPrice: units * item.pricePerUnit }
            : item
          ));
          showToast(`${medicine.medicineName} dose updated`, 'success');
        } else {
          updateCartItem(existing.medicineId, 'quantity', existing.quantity + 1);
        }
      }
    } else {
      setCart([...cart, createCartItem(medicine, 1)]);
      showToast(`${medicine.medicineName} added to cart`, 'success');
    }
  };

  const updateCartItem = (medicineId, field, value) => {
    setCart(cart.map(item => {
      if (item.medicineId === medicineId) {
        const updatedItem = { ...item, [field]: value };
        
        // Validation for injections
        if (item.category === 'Injection' && field === 'mlUsed') {
          const cap = Math.max(1, Number(item.mlPerVial || 1));
          const totalAvailableMl = calcTotalAvailableMl(item.remainingMl || 0, item.availableStock || 0, cap);
          if (value > totalAvailableMl) {
            showToast(`Only ${totalAvailableMl} ${item.unit || 'ml'} available in stock`, 'error');
            return item;
          }
          if (value <= 0) {
            showToast(`${String(item.unit || 'ml').toUpperCase()} used must be greater than 0`, 'error');
            return item;
          }
          const units = calcUnitsForMl(value, cap);
          const stock = Number(item.availableStock || 0);
          if (units > stock) {
            showToast('Insufficient stock', 'error');
            return item;
          }
        }
        
        // Validation for regular medicines
        if (item.category !== 'Injection' && field === 'quantity') {
          if (value > item.availableStock) {
            showToast('Insufficient stock', 'error');
            return item;
          }
          if (value <= 0) {
            showToast('Quantity must be greater than 0', 'error');
            return item;
          }
          // Manual quantity edit overrides any dose-based pricing
          updatedItem.doseRequested = 0;
        }
        
        updatedItem.totalPrice = calculateItemTotal(updatedItem);
        return updatedItem;
      }
      return item;
    }));
  };

  const updateDose = (medicineId, newDose) => {
    setCart(cart.map(item => {
      if (item.medicineId !== medicineId) return item;
      const cap = Number(item.mlPerVial || 0);
      if (!(cap > 0)) return item;
      const dose = Number(newDose);
      if (!isFinite(dose)) return item;
      if (dose <= 0) {
        showToast('Dose must be greater than 0', 'warning');
        return item;
      }
      const units = Math.max(1, Math.ceil(dose / cap));
      const stock = Number(item.availableStock || 0);
      if (units > stock) {
        showToast('Insufficient stock', 'error');
        const maxUnits = Math.max(0, stock);
        const clampedDose = maxUnits * cap;
        const updated = { ...item, doseRequested: clampedDose, quantity: maxUnits };
        updated.totalPrice = calculateItemTotal(updated);
        return updated;
      }
      const updated = { ...item, doseRequested: dose, quantity: units };
      updated.totalPrice = calculateItemTotal(updated);
      return updated;
    }));
  };

  const removeFromCart = (medicineId) => {
    setCart(cart.filter(item => item.medicineId !== medicineId));
    showToast('Item removed from cart', 'info');
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + item.totalPrice, 0);
  };

  const calculateTax = () => {
    const subtotal = calculateSubtotal();
    const afterDiscount = Math.max(0, subtotal - discount);
    return (afterDiscount * salesTaxPercent) / 100;
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const tax = calculateTax();
    return Math.max(0, subtotal - discount + tax + Number(paymentCharge||0));
  };

  const processSale = async () => {
    if (cart.length === 0) {
      showToast('Cart is empty', 'error');
      return;
    }

    if (!customerInfo.customerName.trim()) {
      showToast('Customer name is required', 'error');
      return;
    }

    setIsProcessing(true);

    try {
      const saleData = {
        customerName: customerInfo.customerName,
        customerContact: customerInfo.customerContact,
        petName: customerInfo.petName,
        items: cart.map(item => ({
          medicineId: item.medicineId,
          medicineName: item.medicineName,
          batchNo: item.batchNo || 'N/A',
          category: item.category || 'Medicine',
          quantity: item.category === 'Injection' ? 1 : item.quantity,
          mlUsed: item.category === 'Injection' ? item.mlUsed : 0,
          unit: item.unit || 'Unit',
          pricePerUnit: item.pricePerUnit,
          totalPrice: item.totalPrice,
          remainingMlAfterSale: item.category === 'Injection' ? (item.remainingMl - item.mlUsed) : 0,
          expiryDate: item.expiryDate,
          dosage: item.dosage
        })),
        subtotal: calculateSubtotal(),
        discount: discount,
        billDiscountPercent: billDiscountPercent,
        billDiscountAmount: discount,
        salesTaxPercent: salesTaxPercent,
        salesTaxAmount: calculateTax(),
        paymentCharge: Number(paymentCharge||0),
        totalAmount: calculateTotal(),
        paymentMethod: paymentMethod,
        soldBy: JSON.parse(localStorage.getItem('user') || '{}').username || 'Unknown'
      };

      const response = await pharmacySalesAPI.create(saleData);
      
      if (response.success) {
        setLastSale(response.data);
        setShowPaymentModal(false);
        setShowReceipt(true);
        
        // Reset form
        setCart([]);
        setCustomerInfo({ customerName: '', customerContact: '', petName: '' });
        
        // Reset to default values from settings
        setBillDiscountPercent(pharmacySettings?.billDiscountPercent || 0);
        setSalesTaxPercent(pharmacySettings?.salesTaxPercent || 0);
        setDiscount(0);
        setPaymentCharge(0);
        setIsChargeManual(false);
        
        // Refresh medicines to update stock
        fetchMedicines();
        
        showToast('Sale completed successfully!', 'success');
      } else {
        showToast(response.message || 'Sale failed', 'error');
      }
    } catch (error) {
      console.error('Error processing sale:', error);
      const status = error?.response?.status || error?.status
      const msg = error?.response?.data?.message || error?.data?.message || error?.message || ''
      if (status === 423 || msg.toLowerCase().includes('day is not open')) {
        showToast('Day not opened — please open the pharmacy day session before making a sale.', 'error')
      } else {
        showToast(msg || 'Error processing sale', 'error')
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const startEditing = (item) => {
    setEditingItem(item.medicineId);
  };

  const stopEditing = () => {
    setEditingItem(null);
  };

  const MedicineCard = ({ medicine }) => (
    <div 
      className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-blue-500"
      onClick={() => addToCart(medicine)}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-gray-800 text-sm">{medicine.medicineName}</h3>
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          medicine.category === 'Injection' ? 'bg-red-100 text-red-800' :
          medicine.category === 'Tablet' ? 'bg-blue-100 text-blue-800' :
          medicine.category === 'Syrup' ? 'bg-green-100 text-green-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {medicine.category}
        </span>
      </div>
      
      <div className="space-y-1 text-xs text-gray-600">
        <p><span className="font-medium">Batch:</span> {medicine.batchNo}</p>
        <p><span className="font-medium">Price:</span> PKR {medicine.salePrice}{medicine.category === 'Injection' ? '/vial' : `/${medicine.unit}`}</p>
        
        {medicine.category === 'Injection' ? (
          <div>
            <p><span className="font-medium">Available:</span> {calcTotalAvailableMl(medicine.remainingMl || 0, medicine.quantity || 0, medicine.mlPerVial || 1)} {medicine.unit || 'ml'}</p>
            <p><span className="font-medium">Per {medicine.containerType || 'Vial'}:</span> {medicine.mlPerVial} {medicine.unit || 'ml'}</p>
          </div>
        ) : (
          <p><span className="font-medium">Stock:</span> {medicine.quantity} {medicine.unit}</p>
        )}
        
        <p><span className="font-medium">Expiry:</span> {new Date(medicine.expiryDate).toLocaleDateString()}</p>
        {medicine.dosage && <p><span className="font-medium">Dosage:</span> {medicine.dosage}</p>}
      </div>
      
      {medicine.isExpiringSoon && (
        <div className="mt-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
          Expiring Soon
        </div>
      )}
    </div>
  );

  const CartItem = ({ item }) => (
    <div className="bg-gray-50 rounded-lg p-3 mb-2">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h4 className="font-medium text-gray-800">{item.medicineName}</h4>
          <p className="text-sm text-gray-600">Batch: {item.batchNo}</p>
          <p className="text-sm text-gray-600">Expiry: {new Date(item.expiryDate).toLocaleDateString()}</p>
        </div>
        <button
          onClick={() => removeFromCart(item.medicineId)}
          className="text-red-500 hover:text-red-700 p-1"
        >
          <FiTrash2 size={16} />
        </button>
      </div>

      <div className="flex items-center justify-between">
        {item.category === 'Injection' ? (
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">{String(item.unit || 'ml').toUpperCase()}:</span>
            {editingItem === item.medicineId ? (
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  value={item.mlUsed}
                  onChange={(e) => updateCartItem(item.medicineId, 'mlUsed', parseFloat(e.target.value) || 0)}
                  className="w-16 px-2 py-1 border rounded text-sm"
                  min="0.1"
                  max={calcTotalAvailableMl(item.remainingMl || 0, item.availableStock || 0, item.mlPerVial || 1)}
                  step="0.1"
                />
                <button onClick={stopEditing} className="text-green-600 hover:text-green-800">
                  <FiSave size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-1">
                <span className="font-medium">{item.mlUsed} {item.unit || 'ml'}</span>
                <button onClick={() => startEditing(item)} className="text-blue-600 hover:text-blue-800">
                  <FiEdit3 size={14} />
                </button>
              </div>
            )}
            <span className="text-sm text-gray-500">/ {calcTotalAvailableMl(item.remainingMl || 0, item.availableStock || 0, item.mlPerVial || 1)} {item.unit || 'ml'} available</span>
          </div>
        ) : (
          <>
            {Number(item.mlPerVial || 0) > 0 ? (
              <div className="flex items-center space-x-2 w-full">
                <span className="text-sm font-medium">Dose ({item.unit || 'ml'}):</span>
                <input
                  type="number"
                  value={Number(item.doseRequested || 0)}
                  onChange={(e) => updateDose(item.medicineId, parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 border rounded text-sm text-center"
                  min="0.1"
                  step="0.1"
                />
                <span className="text-xs text-gray-600">
                  = {Math.max(1, Math.ceil(Number(item.doseRequested || 0) / (Number(item.mlPerVial) || 1)))} x {item.unit || 'unit'} ({Number(item.mlPerVial || 0)} {item.unit || 'ml'}/{item.containerType || 'vial'})
                </span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => updateCartItem(item.medicineId, 'quantity', item.quantity - 1)}
                  className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600"
                >
                  <FiMinus size={12} />
                </button>
                <span className="font-medium w-8 text-center">{item.quantity}</span>
                <button
                  onClick={() => updateCartItem(item.medicineId, 'quantity', item.quantity + 1)}
                  className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center hover:bg-green-600"
                >
                  <FiPlus size={12} />
                </button>
              </div>
            )}
          </>
        )}
        
        <div className="text-right">
          <p className="font-semibold">PKR {item.totalPrice.toFixed(2)}</p>
          <p className="text-xs text-gray-500">
            PKR {item.pricePerUnit}/{item.category === 'Injection' ? 'vial' : item.unit}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">Pharmacy POS System</h1>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200"
              >
                {viewMode === 'grid' ? <FiList size={20} /> : <FiGrid size={20} />}
              </button>
              <button
                onClick={() => setHideInventory(!hideInventory)}
                className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200"
              >
                <FiEyeOff size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Medicine Inventory */}
          {!hideInventory && (
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold">Medicine Inventory</h2>
                  <div className="relative">
                    <FiSearch className="absolute left-3 top-3 text-gray-400" size={16} />
                    <input
                      type="text"
                      placeholder="Search medicines or scan barcode..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const q = (searchQuery || '').trim().toLowerCase();
                          const exact = medicines.find(m => (m.barcode || '').toLowerCase() === q);
                          if (exact) {
                            addToCart(exact);
                            setSearchQuery('');
                            return;
                          }
                          if (searchMedicines.length > 0) {
                            addToCart(searchMedicines[0]);
                            setSearchQuery('');
                          } else {
                            showToast('Medicine not found', 'warning');
                          }
                        }
                      }}
                      className="pl-10 pr-4 py-2 border rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}>
                  {searchMedicines.map(medicine => (
                    <MedicineCard key={medicine._id} medicine={medicine} />
                  ))}
                </div>

                {searchMedicines.length === 0 && searchQuery && (
                  <div className="text-center py-8 text-gray-500">
                    No medicines found matching "{searchQuery}"
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cart & Checkout */}
          <div className={hideInventory ? 'lg:col-span-3' : 'lg:col-span-1'}>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center">
                  <FiShoppingCart className="mr-2" />
                  Cart ({cart.length})
                </h2>
                {cart.length > 0 && (
                  <button
                    onClick={() => setCart([])}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {/* Customer Info */}
              <div className="mb-4 space-y-2">
                <input
                  type="text"
                  placeholder="Customer Name *"
                  value={customerInfo.customerName}
                  onChange={(e) => setCustomerInfo({...customerInfo, customerName: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Contact Number"
                  value={customerInfo.customerContact}
                  onChange={(e) => setCustomerInfo({...customerInfo, customerContact: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Pet Name"
                  value={customerInfo.petName}
                  onChange={(e) => setCustomerInfo({...customerInfo, petName: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Cart Items */}
              <div className="max-h-96 overflow-y-auto mb-4">
                {cart.map(item => (
                  <CartItem key={item.medicineId} item={item} />
                ))}
              </div>

              {cart.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Cart is empty. Add medicines to start billing.
                </div>
              )}

              {/* Checkout Summary */}
              <div className="border-t pt-4 space-y-3">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>PKR {calculateSubtotal().toFixed(2)}</span>
                </div>
                
                {/* Bill Discount % */}
                <div className="flex justify-between items-center">
                  <span>Bill Discount ({pharmacySettings?.billDiscountPercent || 0}%):</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={billDiscountPercent}
                      onChange={(e) => setBillDiscountPercent(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                      className="w-20 px-2 py-1 border rounded text-right"
                      min="0"
                      max="100"
                      step="0.01"
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount Amount:</span>
                    <span>- PKR {discount.toFixed(2)}</span>
                  </div>
                )}
                
                {/* Sales Tax % */}
                <div className="flex justify-between items-center">
                  <span>Sales Tax ({pharmacySettings?.salesTaxPercent || 0}%):</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={salesTaxPercent}
                      onChange={(e) => setSalesTaxPercent(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                      className="w-20 px-2 py-1 border rounded text-right"
                      min="0"
                      max="100"
                      step="0.01"
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                </div>
                {salesTaxPercent > 0 && (
                  <div className="flex justify-between text-sm text-blue-600">
                    <span>Tax Amount:</span>
                    <span>+ PKR {calculateTax().toFixed(2)}</span>
                  </div>
                )}
                
                <div className="flex justify-between font-semibold text-lg border-t pt-2">
                  <span>Total:</span>
                  <span>PKR {calculateTotal().toFixed(2)}</span>
                </div>
                
                {/* Show default settings indicator */}
                {pharmacySettings && (pharmacySettings.billDiscountPercent > 0 || pharmacySettings.salesTaxPercent > 0) && (
                  <div className="text-xs text-gray-400 italic">
                    Using defaults from Settings
                  </div>
                )}
                
                <button
                  onClick={() => setShowPaymentModal(true)}
                  disabled={cart.length === 0}
                  className="w-full mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <FiShoppingCart className="mr-1" />
                  Process Sale
                </button>
              </div>
            </div>
          </div>
      </div>
    </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Payment Details</h3>
              <button onClick={() => setShowPaymentModal(false)}>
                <FiX size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="UPI">UPI</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>PKR {calculateSubtotal().toFixed(2)}</span>
                </div>
                {billDiscountPercent > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Bill Discount ({billDiscountPercent}%):</span>
                    <span className="text-green-600">- PKR {discount.toFixed(2)}</span>
                  </div>
                )}
                {salesTaxPercent > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Sales Tax ({salesTaxPercent}%):</span>
                    <span className="text-blue-600">+ PKR {calculateTax().toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span>Payment Charges:</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={paymentCharge}
                      onChange={(e)=>{ setPaymentCharge(Math.max(0, Number(e.target.value)||0)); setIsChargeManual(true); }}
                      className="w-24 px-2 py-1 border rounded text-right bg-white"
                    />
                    <button onClick={()=>setIsChargeManual(false)} className="text-xs text-blue-600 hover:underline">Auto</button>
                  </div>
                </div>
                <div className="flex justify-between font-semibold text-lg border-t pt-2 mt-2">
                  <span>Total Amount:</span>
                  <span>PKR {calculateTotal().toFixed(2)}</span>
                </div>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={processSale}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {isProcessing ? 'Processing...' : 'Complete Sale'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && lastSale && (
        <ReceiptGenerator
          sale={lastSale}
          hospitalSettings={hospitalSettings}
          onClose={() => setShowReceipt(false)}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
          toast.type === 'error' ? 'bg-red-500 text-white' :
          toast.type === 'success' ? 'bg-green-500 text-white' :
          toast.type === 'warning' ? 'bg-yellow-500 text-white' :
          'bg-blue-500 text-white'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
