import React, { useState, useEffect } from "react";
import {
  FiPlus, FiSearch, FiFileText, FiTrash2, FiEdit2, FiX,
  FiCheck, FiClock, FiAlertCircle, FiEye,
} from "react-icons/fi";
import {
  petshopPharmacyPurchaseDraftsAPI,
  petShopSuppliersAPI,
  settingsAPI,
} from "../../../services/api";
import DateRangePicker from "../../../components/DateRangePicker";
import Modal from "../../../components/Modal";

const STATUS_COLORS = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  partial: "bg-blue-100 text-blue-700",
};

export default function ShopPharmacyPurchaseOrders() {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: "info", title: "", message: "", onConfirm: null });
  const [hospitalSettings, setHospitalSettings] = useState(null);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });

  useEffect(() => {
    settingsAPI.get(JSON.parse(localStorage.getItem("user") || "{}").username || "admin")
      .then((r) => setHospitalSettings(r.data)).catch(() => {});
    fetchDrafts();
  }, []);

  const fetchDrafts = async () => {
    try {
      setLoading(true);
      const res = await petshopPharmacyPurchaseDraftsAPI.getAll({ portal: "shop" });
      const data = res.data || [];
      setDrafts(data);
      setStats({
        total: data.length,
        pending: data.filter((d) => d.status === "pending").length,
        approved: data.filter((d) => d.status === "approved").length,
        rejected: data.filter((d) => d.status === "rejected").length,
      });
    } catch (err) {
      console.error("Error fetching drafts:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (draft) => {
    try {
      await petshopPharmacyPurchaseDraftsAPI.approve(draft._id, { reviewedBy: "Shop Manager" });
      setModal({ isOpen: true, type: "success", title: "Approved", message: "Purchase draft approved and inventory updated.", onConfirm: null });
      fetchDrafts();
      setShowDetail(false);
    } catch (err) {
      setModal({ isOpen: true, type: "error", title: "Error", message: err.message || "Failed to approve", onConfirm: null });
    }
  };

  const handleReject = async (draft) => {
    try {
      await petshopPharmacyPurchaseDraftsAPI.reject(draft._id, { reviewedBy: "Shop Manager", reason: "Rejected by manager" });
      setModal({ isOpen: true, type: "info", title: "Rejected", message: "Purchase draft rejected.", onConfirm: null });
      fetchDrafts();
      setShowDetail(false);
    } catch (err) {
      setModal({ isOpen: true, type: "error", title: "Error", message: err.message || "Failed to reject", onConfirm: null });
    }
  };

  const handleDelete = async (id) => {
    setModal({
      isOpen: true,
      type: "warning",
      title: "Delete Draft",
      message: "Are you sure you want to delete this purchase draft?",
      onConfirm: async () => {
        try {
          await petshopPharmacyPurchaseDraftsAPI.delete(id);
          fetchDrafts();
        } catch (err) {
          setModal({ isOpen: true, type: "error", title: "Error", message: err.message || "Failed to delete", onConfirm: null });
        }
      },
    });
  };

  const filtered = drafts.filter((d) => {
    const matchSearch = !searchTerm || (d.invoiceNo || "").toLowerCase().includes(searchTerm.toLowerCase()) || (d.supplierName || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === "all" || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const currency = hospitalSettings?.currency || "PKR";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Purchase Orders</h1>
          <p className="text-slate-500 text-sm mt-1">Manage purchase drafts and approve inventory additions</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", value: stats.total, color: "slate" },
          { label: "Pending", value: stats.pending, color: "yellow" },
          { label: "Approved", value: stats.approved, color: "green" },
          { label: "Rejected", value: stats.rejected, color: "red" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 text-${s.color}-600`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm"
              placeholder="Search by invoice or supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="partial">Partial</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <FiFileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p>No purchase orders found</p>
            <p className="text-sm mt-1">Use "Add Invoice" to create purchase orders</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Invoice #", "Date", "Supplier", "Items", "Total", "Status", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((draft) => (
                  <tr key={draft._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-purple-600">{draft.invoiceNo || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{draft.invoiceDate ? new Date(draft.invoiceDate).toLocaleDateString() : draft.createdAt ? new Date(draft.createdAt).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3">{draft.supplierName || "—"}</td>
                    <td className="px-4 py-3">{draft.items?.length || 0}</td>
                    <td className="px-4 py-3 font-semibold">{currency} {(draft.totalAmount || 0).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[draft.status] || STATUS_COLORS.pending}`}>
                        {draft.status || "pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setSelectedDraft(draft); setShowDetail(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="View">
                          <FiEye className="w-4 h-4" />
                        </button>
                        {draft.status === "pending" && (
                          <>
                            <button onClick={() => handleApprove(draft)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg" title="Approve">
                              <FiCheck className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleReject(draft)} className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg" title="Reject">
                              <FiX className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button onClick={() => handleDelete(draft._id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
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
      </div>

      {/* Detail Modal */}
      {showDetail && selectedDraft && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Purchase Draft — {selectedDraft.invoiceNo}</h2>
                <p className="text-sm text-slate-500 mt-0.5">Supplier: {selectedDraft.supplierName || "—"}</p>
              </div>
              <button onClick={() => setShowDetail(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[selectedDraft.status] || STATUS_COLORS.pending}`}>
                  {selectedDraft.status || "pending"}
                </span>
                {selectedDraft.status === "pending" && (
                  <div className="flex gap-2">
                    <button onClick={() => handleApprove(selectedDraft)} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
                      <FiCheck className="w-4 h-4" /> Approve All
                    </button>
                    <button onClick={() => handleReject(selectedDraft)} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">
                      <FiX className="w-4 h-4" /> Reject All
                    </button>
                  </div>
                )}
              </div>
              <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-50">
                  <tr>
                    {["Medicine", "Batch", "Expiry", "Qty", "Buy Price", "Sale Price", "Total", "Status"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(selectedDraft.items || []).map((item, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 font-medium">{item.medicineName}</td>
                      <td className="px-3 py-2 text-slate-600">{item.batchNo || "—"}</td>
                      <td className="px-3 py-2 text-slate-600">{item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : "—"}</td>
                      <td className="px-3 py-2">{item.totalItems || item.qtyPacks}</td>
                      <td className="px-3 py-2">{currency} {(item.buyPerPack || 0).toLocaleString()}</td>
                      <td className="px-3 py-2">{currency} {(item.salePerPack || 0).toLocaleString()}</td>
                      <td className="px-3 py-2 font-medium text-purple-600">{currency} {(item.lineTotal || 0).toLocaleString()}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[item.itemStatus] || STATUS_COLORS.pending}`}>
                          {item.itemStatus || "pending"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end">
                <div className="text-right">
                  <p className="text-sm text-slate-500">Total Amount</p>
                  <p className="text-xl font-bold text-purple-600">{currency} {(selectedDraft.totalAmount || 0).toLocaleString()}</p>
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
