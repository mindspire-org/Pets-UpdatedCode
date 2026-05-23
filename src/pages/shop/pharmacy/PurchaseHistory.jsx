import React, { useState, useEffect } from "react";
import { FiFilter, FiDownload, FiEye, FiRefreshCw, FiTrash2 } from "react-icons/fi";
import { petshopPharmacyHistoryAPI, settingsAPI } from "../../../services/api";
import DateRangePicker from "../../../components/DateRangePicker";
import Modal from "../../../components/Modal";

export default function ShopPharmacyPurchaseHistory() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: "", endDate: "", supplierName: "", invoiceNo: "", purchaseOrderNo: "", paymentStatus: "",
  });
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalCount: 0 });
  const [summary, setSummary] = useState({ totalPurchases: 0, totalAmount: 0, totalPaid: 0, outstandingAmount: 0 });
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: "info", title: "", message: "", onConfirm: null });
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, purchaseId: null });
  const [hospitalSettings, setHospitalSettings] = useState(null);

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
      setSummary(res.data?.summary || { totalPurchases: 0, totalAmount: 0, totalPaid: 0, outstandingAmount: 0 });
    } catch (err) {
      console.error("Error fetching purchase history:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await petshopPharmacyHistoryAPI.deletePurchase(id);
      setDeleteConfirm({ isOpen: false, purchaseId: null });
      fetchPurchases(pagination.currentPage);
    } catch (err) {
      setModal({ isOpen: true, type: "error", title: "Error", message: err.message || "Failed to delete", onConfirm: null });
    }
  };

  const currency = hospitalSettings?.currency || "PKR";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Purchase History</h1>
          <p className="text-slate-500 text-sm mt-1">Petshop Pharmacy — all purchase records</p>
        </div>
        <button onClick={() => fetchPurchases(1)} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm">
          <FiRefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Purchases", value: pagination.totalCount || summary.totalPurchases },
          { label: "Total Amount", value: `${currency} ${(summary.totalAmount || 0).toLocaleString()}` },
          { label: "Total Paid", value: `${currency} ${(summary.totalPaid || 0).toLocaleString()}` },
          { label: "Outstanding", value: `${currency} ${(summary.outstandingAmount || 0).toLocaleString()}` },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className="text-xl font-bold text-slate-800 mt-1">{s.value}</p>
          </div>
        ))}
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
            <FiFilter className="w-4 h-4" /> Apply Filters
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
                  {["Invoice #", "Date", "Supplier", "Items", "Total", "Paid", "Outstanding", "Actions"].map((h) => (
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
                    <td className="px-4 py-3 text-green-600">{currency} {(p.amountPaid || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-orange-600">{currency} {((p.totalCost || p.totalAmount || 0) - (p.amountPaid || 0)).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setSelectedPurchase(p); setShowDetails(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="View">
                          <FiEye className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteConfirm({ isOpen: true, purchaseId: p._id })} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
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

      {/* Detail Modal */}
      {showDetails && selectedPurchase && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">Purchase Details</h2>
              <button onClick={() => setShowDetails(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-slate-500">Supplier:</span> <span className="font-medium">{selectedPurchase.supplierName || "—"}</span></div>
                <div><span className="text-slate-500">Date:</span> <span className="font-medium">{selectedPurchase.createdAt ? new Date(selectedPurchase.createdAt).toLocaleString() : "—"}</span></div>
                <div><span className="text-slate-500">Invoice #:</span> <span className="font-medium">{selectedPurchase.invoiceNo || "—"}</span></div>
                <div><span className="text-slate-500">Total:</span> <span className="font-bold text-purple-600">{currency} {(selectedPurchase.totalCost || selectedPurchase.totalAmount || 0).toLocaleString()}</span></div>
              </div>
              {(selectedPurchase.items || []).length > 0 && (
                <div>
                  <h3 className="font-semibold text-slate-700 mb-2">Items</h3>
                  <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-slate-50">
                      <tr>
                        {["Medicine", "Qty", "Buy Price", "Total"].map((h) => (
                          <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedPurchase.items.map((item, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2">{item.medicineName || item.name}</td>
                          <td className="px-3 py-2">{item.quantity || item.totalItems}</td>
                          <td className="px-3 py-2">{currency} {(item.purchasePrice || item.buyPerUnit || 0).toLocaleString()}</td>
                          <td className="px-3 py-2 font-medium">{currency} {(item.totalCost || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={deleteConfirm.isOpen}
        type="warning"
        title="Delete Purchase"
        message="Are you sure you want to delete this purchase record?"
        onConfirm={() => handleDelete(deleteConfirm.purchaseId)}
        onClose={() => setDeleteConfirm({ isOpen: false, purchaseId: null })}
      />
      <Modal {...modal} onClose={() => setModal((m) => ({ ...m, isOpen: false }))} />
    </div>
  );
}
