import React, { useState, useEffect } from "react";
import {
  FiFilter,
  FiDownload,
  FiRefreshCw,
  FiEye,
  FiPrinter,
  FiX,
  FiCornerUpLeft,
} from "react-icons/fi";
import { petshopPharmacyHistoryAPI, settingsAPI } from "../../services/api";
import DateRangePicker from "../../components/DateRangePicker";

export default function ReturnHistory() {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    returnType: "",
    refundStatus: "",
    customerName: "",
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    hasNext: false,
    hasPrev: false,
  });
  const [summary, setSummary] = useState({
    totalReturns: 0,
    customerReturns: { count: 0, totalAmount: 0 },
    supplierReturns: { count: 0, totalAmount: 0 },
  });
  const [hospitalSettings, setHospitalSettings] = useState(null);

  const [showDetail, setShowDetail] = useState(false);
  const [detailReturn, setDetailReturn] = useState(null);

  useEffect(() => {
    settingsAPI
      .get(JSON.parse(localStorage.getItem("user") || "{}").username || "admin")
      .then((r) => setHospitalSettings(r.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchReturns();
  }, [pagination.currentPage]);

  const fetchReturns = async () => {
    try {
      setLoading(true);
      const params = { ...filters, page: pagination.currentPage, limit: 20 };
      Object.keys(params).forEach((k) => {
        if (!params[k]) delete params[k];
      });

      const res = await petshopPharmacyHistoryAPI.getReturns(params);
      setReturns(res.data.returns || []);
      setPagination(res.data.pagination || pagination);
      setSummary(res.data.summary || summary);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    setPagination((p) => ({ ...p, currentPage: 1 }));
    setTimeout(fetchReturns, 0);
  };

  const clearFilters = () => {
    setFilters({
      startDate: "",
      endDate: "",
      returnType: "",
      refundStatus: "",
      customerName: "",
    });
    setPagination((p) => ({ ...p, currentPage: 1 }));
    setTimeout(fetchReturns, 0);
  };

  const printReturnSlip = (ret) => {
    const w = window.open(
      "",
      "_blank",
      "width=400,height=600,left=100,top=50,toolbar=0,menubar=0,scrollbars=1",
    );
    const fmt = (n) => Number(n || 0).toFixed(2);
    const shopName = hospitalSettings?.companyName || "SHOP";
    const itemRows = (ret.items || [])
      .map(
        (it) => `
      <tr>
        <td style="padding:4px 0;">${it.medicineName}</td>
        <td style="text-align:center;padding:4px 8px;">${it.quantity}</td>
        <td style="text-align:right;padding:4px 0;">${fmt(it.totalReturnAmount)}</td>
      </tr>`,
      )
      .join("");

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Return Slip</title>
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
  <div class="center bold" style="font-size:13px;">${ret.returnType || "Customer Return"}</div>
  <div class="dashed"></div>
  <div style="font-size:11px;line-height:1.6;">
    <div>Return No : ${ret.returnNumber}</div>
    <div>Date : ${new Date(ret.returnDate || ret.createdAt).toLocaleString()}</div>
    <div>Party : ${ret.customerName || ret.supplierName || "—"}</div>
    ${ret.originalInvoiceNumber ? `<div>Bill No : ${ret.originalInvoiceNumber}</div>` : ""}
    <div>Refund : ${ret.refundMethod}</div>
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
        <td class="right">Rs ${fmt(ret.totalReturnAmount)}</td>
      </tr>
    </tfoot>
  </table>
  <div class="dashed"></div>
  <div class="center" style="font-size:11px;margin-top:4px;">Thank you!</div>
  <script>window.onload=function(){window.print();setTimeout(function(){window.close();},200);};</script>
</body></html>`;

    w.document.write(html);
    w.document.close();
  };

  const exportToCSV = () => {
    if (!returns.length) return;
    const rows = returns.map((r) => ({
      "Return No": r.returnNumber,
      Type: r.returnType,
      Date: new Date(r.returnDate || r.createdAt).toLocaleDateString(),
      "Customer/Supplier": r.customerName || r.supplierName || "—",
      Invoice: r.originalInvoiceNumber || "—",
      "Total Return": r.totalReturnAmount,
      "Refund Method": r.refundMethod,
      Status: r.refundStatus,
    }));
    const csv = [
      Object.keys(rows[0]).join(","),
      ...rows.map((r) => Object.values(r).map((v) => `"${v}"`).join(",")),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `return-history-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const typeColor = (t) =>
    t === "Customer Return"
      ? "bg-blue-100 text-blue-800"
      : "bg-purple-100 text-purple-800";

  return (
    <div className="p-3 bg-gray-50 min-h-screen">
      <div className="max-w-full mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-4 mb-3">
          <div className="flex justify-between items-center mb-3">
            <h1 className="text-xl font-bold text-gray-900">Return History</h1>
            <div className="flex gap-2">
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
              >
                <FiDownload size={14} /> Export CSV
              </button>
              <button
                onClick={fetchReturns}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                <FiRefreshCw size={14} /> Refresh
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
            <div className="bg-blue-50 p-3 rounded">
              <div className="text-xs text-blue-600 font-medium">Total Returns</div>
              <div className="text-xl font-bold text-blue-900">{summary.totalReturns}</div>
            </div>
            <div className="bg-green-50 p-3 rounded">
              <div className="text-xs text-green-600 font-medium">Customer Returns</div>
              <div className="text-xl font-bold text-green-900">{summary.customerReturns?.count || 0}</div>
              <div className="text-xs text-green-700">PKR {Number(summary.customerReturns?.totalAmount || 0).toLocaleString()}</div>
            </div>
            <div className="bg-purple-50 p-3 rounded">
              <div className="text-xs text-purple-600 font-medium">Supplier Returns</div>
              <div className="text-xl font-bold text-purple-900">{summary.supplierReturns?.count || 0}</div>
              <div className="text-xs text-purple-700">PKR {Number(summary.supplierReturns?.totalAmount || 0).toLocaleString()}</div>
            </div>
            <div className="bg-orange-50 p-3 rounded">
              <div className="text-xs text-orange-600 font-medium">Net Refunded</div>
              <div className="text-xl font-bold text-orange-900">
                PKR {Number((summary.supplierReturns?.totalAmount || 0) - (summary.customerReturns?.totalAmount || 0)).toLocaleString()}
              </div>
              <div className="text-xs text-orange-700">Supplier - Customer</div>
            </div>
          </div>

          <div className="border-t pt-3">
            <div className="flex items-center gap-2 mb-3">
              <FiFilter size={16} className="text-gray-600" />
              <span className="text-sm font-medium text-gray-700">
                Optional Filters
              </span>
            </div>

            <div className="mb-3">
              <DateRangePicker
                fromDate={filters.startDate}
                toDate={filters.endDate}
                onDateRangeChange={(dr) =>
                  setFilters((p) => ({
                    ...p,
                    startDate: dr.fromDate,
                    endDate: dr.toDate,
                  }))
                }
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
              <input
                type="text"
                placeholder="Customer / Supplier Name"
                value={filters.customerName}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, customerName: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <select
                value={filters.returnType}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, returnType: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Types</option>
                <option value="Customer Return">Customer Return</option>
                <option value="Supplier Return">Supplier Return</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={applyFilters}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
              >
                Apply Filters
              </button>
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm font-medium"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    "Return No",
                    "Type",
                    "Date",
                    "Customer / Supplier",
                    "Original Invoice",
                    "Items",
                    "Total Return",
                    "Refund Method",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td
                      colSpan="10"
                      className="px-4 py-3 text-center text-gray-500 text-sm"
                    >
                      Loading return history...
                    </td>
                  </tr>
                ) : returns.length === 0 ? (
                  <tr>
                    <td
                      colSpan="10"
                      className="px-4 py-3 text-center text-gray-500 text-sm"
                    >
                      No returns found
                    </td>
                  </tr>
                ) : (
                  returns.map((ret) => (
                    <tr key={ret._id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 whitespace-nowrap font-mono text-sm font-semibold text-purple-700">
                        {ret.returnNumber}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${typeColor(ret.returnType)}`}
                        >
                          {ret.returnType}
                        </span>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-600">
                        {new Date(ret.returnDate || ret.createdAt).toLocaleDateString()}
                        <br />
                        <span className="text-gray-400">
                          {new Date(ret.returnDate || ret.createdAt).toLocaleTimeString()}
                        </span>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {ret.customerName || ret.supplierName || "—"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {ret.customerContact || ret.supplierContact || ""}
                        </div>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap font-mono text-xs text-blue-700">
                        {ret.originalInvoiceNumber || ret.originalPurchaseOrderNo || "—"}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <div className="text-xs text-gray-700">
                          {(ret.items || []).map((i) => i.medicineName).join(", ")}
                        </div>
                        <div className="text-xs text-gray-400">
                          {ret.items?.length || 0} item(s)
                        </div>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap font-bold text-orange-700">
                        PKR {Number(ret.totalReturnAmount || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-700">
                        {ret.refundMethod}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <div className="flex gap-2 items-center">
                          <button
                            onClick={() => {
                              setDetailReturn(ret);
                              setShowDetail(true);
                            }}
                            className="text-blue-600 hover:text-blue-900"
                            title="View Details"
                          >
                            <FiEye size={16} />
                          </button>
                          <button
                            onClick={() => printReturnSlip(ret)}
                            className="text-purple-600 hover:text-purple-900"
                            title="Print Slip"
                          >
                            <FiPrinter size={16} />
                          </button>
                        </div>
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
                Page <span className="font-medium">{pagination.currentPage}</span> of{" "}
                <span className="font-medium">{pagination.totalPages}</span> ({pagination.totalCount} total)
              </p>
              <nav className="inline-flex rounded shadow-sm -space-x-px">
                <button
                  onClick={() =>
                    setPagination((p) => ({ ...p, currentPage: p.currentPage - 1 }))
                  }
                  disabled={!pagination.hasPrev}
                  className="px-2 py-1 rounded-l border border-gray-300 bg-white text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() =>
                    setPagination((p) => ({ ...p, currentPage: p.currentPage + 1 }))
                  }
                  disabled={!pagination.hasNext}
                  className="px-2 py-1 rounded-r border border-gray-300 bg-white text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </nav>
            </div>
          )}
        </div>
      </div>

      {showDetail && detailReturn && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="text-white">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <FiCornerUpLeft className="w-5 h-5" /> {detailReturn.returnNumber}
                </h3>
                <p className="text-xs text-purple-200 mt-0.5">
                  {detailReturn.returnType} · {new Date(detailReturn.returnDate || detailReturn.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => printReturnSlip(detailReturn)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-all"
                >
                  <FiPrinter className="w-4 h-4" /> Print
                </button>
                <button
                  onClick={() => setShowDetail(false)}
                  className="text-white hover:bg-white/20 p-1.5 rounded-lg transition-all"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                {[
                  { label: "Return No", value: detailReturn.returnNumber },
                  { label: "Type", value: detailReturn.returnType },
                  {
                    label: "Date",
                    value: new Date(detailReturn.returnDate || detailReturn.createdAt).toLocaleString(),
                  },
                  {
                    label:
                      detailReturn.returnType === "Customer Return" ? "Customer" : "Supplier",
                    value: detailReturn.customerName || detailReturn.supplierName || "—",
                  },
                  {
                    label: "Contact",
                    value: detailReturn.customerContact || detailReturn.supplierContact || "—",
                  },
                  {
                    label: "Original Invoice",
                    value: detailReturn.originalInvoiceNumber || "—",
                  },
                  { label: "Refund Method", value: detailReturn.refundMethod },
                  { label: "Notes", value: detailReturn.notes || "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-slate-500 font-medium">{label}</p>
                    <p className="font-semibold text-slate-800 text-sm mt-0.5">{value}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">Returned Items</p>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {[
                          "Medicine",
                          "Batch",
                          "Category",
                          "Qty",
                          "Unit Price",
                          "Total",
                          "Reason",
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(detailReturn.items || []).map((item, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-3 py-2.5 font-medium text-slate-800">
                            {item.medicineName}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs text-slate-500">
                            {item.batchNo || "—"}
                          </td>
                          <td className="px-3 py-2.5 text-xs">
                            <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                              {item.category || "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center font-medium text-slate-700">
                            {item.quantity} {item.unit}
                          </td>
                          <td className="px-3 py-2.5 text-slate-700">
                            PKR {Number(item.returnPrice || 0).toFixed(2)}
                          </td>
                          <td className="px-3 py-2.5 font-bold text-orange-700">
                            PKR {Number(item.totalReturnAmount || 0).toFixed(2)}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-slate-500">
                            {item.reason || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-orange-50 border-t-2 border-orange-200">
                      <tr>
                        <td
                          colSpan={5}
                          className="px-3 py-2.5 text-right font-bold text-slate-700"
                        >
                          Total Return Amount:
                        </td>
                        <td className="px-3 py-2.5 font-black text-orange-700 text-base">
                          PKR {Number(detailReturn.totalReturnAmount || 0).toFixed(2)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
