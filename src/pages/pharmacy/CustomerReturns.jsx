import { useState, useEffect } from "react";
import {
  FiPlus,
  FiEye,
  FiRefreshCw,
  FiArrowLeft,
  FiCheck,
  FiX,
  FiShoppingCart,
  FiPrinter,
} from "react-icons/fi";
import { pharmacyHistoryAPI } from "../../services/api";
import Modal from "../../components/Modal";
import CustomerReturnReceipt from "../../components/pharmacy/CustomerReturnReceipt";

export default function CustomerReturns() {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showReturnHistory, setShowReturnHistory] = useState(true); // Show history by default for debugging
  const [salesHistory, setSalesHistory] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);
  const [loadingSales, setLoadingSales] = useState(false);
  const [returnForm, setReturnForm] = useState({
    originalSaleId: "",
    customerName: "",
    customerContact: "",
    refundMethod: "Cash",
    notes: "",
    items: [],
  });
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    customerName: "",
    invoiceNumber: "",
  });
  const [returnFilters, setReturnFilters] = useState({
    startDate: "",
    endDate: "",
    customerName: "",
    returnNumber: "",
    status: "",
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
  });

  const [modal, setModal] = useState({
    isOpen: false,
    type: "info",
    title: "",
    message: "",
    onConfirm: null,
  });

  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [hospitalSettings] = useState({
    hospitalName: "Pet Hospital & Pharmacy",
    address: "123 Main Street, City",
    phone: "+92-XXX-XXXXXXX",
  });

  useEffect(() => {
    // Only fetch on initial load and page changes, NOT on filter changes
    if (
      !filters.startDate &&
      !filters.endDate &&
      !filters.customerName &&
      !filters.invoiceNumber
    ) {
      fetchSalesHistory();
    }
  }, [pagination.currentPage]);

  useEffect(() => {
    // Fetch returns on component mount
    fetchReturns();
  }, []);

  const fetchSalesHistory = async () => {
    try {
      setLoadingSales(true);
      const params = {
        page: pagination.currentPage,
        limit: 20,
      };

      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.customerName) params.customerName = filters.customerName;
      if (filters.invoiceNumber) params.invoiceNumber = filters.invoiceNumber;

      const response = await pharmacyHistoryAPI.getSalesHistory(params);
      setSalesHistory(response.data.sales || []);
      setPagination(
        response.data.pagination || {
          currentPage: 1,
          totalPages: 1,
          totalCount: 0,
        },
      );
    } catch (error) {
      console.error("Error fetching sales history:", error);
    } finally {
      setLoadingSales(false);
    }
  };

  const fetchReturns = async () => {
    try {
      setLoading(true);
      const params = {
        returnType: "Customer Return",
      };

      if (returnFilters.startDate) params.startDate = returnFilters.startDate;
      if (returnFilters.endDate) params.endDate = returnFilters.endDate;
      if (returnFilters.customerName)
        params.customerName = returnFilters.customerName;
      if (returnFilters.returnNumber)
        params.returnNumber = returnFilters.returnNumber;
      if (returnFilters.status) params.status = returnFilters.status;

      const response = await pharmacyHistoryAPI.getReturns(params);
      console.log("Returns API response:", response.data);
      const returnsData =
        response.data.data?.returns || response.data.returns || [];
      console.log("Setting returns data:", returnsData);
      setReturns(returnsData);
    } catch (error) {
      console.error("Error fetching returns:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyReturnFilters = () => {
    fetchReturns();
  };

  const clearReturnFilters = () => {
    setReturnFilters({
      startDate: "",
      endDate: "",
      customerName: "",
      returnNumber: "",
      status: "",
    });
    setTimeout(() => {
      fetchReturns();
    }, 0);
  };

  const applyFilters = () => {
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
    setTimeout(() => {
      fetchSalesHistory();
    }, 0);
  };

  const clearFilters = () => {
    setFilters({
      startDate: "",
      endDate: "",
      customerName: "",
      invoiceNumber: "",
    });
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
    setTimeout(() => {
      fetchSalesHistory();
    }, 0);
  };

  const selectSale = async (sale) => {
    try {
      const response = await pharmacyHistoryAPI.getSaleDetails(sale._id);
      const detailedSale = response.data.sale;

      setSelectedSale(detailedSale);
      setReturnForm({
        originalSaleId: detailedSale._id,
        customerName: detailedSale.customerName || "",
        customerContact: detailedSale.customerContact || "",
        refundMethod: "Cash",
        notes: "",
        items: detailedSale.items.map((item) => ({
          medicineId: item.medicineId?._id || item.medicineId,
          medicineName: item.medicineName,
          batchNo: item.batchNo,
          category: item.category,
          unit: item.unit,
          soldQuantity: item.quantity,
          salePrice:
            item.pricePerUnit || item.actualSalePrice || item.unitPrice || 0,
          returnQuantity: 0,
          returnPrice: 0,
          totalReturnAmount: 0,
          reason: "",
          expiryDate: item.expiryDate,
        })),
      });
    } catch (error) {
      console.error("Error fetching sale details:", error);
      setModal({
        isOpen: true,
        type: "error",
        title: "Error",
        message: "Error loading sale details: " + error.message,
        onConfirm: null,
      });
    }
  };

  const updateReturnItem = (index, field, value) => {
    const updatedItems = [...returnForm.items];
    const item = updatedItems[index];

    if (field === "returnQuantity") {
      const numValue = parseFloat(value);
      const maxQuantity = item.soldQuantity;

      console.log("Updating return quantity:", {
        index,
        numValue,
        maxQuantity,
        salePrice: item.salePrice,
        item,
      });

      if (isNaN(numValue) || numValue < 0) {
        updatedItems[index][field] = 0;
      } else if (numValue > maxQuantity) {
        // Don't allow return quantity to exceed sold quantity
        setModal({
          isOpen: true,
          type: "error",
          title: "Invalid Quantity",
          message: `Return quantity cannot exceed sold quantity (${maxQuantity} ${item.unit})`,
          onConfirm: null,
        });
        updatedItems[index][field] = maxQuantity;
      } else {
        updatedItems[index][field] = numValue;
      }

      // Auto-calculate return price based on original sale price
      updatedItems[index].returnPrice = item.salePrice || 0;

      // Calculate total return amount
      const quantity = updatedItems[index].returnQuantity || 0;
      const price = item.salePrice || 0;
      updatedItems[index].totalReturnAmount = quantity * price;

      console.log("Calculated return amount:", {
        quantity,
        price,
        totalReturnAmount: updatedItems[index].totalReturnAmount,
      });
    } else {
      updatedItems[index][field] = value;
    }

    setReturnForm((prev) => ({ ...prev, items: updatedItems }));
  };

  const submitReturn = async () => {
    const returnItems = returnForm.items.filter(
      (item) => item.returnQuantity > 0,
    );

    if (returnItems.length === 0) {
      setModal({
        isOpen: true,
        type: "error",
        title: "No Items Selected",
        message: "Please add at least one item to return",
        onConfirm: null,
      });
      return;
    }

    if (!returnForm.customerName.trim()) {
      setModal({
        isOpen: true,
        type: "error",
        title: "Customer Required",
        message: "Please enter customer name",
        onConfirm: null,
      });
      return;
    }

    // Check if any return quantity exceeds sold quantity
    const invalidQuantities = returnItems.filter(
      (item) => item.returnQuantity > item.soldQuantity,
    );

    if (invalidQuantities.length > 0) {
      setModal({
        isOpen: true,
        type: "error",
        title: "Invalid Return Quantity",
        message: `Return quantity exceeds sold quantity for: ${invalidQuantities.map((item) => item.medicineName).join(", ")}`,
        onConfirm: null,
      });
      return;
    }

    // Validate and map return items to match PharmacyReturn model schema
    const validatedItems = returnItems.map((item) => ({
      medicineId: item.medicineId,
      medicineName: item.medicineName,
      batchNo: item.batchNo,
      category: item.category,
      quantity: parseFloat(item.returnQuantity) || 0, // Map returnQuantity to quantity
      unit: item.unit,
      returnPrice: parseFloat(item.returnPrice) || 0,
      totalReturnAmount: parseFloat(item.totalReturnAmount) || 0,
      reason: item.reason || "Customer Request", // Ensure reason is provided
      expiryDate: item.expiryDate,
    }));

    // Double-check for any invalid numbers
    const hasInvalidData = validatedItems.some(
      (item) =>
        isNaN(item.quantity) ||
        isNaN(item.returnPrice) ||
        isNaN(item.totalReturnAmount) ||
        item.quantity <= 0,
    );

    if (hasInvalidData) {
      setModal({
        isOpen: true,
        type: "error",
        title: "Invalid Data",
        message:
          "Please ensure all quantities and prices are valid numbers and quantities are greater than 0",
        onConfirm: null,
      });
      return;
    }

    setModal({
      isOpen: true,
      type: "confirm",
      title: "Confirm Return",
      message: `Are you sure you want to process this return?\\n\\nCustomer: ${returnForm.customerName}\\nItems: ${validatedItems.length}\\nTotal Amount: PKR ${validatedItems.reduce((sum, item) => sum + item.totalReturnAmount, 0).toFixed(2)}\\n\\nStock will be restored automatically.`,
      showCancel: true,
      onConfirm: async () => {
        try {
          const returnData = {
            originalSaleId: returnForm.originalSaleId,
            customerName: returnForm.customerName,
            customerContact: returnForm.customerContact,
            refundMethod: returnForm.refundMethod,
            notes: returnForm.notes,
            items: validatedItems,
            processedBy:
              JSON.parse(localStorage.getItem("user") || "{}").username ||
              "System",
          };

          const response =
            await pharmacyHistoryAPI.createCustomerReturn(returnData);

          // Use the actual return data from server response
          const createdReturn = response.data.data;

          setModal({
            isOpen: true,
            type: "success",
            title: "Return Processed",
            message:
              "Customer return created successfully. Stock has been restored. Would you like to print the receipt?",
            onConfirm: () => {
              setReceiptData(createdReturn);
              setShowReceipt(true);
            },
          });
          setShowCreateForm(false);
          setSelectedSale(null);
          setReturnForm({
            originalSaleId: "",
            customerName: "",
            customerContact: "",
            refundMethod: "Cash",
            notes: "",
            items: [],
          });
          fetchReturns();
        } catch (error) {
          console.error("Error creating return:", error);
          setModal({
            isOpen: true,
            type: "error",
            title: "Return Error",
            message: "Error creating return: " + error.message,
            onConfirm: null,
          });
        }
      },
    });
  };

  const updateReturnStatus = async (returnId, status, approvedBy = "") => {
    try {
      await pharmacyHistoryAPI.updateReturnStatus(returnId, {
        refundStatus: status,
        approvedBy,
        notes: `Status updated to ${status}`,
      });
      fetchReturns();
    } catch (error) {
      console.error("Error updating return status:", error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Processed":
        return "bg-green-100 text-green-800";
      case "Pending":
        return "bg-yellow-100 text-yellow-800";
      case "Rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (showCreateForm) {
    return (
      <div className="p-3 bg-gray-50 min-h-screen">
        <div className="max-w-full mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center gap-4 mb-4">
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setSelectedSale(null);
                }}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
              >
                <FiArrowLeft size={20} />
                Back
              </button>
              <h1 className="text-xl font-bold text-gray-900">
                Create Customer Return
              </h1>
            </div>

            {!selectedSale ? (
              <div>
                <h3 className="text-base font-semibold mb-3">
                  Sales History - Select a Sale to Return
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Click on a sale to view items and process return
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="Customer Name"
                    value={filters.customerName}
                    onChange={(e) =>
                      setFilters({ ...filters, customerName: e.target.value })
                    }
                    className="px-2 py-1.5 border border-gray-300 rounded text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Invoice No"
                    value={filters.invoiceNumber}
                    onChange={(e) =>
                      setFilters({ ...filters, invoiceNumber: e.target.value })
                    }
                    className="px-2 py-1.5 border border-gray-300 rounded text-sm"
                  />
                  <button
                    onClick={applyFilters}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  >
                    Search
                  </button>
                  <button
                    onClick={clearFilters}
                    className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
                  >
                    Clear
                  </button>
                </div>

                {loadingSales ? (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    Loading sales...
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 border">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Invoice
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Date
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Customer
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Items
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Amount
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {salesHistory.map((sale) => (
                          <tr key={sale._id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-sm font-medium text-gray-900">
                              {sale.invoiceNumber}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-500">
                              {new Date(sale.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900">
                              <div>{sale.customerName || "Walk-in"}</div>
                              {sale.customerContact && (
                                <div className="text-xs text-gray-500">
                                  {sale.customerContact}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-500">
                              {sale.items?.length || 0} items
                            </td>
                            <td className="px-3 py-2 text-sm font-medium text-gray-900">
                              PKR {sale.totalAmount?.toLocaleString()}
                            </td>
                            <td className="px-3 py-2">
                              <button
                                onClick={() => selectSale(sale)}
                                className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                              >
                                Select
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {pagination.totalPages > 1 && (
                  <div className="px-3 py-2 flex items-center justify-between border-t">
                    <p className="text-xs text-gray-700">
                      Page {pagination.currentPage} of {pagination.totalPages} (
                      {pagination.totalCount} total)
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setPagination((prev) => ({
                            ...prev,
                            currentPage: prev.currentPage - 1,
                          }))
                        }
                        disabled={!pagination.hasPrev}
                        className="px-2 py-1 border rounded text-xs disabled:opacity-50"
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
                        className="px-2 py-1 border rounded text-xs disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded mb-4">
                  <h3 className="font-semibold text-blue-900 mb-1">
                    {selectedSale.invoiceNumber} ·{" "}
                    {selectedSale.customerName || "Walk-in"} · PKR{" "}
                    {selectedSale.totalAmount?.toLocaleString()} ·{" "}
                    {new Date(selectedSale.createdAt).toLocaleDateString()}
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      value={returnForm.customerName}
                      onChange={(e) =>
                        setReturnForm((prev) => ({
                          ...prev,
                          customerName: e.target.value,
                        }))
                      }
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Customer Contact
                    </label>
                    <input
                      type="text"
                      value={returnForm.customerContact}
                      onChange={(e) =>
                        setReturnForm((prev) => ({
                          ...prev,
                          customerContact: e.target.value,
                        }))
                      }
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Refund Method
                  </label>
                  <select
                    value={returnForm.refundMethod}
                    onChange={(e) =>
                      setReturnForm((prev) => ({
                        ...prev,
                        refundMethod: e.target.value,
                      }))
                    }
                    className="w-full md:w-1/2 px-2 py-1.5 border border-gray-300 rounded text-sm"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Credit Note">Credit Note</option>
                    <option value="Store Credit">Store Credit</option>
                  </select>
                </div>

                <div className="mb-4">
                  <h3 className="text-base font-semibold mb-2 flex items-center gap-2">
                    <FiShoppingCart className="text-blue-600" />
                    Items to Return
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 border">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Medicine
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Sold / Price
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Return Qty
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Amount
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Reason
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {returnForm.items.map((item, index) => (
                          <tr
                            key={`${index}-${item.returnQuantity}-${item.totalReturnAmount}`}
                            className={
                              item.returnQuantity > 0 ? "bg-yellow-50" : ""
                            }
                          >
                            <td className="px-3 py-2 text-sm">
                              <div className="font-medium text-gray-900">
                                {item.medicineName}
                              </div>
                              <div className="text-xs text-gray-400">
                                {item.batchNo} · {item.category}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-sm">
                              <div className="text-gray-900">
                                {item.soldQuantity} {item.unit}
                              </div>
                              <div className="text-green-700 font-medium">
                                PKR {(item.salePrice || 0).toLocaleString()}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                max={item.soldQuantity}
                                value={item.returnQuantity || 0}
                                onChange={(e) =>
                                  updateReturnItem(
                                    index,
                                    "returnQuantity",
                                    e.target.value,
                                  )
                                }
                                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                                placeholder="0"
                              />
                              <div className="text-xs text-gray-500 mt-1">
                                Max: {item.soldQuantity}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-sm">
                              <div className="font-bold text-blue-700">
                                PKR {(item.totalReturnAmount || 0).toFixed(2)}
                              </div>
                              {item.returnQuantity > 0 && (
                                <div className="text-xs text-gray-500">
                                  @ PKR {item.salePrice || 0} per {item.unit}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={item.reason || ""}
                                onChange={(e) =>
                                  updateReturnItem(
                                    index,
                                    "reason",
                                    e.target.value,
                                  )
                                }
                                className="w-32 px-2 py-1 border border-gray-300 rounded text-sm"
                                disabled={item.returnQuantity === 0}
                              >
                                <option value="">Select</option>
                                <option value="Defective">Defective</option>
                                <option value="Expired">Expired</option>
                                <option value="Wrong Item">Wrong Item</option>
                                <option value="Customer Request">
                                  Customer Request
                                </option>
                                <option value="Other">Other</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-100">
                        <tr>
                          <td
                            colSpan="3"
                            className="px-3 py-2 text-right text-sm font-bold text-gray-900"
                          >
                            Original Sale Total:
                          </td>
                          <td
                            colSpan="2"
                            className="px-3 py-2 text-sm font-bold text-green-700"
                          >
                            PKR {selectedSale.totalAmount?.toLocaleString()}
                          </td>
                        </tr>
                        <tr>
                          <td
                            colSpan="3"
                            className="px-3 py-2 text-right text-sm font-bold text-gray-900"
                          >
                            Total Return Amount:
                          </td>
                          <td
                            colSpan="2"
                            className="px-3 py-2 text-sm font-bold text-blue-900"
                          >
                            PKR{" "}
                            {returnForm.items
                              .reduce(
                                (sum, item) => sum + item.totalReturnAmount,
                                0,
                              )
                              .toFixed(2)}
                          </td>
                        </tr>
                        <tr>
                          <td
                            colSpan="3"
                            className="px-3 py-2 text-right text-sm font-bold text-gray-900"
                          >
                            Return Percentage:
                          </td>
                          <td
                            colSpan="2"
                            className="px-3 py-2 text-sm font-bold text-orange-600"
                          >
                            {selectedSale.totalAmount > 0
                              ? (
                                  (returnForm.items.reduce(
                                    (sum, item) => sum + item.totalReturnAmount,
                                    0,
                                  ) /
                                    selectedSale.totalAmount) *
                                  100
                                ).toFixed(1)
                              : 0}
                            %
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={returnForm.notes}
                    onChange={(e) =>
                      setReturnForm((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                    rows="2"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                    placeholder="Additional notes..."
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={submitReturn}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                  >
                    Process Return & Restore Stock
                  </button>
                  <button
                    onClick={() => setSelectedSale(null)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 text-sm"
                  >
                    Change Sale
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <Modal
          isOpen={modal.isOpen}
          onClose={() => setModal({ ...modal, isOpen: false })}
          title={modal.title}
          message={modal.message}
          type={modal.type}
          onConfirm={modal.onConfirm}
          showCancel={modal.type === "confirm" || modal.type === "success"}
          confirmText={
            modal.type === "confirm"
              ? "Yes, Process Return"
              : modal.type === "success"
                ? "Print Receipt"
                : "OK"
          }
          cancelText={modal.type === "success" ? "Skip" : "Cancel"}
        />
      </div>
    );
  }

  return (
    <>
      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal({ ...modal, isOpen: false })}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        onConfirm={modal.onConfirm}
        showCancel={modal.type === "confirm" || modal.type === "success"}
        confirmText={
          modal.type === "confirm"
            ? "Yes, Process Return"
            : modal.type === "success"
              ? "Print Receipt"
              : "OK"
        }
        cancelText={modal.type === "success" ? "Skip" : "Cancel"}
      />
      <div className="p-3 bg-gray-50 min-h-screen">
        <div className="max-w-full mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-4 mb-3">
            <div className="flex justify-between items-center mb-3">
              <h1 className="text-xl font-bold text-gray-900">
                Customer Returns
              </h1>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowReturnHistory(!showReturnHistory)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
                >
                  <FiEye size={14} />
                  {showReturnHistory ? "Hide" : "View"} History
                </button>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                >
                  <FiPlus size={14} />
                  New Return
                </button>
                <button
                  onClick={fetchReturns}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                >
                  <FiRefreshCw size={14} />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {showReturnHistory && (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              {/* Return History Filters */}
              <div className="p-4 border-b bg-gray-50">
                <h3 className="text-sm font-semibold mb-3">Filter Returns</h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <input
                    type="date"
                    placeholder="Start Date"
                    value={returnFilters.startDate}
                    onChange={(e) =>
                      setReturnFilters({
                        ...returnFilters,
                        startDate: e.target.value,
                      })
                    }
                    className="px-2 py-1.5 border border-gray-300 rounded text-sm"
                  />
                  <input
                    type="date"
                    placeholder="End Date"
                    value={returnFilters.endDate}
                    onChange={(e) =>
                      setReturnFilters({
                        ...returnFilters,
                        endDate: e.target.value,
                      })
                    }
                    className="px-2 py-1.5 border border-gray-300 rounded text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Customer Name"
                    value={returnFilters.customerName}
                    onChange={(e) =>
                      setReturnFilters({
                        ...returnFilters,
                        customerName: e.target.value,
                      })
                    }
                    className="px-2 py-1.5 border border-gray-300 rounded text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Return Number"
                    value={returnFilters.returnNumber}
                    onChange={(e) =>
                      setReturnFilters({
                        ...returnFilters,
                        returnNumber: e.target.value,
                      })
                    }
                    className="px-2 py-1.5 border border-gray-300 rounded text-sm"
                  />
                  <select
                    value={returnFilters.status}
                    onChange={(e) =>
                      setReturnFilters({
                        ...returnFilters,
                        status: e.target.value,
                      })
                    }
                    className="px-2 py-1.5 border border-gray-300 rounded text-sm"
                  >
                    <option value="">All Status</option>
                    <option value="Pending">Pending</option>
                    <option value="Processed">Processed</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={applyReturnFilters}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  >
                    Apply Filters
                  </button>
                  <button
                    onClick={clearReturnFilters}
                    className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Return Details
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Customer Info
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Amount
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td
                          colSpan="5"
                          className="px-3 py-3 text-center text-gray-500 text-sm"
                        >
                          Loading returns...
                        </td>
                      </tr>
                    ) : returns.length === 0 ? (
                      <tr>
                        <td
                          colSpan="5"
                          className="px-3 py-3 text-center text-gray-500 text-sm"
                        >
                          No customer returns found
                        </td>
                      </tr>
                    ) : (
                      returns.map((returnItem) => (
                        <tr key={returnItem._id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {returnItem.returnNumber}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(
                                returnItem.returnDate,
                              ).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-gray-400">
                              {returnItem.items?.length || 0} items
                            </div>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {returnItem.customerName}
                            </div>
                            {returnItem.customerContact && (
                              <div className="text-xs text-gray-500">
                                {returnItem.customerContact}
                              </div>
                            )}
                            {returnItem.originalInvoiceNumber && (
                              <div className="text-xs text-blue-600">
                                Invoice: {returnItem.originalInvoiceNumber}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              PKR{" "}
                              {returnItem.totalReturnAmount?.toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-500">
                              {returnItem.refundMethod}
                            </div>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(returnItem.refundStatus)}`}
                            >
                              {returnItem.refundStatus}
                            </span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm font-medium">
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setReceiptData(returnItem);
                                  setShowReceipt(true);
                                }}
                                className="text-blue-600 hover:text-blue-900"
                                title="Print Receipt"
                              >
                                <FiPrinter size={16} />
                              </button>
                              {returnItem.refundStatus === "Pending" && (
                                <>
                                  <button
                                    onClick={() =>
                                      updateReturnStatus(
                                        returnItem._id,
                                        "Processed",
                                        "Admin",
                                      )
                                    }
                                    className="text-green-600 hover:text-green-900"
                                    title="Approve"
                                  >
                                    <FiCheck size={16} />
                                  </button>
                                  <button
                                    onClick={() =>
                                      updateReturnStatus(
                                        returnItem._id,
                                        "Rejected",
                                        "Admin",
                                      )
                                    }
                                    className="text-red-600 hover:text-red-900"
                                    title="Reject"
                                  >
                                    <FiX size={16} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!showReturnHistory && (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <FiShoppingCart
                size={48}
                className="mx-auto text-gray-400 mb-4"
              />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                Customer Returns Management
              </h3>
              <p className="text-gray-600 mb-6">
                Click "New Return" to process a return for items sold to
                customers. Stock will be automatically restored.
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <FiPlus size={20} />
                Create New Return
              </button>
            </div>
          )}
        </div>
      </div>

      {showReceipt && receiptData && (
        <CustomerReturnReceipt
          returnData={receiptData}
          hospitalSettings={hospitalSettings}
          onClose={() => {
            setShowReceipt(false);
            setReceiptData(null);
          }}
        />
      )}
    </>
  );
}
