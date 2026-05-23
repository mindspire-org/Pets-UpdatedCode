import React, { useState, useEffect } from "react";
import { FiFilter, FiRefreshCw, FiEye } from "react-icons/fi";
import { petshopPharmacyHistoryAPI, settingsAPI } from "../../../services/api";
import DateRangePicker from "../../../components/DateRangePicker";

export default function ShopPharmacyReturnHistory() {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ startDate: "", endDate: "", returnType: "", refundStatus: "", customerName: "" });
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalCount: 0 });
  const [summary, setSummary] = useState({ totalReturns: 0, customerReturns: { count: 0, totalAmount: 0 }, supplierReturns: { count: 0, totalAmount: 0 } });
  const [hospitalSettings, setHospitalSettings] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [detailReturn, setDetailReturn] = useState(null);

  useEffect(() => {
    settingsAPI.get(JSON.parse(localStorage.getItem("user") || "{}").username || "admin")
      .then((r) => setHospitalSettings(r.data)).catch(() => {});
    fetchReturns();
  }, []);

  const fetchReturns = async (page = 1) => {
    try {
      setLoading(true);
      const params = { page, limit: 20, ...filters };
      Object.keys(params).forEach((k) => !params[k] && delete params[k]);
      const res = await petshopPharmacyHistoryAPI.getReturns(params);
      setReturns(res.data?.returns || res.data || []);
      setPagination(res.data?.pagination || { currentPage: 1, totalPages: 1, totalCount: (res.data?.returns || res.data || []).length });
      setSummary(res.data?.summary || { totalReturns: 0, customerReturns: { count: 0, totalAmount: 0 }, supplierReturns: { count: 0, totalAmount: 0 } });
    } catch (err) {
      console.error("Error fetching returns:", err);
    } finally {
      setLoading(false);
    }
  };

  const currency = hospitalSettings?.currency || "PKR";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Return History</h1>
          <p className="text-slate-500 text-sm mt-1">All customer and supplier returns for petshop pharmacy</p>
        </div>
        <button onClick={() => fetchReturns(1)} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm">
          <FiRefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Total Returns</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{pagination.totalCount || summary.totalReturns}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Customer Returns</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">{summary.customerReturns?.count || 0}</p>
          <p className="text-xs text-slate-500 mt-1">{currency} {(summary.customerReturns?.totalAmount || 0).toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Supplier Returns</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{summary.supplierReturns?.count || 0}</p>
          <p className="text-xs text-slate-500 mt-1">{currency} {(summary.supplierReturns?.totalAmount || 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <DateRangePicker
            onDateChange={({ fromDate, toDate }) =>
              setFilters((f) => ({ ...f, startDate: fromDate, endDate: toDate }))
            }
          />
          <select
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={filters.returnType}
            onChange={(e) => setFilters((f) => ({ ...f, returnType: e.target.value }))}
          >
            <option value="">All Types</option>
            <option value="customer">Customer Return</option>
            <option value="supplier">Supplier Return</option>
          </select>
          <select
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={filters.refundStatus}
            onChange={(e) => setFilters((f) => ({ ...f, refundStatus: e.target.value }))}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="processed">Processed</option>
            <option value="rejected">Rejected</option>
          </select>
          <input
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Customer/Supplier name..."
            value={filters.customerName}
            onChange={(e) => setFilters((f) => ({ ...f, customerName: e.target.value }))}
          />
          <button
            onClick={() => fetchReturns(1)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
          >
            <FiFilter className="w-4 h-4" /> Apply
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
          </div>
        ) : returns.length === 0 ? (
          <div className="text-center py-16 text-slate-500">No returns found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Date", "Type", "Customer/Supplier", "Invoice Ref", "Items", "Refund Amount", "Status", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {returns.map((ret) => (
                  <tr key={ret._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">{ret.createdAt ? new Date(ret.createdAt).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${ret.returnType === "customer" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>
                        {ret.returnType === "customer" ? "Customer" : "Supplier"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{ret.customerName || ret.supplierName || "—"}</td>
                    <td className="px-4 py-3 text-purple-600">{ret.invoiceNumber || ret.invoiceNo || "—"}</td>
                    <td className="px-4 py-3">{ret.items?.length || 0}</td>
                    <td className="px-4 py-3 font-semibold text-orange-600">{currency} {(ret.totalRefundAmount || 0).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${ret.refundStatus === "processed" ? "bg-green-100 text-green-700" : ret.refundStatus === "rejected" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {ret.refundStatus || "pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => { setDetailReturn(ret); setShowDetail(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="View">
                        <FiEye className="w-4 h-4" />
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
              <button disabled={pagination.currentPage <= 1} onClick={() => fetchReturns(pagination.currentPage - 1)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Prev</button>
              <button disabled={pagination.currentPage >= pagination.totalPages} onClick={() => fetchReturns(pagination.currentPage + 1)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetail && detailReturn && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">Return Details</h2>
              <button onClick={() => setShowDetail(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-slate-500">Type:</span> <span className="font-medium capitalize">{detailReturn.returnType}</span></div>
                <div><span className="text-slate-500">Date:</span> <span className="font-medium">{detailReturn.createdAt ? new Date(detailReturn.createdAt).toLocaleString() : "—"}</span></div>
                <div><span className="text-slate-500">Customer/Supplier:</span> <span className="font-medium">{detailReturn.customerName || detailReturn.supplierName || "—"}</span></div>
                <div><span className="text-slate-500">Refund:</span> <span className="font-bold text-orange-600">{currency} {(detailReturn.totalRefundAmount || 0).toLocaleString()}</span></div>
                {detailReturn.reason && <div className="col-span-2"><span className="text-slate-500">Reason:</span> <span className="font-medium">{detailReturn.reason}</span></div>}
              </div>
              {(detailReturn.items || []).length > 0 && (
                <div>
                  <h3 className="font-semibold text-slate-700 mb-2">Returned Items</h3>
                  <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                    <thead className="bg-slate-50">
                      <tr>
                        {["Medicine", "Return Qty", "Unit Price", "Refund"].map((h) => (
                          <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detailReturn.items.map((item, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2">{item.medicineName || item.name}</td>
                          <td className="px-3 py-2">{item.returnQty}</td>
                          <td className="px-3 py-2">{currency} {(item.unitPrice || 0).toLocaleString()}</td>
                          <td className="px-3 py-2 font-medium text-orange-600">{currency} {(item.totalRefund || 0).toLocaleString()}</td>
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
    </div>
  );
}
