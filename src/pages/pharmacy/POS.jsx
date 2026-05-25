import React, { useState, useEffect, useRef } from 'react';
import { FiSearch, FiPlus, FiMinus, FiTrash2, FiPrinter, FiShoppingCart, FiX, FiGrid, FiList, FiEyeOff, FiMaximize2 } from 'react-icons/fi';
import { pharmacyMedicinesAPI, pharmacySalesAPI, settingsAPI, pharmacyDuesAPI, petsAPI, prescriptionsAPI, pharmacyCreditCustomersAPI, holdBillsAPI, pharmacySettingsAPI } from '../../services/api';

export default function PharmacyPOS({ apis } = {}) {
  const medicinesAPI = apis?.medicines || pharmacyMedicinesAPI;
  const salesAPI = apis?.sales || pharmacySalesAPI;
  const duesAPI = apis?.dues || pharmacyDuesAPI;
  const creditCustomersAPI = apis?.creditCustomers || pharmacyCreditCustomersAPI;
  const sharedSettingsAPI = apis?.pharmacySettings || pharmacySettingsAPI;
  const heldBillsAPI = apis?.holdBills || holdBillsAPI;
  const [medicines, setMedicines] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [customerInfo, setCustomerInfo] = useState({
    customerName: '',
    customerContact: '',
    address: '',
    cnic: '',
    petName: '',
    patientId: '',
    clientId: '',
    species: '',
    breed: '',
    sex: '',
    age: '',
    weight: '',
    followUpDate: '',
    comments: ''
  });
  const [paymentTab, setPaymentTab] = useState('Cash');
  const [discounts, setDiscounts] = useState({ medicine: 0, surgical: 0, procedures: 0 });
  const [billDiscountPercent, setBillDiscountPercent] = useState(0);
  const [billDiscountAmount, setBillDiscountAmount] = useState(0);
  const [salesTaxPercent, setSalesTaxPercent] = useState(0);
  // Credit customer search state
  const [allCreditCustomers, setAllCreditCustomers] = useState([]);
  const [creditSuggestions, setCreditSuggestions] = useState([]);
  const [selectedCreditCustomer, setSelectedCreditCustomer] = useState(null);
  const [showCreditSuggestions, setShowCreditSuggestions] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomerLoading, setNewCustomerLoading] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({ name: "", phone: "", cnic: "", address: "" });
  const [lastSale, setLastSale] = useState(null);
  const [receivedAmount, setReceivedAmount] = useState('');
  const [previousDue, setPreviousDue] = useState(0);
  const [resumedBillId, setResumedBillId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [toast, setToast] = useState('');
  const [activeReferralId, setActiveReferralId] = useState('');
  const [activeReferralItems, setActiveReferralItems] = useState(null);
  const referralCartPrefilledRef = useRef(false);
  const [showHeldBillsModal, setShowHeldBillsModal] = useState(false);
  const [heldBills, setHeldBills] = useState([]);
  const [isLoadingHeldBills, setIsLoadingHeldBills] = useState(false);
  const [hospitalSettings, setHospitalSettings] = useState(null);
  const [pharmacySettings, setPharmacySettings] = useState(null);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(-1);
  const receiptRef = useRef();
  const searchInputRef = useRef();
  const qtyInputRefs = useRef({});
  const priceInputRefs = useRef({});
  const discountInputRefs = useRef({});

  useEffect(() => {
    fetchMedicines();
    fetchHospitalSettings();
    fetchPharmacySettings();
    loadPrescriptionData();
  }, []);

  // Prefill cart from referral once medicines are loaded.
  useEffect(() => {
    if (referralCartPrefilledRef.current) return;
    if (!activeReferralId) return;
    if (!Array.isArray(activeReferralItems) || activeReferralItems.length === 0) return;
    if (!Array.isArray(medicines) || medicines.length === 0) return;

    const normalize = (v) => String(v || '').toLowerCase().trim();
    const desired = activeReferralItems
      .filter(x => !x?.isVaccine && !x?.nonInventory)
      .map(x => ({ ...x, nameKey: normalize(x?.name) }))
      .filter(x => x.nameKey);

    if (desired.length === 0) {
      referralCartPrefilledRef.current = true;
      return;
    }

    // Build a cart from referral items by matching names to inventory.
    const toCartItem = (medicine) => {
      const defaultDiscount = medicine.defaultDiscount || 0;
      const loosePrice = medicine.salePrice || 0;
      const packPrice = medicine.salePerPack || 0;
      return {
        medicineId: medicine._id,
        medicineName: medicine.medicineName,
        barcode: medicine.barcode,
        batchNo: medicine.batchNo || 'N/A',
        quantity: 1,
        pricePerUnit: loosePrice,
        minSalePrice: medicine.minSalePrice || 0,
        totalPrice: loosePrice * (1 - defaultDiscount / 100),
        availableStock: medicine.quantity,
        unitsPerPack: medicine.unitsPerPack || 1,
        salePerPack: packPrice,
        loosePrice,
        packPrice,
        sellBy: 'Loose',
        discount: defaultDiscount,
        dbDefaultDiscount: defaultDiscount,
        category: medicine.category || 'Medicine',
        unit: medicine.unit || 'Unit'
      };
    };

    const nextCart = [];
    const notFound = [];
    for (const it of desired) {
      const med = medicines.find(m => normalize(m?.medicineName) === it.nameKey)
        || medicines.find(m => normalize(m?.medicineName).includes(it.nameKey) || it.nameKey.includes(normalize(m?.medicineName)));
      if (med) nextCart.push(toCartItem(med));
      else notFound.push(it.name);
    }

    if (nextCart.length > 0) {
      setCart(nextCart);
      showToast('Referral items loaded into cart');
    }
    if (notFound.length > 0) {
      console.warn('POS: Referral items not found in inventory:', notFound);
      showToast(`Some items not found: ${notFound.slice(0, 2).join(', ')}${notFound.length > 2 ? '...' : ''}`);
    }

    referralCartPrefilledRef.current = true;
    // Clear the transient POS payload so refresh doesn't re-apply repeatedly.
    try { localStorage.removeItem('pharmacy_pos_data'); } catch {}
  }, [medicines, activeReferralId, activeReferralItems]);

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
        setReceivedAmount(payableTotal.toFixed(2));
        setPaymentTab('Cash');
        setSelectedCreditCustomer(null);
        setCreditSuggestions([]);
        setShowCreditSuggestions(false);
        creditCustomersAPI.getAll()
          .then(res => setAllCreditCustomers(res.data || []))
          .catch(() => setAllCreditCustomers([]));
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
      const response = await medicinesAPI.getAll();
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

  const fetchPharmacySettings = async () => {
    try {
      const response = await sharedSettingsAPI.get();
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

  const loadPrescriptionData = () => {
    const posData = localStorage.getItem('pharmacy_pos_data');
    if (posData) {
      try {
        const data = JSON.parse(posData);
        if (Date.now() - data.timestamp < 300000) {
          setActiveReferralId(data.referralId || '');
          setActiveReferralItems(Array.isArray(data.referralItems) ? data.referralItems : null);
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
      const defaultDiscount = medicine.defaultDiscount || 0;
      const loosePrice = medicine.salePrice || 0;
      const packPrice = medicine.salePerPack || 0;
      setCart([...cart, {
        medicineId: medicine._id,
        medicineName: medicine.medicineName,
        barcode: medicine.barcode,
        batchNo: medicine.batchNo || 'N/A',
        quantity: 1,
        pricePerUnit: loosePrice,
        minSalePrice: medicine.minSalePrice || 0,
        totalPrice: loosePrice * (1 - defaultDiscount / 100),
        availableStock: medicine.quantity,
        unitsPerPack: medicine.unitsPerPack || 1,
        salePerPack: packPrice,
        loosePrice,
        packPrice,
        sellBy: 'Loose',
        discount: defaultDiscount,
        dbDefaultDiscount: defaultDiscount,
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
    const dbDefaultDiscount = item.dbDefaultDiscount || 0;

    // First check if user is trying to exceed the database default discount
    if (discount > dbDefaultDiscount) {
      showToast(`Cannot exceed default discount of ${dbDefaultDiscount}%`);
      
      // Update with the max allowed (dbDefaultDiscount)
      setCart(cart.map(i =>
        i.medicineId === medicineId
          ? { ...i, discount: dbDefaultDiscount, totalPrice: (i.quantity * i.pricePerUnit) * (1 - dbDefaultDiscount / 100) }
          : i
      ));
      return;
    }

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

  const updateSellBy = (medicineId, sellBy) => {
    setCart(cart.map(item => {
      if (item.medicineId !== medicineId) return item;
      const newPrice = sellBy === 'Pack' ? (item.packPrice || 0) : (item.loosePrice || 0);
      return {
        ...item,
        sellBy,
        pricePerUnit: newPrice,
        totalPrice: (item.quantity * newPrice) * (1 - (item.discount || 0) / 100),
      };
    }));
  };

  const removeFromCart = (medicineId) => {
    setCart(cart.filter(item => item.medicineId !== medicineId));
  };

  // ── Credit customer search helpers ────────────────────────────────────────
  const searchCreditCustomers = (query) => {
    if (!query || query.length < 2) {
      setCreditSuggestions([]);
      setShowCreditSuggestions(false);
      return;
    }
    const q = query.toLowerCase().replace(/[-\s]/g, '');
    const matches = allCreditCustomers.filter(c =>
      c.phone?.replace(/[-\s]/g, '').toLowerCase().includes(q) ||
      c.cnic?.replace(/[-\s]/g, '').toLowerCase().includes(q) ||
      c.name?.toLowerCase().includes(q)
    ).slice(0, 6);
    setCreditSuggestions(matches);
    setShowCreditSuggestions(matches.length > 0);
  };

  const selectCreditCustomer = (customer) => {
    setSelectedCreditCustomer(customer);
    setCustomerInfo(prev => ({
      ...prev,
      customerName: customer.name || '',
      customerContact: customer.phone || '',
      address: customer.address || '',
      cnic: customer.cnic || '',
    }));
    setCreditSuggestions([]);
    setShowCreditSuggestions(false);
  };

  const clearCreditCustomer = () => {
    setSelectedCreditCustomer(null);
    setCustomerInfo(prev => ({
      ...prev,
      customerName: '',
      customerContact: '',
      address: '',
      cnic: '',
      clientId: ''
    }));
  };

  const clearCart = () => {
    setCart([]);
    setCustomerInfo({
      customerName: '',
      customerContact: '',
      address: '',
      cnic: '',
      petName: '',
      patientId: '',
      clientId: '',
      species: '',
      breed: '',
      sex: '',
      age: '',
      weight: '',
      followUpDate: '',
      comments: ''
    });
    setPreviousDue(0);
    setReceivedAmount('');
    // Reset to pharmacy settings defaults instead of 0
    setBillDiscountPercent(Number(pharmacySettings?.billDiscountPercent) || 0);
    setBillDiscountAmount(0);
    setSalesTaxPercent(Number(pharmacySettings?.salesTaxPercent) || 0);
    setPaymentTab('Cash');
    setSelectedCreditCustomer(null);
    setCreditSuggestions([]);
    setDiscounts({ medicine: 0, surgical: 0, procedures: 0 });
    setResumedBillId(null); // Clear the link to held bill when cart is cleared
  };

  const handleHoldBill = async () => {
    if (cart.length === 0) return;
    try {
      const holdData = {
        cart,
        customerInfo,
        subtotal,
        billDiscountPercent,
        billDiscountAmount: effectiveBillDiscount,
        salesTaxPercent,
        previousDue,
        heldBy: JSON.parse(localStorage.getItem('user') || '{}').username || 'admin'
      };
      await heldBillsAPI.create(holdData);
      showToast('Bill held successfully!');
      clearCart();
    } catch (error) {
      console.error('Error holding bill:', error);
      showToast('Error holding bill. Please try again.');
    }
  };

  const fetchHeldBills = async () => {
    setIsLoadingHeldBills(true);
    try {
      const response = await heldBillsAPI.getAll();
      setHeldBills(response.data || []);
    } catch (error) {
      console.error('Error fetching held bills:', error);
    } finally {
      setIsLoadingHeldBills(false);
    }
  };

  const resumeHeldBill = (bill) => {
    setCart(bill.cart || []);
    setCustomerInfo(bill.customerInfo || {});
    setBillDiscountPercent(bill.billDiscountPercent || 0);
    setBillDiscountAmount(bill.billDiscountAmount || 0);
    setSalesTaxPercent(bill.salesTaxPercent || 0);
    setPreviousDue(bill.previousDue || 0);
    
    // Store the ID of the resumed bill
    setResumedBillId(bill._id);
    
    // Close modal immediately for better UX
    setShowHeldBillsModal(false);
    showToast('Bill resumed. It will remain in Held list until sale is completed.');
  };

  const deleteHeldBill = async (id) => {
    if (!window.confirm('Are you sure you want to delete this held bill?')) return;
    try {
      await heldBillsAPI.delete(id);
      setHeldBills(prev => prev.filter(b => b._id !== id));
      showToast('Held bill deleted!');
    } catch (error) {
      console.error('Error deleting held bill:', error);
    }
  };

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomerData.name.trim()) return showToast("Name is required");
    try {
      setNewCustomerLoading(true);
      const res = await creditCustomersAPI.create(newCustomerData);
      showToast("Customer added successfully");
      setShowAddCustomerModal(false);
      setNewCustomerData({ name: "", phone: "", cnic: "", address: "" });
      
      // Auto-select the newly created customer
      if (res.data) {
        selectCreditCustomer(res.data);
      }
      
      // Refresh customer list for search
      const customersRes = await creditCustomersAPI.getAll();
      setAllCreditCustomers(customersRes.data || []);
    } catch (error) {
      showToast("Error adding customer");
    } finally {
      setNewCustomerLoading(false);
    }
  };

  const handlePaymentTabChange = (tab) => {
    setPaymentTab(tab);
  };

  const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const lineDiscounts = cart.reduce((sum, item) => sum + (item.totalPrice * (item.discount || 0) / 100), 0);
  
  // Calculate bill discount amount from percentage or direct amount
  const billDiscountFromPercent = subtotal * (billDiscountPercent || 0) / 100;
  const effectiveBillDiscount = billDiscountAmount || billDiscountFromPercent;
  
  // Calculate sales tax
  const afterBillDiscount = subtotal - lineDiscounts - effectiveBillDiscount;
  const salesTaxAmount = afterBillDiscount * (salesTaxPercent || 0) / 100;
  
  const totalMinPrice = cart.reduce((sum, item) => sum + ((item.minSalePrice || 0) * item.quantity), 0);
  const totalDiscount = (discounts.medicine || 0) + (discounts.surgical || 0) + (discounts.procedures || 0);

  const maxTotalDiscountAmt = subtotal > 0 ? Math.max(0, subtotal - totalMinPrice) : 0;
  
  // Ensure total discount doesn't exceed max allowed to maintain min prices
  const effectiveTotalDiscount = Math.min(totalDiscount, maxTotalDiscountAmt);
  
  const payableTotal = afterBillDiscount + salesTaxAmount + previousDue;

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
          packPrice: item.packPrice || 0,
          sellBy: item.sellBy || 'Loose',
          lineDiscount: item.discount || 0,
          lineDiscountAmt: Number(item.totalPrice) * (Number(item.discount) || 0) / 100,
          totalPrice: item.totalPrice,
          unit: item.unit || 'Unit',
          category: item.category || 'Medicine',
          batchNo: item.batchNo || 'N/A'
        })),
        customerId: customerInfo.clientId || 'WALK-IN',
        clientId: customerInfo.clientId || '',
        customerName: customerInfo.customerName || 'Walk-in Customer',
        customerContact: customerInfo.customerContact || '',
        customerAddress: customerInfo.address || '',
        customerCnic: customerInfo.cnic || '',
        patientId: customerInfo.patientId || '',
        subtotal,
        lineDiscounts,
        billDiscountPercent: billDiscountPercent || 0,
        billDiscountAmount: effectiveBillDiscount || 0,
        salesTaxPercent: salesTaxPercent || 0,
        salesTaxAmount: salesTaxAmount || 0,
        discount: lineDiscounts + effectiveBillDiscount,
        previousDue,
        totalAmount: payableTotal,
        receivedAmount: Number(receivedAmount) || payableTotal,
        paymentMethod: paymentTab === 'Credit' ? 'Credit' : paymentMethod,
        balanceDue: Math.max(0, payableTotal - (Number(receivedAmount) || payableTotal))
      };

      const response = await salesAPI.create(saleData);
      setLastSale(response.data);

      // If checkout came from a referral, mark it as completed only after sale is created successfully.
      if (activeReferralId) {
        try {
          const allReferrals = JSON.parse(localStorage.getItem('pharmacy_referrals') || '[]');
          const updated = (Array.isArray(allReferrals) ? allReferrals : []).map(r =>
            r.id === activeReferralId ? { ...r, status: 'Completed', completedAt: new Date().toISOString() } : r
          );
          localStorage.setItem('pharmacy_referrals', JSON.stringify(updated));
          setActiveReferralId('');
          setActiveReferralItems(null);
        } catch (e) {
          console.error('Error marking referral as Completed after checkout:', e);
        }
      }

      // If this was a resumed bill, delete it from held bills now that sale is complete
      if (resumedBillId) {
        try {
          await heldBillsAPI.delete(resumedBillId);
          setResumedBillId(null);
        } catch (err) {
          console.error('Error deleting held bill after checkout:', err);
        }
      }

      // If credit sale, update the credit customer's totalDue
      if (paymentTab === 'Credit' && selectedCreditCustomer) {
        const amtReceived = Number(receivedAmount) || 0;
        const newDue = Math.max(0, (selectedCreditCustomer.totalDue || 0) + payableTotal - amtReceived);
        const newPaid = (selectedCreditCustomer.totalPaid || 0) + amtReceived;
        await creditCustomersAPI.update(selectedCreditCustomer._id, {
          name: selectedCreditCustomer.name,
          phone: selectedCreditCustomer.phone,
          cnic: selectedCreditCustomer.cnic,
          address: selectedCreditCustomer.address,
          totalDue: newDue,
          totalPaid: newPaid,
        });
      }

      setShowPaymentModal(false);
      setShowReceipt(true);
      clearCart();
      showToast('Sale completed successfully!');
      fetchMedicines();
    } catch (error) {
      console.error('Error processing sale:', error);
      const status = error?.response?.status || error?.status
      const msg = error?.response?.data?.message || error?.data?.message || error?.message || ''
      if (status === 423 || msg.toLowerCase().includes('day is not open')) {
        showToast('Day not opened — please open the pharmacy day session before making a sale.')
      } else {
        showToast(msg || 'Error processing sale. Please try again.')
      }
    }
  };

  const printReceipt = () => {
    const printWindow = window.open('', '_blank', 'width=400,height=700');
    const sale = lastSale;
    if (!sale) return;

    const fmt = (n) => Number(n || 0).toFixed(2);
    const shopName = hospitalSettings?.companyName || 'Abbottabad Pet Hospital';
    const shopAddress = hospitalSettings?.address || '';
    const shopPhone = hospitalSettings?.phone || '';

    const itemRows = sale.items.map(item => {
      const discAmt = Number(item.lineDiscountAmt || 0);
      const discPct = Number(item.lineDiscount || 0);
      const type = item.sellBy === 'Pack' ? 'Pack' : 'Loose';
      return `
        <tr>
          <td style="padding:3px 0; vertical-align:top;">
            ${item.medicineName}
            ${discAmt > 0 ? `<br><span style="font-size:10px; color:#555;">Disc: Rs ${fmt(discAmt)}</span>` : ''}
          </td>
          <td style="text-align:center; padding:3px 4px; vertical-align:top;">${type}</td>
          <td style="text-align:center; padding:3px 4px; vertical-align:top;">${item.quantity}</td>
          <td style="text-align:right; padding:3px 0; vertical-align:top;">${fmt(item.totalPrice)}</td>
        </tr>`;
    }).join('');

    const lineDiscounts = Number(sale.lineDiscounts || 0);
    const billDiscount = Number(sale.billDiscountAmount || 0);
    const billDiscPct = Number(sale.billDiscountPercent || 0);
    const salesTaxPct = Number(sale.salesTaxPercent || 0);
    const salesTaxAmt = Number(sale.salesTaxAmount || 0);

    const isCredit = sale.paymentMethod === 'Credit';
    const received = Number(sale.receivedAmount || 0);
    const balance = Number(sale.balanceDue || 0);

    const receiptHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      color: #000;
      background: #fff;
      width: 72mm;
    }
    .center { text-align: center; }
    .right  { text-align: right; }
    .bold   { font-weight: bold; }
    .dashed { border-top: 1px dashed #000; margin: 6px 0; }
    table   { width: 100%; border-collapse: collapse; }
    td, th  { font-size: 12px; }
    .totals-table td { padding: 2px 0; }
    .grand-total td  { font-weight: bold; font-size: 13px; border-top: 1px dashed #000; padding-top: 4px; }
    .credit-summary td { padding: 1px 0; font-size: 11px; }
  </style>
</head>
<body>
  <div class="center bold" style="font-size:15px; letter-spacing:1px;">${shopName.toUpperCase()}</div>
  ${shopAddress ? `<div class="center" style="font-size:10px;">${shopAddress}</div>` : ''}
  ${shopPhone ? `<div class="center" style="font-size:10px;">Tel: ${shopPhone}</div>` : ''}

  <div class="dashed"></div>
  <div class="center bold" style="font-size:13px;">Retail Invoice</div>
  <div class="dashed"></div>

  <table class="totals-table">
    <tr><td>Date</td><td class="right">${new Date(sale.createdAt).toLocaleString()}</td></tr>
    <tr><td>${sale.paymentMethod === 'Credit' ? 'Credit Customer' : 'Walk-in'}</td><td class="right">${sale.customerName || 'Walk-in Customer'}</td></tr>
    ${sale.customerContact ? `<tr><td>Phone</td><td class="right">${sale.customerContact}</td></tr>` : ''}
    <tr><td>Bill No</td><td class="right">${sale.invoiceNumber || '---'}</td></tr>
    <tr><td>Payment Mode</td><td class="right">${sale.paymentMethod || 'Cash'}</td></tr>
  </table>

  <div class="dashed"></div>

  <table>
    <thead>
      <tr>
        <th style="text-align:left; padding-bottom:3px; border-bottom:1px dashed #000;">Item</th>
        <th style="text-align:center; padding-bottom:3px; border-bottom:1px dashed #000; width:40px;">Type</th>
        <th style="text-align:center; padding-bottom:3px; border-bottom:1px dashed #000; width:28px;">Qty</th>
        <th style="text-align:right; padding-bottom:3px; border-bottom:1px dashed #000; width:52px;">Amt</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div class="dashed"></div>

  <table class="totals-table">
    <tr>
      <td>Sub Total</td>
      <td class="right">${fmt(sale.subtotal)}</td>
    </tr>
    ${lineDiscounts > 0 ? `
    <tr>
      <td>Line Discounts</td>
      <td class="right">${fmt(lineDiscounts)}</td>
    </tr>` : ''}
    ${billDiscount > 0 ? `
    <tr>
      <td>(-) Bill Discount${billDiscPct > 0 ? ` (${billDiscPct}%)` : ''}</td>
      <td class="right">${fmt(billDiscount)}</td>
    </tr>` : ''}
    <tr>
      <td>GST (${salesTaxPct}%)</td>
      <td class="right">${fmt(salesTaxAmt)}</td>
    </tr>
    <tr class="grand-total">
      <td>TOTAL</td>
      <td class="right">Rs ${fmt(sale.totalAmount)}</td>
    </tr>
    ${isCredit ? `
    <tr class="credit-summary">
      <td style="padding-top:4px;">Received</td>
      <td class="right" style="padding-top:4px;">Rs ${fmt(received)}</td>
    </tr>
    <tr class="credit-summary">
      <td class="bold">Payable/Dues</td>
      <td class="right bold">Rs ${fmt(sale.totalAmount - received)}</td>
    </tr>
    ` : ''}
  </table>

  <div class="dashed"></div>
  <div class="center" style="font-size:11px; margin-top:4px;">Thank you for your purchase!</div>

  <script>
    window.onload = function() { window.print(); setTimeout(function(){ window.close(); }, 200); };
  </script>
</body>
</html>`;

    printWindow.document.write(receiptHTML);
    printWindow.document.close();
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 -m-6 overflow-hidden">
      {/* Title */}
      <div className="px-6 pt-3 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Point of Sale
            </h1>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">Pharmacy POS — scan or search to add items</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-4 gap-4">
        {/* Main Section - Left Side */}
        <div className="flex-1 flex flex-col gap-6 overflow-hidden">
          {/* Top: Product Selection / Input */}
          <div className="bg-white/80 backdrop-blur rounded-2xl shadow-xl border border-white/50 p-6 shrink-0 relative z-10">
            <div className="grid grid-cols-8 gap-4 items-end">
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
              <div className="col-span-5 relative z-[100]">
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
                  <div className="search-dropdown-pharmacy absolute left-0 right-0 top-full mt-2 bg-white/95 backdrop-blur border-2 border-purple-200 rounded-2xl shadow-2xl z-[9999] overflow-hidden max-h-96 overflow-y-auto">
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
            </div>
          </div>

          {/* Middle: Cart Table */}
          <div className="flex-1 bg-white/80 backdrop-blur rounded-2xl shadow-xl border border-white/50 flex flex-col overflow-hidden">
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-purple-600 text-white z-20 shadow-sm">
                  <tr>
                    <th className="py-2 px-3 text-[10px] uppercase tracking-wider font-bold w-10 text-center">#</th>
                    <th className="py-2 px-3 text-[10px] uppercase tracking-wider font-bold w-28">Barcode</th>
                    <th className="py-2 px-3 text-[10px] uppercase tracking-wider font-bold">Medicine</th>
                    <th className="py-2 px-3 text-[10px] uppercase tracking-wider font-bold w-20 text-center">Batch</th>
                    <th className="py-2 px-3 text-[10px] uppercase tracking-wider font-bold w-24 text-center">Avail. Units</th>
                    <th className="py-2 px-3 text-[10px] uppercase tracking-wider font-bold w-24 text-right">Pack Price</th>
                    <th className="py-2 px-3 text-[10px] uppercase tracking-wider font-bold w-24 text-right">Unit Price</th>
                    <th className="py-2 px-3 text-[10px] uppercase tracking-wider font-bold w-20 text-center">Line Disc%</th>
                    <th className="py-2 px-3 text-[10px] uppercase tracking-wider font-bold w-28 text-center">Sell By</th>
                    <th className="py-2 px-3 text-[10px] uppercase tracking-wider font-bold w-32 text-center">Quantity</th>
                    <th className="py-2 px-3 text-[10px] uppercase tracking-wider font-bold w-28 text-right">Amount</th>
                    <th className="py-2 px-3 text-[10px] uppercase tracking-wider font-bold w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-100">
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan="12" className="py-20 text-center text-slate-400">
                        <FiShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-10" />
                        <p className="text-lg font-medium">Cart is empty</p>
                        <p className="text-sm">Scan barcode or search to add items</p>
                      </td>
                    </tr>
                  ) : (
                    cart.map((item, idx) => (
                      <tr key={item.medicineId} className="hover:bg-purple-50/50 transition-colors group text-xs">
                        <td className="py-2 px-3 text-center text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                        <td className="py-2 px-3 text-slate-500 font-mono text-[10px]">{item.barcode || '-'}</td>
                        <td className="py-2 px-3 font-semibold text-slate-800 break-words max-w-[150px]">{item.medicineName}</td>
                        <td className="py-2 px-3 text-center text-slate-500 font-medium">{item.batchNo}</td>
                        <td className="py-2 px-3 text-center font-bold text-green-600">{item.availableStock}</td>
                        <td className="py-2 px-3 text-right text-slate-600">{Number(item.packPrice || 0).toLocaleString()}</td>
                        <td className="py-2 px-3 text-right text-slate-600 font-medium">{Number(item.pricePerUnit || 0).toLocaleString()}</td>
                        <td className="py-2 px-3 text-center">
                          <input
                            ref={(el) => discountInputRefs.current[item.medicineId] = el}
                            type="number"
                            min="0"
                            max="100"
                            value={item.discount ?? item.defaultDiscount ?? 0}
                            onChange={(e) => updateDiscount(item.medicineId, e.target.value)}
                            onKeyDown={(e) => handleDiscountKeyDown(e, item.medicineId)}
                            className="w-14 text-center bg-white border border-purple-200 rounded px-1 py-1 text-xs focus:ring-1 focus:ring-purple-500 font-bold text-purple-700"
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <select
                            value={item.sellBy || 'Loose'}
                            onChange={(e) => updateSellBy(item.medicineId, e.target.value)}
                            className="bg-white border border-purple-200 rounded px-1 py-1 text-[10px] font-semibold text-purple-700 focus:ring-1 focus:ring-purple-500 outline-none cursor-pointer"
                          >
                            <option value="Loose">Loose</option>
                            <option value="Pack">Pack</option>
                          </select>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => updateQuantity(item.medicineId, item.quantity - 1)} className="p-1 text-slate-400 hover:text-purple-600 hover:bg-purple-100 rounded transition-all">
                              <FiMinus className="w-3 h-3" />
                            </button>
                            <input
                              ref={(el) => qtyInputRefs.current[item.medicineId] = el}
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateQuantity(item.medicineId, Number(e.target.value))}
                              onKeyDown={(e) => handleQuantityKeyDown(e, item.medicineId)}
                              className="w-12 text-center bg-purple-50 border border-purple-200 rounded py-0.5 font-bold text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                            <button onClick={() => updateQuantity(item.medicineId, item.quantity + 1)} className="p-1 text-slate-400 hover:text-purple-600 hover:bg-purple-100 rounded transition-all">
                              <FiPlus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-sm text-purple-600">
                          {Number(item.totalPrice).toLocaleString()}
                        </td>
                        <td className="py-2 px-3">
                          <button onClick={() => removeFromCart(item.medicineId)} className="p-1 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all">
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </div>

        {/* Sidebar - Right Side */}
        <div className="w-full lg:w-72 flex flex-col gap-6 overflow-y-auto lg:overflow-hidden min-w-[280px]">
          
          {/* Customer Section */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 shrink-0">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest">Customer</h3>
            <div className="space-y-2">
              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">ID</label>
                <input
                  type="text"
                  value={customerInfo.clientId}
                  readOnly
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Name</label>
                <input
                  type="text"
                  value={customerInfo.customerName}
                  onChange={(e) => setCustomerInfo({...customerInfo, customerName: e.target.value})}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-none"
                  placeholder="Walk-in Customer"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Contact</label>
                <input
                  type="text"
                  value={customerInfo.customerContact}
                  onChange={(e) => setCustomerInfo({...customerInfo, customerContact: e.target.value})}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-none"
                  placeholder="Phone number"
                />
              </div>
              {previousDue > 0 && (
                <div className="flex justify-between items-center py-1.5 px-2 bg-amber-50 rounded border border-amber-100 mt-2">
                  <span className="text-amber-700 font-bold uppercase text-[9px]">Prev. Due:</span>
                  <span className="font-bold text-amber-700 font-mono text-[10px]">PKR {previousDue.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Bill Summary Section */}
          <div className="bg-white/80 backdrop-blur rounded-2xl shadow-xl border border-white/50 p-4 space-y-4 shrink-0">
            <h3 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">Bill Summary</h3>
            
            {/* Subtotal & Line Discounts */}
            <div className="grid grid-cols-1 gap-2 border-b border-purple-100 pb-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600 font-medium">Subtotal:</span>
                <span className="font-bold text-slate-800">PKR {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600 font-medium">Line Discounts:</span>
                <span className="font-bold text-slate-800">PKR {lineDiscounts.toFixed(2)}</span>
              </div>
            </div>
            
            {/* Bill Discount */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-purple-600 font-bold uppercase mb-1">Disc (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={billDiscountPercent}
                    onChange={(e) => {
                      setBillDiscountPercent(Number(e.target.value));
                      setBillDiscountAmount(0); // Clear amount when percentage is used
                    }}
                    className="w-full bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg px-2 py-1.5 text-slate-800 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none font-semibold text-sm"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-purple-600 font-bold uppercase mb-1">Disc (Rs)</label>
                  <input
                    type="number"
                    min="0"
                    value={billDiscountAmount}
                    onChange={(e) => {
                      setBillDiscountAmount(Number(e.target.value));
                      setBillDiscountPercent(0); // Clear percentage when amount is used
                    }}
                    className="w-full bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg px-2 py-1.5 text-slate-800 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none font-semibold text-sm"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
            
            {/* Sales Tax */}
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-600 font-medium">Sales Tax ({salesTaxPercent}%):</span>
              <span className="font-bold text-slate-800">PKR {salesTaxAmount.toFixed(2)}</span>
            </div>
            
            {/* Total Amount */}
            <div className="pt-3 border-t-2 border-purple-200">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">Total:</span>
                <span className="text-xl font-black text-slate-800 font-mono">PKR {payableTotal.toFixed(2)}</span>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="pt-2 grid grid-cols-1 gap-2">
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={handleHoldBill}
                  disabled={cart.length === 0}
                  className="py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 disabled:from-slate-300 disabled:to-slate-400 disabled:text-slate-500 text-white rounded-lg font-bold text-xs transition-all shadow hover:shadow-md active:scale-95"
                >
                  Hold Bill
                </button>
                <button 
                  onClick={() => {
                    fetchHeldBills();
                    setShowHeldBillsModal(true);
                  }}
                  className="py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-lg font-bold text-xs transition-all shadow hover:shadow-md active:scale-95"
                >
                  Held Bills
                </button>
              </div>
              <button
                onClick={() => {
                  setShowPaymentModal(true);
                  setReceivedAmount(payableTotal.toFixed(2));
                  setPaymentTab('Cash');
                  setSelectedCreditCustomer(null);
                  setCreditSuggestions([]);
                  setShowCreditSuggestions(false);
                  // Pre-fetch all credit customers for search
                  creditCustomersAPI.getAll()
                    .then(res => setAllCreditCustomers(res.data || []))
                    .catch(() => setAllCreditCustomers([]));
                }}
                disabled={cart.length === 0}
                className="py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-slate-300 disabled:to-slate-400 disabled:text-slate-500 text-white rounded-lg font-bold text-sm transition-all shadow-lg hover:shadow-xl active:scale-95"
              >
                Process Payment
              </button>
            </div>
            
            <div className="flex justify-between text-[10px] text-purple-600 font-bold px-1 border-t border-purple-50 pt-2">
              <span>F2: Search | F9: Pay</span>
              <span>{new Date().toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-h-[90vh] overflow-y-auto" style={{maxWidth: '675px'}}>

            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between bg-gradient-to-r from-purple-50 to-blue-50 border-b border-purple-100">
              <h2 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">Process Payment</h2>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <FiX className="w-6 h-6" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-purple-100">
              <button
                onClick={() => handlePaymentTabChange('Cash')}
                className={`flex-1 py-3 text-sm font-bold tracking-wide transition-all ${
                  paymentTab === 'Cash'
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                    : 'text-slate-500 hover:text-purple-600 hover:bg-purple-50'
                }`}
              >
                Cash
              </button>
              <button
                onClick={() => handlePaymentTabChange('Credit')}
                className={`flex-1 py-3 text-sm font-bold tracking-wide transition-all ${
                  paymentTab === 'Credit'
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                    : 'text-slate-500 hover:text-purple-600 hover:bg-purple-50'
                }`}
              >
                Credit
              </button>
            </div>

            <div className="p-6 space-y-5">

              {/* Cash tab fields */}
              {paymentTab === 'Cash' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-purple-600 mb-2">Customer Name</label>
                    <input
                      type="text"
                      placeholder="Enter customer full name"
                      value={customerInfo.customerName}
                      onChange={(e) => setCustomerInfo({...customerInfo, customerName: e.target.value})}
                      className="w-full px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-purple-600 mb-2">Phone</label>
                    <input
                      type="text"
                      placeholder="Enter phone number"
                      value={customerInfo.customerContact}
                      onChange={(e) => setCustomerInfo({...customerInfo, customerContact: e.target.value})}
                      className="w-full px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-purple-600 mb-2">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Card">Card</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Mobile Wallet">Mobile Wallet</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Credit tab — customer fields */}
              {paymentTab === 'Credit' && (
                <div className="space-y-4">
                  {/* Selected customer badge */}
                  {selectedCreditCustomer && (
                    <div className="flex items-center justify-between bg-green-50 border-2 border-green-200 rounded-lg px-4 py-3">
                      <div>
                        <p className="text-sm font-bold text-green-800">{selectedCreditCustomer.name}</p>
                        <p className="text-xs text-green-600">{selectedCreditCustomer.phone}{selectedCreditCustomer.cnic ? ` · ${selectedCreditCustomer.cnic}` : ''}</p>
                        {Number(selectedCreditCustomer.totalDue) > 0 && (
                          <p className="text-xs text-red-600 font-semibold mt-0.5">Existing Due: PKR {Number(selectedCreditCustomer.totalDue).toFixed(2)}</p>
                        )}
                      </div>
                      <button type="button" onClick={clearCreditCustomer} className="text-slate-400 hover:text-red-500 p-1">
                        <FiX className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-semibold text-purple-600 mb-2">Customer Name</label>
                    <input
                      type="text"
                      placeholder="Enter customer full name"
                      value={customerInfo.customerName}
                      onChange={(e) => { setCustomerInfo({...customerInfo, customerName: e.target.value}); if (selectedCreditCustomer) setSelectedCreditCustomer(null); }}
                      className="w-full px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    />
                  </div>
                  {/* Phone with live search */}
                  <div className="relative">
                    <label className="block text-sm font-semibold text-purple-600 mb-2">Phone Number</label>
                    <input
                      type="text"
                      placeholder="Type to search credit customers..."
                      value={customerInfo.customerContact}
                      onChange={(e) => { const v = e.target.value; setCustomerInfo({...customerInfo, customerContact: v}); if (selectedCreditCustomer) setSelectedCreditCustomer(null); searchCreditCustomers(v); }}
                      onFocus={() => customerInfo.customerContact.length >= 2 && searchCreditCustomers(customerInfo.customerContact)}
                      onBlur={() => setTimeout(() => setShowCreditSuggestions(false), 200)}
                      className="w-full px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    />
                    {showCreditSuggestions && creditSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border-2 border-purple-200 rounded-xl shadow-2xl z-[9999] overflow-hidden">
                        {creditSuggestions.map(c => (
                          <button key={c._id} type="button" onMouseDown={() => selectCreditCustomer(c)}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-purple-50 border-b border-purple-50 last:border-none text-left transition-all">
                            <div>
                              <p className="font-semibold text-slate-800 text-sm">{c.name}</p>
                              <p className="text-xs text-slate-500">{c.phone}{c.cnic ? ` · ${c.cnic}` : ''}</p>
                            </div>
                            {Number(c.totalDue) > 0 && (
                              <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full shrink-0">Due: PKR {Number(c.totalDue).toFixed(0)}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-purple-600 mb-2">Address</label>
                    <input
                      type="text"
                      placeholder="Enter address"
                      value={customerInfo.address}
                      onChange={(e) => setCustomerInfo({...customerInfo, address: e.target.value})}
                      className="w-full px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    />
                  </div>
                  {/* CNIC with live search */}
                  <div className="relative">
                    <label className="block text-sm font-semibold text-purple-600 mb-2">CNIC</label>
                    <input
                      type="text"
                      placeholder="Type CNIC to search credit customers..."
                      value={customerInfo.cnic}
                      onChange={(e) => { const v = e.target.value; setCustomerInfo({...customerInfo, cnic: v}); if (selectedCreditCustomer) setSelectedCreditCustomer(null); searchCreditCustomers(v); }}
                      onFocus={() => customerInfo.cnic.length >= 2 && searchCreditCustomers(customerInfo.cnic)}
                      onBlur={() => setTimeout(() => setShowCreditSuggestions(false), 200)}
                      className="w-full px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all font-mono"
                    />
                    {showCreditSuggestions && creditSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border-2 border-purple-200 rounded-xl shadow-2xl z-[9999] overflow-hidden">
                        {creditSuggestions.map(c => (
                          <button key={c._id} type="button" onMouseDown={() => selectCreditCustomer(c)}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-purple-50 border-b border-purple-50 last:border-none text-left transition-all">
                            <div>
                              <p className="font-semibold text-slate-800 text-sm">{c.name}</p>
                              <p className="text-xs text-slate-500">{c.phone}{c.cnic ? ` · ${c.cnic}` : ''}</p>
                            </div>
                            {Number(c.totalDue) > 0 && (
                              <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full shrink-0">Due: PKR {Number(c.totalDue).toFixed(0)}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowAddCustomerModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-600 border border-purple-300 rounded-lg hover:bg-purple-50 hover:border-purple-500 transition-all"
                    >
                      <FiPlus className="w-3 h-3" />
                      Add Credit Customer
                    </button>
                  </div>
                </div>
              )}

              {/* Bill Summary — shown on both tabs */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border-2 border-purple-100 overflow-hidden">
                <div className="px-5 py-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 font-medium">Subtotal:</span>
                    <span className="font-bold text-slate-800">PKR {subtotal.toFixed(2)}</span>
                  </div>
                  {lineDiscounts > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 font-medium">Line Discounts:</span>
                      <span className="font-bold text-green-600">-PKR {lineDiscounts.toFixed(2)}</span>
                    </div>
                  )}
                  {effectiveBillDiscount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 font-medium">Bill Discount:</span>
                      <span className="font-bold text-green-600">-PKR {effectiveBillDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  {salesTaxAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600 font-medium">Sales Tax ({salesTaxPercent}%):</span>
                      <span className="font-bold text-blue-600">PKR {salesTaxAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {previousDue > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-amber-600 font-medium">Previous Due:</span>
                      <span className="font-bold text-amber-600">PKR {previousDue.toFixed(2)}</span>
                    </div>
                  )}
                </div>
                <div className="px-5 py-4 bg-gradient-to-r from-purple-600 to-blue-600 flex justify-between items-center">
                  <span className="text-white font-bold text-base">Total Payable:</span>
                  <span className="text-white font-black text-xl">PKR {payableTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Credit tab — Received Amount + Dues */}
              {paymentTab === 'Credit' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-semibold text-purple-600 mb-2">Amount Received</label>
                    <input
                      type="number"
                      min="0"
                      value={receivedAmount}
                      onChange={(e) => setReceivedAmount(e.target.value)}
                      className="w-full px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all font-mono text-lg font-bold"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="flex justify-between items-center px-4 py-2 rounded-lg bg-red-50 border-2 border-red-200">
                    <span className="text-red-600 font-bold text-base">Payable / Dues:</span>
                    <span className="text-red-600 font-black text-xl font-mono">
                      PKR {Math.max(0, payableTotal - (Number(receivedAmount) || 0)).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-4 pt-2">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-semibold transition-all"
                >
                  Close
                </button>
                <button
                  onClick={handleCheckout}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-bold transition-all shadow-lg hover:shadow-xl active:scale-95"
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm">
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
                  <span className="text-slate-500">{lastSale?.paymentMethod === 'Credit' ? 'Credit Customer:' : 'Walk-in:'}</span>
                  <span className="font-semibold text-right">{lastSale?.customerName || 'Walk-in'}</span>
                  <span className="text-slate-500">Date:</span>
                  <span className="font-semibold text-right">{new Date(lastSale?.createdAt).toLocaleString()}</span>
                </div>
              </div>

              <table className="w-full text-xs mb-4">
                <thead className="border-b border-slate-200 text-slate-500 uppercase">
                  <tr>
                    <th className="py-2 text-left">Item</th>
                    <th className="py-2 text-center">Type</th>
                    <th className="py-2 text-center">Qty</th>
                    <th className="py-2 text-right">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lastSale.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2">{item.medicineName}</td>
                      <td className="py-2 text-center">{item.sellBy === 'Pack' ? 'Pack' : 'Loose'}</td>
                      <td className="py-2 text-center">{item.quantity}</td>
                      <td className="py-2 text-right">{item.totalPrice.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-t-2 border-slate-100 pt-4 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Subtotal:</span>
                  <span className="font-bold">PKR {Number(lastSale.subtotal || 0).toFixed(2)}</span>
                </div>
                {Number(lastSale.lineDiscounts) > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Line Discounts:</span>
                    <span className="font-bold">{Number(lastSale.lineDiscounts).toFixed(2)}</span>
                  </div>
                )}
                {Number(lastSale.billDiscountAmount) > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>(-) Bill Discount{lastSale.billDiscountPercent > 0 ? ` (${lastSale.billDiscountPercent}%)` : ''}:</span>
                    <span className="font-bold">{Number(lastSale.billDiscountAmount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-500">
                  <span>GST ({lastSale.salesTaxPercent || 0}%):</span>
                  <span className="font-bold">{Number(lastSale.salesTaxAmount || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-black border-t border-slate-200 pt-2 mt-2">
                  <span>TOTAL:</span>
                  <span>Rs {Number(lastSale.totalAmount || 0).toFixed(2)}</span>
                </div>
                {lastSale.paymentMethod === 'Credit' && (
                  <>
                    <div className="flex justify-between text-slate-600 pt-1">
                      <span>Received:</span>
                      <span className="font-bold">Rs {Number(lastSale.receivedAmount || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>Payable/Dues:</span>
                      <span className="font-black underline">Rs {Number(lastSale.totalAmount - lastSale.receivedAmount).toFixed(2)}</span>
                    </div>
                  </>
                )}
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

      {/* Held Bills Modal */}
      {showHeldBillsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-indigo-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <FiList className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Held Bills</h2>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Manage paused transactions</p>
                </div>
              </div>
              <button onClick={() => setShowHeldBillsModal(false)} className="p-2 hover:bg-white rounded-full transition-colors group">
                <FiX className="w-6 h-6 text-slate-400 group-hover:text-slate-600" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
              {isLoadingHeldBills ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="mt-4 text-slate-500 font-medium">Loading held bills...</p>
                </div>
              ) : heldBills.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <FiList className="w-10 h-10 text-slate-300" />
                  </div>
                  <p className="text-lg font-bold text-slate-700">No held bills found</p>
                  <p className="text-sm text-slate-500">New paused transactions will appear here</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {heldBills.map((bill) => (
                    <div key={bill._id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden group">
                      <div className="p-4 flex flex-col md:flex-row items-center gap-6">
                        {/* ID & Customer Info */}
                        <div className="flex-1 min-w-0">
                          <span className="inline-block px-2 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded uppercase mb-1 tracking-widest">
                            {bill.holdId || 'PAUSED BILL'}
                          </span>
                          <h3 className="text-lg font-bold text-slate-800 truncate">
                            {bill.customerInfo?.customerName || 'Walk-in Customer'}
                          </h3>
                          <p className="text-xs text-slate-500 font-medium">
                            {new Date(bill.createdAt).toLocaleString()}
                          </p>
                        </div>

                        {/* Items Section */}
                        <div className="flex-[2] border-x border-slate-100 px-6">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                            <FiShoppingCart className="w-3 h-3" />
                            Items ({bill.cart?.length || 0})
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {bill.cart?.slice(0, 5).map((item, idx) => (
                              <span key={idx} className="px-2 py-1 bg-slate-50 text-slate-600 text-[10px] font-bold rounded border border-slate-100">
                                {item.medicineName} x{item.quantity}
                              </span>
                            ))}
                            {bill.cart?.length > 5 && (
                              <span className="px-2 py-1 bg-slate-50 text-slate-400 text-[10px] font-bold rounded">
                                +{bill.cart.length - 5} more
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Total Section */}
                        <div className="text-center px-6 min-w-[150px]">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Total Amount</p>
                          <p className="text-2xl font-black text-indigo-600 font-mono">
                            PKR {bill.subtotal?.toLocaleString()}
                          </p>
                        </div>

                        {/* Actions Section */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => resumeHeldBill(bill)}
                            className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-200 active:scale-95 whitespace-nowrap"
                          >
                            <FiMaximize2 className="w-4 h-4" /> Resume Bill
                          </button>
                          <button
                            onClick={() => deleteHeldBill(bill._id)}
                            className="flex items-center justify-center p-3 bg-white border-2 border-red-100 hover:border-red-200 text-red-500 hover:bg-red-50 rounded-xl font-bold text-sm transition-all active:scale-95"
                            title="Discard Bill"
                          >
                            <FiTrash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 bg-white border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowHeldBillsModal(false)}
                className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-all active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Credit Customer Modal (from POS) */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h3 className="text-lg font-bold text-white">Add Credit Customer</h3>
              <button onClick={() => setShowAddCustomerModal(false)} className="text-white hover:bg-white/20 p-1.5 rounded-lg transition-all">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddCustomer} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-purple-600 mb-2">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Enter full name"
                  value={newCustomerData.name}
                  onChange={(e) => setNewCustomerData({ ...newCustomerData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-purple-600 mb-2">Phone</label>
                <input
                  type="text"
                  placeholder="Enter phone number"
                  value={newCustomerData.phone}
                  onChange={(e) => setNewCustomerData({ ...newCustomerData, phone: e.target.value })}
                  className="w-full px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-purple-600 mb-2">CNIC</label>
                <input
                  type="text"
                  placeholder="e.g. 35202-1234567-1"
                  value={newCustomerData.cnic}
                  onChange={(e) => setNewCustomerData({ ...newCustomerData, cnic: e.target.value })}
                  className="w-full px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-purple-600 mb-2">Address</label>
                <input
                  type="text"
                  placeholder="Enter address"
                  value={newCustomerData.address}
                  onChange={(e) => setNewCustomerData({ ...newCustomerData, address: e.target.value })}
                  className="w-full px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-sm"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="flex-1 px-4 py-3 border-2 border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newCustomerLoading}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-60 text-white rounded-lg font-bold transition-all shadow-lg active:scale-95"
                >
                  {newCustomerLoading ? "Adding..." : "Add Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Credit Customer Modal (from POS) */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h3 className="text-lg font-bold text-white">Add Credit Customer</h3>
              <button onClick={() => setShowAddCustomerModal(false)} className="text-white hover:bg-white/20 p-1.5 rounded-lg transition-all">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddCustomer} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-purple-600 mb-2">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Enter full name"
                  value={newCustomerData.name}
                  onChange={(e) => setNewCustomerData({ ...newCustomerData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-purple-600 mb-2">Phone</label>
                <input
                  type="text"
                  placeholder="Enter phone number"
                  value={newCustomerData.phone}
                  onChange={(e) => setNewCustomerData({ ...newCustomerData, phone: e.target.value })}
                  className="w-full px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-purple-600 mb-2">CNIC</label>
                <input
                  type="text"
                  placeholder="e.g. 35202-1234567-1"
                  value={newCustomerData.cnic}
                  onChange={(e) => setNewCustomerData({ ...newCustomerData, cnic: e.target.value })}
                  className="w-full px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-purple-600 mb-2">Address</label>
                <input
                  type="text"
                  placeholder="Enter address"
                  value={newCustomerData.address}
                  onChange={(e) => setNewCustomerData({ ...newCustomerData, address: e.target.value })}
                  className="w-full px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-sm"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="flex-1 px-4 py-3 border-2 border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newCustomerLoading}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-60 text-white rounded-lg font-bold transition-all shadow-lg active:scale-95"
                >
                  {newCustomerLoading ? "Adding..." : "Add Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Credit Customer Modal (from POS) */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h3 className="text-lg font-bold text-white">Add Credit Customer</h3>
              <button onClick={() => setShowAddCustomerModal(false)} className="text-white hover:bg-white/20 p-1.5 rounded-lg transition-all">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddCustomer} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-purple-600 mb-2">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Enter full name"
                  value={newCustomerData.name}
                  onChange={(e) => setNewCustomerData({ ...newCustomerData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-purple-600 mb-2">Phone</label>
                <input
                  type="text"
                  placeholder="Enter phone number"
                  value={newCustomerData.phone}
                  onChange={(e) => setNewCustomerData({ ...newCustomerData, phone: e.target.value })}
                  className="w-full px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-purple-600 mb-2">CNIC</label>
                <input
                  type="text"
                  placeholder="e.g. 35202-1234567-1"
                  value={newCustomerData.cnic}
                  onChange={(e) => setNewCustomerData({ ...newCustomerData, cnic: e.target.value })}
                  className="w-full px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-purple-600 mb-2">Address</label>
                <input
                  type="text"
                  placeholder="Enter address"
                  value={newCustomerData.address}
                  onChange={(e) => setNewCustomerData({ ...newCustomerData, address: e.target.value })}
                  className="w-full px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-sm"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="flex-1 px-4 py-3 border-2 border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newCustomerLoading}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-60 text-white rounded-lg font-bold transition-all shadow-lg active:scale-95"
                >
                  {newCustomerLoading ? "Adding..." : "Add Customer"}
                </button>
              </div>
            </form>
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
