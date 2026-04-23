import React, { useState, useEffect, useRef } from 'react';
import { FiCalendar, FiDollarSign, FiShoppingCart, FiTrendingUp, FiDownload, FiPackage, FiPieChart, FiBarChart, FiPrinter, FiX } from 'react-icons/fi';
import { pharmacySalesAPI, pharmacyReportsAPI, pharmacyMedicinesAPI } from '../../services/api';

const normalizeToken = (value = '') => value.toLowerCase().replace(/\s+/g, '');
const isInjectionLike = (category = '') => {
  const token = normalizeToken(category);
  return token.includes('injection') || token.includes('infusion');
};

export default function PharmacyReports() {
  const [sales, setSales] = useState([]);
  const [filteredSales, setFilteredSales] = useState([]);
  const [dateRange, setDateRange] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [stats, setStats] = useState({
    totalSales: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    totalItems: 0,
    totalProfit: 0,
    totalCost: 0,
    profitMargin: 0
  });
  const [medicines, setMedicines] = useState([]);
  const [medicineAnalysis, setMedicineAnalysis] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('sales'); // 'sales', 'medicines', 'profit'
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | paid | pending
  const [showReprintModal, setShowReprintModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [previewSale, setPreviewSale] = useState(null);
  const [showRecoverModal, setShowRecoverModal] = useState(false);
  const [recoverSale, setRecoverSale] = useState(null);
  const [recoverAmount, setRecoverAmount] = useState('');
  const [recoverMethod, setRecoverMethod] = useState('Cash');
  const [recoverPaymentDetails, setRecoverPaymentDetails] = useState({
    method: 'Cash',
    bankName: '',
    accountNumber: '',
    walletNumber: '',
    transactionId: '',
    cardHolderName: '',
    cardLast4: '',
    cardAuthCode: ''
  });
  const [recoverLoading, setRecoverLoading] = useState(false);
  const printFrameRef = useRef(null);

  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const saleReceived = (sale) => toNum((sale?.receivedAmount ?? sale?.totalAmount ?? 0));
  const salePending = (sale) => Math.max(0, toNum(sale?.totalAmount) - saleReceived(sale));
  const saleStatus = (sale) => (sale?.status || (salePending(sale) > 0 ? 'Pending' : 'Completed'));

  const todayISO = () => new Date().toISOString().slice(0,10);
  const ALL_FROM = '1900-01-01';
  const ALL_TO = '2999-12-31';

  const openRecoverModal = (sale) => {
    setRecoverSale(sale);
    setRecoverAmount(String(salePending(sale) || ''));
    setRecoverMethod('Cash');
    setRecoverPaymentDetails({
      method: 'Cash',
      bankName: '',
      accountNumber: '',
      walletNumber: '',
      transactionId: '',
      cardHolderName: '',
      cardLast4: '',
      cardAuthCode: ''
    });
    setShowRecoverModal(true);
  };

  const closeRecoverModal = () => {
    setShowRecoverModal(false);
    setRecoverSale(null);
    setRecoverAmount('');
    setRecoverMethod('Cash');
    setRecoverPaymentDetails({
      method: 'Cash',
      bankName: '',
      accountNumber: '',
      walletNumber: '',
      transactionId: '',
      cardHolderName: '',
      cardLast4: '',
      cardAuthCode: ''
    });
  };

  const openReprintModal = (sale) => {
    setSelectedSale(sale);
    setShowReprintModal(true);
  };

  const closeReprintModal = () => {
    setShowReprintModal(false);
    setSelectedSale(null);
  };

  const handlePrint = () => {
    try {
      const frame = printFrameRef.current;
      if (!frame) return;
      const doc = frame.contentWindow.document;
      const el = document.querySelector('.pharm-preview-modal .p-4');
      const html = `<!doctype html><html><head><meta charset='utf-8'><style>@page{size:80mm auto;margin:4mm}body{font-family:Arial;padding:0;width:80mm}</style></head><body>${el.innerHTML}</body></html>`;
      doc.open(); doc.write(html); doc.close();
      setTimeout(()=>frame.contentWindow.print(), 200);
    } catch {}
  };

  const printReceipt = (sale, receiptType = 'PATIENT COPY') => {
    if (!sale || !sale.items || !sale.items.length) return;

    const name = 'Abbottabad Pet Hospital';
    const addr = 'Pharmacy Department';
    const phone = sale.customerContact || '';

    let itemsHTML = '';
    if (receiptType === 'PHARMACY COPY') {
      // Detailed lines per medicine for pharmacy copy
      sale.items.forEach((item, index) => {
        itemsHTML += '<tr>'+
          '<td style="text-align:center;border:1px solid #000;padding:3px">'+(index+1)+'</td>'+
          '<td style="border:1px solid #000;padding:3px">'+(item.medicineName||'Item')+'</td>'+
          '<td style="text-align:center;border:1px solid #000;padding:3px">'+(item.quantity||0)+'</td>'+
          '<td style="text-align:right;border:1px solid #000;padding:3px">PKR '+(item.totalPrice||0)+'</td>'+
        '</tr>';
      });
    } else {
      // Patient copy: group items by main category and show one line per category
      const categoryTotals = {};
      sale.items.forEach((item) => {
        const subCat = item.category || '';
        const catLower = subCat.toLowerCase();
        let mainCat = 'Other Items';
        if (catLower.includes('tablet') || catLower.includes('capsule') || catLower.includes('syrup') || catLower.includes('drops') || catLower.includes('ointment') || catLower.includes('cream') || catLower.includes('gel') || catLower.includes('spray') || catLower.includes('medicine')) {
          mainCat = 'Medicine';
        } else if (catLower.includes('injection')) {
          mainCat = 'Injection';
        } else if (catLower.includes('needle') || catLower.includes('syringe') || catLower.includes('cannula') || catLower.includes('catheter') || catLower.includes('bandage') || catLower.includes('gauze') || catLower.includes('surgical') || catLower.includes('suture') || catLower.includes('gloves')) {
          mainCat = 'Surgical Supplies';
        }
        const amt = Number(item.totalPrice || 0);
        categoryTotals[mainCat] = (categoryTotals[mainCat] || 0) + amt;
      });

      Object.entries(categoryTotals).forEach(([cat, amt], index) => {
        itemsHTML += '<tr>'+
          '<td style="text-align:center;border:1px solid #000;padding:3px">'+(index+1)+'</td>'+
          '<td style="border:1px solid #000;padding:3px">'+cat+'</td>'+
          '<td style="text-align:right;border:1px solid #000;padding:3px">PKR '+amt+'</td>'+
        '</tr>';
      });
    }

    const headerHTML = '<div style="text-align:center;margin-bottom:6px">' +
      '<div style="font-size:14px">'+ name +'</div>' +
      '<div style="font-size:11px">'+ addr +'</div>' +
      (phone ? '<div style="font-size:11px">Phone: '+ phone +'</div>' : '') +
    '</div>';

    const subtotalVal = Number(sale.subtotal||0);
    const discountVal = Number(sale.discount||0);
    const grandTotal = Number(sale.totalAmount || (subtotalVal - discountVal));
    const receivedVal = Number((sale.receivedAmount!=null? sale.receivedAmount : sale.totalAmount) || grandTotal);
    const receivableVal = Math.max(0, grandTotal - receivedVal);

    const totalsTableHTML = (
      '<table>'+
        '<tr><td style="border:1px solid #000;padding:3px">Total</td><td style="border:1px solid #000;padding:3px;text-align:right">'+ subtotalVal.toLocaleString() +'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px;color:#c00">Disc</td><td style="border:1px solid #000;padding:3px;text-align:right;color:#c00">'+ discountVal.toLocaleString() +'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">G.Total</td><td style="border:1px solid #000;padding:3px;text-align:right">'+ grandTotal.toLocaleString() +'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Received</td><td style="border:1px solid #000;padding:3px;text-align:right">'+ receivedVal.toLocaleString() +'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Receiveable</td><td style="border:1px solid #000;padding:3px;text-align:right">'+ receivableVal.toLocaleString() +'</td></tr>'+
      '</table>'
    );

    const detailsTableHTML = (
      '<table>'+
        '<tr><td style="border:1px solid #000;padding:3px">Client ID</td><td style="border:1px solid #000;padding:3px">'+ (sale.clientId||'N/A') +'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Invoice #</td><td style="border:1px solid #000;padding:3px">'+ (sale.invoiceNumber||'N/A') +'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Contact</td><td style="border:1px solid #000;padding:3px">'+ (sale.customerContact||'') +'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Species</td><td style="border:1px solid #000;padding:3px">'+ (sale.species||'') +'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Breed</td><td style="border:1px solid #000;padding:3px">'+ (sale.breed||'') +'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Sex</td><td style="border:1px solid #000;padding:3px">'+ (sale.sex||'') +'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Age</td><td style="border:1px solid #000;padding:3px">'+ (sale.age||'') +'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Weight(kg)</td><td style="border:1px solid #000;padding:3px">'+ (sale.weight||'') +'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Address</td><td style="border:1px solid #000;padding:3px">'+ (sale.address||'') +'</td></tr>'+
      '</table>'
    );

    const footerHTML = '<div style="text-align:center;margin-top:10px;border-top:1px dashed #000;padding-top:8px">' +
      '<div>Thank you!</div>' +
      '<div>Powered by MindSpire</div>' +
    '</div>';

    const titleText = receiptType === 'PHARMACY COPY' ? 'PHARMACY COPY' : 'PATIENT COPY';

    const printContent = (
      '<!doctype html><html><head><meta charset="utf-8" />'+
      '<title>Receipt</title>'+ 
      '<style>'+ 
      '@page{size:80mm auto;margin:2mm}'+
      'body{font-family:monospace;font-size:12px;margin:0;padding:2mm;color:#000;background:#fff;width:80mm;max-width:80mm;font-weight:bold}'+
      'table{width:100%;border-collapse:collapse;margin:5px 0}'+
      'th,td{border:1px solid #000;padding:3px}'+
      'th{text-align:center}'+
      '.title{background:#000;color:#fff;text-align:center;padding:4px 0;margin:6px 0}'+
      '</style></head><body>'+ 
      headerHTML+
      '<div class="title">'+titleText+'</div>'+ 
      '<table>'+
        '<tr><td style="border:1px solid #000;padding:3px">Patient ID</td><td style="border:1px solid #000;padding:3px">'+(sale.patientId||'N/A')+'</td><td style="border:1px solid #000;padding:3px">Date</td><td style="border:1px solid #000;padding:3px">'+new Date().toLocaleDateString()+'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Owner</td><td style="border:1px solid #000;padding:3px">'+(sale.customerName||'Walk-in')+'</td><td style="border:1px solid #000;padding:3px">Payment</td><td style="border:1px solid #000;padding:3px">'+(sale.paymentMethod||'Cash')+'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Pet</td><td style="border:1px solid #000;padding:3px" colspan="3">'+(sale.petName||'N/A')+'</td></tr>'+
      '</table>'+ 
      detailsTableHTML+
      '<table><tr>'+
        '<th style="width:10%">S#</th>'+
        '<th style="width:60%">'+(receiptType === 'PHARMACY COPY' ? 'Medicine' : 'Particular')+'</th>'+
        (receiptType === 'PHARMACY COPY' ? '<th style="width:15%">Qty</th><th style="width:15%">Amount</th>' : '<th style="width:30%">Amount</th>')+
      '</tr>'+itemsHTML+'</table>'+ 
      totalsTableHTML+
      footerHTML+
      '</body></html>'
    );

    let printed = false;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    iframe.onload = () => {
      try {
        setTimeout(()=>{
          if (printed) return;
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          printed = true;
        }, 50);
      } catch (e) {
        console.error('Iframe print failed', e);
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) document.body.removeChild(iframe);
        }, 1500);
      }
    };

    const iframeDoc = iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(printContent);
    iframeDoc.close();
  };

  useEffect(() => {
    fetchSales();
  }, [dateRange]);

  const fetchSales = async () => {
    try {
      setLoading(true);
      
      // Fetch all sales and medicines data
      const [salesResponse, medicinesResponse] = await Promise.all([
        pharmacySalesAPI.getAll(),
        pharmacyMedicinesAPI.getAll()
      ]);

      // Extract data from API response - handle both { data: [...] } and { data: { data: [...] } } formats
      const allSales = salesResponse?.data?.data || salesResponse?.data || [];

      // Filter sales by selected date range using local dates to avoid timezone issues
      const start = new Date(dateRange.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dateRange.endDate);
      end.setHours(23, 59, 59, 999);

      const salesData = allSales
        .filter((sale) => {
          if (!sale.createdAt) return false;
          const created = new Date(sale.createdAt);
          return created >= start && created <= end;
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setSales(salesData);

      // Apply invoice + status Filters
      const needle = invoiceSearch.trim().toLowerCase();
      const withInvoice = needle
        ? salesData.filter(sale => (sale.invoiceNumber || '').toLowerCase().includes(needle))
        : salesData;
      const withStatus = statusFilter === 'paid'
        ? withInvoice.filter(sale => saleStatus(sale) === 'Completed')
        : statusFilter === 'pending'
          ? withInvoice.filter(sale => saleStatus(sale) === 'Pending')
          : withInvoice;
      setFilteredSales(withStatus);
      // Extract medicines data from API response
      const medicinesData = medicinesResponse?.data?.data || medicinesResponse?.data || [];
      setMedicines(medicinesData);
      
      calculateStats(salesData, medicinesData);
      calculateMedicineAnalysis(salesData, medicinesData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRecover = async () => {
    if (!recoverSale) return;
    const amt = Math.max(0, Number(recoverAmount || 0));
    if (!amt) return;
    try {
      setRecoverLoading(true);
      await pharmacySalesAPI.recover(recoverSale._id, {
        amount: amt,
        paymentMethod: recoverMethod,
        paymentDetails: {
          ...recoverPaymentDetails,
          method: recoverPaymentDetails?.method || recoverMethod,
        }
      });
      closeRecoverModal();
      await fetchSales();
    } catch (e) {
      console.error('Recover failed', e);
    } finally {
      setRecoverLoading(false);
    }
  };

  const calculateStats = (salesData, medicinesData) => {
    const totalSales = salesData.length;
    const totalRevenue = salesData.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
    const totalItems = salesData.reduce((sum, sale) => sum + (sale.items?.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0) || 0), 0);
    const averageOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;

    // Calculate total cost and profit
    let totalCost = 0;
    let totalProfit = 0;

    salesData.forEach(sale => {
      // Use totalCost from the sale record if it exists and is valid
      if (sale.totalCost > 0) {
        totalCost += sale.totalCost;
        totalProfit += (sale.totalAmount - sale.totalCost);
        return;
      }

      // Fallback to item-by-item calculation for older records
      sale.items?.forEach(item => {
        const qty = Number(item.quantity || 0);
        const itemRevenue = Number(item.totalPrice || 0);

        // Try to find medicine by ID (handle both string and ObjectId)
        const medId = item.medicineId;
        let medicine = null;
        if (medId) {
          medicine = medicinesData.find(m => 
            m._id === medId || 
            String(m._id) === String(medId)
          );
        }
        
        // Fallback: find by medicineName and batchNo if ID match fails
        if (!medicine && item.medicineName) {
          medicine = medicinesData.find(m => 
            m.medicineName === item.medicineName && 
            (m.batchNo === item.batchNo || (!m.batchNo && !item.batchNo))
          );
        }

        // Use stored purchasePrice from item if available (more accurate for historical data)
        // Otherwise fallback to current medicine purchasePrice
        let purchasePrice = 0;
        if (item.purchasePrice > 0) {
          purchasePrice = item.purchasePrice;
        } else if (medicine?.purchasePrice > 0) {
          purchasePrice = medicine.purchasePrice;
        }

        let itemCost = 0;

        // Check if this is an injection-like item
        const category = item.category || medicine?.category || '';
        if (isInjectionLike(category)) {
          const mlPerVial = Number(item.mlPerVial || medicine?.mlPerVial || 0);
          const mlUsed = Number(item.mlUsed || 0);
          if (mlPerVial > 0 && mlUsed > 0 && purchasePrice > 0) {
            itemCost = (purchasePrice / mlPerVial) * mlUsed;
          }
        } else {
          itemCost = qty * purchasePrice;
        }

        totalCost += itemCost;
        totalProfit += (itemRevenue - itemCost);
      });
    });

    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    setStats({
      totalSales,
      totalRevenue,
      averageOrderValue,
      totalItems,
      totalCost,
      totalProfit,
      profitMargin
    });
  };

  const calculateMedicineAnalysis = (salesData, medicinesData) => {
    const medicineStats = {};

    // Helper to get or create medicine stats
    const getOrCreateStats = (item) => {
      const medId = item.medicineId;
      
      // Try to find existing medicine in inventory
      let medicine = null;
      if (medId) {
        medicine = medicinesData.find(m => 
          m._id === medId || String(m._id) === String(medId)
        );
      }
      
      // Fallback: find by medicineName and batchNo
      if (!medicine && item.medicineName) {
        medicine = medicinesData.find(m => 
          m.medicineName === item.medicineName && 
          (m.batchNo === item.batchNo || (!m.batchNo && !item.batchNo))
        );
      }

      // Use medicine ID from inventory if found, otherwise use sale item ID or generate key
      const key = medicine?._id || medId || `${item.medicineName}_${item.batchNo || 'N/A'}`;

      if (!medicineStats[key]) {
        medicineStats[key] = {
          id: key,
          name: medicine?.medicineName || item.medicineName || 'Unknown Medicine',
          category: medicine?.category || item.category || 'Medicine',
          batchNo: medicine?.batchNo || item.batchNo || 'N/A',
          purchasePrice: medicine?.purchasePrice || item.purchasePrice || 0,
          salePrice: medicine?.salePrice || item.pricePerUnit || 0,
          currentStock: medicine?.quantity || 0,
          unit: medicine?.unit || item.unit || 'pieces',
          mlPerVial: medicine?.mlPerVial || item.mlPerVial || 0,
          quantitySold: 0,
          totalRevenue: 0,
          totalCost: 0,
          totalProfit: 0,
          profitMargin: 0,
          salesCount: 0
        };
      }

      return { stats: medicineStats[key], medicine };
    };

    // Calculate sales data for each medicine
    salesData.forEach(sale => {
      sale.items?.forEach(item => {
        const { stats } = getOrCreateStats(item);
        
        const quantity = Number(item.quantity || 0);
        const revenue = Number(item.totalPrice || 0);
        
        // Use stored purchasePrice from item if available (more accurate)
        let purchasePrice = item.purchasePrice > 0 ? item.purchasePrice : stats.purchasePrice;
        
        let cost = 0;
        const category = item.category || stats.category;

        if (isInjectionLike(category)) {
          const mlPerVial = Number(item.mlPerVial || stats.mlPerVial || 0);
          const mlUsed = Number(item.mlUsed || 0);
          if (mlPerVial > 0 && mlUsed > 0 && purchasePrice > 0) {
            cost = (purchasePrice / mlPerVial) * mlUsed;
          }
        } else {
          cost = quantity * purchasePrice;
        }

        stats.quantitySold += quantity;
        stats.totalRevenue += revenue;
        stats.totalCost += cost;
        stats.totalProfit += (revenue - cost);
        stats.salesCount += 1;
        stats.profitMargin = stats.totalRevenue > 0 ? (stats.totalProfit / stats.totalRevenue) * 100 : 0;
      });
    });

    // Convert to array and sort by profit (descending)
    const analysisArray = Object.values(medicineStats)
      .filter(med => med.quantitySold > 0 || med.currentStock > 0)
      .sort((a, b) => b.totalProfit - a.totalProfit);

    setMedicineAnalysis(analysisArray);
  };

  const exportToCSV = () => {
    const headers = ['Invoice', 'Date', 'Customer', 'Items', 'Subtotal', 'Discount', 'Total', 'Payment Method'];
    const rows = filteredSales.map(sale => [
      sale.invoiceNumber,
      new Date(sale.createdAt).toLocaleString(),
      sale.customerName || 'Walk-in',
      sale.items?.length || 0,
      sale.subtotal,
      sale.discount,
      sale.totalAmount,
      sale.paymentMethod
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pharmacy-sales-${dateRange.startDate}-to-${dateRange.endDate}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
            Sales Reports
          </h1>
          <p className="text-slate-500 mt-1">Analyze sales performance and trends</p>
        </div>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
        >
          <FiDownload /> Export CSV
        </button>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <button
            onClick={() => {
              const t = todayISO();
              setDateRange({ startDate: t, endDate: t });
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg whitespace-nowrap"
          >
            Today
          </button>
          <button
            onClick={() => {
              setDateRange({ startDate: ALL_FROM, endDate: ALL_TO });
            }}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg whitespace-nowrap"
          >
            All
          </button>
          <button
            onClick={fetchSales}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
          >
            Apply
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-1">
        <div className="flex space-x-1">
          {[
            { id: 'sales', label: 'Sales Reports', icon: FiShoppingCart },
            { id: 'medicines', label: 'Medicine Analysis', icon: FiPackage },
            { id: 'profit', label: 'Profit Analysis', icon: FiTrendingUp }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Enhanced Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Total Sales</p>
              <p className="text-3xl font-bold mt-1">{stats.totalSales}</p>
            </div>
            <FiShoppingCart className="w-12 h-12 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Total Revenue</p>
              <p className="text-3xl font-bold mt-1">PKR {stats.totalRevenue.toLocaleString()}</p>
            </div>
            <FiDollarSign className="w-12 h-12 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Total Cost</p>
              <p className="text-3xl font-bold mt-1">PKR {stats.totalCost.toLocaleString()}</p>
            </div>
            <FiBarChart className="w-12 h-12 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Total Profit</p>
              <p className="text-3xl font-bold mt-1">PKR {stats.totalProfit.toLocaleString()}</p>
            </div>
            <FiTrendingUp className="w-12 h-12 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Profit Margin</p>
              <p className="text-3xl font-bold mt-1">{stats.profitMargin.toFixed(1)}%</p>
            </div>
            <FiPieChart className="w-12 h-12 opacity-80" />
          </div>
        </div>
      </div>

      {/* Conditional Content Based on Active Tab */}
      {activeTab === 'sales' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-col gap-3">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <FiShoppingCart className="w-5 h-5 text-blue-500" />
                Sales Transactions
              </h2>
              <div className="flex flex-col md:flex-row gap-3 md:items-center">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <FiCalendar className="w-4 h-4" />
                  <span>
                    {new Date(dateRange.startDate).toLocaleDateString()} - {new Date(dateRange.endDate).toLocaleDateString()}
                  </span>
                </div>
                <button
                  onClick={fetchSales}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-full border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  <FiDownload className="w-4 h-4" />
                  Refresh
                </button>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative w-full sm:max-w-xs">
                <input
                  type="text"
                  value={invoiceSearch}
                  onChange={(e) => {
                    const value = e.target.value;
                    setInvoiceSearch(value);
                    const needle = value.trim().toLowerCase();
                    const withInvoice = needle
                      ? sales.filter((sale) => (sale.invoiceNumber || '').toLowerCase().includes(needle))
                      : sales;
                    const withStatus = statusFilter === 'paid'
                      ? withInvoice.filter(sale => saleStatus(sale) === 'Completed')
                      : statusFilter === 'pending'
                        ? withInvoice.filter(sale => saleStatus(sale) === 'Pending')
                        : withInvoice;
                    setFilteredSales(withStatus);
                  }}
                  placeholder="Search by Invoice Number..."
                  className="w-full pl-3 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div className="w-full sm:max-w-[200px]">
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    const v = e.target.value;
                    setStatusFilter(v);
                    const needle = invoiceSearch.trim().toLowerCase();
                    const withInvoice = needle
                      ? sales.filter((sale) => (sale.invoiceNumber || '').toLowerCase().includes(needle))
                      : sales;
                    const withStatus = v === 'paid'
                      ? withInvoice.filter(sale => saleStatus(sale) === 'Completed')
                      : v === 'pending'
                        ? withInvoice.filter(sale => saleStatus(sale) === 'Pending')
                        : withInvoice;
                    setFilteredSales(withStatus);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="all">All</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FiShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>No sales found for the selected date range</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Invoice</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date & Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Items</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Subtotal</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Discount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Payment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredSales.map((sale) => (
                  <tr key={sale._id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <button className="font-medium text-blue-600 hover:underline" onClick={()=>setPreviewSale(sale)}>{sale.invoiceNumber}</button>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      <div>
                        <p>{new Date(sale.createdAt).toLocaleDateString()}</p>
                        <p className="text-xs text-slate-500">{new Date(sale.createdAt).toLocaleTimeString()}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-slate-800">{sale.customerName || 'Walk-in'}</p>
                        {sale.customerContact && (
                          <p className="text-sm text-slate-500">{sale.customerContact}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{sale.items?.length || 0}</td>
                    <td className="px-6 py-4 text-slate-600">PKR {sale.subtotal.toLocaleString()}</td>
                    <td className="px-6 py-4 text-orange-600">
                      {sale.discount > 0 ? `-Rs${sale.discount.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-6 py-4 font-semibold text-green-600">PKR {sale.totalAmount.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      {(() => {
                        const st = saleStatus(sale);
                        const received = saleReceived(sale);
                        const pending = salePending(sale);
                        return (
                          <div className="flex flex-col gap-1">
                            <span className={`inline-flex w-fit px-2 py-1 rounded-full text-xs font-medium ${st === 'Pending' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                              {st === 'Pending' ? 'Pending' : 'Paid'}
                            </span>
                            <span className="text-xs text-slate-500">Received: PKR {received.toLocaleString()}</span>
                            <span className="text-xs text-slate-500">Receivable: PKR {pending.toLocaleString()}</span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        {sale.paymentMethod}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openReprintModal(sale)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
                        >
                          <FiPrinter className="w-4 h-4" />
                          Reprint
                        </button>
                        {salePending(sale) > 0 && (
                          <button
                            onClick={() => openRecoverModal(sale)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                          >
                            Recover
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          )}

          {/* Top Selling Medicines */}
          {filteredSales.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Top Selling Medicines</h2>
              <div className="space-y-3">
                {(() => {
                  const medicineSales = {};
                  filteredSales.forEach(sale => {
                    sale.items?.forEach(item => {
                      if (!medicineSales[item.medicineName]) {
                        medicineSales[item.medicineName] = { quantity: 0, revenue: 0 };
                      }
                      medicineSales[item.medicineName].quantity += item.quantity;
                      medicineSales[item.medicineName].revenue += item.totalPrice;
                    });
                  });

                  return Object.entries(medicineSales)
                    .sort((a, b) => b[1].quantity - a[1].quantity)
                    .slice(0, 5)
                    .map(([name, data], idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <p className="font-medium text-slate-800">{name}</p>
                          <p className="text-sm text-slate-500">Sold: {data.quantity} units</p>
                        </div>
                        <p className="font-semibold text-green-600">PKR {data.revenue.toLocaleString()}</p>
                      </div>
                    ));
                })()}
              </div>
            </div>
          )}
        </div>
      )}
      {previewSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 pharm-preview-modal">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="font-semibold">Invoice {previewSale.invoiceNumber}</div>
              <div className="flex items-center gap-2">
                <button onClick={handlePrint} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg flex items-center gap-2"><FiPrinter/> Print</button>
                <button onClick={()=>setPreviewSale(null)} className="px-3 py-1.5 border rounded-lg">Close</button>
              </div>
            </div>
            <div className="p-4 text-sm">
              <div className="font-semibold mb-2">Abbottabad Pet Hospital</div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>Invoice: <strong>{previewSale.invoiceNumber}</strong></div>
                <div>Date: {new Date(previewSale.createdAt).toLocaleString()}</div>
                <div>Customer: {previewSale.customerName || 'Walk-in'}</div>
                <div>Patient ID: {previewSale.patientId || previewSale.clientId || '-'}</div>
                <div>Payment: {previewSale.paymentMethod}</div>
              </div>
              <div className="border rounded">
                <table className="w-full">
                  <thead className="bg-slate-50"><tr><th className="text-left p-2">Item</th><th className="p-2">Qty</th><th className="p-2">Price</th><th className="p-2">Total</th></tr></thead>
                  <tbody className="divide-y">{(previewSale.items||[]).map((i,idx)=>(<tr key={idx}><td className="p-2">{i.medicineName||i.itemName}</td><td className="p-2 text-center">{i.quantity}</td><td className="p-2 text-center">PKR {Number(i.unitPrice||0).toLocaleString()}</td><td className="p-2 text-right">PKR {Number(i.totalPrice||0).toLocaleString()}</td></tr>))}</tbody>
                </table>
              </div>
              <div className="mt-2 text-right space-y-1">
                <div>Subtotal: <strong>PKR {Number(previewSale.subtotal||0).toLocaleString()}</strong></div>
                {Number(previewSale.discount||0)>0 && <div>Discount: <strong>-PKR {Number(previewSale.discount||0).toLocaleString()}</strong></div>}
                {Number(previewSale.previousDue||0)>0 && <div>Previous Receivable: <strong>PKR {Number(previewSale.previousDue||0).toLocaleString()}</strong></div>}
                {typeof previewSale.receivedAmount==='number' && <div>Received ({previewSale.paymentMethod}): <strong>PKR {Number(previewSale.receivedAmount||0).toLocaleString()}</strong></div>}
                <div className="text-lg">Total: <strong>PKR {Number(previewSale.totalAmount||0).toLocaleString()}</strong></div>
                {Number(previewSale.balanceDue||0)>0 && <div>Balance Due: <strong>PKR {Number(previewSale.balanceDue||0).toLocaleString()}</strong></div>}
              </div>
            </div>
            <iframe ref={printFrameRef} style={{display:'none'}} title="print" />
          </div>
        </div>
      )}

      {/* Medicine Analysis Tab */}
      {activeTab === 'medicines' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800">Medicine-wise Analysis</h2>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : medicineAnalysis.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FiPackage className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>No medicine data available</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Medicine</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Current Stock</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Sold Qty</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Purchase Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Sale Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Revenue</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Cost</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Profit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {medicineAnalysis.map((medicine) => (
                    <tr key={medicine.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-slate-800">{medicine.name}</p>
                          <p className="text-sm text-slate-500">Batch: {medicine.batchNo}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                          {medicine.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        <span className={`font-semibold ${medicine.currentStock <= 10 ? 'text-orange-600' : 'text-green-600'}`}>
                          {medicine.currentStock} {medicine.unit}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-medium">{medicine.quantitySold}</td>
                      <td className="px-6 py-4 text-slate-600">PKR {medicine.purchasePrice.toLocaleString()}</td>
                      <td className="px-6 py-4 text-slate-600">PKR {medicine.salePrice.toLocaleString()}</td>
                      <td className="px-6 py-4 font-semibold text-green-600">PKR {medicine.totalRevenue.toLocaleString()}</td>
                      <td className="px-6 py-4 text-red-600">PKR {medicine.totalCost.toLocaleString()}</td>
                      <td className="px-6 py-4 font-semibold text-emerald-600">PKR {medicine.totalProfit.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className={`font-semibold ${medicine.profitMargin >= 20 ? 'text-green-600' : medicine.profitMargin >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {medicine.profitMargin.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Profit Analysis Tab */}
      {activeTab === 'profit' && (
        <div className="space-y-6">
          {/* Profit Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
              <p className="text-sm opacity-90">Total Revenue</p>
              <p className="text-2xl font-bold">PKR {stats.totalRevenue.toLocaleString()}</p>
            </div>
            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 text-white">
              <p className="text-sm opacity-90">Total Cost</p>
              <p className="text-2xl font-bold">PKR {stats.totalCost.toLocaleString()}</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white">
              <p className="text-sm opacity-90">Net Profit</p>
              <p className="text-2xl font-bold">PKR {stats.totalProfit.toLocaleString()}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
              <p className="text-sm opacity-90">Profit Margin</p>
              <p className="text-2xl font-bold">{stats.profitMargin.toFixed(1)}%</p>
            </div>
          </div>

          {/* Top Profitable Medicines */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Most Profitable Medicines</h2>
            <div className="space-y-3">
              {medicineAnalysis
                .filter(med => med.totalProfit > 0)
                .slice(0, 10)
                .map((medicine, idx) => (
                  <div key={medicine.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{medicine.name}</p>
                        <p className="text-sm text-slate-500">{medicine.category} • Sold: {medicine.quantitySold} units</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600 text-lg">PKR {medicine.totalProfit.toLocaleString()}</p>
                      <p className="text-sm text-slate-500">{medicine.profitMargin.toFixed(1)}% margin</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Low Profit Medicines */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Low Profit Medicines (Need Attention)</h2>
            <div className="space-y-3">
              {medicineAnalysis
                .filter(med => med.quantitySold > 0 && med.profitMargin < 15)
                .slice(0, 5)
                .map((medicine) => (
                  <div key={medicine.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-red-50 to-orange-50 rounded-lg border border-red-200">
                    <div>
                      <p className="font-semibold text-slate-800">{medicine.name}</p>
                      <p className="text-sm text-slate-500">{medicine.category} • Sold: {medicine.quantitySold} units</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-600">PKR {medicine.totalProfit.toLocaleString()}</p>
                      <p className="text-sm text-red-500">{medicine.profitMargin.toFixed(1)}% margin</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
      {showReprintModal && selectedSale && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-800">Reprint Receipt</h3>
              <button
                onClick={closeReprintModal}
                className="text-slate-400 hover:text-slate-600"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="px-4 py-4 space-y-3">
              <p className="text-sm text-slate-600">
                Select which copy you want to reprint for invoice
                <span className="font-semibold"> #{selectedSale.invoiceNumber}</span>.
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => { printReceipt(selectedSale, 'PHARMACY COPY'); closeReprintModal(); }}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-slate-800 text-white hover:bg-slate-900"
                >
                  <FiPrinter className="w-4 h-4" /> Pharmacy Copy
                </button>
                <button
                  onClick={() => { printReceipt(selectedSale, 'PATIENT COPY'); closeReprintModal(); }}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  <FiPrinter className="w-4 h-4" /> Patient Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showRecoverModal && recoverSale && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-800">Recover Payment</h3>
              <button onClick={closeRecoverModal} className="text-slate-400 hover:text-slate-600">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="px-4 py-4 space-y-3">
              <div className="text-sm text-slate-700">
                Invoice <span className="font-semibold">#{recoverSale.invoiceNumber}</span>
              </div>
              <div className="text-xs text-slate-500">
                Pending: PKR {salePending(recoverSale).toLocaleString()}
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Amount</label>
                <input
                  type="number"
                  min="0"
                  value={recoverAmount}
                  onChange={(e) => setRecoverAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Payment Method</label>
                <select
                  value={recoverMethod}
                  onChange={(e) => {
                    const m = e.target.value
                    setRecoverMethod(m)
                    setRecoverPaymentDetails(p => ({
                      ...p,
                      method: m,
                      bankName: '',
                      accountNumber: '',
                      walletNumber: '',
                      transactionId: '',
                      cardHolderName: '',
                      cardLast4: '',
                      cardAuthCode: ''
                    }))
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                >
                  <option>Cash</option>
                  <option>Bank Account</option>
                  <option>Credit</option>
                  <option>Debit</option>
                  <option>Easypaisa</option>
                  <option>JazzCash</option>
                  <option>Other</option>
                </select>
              </div>
              {(() => {
                const m = String(recoverMethod || '').toLowerCase()
                const isBank = m.includes('bank')
                const isEasy = m.includes('easypaisa')
                const isJazz = m.includes('jazzcash')
                const isCard = m.includes('credit') || m.includes('debit')
                if (!recoverMethod) return null
                if (!(isBank || isEasy || isJazz || isCard)) return null
                return (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3">
                    <div className="text-xs font-semibold text-slate-600">Payment Details ({recoverMethod})</div>
                    {isBank && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Bank Name</label>
                          <input
                            value={recoverPaymentDetails.bankName}
                            onChange={(e) => setRecoverPaymentDetails(p => ({ ...p, bankName: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            placeholder="e.g. HBL"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Account / IBAN</label>
                          <input
                            value={recoverPaymentDetails.accountNumber}
                            onChange={(e) => setRecoverPaymentDetails(p => ({ ...p, accountNumber: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            placeholder="Account number"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs text-slate-500 mb-1">Transaction ID</label>
                          <input
                            value={recoverPaymentDetails.transactionId}
                            onChange={(e) => setRecoverPaymentDetails(p => ({ ...p, transactionId: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            placeholder="Reference / TXN ID"
                          />
                        </div>
                      </div>
                    )}
                    {(isEasy || isJazz) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Wallet Number</label>
                          <input
                            value={recoverPaymentDetails.walletNumber}
                            onChange={(e) => setRecoverPaymentDetails(p => ({ ...p, walletNumber: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            placeholder="03xx..."
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Transaction ID</label>
                          <input
                            value={recoverPaymentDetails.transactionId}
                            onChange={(e) => setRecoverPaymentDetails(p => ({ ...p, transactionId: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            placeholder="Reference / TXN ID"
                          />
                        </div>
                      </div>
                    )}
                    {isCard && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Card Holder</label>
                          <input
                            value={recoverPaymentDetails.cardHolderName}
                            onChange={(e) => setRecoverPaymentDetails(p => ({ ...p, cardHolderName: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            placeholder="Name"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Card Last 4</label>
                          <input
                            value={recoverPaymentDetails.cardLast4}
                            onChange={(e) => setRecoverPaymentDetails(p => ({ ...p, cardLast4: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            placeholder="1234"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs text-slate-500 mb-1">Auth Code / Transaction ID</label>
                          <input
                            value={recoverPaymentDetails.cardAuthCode}
                            onChange={(e) => setRecoverPaymentDetails(p => ({ ...p, cardAuthCode: e.target.value, transactionId: p.transactionId || e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            placeholder="Auth code"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleRecover}
                  disabled={recoverLoading}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {recoverLoading ? 'Saving...' : 'Recover'}
                </button>
                <button
                  onClick={closeRecoverModal}
                  className="px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
