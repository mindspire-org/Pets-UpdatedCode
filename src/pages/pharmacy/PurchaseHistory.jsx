import React, { useState, useEffect, useRef } from "react";
import {
  FiFilter,
  FiDownload,
  FiEye,
  FiRefreshCw,
  FiTrash2,
  FiPrinter,
} from "react-icons/fi";
import { pharmacyHistoryAPI } from "../../services/api";
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
    // Only fetch on initial load and page changes, NOT on filter changes
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

      // Only add filters if they have values
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.supplierName) params.supplierName = filters.supplierName;
      if (filters.invoiceNo) params.invoiceNo = filters.invoiceNo;
      if (filters.purchaseOrderNo)
        params.purchaseOrderNo = filters.purchaseOrderNo;
      if (filters.paymentStatus) params.paymentStatus = filters.paymentStatus;

      const response = await pharmacyHistoryAPI.getPurchaseHistory(params);

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
    // Trigger fetch after state updates
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
    // Fetch all data without filters
    setTimeout(() => {
      fetchPurchaseHistory();
    }, 0);
  };

  const viewPurchaseDetails = async (purchaseId) => {
    try {
      const response = await pharmacyHistoryAPI.getPurchaseDetails(purchaseId);
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
      await pharmacyHistoryAPI.deletePurchase(deleteConfirm.purchaseId);
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

  const printPurchase = () => {
    const printContent = printRef.current;
    const windowPrint = window.open("", "", "width=800,height=600");
    windowPrint.document.write("<html><head><title>Print Purchase</title>");
    windowPrint.document.write(
      "<style>body{font-family:Arial,sans-serif;padding:20px;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #ddd;padding:8px;text-align:left;}th{background-color:#f2f2f2;}</style>",
    );
    windowPrint.document.write("</head><body>");
    windowPrint.document.write(printContent.innerHTML);
    windowPrint.document.write("</body></html>");
    windowPrint.document.close();
    windowPrint.print();
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
    ].join("\\n");

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

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
              <div className="bg-blue-50 p-3 rounded">
                <div className="text-xs text-blue-600 font-medium">
                  Total Purchases
                </div>
                <div className="text-xl font-bold text-blue-900">
                  {summary.totalPurchases}
                </div>
              </div>
              <div className="bg-green-50 p-3 rounded">
                <div className="text-xs text-green-600 font-medium">
                  Total Amount
                </div>
                <div className="text-xl font-bold text-green-900">
                  PKR {summary.totalAmount?.toLocaleString()}
                </div>
              </div>
              <div className="bg-purple-50 p-3 rounded">
                <div className="text-xs text-purple-600 font-medium">
                  Amount Paid
                </div>
                <div className="text-xl font-bold text-purple-900">
                  PKR {summary.totalPaid?.toLocaleString()}
                </div>
              </div>
              <div className="bg-red-50 p-3 rounded">
                <div className="text-xs text-red-600 font-medium">
                  Outstanding
                </div>
                <div className="text-xl font-bold text-red-900">
                  PKR {summary.outstandingAmount?.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="border-t pt-3">
              <div className="flex items-center gap-2 mb-3">
                <FiFilter size={16} className="text-gray-600" />
                <span className="text-sm font-medium text-gray-700">
                  Optional Filters
                </span>
              </div>

              {/* Date Range - Full Width on Mobile */}
              <div className="mb-3">
                <DateRangePicker
                  fromDate={filters.startDate}
                  toDate={filters.endDate}
                  onDateRangeChange={handleDateRangeChange}
                />
              </div>

              {/* Filter Inputs - Responsive Grid */}
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

              {/* Action Buttons */}
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
                      Amount Details
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment Status
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
                        colSpan="5"
                        className="px-4 py-3 text-center text-gray-500 text-sm"
                      >
                        Loading purchase history...
                      </td>
                    </tr>
                  ) : purchases.length === 0 ? (
                    <tr>
                      <td
                        colSpan="5"
                        className="px-4 py-3 text-center text-gray-500 text-sm"
                      >
                        No purchases found
                      </td>
                    </tr>
                  ) : (
                    purchases.map((purchase) => (
                      <tr key={purchase._id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {purchase.purchaseOrderNo}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(
                                purchase.purchaseDate,
                              ).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-gray-400">
                              Invoice: {purchase.invoiceNo}
                            </div>
                            <div className="text-xs text-gray-400">
                              {purchase.items?.length || 0} items
                            </div>
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
                            {purchase.receivedBy && (
                              <div className="text-xs text-blue-600">
                                Received by: {purchase.receivedBy}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              PKR {purchase.totalAmount?.toLocaleString()}
                            </div>
                            <div className="text-xs text-green-600">
                              Paid: PKR {purchase.amountPaid?.toLocaleString()}
                            </div>
                            {purchase.totalAmount - purchase.amountPaid > 0 && (
                              <div className="text-xs text-red-600">
                                Due: PKR
                                {(
                                  purchase.totalAmount - purchase.amountPaid
                                )?.toLocaleString()}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(purchase.paymentStatus)}`}
                          >
                            {purchase.paymentStatus}
                          </span>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-2">
                            <button
                              onClick={() => viewPurchaseDetails(purchase._id)}
                              className="text-blue-600 hover:text-blue-900"
                              title="View Details"
                            >
                              <FiEye size={16} />
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
                      Page{" "}
                      <span className="font-medium">
                        {pagination.currentPage}
                      </span>{" "}
                      of{" "}
                      <span className="font-medium">
                        {pagination.totalPages}
                      </span>{" "}
                      ({pagination.totalCount} total)
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
                    Purchase Details -{" "}
                    {selectedPurchase.purchase.purchaseOrderNo}
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={printPurchase}
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
                          {new Date(
                            selectedPurchase.purchase.purchaseDate,
                          ).toLocaleDateString()}
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
                      Medicines Purchased from{" "}
                      {selectedPurchase.purchase.supplierName}
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
                          {selectedPurchase.purchase.items?.map(
                            (item, index) => (
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
                                  {new Date(
                                    item.expiryDate,
                                  ).toLocaleDateString()}
                                </td>
                              </tr>
                            ),
                          )}
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
                              PKR{" "}
                              {selectedPurchase.purchase.totalAmount?.toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-900">
                        <span className="font-semibold">Summary:</span>{" "}
                        Purchased {selectedPurchase.purchase.items?.length}{" "}
                        different medicine(s) from{" "}
                        <span className="font-semibold">
                          {selectedPurchase.purchase.supplierName}
                        </span>{" "}
                        for a total of PKR{" "}
                        {selectedPurchase.purchase.totalAmount?.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {selectedPurchase.returns &&
                    selectedPurchase.returns.length > 0 && (
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
                                - PKR {returnItem.totalReturnAmount} (
                                {returnItem.refundStatus})
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {selectedPurchase.medicines &&
                    selectedPurchase.medicines.length > 0 && (
                      <div className="mt-6">
                        <h4 className="font-semibold text-gray-900 mb-3">
                          Medicines Added to Inventory
                        </h4>
                        <div className="text-sm text-gray-600">
                          {selectedPurchase.medicines.length} medicine(s) were
                          added to inventory from this purchase.
                        </div>
                      </div>
                    )}

                  {selectedPurchase.purchase.notes && (
                    <div className="mt-6">
                      <h4 className="font-semibold text-gray-900 mb-3">
                        Notes
                      </h4>
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

        {/* Modals */}
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
