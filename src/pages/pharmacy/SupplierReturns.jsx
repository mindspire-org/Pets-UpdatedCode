import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiSearch,
  FiFilter,
  FiDownload,
  FiRefreshCw,
  FiX,
  FiCornerUpLeft,
  FiPrinter,
  FiClock,
} from "react-icons/fi";
import { pharmacyHistoryAPI, settingsAPI } from "../../services/api";
import DateRangePicker from "../../components/DateRangePicker";
import Modal from "../../components/Modal";

export default function SupplierReturns() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: "", endDate: "", supplierName: "",
    invoiceNo: "", purchaseOrderNo: "",
  });
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalCount: 0 });
  const [summary, setSummary] = useState({ totalPurchases: 0, totalAmount: 0, totalPaid: 0, outstandingAmount: 0 });
  const [modal, setModal] = useState({ isOpen: false, type: "info", title: "", message: "", onConfirm: null });
  const [hospitalSettings, setHospitalSettings] = useState(null);

  // Return dialog state
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnPurchase, setReturnPurchase] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [returnReason, setReturnReason] = useState("");
  const [refundMethod, setRefundMethod] = useState("Cash");
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnToast, setReturnToast] = useState("");

  // Return slip state
  const [showSlip, setShowSlip] = useState(false);
  const [slipData, setSlipData] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    settingsAPI.get(JSON.parse(localStorage.getItem("user") || "{}").username || "admin")
      .then(r => setHospitalSettings(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    fetchPurchases();
  }, [pagination.currentPage]);

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const params = { ...filters, page: pagination.currentPage, limit: 20 };
      Object.keys(params).forEach(k => { if (!params[k]) delete params[k]; });
      const res = await pharmacyHistoryAPI.getPurchaseHistory(params);
      setPurchases(res.data.purchases || []);
      setPagination(res.data.pagination || { currentPage: 1, totalPages: 1, totalCount: 0 });
      setSummary(res.data.summary || { totalPurchases: 0, totalAmount: 0, totalPaid: 0, outstandingAmount: 0 });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => setFilters(p => ({ ...p, [field]: value }));
  const handleDateRangeChange = (dr) => setFilters(p => ({ ...p, startDate: dr.fromDate, endDate: dr.toDate }));
  const applyFilters = () => { setPagination(p => ({ ...p, currentPage: 1 })); setTimeout(fetchPurchases, 0); };
  const clearFilters = () => {
    setFilters({ startDate: "", endDate: "", supplierName: "", invoiceNo: "", purchaseOrderNo: "" });
    setPagination(p => ({ ...p, currentPage: 1 }));
    setTimeout(fetchPurchases, 0);
  };

  const showToast = (msg) => { setReturnToast(msg); setTimeout(() => setReturnToast(""), 3500); };

  const openReturn = (purchase) => {
    setReturnPurchase(purchase);
    setReturnItems((purchase.items || []).map(item => ({
      medicineId: item.medicineId,
      medicineName: item.medicineName,
      batchNo: item.batchNo || "N/A",
      currentStock: item.currentStock || 0,
      originalQty: Number(item.totalItems ?? item.quantity ?? 0),
      returnQty: 0,
      purchasePrice: Number(item.buyPerUnit ?? item.purchasePrice ?? 0),
      unit: item.unit || "pieces",
      category: item.category || item.mainCategory || "Medicine",
    })));
    setReturnReason("");
    setRefundMethod("Cash");
    setShowReturnModal(true);
  };

  const updateReturnQty = (idx, val) => {
    const qty = Math.max(0, Math.min(Number(val) || 0, returnItems[idx].originalQty));
    setReturnItems(prev => prev.map((it, i) => i === idx ? { ...it, returnQty: qty } : it));
  };

  const returnTotal = returnItems.reduce((s, it) => s + (it.purchasePrice * it.returnQty), 0);

  const handleSubmitReturn = async () => {
    const itemsToReturn = returnItems.filter(it => it.returnQty > 0);
    if (itemsToReturn.length === 0) return showToast("Select at least one item to return");
    try {
      setReturnLoading(true);
      const res = await pharmacyHistoryAPI.createSupplierReturn({
        originalPurchaseId: returnPurchase._id,
        purchaseOrderNo: returnPurchase.purchaseOrderNo,
        invoiceNo: returnPurchase.invoiceNo, // Send real invoice number
        supplierName: returnPurchase.supplierName,
        supplierContact: returnPurchase.supplierContact || "",
        refundMethod: refundMethod,
        notes: returnReason,
        items: itemsToReturn.map(it => ({
          medicineId: String(it.medicineId),
          medicineName: it.medicineName,
          batchNo: it.batchNo || "N/A",
          category: it.category || "Medicine",
          quantity: Number(it.returnQty),
          unit: it.unit || "Unit",
          returnPrice: Number(it.purchasePrice),
          totalReturnAmount: Number(it.purchasePrice * it.returnQty),
          reason: returnReason || "Supplier return",
        })),
        totalReturnAmount: Number(returnTotal),
        processedBy: JSON.parse(localStorage.getItem("user") || "{}").name || "Admin",
      });

      setSlipData({
        returnNumber: res?.data?.returnNumber || "RTN-SUP-" + Date.now(),
        date: new Date().toLocaleString(),
        supplierName: returnPurchase.supplierName,
        invoiceNumber: returnPurchase.invoiceNo,
        refundMethod: refundMethod,
        items: itemsToReturn.map(it => ({
          medicineName: it.medicineName,
          returnQty: it.returnQty,
          returnAmt: it.purchasePrice * it.returnQty,
        })),
        totalReturnAmount: returnTotal,
      });
      setShowReturnModal(false);
      setShowSlip(true);
      fetchPurchases();
    } catch (err) {
      showToast(err.message || "Error processing supplier return");
    } finally {
      setReturnLoading(false);
    }
  };

  const printReturnSlip = (slip) => {
    const w = window.open("", "_blank", "width=400,height=600,left=100,top=50,toolbar=0,menubar=0,scrollbars=1");
    const fmt = (n) => Number(n || 0).toFixed(2);
    const shopName = hospitalSettings?.companyName || "PHARMACY";
    const itemRows = (slip.items || []).map(it => `
      <tr>
        <td style="padding:4px 0;">${it.medicineName}</td>
        <td style="text-align:center;padding:4px 8px;">${it.returnQty}</td>
        <td style="text-align:right;padding:4px 0;">${fmt(it.returnAmt)}</td>
      </tr>`).join("");
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Supplier Return Slip</title>
<style>
  @page{size:80mm auto;margin:4mm;}
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'Courier New',Courier,monospace;font-size:12px;color:#000;width:72mm;}
  .center{text-align:center;}.right{text-align:right;}.bold{font-weight:bold;}
  .dashed{border-top:1px dashed #000;margin:6px 0;}
  table{width:100%;border-collapse:collapse;}
  td,th{font-size:12px;}
  .total-row td{font-weight:bold;font-size:13px;border-top:1px dashed #000;padding-top:4px;}
</style></head><body>
  <div class="center bold" style="font-size:15px;">${shopName.toUpperCase()}</div>
  <div class="dashed"></div>
  <div class="center bold" style="font-size:13px;">Supplier Return</div>
  <div class="dashed"></div>
  <div style="font-size:11px;line-height:1.6;">
    <div>Date : ${slip.date}</div>
    <div>Supplier : ${slip.supplierName}</div>
    <div>Purchase Bill : ${slip.invoiceNumber}</div>
    ${slip.refundMethod ? `<div>Refund : ${slip.refundMethod}</div>` : ""}
  </div>
  <div class="dashed"></div>
  <table>
    <thead>
      <tr>
        <th style="text-align:left;padding-bottom:3px;border-bottom:1px dashed #000;">Item</th>
        <th style="text-align:center;padding-bottom:3px;border-bottom:1px dashed #000;width:30px;">Qty</th>
        <th style="text-align:right;padding-bottom:3px;border-bottom:1px dashed #000;width:55px;">Amt</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="2">TOTAL RETURN</td>
        <td class="right">Rs ${fmt(slip.totalReturnAmount)}</td>
      </tr>
    </tfoot>
  </table>
  <div class="dashed"></div>
  <div class="center" style="font-size:11px;margin-top:4px;">Supplier Return Copy</div>
  <script>window.onload=function(){window.print();setTimeout(function(){window.close();},200);};</script>
</body></html>`;
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="p-3 bg-gray-50 min-h-screen">
      {returnToast && (
        <div className="fixed top-6 right-6 z-[9999] bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-xl shadow-2xl font-semibold text-sm">
          {returnToast}
        </div>
      )}

      <div className="max-w-full mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-4 mb-3">
          <div className="flex justify-between items-center mb-3">
            <h1 className="text-xl font-bold text-gray-900">Supplier Returns</h1>
            <div className="flex gap-2">
              <button onClick={() => navigate("/pharmacy/return-history")}
                className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm">
                <FiClock size={14} /> Return History
              </button>
              <button onClick={fetchPurchases} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                <FiRefreshCw size={14} /> Refresh
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
            {[
              { label: "Total Purchases", value: summary.totalPurchases, color: "blue" },
              { label: "Total Spent", value: `PKR ${summary.totalAmount?.toLocaleString()}`, color: "green" },
              { label: "Total Paid", value: `PKR ${summary.totalPaid?.toLocaleString()}`, color: "purple" },
              { label: "Outstanding", value: `PKR ${summary.outstandingAmount?.toLocaleString()}`, color: "red" },
            ].map(({ label, value, color }) => (
              <div key={label} className={`bg-${color}-50 p-3 rounded`}>
                <div className={`text-xs text-${color}-600 font-medium`}>{label}</div>
                <div className={`text-xl font-bold text-${color}-900`}>{value}</div>
              </div>
            ))}
          </div>

          <div className="border-t pt-3">
            <div className="flex items-center gap-2 mb-3">
              <FiFilter size={16} className="text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Filter Purchases</span>
            </div>
            <div className="mb-3">
              <DateRangePicker fromDate={filters.startDate} toDate={filters.endDate} onDateRangeChange={handleDateRangeChange} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
              {[
                { ph: "Supplier Name", field: "supplierName" },
                { ph: "Invoice Number", field: "invoiceNo" },
                { ph: "PO Number", field: "purchaseOrderNo" },
              ].map(({ ph, field }) => (
                <input key={field} type="text" placeholder={ph} value={filters[field]}
                  onChange={e => handleFilterChange(field, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={applyFilters} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium">Apply Filters</button>
              <button onClick={clearFilters} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm font-medium">Clear All</button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    { label: "Invoice", tooltip: null },
                    { label: "Supplier", tooltip: null },
                    { label: "Medicines", tooltip: null },
                    { label: "Stock", tooltip: null },
                    { label: "Total / Remaining", tooltip: "Original amount / After returns" },
                    { label: "Actions", tooltip: null }
                  ].map(({ label, tooltip }) => (
                    <th key={label} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" title={tooltip}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr><td colSpan="6" className="px-4 py-3 text-center text-gray-500 text-sm">Loading purchases...</td></tr>
                ) : purchases.length === 0 ? (
                  <tr><td colSpan="6" className="px-4 py-3 text-center text-gray-500 text-sm">No purchases found</td></tr>
                ) : (
                  purchases.map(purchase => (
                    <tr key={purchase._id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{purchase.invoiceNo}</div>
                        <div className="text-xs text-gray-500">{new Date(purchase.purchaseDate).toLocaleDateString()}</div>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{purchase.supplierName}</div>
                        <div className="text-xs text-gray-500">{purchase.supplierContact}</div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="text-xs text-gray-800 leading-relaxed">{(purchase.items || []).map(i => i.medicineName).join(", ")}</div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="text-xs font-bold text-blue-600 leading-relaxed">
                          {(purchase.items || []).map(i => {
                            // Use currentStock if available and > 0, otherwise fallback to purchase quantity
                            const stock = i.currentStock || i.totalItems || i.quantity || 0;
                            return `${stock}`;
                          }).join(", ")}
                        </div>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900">
                          {purchase.totalReturnedAmount > 0 ? (
                            <>
                              <span className="line-through text-gray-400 text-xs">PKR {Number(purchase.netTotal ?? purchase.totalAmount ?? 0).toFixed(2)}</span>
                              <br />
                              <span className="text-green-600">PKR {Number(purchase.remainingAmount ?? 0).toFixed(2)}</span>
                            </>
                          ) : (
                            <span>PKR {Number(purchase.netTotal ?? purchase.totalAmount ?? 0).toFixed(2)}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <button onClick={() => openReturn(purchase)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg text-xs font-semibold transition-all shadow active:scale-95">
                          <FiCornerUpLeft size={13} /> Return Items
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="bg-white px-4 py-2 flex items-center justify-between border-t border-gray-200">
              <p className="text-xs text-gray-700">
                Page <span className="font-medium">{pagination.currentPage}</span> of <span className="font-medium">{pagination.totalPages}</span> ({pagination.totalCount} total)
              </p>
              <nav className="inline-flex rounded shadow-sm -space-x-px">
                <button onClick={() => setPagination(p => ({ ...p, currentPage: p.currentPage - 1 }))} disabled={!pagination.hasPrev}
                  className="px-2 py-1 rounded-l border border-gray-300 bg-white text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-50">Previous</button>
                <button onClick={() => setPagination(p => ({ ...p, currentPage: p.currentPage + 1 }))} disabled={!pagination.hasNext}
                  className="px-2 py-1 rounded-r border border-gray-300 bg-white text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-50">Next</button>
              </nav>
            </div>
          )}
        </div>
      </div>

      {showReturnModal && returnPurchase && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="text-white">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <FiCornerUpLeft className="w-5 h-5" /> Supplier Return
                </h3>
                <p className="text-xs text-orange-100 mt-0.5">
                  {returnPurchase.invoiceNo} · {returnPurchase.supplierName}
                </p>
              </div>
              <button onClick={() => setShowReturnModal(false)} className="text-white hover:bg-white/20 p-1.5 rounded-lg transition-all">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-50 rounded-lg px-3 py-2">
                  <p className="text-xs text-slate-500">Invoice</p>
                  <p className="font-bold text-slate-800 font-mono">{returnPurchase.invoiceNo}</p>
                </div>
                <div className="bg-slate-50 rounded-lg px-3 py-2">
                  <p className="text-xs text-slate-500">Purchase Total</p>
                  <p className="font-bold text-slate-800">PKR {Number(returnPurchase.netTotal ?? returnPurchase.totalAmount ?? 0).toFixed(2)}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">Select items to return</p>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {["Medicine", "Batch", "Current Stock", "Buy Price", "Return Qty", "Return Amt"].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {returnItems.map((item, idx) => {
                        const returnAmt = item.purchasePrice * item.returnQty;
                        return (
                          <tr key={idx} className={item.returnQty > 0 ? "bg-orange-50" : "hover:bg-slate-50"}>
                            <td className="px-3 py-2.5 font-medium text-slate-800">{item.medicineName}</td>
                            <td className="px-3 py-2.5 text-xs font-mono text-slate-500">{item.batchNo || "—"}</td>
                            <td className="px-3 py-2.5 text-center font-medium text-blue-600 font-bold">{item.currentStock}</td>
                            <td className="px-3 py-2.5 text-slate-700">PKR {item.purchasePrice.toFixed(2)}</td>
                            <td className="px-3 py-2.5">
                              <input type="number" min="0" max={item.originalQty} value={item.returnQty === 0 ? "" : item.returnQty}
                                placeholder="0" onChange={e => updateReturnQty(idx, e.target.value)}
                                className="w-20 px-2 py-1.5 border-2 border-orange-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono" />
                            </td>
                            <td className={`px-3 py-2.5 font-bold ${returnAmt > 0 ? "text-orange-600" : "text-slate-400"}`}>
                              {returnAmt > 0 ? `PKR ${returnAmt.toFixed(2)}` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {returnTotal > 0 && (
                      <tfoot className="bg-orange-50 border-t-2 border-orange-200">
                        <tr>
                          <td colSpan={5} className="px-3 py-2.5 text-right font-bold text-slate-700">Total Return:</td>
                          <td className="px-3 py-2.5 font-black text-orange-600 text-base">PKR {returnTotal.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Refund Method</label>
                <div className="flex gap-2">
                  {["Cash", "Bank Transfer", "Credit Note"].map(m => (
                    <button key={m} type="button" onClick={() => setRefundMethod(m)}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        refundMethod === m ? "bg-orange-500 border-orange-500 text-white" : "border-slate-300 text-slate-600 hover:bg-slate-50"
                      }`}>{m}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Reason for Return</label>
                <textarea rows={2} placeholder="Enter reason (optional)" value={returnReason}
                  onChange={e => setReturnReason(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm resize-none" />
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowReturnModal(false)}
                  className="flex-1 px-4 py-3 border-2 border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-semibold transition-all">Cancel</button>
                <button type="button" onClick={handleSubmitReturn} disabled={returnLoading || returnTotal <= 0}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:opacity-60 text-white rounded-lg font-bold shadow-lg transition-all active:scale-95">
                  {returnLoading ? "Processing..." : `Process Return · PKR ${returnTotal.toFixed(2)}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSlip && slipData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-800 text-lg">Return Slip · {slipData.invoiceNumber}</h3>
              <div className="flex gap-3">
                <button onClick={() => printReturnSlip(slipData)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold transition-all shadow-md active:scale-95">
                  <FiPrinter className="w-4 h-4" /> Print (Ctrl+P)
                </button>
                <button onClick={() => setShowSlip(false)}
                  className="px-4 py-2 border-2 border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 text-sm font-semibold transition-all">
                  Close
                </button>
              </div>
            </div>

            <div className="p-8 font-mono text-sm max-h-[70vh] overflow-y-auto">
              <div className="text-center font-bold text-2xl mb-2 text-slate-900">PHARMACY</div>
              <div className="border-t border-dashed border-slate-400 my-4" />
              <div className="text-center font-bold text-lg mb-4 text-slate-800">Supplier Return</div>
              <div className="space-y-1.5 text-slate-700 mb-6">
                <div className="flex justify-between">
                  <span>Date :</span>
                  <span>{slipData.date}</span>
                </div>
                <div className="flex justify-between">
                  <span>Party :</span>
                  <span className="font-bold">{slipData.supplierName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Bill No :</span>
                  <span className="font-bold">{slipData.invoiceNumber}</span>
                </div>
                {slipData.refundMethod && (
                  <div className="flex justify-between">
                    <span>Refund :</span>
                    <span>{slipData.refundMethod}</span>
                  </div>
                )}
              </div>
              <div className="border-t border-dashed border-slate-400 my-4" />
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dashed border-slate-400 text-slate-600">
                    <th className="text-left py-2 font-bold">Item</th>
                    <th className="text-center py-2 font-bold w-12">Qty</th>
                    <th className="text-right py-2 font-bold w-20">Amt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dashed divide-slate-200">
                  {slipData.items.map((it, i) => (
                    <tr key={i} className="text-slate-800">
                      <td className="py-2.5">{it.medicineName}</td>
                      <td className="text-center py-2.5 font-bold">{it.returnQty}</td>
                      <td className="text-right py-2.5 font-bold">{Number(it.returnAmt).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-dashed border-slate-400">
                    <td colSpan={2} className="pt-4 font-black text-base text-slate-900">TOTAL RETURN</td>
                    <td className="text-right pt-4 font-black text-base text-slate-900">Rs {Number(slipData.totalReturnAmount).toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
              <div className="border-t border-dashed border-slate-400 my-6" />
              <div className="text-center text-slate-500 font-bold italic">Thank you!</div>
            </div>
          </div>
        </div>
      )}

      <Modal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })}
        title={modal.title} message={modal.message} type={modal.type} onConfirm={modal.onConfirm} />
    </div>
  );
}
