import React, { useState, useEffect, useMemo } from "react";
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiSearch,
  FiX,
  FiUser,
  FiPhone,
  FiMapPin,
  FiCreditCard,
  FiDollarSign,
  FiAlertCircle,
  FiPrinter,
} from "react-icons/fi";
import { pharmacyCreditCustomersAPI } from "../../services/api";

const emptyForm = { name: "", phone: "", cnic: "", address: "" };

export default function CreditCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState("");

  // Add / Edit dialog
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [formLoading, setFormLoading] = useState(false);

  // Delete dialog
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingCustomer, setDeletingCustomer] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Pay Bill dialog
  const [showPayModal, setShowPayModal] = useState(false);
  const [payingCustomer, setPayingCustomer] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [payLoading, setPayLoading] = useState(false);
  const [creditReceipts, setCreditReceipts] = useState([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [receiptPayAmounts, setReceiptPayAmounts] = useState({});
  const [payTab, setPayTab] = useState("pay");
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── helpers ──────────────────────────────────────────────────────────────
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.cnic?.toLowerCase().includes(q) ||
        c.address?.toLowerCase().includes(q)
    );
  }, [customers, searchQuery]);

  // ── fetch ─────────────────────────────────────────────────────────────────
  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await pharmacyCreditCustomersAPI.getAll();
      setCustomers(res.data || []);
    } catch {
      showToast("Error fetching credit customers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCustomers(); }, []);

  // ── form modal ────────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditingCustomer(null);
    setFormData(emptyForm);
    setShowFormModal(true);
  };

  const openEdit = (c) => {
    setEditingCustomer(c);
    setFormData({ name: c.name, phone: c.phone, cnic: c.cnic, address: c.address });
    setShowFormModal(true);
  };

  const closeFormModal = () => {
    setShowFormModal(false);
    setEditingCustomer(null);
    setFormData(emptyForm);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return showToast("Name is required");
    try {
      setFormLoading(true);
      if (editingCustomer) {
        await pharmacyCreditCustomersAPI.update(editingCustomer._id, formData);
        showToast("Customer updated successfully");
      } else {
        await pharmacyCreditCustomersAPI.create(formData);
        showToast("Customer added successfully");
      }
      closeFormModal();
      fetchCustomers();
    } catch {
      showToast("Error saving customer");
    } finally {
      setFormLoading(false);
    }
  };

  // ── delete modal ──────────────────────────────────────────────────────────
  const openDelete = (c) => {
    setDeletingCustomer(c);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!deletingCustomer) return;
    try {
      setDeleteLoading(true);
      await pharmacyCreditCustomersAPI.delete(deletingCustomer._id);
      showToast("Customer deleted");
      setShowDeleteModal(false);
      setDeletingCustomer(null);
      fetchCustomers();
    } catch {
      showToast("Error deleting customer");
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── pay bill modal ────────────────────────────────────────────────────────
  const openPay = async (c) => {
    setPayingCustomer(c);
    setPayAmount("");
    setPayNotes("");
    setReceiptPayAmounts({});
    setCreditReceipts([]);
    setPaymentHistory([]);
    setPayTab("pay");
    setShowPayModal(true);
    try {
      setReceiptsLoading(true);
      setHistoryLoading(true);
      const [salesRes, histRes] = await Promise.all([
        pharmacyCreditCustomersAPI.getSales(c._id),
        pharmacyCreditCustomersAPI.getPaymentHistory(c._id),
      ]);
      setCreditReceipts(salesRes.data || []);
      setPaymentHistory(histRes.data || []);
    } catch {
      setCreditReceipts([]);
      setPaymentHistory([]);
    } finally {
      setReceiptsLoading(false);
      setHistoryLoading(false);
    }
  };

  const handlePay = async (e) => {
    e.preventDefault();
    const receiptTotal = Object.values(receiptPayAmounts).reduce((s, v) => s + (Number(v) || 0), 0);
    const generalAmt = Number(payAmount) || 0;
    const totalAmt = receiptTotal + generalAmt;
    if (totalAmt <= 0) return showToast("Enter a valid amount");
    try {
      setPayLoading(true);
      const payRes = await pharmacyCreditCustomersAPI.pay(
        payingCustomer._id,
        totalAmt,
        payNotes,
        "",
        receiptPayAmounts  // pass per-receipt amounts so backend can update each sale
      );
      // Update payingCustomer with fresh totals from the response
      if (payRes.data) setPayingCustomer(payRes.data);
      showToast("Payment recorded successfully");
      // Refresh both receipts and history in-dialog
      const [salesRes, histRes] = await Promise.all([
        pharmacyCreditCustomersAPI.getSales(payingCustomer._id),
        pharmacyCreditCustomersAPI.getPaymentHistory(payingCustomer._id),
      ]);
      setCreditReceipts(salesRes.data || []);
      setPaymentHistory(histRes.data || []);
      setPayAmount("");
      setPayNotes("");
      setReceiptPayAmounts({});
      setPayTab("history");
      fetchCustomers();
    } catch {
      showToast("Error recording payment");
    } finally {
      setPayLoading(false);
    }
  };

  // ── print payment invoice ─────────────────────────────────────────────────
  const printPaymentInvoice = (entry, customer) => {
    const w = window.open("", "_blank", "width=400,height=600,left=100,top=50,toolbar=0,menubar=0,scrollbars=1");
    const fmt = (n) => Number(n || 0).toFixed(2);
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Credit Payment Receipt</title>
<style>
  @page{size:80mm auto;margin:4mm;}
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'Courier New',Courier,monospace;font-size:12px;color:#000;width:72mm;}
  .center{text-align:center;}.right{text-align:right;}.bold{font-weight:bold;}
  .dashed{border-top:1px dashed #000;margin:6px 0;}
  table{width:100%;border-collapse:collapse;}
  td{font-size:12px;padding:2px 0;}
</style></head><body>
  <div class="center bold" style="font-size:15px;">CREDIT PAYMENT RECEIPT</div>
  <div class="dashed"></div>
  <table>
    <tr><td>Customer</td><td class="right">${customer.name}</td></tr>
    <tr><td>Phone</td><td class="right">${customer.phone || '—'}</td></tr>
    ${customer.cnic ? `<tr><td>CNIC</td><td class="right">${customer.cnic}</td></tr>` : ''}
    <tr><td>Date</td><td class="right">${new Date(entry.paidAt).toLocaleString()}</td></tr>
    ${entry.invoiceNumber ? `<tr><td>Invoice</td><td class="right">${entry.invoiceNumber}</td></tr>` : ''}
  </table>
  <div class="dashed"></div>
  <table>
    <tr><td class="bold" style="font-size:14px;">Amount Paid</td><td class="right bold" style="font-size:14px;">PKR ${fmt(entry.amount)}</td></tr>
  </table>
  <div class="dashed"></div>
  <table>
    <tr><td>Total Paid (cumulative)</td><td class="right">PKR ${fmt(customer.totalPaid)}</td></tr>
    <tr><td>Outstanding Due</td><td class="right">PKR ${fmt(customer.totalDue)}</td></tr>
  </table>
  ${entry.notes ? `<div class="dashed"></div><div style="font-size:11px;">Note: ${entry.notes}</div>` : ''}
  <div class="dashed"></div>
  <div class="center" style="font-size:11px;margin-top:4px;">Thank you for your payment!</div>
  <script>window.onload=function(){window.print();setTimeout(function(){window.close();},200);};</script>
</body></html>`;
    w.document.write(html);
    w.document.close();
  };

  // ── input class ───────────────────────────────────────────────────────────
  const inputCls =
    "w-full px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm";

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-[9999] bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-xl shadow-2xl font-semibold text-sm">
          {toast}
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Credit Customers
          </h1>
          <p className="text-slate-500 mt-1">Manage pharmacy credit accounts</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all active:scale-95"
        >
          <FiPlus className="w-4 h-4" />
          Add Credit Customer
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search by name, phone, CNIC..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border-2 border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm"
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-purple-400 font-semibold">
          Loading...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400">
          <FiUser className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-lg font-semibold">No credit customers found</p>
          <p className="text-sm mt-1">Add your first credit customer to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filtered.map((c) => {
            const due = Number(c.totalDue) || 0;
            const paid = Number(c.totalPaid) || 0;
            return (
              <div
                key={c._id}
                className="bg-white/80 backdrop-blur rounded-2xl shadow-lg border border-white/50 overflow-hidden hover:shadow-xl transition-all"
              >
                {/* Card Header */}
                <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                      <FiUser className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-base leading-tight">{c.name}</h3>
                      <p className="text-purple-200 text-xs mt-0.5">
                        Added {new Date(c.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {due > 0 && (
                    <span className="flex items-center gap-1 bg-red-500/80 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                      <FiAlertCircle className="w-3 h-3" />
                      Due
                    </span>
                  )}
                </div>

                {/* Card Body */}
                <div className="px-5 py-4 space-y-3">
                  {/* Details */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-slate-600">
                      <FiPhone className="w-4 h-4 text-purple-400 shrink-0" />
                      <span className="truncate">{c.phone || "—"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <FiCreditCard className="w-4 h-4 text-purple-400 shrink-0" />
                      <span className="truncate font-mono text-xs">{c.cnic || "—"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 col-span-2">
                      <FiMapPin className="w-4 h-4 text-purple-400 shrink-0" />
                      <span className="truncate">{c.address || "—"}</span>
                    </div>
                  </div>

                  {/* Financials */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-purple-100">
                    <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg px-3 py-2 text-center">
                      <p className="text-xs text-slate-500 font-medium">Total Paid</p>
                      <p className="text-base font-bold text-green-600">PKR {paid.toLocaleString()}</p>
                    </div>
                    <div className={`rounded-lg px-3 py-2 text-center ${due > 0 ? "bg-red-50" : "bg-green-50"}`}>
                      <p className="text-xs text-slate-500 font-medium">Outstanding Due</p>
                      <p className={`text-base font-bold ${due > 0 ? "text-red-600" : "text-green-600"}`}>
                        PKR {due.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => openPay(c)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-lg text-sm font-semibold transition-all shadow hover:shadow-md active:scale-95"
                    >
                      <FiDollarSign className="w-4 h-4" />
                      Pay Bill
                    </button>
                    <button
                      onClick={() => openEdit(c)}
                      className="p-2 text-purple-600 hover:bg-purple-50 border border-purple-200 rounded-lg transition-all"
                      title="Edit"
                    >
                      <FiEdit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openDelete(c)}
                      className="p-2 text-red-500 hover:bg-red-50 border border-red-200 rounded-lg transition-all"
                      title="Delete"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add / Edit Modal ─────────────────────────────────────────────── */}
      {showFormModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h3 className="text-lg font-bold text-white">
                {editingCustomer ? "Edit Customer" : "Add Credit Customer"}
              </h3>
              <button onClick={closeFormModal} className="text-white hover:bg-white/20 p-1.5 rounded-lg transition-all">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-purple-600 mb-2">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Enter full name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-purple-600 mb-2">Phone</label>
                <input
                  type="text"
                  placeholder="Enter phone number"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-purple-600 mb-2">CNIC</label>
                <input
                  type="text"
                  placeholder="e.g. 35202-1234567-1"
                  value={formData.cnic}
                  onChange={(e) => setFormData({ ...formData, cnic: e.target.value })}
                  className={`${inputCls} font-mono`}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-purple-600 mb-2">Address</label>
                <input
                  type="text"
                  placeholder="Enter address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeFormModal}
                  className="flex-1 px-4 py-3 border-2 border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-60 text-white rounded-lg font-bold transition-all shadow-lg active:scale-95"
                >
                  {formLoading ? "Saving..." : editingCustomer ? "Update Customer" : "Add Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Modal ─────────────────────────────────────────────────── */}
      {showDeleteModal && deletingCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4 rounded-t-2xl">
              <div className="flex items-center gap-3 text-white">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <FiTrash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Delete Customer</h3>
                  <p className="text-xs text-red-100">This action cannot be undone</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <p className="text-slate-700 mb-6">
                Are you sure you want to delete{" "}
                <span className="font-bold text-slate-900">{deletingCustomer.name}</span>?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowDeleteModal(false); setDeletingCustomer(null); }}
                  className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteLoading}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:opacity-60 text-white rounded-xl font-semibold shadow-lg transition-all active:scale-95"
                >
                  {deleteLoading ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Pay Bill Modal ───────────────────────────────────────────────── */}
      {showPayModal && payingCustomer && (() => {
        const receiptTotal = Object.values(receiptPayAmounts).reduce((s, v) => s + (Number(v) || 0), 0);
        const generalAmt = Number(payAmount) || 0;
        const totalPaying = receiptTotal + generalAmt;
        const newRemaining = Math.max(0, Number(payingCustomer.totalDue || 0) - totalPaying);
        return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 text-white">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <FiDollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Pay Bill</h3>
                  <p className="text-xs text-green-100">{payingCustomer.name}</p>
                </div>
              </div>
              <button onClick={() => { setShowPayModal(false); setPayingCustomer(null); }}
                className="text-white hover:bg-white/20 p-1.5 rounded-lg transition-all">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 shrink-0">
              {["pay", "history"].map(t => (
                <button key={t} onClick={() => setPayTab(t)}
                  className={`flex-1 py-3 text-sm font-bold tracking-wide transition-all ${
                    payTab === t
                      ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white"
                      : "text-slate-500 hover:text-green-600 hover:bg-green-50"
                  }`}>
                  {t === "pay" ? "Pay Bill" : "Payment History"}
                </button>
              ))}
            </div>

            {/* ── Pay Bill Tab ── */}
            {payTab === "pay" && (
              <form onSubmit={handlePay} className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Summary row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-100 px-4 py-3 text-center">
                    <p className="text-xs text-slate-500 font-medium">Total Paid so far</p>
                    <p className="text-lg font-bold text-green-600">PKR {Number(payingCustomer.totalPaid || 0).toFixed(2)}</p>
                  </div>
                  <div className="bg-red-50 rounded-xl border border-red-200 px-4 py-3 text-center">
                    <p className="text-xs text-slate-500 font-medium">Outstanding Due</p>
                    <p className="text-lg font-bold text-red-600">PKR {Number(payingCustomer.totalDue || 0).toFixed(2)}</p>
                  </div>
                </div>

                {/* Receipts table */}
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-2">Receipts · {payingCustomer.name}</p>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          {["Bill No", "Date", "Total", "Paid", "Remaining"].map(h => (
                            <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {receiptsLoading ? (
                          <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-400 text-xs">Loading receipts...</td></tr>
                        ) : creditReceipts.length === 0 ? (
                          <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-400 text-xs">No credit receipts</td></tr>
                        ) : (
                          creditReceipts.map(r => {
                            const paid = Number(r.receivedAmount || 0);
                            const rem  = Number(r.remaining ?? Math.max(0, (r.totalAmount || 0) - paid));
                            return (
                              <tr key={r._id} className="hover:bg-slate-50">
                                <td className="px-3 py-2.5 font-mono text-xs text-purple-700">{r.invoiceNumber || '—'}</td>
                                <td className="px-3 py-2.5 text-slate-500 text-xs whitespace-nowrap">{new Date(r.createdAt).toLocaleDateString()}</td>
                                <td className="px-3 py-2.5 font-medium text-slate-800">PKR {Number(r.totalAmount || 0).toFixed(2)}</td>
                                <td className="px-3 py-2.5 text-green-600 font-medium">PKR {paid.toFixed(2)}</td>
                                <td className="px-3 py-2.5 text-red-600 font-medium">PKR {rem.toFixed(2)}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Notes</label>
                  <textarea rows={2} placeholder="Add notes (optional)" value={payNotes}
                    onChange={e => setPayNotes(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm resize-none" />
                </div>

                {/* General payment */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Amount (General payment)</label>
                  <input type="number" min="0" step="0.01" placeholder="Enter amount" value={payAmount}
                    onChange={e => setPayAmount(e.target.value)} className={`${inputCls} font-mono`} />
                </div>

                {/* Total preview */}
                {totalPaying > 0 && (
                  <div className="flex justify-between items-center bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm">
                    <span className="font-semibold text-slate-700">Total Paying: <span className="text-green-700">PKR {totalPaying.toFixed(2)}</span></span>
                    <span className="font-semibold text-slate-700">Remaining: <span className={newRemaining > 0 ? "text-red-600" : "text-green-600"}>PKR {newRemaining.toFixed(2)}</span></span>
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => { setShowPayModal(false); setPayingCustomer(null); }}
                    className="flex-1 px-4 py-3 border-2 border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-semibold transition-all">
                    Cancel
                  </button>
                  <button type="submit" disabled={payLoading || totalPaying <= 0}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:opacity-60 text-white rounded-lg font-bold shadow-lg transition-all active:scale-95">
                    {payLoading ? "Processing..." : "Record Payment"}
                  </button>
                </div>
              </form>
            )}

            {/* ── Payment History Tab ── */}
            {payTab === "history" && (
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-100 px-4 py-3 text-center">
                    <p className="text-xs text-slate-500 font-medium">Total Paid</p>
                    <p className="text-lg font-bold text-green-600">PKR {Number(payingCustomer.totalPaid || 0).toFixed(2)}</p>
                  </div>
                  <div className="bg-red-50 rounded-xl border border-red-200 px-4 py-3 text-center">
                    <p className="text-xs text-slate-500 font-medium">Outstanding Due</p>
                    <p className="text-lg font-bold text-red-600">PKR {Number(payingCustomer.totalDue || 0).toFixed(2)}</p>
                  </div>
                </div>

                {historyLoading ? (
                  <p className="text-center text-slate-400 py-8 text-sm">Loading history...</p>
                ) : paymentHistory.length === 0 ? (
                  <p className="text-center text-slate-400 py-8 text-sm">No payment history yet</p>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          {["#", "Date & Time", "Amount", "Invoice", "Notes", "Print"].map(h => (
                            <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paymentHistory.map((entry, i) => (
                          <tr key={entry._id || i} className="hover:bg-slate-50">
                            <td className="px-3 py-2.5 text-slate-400 text-xs">{paymentHistory.length - i}</td>
                            <td className="px-3 py-2.5 text-slate-600 text-xs whitespace-nowrap">
                              {new Date(entry.paidAt).toLocaleString()}
                            </td>
                            <td className="px-3 py-2.5 font-bold text-green-700">
                              PKR {Number(entry.amount || 0).toFixed(2)}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-xs text-purple-700">
                              {entry.invoiceNumber || 'General'}
                            </td>
                            <td className="px-3 py-2.5 text-slate-500 text-xs max-w-[120px] truncate" title={entry.notes}>
                              {entry.notes || '—'}
                            </td>
                            <td className="px-3 py-2.5">
                              <button
                                type="button"
                                onClick={() => printPaymentInvoice(entry, payingCustomer)}
                                className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                                title="Print receipt"
                              >
                                <FiPrinter className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button type="button" onClick={() => { setShowPayModal(false); setPayingCustomer(null); }}
                    className="px-6 py-2.5 border-2 border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-semibold transition-all">
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        );
      })()}
    </div>
  );
}
