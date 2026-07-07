import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiFilter,
  FiDownload,
  FiRefreshCw,
  FiX,
  FiCornerUpLeft,
  FiPrinter,
  FiClock,
} from "react-icons/fi";
import {
  petshopPharmacyHistoryAPI,
  settingsAPI,
  petshopPharmacyMedicinesAPI,
} from "../../services/api";
import DateRangePicker from "../../components/DateRangePicker";
import Modal from "../../components/Modal";

export default function SalesReturn() {
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
  const [modal, setModal] = useState({
    isOpen: false,
    type: "info",
    title: "",
    message: "",
    onConfirm: null,
  });
  const [hospitalSettings, setHospitalSettings] = useState(null);

  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnSale, setReturnSale] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [returnReason, setReturnReason] = useState("");
  const [refundMethod, setRefundMethod] = useState("Cash");
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnToast, setReturnToast] = useState("");

  const [showSlip, setShowSlip] = useState(false);
  const [slipData, setSlipData] = useState(null);

  const shopUser = JSON.parse(localStorage.getItem("shop_auth") || "{}");
  const loggedInUser = shopUser.name || shopUser.username
    ? `${shopUser.name || shopUser.username}${shopUser.role ? `-${shopUser.role}` : ""}`
    : "—";

  const navigate = useNavigate();

  useEffect(() => {
    settingsAPI
      .get(JSON.parse(localStorage.getItem("user") || "{}").username || "admin")
      .then((r) => setHospitalSettings(r.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (
      !filters.startDate &&
      !filters.endDate &&
      !filters.customerName &&
      !filters.customerContact &&
      !filters.invoiceNumber &&
      !filters.paymentMethod &&
      !filters.status
    ) {
      fetchSales();
    }
  }, [pagination.currentPage]);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const params = { ...filters, page: pagination.currentPage, limit: 20 };
      Object.keys(params).forEach((k) => {
        if (!params[k]) delete params[k];
      });
      const res = await petshopPharmacyHistoryAPI.getSalesHistory(params);
      setSales(res.data.sales);
      setPagination(res.data.pagination);
      setSummary(res.data.summary);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) =>
    setFilters((p) => ({ ...p, [field]: value }));
  const handleDateRangeChange = (dr) =>
    setFilters((p) => ({ ...p, startDate: dr.fromDate, endDate: dr.toDate }));
  const applyFilters = () => {
    setPagination((p) => ({ ...p, currentPage: 1 }));
    setTimeout(fetchSales, 0);
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
    setPagination((p) => ({ ...p, currentPage: 1 }));
    setTimeout(fetchSales, 0);
  };

  const showToast = (msg) => {
    setReturnToast(msg);
    setTimeout(() => setReturnToast(""), 3500);
  };

  const openReturn = (sale) => {
    setReturnSale(sale);
    setReturnItems(
      (sale.items || []).map((item) => ({
        medicineId: item.medicineId,
        medicineName: item.medicineName,
        batchNo: item.batchNo || "",
        sellBy: item.sellBy || "unit",
        originalQty: Number(item.quantity) || 0,
        returnQty: 0,
        pricePerUnit: Number(item.pricePerUnit) || 0,
        totalPrice: Number(item.totalPrice) || 0,
        unit: item.unit || "Unit",
        category: item.category || "Medicine",
      })),
    );
    setReturnReason("");
    setRefundMethod("Cash");
    setShowReturnModal(true);
  };

  const updateReturnQty = (idx, val) => {
    const qty = Math.max(
      0,
      Math.min(Number(val) || 0, returnItems[idx].originalQty),
    );
    setReturnItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, returnQty: qty } : it)),
    );
  };

  const returnTotal = returnItems.reduce((s, it) => {
    const unitPrice =
      it.originalQty > 0 ? it.totalPrice / it.originalQty : it.pricePerUnit;
    return s + unitPrice * it.returnQty;
  }, 0);

  const handleSubmitReturn = async () => {
    const itemsToReturn = returnItems.filter((it) => it.returnQty > 0);
    if (itemsToReturn.length === 0)
      return showToast("Select at least one item to return");
    try {
      setReturnLoading(true);
      const res = await petshopPharmacyHistoryAPI.createCustomerReturn({
        originalSaleId: returnSale._id,
        invoiceNumber: returnSale.invoiceNumber,
        customerName: returnSale.customerName || "Walk-in Customer",
        customerContact: returnSale.customerContact || "",
        refundMethod: refundMethod === "Card" ? "Cash" : refundMethod,
        notes: returnReason,
        items: itemsToReturn.map((it) => {
          const unitPrice =
            it.originalQty > 0 ? it.totalPrice / it.originalQty : it.pricePerUnit;
          const returnAmt = unitPrice * it.returnQty;
          return {
            medicineId: it.medicineId,
            medicineName: it.medicineName,
            batchNo: it.batchNo || "N/A",
            category: it.category || "Medicine",
            quantity: it.returnQty,
            unit: it.unit || "Unit",
            sellBy: it.sellBy,
            returnPrice: unitPrice,
            totalReturnAmount: returnAmt,
            reason: returnReason || "Customer return",
          };
        }),
        totalReturnAmount: returnTotal,
      });

      for (const item of itemsToReturn) {
        try {
          const medicineRes = await petshopPharmacyMedicinesAPI.getById(
            item.medicineId,
          );
          const currentMedicine = medicineRes.data;

          if (currentMedicine) {
            // The sale route decreases medicine.quantity, so returns must
            // increase the SAME field. Previously this updated qtyPacks which
            // is a separate field and left quantity unchanged — so returned
            // stock never actually came back into inventory.
            const currentQty = Number(currentMedicine.quantity) || 0;
            const restoredQty = currentQty + Number(item.returnQty || 0);

            // Also keep qtyPacks in sync when the item is sold by packs so
            // pack-based views stay consistent.
            const update = { quantity: restoredQty };
            if (item.sellBy?.toLowerCase() === "pack") {
              const unitsPerPack = Number(currentMedicine.unitsPerPack) || 1;
              update.qtyPacks = Math.floor(restoredQty / unitsPerPack);
            }

            await petshopPharmacyMedicinesAPI.update(item.medicineId, update);
          }
        } catch (inventoryError) {
          console.error(
            `Failed to update inventory for ${item.medicineName}:`,
            inventoryError,
          );
          showToast(`Warning: Inventory not updated for ${item.medicineName}`);
        }
      }

      setSlipData({
        returnNumber: res?.data?.returnNumber || "RTN-" + Date.now(),
        date: new Date().toLocaleString(),
        customerName: returnSale.customerName || "Walk-in Customer",
        invoiceNumber: returnSale.invoiceNumber,
        refundMethod: refundMethod === "Card" ? "Cash" : refundMethod,
        items: itemsToReturn.map((it) => {
          const unitPrice =
            it.originalQty > 0 ? it.totalPrice / it.originalQty : it.pricePerUnit;
          return {
            medicineName: it.medicineName,
            sellBy: it.sellBy,
            returnQty: it.returnQty,
            returnAmt: unitPrice * it.returnQty,
          };
        }),
        totalReturnAmount: returnTotal,
      });
      setShowReturnModal(false);
      setShowSlip(true);
      fetchSales();
      showToast(
        `Return processed successfully! Inventory updated for ${itemsToReturn.length} item(s).`,
      );
    } catch (err) {
      showToast(err.message || "Error processing return");
    } finally {
      setReturnLoading(false);
    }
  };

  const printReturnSlip = (slip) => {
    const w = window.open(
      "",
      "_blank",
      "width=400,height=600,left=100,top=50,toolbar=0,menubar=0,scrollbars=1",
    );
    const fmt = (n) => Number(n || 0).toFixed(2);
    const shopName = hospitalSettings?.companyName || "SHOP";
    const itemRows = (slip.items || [])
      .map((it) => {
        const sellBy = it.sellBy || "Loose";
        const typeLabel = sellBy.toLowerCase() === "pack" ? "Pack" : "Loose";
        return `
      <tr>
        <td style="padding:4px 0;">${it.medicineName}</td>
        <td style="text-align:center;padding:4px 4px;">${typeLabel}</td>
        <td style="text-align:center;padding:4px 8px;">${it.returnQty}</td>
        <td style="text-align:right;padding:4px 0;">${fmt(it.returnAmt)}</td>
      </tr>`;
      })
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
  <div class="center bold" style="font-size:13px;">Customer Return</div>
  <div class="dashed"></div>
  <div style="font-size:11px;line-height:1.6;">
    <div>Date : ${slip.date}</div>
    <div>Party : ${slip.customerName}</div>
    <div>Bill No : ${slip.invoiceNumber}</div>
    ${slip.refundMethod ? `<div>Refund : ${slip.refundMethod}</div>` : ""}
  </div>
  <div class="dashed"></div>
  <table>
    <thead>
      <tr>
        <th style="text-align:left;padding-bottom:3px;border-bottom:1px dashed #000;">Item</th>
        <th style="text-align:center;padding-bottom:3px;border-bottom:1px dashed #000;width:35px;">Type</th>
        <th style="text-align:center;padding-bottom:3px;border-bottom:1px dashed #000;width:30px;">Qty</th>
        <th style="text-align:right;padding-bottom:3px;border-bottom:1px dashed #000;width:55px;">Amt</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="2">TOTAL RETURN</td>
        <td class="right">Rs ${fmt(slip.totalReturnAmount)}</td>
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
    if (!sales.length) return;
    const rows = sales.map((s) => ({
      Invoice: s.invoiceNumber,
      Date: new Date(s.createdAt).toLocaleDateString(),
      Customer: s.customerName || "Walk-in",
      Contact: s.customerContact || "",
      Total: s.totalAmount,
      Payment: s.paymentMethod,
    }));
    const csv = [
      Object.keys(rows[0]).join(","),
      ...rows.map((r) => Object.values(r).join(",")),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `sales-return-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div className="p-3 bg-gray-50 min-h-screen">
      {returnToast && (
        <div className="fixed top-6 right-6 z-[9999] bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-xl shadow-2xl font-semibold text-sm">
          {returnToast}
        </div>
      )}

      <div className="max-w-full mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-4 mb-3">
          <div className="flex justify-between items-center mb-3">
            <h1 className="text-xl font-bold text-gray-900">Sales Return</h1>
            <div className="flex gap-2">
              <button
                onClick={() => navigate("/shop/return-history")}
                className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
              >
                <FiClock size={14} /> Return History
              </button>
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
              >
                <FiDownload size={14} /> Export CSV
              </button>
              <button
                onClick={fetchSales}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                <FiRefreshCw size={14} /> Refresh
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
            {[
              {
                label: "Total Sales",
                value: summary.totalSales,
                color: "blue",
              },
              {
                label: "Total Revenue",
                value: `PKR ${summary.totalRevenue?.toLocaleString()}`,
                color: "green",
              },
              {
                label: "Total Discount",
                value: `PKR ${summary.totalDiscount?.toLocaleString()}`,
                color: "orange",
              },
              {
                label: "Avg Sale Amount",
                value: `PKR ${summary.avgSaleAmount?.toFixed(0)}`,
                color: "purple",
              },
            ].map(({ label, value, color }) => (
              <div key={label} className={`bg-${color}-50 p-3 rounded`}>
                <div className={`text-xs text-${color}-600 font-medium`}>
                  {label}
                </div>
                <div className={`text-xl font-bold text-${color}-900`}>
                  {value}
                </div>
              </div>
            ))}
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
              {[
                { ph: "Customer Name", field: "customerName" },
                { ph: "Contact Number", field: "customerContact" },
                { ph: "Invoice Number", field: "invoiceNumber" },
              ].map(({ ph, field }) => (
                <input
                  key={field}
                  type="text"
                  placeholder={ph}
                  value={filters[field]}
                  onChange={(e) => handleFilterChange(field, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              ))}
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
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Credit">Credit</option>
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
                    "Invoice Details",
                    "Customer Info",
                    "Medicines",
                    "Qty (each)",
                    "Qty",
                    "Amount",
                    "Payment",
                    "Sold By",
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
                      colSpan="9"
                      className="px-4 py-3 text-center text-gray-500 text-sm"
                    >
                      Loading sales...
                    </td>
                  </tr>
                ) : sales.length === 0 ? (
                  <tr>
                    <td
                      colSpan="9"
                      className="px-4 py-3 text-center text-gray-500 text-sm"
                    >
                      No sales found
                    </td>
                  </tr>
                ) : (
                  sales.map((sale) => (
                    <tr key={sale._id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {sale.invoiceNumber}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(sale.createdAt).toLocaleDateString()} {" "}
                          {new Date(sale.createdAt).toLocaleTimeString()}
                        </div>
                        <div className="text-xs text-gray-400">
                          {sale.items?.length || 0} items
                        </div>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {sale.customerName || "Walk-in Customer"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {sale.customerContact}
                        </div>
                      </td>
                      <td className="px-4 py-2 max-w-[160px]">
                        <div className="text-xs text-gray-800 leading-relaxed">
                          {(sale.items || []).map((i) => i.medicineName).join(", ")}
                        </div>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <div className="text-xs text-gray-600">
                          {(sale.items || []).map((i) => i.quantity).join(", ")}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-center whitespace-nowrap">
                        <span className="text-sm font-bold text-gray-800">
                          {(sale.items || []).reduce(
                            (s, i) => s + (Number(i.quantity) || 0),
                            0,
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900">
                          PKR {Number(sale.totalAmount || 0).toFixed(2)}
                        </div>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {sale.paymentMethod}
                        </span>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2 py-1 rounded-full">
                          {sale.soldBy || loggedInUser}
                        </span>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <button
                          onClick={() => openReturn(sale)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg text-xs font-semibold transition-all shadow active:scale-95"
                        >
                          <FiCornerUpLeft size={13} /> Select
                        </button>
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

      {showReturnModal && returnSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="text-white">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <FiCornerUpLeft className="w-5 h-5" /> Process Return
                </h3>
                <p className="text-xs text-orange-100 mt-0.5">
                  {returnSale.invoiceNumber} · {returnSale.customerName || "Walk-in"} ·{" "}
                  {new Date(returnSale.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => setShowReturnModal(false)}
                className="text-white hover:bg-white/20 p-1.5 rounded-lg transition-all"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-slate-50 rounded-lg px-3 py-2">
                  <p className="text-xs text-slate-500">Invoice</p>
                  <p className="font-bold text-slate-800 font-mono">
                    {returnSale.invoiceNumber}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-lg px-3 py-2">
                  <p className="text-xs text-slate-500">Total Amount</p>
                  <p className="font-bold text-slate-800">
                    PKR {Number(returnSale.totalAmount || 0).toFixed(2)}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-lg px-3 py-2">
                  <p className="text-xs text-slate-500">Payment</p>
                  <p className="font-bold text-slate-800">
                    {returnSale.paymentMethod}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">
                  Select items to return
                </p>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {[
                          "Medicine",
                          "Batch",
                          "Type",
                          "Sold Qty",
                          "Unit Price",
                          "Return Qty",
                          "Return Amt",
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
                      {returnItems.map((item, idx) => {
                        const unitPrice =
                          item.originalQty > 0
                            ? item.totalPrice / item.originalQty
                            : item.pricePerUnit;
                        const returnAmt = unitPrice * item.returnQty;
                        return (
                          <tr
                            key={idx}
                            className={
                              item.returnQty > 0
                                ? "bg-orange-50"
                                : "hover:bg-slate-50"
                            }
                          >
                            <td className="px-3 py-2.5 font-medium text-slate-800">
                              {item.medicineName}
                            </td>
                            <td className="px-3 py-2.5 text-xs font-mono text-slate-500">
                              {item.batchNo || "—"}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-slate-600">
                              <span
                                className={`px-2 py-0.5 rounded-full font-medium ${
                                  item.sellBy?.toLowerCase() === "pack"
                                    ? "bg-purple-100 text-purple-700"
                                    : "bg-blue-100 text-blue-700"
                                }`}
                              >
                                {item.sellBy?.toLowerCase() === "pack" ? "Pack" : "Loose"}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center font-medium text-slate-700">
                              {item.originalQty}
                            </td>
                            <td className="px-3 py-2.5 text-slate-700">
                              PKR {unitPrice.toFixed(2)}
                            </td>
                            <td className="px-3 py-2.5">
                              <input
                                type="number"
                                min="0"
                                max={item.originalQty}
                                value={item.returnQty === 0 ? "" : item.returnQty}
                                placeholder="0"
                                onChange={(e) => updateReturnQty(idx, e.target.value)}
                                className="w-20 px-2 py-1.5 border-2 border-orange-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono"
                              />
                            </td>
                            <td
                              className={`px-3 py-2.5 font-bold ${
                                returnAmt > 0
                                  ? "text-orange-600"
                                  : "text-slate-400"
                              }`}
                            >
                              {returnAmt > 0 ? `PKR ${returnAmt.toFixed(2)}` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {returnTotal > 0 && (
                      <tfoot className="bg-orange-50 border-t-2 border-orange-200">
                        <tr>
                          <td
                            colSpan={5}
                            className="px-3 py-2.5 text-right font-bold text-slate-700"
                          >
                            Total Refund:
                          </td>
                          <td className="px-3 py-2.5 font-black text-orange-600 text-base">
                            PKR {returnTotal.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Refund Method
                </label>
                <div className="flex gap-2">
                  {["Cash", "Bank Transfer", "Credit Note"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setRefundMethod(m)}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        refundMethod === m
                          ? "bg-orange-500 border-orange-500 text-white"
                          : "border-slate-300 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Reason for Return
                </label>
                <textarea
                  rows={2}
                  placeholder="Enter reason (optional)"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm resize-none"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="flex-1 px-4 py-3 border-2 border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitReturn}
                  disabled={returnLoading || returnTotal <= 0}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:opacity-60 text-white rounded-lg font-bold shadow-lg transition-all active:scale-95"
                >
                  {returnLoading
                    ? "Processing..."
                    : `Process Return · PKR ${returnTotal.toFixed(2)}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal({ ...modal, isOpen: false })}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        onConfirm={modal.onConfirm}
      />

      {showSlip && slipData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-800 text-base">
                Return Slip · {slipData.invoiceNumber}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => printReturnSlip(slipData)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium transition-all"
                >
                  <FiPrinter className="w-4 h-4" /> Print (Ctrl+P)
                </button>
                <button
                  onClick={() => setShowSlip(false)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium transition-all"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-6 font-mono text-sm">
              <div className="text-center font-bold text-lg tracking-wide mb-1">
                {hospitalSettings?.companyName?.toUpperCase() || "SHOP"}
              </div>
              <div className="border-t border-dashed border-slate-400 my-2" />
              <div className="text-center font-semibold text-base mb-2">
                Customer Return
              </div>
              <div className="border-t border-dashed border-slate-400 my-2" />

              <div className="space-y-0.5 text-xs text-slate-700 mb-3">
                <div>Date : {slipData.date}</div>
                <div>Party : {slipData.customerName}</div>
                <div>Bill No : {slipData.invoiceNumber}</div>
                {slipData.refundMethod && <div>Refund : {slipData.refundMethod}</div>}
              </div>

              <div className="border-t border-dashed border-slate-400 my-2" />

              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-dashed border-slate-400">
                    <th className="text-left py-1 font-semibold">Item</th>
                    <th className="text-center py-1 font-semibold w-12">Type</th>
                    <th className="text-center py-1 font-semibold w-10">Qty</th>
                    <th className="text-right py-1 font-semibold w-16">Amt</th>
                  </tr>
                </thead>
                <tbody>
                  {slipData.items.map((it, i) => (
                    <tr key={i}>
                      <td className="py-1">{it.medicineName}</td>
                      <td className="text-center py-1">
                        {it.sellBy?.toLowerCase() === "pack" ? "Pack" : "Loose"}
                      </td>
                      <td className="text-center py-1">{it.returnQty}</td>
                      <td className="text-right py-1">
                        {Number(it.returnAmt).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-dashed border-slate-400">
                    <td colSpan={2} className="pt-2 font-bold text-sm">
                      TOTAL RETURN
                    </td>
                    <td className="text-right pt-2 font-bold text-sm">
                      Rs {Number(slipData.totalReturnAmount).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              <div className="border-t border-dashed border-slate-400 my-3" />
              <div className="text-center text-xs text-slate-500">Thank you!</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
