import React, { useState, useEffect, useRef } from "react";
import {
  FiSearch,
  FiFilter,
  FiDownload,
  FiEye,
  FiRefreshCw,
  FiTrash2,
  FiPrinter,
  FiArrowLeft,
} from "react-icons/fi";
import { pharmacyHistoryAPI } from "../../services/api";
import DateRangePicker from "../../components/DateRangePicker";
import Modal from "../../components/Modal";

export default function SalesHistory() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    customerName: "",
    customerContact: "",
    invoiceNumber: "",
    paymentMethod: "",
    status: "",
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
  });
  const [summary, setSummary] = useState({
    totalSales: 0,
    totalRevenue: 0,
    totalDiscount: 0,
    avgSaleAmount: 0,
  });
  const [selectedSale, setSelectedSale] = useState(null);
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
    saleId: null,
  });
  const printRef = useRef();

  useEffect(() => {
    // Only fetch on initial load and page changes, NOT on filter changes
    if (
      !filters.startDate &&
      !filters.endDate &&
      !filters.customerName &&
      !filters.customerContact &&
      !filters.invoiceNumber &&
      !filters.paymentMethod &&
      !filters.status
    ) {
      fetchSalesHistory();
    }
  }, [pagination.currentPage]);

  const fetchSalesHistory = async () => {
    try {
      setLoading(true);
      const params = {
        ...filters,
        page: pagination.currentPage,
        limit: 20,
      };

      Object.keys(params).forEach((key) => {
        if (!params[key]) delete params[key];
      });

      const response = await pharmacyHistoryAPI.getSalesHistory(params);
      setSales(response.data.sales);
      setPagination(response.data.pagination);
      setSummary(response.data.summary);
    } catch (error) {
      console.error("Error fetching sales history:", error);
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
      fetchSalesHistory();
    }, 0);
  };

  const clearFilters = () => {
    setFilters({
      startDate: "",
      endDate: "",
      customerName: "",
      customerContact: "",
      invoiceNumber: "",
      paymentMethod: "",
      status: "",
    });
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
    // Fetch all data without filters
    setTimeout(() => {
      fetchSalesHistory();
    }, 0);
  };

  const viewSaleDetails = async (saleId) => {
    try {
      const response = await pharmacyHistoryAPI.getSaleDetails(saleId);
      setSelectedSale(response.data);
      setShowDetails(true);
    } catch (error) {
      console.error("Error fetching sale details:", error);
    }
  };

  const deleteSale = async (saleId) => {
    setDeleteConfirm({ isOpen: true, saleId });
  };

  const confirmDelete = async () => {
    try {
      await pharmacyHistoryAPI.deleteSale(deleteConfirm.saleId);
      setModal({
        isOpen: true,
        type: "success",
        title: "Success",
        message: "Sale deleted successfully and stock restored",
        onConfirm: null,
      });
      fetchSalesHistory();
    } catch (error) {
      console.error("Error deleting sale:", error);
      setModal({
        isOpen: true,
        type: "error",
        title: "Error",
        message: "Error deleting sale: " + error.message,
        onConfirm: null,
      });
    }
    setDeleteConfirm({ isOpen: false, saleId: null });
  };

  const printSale = () => {
    const printContent = printRef.current;
    const windowPrint = window.open("", "", "width=800,height=600");
    windowPrint.document.write("<html><head><title>Print Sale</title>");
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
    const csvData = sales.map((sale) => ({
      "Invoice Number": sale.invoiceNumber,
      Date: new Date(sale.createdAt).toLocaleDateString(),
      "Customer Name": sale.customerName || "Walk-in",
      "Customer Contact": sale.customerContact || "",
      "Pet Name": sale.petName || "",
      "Total Amount": sale.totalAmount,
      Discount: sale.discount,
      "Payment Method": sale.paymentMethod,
      Status: sale.status,
      "Sold By": sale.soldBy || "",
    }));

    const csv = [
      Object.keys(csvData[0]).join(","),
      ...csvData.map((row) => Object.values(row).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-history-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div className="p-3 bg-gray-50 min-h-screen">
      <div className="max-w-full mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-4 mb-3">
          <div className="flex justify-between items-center mb-3">
            <h1 className="text-xl font-bold text-gray-900">Sales History</h1>
            <div className="flex gap-2">
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
              >
                <FiDownload size={14} />
                Export CSV
              </button>
              <button
                onClick={fetchSalesHistory}
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
                Total Sales
              </div>
              <div className="text-xl font-bold text-blue-900">
                {summary.totalSales}
              </div>
            </div>
            <div className="bg-green-50 p-3 rounded">
              <div className="text-xs text-green-600 font-medium">
                Total Revenue
              </div>
              <div className="text-xl font-bold text-green-900">
                PKR {summary.totalRevenue?.toLocaleString()}
              </div>
            </div>
            <div className="bg-orange-50 p-3 rounded">
              <div className="text-xs text-orange-600 font-medium">
                Total Discount
              </div>
              <div className="text-xl font-bold text-orange-900">
                PKR {summary.totalDiscount?.toLocaleString()}
              </div>
            </div>
            <div className="bg-purple-50 p-3 rounded">
              <div className="text-xs text-purple-600 font-medium">
                Avg Sale Amount
              </div>
              <div className="text-xl font-bold text-purple-900">
                PKR {summary.avgSaleAmount?.toFixed(0)}
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
                  placeholder="Customer Name"
                  value={filters.customerName}
                  onChange={(e) =>
                    handleFilterChange("customerName", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Contact Number"
                  value={filters.customerContact}
                  onChange={(e) =>
                    handleFilterChange("customerContact", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Invoice Number"
                  value={filters.invoiceNumber}
                  onChange={(e) =>
                    handleFilterChange("invoiceNumber", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <select
                  value={filters.paymentMethod}
                  onChange={(e) =>
                    handleFilterChange("paymentMethod", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Payment Methods</option>
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
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
                    Invoice Details
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer Info
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount Details
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
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
                      colSpan="6"
                      className="px-4 py-3 text-center text-gray-500 text-sm"
                    >
                      Loading sales history...
                    </td>
                  </tr>
                ) : sales.length === 0 ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="px-4 py-3 text-center text-gray-500 text-sm"
                    >
                      No sales found
                    </td>
                  </tr>
                ) : (
                  sales.map((sale) => (
                    <tr key={sale._id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {sale.invoiceNumber}
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(sale.createdAt).toLocaleDateString()}{" "}
                            {new Date(sale.createdAt).toLocaleTimeString()}
                          </div>
                          <div className="text-xs text-gray-400">
                            {sale.items?.length || 0} items
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {sale.customerName || "Walk-in Customer"}
                          </div>
                          <div className="text-sm text-gray-500">
                            {sale.customerContact}
                          </div>
                          {sale.petName && (
                            <div className="text-xs text-blue-600">
                              Pet: {sale.petName}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            PKR {sale.totalAmount?.toLocaleString()}
                          </div>
                          {sale.discount > 0 && (
                            <div className="text-sm text-red-600">
                              -PKR {sale.discount?.toLocaleString()}
                            </div>
                          )}
                          <div className="text-xs text-gray-500">
                            Subtotal: PKR {sale.subtotal?.toLocaleString()}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <div>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {sale.paymentMethod}
                          </span>
                          {sale.paymentCharge > 0 && (
                            <div className="text-xs text-gray-500 mt-1">
                              Charge: PKR {sale.paymentCharge}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            sale.status === "Completed"
                              ? "bg-green-100 text-green-800"
                              : sale.status === "Pending"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                          }`}
                        >
                          {sale.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <button
                            onClick={() => viewSaleDetails(sale._id)}
                            className="text-blue-600 hover:text-blue-900"
                            title="View Details"
                          >
                            <FiEye size={16} />
                          </button>
                          <button
                            onClick={() => deleteSale(sale._id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete Sale"
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
                    <span className="font-medium">{pagination.totalPages}</span>{" "}
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

        {showDetails && selectedSale && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-900">
                  Sale Details - {selectedSale.sale.invoiceNumber}
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={printSale}
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
                      Sale Information
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium">Invoice:</span>{" "}
                        {selectedSale.sale.invoiceNumber}
                      </div>
                      <div>
                        <span className="font-medium">Date:</span>{" "}
                        {new Date(selectedSale.sale.createdAt).toLocaleString()}
                      </div>
                      <div>
                        <span className="font-medium">Customer:</span>{" "}
                        {selectedSale.sale.customerName || "Walk-in"}
                      </div>
                      <div>
                        <span className="font-medium">Contact:</span>{" "}
                        {selectedSale.sale.customerContact || "N/A"}
                      </div>
                      <div>
                        <span className="font-medium">Pet:</span>{" "}
                        {selectedSale.sale.petName || "N/A"}
                      </div>
                      <div>
                        <span className="font-medium">Payment Method:</span>{" "}
                        {selectedSale.sale.paymentMethod}
                      </div>
                      <div>
                        <span className="font-medium">Sold By:</span>{" "}
                        {selectedSale.sale.soldBy || "N/A"}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">
                      Amount Breakdown
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium">Subtotal:</span> PKR
                        {selectedSale.sale.subtotal?.toLocaleString()}
                      </div>
                      <div>
                        <span className="font-medium">Discount:</span> PKR
                        {selectedSale.sale.discount?.toLocaleString()}
                      </div>
                      <div>
                        <span className="font-medium">Payment Charge:</span> PKR
                        {selectedSale.sale.paymentCharge?.toLocaleString()}
                      </div>
                      <div className="border-t pt-2">
                        <span className="font-medium">Total Amount:</span> PKR
                        {selectedSale.sale.totalAmount?.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <h4 className="font-semibold text-gray-900 mb-3">
                    Medicines Sold
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
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
                            Unit Price
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedSale.sale.items?.map((item, index) => (
                          <tr key={index}>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {item.medicineName}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-500">
                              {item.batchNo}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-500">
                              {item.category}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {item.quantity} {item.unit}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              PKR {item.pricePerUnit}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              PKR {item.totalPrice}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {selectedSale.returns && selectedSale.returns.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-semibold text-gray-900 mb-3">
                      Returns
                    </h4>
                    <div className="space-y-2">
                      {selectedSale.returns.map((returnItem, index) => (
                        <div key={index} className="bg-red-50 p-3 rounded-lg">
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
              </div>
            </div>
          </div>
        )}

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
          onClose={() => setDeleteConfirm({ isOpen: false, saleId: null })}
          title="Confirm Delete"
          message="Are you sure you want to delete this sale? Stock will be restored."
          type="confirm"
          onConfirm={confirmDelete}
          showCancel={true}
          confirmText="Delete"
          cancelText="Cancel"
        />
      </div>
    </div>
  );
}
