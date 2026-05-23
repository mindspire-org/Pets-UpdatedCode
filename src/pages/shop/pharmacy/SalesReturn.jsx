import React, { useState, useEffect } from "react";
import { FiSearch, FiFilter, FiRefreshCw, FiCornerUpLeft, FiPrinter } from "react-icons/fi";
import {
  petshopPharmacyHistoryAPI,
  petshopPharmacyMedicinesAPI,
  settingsAPI,
} from "../../../services/api";
import DateRangePicker from "../../../components/DateRangePicker";
import Modal from "../../../components/Modal";

export default function ShopPharmacySalesReturn() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: "", endDate: "", customerName: "", invoiceNumber: "",
  });
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalCount: 0 });
  const [modal, setModal] = useState({ isOpen: false, type: "info", title: "", message: "", onConfirm: null });
  const [hospitalSettings, setHospitalSettings] = useState(null);

  // Return dialog
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [returnReason, setReturnReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    settingsAPI.get(JSON.parse(localStorage.getItem("user") || "{}").username || "admin")
      .then((r) => setHospitalSettings(r.data)).catch(() => {});
    fetchSales();
  }, []);

  const fetchSales = async (page = 1) => {
    try {
      setLoading(true);
      const params = { page, limit: 20, ...filters };
      Object.keys(params).forEach((k) => !params[k] && delete params[k]);
      const res = await petshopPharmacyHistoryAPI.getSalesHistory(params);
      setSales(res.data?.sales || res.data || []);
      setPagination(res.data?.pagination || { currentPage: 1, totalPages: 1, totalCount: (res.data?.sales || res.data || []).length });
    } catch (err) {
      console.error("Error fetching sales:", err);
    } finally {
      setLoading(false);
    }
  };

  const openReturnModal = (sale) => {
    setSelectedSale(sale);
    setReturnItems((sale.items || []).map((item) => ({
      ...item,
      returnQty: 0,
      maxQty: item.quantity || 0,
    })));
    setReturnReason("");
    setShowReturnModal(true);
  };

  const handleSubmitReturn = async () => {
    const itemsToReturn = returnItems.filter((i) => i.returnQty > 0);
    if (itemsToReturn.length === 0) {
      setModal({ isOpen: true, type: "warning", title: "No Items", message: "Please enter return quantity for at least one item.", onConfirm: null });
      return;
    }
    try {
      setSubmitting(true);
      const currency = hospitalSettings?.currency || "PKR";
      const totalRefund = itemsToReturn.reduce((sum, i) => sum + (i.returnQty * (i.unitPrice || i.salePrice || 0)), 0);
      await petshopPharmacyHistoryAPI.createCustomerReturn({
        originalSaleId: selectedSale._id,
        invoiceNumber: selectedSale.invoiceNumber,
        customerName: selectedSale.customerName || "Walk-in",
        customerContact: selectedSale.customerContact || "",
        items: itemsToReturn.map((i) => ({
          medicineName: i.medicineName || i.name,
          medicineId: i.medicineId || i._id,
          returnQty: i.returnQty,
          unitPrice: i.unitPrice || i.salePrice || 0,
          totalRefund: i.returnQty * (i.unitPrice || i.salePrice || 0),
        })),
        totalRefundAmount: totalRefund,
        reason: returnReason,
        portal: "shop",
      });
      setShowReturnModal(false);
      setModal({ isOpen: true, type: "success", title: "Return Processed", message: `Return processed successfully. Refund: ${currency} ${totalRefund.toLocaleString()}`, onConfirm: null });
      fetchSales(pagination.currentPage);
    } catch (err) {
      setModal({ isOpen: true, type: "error", title: "Error", message: err.message || "Failed to process return", onConfirm: null });
    } finally {
      setSubmitting(false);
    }
  };

  const currency = hospitalSettings?.currency || "PKR";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Sales Return</h1>
          <p className="text-slate-500 text-sm mt-1">Process customer returns for petshop pharmacy sales</p>
        </div>
        <button onClick={() => fetchSales(1)} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm">
          <FiRefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <DateRangePicker
            onDateChange={({ fromDate, toDate }) =>
              setFilters((f) => ({ ...f, startDate: fromDate, endDate: toDate }))
            }
          />
          <input
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Customer name..."
            value={filters.customerName}
            onChange={(e) => setFilters((f) => ({ ...f, customerName: e.target.value }))}
          />
          <input
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Invoice number..."
            value={filters.invoiceNumber}
            onChange={(e) => setFilters((f) => ({ ...f, invoiceNumber: e.target.value }))}
          />
          <button
            onClick={() => fetchSales(1)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
          >
            <FiFilter className="w-4 h-4" /> Search
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
          </div>
        ) : sales.length === 0 ? (
          <div className="text-center py-16 text-slate-500">No sales found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Invoice #", "Date", "Customer", "Items", "Total", "Payment", "Action"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.map((sale) => (
                  <tr key={sale._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-purple-600">{sale.invoiceNumber || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{sale.createdAt ? new Date(sale.createdAt).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3">{sale.customerName || "Walk-in"}</td>
                    <td className="px-4 py-3">{sale.items?.length || 0}</td>
                    <td className="px-4 py-3 font-semibold text-green-600">{currency} {(sale.totalAmount || 0).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">{sale.paymentMethod || "Cash"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openReturnModal(sale)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 text-xs font-medium"
                      >
                        <FiCornerUpLeft className="w-3.5 h-3.5" /> Return
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
            <p className="text-sm text-slate-500">Page {pagination.currentPage} of {pagination.totalPages}</p>
            <div className="flex gap-2">
              <button disabled={pagination.currentPage <= 1} onClick={() => fetchSales(pagination.currentPage - 1)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Prev</button>
              <button disabled={pagination.currentPage >= pagination.totalPages} onClick={() => fetchSales(pagination.currentPage + 1)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Return Modal */}
      {showReturnModal && selectedSale && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">Process Return — {selectedSale.invoiceNumber}</h2>
              <button onClick={() => setShowReturnModal(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-sm text-slate-600">
                Customer: <span className="font-medium">{selectedSale.customerName || "Walk-in"}</span> |
                Date: <span className="font-medium">{selectedSale.createdAt ? new Date(selectedSale.createdAt).toLocaleDateString() : "—"}</span>
              </div>
              <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-50">
                  <tr>
                    {["Medicine", "Sold Qty", "Unit Price", "Return Qty", "Refund"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {returnItems.map((item, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2">{item.medicineName || item.name}</td>
                      <td className="px-3 py-2">{item.maxQty}</td>
                      <td className="px-3 py-2">{currency} {(item.unitPrice || item.salePrice || 0).toLocaleString()}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          max={item.maxQty}
                          value={item.returnQty}
                          onChange={(e) => {
                            const val = Math.min(Number(e.target.value), item.maxQty);
                            setReturnItems((prev) => prev.map((it, idx) => idx === i ? { ...it, returnQty: val } : it));
                          }}
                          className="w-20 border border-slate-200 rounded px-2 py-1 text-center"
                        />
                      </td>
                      <td className="px-3 py-2 font-medium text-orange-600">
                        {currency} {(item.returnQty * (item.unitPrice || item.salePrice || 0)).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Return Reason</label>
                <textarea
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Reason for return..."
                />
              </div>
              <div className="flex items-center justify-between pt-2">
                <div className="text-sm font-semibold text-slate-700">
                  Total Refund: <span className="text-orange-600 text-lg">
                    {currency} {returnItems.reduce((sum, i) => sum + (i.returnQty * (i.unitPrice || i.salePrice || 0)), 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowReturnModal(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
                  <button
                    onClick={handleSubmitReturn}
                    disabled={submitting}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700 disabled:opacity-50"
                  >
                    {submitting ? "Processing..." : "Process Return"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal {...modal} onClose={() => setModal((m) => ({ ...m, isOpen: false }))} />
    </div>
  );
}
