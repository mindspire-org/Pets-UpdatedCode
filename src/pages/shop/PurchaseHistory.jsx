import React, { useState, useEffect, useRef } from "react";
import {
  FiFilter,
  FiDownload,
  FiRefreshCw,
  FiTrash2,
  FiPrinter,
} from "react-icons/fi";
import { petshopPharmacyHistoryAPI, petShopSuppliersAPI } from "../../services/api";
import DateRangePicker from "../../components/DateRangePicker";
import Modal from "../../components/Modal";

export default function PurchaseHistory() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    supplierName: "",
    invoiceNo: "",
    purchaseOrderNo: "",
    paymentStatus: "",
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
  });
  const [summary, setSummary] = useState({
    totalPurchases: 0,
    totalAmount: 0,
    totalPaid: 0,
    outstandingAmount: 0,
  });
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [modal, setModal] = useState({
    isOpen: false,
    type: "info",
    title: "",
    message: "",
    onConfirm: null,
  });
  const [deleteConfirm, setDeleteConfirm] = useState({
    isOpen: false,
    purchaseId: null,
  });
  const printRef = useRef();

  useEffect(() => {
    if (
      !filters.startDate &&
      !filters.endDate &&
      !filters.supplierName &&
      !filters.invoiceNo &&
      !filters.purchaseOrderNo &&
      !filters.paymentStatus
    ) {
      fetchPurchaseHistory();
    }
  }, [pagination.currentPage]);

  const fetchPurchaseHistory = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.currentPage,
        limit: 20,
      };

      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.supplierName) params.supplierName = filters.supplierName;
      if (filters.invoiceNo) params.invoiceNo = filters.invoiceNo;
      if (filters.purchaseOrderNo) params.purchaseOrderNo = filters.purchaseOrderNo;
      if (filters.paymentStatus) params.paymentStatus = filters.paymentStatus;

      const response = await petshopPharmacyHistoryAPI.getPurchaseHistory(params);

      setPurchases(response.data.purchases || []);
      setPagination(
        response.data.pagination || {
          currentPage: 1,
          totalPages: 1,
          totalCount: 0,
        },
      );
      setSummary(
        response.data.summary || {
          totalPurchases: 0,
          totalAmount: 0,
          totalPaid: 0,
          outstandingAmount: 0,
        },
      );
    } catch (error) {
      console.error("Error fetching purchase history:", error);
      setModal({
        isOpen: true,
        type: "error",
        title: "Error Loading Data",
        message:
          "Failed to load purchase history. Please check if the server is running.",
        onConfirm: null,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleDateRangeChange = (dateRange) => {
    setFilters((prev) => ({
      ...prev,
      startDate: dateRange.fromDate,
      endDate: dateRange.toDate,
    }));
  };

  const applyFilters = () => {
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
    setTimeout(() => {
      fetchPurchaseHistory();
    }, 0);
  };

  const clearFilters = () => {
    setFilters({
      startDate: "",
      endDate: "",
      supplierName: "",
      invoiceNo: "",
      purchaseOrderNo: "",
      paymentStatus: "",
    });
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
    setTimeout(() => {
      fetchPurchaseHistory();
    }, 0);
  };

  const viewPurchaseDetails = async (purchaseId) => {
    try {
      const response = await petshopPharmacyHistoryAPI.getPurchaseDetails(
        purchaseId,
      );
      setSelectedPurchase(response.data);
      setShowDetails(true);
    } catch (error) {
      console.error("Error fetching purchase details:", error);
    }
  };

  const deletePurchase = async (purchaseId) => {
    setDeleteConfirm({ isOpen: true, purchaseId });
  };

  const confirmDelete = async () => {
    try {
      await petshopPharmacyHistoryAPI.deletePurchase(deleteConfirm.purchaseId);
      setModal({
        isOpen: true,
        type: "success",
        title: "Success",
        message: "Purchase deleted successfully and stock adjusted",
        onConfirm: null,
      });
      fetchPurchaseHistory();
    } catch (error) {
      console.error("Error deleting purchase:", error);
      setModal({
        isOpen: true,
        type: "error",
        title: "Error",
        message: "Error deleting purchase: " + error.message,
        onConfirm: null,
      });
    }
    setDeleteConfirm({ isOpen: false, purchaseId: null });
  };

  const printPurchaseInvoice = async (purchase) => {
    let supplierDetails = null;
    if (purchase.supplierId) {
      try {
        const res = await petShopSuppliersAPI.getById(purchase.supplierId);
        supplierDetails = res.data;
      } catch (err) {
        console.error("Error fetching supplier details:", err);
      }
    }

    const printWindow = window.open(
      "",
      "_blank",
      "width=900,height=700,left=50,top=50,toolbar=0,menubar=0,scrollbars=1",
    );
    const fmt = (n) =>
      Number(n || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

    const itemRows = (purchase.items || [])
      .map(
        (item, i) => `
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:8px 12px;">${i + 1}</td>
        <td style="padding:8px 12px;font-weight:600;">${item.medicineName}</td>
        <td style="padding:8px 12px;text-align:center;">${item.unitsPerPack ?? item.unit ?? "—"}</td>
        <td style="padding:8px 12px;text-align:center;">${item.totalItems ?? item.quantity ?? 0}</td>
        <td style="padding:8px 12px;text-align:right;">PKR ${fmt(item.buyPerPack ?? item.purchasePrice)}</td>
        <td style="padding:8px 12px;text-align:right;">PKR ${fmt(item.buyPerUnit ?? item.purchasePrice)}</td>
        <td style="padding:8px 12px;text-align:right;font-weight:700;color:#1d4ed8;">PKR ${fmt(item.lineTotal ?? item.totalCost)}</td>
        <td style="padding:8px 12px;text-align:right;">PKR ${fmt(item.salePerPack ?? item.salePrice)}</td>
        <td style="padding:8px 12px;text-align:right;">PKR ${fmt(item.salePerUnit ?? item.salePrice)}</td>
        <td style="padding:8px 12px;text-align:center;">${item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : "—"}</td>
        <td style="padding:8px 12px;font-family:monospace;font-size:11px;">${item.batchNo || "—"}</td>
      </tr>`,
      )
      .join("");

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Purchase Invoice - ${purchase.invoiceNo}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:Arial,sans-serif;font-size:13px;color:#111;padding:24px;}
  h1{font-size:20px;font-weight:800;color:#1e1b4b;margin-bottom:2px;}
  h2{font-size:15px;font-weight:600;color:#4c1d95;margin-bottom:16px;}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #7c3aed;}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;margin-bottom:20px;font-size:12px;border: 1px solid #e5e7eb; padding: 12px; border-radius: 8px;}
  .meta-item{display:flex; gap: 8px;}
  .meta span{color:#6b7280; font-weight: 500;}
  .meta strong{color:#111;}
  table{width:100%;border-collapse:collapse;font-size:12px;}
  thead tr{background:#4c1d95;color:#fff;}
  thead th{padding:8px 12px;text-align:left;font-weight:600;white-space:nowrap;}
  thead th.right{text-align:right;}
  thead th.center{text-align:center;}
  tbody tr:nth-child(even){background:#f5f3ff;}
  tfoot tr{background:#ede9fe;font-weight:700;}
  tfoot td{padding:10px 12px;}
  @media print{body{padding:8px;}}
</style></head><body>
<div class="header">
  <div>
    <h1>Purchase Invoice</h1>
    <h2>${purchase.invoiceNo}</h2>
  </div>
  <div style="text-align:right;font-size:12px;color:#6b7280;">
    <div><strong>PO#:</strong> ${purchase.purchaseOrderNo}</div>
    <div><strong>Date:</strong> ${new Date(purchase.purchaseDate).toLocaleDateString()}</div>
  </div>
</div>

<div style="margin-bottom: 12px; font-weight: bold; color: #1e1b4b; font-size: 14px;">Supplier Information</div>
<div class="meta">
  <div class="meta-item"><span>Supplier Name:</span><strong>${supplierDetails?.name || purchase.supplierName || "—"}</strong></div>
  <div class="meta-item"><span>Company:</span><strong>${supplierDetails?.company || "—"}</strong></div>
  <div class="meta-item"><span>Phone:</span><strong>${supplierDetails?.phone || purchase.supplierContact || "—"}</strong></div>
  <div class="meta-item"><span>Address:</span><strong>${supplierDetails?.address || "—"}</strong></div>
  <div class="meta-item"><span>Tax ID:</span><strong>${supplierDetails?.taxId || "—"}</strong></div>
  <div class="meta-item"><span>Received by:</span><strong>${purchase.reviewedBy || purchase.receivedBy || "—"}</strong></div>
</div>

<table>
  <thead>
    <tr>
      <th>#</th>
      <th>Medicine</th>
      <th class="center">Units/Pack</th>
      <th class="center">Total Items</th>
      <th class="right">Buy/Pack</th>
      <th class="right">Buy/Unit</th>
      <th class="right">Total Amount</th>
      <th class="right">Sale/Pack</th>
      <th class="right">Sale/Unit</th>
      <th class="center">Expiry</th>
      <th>Batch</th>
    </tr>
  </thead>
  <tbody>${itemRows}</tbody>
  <tfoot>
    <tr>
      <td colspan="6" style="text-align:right;">Total Purchase Amount:</td>
      <td style="color:#1d4ed8;">PKR ${fmt(purchase.netTotal ?? purchase.totalAmount)}</td>
      <td colspan="4"></td>
    </tr>
  </tfoot>
</table>
<div style="margin-top:20px;font-size:11px;color:#9ca3af;text-align:center;border-top:1px dashed #d1d5db;padding-top:12px;">
  Generated on ${new Date().toLocaleString()} — Abbottabad Pet Hospital Shop
</div>
<script>window.onload=function(){window.print();setTimeout(function(){window.close();},300);};</script>
</body></html>`;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const exportToCSV = () => {
    const csvData = purchases.map((purchase) => ({
      "Purchase Order No": purchase.purchaseOrderNo,
      Date: new Date(purchase.purchaseDate).toLocaleDateString(),
      "Supplier Name": purchase.supplierName,
      "Invoice No": purchase.invoiceNo,
      "Total Amount": purchase.totalAmount,
      "Amount Paid": purchase.amountPaid,
      Outstanding: purchase.totalAmount - purchase.amountPaid,
      "Payment Status": purchase.paymentStatus,
      "Received By": purchase.receivedBy || "",
    }));

    const csv = [
      Object.keys(csvData[0]).join(","),
      ...csvData.map((row) => Object.values(row).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `purchase-history-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case "Paid":
        return "bg-green-100 text-green-800";
      case "Pending":
        return "bg-red-100 text-red-800";
      case "Partial":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <>
      <div className="p-3 bg-gray-50 min-h-screen">
        <div className="max-w-full mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-4 mb-3">
            <div className="flex justify-between items-center mb-3">
              <h1 className="text-xl font-bold text-gray-900">
                Purchase History
              </h1>
              <div className="flex gap-2">
                <button
                  onClick={exportToCSV}
                  className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                >
                  <FiDownload size={14} />
                  Export CSV
                </button>
                <button
                  onClick={fetchPurchaseHistory}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                >
                  <FiRefreshCw size={14} />
                  Refresh
                </button>
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
                  onDateRangeChange={handleDateRangeChange}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                <div>
                  <input
                    type="text"
                    placeholder="Supplier Name"
                    value={filters.supplierName}
                    onChange={(e) =>
                      handleFilterChange("supplierName", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <input
                    type="text"
                    placeholder="Invoice No"
                    value={filters.invoiceNo}
                    onChange={(e) =>
                      handleFilterChange("invoiceNo", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <input
                    type="text"
                    placeholder="PO Number"
                    value={filters.purchaseOrderNo}
                    onChange={(e) =>
                      handleFilterChange("purchaseOrderNo", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <select
                    value={filters.paymentStatus}
                    onChange={(e) =>
                      handleFilterChange("paymentStatus", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Status</option>
                    <option value="Paid">Paid</option>
                    <option value="Pending">Pending</option>
                    <option value="Partial">Partial</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
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
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Purchase Details
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Supplier Info
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Medicine
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Batch No
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Units/Pack
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Items
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Buy/Pack
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Buy/Unit
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Amount
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sale/Pack
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sale/Unit
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Expiry
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td
                        colSpan="13"
                        className="px-4 py-3 text-center text-gray-500 text-sm"
                      >
                        Loading purchase history...
                      </td>
                    </tr>
                  ) : purchases.length === 0 ? (
                    <tr>
                      <td
                        colSpan="13"
                        className="px-4 py-3 text-center text-gray-500 text-sm"
                      >
                        No purchases found
                      </td>
                    </tr>
                  ) : (
                    purchases.map((purchase) => (
                      <tr key={purchase._id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 whitespace-nowrap">
                          <div className="text-sm font-bold text-gray-900">
                            {purchase.invoiceNo}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(purchase.purchaseDate).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {purchase.supplierName}
                            </div>
                            <div className="text-xs text-gray-500">
                              {purchase.supplierContact}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2 max-w-[160px]">
                          <div className="text-xs text-gray-800 leading-relaxed">
                            {(purchase.items || [])
                              .map((i) => i.medicineName)
                              .join(", ")}
                          </div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <div className="text-xs font-mono text-gray-600">
                            {(purchase.items || [])
                              .map((i) => i.batchNo || "—")
                              .join(", ")}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-center whitespace-nowrap">
                          <div className="text-xs text-gray-600">
                            {(purchase.items || [])
                              .map((i) => i.unitsPerPack ?? i.unit ?? "—")
                              .join(", ")}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-center whitespace-nowrap">
                          <span className="text-sm font-bold text-gray-800">
                            {(purchase.items || []).reduce(
                              (s, i) =>
                                s +
                                (Number(i.totalItems ?? i.quantity) || 0),
                              0,
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right whitespace-nowrap">
                          <div className="text-xs text-gray-700">
                            {(purchase.items || [])
                              .map(
                                (i) =>
                                  `PKR ${Number(i.buyPerPack ?? i.purchasePrice ?? 0).toFixed(2)}`,
                              )
                              .join(", ")}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right whitespace-nowrap">
                          <div className="text-xs text-gray-700">
                            {(purchase.items || [])
                              .map(
                                (i) =>
                                  `PKR ${Number(i.buyPerUnit ?? i.purchasePrice ?? 0).toFixed(2)}`,
                              )
                              .join(", ")}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right whitespace-nowrap">
                          <div className="text-sm font-bold text-blue-700">
                            PKR {Number(purchase.netTotal ?? purchase.totalAmount ?? 0).toFixed(2)}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right whitespace-nowrap">
                          <div className="text-xs text-gray-700">
                            {(purchase.items || [])
                              .map(
                                (i) =>
                                  `PKR ${Number(i.salePerPack ?? i.salePrice ?? 0).toFixed(2)}`,
                              )
                              .join(", ")}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right whitespace-nowrap">
                          <div className="text-xs text-gray-700">
                            {(purchase.items || [])
                              .map(
                                (i) =>
                                  `PKR ${Number(i.salePerUnit ?? i.salePrice ?? 0).toFixed(2)}`,
                              )
                              .join(", ")}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-center whitespace-nowrap">
                          <div className="text-xs text-gray-600">
                            {(purchase.items || [])
                              .map((i) =>
                                i.expiryDate
                                  ? new Date(i.expiryDate).toLocaleDateString()
                                  : "—",
                              )
                              .join(", ")}
                          </div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-2 items-center">
                            <button
                              onClick={() => printPurchaseInvoice(purchase)}
                              className="text-purple-600 hover:text-purple-900"
                              title="Print Invoice"
                            >
                              <FiPrinter size={16} />
                            </button>
                            <button
                              onClick={() => viewPurchaseDetails(purchase._id)}
                              className="text-blue-600 hover:text-blue-900"
                              title="View Details"
                            >
                              {" "}
                              Details
                            </button>
                            <button
                              onClick={() => deletePurchase(purchase._id)}
                              className="text-red-600 hover:text-red-900"
                              title="Delete Purchase"
                            >
                              <FiTrash2 size={16} />
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
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        currentPage: prev.currentPage - 1,
                      }))
                    }
                    disabled={!pagination.hasPrev}
                    className="relative inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        currentPage: prev.currentPage + 1,
                      }))
                    }
                    disabled={!pagination.hasNext}
                    className="ml-3 relative inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs text-gray-700">
                      Page <span className="font-medium">{pagination.currentPage}</span> of{" "}
                      <span className="font-medium">{pagination.totalPages}</span> ({pagination.totalCount} total)
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded shadow-sm -space-x-px">
                      <button
                        onClick={() =>
                          setPagination((prev) => ({
                            ...prev,
                            currentPage: prev.currentPage - 1,
                          }))
                        }
                        disabled={!pagination.hasPrev}
                        className="relative inline-flex items-center px-2 py-1 rounded-l border border-gray-300 bg-white text-xs font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() =>
                          setPagination((prev) => ({
                            ...prev,
                            currentPage: prev.currentPage + 1,
                          }))
                        }
                        disabled={!pagination.hasNext}
                        className="relative inline-flex items-center px-2 py-1 rounded-r border border-gray-300 bg-white text-xs font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>

          {showDetails && selectedPurchase && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
              <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-gray-900">
                    Purchase Details - {selectedPurchase.purchase.purchaseOrderNo}
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => printPurchaseInvoice(selectedPurchase.purchase)}
                      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
                    >
                      <FiPrinter size={16} />
                      Print
                    </button>
                    <button
                      onClick={() => setShowDetails(false)}
                      className="text-gray-400 hover:text-gray-600 text-2xl"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div ref={printRef}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">
                        Purchase Information
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-medium">PO Number:</span>{" "}
                          {selectedPurchase.purchase.purchaseOrderNo}
                        </div>
                        <div>
                          <span className="font-medium">Date:</span>{" "}
                          {new Date(selectedPurchase.purchase.purchaseDate).toLocaleDateString()}
                        </div>
                        <div>
                          <span className="font-medium">Supplier:</span>{" "}
                          {selectedPurchase.purchase.supplierName}
                        </div>
                        <div>
                          <span className="font-medium">Contact:</span>{" "}
                          {selectedPurchase.purchase.supplierContact || "N/A"}
                        </div>
                        <div>
                          <span className="font-medium">Invoice No:</span>{" "}
                          {selectedPurchase.purchase.invoiceNo}
                        </div>
                        <div>
                          <span className="font-medium">Received By:</span>{" "}
                          {selectedPurchase.purchase.receivedBy || "N/A"}
                        </div>
                        <div>
                          <span className="font-medium">Payment Status:</span>
                          <span
                            className={`ml-2 px-2 py-1 rounded text-xs ${getPaymentStatusColor(selectedPurchase.purchase.paymentStatus)}`}
                          >
                            {selectedPurchase.purchase.paymentStatus}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">
                        Amount Details
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-medium">Total Amount:</span> PKR
                          {selectedPurchase.purchase.totalAmount?.toLocaleString()}
                        </div>
                        <div>
                          <span className="font-medium">Amount Paid:</span> PKR
                          {selectedPurchase.purchase.amountPaid?.toLocaleString()}
                        </div>
                        <div className="border-t pt-2">
                          <span className="font-medium">Outstanding:</span> PKR
                          {(
                            selectedPurchase.purchase.totalAmount -
                            selectedPurchase.purchase.amountPaid
                          )?.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h4 className="font-semibold text-gray-900 mb-3">
                      Medicines Purchased from {selectedPurchase.purchase.supplierName}
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 border">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Medicine Name
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Batch No
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Category
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Quantity
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Purchase Price
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Sale Price
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Total Cost
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Expiry Date
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {selectedPurchase.purchase.items?.map((item, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-sm font-medium text-gray-900">
                                {item.medicineName}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                {item.batchNo}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                {item.category}
                              </td>
                              <td className="px-4 py-2 text-sm font-medium text-gray-900">
                                {item.quantity} {item.unit}
                              </td>
                              <td className="px-4 py-2 text-sm font-medium text-green-700">
                                PKR {item.purchasePrice?.toLocaleString()}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900">
                                PKR {item.salePrice?.toLocaleString()}
                              </td>
                              <td className="px-4 py-2 text-sm font-bold text-blue-700">
                                PKR {item.totalCost?.toLocaleString()}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                {new Date(item.expiryDate).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-100">
                          <tr>
                            <td
                              colSpan="6"
                              className="px-4 py-3 text-right text-sm font-bold text-gray-900"
                            >
                              Total Purchase Amount:
                            </td>
                            <td
                              colSpan="2"
                              className="px-4 py-3 text-sm font-bold text-blue-900"
                            >
                              PKR {selectedPurchase.purchase.totalAmount?.toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-900">
                        <span className="font-semibold">Summary:</span> Purchased{" "}
                        {selectedPurchase.purchase.items?.length} different medicine(s) from{" "}
                        <span className="font-semibold">
                          {selectedPurchase.purchase.supplierName}
                        </span>{" "}
                        for a total of PKR{" "}
                        {selectedPurchase.purchase.totalAmount?.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {selectedPurchase.returns && selectedPurchase.returns.length > 0 && (
                    <div className="mt-6">
                      <h4 className="font-semibold text-gray-900 mb-3">
                        Returns to Supplier
                      </h4>
                      <div className="space-y-2">
                        {selectedPurchase.returns.map((returnItem, index) => (
                          <div
                            key={index}
                            className="bg-red-50 p-3 rounded-lg"
                          >
                            <div className="text-sm">
                              <span className="font-medium">
                                Return #{returnItem.returnNumber}
                              </span>{" "}
                              - PKR {returnItem.totalReturnAmount} ({returnItem.refundStatus})
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedPurchase.medicines && selectedPurchase.medicines.length > 0 && (
                    <div className="mt-6">
                      <h4 className="font-semibold text-gray-900 mb-3">
                        Medicines Added to Inventory
                      </h4>
                      <div className="text-sm text-gray-600">
                        {selectedPurchase.medicines.length} medicine(s) were added to inventory from this purchase.
                      </div>
                    </div>
                  )}

                  {selectedPurchase.purchase.notes && (
                    <div className="mt-6">
                      <h4 className="font-semibold text-gray-900 mb-3">Notes</h4>
                      <p className="text-sm text-gray-600">
                        {selectedPurchase.purchase.notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <Modal
          isOpen={modal.isOpen}
          onClose={() => setModal({ ...modal, isOpen: false })}
          title={modal.title}
          message={modal.message}
          type={modal.type}
          onConfirm={modal.onConfirm}
        />

        <Modal
          isOpen={deleteConfirm.isOpen}
          onClose={() => setDeleteConfirm({ isOpen: false, purchaseId: null })}
          title="Confirm Delete"
          message="Are you sure you want to delete this purchase? Stock will be adjusted."
          type="confirm"
          onConfirm={confirmDelete}
          showCancel={true}
          confirmText="Delete"
          cancelText="Cancel"
        />
      </div>
    </>
  );
}
