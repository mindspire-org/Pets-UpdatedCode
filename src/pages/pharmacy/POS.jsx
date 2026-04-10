import React, { useState, useEffect, useRef } from 'react';
import { FiSearch, FiPlus, FiMinus, FiTrash2, FiPrinter, FiShoppingCart, FiX, FiGrid, FiList, FiEyeOff, FiMaximize2 } from 'react-icons/fi';
import { pharmacyMedicinesAPI, pharmacySalesAPI, settingsAPI, pharmacyDuesAPI, petsAPI, prescriptionsAPI } from '../../services/api';

export default function PharmacyPOS() {
  const [medicines, setMedicines] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [customerInfo, setCustomerInfo] = useState({
    customerName: '',
    customerContact: '',
    petName: '',
    patientId: '',
    clientId: '',
    species: '',
    breed: '',
    sex: '',
    age: '',
    weight: '',
    address: '',
    followUpDate: '',
    comments: ''
  });
  const [discounts, setDiscounts] = useState({ medicine: 0, surgical: 0, procedures: 0 });
  const [showReceipt, setShowReceipt] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [receivedAmount, setReceivedAmount] = useState('');
  const [previousDue, setPreviousDue] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [toast, setToast] = useState('');
  const [hospitalSettings, setHospitalSettings] = useState(null);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(-1);
  const receiptRef = useRef();
  const searchInputRef = useRef();
  const qtyInputRefs = useRef({});
  const priceInputRefs = useRef({});
  const discountInputRefs = useRef({});

  useEffect(() => {
    fetchMedicines();
    fetchHospitalSettings();
    loadPrescriptionData();
  }, []);

  // Reset selected index when search query changes
  useEffect(() => {
    if (!searchQuery) {
      setSelectedSearchIndex(-1);
    }
  }, [searchQuery]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedSearchIndex >= 0) {
      const dropdown = document.querySelector('.search-dropdown-pharmacy');
      const selectedItem = dropdown?.children[selectedSearchIndex];
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedSearchIndex]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F9' && cart.length > 0) {
        e.preventDefault();
        setShowPaymentModal(true);
      } else if (e.key === 'F10') {
        e.preventDefault();
        if (cart.length > 0 && window.confirm('Clear cart?')) {
          clearCart();
        }
      } else if (e.key === 'Escape') {
        if (showPaymentModal) {
          setShowPaymentModal(false);
        } else if (showReceipt) {
          setShowReceipt(false);
        } else if (searchQuery) {
          setSearchQuery('');
          setSelectedSearchIndex(-1);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [cart, searchQuery, showPaymentModal, showReceipt]);

  const fetchMedicines = async () => {
    try {
      const response = await pharmacyMedicinesAPI.getAll();
      setMedicines(response.data || []);
    } catch (error) {
      console.error('Error fetching medicines:', error);
    }
  };

  const fetchHospitalSettings = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const response = await settingsAPI.get(user.username || 'admin');
      setHospitalSettings(response.data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const loadPrescriptionData = () => {
    const posData = localStorage.getItem('pharmacy_pos_data');
    if (posData) {
      try {
        const data = JSON.parse(posData);
        if (Date.now() - data.timestamp < 300000) {
          setCustomerInfo(prev => ({
            ...prev,
            customerName: data.customerName || '',
            customerContact: data.customerContact || '',
            petName: data.petName || '',
            patientId: data.patientId || '',
            clientId: data.clientId || '',
            address: data.address || ''
          }));
          showToast(`Prescription loaded for ${data.petName || 'patient'}`);
        }
      } catch (error) {
        console.error('Error loading prescription data:', error);
      }
    }
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  };

  const searchMedicines = medicines.filter(m =>
    m.medicineName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.barcode?.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 10);

  const handleSearchKeyDown = (e) => {
    if (!searchQuery || searchMedicines.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSearchIndex(prev => 
          prev < searchMedicines.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSearchIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedSearchIndex >= 0 && selectedSearchIndex < searchMedicines.length) {
          addToCart(searchMedicines[selectedSearchIndex]);
          setSearchQuery('');
          setSelectedSearchIndex(-1);
        } else if (searchMedicines.length === 1) {
          addToCart(searchMedicines[0]);
          setSearchQuery('');
          setSelectedSearchIndex(-1);
        }
        break;
      case 'Tab':
        e.preventDefault();
        if (searchMedicines.length > 0) {
          addToCart(searchMedicines[0]);
          setSearchQuery('');
          setSelectedSearchIndex(-1);
        }
        break;
      case 'Escape':
        setSearchQuery('');
        setSelectedSearchIndex(-1);
        break;
      default:
        break;
    }
  };

  const addToCart = (medicine) => {
    const existing = cart.find(item => item.medicineId === medicine._id);
    if (existing) {
      updateQuantity(medicine._id, existing.quantity + 1);
    } else {
      setCart([...cart, {
        medicineId: medicine._id,
        medicineName: medicine.medicineName,
        barcode: medicine.barcode,
        batchNo: medicine.batchNo || 'N/A',
        quantity: 1,
        pricePerUnit: medicine.salePrice,
        minSalePrice: medicine.minSalePrice || 0,
        totalPrice: medicine.salePrice,
        availableStock: medicine.quantity,
        category: medicine.category || 'Medicine',
        unit: medicine.unit || 'Unit'
      }]);
    }
    // Focus on quantity input of the last item after adding
    setTimeout(() => {
      const lastMedicineId = existing ? medicine._id : medicine._id;
      qtyInputRefs.current[lastMedicineId]?.focus();
      qtyInputRefs.current[lastMedicineId]?.select();
    }, 100);
  };

  const updateQuantity = (medicineId, qty) => {
    if (qty < 1) return;
    const item = cart.find(i => i.medicineId === medicineId);
    if (item && qty > item.availableStock) {
      showToast(`Only ${item.availableStock} items available in stock`);
      return;
    }
    setCart(cart.map(item =>
      item.medicineId === medicineId
        ? { ...item, quantity: qty, totalPrice: (qty * item.pricePerUnit) * (1 - (item.discount || 0) / 100) }
        : item
    ));
  };

  const handleQuantityKeyDown = (e, medicineId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      priceInputRefs.current[medicineId]?.focus();
      priceInputRefs.current[medicineId]?.select();
    }
  };

  const handlePriceKeyDown = (e, medicineId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      discountInputRefs.current[medicineId]?.focus();
      discountInputRefs.current[medicineId]?.select();
    }
  };

  const handleDiscountKeyDown = (e, medicineId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchInputRef.current?.focus();
    }
  };

  const updatePrice = (medicineId, newPrice) => {
    const item = cart.find(i => i.medicineId === medicineId);
    if (!item) return;

    if (newPrice === '') {
      setCart(cart.map(item =>
        item.medicineId === medicineId
          ? { ...item, pricePerUnit: '', totalPrice: 0 }
          : item
      ));
      return;
    }

    let price = Number(newPrice);
    if (isNaN(price)) return;

    setCart(cart.map(item =>
      item.medicineId === medicineId
        ? { ...item, pricePerUnit: price, totalPrice: (item.quantity * price) * (1 - (item.discount || 0) / 100) }
        : item
    ));
  };

  const updateDiscount = (medicineId, disc) => {
    const item = cart.find(i => i.medicineId === medicineId);
    if (!item) return;

    const discount = Math.max(0, Math.min(100, Number(disc) || 0));
    const price = Number(item.pricePerUnit) || 0;
    const minPrice = item.minSalePrice || 0;

    // Calculate final price after discount
    const discountedPrice = price * (1 - discount / 100);

    // If discounted price is below minimum, calculate the maximum allowed discount percentage
    let finalDiscount = discount;
    if (price > 0 && discountedPrice < minPrice) {
      finalDiscount = Math.floor(((price - minPrice) / price) * 100);
      if (finalDiscount < 0) finalDiscount = 0;
      showToast(`Discount limited to ${finalDiscount}% to maintain Minimum Price (PKR ${minPrice})`);
    }

    setCart(cart.map(item =>
      item.medicineId === medicineId
        ? { ...item, discount: finalDiscount, totalPrice: (item.quantity * item.pricePerUnit) * (1 - finalDiscount / 100) }
        : item
    ));
  };

  const removeFromCart = (medicineId) => {
    setCart(cart.filter(item => item.medicineId !== medicineId));
  };

  const clearCart = () => {
    setCart([]);
    setCustomerInfo({
      customerName: '',
      customerContact: '',
      petName: '',
      patientId: '',
      clientId: '',
      species: '',
      breed: '',
      sex: '',
      age: '',
      weight: '',
      address: '',
      followUpDate: '',
      comments: ''
    });
    setPreviousDue(0);
    setReceivedAmount('');
    setDiscounts({ medicine: 0, surgical: 0, procedures: 0 });
  };

  const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const totalMinPrice = cart.reduce((sum, item) => sum + ((item.minSalePrice || 0) * item.quantity), 0);
  const totalDiscount = (discounts.medicine || 0) + (discounts.surgical || 0) + (discounts.procedures || 0);

  const maxTotalDiscountAmt = subtotal > 0 ? Math.max(0, subtotal - totalMinPrice) : 0;
  
  // Ensure total discount doesn't exceed max allowed to maintain min prices
  const effectiveTotalDiscount = Math.min(totalDiscount, maxTotalDiscountAmt);
  
  const payableTotal = subtotal - effectiveTotalDiscount + previousDue;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    try {
      // Final validation before checkout
      const invalidItem = cart.find(item => {
        const itemPrice = Number(item.pricePerUnit) || 0;
        const itemDiscountPct = Number(item.discount) || 0;
        const finalItemPrice = itemPrice * (1 - itemDiscountPct / 100);
        return finalItemPrice < (item.minSalePrice || 0);
      });

      if (invalidItem) {
        showToast(`Cannot checkout: ${invalidItem.medicineName} price is below minimum (PKR ${invalidItem.minSalePrice})`);
        return;
      }

      const saleData = {
        items: cart.map(item => ({
          medicineId: item.medicineId,
          medicineName: item.medicineName,
          quantity: item.quantity,
          pricePerUnit: item.pricePerUnit,
          totalPrice: item.totalPrice,
          unit: item.unit || 'Unit',
          category: item.category || 'Medicine',
          batchNo: item.batchNo || 'N/A'
        })),
        customerName: customerInfo.customerName || 'Walk-in Customer',
        customerContact: customerInfo.customerContact,
        patientId: customerInfo.patientId,
        subtotal,
        discount: totalDiscount,
        previousDue,
        totalAmount: payableTotal,
        receivedAmount: Number(receivedAmount) || payableTotal,
        paymentMethod,
        balanceDue: Math.max(0, payableTotal - (Number(receivedAmount) || payableTotal))
      };

      const response = await pharmacySalesAPI.create(saleData);
      setLastSale(response.data);
      setShowPaymentModal(false);
      setShowReceipt(true);
      clearCart();
      showToast('Sale completed successfully!');
      fetchMedicines();
    } catch (error) {
      console.error('Error processing sale:', error);
      showToast('Error processing sale. Please try again.');
    }
  };

  const printReceipt = () => {
    const printWindow = window.open('', '_blank', 'width=302,height=600');
    
    const receiptHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Receipt</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.4;
            color: #000;
            background: #fff;
            width: 80mm;
            padding: 5mm;
          }
          .center { text-align: center; }
          .right { text-align: right; }
          .bold { font-weight: bold; }
          .large { font-size: 16px; }
          .small { font-size: 10px; }
          .divider {
            border-top: 1px dashed #000;
            margin: 8px 0;
          }
          .solid-divider {
            border-top: 2px solid #000;
            margin: 8px 0;
          }
          table { width: 100%; border-collapse: collapse; margin: 8px 0; }
          th { text-align: left; border-bottom: 1px solid #000; padding: 4px 0; }
          td { padding: 4px 0; }
          .item-row td { border-bottom: 1px dotted #ccc; }
          .total-row { border-top: 2px solid #000; padding-top: 4px; }
        </style>
      </head>
      <body>
        <div class="center bold large">
          ${hospitalSettings?.companyName || 'Abbottabad Pet Hospital'}
        </div>
        <div class="center small">
          ${hospitalSettings?.address || ''}
        </div>
        <div class="center small">
          ${hospitalSettings?.phone ? `Tel: ${hospitalSettings.phone}` : ''}
        </div>
        
        <div class="solid-divider"></div>
        
        <div class="center bold">
          Receipt # ${lastSale?.invoiceNumber || '---'}
        </div>
        <div class="small">
          Customer: ${lastSale?.customerName || 'Walk-in'}<br>
          Date: ${new Date(lastSale?.createdAt).toLocaleString()}
        </div>
        
        <div class="divider"></div>
        
        <table>
          <thead>
            <tr>
              <th style="width: 50%;">Item</th>
              <th style="width: 15%; text-align: center;">Qty</th>
              <th style="width: 35%; text-align: right;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${lastSale.items.map(item => `
              <tr class="item-row">
                <td>${item.medicineName}</td>
                <td style="text-align: center;">${item.quantity}</td>
                <td style="text-align: right;">PKR ${item.totalPrice.toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="divider"></div>
        
        <table>
          <tr>
            <td>Subtotal:</td>
            <td class="right bold">PKR ${lastSale.subtotal.toLocaleString()}</td>
          </tr>
          ${lastSale.discount > 0 ? `
          <tr>
            <td>Discount:</td>
            <td class="right bold">-PKR ${lastSale.discount.toLocaleString()}</td>
          </tr>
          ` : ''}
          <tr class="total-row">
            <td class="bold large">Total:</td>
            <td class="right bold large">PKR ${lastSale.totalAmount.toLocaleString()}</td>
          </tr>
        </table>
        
        <div class="divider"></div>
        
        <div class="center small bold">
          Thank you for your visit!
        </div>
        
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 100);
          };
        </script>
      </body>
      </html>
    `;
    
    printWindow.document.write(receiptHTML);
    printWindow.document.close();
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 -m-6 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white px-6 py-4 flex items-center justify-between shadow-2xl z-10 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
            <FiShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Pharmacy POS</h1>
            <div className="text-xs text-purple-200 font-mono">
              {new Date().toLocaleDateString()} • {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm bg-white/10 backdrop-blur px-4 py-2 rounded-full">
            Welcome, <span className="font-semibold">Admin</span>
          </div>
          <button onClick={clearCart} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
            <FiX className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden p-6 gap-6">
        {/* Main Section - Left Side */}
        <div className="flex-1 flex flex-col gap-6 overflow-hidden">
          {/* Top: Product Selection / Input */}
          <div className="bg-white/80 backdrop-blur rounded-2xl shadow-xl border border-white/50 p-6 shrink-0">
            <div className="grid grid-cols-12 gap-4 items-end">
              <div className="col-span-3">
                <label className="block text-xs font-bold text-purple-600 uppercase mb-2 tracking-wider">Barcode</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Scan..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-3 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all font-mono text-sm"
                    autoFocus
                  />
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400 w-5 h-5" />
                </div>
              </div>
              <div className="col-span-5 relative">
                <label className="block text-xs font-bold text-purple-600 uppercase mb-2 tracking-wider">Medicine Name</label>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search medicines..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedSearchIndex(-1);
                  }}
                  onKeyDown={handleSearchKeyDown}
                  className="w-full px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm"
                  autoFocus
                />
                {/* Search Dropdown */}
                {searchQuery && searchMedicines.length > 0 && (
                  <div className="search-dropdown-pharmacy absolute left-0 right-0 top-full mt-2 bg-white/95 backdrop-blur border-2 border-purple-200 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-96 overflow-y-auto">
                    {searchMedicines.map((m, index) => (
                      <button
                        key={m._id}
                        onClick={() => { addToCart(m); setSearchQuery(''); setSelectedSearchIndex(-1); }}
                        className={`w-full flex items-center justify-between px-5 py-4 border-b border-purple-50 last:border-none transition-all group ${
                          index === selectedSearchIndex 
                            ? 'bg-gradient-to-r from-purple-100 to-blue-100 border-purple-200' 
                            : 'hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50'
                        }`}
                      >
                        <div className="text-left">
                          <div className={`font-bold text-base ${index === selectedSearchIndex ? 'text-purple-700' : 'text-slate-800 group-hover:text-purple-700'}`}>
                            {m.medicineName}
                          </div>
                          <div className="text-xs font-mono text-slate-500 uppercase mt-1">{m.barcode || 'No Barcode'}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-purple-600">PKR {m.salePrice}</div>
                          <div className={`text-xs font-semibold ${m.quantity > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            Stock: {m.quantity}
                          </div>
                        </div>
                      </button>
                    ))}
                    <div className="px-5 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-t-2 border-purple-100 text-xs text-purple-600 text-center font-semibold">
                      ↑↓ Navigate • Enter/Tab Add • Esc Close
                    </div>
                  </div>
                )}
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-bold text-purple-600 uppercase mb-2 tracking-wider">Qty</label>
                <input type="text" readOnly value="1" className="w-full px-3 py-3 bg-gradient-to-r from-slate-100 to-slate-50 border-2 border-slate-200 rounded-xl text-center font-bold text-sm" />
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-bold text-purple-600 uppercase mb-2 tracking-wider">Price</label>
                <input type="text" readOnly value="0" className="w-full px-3 py-3 bg-gradient-to-r from-slate-100 to-slate-50 border-2 border-slate-200 rounded-xl text-center text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-purple-600 uppercase mb-2 tracking-wider">Amount</label>
                <input type="text" readOnly value="0" className="w-full px-3 py-3 bg-gradient-to-r from-purple-100 to-blue-100 border-2 border-purple-300 rounded-xl text-center font-bold text-purple-700 text-sm" />
              </div>
            </div>
          </div>

          {/* Middle: Cart Table */}
          <div className="flex-1 bg-white/80 backdrop-blur rounded-2xl shadow-xl border border-white/50 flex flex-col overflow-hidden">
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white z-10 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-4 px-4 w-12 text-center">#</th>
                    <th className="py-4 px-4">Barcode</th>
                    <th className="py-4 px-4">Medicine Name</th>
                    <th className="py-4 px-4 w-32 text-center">Quantity</th>
                    <th className="py-4 px-4 w-32 text-right">Price</th>
                    <th className="py-4 px-4 w-24 text-center">Disc%</th>
                    <th className="py-4 px-4 w-32 text-right">Amount</th>
                    <th className="py-4 px-4 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-100">
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-24 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <div className="w-24 h-24 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mb-4">
                            <FiShoppingCart className="w-12 h-12 text-purple-400" />
                          </div>
                          <p className="text-xl font-bold text-slate-700 mb-2">Cart is empty</p>
                          <p className="text-sm text-slate-500">Scan barcode or search to add items</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    cart.map((item, idx) => (
                      <tr key={item.medicineId} className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 transition-all group">
                        <td className="py-4 px-4 text-center text-slate-400 font-mono text-sm font-bold">{idx + 1}</td>
                        <td className="py-4 px-4 text-purple-600 font-mono text-xs font-semibold">{item.barcode || '-'}</td>
                        <td className="py-4 px-4 font-semibold text-slate-800">{item.medicineName}</td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => updateQuantity(item.medicineId, item.quantity - 1)} className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-100 rounded-lg transition-all">
                              <FiMinus className="w-4 h-4" />
                            </button>
                            <input
                              ref={(el) => qtyInputRefs.current[item.medicineId] = el}
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateQuantity(item.medicineId, Number(e.target.value))}
                              onKeyDown={(e) => handleQuantityKeyDown(e, item.medicineId)}
                              className="w-16 text-center bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg py-1 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                            <button onClick={() => updateQuantity(item.medicineId, item.quantity + 1)} className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-100 rounded-lg transition-all">
                              <FiPlus className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <input
                            ref={(el) => priceInputRefs.current[item.medicineId] = el}
                            type="number"
                            value={item.pricePerUnit}
                            onBlur={(e) => {
                              const val = Number(e.target.value);
                              if (val < (item.minSalePrice || 0)) {
                                updatePrice(item.medicineId, item.minSalePrice || 0);
                              }
                            }}
                            onChange={(e) => updatePrice(item.medicineId, e.target.value)}
                            onKeyDown={(e) => handlePriceKeyDown(e, item.medicineId)}
                            className="w-28 text-right bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-purple-500 outline-none"
                          />
                        </td>
                        <td className="py-4 px-4 text-center">
                          <input
                            ref={(el) => discountInputRefs.current[item.medicineId] = el}
                            type="number"
                            min="0"
                            max="100"
                            value={item.discount || 0}
                            onChange={(e) => updateDiscount(item.medicineId, e.target.value)}
                            onKeyDown={(e) => handleDiscountKeyDown(e, item.medicineId)}
                            className="w-16 text-center bg-white border-2 border-purple-300 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-purple-500 font-bold text-purple-700"
                          />
                        </td>
                        <td className="py-4 px-4 text-right font-bold text-lg text-purple-600">
                          {Number(item.totalPrice).toLocaleString()}
                        </td>
                        <td className="py-4 px-4">
                          <button onClick={() => removeFromCart(item.medicineId)} className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                            <FiTrash2 className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom: Cart Footer */}
            <div className="bg-gradient-to-r from-purple-50 via-blue-50 to-indigo-50 border-t-2 border-purple-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-8 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-purple-600 uppercase font-bold text-xs">Ref:</span>
                  <input type="text" placeholder="---" className="bg-white/50 border-2 border-purple-200 rounded-lg focus:border-purple-500 outline-none px-2 py-1 w-24" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-purple-600 uppercase font-bold text-xs">Total Items:</span>
                  <span className="font-bold text-slate-800 text-lg">{cart.reduce((s,i) => s+i.quantity, 0)}</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-purple-600 uppercase font-bold text-xs">Total Amount:</span>
                <span className="text-3xl font-black bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent font-mono">
                  {subtotal.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar - Right Side */}
        <div className="w-96 flex flex-col gap-6 overflow-hidden">
          {/* Customer Section */}
          <div className="bg-white/80 backdrop-blur rounded-2xl shadow-xl border border-white/50 p-5 shrink-0">
            <h3 className="text-xs font-bold text-purple-600 uppercase mb-4 tracking-widest flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                <FiGrid className="w-3 h-3 text-white" />
              </div>
              Customer
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-purple-600 uppercase mb-2">Patient ID</label>
                <input
                  type="text"
                  value={customerInfo.patientId}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, patientId: e.target.value })}
                  placeholder="Enter ID..."
                  className="w-full px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-purple-600 uppercase mb-2">Name</label>
                <input
                  type="text"
                  value={customerInfo.customerName}
                  onChange={(e) => setCustomerInfo({...customerInfo, customerName: e.target.value})}
                  className="w-full px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  placeholder="Walk-in Customer"
                />
              </div>
            </div>
          </div>

          {/* Medicine Details Section */}
          <div className="bg-white/80 backdrop-blur rounded-2xl shadow-xl border border-white/50 p-5 flex-1 flex flex-col overflow-hidden">
            <h3 className="text-xs font-bold text-purple-600 uppercase mb-4 tracking-widest flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                <FiList className="w-3 h-3 text-white" />
              </div>
              Medicine Details
            </h3>
            {cart.length > 0 ? (
              <div className="space-y-4 text-sm overflow-y-auto">
                <div className="grid grid-cols-2 gap-y-3 bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-4 border-2 border-purple-100">
                  <div className="text-purple-600 font-semibold">Name</div>
                  <div className="font-bold text-slate-800 text-right">{cart[cart.length - 1]?.medicineName}</div>
                  <div className="text-purple-600 font-semibold">Batch</div>
                  <div className="font-mono text-xs text-right">{cart[cart.length - 1]?.batchNo || '-'}</div>
                  <div className="text-purple-600 font-semibold">Retail Price</div>
                  <div className="font-bold text-slate-800 text-right">{cart[cart.length - 1]?.pricePerUnit}</div>
                  <div className="text-purple-600 font-semibold">Available Stock</div>
                  <div className="font-bold text-emerald-600 text-right">{cart[cart.length - 1]?.availableStock || 0}</div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                <FiEyeOff className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm italic">Select an item to view details</p>
              </div>
            )}
          </div>

          {/* Totals Section */}
          <div className="bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 rounded-2xl shadow-2xl p-6 text-white space-y-5 shrink-0">
            <h3 className="text-xs font-black text-purple-200 uppercase tracking-[0.2em]">Total</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-purple-200">Gross</span>
                <span className="font-mono text-xl font-bold">{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-purple-200">Medicine Disc</span>
                <input
                  type="number"
                  value={discounts.medicine}
                  onChange={(e) => setDiscounts({ ...discounts, medicine: Number(e.target.value) })}
                  className="w-24 bg-white/20 backdrop-blur border-2 border-white/30 rounded-lg px-3 py-1 text-right font-mono focus:ring-2 focus:ring-white/50 outline-none"
                />
              </div>
              {previousDue > 0 && (
                <div className="flex justify-between items-center text-amber-300">
                  <span>Prev. Receivable</span>
                  <span className="font-mono font-bold">{previousDue.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="pt-5 border-t-2 border-white/20">
              <div className="text-xs font-bold text-purple-200 uppercase mb-2">Net Value</div>
              <div className="text-5xl font-black text-white font-mono text-right tracking-tighter drop-shadow-lg">
                {payableTotal.toLocaleString()}
              </div>
            </div>

            <div className="pt-5 flex flex-col gap-3">
              <button
                onClick={() => setShowPaymentModal(true)}
                disabled={cart.length === 0}
                className="w-full py-4 bg-white text-purple-600 hover:bg-purple-50 disabled:bg-white/20 disabled:text-white/50 rounded-xl font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3"
              >
                <FiShoppingCart className="w-5 h-5" />
                Process Payment
              </button>
              <div className="flex justify-between text-[9px] text-purple-200 font-semibold px-1">
                <span>F2: Search | F9: Pay | F10: Clear</span>
                <span>{new Date().toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-800">Process Payment</h2>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600">
                <FiX className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Customer Name</label>
                <input
                  type="text"
                  placeholder="Customer full name"
                  value={customerInfo.customerName}
                  onChange={(e) => setCustomerInfo({...customerInfo, customerName: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Customer Phone Number</label>
                <input
                  type="text"
                  placeholder="Phone number"
                  value={customerInfo.customerContact}
                  onChange={(e) => setCustomerInfo({...customerInfo, customerContact: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Mobile Wallet">Mobile Wallet</option>
                </select>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Subtotal:</span>
                  <span className="font-semibold">PKR {subtotal.toLocaleString()}</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount:</span>
                    <span>-PKR {totalDiscount.toLocaleString()}</span>
                  </div>
                )}
                {previousDue > 0 && (
                  <div className="flex justify-between text-sm text-amber-600">
                    <span>Previous Due:</span>
                    <span>PKR {previousDue.toLocaleString()}</span>
                  </div>
                )}
                <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-lg">
                  <span>Total Payable:</span>
                  <span>PKR {payableTotal.toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Amount Received</label>
                <input
                  type="number"
                  placeholder={`Default PKR ${payableTotal.toLocaleString()}`}
                  value={receivedAmount}
                  onChange={(e) => setReceivedAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-semibold"
                >
                  Close
                </button>
                <button
                  onClick={handleCheckout}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
                >
                  Process Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && lastSale && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FiPrinter className="w-5 h-5 text-blue-400" />
                <span className="font-bold text-white">Sales Receipt</span>
              </div>
              <button onClick={() => setShowReceipt(false)} className="text-slate-400 hover:text-white transition-colors">
                <FiX className="w-5 h-5"/>
              </button>
            </div>
            
            <div ref={receiptRef} className="p-6 bg-white">
              <div className="text-center border-b-2 border-slate-800 pb-4 mb-4">
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-wide">
                  {hospitalSettings?.companyName || 'Abbottabad Pet Hospital'}
                </h2>
                <p className="text-xs text-slate-600 mt-1">{hospitalSettings?.address}</p>
                <p className="text-xs text-slate-600">{hospitalSettings?.phone ? `Tel: ${hospitalSettings.phone}` : ''}</p>
                <div className="mt-2 text-xs font-mono bg-slate-100 inline-block px-3 py-1 rounded">
                  Receipt # {lastSale?.invoiceNumber || '---'}
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-3 mb-4 text-xs">
                <div className="grid grid-cols-2 gap-y-1">
                  <span className="text-slate-500">Customer:</span>
                  <span className="font-semibold text-right">{lastSale?.customerName || 'Walk-in'}</span>
                  <span className="text-slate-500">Date:</span>
                  <span className="font-semibold text-right">{new Date(lastSale?.createdAt).toLocaleString()}</span>
                </div>
              </div>

              <table className="w-full text-xs mb-4">
                <thead className="border-b border-slate-200 text-slate-500 uppercase">
                  <tr>
                    <th className="py-2 text-left">Item</th>
                    <th className="py-2 text-center">Qty</th>
                    <th className="py-2 text-right">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lastSale.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2">{item.medicineName}</td>
                      <td className="py-2 text-center">{item.quantity}</td>
                      <td className="py-2 text-right">{item.totalPrice.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-t-2 border-slate-100 pt-4 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Subtotal:</span>
                  <span className="font-bold">PKR {lastSale.subtotal.toLocaleString()}</span>
                </div>
                {lastSale.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount:</span>
                    <span className="font-bold">-PKR {lastSale.discount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-black border-t border-slate-200 pt-2 mt-2">
                  <span>Total:</span>
                  <span>PKR {lastSale.totalAmount.toLocaleString()}</span>
                </div>
              </div>

              <div className="mt-8 text-center border-t border-dashed border-slate-300 pt-4">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Thank you for your visit!</p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 flex gap-2">
              <button onClick={printReceipt} className="flex-1 py-2 bg-slate-800 text-white rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-slate-900 transition-colors">
                <FiPrinter className="w-4 h-4" /> Print
              </button>
              <button onClick={() => setShowReceipt(false)} className="flex-1 py-2 border border-slate-300 text-slate-700 rounded-lg font-bold hover:bg-white transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl z-[100] flex items-center gap-3 animate-bounce">
          <div className="w-2 h-2 rounded-full bg-blue-400"></div>
          {toast}
        </div>
      )}
    </div>
  );
}
