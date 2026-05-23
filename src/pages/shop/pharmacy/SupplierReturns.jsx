import React, { useState, useEffect } from "react";
import { FiFilter, FiRefreshCw, FiCornerUpLeft } from "react-icons/fi";
import { petshopPharmacyHistoryAPI, settingsAPI } from "../../../services/api";
import DateRangePicker from "../../../components/DateRangePicker";
import Modal from "../../../components/Modal";

export default function ShopPharmacySupplierReturns() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ startDate: "", endDate: "", supplierName: "", invoiceNo: "" });
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalCount: 0 });
  const [modal, setModal] = useState({ isOpen: false, type: "info", title: "", message: "", onConfirm: null });
  const [hospitalSettings, setHospitalSettings] = useState(null);

  // Return dialog
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [returnReason, setReturnReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    settingsAPI.get(JSON.parse(localStorage.getItem("user") || "{}").username || "admin")
      .then((r) => setHospitalSettings(r.data)).catch(() => {});
    fetchPurchases();
  }, []);

  const fetchPurchases = async (page = 1) => {
    try {
      setLoading(true);
      const params = { page, limit: 20, ...filters };
      Object.keys(params).forEach((k) => !params[k] && delete params[k]);
      const res = await petshopPharmacyHistoryAPI.getPurchaseHistory(params);
      setPurchases(res.data?.purchases || res.data || []);
      setPagination(res.data?.pagination || { currentPage: 1, totalPages: 1, totalCount: (res.data?.purchases || res.data || []).length });
    } catch (err) {
      console.error("Error fetching purchases:", err);
    } finally {
      setLoading(false);
    }
  };

  const openReturnModal = (purchase) => {
    setSelectedPurchase(purchase);
    setReturnItems((purchase.items || []).map((item) => ({
      ...item,
      returnQty: 0,
      maxQty: item.quantity || item.totalItems || 0,
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
      const totalRefund = itemsToReturn.reduce((sum, i) => sum + (i.returnQty * (i.purchasePrice || i.buyPerUnit || 0)), 0);
      await petshopPharmacyHistoryAPI.createSupplierReturn({
        originalPurchaseId: selectedPurchase._id,
        invoiceNo: selectedPurchase.invoiceNo || selectedPurchase.purchaseOrderNo,
        supplierName: selectedPurchase.supplierName || "",
        items: itemsToReturn.map((i) => ({
          medicineName: i.medicineName || i.name,
          medicineId: i.medicineId || i._id,
          returnQty: i.returnQty,
          unitPrice: i.purchasePrice || i.buyPerUnit || 0,
          totalRefund: i.returnQty * (i.purchasePrice || i.buyPerUnit || 0),
        })),
        totalRefundAmount: totalRefund,
        reason: returnReason,
        portal: "shop",
      });
      setShowReturnModal(false);
      setModal({ isOpen: true, type: "success", title: "Return Processed", message: `Supplier return processed. Refund: ${currency} ${totalRefund.toLocaleString()}`, onConfirm: null });
      fetchPurchases(pagination.currentPage);
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
          <h1 className="text-2xl font-bold text-slate-800">Supplier Returns</h1>
          <p className="text-slate-500 text-sm mt-1">Return medicines to suppliers from petshop pharmacy</p>
        </div>
        <button onClick={() => fetchPurchases(1)} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm">
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
            placeholder="Supplier name..."
            value={filters.supplierName}
            onChange={(e) => setFilters((f) => ({ ...f, supplierName: e.target.value }))}
          />
          <input
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Invoice number..."
            value={filters.invoiceNo}
            onChange={(e) => setFilters((f) => ({ ...f, invoiceNo: e.target.value }))}
          />
          <button
            onClick={() => fetchPurchases(1)}
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
        ) : purchases.length === 0 ? (
          <div className="text-center py-16 text-slate-500">No purchases found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Invoice #", "Date", "Supplier", "Items", "Total", "Action"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-purple-600">{p.invoiceNo || p.purchaseOrderNo || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3">{p.supplierName || "—"}</td>
                    <td className="px-4 py-3">{p.items?.length || 0}</td>
                    <td className="px-4 py-3 font-semibold">{currency} {(p.totalCost || p.totalAmount || 0).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openReturnModal(p)}
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
              <button disabled={pagination.currentPage <= 1} onClick={() => fetchPurchases(pagination.currentPage - 1)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Prev</button>
              <button disabled={pagination.currentPage >= pagination.totalPages} onClick={() => fetchPurchases(pagination.currentPage + 1)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Return Modal */}
      {showReturnModal && selectedPurchase && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">Return to Supplier — {selectedPurchase.supplierName || "Supplier"}</h2>
              <button onClick={() => setShowReturnModal(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-50">
                  <tr>
                    {["Medicine", "Purchased Qty", "Buy Price", "Return Qty", "Refund"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {returnItems.map((item, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2">{item.medicineName || item.name}</td>
                      <td className="px-3 py-2">{item.maxQty}</td>
                      <td className="px-3 py-2">{currency} {(item.purchasePrice || item.buyPerUnit || 0).toLocaleString()}</td>
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
                        {currency} {(item.returnQty * (item.purchasePrice || item.buyPerUnit || 0)).toLocaleString()}
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
                    {currency} {returnItems.reduce((sum, i) => sum + (i.returnQty * (i.purchasePrice || i.buyPerUnit || 0)), 0).toLocaleString()}
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
