import React, { useState, useEffect } from "react";
import {
  FiSearch,
  FiPlus,
  FiEye,
  FiRefreshCw,
  FiArrowLeft,
  FiCheck,
  FiX,
  FiPackage,
  FiPrinter,
} from "react-icons/fi";
import { pharmacyHistoryAPI } from "../../services/api";
import Modal from "../../components/Modal";
import SupplierReturnReceipt from "../../components/pharmacy/SupplierReturnReceipt";

export default function SupplierReturns() {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showReturnHistory, setShowReturnHistory] = useState(false);
  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [returnForm, setReturnForm] = useState({
    supplierName: "",
    supplierContact: "",
    refundMethod: "Credit Note",
    notes: "",
    items: [],
    originalPurchaseId: "",
  });

  const [purchaseFilters, setPurchaseFilters] = useState({
    startDate: "",
    endDate: "",
    supplierName: "",
    invoiceNumber: "",
  });

  const [returnFilters, setReturnFilters] = useState({
    startDate: "",
    endDate: "",
    supplierName: "",
    returnNumber: "",
    status: "",
  });

  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [hospitalSettings, setHospitalSettings] = useState({
    hospitalName: "Pet Hospital & Pharmacy",
    address: "123 Main Street, City",
    phone: "+92-XXX-XXXXXXX",
  });

  // Modal states
  const [modal, setModal] = useState({
    isOpen: false,
    type: "info",
    title: "",
    message: "",
    onConfirm: null,
  });

  useEffect(() => {
    fetchReturns();
  }, []);

  const fetchReturns = async () => {
    try {
      setLoading(true);
      const params = {
        returnType: "Supplier Return",
      };

      if (returnFilters.startDate) params.startDate = returnFilters.startDate;
      if (returnFilters.endDate) params.endDate = returnFilters.endDate;
      if (returnFilters.supplierName)
        params.supplierName = returnFilters.supplierName;
      if (returnFilters.returnNumber)
        params.returnNumber = returnFilters.returnNumber;
      if (returnFilters.status) params.status = returnFilters.status;

      const response = await pharmacyHistoryAPI.getReturns(params);
      setReturns(response.data.returns);
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
      supplierName: "",
      returnNumber: "",
      status: "",
    });
    setTimeout(() => {
      fetchReturns();
    }, 0);
  };

  const applyPurchaseFilters = () => {
    searchPurchases();
  };

  const clearPurchaseFilters = () => {
    setPurchaseFilters({
      startDate: "",
      endDate: "",
      supplierName: "",
      invoiceNumber: "",
    });
    setPurchaseHistory([]);
  };

  const searchPurchases = async () => {
    try {
      setLoadingPurchases(true);
      const params = {};

      if (purchaseFilters.startDate)
        params.startDate = purchaseFilters.startDate;
      if (purchaseFilters.endDate) params.endDate = purchaseFilters.endDate;
      if (purchaseFilters.supplierName)
        params.supplierName = purchaseFilters.supplierName;
      if (purchaseFilters.invoiceNumber)
        params.invoiceNumber = purchaseFilters.invoiceNumber;

      // If no filters and no search query, show message
      if (
        !searchQuery.trim() &&
        !purchaseFilters.startDate &&
        !purchaseFilters.endDate &&
        !purchaseFilters.supplierName &&
        !purchaseFilters.invoiceNumber
      ) {
        setModal({
          isOpen: true,
          type: "error",
          title: "Search Required",
          message: "Please enter search criteria or use filters",
          onConfirm: null,
        });
        return;
      }

      const response = await pharmacyHistoryAPI.getPurchaseHistory(params);
      let filteredPurchases = response.data.purchases;

      // Apply text search if query exists
      if (searchQuery.trim()) {
        filteredPurchases = filteredPurchases.filter(
          (purchase) =>
            purchase.supplierName
              .toLowerCase()
              .includes(searchQuery.toLowerCase()) ||
            purchase.invoiceNo
              .toLowerCase()
              .includes(searchQuery.toLowerCase()) ||
            purchase.purchaseOrderNo
              .toLowerCase()
              .includes(searchQuery.toLowerCase()),
        );
      }

      setPurchaseHistory(filteredPurchases);
    } catch (error) {
      console.error("Error searching purchases:", error);
      setModal({
        isOpen: true,
        type: "error",
        title: "Search Error",
        message: "Error searching purchases: " + error.message,
        onConfirm: null,
      });
    } finally {
      setLoadingPurchases(false);
    }
  };

  const selectPurchase = async (purchase) => {
    try {
      // Fetch detailed purchase information
      const response = await pharmacyHistoryAPI.getPurchaseDetails(
        purchase._id,
      );
      const detailedPurchase = response.data.purchase;

      setSelectedPurchase(detailedPurchase);
      setReturnForm((prev) => ({
        ...prev,
        originalPurchaseId: detailedPurchase._id,
        supplierName: detailedPurchase.supplierName,
        supplierContact: detailedPurchase.supplierContact || "",
        items: detailedPurchase.items.map((item) => ({
          medicineId: item.medicineId || null,
          medicineName: item.medicineName,
          batchNo: item.batchNo,
          category: item.category,
          unit: item.unit,
          purchasedQuantity: item.quantity,
          purchasePrice: item.purchasePrice,
          returnQuantity: 0,
          returnPrice: item.purchasePrice,
          totalReturnAmount: 0,
          reason: "",
          expiryDate: item.expiryDate,
        })),
      }));
      setPurchaseHistory([]);
      setSearchQuery("");
    } catch (error) {
      console.error("Error fetching purchase details:", error);
      setModal({
        isOpen: true,
        type: "error",
        title: "Error",
        message: "Error loading purchase details: " + error.message,
        onConfirm: null,
      });
    }
  };

  const updateReturnItem = (index, field, value) => {
    const updatedItems = [...returnForm.items];
    updatedItems[index][field] = value;

    if (field === "returnQuantity" || field === "returnPrice") {
      updatedItems[index].totalReturnAmount =
        (updatedItems[index].returnQuantity || 0) *
        (updatedItems[index].returnPrice || 0);
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

    if (!returnForm.supplierName.trim()) {
      setModal({
        isOpen: true,
        type: "error",
        title: "Supplier Required",
        message: "Please enter supplier name",
        onConfirm: null,
      });
      return;
    }

    // Show confirmation modal
    setModal({
      isOpen: true,
      type: "confirm",
      title: "Confirm Return",
      message: `Are you sure you want to process this return?\n\nSupplier: ${returnForm.supplierName}\nItems: ${returnItems.length}\nTotal Amount: PKR ${returnItems.reduce((sum, item) => sum + item.totalReturnAmount, 0).toFixed(2)}\n\nStock will be adjusted automatically.`,
      showCancel: true,
      onConfirm: async () => {
        try {
          const returnData = {
            supplierName: returnForm.supplierName,
            supplierContact: returnForm.supplierContact,
            refundMethod: returnForm.refundMethod,
            notes: returnForm.notes,
            items: returnItems,
            originalPurchaseId: returnForm.originalPurchaseId || undefined,
            originalPurchaseOrderNo:
              selectedPurchase?.purchaseOrderNo || undefined,
            processedBy:
              JSON.parse(localStorage.getItem("user") || "{}").username ||
              "System",
          };

          await pharmacyHistoryAPI.createSupplierReturn(returnData);

          // Get the created return for receipt
          const createdReturn = {
            ...returnData,
            returnNumber: `SR-${Date.now()}`, // This should come from server response
            returnDate: new Date(),
            totalReturnAmount: returnItems.reduce(
              (sum, item) => sum + item.totalReturnAmount,
              0,
            ),
            refundStatus: "Processed",
            items: returnItems,
          };

          setModal({
            isOpen: true,
            type: "success",
            title: "Return Processed",
            message:
              "Supplier return created successfully. Stock has been adjusted. Would you like to print the receipt?",
            onConfirm: () => {
              setReceiptData(createdReturn);
              setShowReceipt(true);
            },
          });
          setShowCreateForm(false);
          setSelectedPurchase(null);
          setReturnForm({
            supplierName: "",
            supplierContact: "",
            refundMethod: "Credit Note",
            notes: "",
            items: [],
            originalPurchaseId: "",
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
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setSelectedPurchase(null);
                  setPurchaseHistory([]);
                }}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
              >
                <FiArrowLeft size={20} />
                Back to Returns
              </button>
              <h1 className="text-2xl font-bold text-gray-900">
                Create Supplier Return
              </h1>
            </div>

            {!selectedPurchase ? (
              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Search Purchase History
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Use filters or search to find the original purchase
                </p>

                {/* Purchase Filters */}
                <div className="bg-gray-50 p-4 rounded-lg mb-4">
                  <h4 className="font-semibold mb-3 text-sm">
                    Filter Purchases
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                    <input
                      type="date"
                      placeholder="Start Date"
                      value={purchaseFilters.startDate}
                      onChange={(e) =>
                        setPurchaseFilters({
                          ...purchaseFilters,
                          startDate: e.target.value,
                        })
                      }
                      className="px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                    <input
                      type="date"
                      placeholder="End Date"
                      value={purchaseFilters.endDate}
                      onChange={(e) =>
                        setPurchaseFilters({
                          ...purchaseFilters,
                          endDate: e.target.value,
                        })
                      }
                      className="px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Supplier Name"
                      value={purchaseFilters.supplierName}
                      onChange={(e) =>
                        setPurchaseFilters({
                          ...purchaseFilters,
                          supplierName: e.target.value,
                        })
                      }
                      className="px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Invoice Number"
                      value={purchaseFilters.invoiceNumber}
                      onChange={(e) =>
                        setPurchaseFilters({
                          ...purchaseFilters,
                          invoiceNumber: e.target.value,
                        })
                      }
                      className="px-3 py-2 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={applyPurchaseFilters}
                      disabled={loadingPurchases}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 text-sm"
                    >
                      Apply Filters
                    </button>
                    <button
                      onClick={clearPurchaseFilters}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Text Search */}
                <div className="flex gap-4 mb-4">
                  <input
                    type="text"
                    placeholder="Or search by supplier name, invoice no, or PO number"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && searchPurchases()}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={searchPurchases}
                    disabled={loadingPurchases}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
                  >
                    <FiSearch size={16} />
                    {loadingPurchases ? "Searching..." : "Search"}
                  </button>
                </div>

                {purchaseHistory.length > 0 && (
                  <div className="overflow-x-auto">
                    <h4 className="font-semibold mb-3">
                      Purchase History - Select a purchase to create return
                    </h4>
                    <table className="min-w-full divide-y divide-gray-200 border">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            PO Number
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Supplier
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Invoice No
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Items
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Amount
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {purchaseHistory.map((purchase) => (
                          <tr key={purchase._id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                              {purchase.purchaseOrderNo}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {new Date(
                                purchase.purchaseDate,
                              ).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              <div>{purchase.supplierName}</div>
                              {purchase.supplierContact && (
                                <div className="text-xs text-gray-500">
                                  {purchase.supplierContact}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {purchase.invoiceNo}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {purchase.items?.length || 0} items
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              PKR {purchase.totalAmount?.toLocaleString()}
                            </td>
                            <td className="px-6 py-4">
                              <button
                                onClick={() => selectPurchase(purchase)}
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
              </div>
            ) : (
              <div>
                <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded mb-4">
                  <h3 className="font-semibold text-blue-900">
                    {selectedPurchase.purchaseOrderNo} ·{" "}
                    {selectedPurchase.supplierName} · PKR{" "}
                    {selectedPurchase.totalAmount?.toLocaleString()} ·{" "}
                    {new Date(
                      selectedPurchase.purchaseDate,
                    ).toLocaleDateString()}
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Supplier Name *
                    </label>
                    <input
                      type="text"
                      value={returnForm.supplierName}
                      onChange={(e) =>
                        setReturnForm((prev) => ({
                          ...prev,
                          supplierName: e.target.value,
                        }))
                      }
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Supplier Contact
                    </label>
                    <input
                      type="text"
                      value={returnForm.supplierContact}
                      onChange={(e) =>
                        setReturnForm((prev) => ({
                          ...prev,
                          supplierContact: e.target.value,
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
                    <option value="Credit Note">Credit Note</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Store Credit">Store Credit</option>
                  </select>
                </div>

                <div className="mb-4">
                  <h3 className="text-base font-semibold mb-2 flex items-center gap-2">
                    <FiPackage className="text-blue-600" />
                    Items to Return
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 border">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Medicine
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Purchased / Price
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Return Qty
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Return Price
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Total
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Reason
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {returnForm.items.map((item, index) => (
                          <tr
                            key={index}
                            className={
                              item.returnQuantity > 0 ? "bg-yellow-50" : ""
                            }
                          >
                            <td className="px-4 py-3 text-sm">
                              <div className="font-medium text-gray-900">
                                {item.medicineName}
                              </div>
                              <div className="text-xs text-gray-400">
                                {item.batchNo} · {item.category}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <div className="text-gray-900">
                                {item.purchasedQuantity} {item.unit}
                              </div>
                              <div className="text-green-700 font-medium">
                                PKR {item.purchasePrice?.toLocaleString()}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min="0"
                                max={item.purchasedQuantity}
                                value={item.returnQuantity}
                                onChange={(e) =>
                                  updateReturnItem(
                                    index,
                                    "returnQuantity",
                                    parseFloat(e.target.value) || 0,
                                  )
                                }
                                className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                                placeholder="0"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.returnPrice}
                                onChange={(e) =>
                                  updateReturnItem(
                                    index,
                                    "returnPrice",
                                    parseFloat(e.target.value) || 0,
                                  )
                                }
                                className="w-28 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <div className="font-bold text-blue-700">
                                PKR {item.totalReturnAmount?.toFixed(2)}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={item.reason}
                                onChange={(e) =>
                                  updateReturnItem(
                                    index,
                                    "reason",
                                    e.target.value,
                                  )
                                }
                                className="w-36 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                                disabled={item.returnQuantity === 0}
                              >
                                <option value="">Select reason</option>
                                <option value="Defective">Defective</option>
                                <option value="Expired">Expired</option>
                                <option value="Damaged">Damaged</option>
                                <option value="Wrong Item">Wrong Item</option>
                                <option value="Excess Stock">
                                  Excess Stock
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
                            colSpan="5"
                            className="px-4 py-3 text-right text-sm font-bold text-gray-900"
                          >
                            Total Return Amount:
                          </td>
                          <td
                            colSpan="2"
                            className="px-4 py-3 text-sm font-bold text-blue-900"
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
                    Process Return & Adjust Stock
                  </button>
                  <button
                    onClick={() => {
                      setSelectedPurchase(null);
                      setPurchaseHistory([]);
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 text-sm"
                  >
                    Change Purchase
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
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
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-2xl font-bold text-gray-900">
                Supplier Returns
              </h1>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowReturnHistory(!showReturnHistory)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  <FiEye size={16} />
                  {showReturnHistory ? "Hide" : "View"} Return History
                </button>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <FiPlus size={16} />
                  New Return
                </button>
                <button
                  onClick={fetchReturns}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  <FiRefreshCw size={16} />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            {!showReturnHistory ? (
              <div className="p-8 text-center">
                <FiPackage size={48} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  Supplier Returns Management
                </h3>
                <p className="text-gray-600 mb-6">
                  Click "New Return" to create a return for items purchased from
                  suppliers. You can search purchase history and select items to
                  return with their quantities and prices.
                </p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <FiPlus size={20} />
                  Create New Return
                </button>
              </div>
            ) : (
              <>
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
                      placeholder="Supplier Name"
                      value={returnFilters.supplierName}
                      onChange={(e) =>
                        setReturnFilters({
                          ...returnFilters,
                          supplierName: e.target.value,
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
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Return Details
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Supplier Info
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {loading ? (
                        <tr>
                          <td
                            colSpan="5"
                            className="px-6 py-4 text-center text-gray-500"
                          >
                            Loading returns...
                          </td>
                        </tr>
                      ) : returns.length === 0 ? (
                        <tr>
                          <td
                            colSpan="5"
                            className="px-6 py-4 text-center text-gray-500"
                          >
                            No supplier returns found
                          </td>
                        </tr>
                      ) : (
                        returns.map((returnItem) => (
                          <tr key={returnItem._id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {returnItem.returnNumber}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {new Date(
                                    returnItem.returnDate,
                                  ).toLocaleDateString()}
                                </div>
                                <div className="text-xs text-gray-400">
                                  {returnItem.items?.length || 0} items
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {returnItem.supplierName}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {returnItem.supplierContact}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                PKR{" "}
                                {returnItem.totalReturnAmount?.toLocaleString()}
                              </div>
                              <div className="text-xs text-gray-500">
                                {returnItem.refundMethod}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(returnItem.refundStatus)}`}
                              >
                                {returnItem.refundStatus}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
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
              </>
            )}
          </div>
        </div>
      </div>

      {showReceipt && receiptData && (
        <SupplierReturnReceipt
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
