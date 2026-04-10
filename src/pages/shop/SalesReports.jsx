import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FiCalendar, FiDollarSign, FiShoppingCart, FiTrendingUp, FiDownload, FiPrinter, FiEye, FiX } from 'react-icons/fi';
import { salesAPI, settingsAPI } from '../../services/api';

export default function SalesReports() {
  const [sales, setSales] = useState([]);
  const [filteredSales, setFilteredSales] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [dateRange, setDateRange] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [stats, setStats] = useState({
    totalSales: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    totalItems: 0
  });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [previewSale, setPreviewSale] = useState(null);
  const [hospitalSettings, setHospitalSettings] = useState(null);
  const printFrameRef = useRef(null);

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

  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const itemWiseDiscount = (sale) => (sale?.items || []).reduce((s, it) => s + Math.max(0, toNum(it?.discount)), 0);
  const billDiscountAmount = (sale) => ((toNum(sale?.subtotal) * Math.max(0, toNum(sale?.discount))) / 100);
  const totalDiscountAmount = (sale) => Math.max(0, itemWiseDiscount(sale) + billDiscountAmount(sale));
  const saleReceived = (sale) => {
    if (typeof sale?.receivedAmount === 'number') return toNum(sale?.receivedAmount);
    if (typeof sale?.balanceDue === 'number') return Math.max(0, toNum(sale?.totalAmount) - toNum(sale?.balanceDue));
    return toNum((sale?.totalAmount ?? 0));
  };
  const salePending = (sale) => {
    if (typeof sale?.balanceDue === 'number') return Math.max(0, toNum(sale?.balanceDue));
    return Math.max(0, toNum(sale?.totalAmount) - saleReceived(sale));
  };
  const paymentLabel = (sale) => (sale?.paymentDetails?.method || sale?.paymentMethod || 'Cash');

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

  const handleRecover = async () => {
    if (!recoverSale) return;
    const amt = Math.max(0, Number(recoverAmount || 0));
    if (!amt) return;
    try {
      setRecoverLoading(true);
      await salesAPI.recover(recoverSale._id, {
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

  // Build thermal receipt HTML identical to Pet Shop POS
  const buildThermalReceiptHTML = (sale) => {
    const baseSubtotal = Number(sale?.subtotal || 0);
    const extraCharge = Number(sale?.paymentCharge || 0);
    const shares = (sale?.items || []).map((it, i, arr) => {
      if (baseSubtotal <= 0 || extraCharge <= 0) return 0;
      if (i < arr.length - 1) return Number(((Number(it.totalPrice||0) / baseSubtotal) * extraCharge).toFixed(2));
      const prev = arr.slice(0, i).reduce((s, x) => s + Number(((Number(x.totalPrice||0) / baseSubtotal) * extraCharge).toFixed(2)), 0);
      return Number((extraCharge - prev).toFixed(2));
    });
    const billDisc = ((Number(sale?.subtotal||0) * Number(sale?.discount||0)) / 100);
    const itemDisc = (sale?.items || []).reduce((s, it) => s + Math.max(0, Number(it?.discount || 0)), 0);
    const discountCurrency = Math.max(0, billDisc + itemDisc);
    const headerName = hospitalSettings?.companyName || 'Abbottabad Pet Hospital';
    const headerAddr = hospitalSettings?.address || 'Main Boulevard, Gulshan-e-Iqbal, Karachi';
    const headerPhone = hospitalSettings?.phone || '+92-21-1234567';
    const payLabel = (sale?.paymentDetails?.method || sale?.paymentMethod || 'Cash');

    return `<!DOCTYPE html>
      <html>
      <head>
        <title>Reprint - ${sale?.invoiceNumber || 'N/A'}</title>
        <meta charset="utf-8" />
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          body { font-family: 'Poppins', Arial, sans-serif; }
          .header { text-align:center; margin-bottom:10px; }
          .hospital-name { font-size:16px; font-weight:700; color:#1e293b; }
          .hospital-info { font-size:11px; color:#64748b; }
          .receipt-title { text-align:center; padding:6px; font-size:14px; font-weight:700; color:#fff; background:linear-gradient(to right,#2563eb,#10b981); border-radius:8px; margin:6px 0; }
          .meta { width:100%; border-collapse:collapse; border:1px solid #e2e8f0; margin-bottom:8px; }
          .meta td { padding:6px 8px; font-size:12px; border-bottom:1px solid #e2e8f0; }
          .meta tr:last-child td { border-bottom:none; }
          .meta td.l { color:#64748b; }
          .meta td.r { text-align:right; font-weight:600; color:#1e293b; }
          .items { width:100%; table-layout:fixed; border-collapse:collapse; }
          .items th,.items td { padding:6px 4px; font-size:12px; border-bottom:1px solid #e2e8f0; }
          .items th:first-child,.items td:first-child { text-align:left; }
          .items th:nth-child(1),.items td:nth-child(1) { width:46%; }
          .items th:nth-child(2),.items td:nth-child(2) { width:12%; text-align:center; }
          .items th:nth-child(3),.items td:nth-child(3) { width:20%; text-align:right; }
          .items th:nth-child(4),.items td:nth-child(4) { width:22%; text-align:right; }
          .items td:first-child { white-space:normal; word-break:break-word; overflow-wrap:anywhere; }
          thead { background:#f1f5f9; }
          th { font-weight:700; color:#475569; text-align:center; }
          .totals { width:100%; border-collapse:collapse; margin-top:6px; }
          .totals td { padding:6px 8px; font-size:12px; }
          .totals td.l { color:#334155; }
          .totals td.r { text-align:right; font-weight:600; }
          .totals tr.sep td { border-top:2px solid #cbd5e1; padding-top:8px; }
          @page { size:80mm auto; margin:5mm; }
          body { padding:0; width:70mm; margin:0 auto; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="hospital-name">${headerName}</div>
          <div class="hospital-info">${headerAddr}<br/>Phone: ${headerPhone}</div>
        </div>
        <div class="receipt-title">SALES RECEIPT</div>
        <table class="meta"><tbody>
          <tr><td class="l">Customer ID</td><td class="r">${sale?.customerId || '-'}</td></tr>
          <tr><td class="l">Date</td><td class="r">${new Date(sale?.createdAt).toLocaleString()}</td></tr>
          <tr><td class="l">Customer</td><td class="r">${sale?.customerName || 'Walk-in'}</td></tr>
          <tr><td class="l">Phone</td><td class="r">${sale?.customerContact || '-'}</td></tr>
        </tbody></table>
        <table class="items"><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>
          ${(sale?.items||[]).map((item,idx)=>{
            const share = shares[idx] || 0; const qty = Math.max(1, Number(item.quantity||1));
            const rate = Number(item.unitPrice||0) + (share/qty); const tot = Number(item.totalPrice||0) + share;
            return `<tr><td>${item.itemName}</td><td>${item.quantity}</td><td>Rs${rate.toFixed(2)}</td><td>Rs${tot.toFixed(2)}</td></tr>`;
          }).join('')}
        </tbody></table>
        <table class="totals"><tbody>
          <tr><td class="l">Subtotal:</td><td class="r">Rs${(Number(sale?.subtotal||0)+Number(sale?.paymentCharge||0)).toLocaleString()}</td></tr>
          ${discountCurrency > 0 ? `<tr><td class="l" style="color:#f97316">Discount:</td><td class="r" style="color:#f97316">-Rs${discountCurrency.toLocaleString()}</td></tr>` : ''}
          ${sale?.previousDue>0 ? `<tr><td class="l">Previous Receivable:</td><td class="r">Rs${sale.previousDue.toLocaleString()}</td></tr>` : ''}
          ${(typeof sale?.receivedAmount==='number') ? `<tr><td class="l">Received (${payLabel}):</td><td class="r">Rs${(sale.receivedAmount||0).toLocaleString()}</td></tr>` : ''}
          <tr class="sep"><td class="l">Total:</td><td class="r">Rs${(sale?.totalAmount||0).toLocaleString()}</td></tr>
          ${sale?.balanceDue>0 ? `<tr><td class="l">Balance Due:</td><td class="r">Rs${sale.balanceDue.toLocaleString()}</td></tr>` : ''}
        </tbody></table>
        <div style="text-align:center; font-size:11px; color:#94a3b8; margin-top:8px;">No return or exchange without receipt. Goods once sold will not be taken back.</div>
        <div style="text-align:center; font-size:11px; color:#94a3b8;">Powered by <strong style="color:#2563eb;">MindSpire</strong></div>
      </body>
      </html>`;
  };

  const printSaleReceipt = (sale) => {
    try {
      const html = buildThermalReceiptHTML(sale);
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
      const doc = iframe.contentWindow.document;
      doc.open(); doc.write(html); doc.close();
      setTimeout(()=>{ try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch {} }, 200);
      // auto-close the preview dialog now
      try { setPreviewSale(null); } catch {}
      setTimeout(()=>{ try { document.body.removeChild(iframe); } catch {} }, 1500);
    } catch {}
  };

  useEffect(() => {
    fetchSales();
    loadSettings();
  }, [dateRange]);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const response = await salesAPI.getByDateRange(dateRange.startDate, dateRange.endDate);
      const salesData = response.data || [];
      setSales(salesData);
      setFilteredSales(applySearch(salesData, search));
      calculateStats(salesData);
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const resp = await settingsAPI.get(user.username || 'admin');
      setHospitalSettings(resp.data || null);
    } catch {}
  };

  const applySearch = (data, q) => {
    if (!q) return data;
    const s = q.toLowerCase();
    return data.filter(x =>
      (x.invoiceNumber||'').toLowerCase().includes(s) ||
      (x.customerId||'').toLowerCase().includes(s) ||
      (x.customerName||'').toLowerCase().includes(s)
    );
  };

  useEffect(() => {
    setPage(1);
  }, [search, dateRange?.startDate, dateRange?.endDate]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil((filteredSales?.length || 0) / pageSize));
  }, [filteredSales, pageSize]);
  useEffect(() => {
    setPage(p => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);
  const pagedSales = useMemo(() => {
    const list = Array.isArray(filteredSales) ? filteredSales : [];
    const start = (page - 1) * pageSize;
    return list.slice(start, start + pageSize);
  }, [filteredSales, page, pageSize]);

  const calculateStats = (salesData) => {
    const totalSales = salesData.length;
    const totalRevenue = salesData.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const totalItems = salesData.reduce((sum, sale) => sum + (sale.items?.length || 0), 0);
    const averageOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;

    setStats({
      totalSales,
      totalRevenue,
      averageOrderValue,
      totalItems
    });
  };

  const exportToCSV = () => {
    const headers = ['Invoice', 'Date', 'Customer', 'Items', 'Discount', 'Total', 'Payment Method'];
    const rows = filteredSales.map(sale => [
      sale.invoiceNumber,
      new Date(sale.createdAt).toLocaleString(),
      sale.customerName || 'Walk-in',
      sale.items?.length || 0,
      totalDiscountAmount(sale),
      sale.totalAmount,
      paymentLabel(sale)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-report-${dateRange.startDate}-to-${dateRange.endDate}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
            Sales Reports
          </h1>
          <p className="text-slate-500 mt-1">Analyze sales performance and trends</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search invoice / customer ID / name"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setFilteredSales(applySearch(sales, e.target.value)); }}
            className="px-3 py-2 border border-slate-300 rounded-lg"
          />
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
          >
            <FiDownload /> Export CSV
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <p className="text-3xl font-bold mt-1">Rs{stats.totalRevenue.toLocaleString()}</p>
            </div>
            <FiDollarSign className="w-12 h-12 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Avg Order Value</p>
              <p className="text-3xl font-bold mt-1">Rs{Math.round(stats.averageOrderValue).toLocaleString()}</p>
            </div>
            <FiTrendingUp className="w-12 h-12 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Items Sold</p>
              <p className="text-3xl font-bold mt-1">{stats.totalItems}</p>
            </div>
            <FiCalendar className="w-12 h-12 opacity-80" />
          </div>
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-800">Sales Transactions</h2>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div className="text-sm text-slate-600 font-medium">
                Showing {filteredSales.length===0 ? 0 : ((page - 1) * pageSize + 1)}-{Math.min(page * pageSize, filteredSales.length)} of {filteredSales.length}
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
          <div className="overflow-x-hidden max-w-full">
            <table className="w-full table-fixed">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase w-28">Invoice</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase w-28">Customer ID</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase w-28">Date & Time</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase w-32">Customer</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase w-14">Items</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase w-20">Discount</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase w-20">Total</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase w-24">Payment</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase w-24">Receivable</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase w-36">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pagedSales.map((sale) => (
                  <tr key={sale._id} className="hover:bg-slate-50">
                    <td className="px-3 py-3">
                      <span className="font-medium text-slate-800 text-xs leading-4 break-all whitespace-normal">{sale.invoiceNumber}</span>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {sale.customerId ? (
                        <span className="text-xs leading-4 break-all whitespace-normal">{sale.customerId}</span>
                      ) : '-'}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      <div>
                        <p>{new Date(sale.createdAt).toLocaleDateString()}</p>
                        <p className="text-xs text-slate-500">{new Date(sale.createdAt).toLocaleTimeString()}</p>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div>
                        <p className="font-medium text-slate-800 text-sm truncate">{sale.customerName || 'Walk-in'}</p>
                        {sale.customerContact && (
                          <p className="text-xs text-slate-500 truncate">{sale.customerContact}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-600 text-sm">{sale.items?.length || 0}</td>
                    <td className="px-3 py-3 text-orange-600 text-sm">
                      {totalDiscountAmount(sale) > 0 ? `-Rs${totalDiscountAmount(sale).toLocaleString()}` : '-'}
                    </td>
                    <td className="px-3 py-3 font-semibold text-green-600 text-sm">Rs{sale.totalAmount.toLocaleString()}</td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 whitespace-normal break-words inline-block">
                        {paymentLabel(sale)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {sale.balanceDue > 0 ? (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Rs{sale.balanceDue.toLocaleString()}</span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Paid</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button title="View" onClick={()=>setPreviewSale(sale)} className="p-2 border rounded-lg hover:bg-slate-50"><FiEye /></button>
                        <button title="Reprint" onClick={()=> printSaleReceipt(sale)} className="p-2 border rounded-lg hover:bg-slate-50"><FiPrinter /></button>
                        {sale.balanceDue > 0 && (
                          <button title="Recover" onClick={()=> openRecoverModal(sale)} className="px-3 py-2 border rounded-lg hover:bg-slate-50 text-xs font-semibold whitespace-nowrap">Recover</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top Selling Products */}
      {filteredSales.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Top Selling Products</h2>
          <div className="space-y-3">
            {(() => {
              const productSales = {};
              filteredSales.forEach(sale => {
                sale.items?.forEach(item => {
                  if (!productSales[item.itemName]) {
                    productSales[item.itemName] = { quantity: 0, revenue: 0 };
                  }
                  productSales[item.itemName].quantity += item.quantity;
                  productSales[item.itemName].revenue += item.totalPrice;
                });
              });

              return Object.entries(productSales)
                .sort((a, b) => b[1].quantity - a[1].quantity)
                .slice(0, 5)
                .map(([name, data], idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-medium text-slate-800">{name}</p>
                      <p className="text-sm text-slate-500">Sold: {data.quantity} units</p>
                    </div>
                    <p className="font-semibold text-green-600">Rs{data.revenue.toLocaleString()}</p>
                  </div>
                ));
            })()}
          </div>
        </div>
      )}
      {/* Preview/Print Modal */}
      {previewSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="font-semibold">Invoice {previewSale.invoiceNumber}</div>
              <div className="flex items-center gap-2">
                <button onClick={()=>printSaleReceipt(previewSale)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg flex items-center gap-2"><FiPrinter/> Print</button>
                <button onClick={()=>setPreviewSale(null)} className="px-3 py-1.5 border rounded-lg">Close</button>
              </div>
            </div>
            <div className="p-4 text-sm">
              <div className="font-semibold mb-2">{hospitalSettings?.companyName || 'Abbottabad Pet Hospital'}</div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>Customer ID: <strong>{previewSale.customerId || '-'}</strong></div>
                <div>Date: {new Date(previewSale.createdAt).toLocaleString()}</div>
                <div>Customer: {previewSale.customerName || 'Walk-in'}</div>
                <div>Phone: {previewSale.customerContact || '-'}</div>
                <div>Payment: {paymentLabel(previewSale)}</div>
              </div>
              <div className="border rounded">
                <table className="w-full">
                  <thead className="bg-slate-50"><tr><th className="text-left p-2">Item</th><th className="p-2">Qty</th><th className="p-2">Price</th><th className="p-2">Total</th></tr></thead>
                  <tbody className="divide-y">{previewSale.items.map((i,idx)=>(<tr key={idx}><td className="p-2">{i.itemName}</td><td className="p-2 text-center">{i.quantity}</td><td className="p-2 text-center">Rs{i.unitPrice.toLocaleString()}</td><td className="p-2 text-right">Rs{i.totalPrice.toLocaleString()}</td></tr>))}</tbody>
                </table>
              </div>
              <div className="mt-2 text-right space-y-1">
                <div>Subtotal: <strong>Rs{(Number(previewSale.subtotal||0) + Number(previewSale.paymentCharge||0)).toLocaleString()}</strong></div>
                {totalDiscountAmount(previewSale)>0 && <div>Discount: <strong>-Rs{totalDiscountAmount(previewSale).toLocaleString()}</strong></div>}
                {previewSale.previousDue>0 && <div>Previous Receivable: <strong>Rs{previewSale.previousDue.toLocaleString()}</strong></div>}
                {typeof previewSale.receivedAmount==='number' && <div>Received ({paymentLabel(previewSale)}): <strong>Rs{(previewSale.receivedAmount||0).toLocaleString()}</strong></div>}
                <div className="text-lg">Total: <strong>Rs{previewSale.totalAmount.toLocaleString()}</strong></div>
                {previewSale.balanceDue>0 && <div>Balance Due: <strong>Rs{previewSale.balanceDue.toLocaleString()}</strong></div>}
              </div>
            </div>
            <iframe ref={printFrameRef} style={{display:'none'}} title="print" />
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
                Pending: Rs{salePending(recoverSale).toLocaleString()}
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
                            placeholder="Name on card"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Last 4 Digits</label>
                          <input
                            value={recoverPaymentDetails.cardLast4}
                            onChange={(e) => setRecoverPaymentDetails(p => ({ ...p, cardLast4: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            placeholder="1234"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs text-slate-500 mb-1">Auth Code</label>
                          <input
                            value={recoverPaymentDetails.cardAuthCode}
                            onChange={(e) => setRecoverPaymentDetails(p => ({ ...p, cardAuthCode: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            placeholder="Auth code"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
            <div className="border-t border-slate-200 px-4 py-3 flex gap-2">
              <button onClick={closeRecoverModal} className="flex-1 px-3 py-2 border rounded-lg text-sm">Cancel</button>
              <button
                onClick={handleRecover}
                disabled={recoverLoading}
                className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-semibold"
              >
                {recoverLoading ? 'Recovering...' : 'Recover'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
