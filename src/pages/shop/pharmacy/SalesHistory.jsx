import React, { useState, useEffect, useRef } from "react";
import {
  FiSearch, FiFilter, FiDownload, FiEye, FiRefreshCw,
  FiTrash2, FiPrinter, FiArrowLeft,
} from "react-icons/fi";
import {
  petshopPharmacyHistoryAPI,
  settingsAPI,
} from "../../../services/api";
import DateRangePicker from "../../../components/DateRangePicker";
import Modal from "../../../components/Modal";

export default function ShopPharmacySalesHistory() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: "", endDate: "", customerName: "",
    customerContact: "", invoiceNumber: "", paymentMethod: "", status: "",
  });
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalCount: 0 });
  const [summary, setSummary] = useState({ totalSales: 0, totalRevenue: 0, totalDiscount: 0, avgSaleAmount: 0 });
  const [selectedSale, setSelectedSale] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: "info", title: "", message: "", onConfirm: null });
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, saleId: null });
  const [hospitalSettings, setHospitalSettings] = useState(null);
  const printRef = useRef();

  const shopUser = JSON.parse(localStorage.getItem("shop_auth") || "{}");
  const loggedInUser = shopUser.name || shopUser.username
    ? `${shopUser.name || shopUser.username}${shopUser.role ? `-${shopUser.role}` : ""}`
    : "—";

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
      setSummary(res.data?.summary || { totalSales: 0, totalRevenue: 0, totalDiscount: 0, avgSaleAmount: 0 });
    } catch (err) {
      console.error("Error fetching sales history:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await petshopPharmacyHistoryAPI.deleteSale(id);
      setDeleteConfirm({ isOpen: false, saleId: null });
      fetchSales(pagination.currentPage);
    } catch (err) {
      setModal({ isOpen: true, type: "error", title: "Error", message: err.message || "Failed to delete sale", onConfirm: null });
    }
  };

  const handleViewDetails = async (sale) => {
    try {
      const res = await petshopPharmacyHistoryAPI.getSaleDetails(sale._id);
      setSelectedSale(res.data || sale);
      setShowDetails(true);
    } catch {
      setSelectedSale(sale);
      setShowDetails(true);
    }
  };

  const currency = hospitalSettings?.currency || "PKR";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Sales History</h1>
          <p className="text-slate-500 text-sm mt-1">Petshop Pharmacy — all completed sales</p>
        </div>
        <button onClick={() => fetchSales(1)} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm">
          <FiRefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Sales", value: pagination.totalCount || summary.totalSales },
          { label: "Total Revenue", value: `${currency} ${(summary.totalRevenue || 0).toLocaleString()}` },
          { label: "Total Discount", value: `${currency} ${(summary.totalDiscount || 0).toLocaleString()}` },
          { label: "Avg Sale", value: `${currency} ${(summary.avgSaleAmount || 0).toLocaleString()}` },
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
        ) : sales.length === 0 ? (
          <div className="text-center py-16 text-slate-500">No sales found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Invoice #", "Date", "Customer", "Items", "Total", "Payment", "Status", "Actions"].map((h) => (
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
                      <span className={`px-2 py-1 rounded-full text-xs ${sale.status === "completed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {sale.status || "completed"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleViewDetails(sale)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="View">
                          <FiEye className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteConfirm({ isOpen: true, saleId: sale._id })} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
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

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
            <p className="text-sm text-slate-500">Page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalCount} total)</p>
            <div className="flex gap-2">
              <button disabled={pagination.currentPage <= 1} onClick={() => fetchSales(pagination.currentPage - 1)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Prev</button>
              <button disabled={pagination.currentPage >= pagination.totalPages} onClick={() => fetchSales(pagination.currentPage + 1)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Sale Detail Modal */}
      {showDetails && selectedSale && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">Sale Details — {selectedSale.invoiceNumber}</h2>
              <button onClick={() => setShowDetails(false)} className="p-2 hover:bg-slate-100 rounded-lg"><FiArrowLeft className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-slate-500">Customer:</span> <span className="font-medium">{selectedSale.customerName || "Walk-in"}</span></div>
                <div><span className="text-slate-500">Date:</span> <span className="font-medium">{selectedSale.createdAt ? new Date(selectedSale.createdAt).toLocaleString() : "—"}</span></div>
                <div><span className="text-slate-500">Payment:</span> <span className="font-medium">{selectedSale.paymentMethod || "Cash"}</span></div>
                <div><span className="text-slate-500">Total:</span> <span className="font-bold text-green-600">{currency} {(selectedSale.totalAmount || 0).toLocaleString()}</span></div>
              </div>
              <div>
                <h3 className="font-semibold text-slate-700 mb-2">Items</h3>
                <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                  <thead className="bg-slate-50">
                    <tr>
                      {["Medicine", "Qty", "Unit Price", "Total"].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selectedSale.items || []).map((item, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2">{item.medicineName || item.name}</td>
                        <td className="px-3 py-2">{item.quantity}</td>
                        <td className="px-3 py-2">{currency} {(item.unitPrice || item.salePrice || 0).toLocaleString()}</td>
                        <td className="px-3 py-2 font-medium">{currency} {(item.totalPrice || item.total || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      <Modal
        isOpen={deleteConfirm.isOpen}
        type="warning"
        title="Delete Sale"
        message="Are you sure you want to delete this sale? This action cannot be undone."
        onConfirm={() => handleDelete(deleteConfirm.saleId)}
        onClose={() => setDeleteConfirm({ isOpen: false, saleId: null })}
      />
      <Modal {...modal} onClose={() => setModal((m) => ({ ...m, isOpen: false }))} />
    </div>
  );
}
