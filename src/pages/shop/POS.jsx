import React, { useState, useEffect, useRef } from 'react';
import { FiSearch, FiPlus, FiMinus, FiTrash2, FiPrinter, FiShoppingCart, FiX, FiGrid, FiList } from 'react-icons/fi';
import { productsAPI, salesAPI, settingsAPI } from '../../services/api';

export default function POS() {
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [customerInfo, setCustomerInfo] = useState({
    customerId: '',
    customerName: '',
    customerContact: ''
  });
  const [discount, setDiscount] = useState(0);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(-1);

  const [lastSale, setLastSale] = useState(null);
  const [toast, setToast] = useState('');
  const [hospitalSettings, setHospitalSettings] = useState(null);
  const [allSales, setAllSales] = useState([]);
  const [receivedAmount, setReceivedAmount] = useState('');
  const [previousDue, setPreviousDue] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const receiptRef = useRef();
  const searchInputRef = useRef();
  const qtyInputRefs = useRef({});
  const priceInputRefs = useRef({});
  const discountInputRefs = useRef({});

  // Exchange Modal States
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const [exchangeCustomerId, setExchangeCustomerId] = useState('');
  const [exchangeCustomerSales, setExchangeCustomerSales] = useState([]);
  const [selectedExchangeItems, setSelectedExchangeItems] = useState([]);
  const [exchangeMappings, setExchangeMappings] = useState([]);
  const [exchangeStep, setExchangeStep] = useState(1);
  const [exchangeLoading, setExchangeLoading] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchHospitalSettings();
    fetchAllSales();
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
      const dropdown = document.querySelector('.search-dropdown');
      const selectedItem = dropdown?.children[selectedSearchIndex];
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedSearchIndex]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // F2 - Focus search
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // F9 - Process Payment (if cart has items)
      else if (e.key === 'F9' && cart.length > 0) {
        e.preventDefault();
        setShowPaymentModal(true);
      }
      // F10 - Clear cart
      else if (e.key === 'F10') {
        e.preventDefault();
        if (cart.length > 0 && window.confirm('Clear cart?')) {
          clearCart();
        }
      }
      // Escape - Close modals or clear search
      else if (e.key === 'Escape') {
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

  const fetchProducts = async () => {
    try {
      const response = await productsAPI.getAll();
      setProducts(response.data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchAllSales = async () => {
    try {
      const resp = await salesAPI.getAll();
      setAllSales(resp.data || []);
    } catch (e) {
      console.error('Error loading sales list', e);
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

  const showToastMessage = (message) => {
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  };

  const searchProducts = products.filter(p =>
    p.itemName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.barcode?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSearchKeyDown = (e) => {
    if (!searchQuery || searchProducts.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSearchIndex(prev => 
          prev < searchProducts.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSearchIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedSearchIndex >= 0 && selectedSearchIndex < searchProducts.length) {
          addToCart(searchProducts[selectedSearchIndex]);
          setSearchQuery('');
          setSelectedSearchIndex(-1);
        } else if (searchProducts.length === 1) {
          addToCart(searchProducts[0]);
          setSearchQuery('');
          setSelectedSearchIndex(-1);
        }
        break;
      case 'Tab':
        e.preventDefault();
        if (searchProducts.length > 0) {
          addToCart(searchProducts[0]);
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

  const addToCart = (product) => {
    const existing = cart.find(item => item.productId === product._id);
    if (existing) {
      setCart(cart.map(item =>
        item.productId === product._id
          ? { ...item, quantity: item.quantity + 1, totalPrice: (item.quantity + 1) * item.salePrice }
          : item
      ));
    } else {
      setCart([...cart, {
        productId: product._id,
        itemName: product.itemName,
        quantity: 1,
        salePrice: product.salePrice,
        minSalePrice: product.minSalePrice || 0,
        totalPrice: product.salePrice,
        barcode: product.barcode,
        availableStock: product.quantity,
        discount: 0
      }]);
    }
    // Focus on quantity input of the last item after adding
    setTimeout(() => {
      const lastProductId = existing ? product._id : product._id;
      qtyInputRefs.current[lastProductId]?.focus();
      qtyInputRefs.current[lastProductId]?.select();
    }, 100);
  };

  const updatePrice = (productId, newPrice) => {
    const item = cart.find(i => i.productId === productId);
    if (!item) return;

    // Allow empty string for better UX during editing - user can delete everything
    if (newPrice === '') {
      setCart(cart.map(item =>
        item.productId === productId
          ? { ...item, salePrice: '', totalPrice: 0 }
          : item
      ));
      return;
    }

    let price = Number(newPrice);
    if (isNaN(price)) return;

    // We allow typing lower values for now, but will snap on blur
    setCart(cart.map(item =>
      item.productId === productId
        ? { ...item, salePrice: price, totalPrice: item.quantity * price }
        : item
    ));
  };

  const updateQuantity = (productId, qty) => {
    if (qty < 1) return;
    const item = cart.find(i => i.productId === productId);
    if (item && qty > item.availableStock) {
      showToastMessage(`Only ${item.availableStock} items available in stock`);
      return;
    }
    setCart(cart.map(item =>
      item.productId === productId
        ? { ...item, quantity: qty, totalPrice: qty * item.salePrice }
        : item
    ));
  };

  const handleQuantityKeyDown = (e, productId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      priceInputRefs.current[productId]?.focus();
      priceInputRefs.current[productId]?.select();
    }
  };

  const handlePriceKeyDown = (e, productId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      discountInputRefs.current[productId]?.focus();
      discountInputRefs.current[productId]?.select();
    }
  };

  const handleDiscountKeyDown = (e, productId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchInputRef.current?.focus();
    }
  };

  const updateItemDiscount = (productId, disc) => {
    const item = cart.find(i => i.productId === productId);
    if (!item) return;

    const discount = Math.max(0, Math.min(100, disc));
    const price = Number(item.salePrice) || 0;
    const minPrice = item.minSalePrice || 0;

    // Calculate final price after discount
    const discountedPrice = price * (1 - discount / 100);

    // If discounted price is below minimum, calculate the maximum allowed discount percentage
    let finalDiscount = discount;
    if (price > 0 && discountedPrice < minPrice) {
      // Calculate exact percentage: (price - minPrice) / price * 100
      // Use floor to stay safe and not go below minPrice
      finalDiscount = Math.floor(((price - minPrice) / price) * 100);
      if (finalDiscount < 0) finalDiscount = 0;
      showToastMessage(`Discount limited to ${finalDiscount}% to maintain Minimum Price (PKR ${minPrice})`);
    }

    setCart(cart.map(item =>
      item.productId === productId
        ? { ...item, discount: finalDiscount }
        : item
    ));
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setCustomerInfo({ customerId: '', customerName: '', customerContact: '' });
    setPreviousDue(0);
    setReceivedAmount('');
  };

  const subtotal = cart.reduce((sum, item) => {
    const itemDiscount = (item.totalPrice * (item.discount || 0)) / 100;
    return sum + (item.totalPrice - itemDiscount);
  }, 0);

  // Calculate sum of minimum prices for all items in cart
  const totalMinPrice = cart.reduce((sum, item) => sum + ((item.minSalePrice || 0) * item.quantity), 0);

  const maxTotalDiscountPct = subtotal > 0 ? Math.floor((1 - totalMinPrice / subtotal) * 100) : 0;
  
  // Ensure discount doesn't exceed max allowed
  const effectiveDiscount = Math.min(discount, Math.max(0, maxTotalDiscountPct));
  
  const discountAmount = (subtotal * effectiveDiscount) / 100;
  const payableTotal = subtotal - discountAmount + previousDue;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    try {
      // Final validation before checkout
      const invalidItem = cart.find(item => Number(item.salePrice) < (item.minSalePrice || 0));
      if (invalidItem) {
        showToastMessage(`Cannot checkout: ${invalidItem.itemName} price is below minimum (PKR ${invalidItem.minSalePrice})`);
        return;
      }

      const saleData = {
        items: cart.map(item => ({
          productId: item.productId,
          itemName: item.itemName,
          quantity: item.quantity,
          unitPrice: item.salePrice,
          totalPrice: item.totalPrice
        })),
        customerId: customerInfo.customerId || 'WALK-IN',
        customerName: customerInfo.customerName || 'Walk-in Customer',
        customerContact: customerInfo.customerContact,
        subtotal,
        discount,
        previousDue,
        totalAmount: payableTotal,
        receivedAmount: Number(receivedAmount) || payableTotal,
        paymentMethod,
        balanceDue: Math.max(0, payableTotal - (Number(receivedAmount) || payableTotal))
      };

      const response = await salesAPI.create(saleData);
      setLastSale(response.data);
      setShowPaymentModal(false);
      setShowReceipt(true);
      clearCart();
      showToastMessage('Sale completed successfully!');
      fetchProducts();
      fetchAllSales();
    } catch (error) {
      console.error('Error processing sale:', error);
      showToastMessage('Error processing sale. Please try again.');
    }
  };

  const printReceipt = () => {
    const printWindow = window.open('', '_blank');
    const receiptContent = receiptRef.current.innerHTML;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Receipt</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            width: 80mm;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.4;
          }
          @media print {
            body {
              width: 80mm;
            }
          }
        </style>
      </head>
      <body>
        ${receiptContent}
      </body>
      </html>
    `);
    
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Exchange functions
  const openExchangeModal = () => {
    setShowExchangeModal(true);
    setExchangeStep(1);
    setExchangeCustomerId('');
    setExchangeCustomerSales([]);
    setSelectedExchangeItems([]);
    setExchangeMappings([]);
  };

  const closeExchangeModal = () => {
    setShowExchangeModal(false);
    setExchangeStep(1);
    setExchangeCustomerId('');
    setExchangeCustomerSales([]);
    setSelectedExchangeItems([]);
    setExchangeMappings([]);
  };

  const fetchCustomerPurchaseHistory = async () => {
    if (!exchangeCustomerId.trim()) {
      showToastMessage('Please enter Customer ID');
      return;
    }
    try {
      setExchangeLoading(true);
      const response = await salesAPI.getAll();
      const allSales = response.data || [];
      const customerSales = allSales.filter(sale =>
        (sale.customerId || '').toLowerCase() === exchangeCustomerId.trim().toLowerCase()
      ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setExchangeCustomerSales(customerSales);
      if (customerSales.length === 0) {
        showToastMessage('No purchase history found for this customer');
      } else {
        setExchangeStep(2);
        showToastMessage(`Found ${customerSales.length} purchase(s)`);
      }
    } catch (error) {
      console.error('Error fetching customer history:', error);
      showToastMessage('Error fetching purchase history');
    } finally {
      setExchangeLoading(false);
    }
  };

  const toggleExchangeItem = (sale, item) => {
    const itemKey = `${sale._id}-${item.itemName}`;
    const exists = selectedExchangeItems.find(i => i.key === itemKey);
    if (exists) {
      setSelectedExchangeItems(prev => prev.filter(i => i.key !== itemKey));
    } else {
      setSelectedExchangeItems(prev => [...prev, { key: itemKey, sale, item, qty: item.quantity || 1 }]);
    }
  };

  const proceedToSelectNewProducts = () => {
    if (selectedExchangeItems.length === 0) {
      showToastMessage('Please select at least one medicine to exchange');
      return;
    }
    const initialMappings = selectedExchangeItems.map(({ item, qty }) => ({
      oldItem: item,
      newProduct: null,
      qty: qty
    }));
    setExchangeMappings(initialMappings);
    setExchangeStep(3);
  };

  const selectNewProductForMapping = (index, product) => {
    setExchangeMappings(prev => prev.map((m, i) => i === index ? { ...m, newProduct: product } : m));
  };

  const processExchange = async () => {
    setExchangeLoading(true);
    setTimeout(() => {
      setExchangeLoading(false);
      closeExchangeModal();
      showToastMessage('Exchange processed successfully');
    }, 1000);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-100 -m-6 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-800 text-white px-6 py-3 flex items-center justify-between shadow-lg z-10 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-tight">CASH TILL</h1>
          <div className="h-6 w-px bg-slate-600"></div>
          <div className="text-sm font-mono text-slate-300">
            {new Date().toISOString().slice(0,10).replace(/-/g,'.')}.{Math.floor(Date.now()/100000).toString().slice(-6)}.S
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm">
            Welcome, <span className="font-semibold text-blue-300">Admin</span>
          </div>
          <button onClick={clearCart} className="p-1.5 hover:bg-slate-700 rounded-md transition-colors text-slate-300 hover:text-white">
            <FiX className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden p-4 gap-4">
        {/* Main Section - Left Side */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Top: Product Selection / Input */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 shrink-0">
            <div className="grid grid-cols-12 gap-4 items-end">
              <div className="col-span-3">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Barcode</label>
                <div className="relative">
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Scan..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSelectedSearchIndex(-1);
                    }}
                    onKeyDown={handleSearchKeyDown}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all font-mono text-sm"
                    autoFocus
                  />
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
              <div className="col-span-5 relative">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Product Name</label>
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedSearchIndex(-1);
                  }}
                  onKeyDown={handleSearchKeyDown}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                />
                {/* Search Dropdown */}
                {searchQuery && searchProducts.length > 0 && (
                  <div className="search-dropdown absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden max-h-80 overflow-y-auto">
                    {searchProducts.map((p, index) => (
                      <button
                        key={p._id}
                        onClick={() => { addToCart(p); setSearchQuery(''); setSelectedSearchIndex(-1); }}
                        className={`w-full flex items-center justify-between px-4 py-3 border-b border-slate-50 last:border-none transition-colors group ${
                          index === selectedSearchIndex 
                            ? 'bg-blue-100 border-blue-200' 
                            : 'hover:bg-blue-50'
                        }`}
                      >
                        <div className="text-left">
                          <div className={`font-bold ${index === selectedSearchIndex ? 'text-blue-700' : 'text-slate-800 group-hover:text-blue-700'}`}>
                            {p.itemName}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500 uppercase">{p.barcode || 'No Barcode'}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold text-blue-600">PKR {p.salePrice}</div>
                          <div className={`text-[10px] ${p.quantity > 0 ? 'text-emerald-600' : 'text-red-600'}`}>Stock: {p.quantity}</div>
                        </div>
                      </button>
                    ))}
                    <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 text-center">
                      ↑↓ Navigate • Enter/Tab Add • Esc Close
                    </div>
                  </div>
                )}
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Qty</label>
                <input type="text" readOnly value="1" className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-center font-bold text-sm" />
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Price</label>
                <input type="text" readOnly value="0" className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-center text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Amount</label>
                <input type="text" readOnly value="0" className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-center font-bold text-blue-600 text-sm" />
              </div>
            </div>
          </div>

          {/* Middle: Cart Table */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-800 text-white z-10 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Barcode</th>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4 w-24 text-center">Qty</th>
                    <th className="py-3 px-4 w-32 text-right">Price</th>
                    <th className="py-3 px-4 w-24 text-center">Disc%</th>
                    <th className="py-3 px-4 w-32 text-right">Amount</th>
                    <th className="py-3 px-4 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-20 text-center text-slate-400">
                        <FiShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-10" />
                        <p className="text-lg font-medium">Cart is empty</p>
                        <p className="text-sm">Scan barcode or search to add items</p>
                      </td>
                    </tr>
                  ) : (
                    cart.map((item, idx) => (
                      <tr key={item.productId} className="hover:bg-blue-50/50 transition-colors group">
                        <td className="py-3 px-4 text-center text-slate-400 font-mono text-xs">{idx + 1}</td>
                        <td className="py-3 px-4 text-slate-500 font-mono text-xs">{item.barcode || '-'}</td>
                        <td className="py-3 px-4 font-medium text-slate-800">{item.itemName}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => updateQuantity(item.productId, item.quantity - 1)} className="p-1 text-slate-400 hover:text-blue-600 transition-colors">
                              <FiMinus className="w-3 h-3" />
                            </button>
                            <input
                              ref={(el) => qtyInputRefs.current[item.productId] = el}
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateQuantity(item.productId, Number(e.target.value))}
                              onKeyDown={(e) => handleQuantityKeyDown(e, item.productId)}
                              className="w-12 text-center bg-transparent font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                            />
                            <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} className="p-1 text-slate-400 hover:text-blue-600 transition-colors">
                              <FiPlus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <input
                            ref={(el) => priceInputRefs.current[item.productId] = el}
                            type="number"
                            value={item.salePrice}
                            onBlur={(e) => {
                              const val = Number(e.target.value);
                              if (val < (item.minSalePrice || 0)) {
                                updatePrice(item.productId, item.minSalePrice || 0);
                              }
                            }}
                            onChange={(e) => updatePrice(item.productId, e.target.value)}
                            onKeyDown={(e) => handlePriceKeyDown(e, item.productId)}
                            className="w-24 text-right bg-slate-50 border border-slate-200 rounded px-2 py-1 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </td>
                        <td className="py-3 px-4 text-center">
                          <input
                            ref={(el) => discountInputRefs.current[item.productId] = el}
                            type="number"
                            min="0"
                            max="100"
                            value={item.discount || 0}
                            onChange={(e) => updateItemDiscount(item.productId, Number(e.target.value))}
                            onKeyDown={(e) => handleDiscountKeyDown(e, item.productId)}
                            className="w-14 text-center bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-xs focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-blue-600">
                          {Number((item.totalPrice || 0) * (1 - (item.discount || 0) / 100)).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <button onClick={() => removeFromCart(item.productId)} className="p-1.5 text-slate-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all">
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom: Cart Footer */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-8 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 uppercase font-bold text-[10px]">Ref:</span>
                  <input type="text" placeholder="---" className="bg-transparent border-b border-slate-300 focus:border-blue-500 outline-none px-1 w-24" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 uppercase font-bold text-[10px]">Total Items:</span>
                  <span className="font-bold text-slate-800">{cart.reduce((s,i) => s+i.quantity, 0)}</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-slate-500 uppercase font-bold text-[10px]">Total Amount:</span>
                <span className="text-2xl font-black text-slate-900 font-mono">
                  {subtotal.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar - Right Side */}
        <div className="w-96 flex flex-col gap-4 overflow-hidden">
          {/* Customer Section */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 shrink-0">
            <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 tracking-widest">Customer</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">ID</label>
                <input
                  type="text"
                  value={customerInfo.customerId}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    setCustomerInfo({ ...customerInfo, customerId: v });
                    if (v) {
                      const due = (allSales||[]).filter(s => (s.customerId||'').toLowerCase() === v.toLowerCase()).reduce((sum, s) => sum + Math.max(0, (s.balanceDue||0)), 0);
                      setPreviousDue(due);
                    } else {
                      setPreviousDue(0);
                    }
                  }}
                  placeholder="Enter ID..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Name</label>
                <input
                  type="text"
                  value={customerInfo.customerName}
                  onChange={(e) => setCustomerInfo({...customerInfo, customerName: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                  placeholder="Walk-in Customer"
                />
              </div>
            </div>
          </div>

          {/* Product Details Section */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex-1 flex flex-col overflow-hidden">
            <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 tracking-widest">Product Details</h3>
            {cart.length > 0 ? (
              <div className="space-y-4 text-sm overflow-y-auto">
                <div className="grid grid-cols-2 gap-y-3 border-b border-slate-50 pb-4">
                  <div className="text-slate-500">Name</div>
                  <div className="font-bold text-slate-800">{cart[cart.length - 1]?.itemName}</div>
                  <div className="text-slate-500">Barcode</div>
                  <div className="font-mono text-xs">{cart[cart.length - 1]?.barcode || '-'}</div>
                  <div className="text-slate-500">Retail Price</div>
                  <div className="font-bold text-slate-800">{cart[cart.length - 1]?.salePrice}</div>
                  <div className="text-slate-500">Pack Size</div>
                  <div>1</div>
                  <div className="text-slate-500">Pack Value</div>
                  <div>0</div>
                  <div className="text-slate-500">Department</div>
                  <div className="text-blue-600 font-medium">General</div>
                  <div className="text-slate-500">Message</div>
                  <div className="text-xs italic text-slate-400">---</div>
                  <div className="text-slate-500">Available Stock</div>
                  <div className="font-bold text-emerald-600">{cart[cart.length - 1]?.availableStock || 0}</div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-300 italic text-sm">
                Select an item to view details
              </div>
            )}
          </div>

          {/* Totals Section */}
          <div className="bg-slate-800 rounded-xl shadow-lg p-5 text-white space-y-4 shrink-0">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Total</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Gross</span>
                <span className="font-mono text-lg">{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Bill Discount (%)</span>
                <div className="flex flex-col items-end">
                  <input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                    className={`w-20 bg-slate-700 border rounded px-2 py-0.5 text-right font-mono ${discount > effectiveDiscount ? 'border-red-500 text-red-400' : 'border-slate-600'}`}
                  />
                  {maxTotalDiscountPct >= 0 && (
                    <span className="text-[9px] text-slate-500 mt-1 uppercase">Max allowed: {maxTotalDiscountPct}%</span>
                  )}
                </div>
              </div>
              {previousDue > 0 && (
                <div className="flex justify-between items-center text-amber-400">
                  <span>Prev. Receivable</span>
                  <span className="font-mono">{previousDue.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-700">
              <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Net Value</div>
              <div className="text-5xl font-black text-blue-400 font-mono text-right tracking-tighter">
                {payableTotal.toLocaleString()}
              </div>
            </div>

            <div className="pt-4 flex flex-col gap-2">
              <button
                onClick={() => setShowPaymentModal(true)}
                disabled={cart.length === 0}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20 active:scale-95 flex items-center justify-center gap-3"
              >
                <FiShoppingCart className="w-5 h-5" />
                Process Payment
              </button>
              <div className="flex justify-between text-[9px] text-slate-500 font-bold uppercase px-1">
                <span>Enter: Qty→Price→Disc→Search | F9: Pay | F10: Clear</span>
                <span>{new Date().toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl z-[100] flex items-center gap-3 animate-bounce">
          <div className="w-2 h-2 rounded-full bg-blue-400"></div>
          {toast}
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleCheckout();
            }
          }}
        >
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
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount ({discount}%):</span>
                    <span>-PKR {((subtotal * discount) / 100).toLocaleString()}</span>
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
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2"
                >
                  Process Payment
                  <span className="text-xs opacity-75">(Enter)</span>
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
            
            <div ref={receiptRef} className="p-0 bg-white" style={{ width: '80mm', fontFamily: 'monospace', fontSize: '12px' }}>
              {/* Thermal Receipt Content */}
              <div style={{ padding: '10mm 5mm' }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    {hospitalSettings?.companyName || 'ABBOTTABAD PET HOSPITAL'}
                  </div>
                  <div style={{ fontSize: '11px', marginTop: '2px' }}>
                    {hospitalSettings?.address || 'Main Boulevard, Gulshan-e-Iqbal'}
                  </div>
                  <div style={{ fontSize: '11px' }}>
                    Tel: {hospitalSettings?.phone || '+92-XXX-XXXXXXX'}
                  </div>
                </div>

                {/* Divider */}
                <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }}></div>

                {/* Receipt Info */}
                <div style={{ fontSize: '11px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span>Receipt #:</span>
                    <span style={{ fontWeight: 'bold' }}>{lastSale?.invoiceNumber || Math.random().toString(36).substr(2, 9).toUpperCase()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span>Customer ID:</span>
                    <span>{lastSale?.customerId || 'WALK-IN'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span>Customer:</span>
                    <span>{lastSale?.customerName || 'Walk-in Customer'}</span>
                  </div>
                  {lastSale?.customerContact && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span>Phone:</span>
                      <span>{lastSale.customerContact}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Date:</span>
                    <span>{new Date(lastSale?.createdAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                {/* Divider */}
                <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }}></div>

                {/* Items Header */}
                <div style={{ fontSize: '11px', fontWeight: 'bold', display: 'flex', borderBottom: '1px solid #000', paddingBottom: '4px', marginBottom: '4px' }}>
                  <div style={{ flex: '1' }}>Item</div>
                  <div style={{ width: '40px', textAlign: 'center' }}>Qty</div>
                  <div style={{ width: '60px', textAlign: 'right' }}>Price</div>
                  <div style={{ width: '70px', textAlign: 'right' }}>Amount</div>
                </div>

                {/* Items */}
                <div style={{ fontSize: '11px', marginBottom: '8px' }}>
                  {lastSale?.items?.map((item, idx) => (
                    <div key={idx} style={{ marginBottom: '4px' }}>
                      <div style={{ display: 'flex' }}>
                        <div style={{ flex: '1', fontWeight: '500' }}>{item.itemName}</div>
                        <div style={{ width: '40px', textAlign: 'center' }}>{item.quantity}</div>
                        <div style={{ width: '60px', textAlign: 'right' }}>{Number(item.unitPrice).toFixed(0)}</div>
                        <div style={{ width: '70px', textAlign: 'right', fontWeight: 'bold' }}>{Number(item.totalPrice).toFixed(0)}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Divider */}
                <div style={{ borderTop: '2px solid #000', margin: '8px 0' }}></div>

                {/* Totals */}
                <div style={{ fontSize: '11px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span>Subtotal:</span>
                    <span style={{ fontWeight: 'bold' }}>Rs {(lastSale?.subtotal || 0).toFixed(2)}</span>
                  </div>
                  {lastSale?.discount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span>Discount ({lastSale.discount}%):</span>
                      <span style={{ fontWeight: 'bold' }}>-Rs {(((Number(lastSale?.subtotal || 0) * Number(lastSale?.discount || 0)) / 100) || 0).toFixed(2)}</span>
                    </div>
                  )}
                  {lastSale?.previousDue > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span>Previous Due:</span>
                      <span style={{ fontWeight: 'bold' }}>Rs {(lastSale?.previousDue || 0).toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {/* Grand Total */}
                <div style={{ borderTop: '2px solid #000', paddingTop: '6px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold' }}>
                    <span>TOTAL:</span>
                    <span>Rs {(lastSale?.totalAmount || 0).toFixed(2)}</span>
                  </div>
                </div>

                {/* Payment Info */}
                <div style={{ fontSize: '11px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span>Paid ({lastSale?.paymentMethod || 'Cash'}):</span>
                    <span style={{ fontWeight: 'bold' }}>Rs {(lastSale?.receivedAmount || 0).toFixed(2)}</span>
                  </div>
                  {lastSale?.balanceDue > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                      <span>Balance Due:</span>
                      <span>Rs {(lastSale?.balanceDue || 0).toFixed(2)}</span>
                    </div>
                  )}
                  {(lastSale?.receivedAmount || 0) > (lastSale?.totalAmount || 0) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Change:</span>
                      <span style={{ fontWeight: 'bold' }}>Rs {((lastSale?.receivedAmount || 0) - (lastSale?.totalAmount || 0)).toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div style={{ borderTop: '1px dashed #000', margin: '10px 0' }}></div>

                {/* Barcode */}
                <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0' }}>
                  <svg width="200" height="50" viewBox="0 0 200 50">
                    <rect x="10" y="5" width="3" height="40" fill="#000"/>
                    <rect x="16" y="5" width="2" height="40" fill="#000"/>
                    <rect x="22" y="5" width="4" height="40" fill="#000"/>
                    <rect x="30" y="5" width="2" height="40" fill="#000"/>
                    <rect x="36" y="5" width="3" height="40" fill="#000"/>
                    <rect x="43" y="5" width="2" height="40" fill="#000"/>
                    <rect x="49" y="5" width="4" height="40" fill="#000"/>
                    <rect x="57" y="5" width="2" height="40" fill="#000"/>
                    <rect x="63" y="5" width="3" height="40" fill="#000"/>
                    <rect x="70" y="5" width="2" height="40" fill="#000"/>
                    <rect x="76" y="5" width="4" height="40" fill="#000"/>
                    <rect x="84" y="5" width="2" height="40" fill="#000"/>
                    <rect x="90" y="5" width="3" height="40" fill="#000"/>
                    <rect x="97" y="5" width="2" height="40" fill="#000"/>
                    <rect x="103" y="5" width="4" height="40" fill="#000"/>
                    <rect x="111" y="5" width="2" height="40" fill="#000"/>
                    <rect x="117" y="5" width="3" height="40" fill="#000"/>
                    <rect x="124" y="5" width="2" height="40" fill="#000"/>
                    <rect x="130" y="5" width="4" height="40" fill="#000"/>
                    <rect x="138" y="5" width="2" height="40" fill="#000"/>
                    <rect x="144" y="5" width="3" height="40" fill="#000"/>
                    <rect x="151" y="5" width="2" height="40" fill="#000"/>
                    <rect x="157" y="5" width="4" height="40" fill="#000"/>
                    <rect x="165" y="5" width="2" height="40" fill="#000"/>
                    <rect x="171" y="5" width="3" height="40" fill="#000"/>
                    <rect x="178" y="5" width="2" height="40" fill="#000"/>
                    <rect x="184" y="5" width="4" height="40" fill="#000"/>
                  </svg>
                </div>

                {/* Footer */}
                <div style={{ textAlign: 'center', fontSize: '10px', lineHeight: '1.5' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Thank you for your business!</div>
                  <div>No return or exchange without receipt.</div>
                  <div>Goods once sold will not be taken back.</div>
                </div>

                {/* Extra spacing for tear-off */}
                <div style={{ height: '20mm' }}></div>
              </div>
            </div>
            
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex gap-3">
              <button
                onClick={() => setShowReceipt(false)}
                className="flex-1 px-4 py-2.5 bg-white border-2 border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-semibold transition-all"
              >
                Close
              </button>
              <button
                onClick={printReceipt}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-semibold transition-all shadow-lg shadow-blue-500/30"
              >
                <FiPrinter className="w-4 h-4" /> Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exchange Modal */}
      {showExchangeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between bg-gradient-to-r from-amber-500 to-orange-500">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Medicine Exchange
              </h2>
              <button onClick={closeExchangeModal} className="text-white hover:text-amber-100">
                <FiX className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {exchangeStep === 1 && (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <h3 className="font-semibold text-amber-800 mb-2">Step 1: Enter Customer ID</h3>
                    <p className="text-sm text-amber-600">Enter the customer ID to fetch their purchase history for exchange.</p>
                  </div>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      placeholder="Enter Customer ID"
                      value={exchangeCustomerId}
                      onChange={(e) => setExchangeCustomerId(e.target.value)}
                      className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                      onClick={fetchCustomerPurchaseHistory}
                      disabled={exchangeLoading}
                      className="px-6 py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white rounded-lg font-semibold flex items-center gap-2"
                    >
                      {exchangeLoading ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                      ) : (
                        <>
                          <FiSearch className="w-5 h-5" />
                          Fetch History
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {exchangeStep === 2 && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-800 mb-2">Step 2: Select Items to Exchange</h3>
                  </div>
                  {selectedExchangeItems.length > 0 && (
                    <button
                      onClick={proceedToSelectNewProducts}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold"
                    >
                      Proceed to Exchange Selected
                    </button>
                  )}
                </div>
              )}

              {exchangeStep === 3 && (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 className="font-semibold text-green-800 mb-2">Step 3: Select New Products</h3>
                  </div>
                  <button
                    onClick={processExchange}
                    disabled={exchangeLoading}
                    className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white rounded-lg font-semibold"
                  >
                    {exchangeLoading ? 'Processing...' : 'Confirm Exchange'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
