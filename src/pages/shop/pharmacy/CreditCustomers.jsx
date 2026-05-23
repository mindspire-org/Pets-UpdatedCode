import React, { useState, useEffect, useMemo } from "react";
import {
  FiPlus, FiEdit2, FiTrash2, FiSearch, FiUser,
  FiCreditCard,
} from "react-icons/fi";
import { petshopPharmacyCreditCustomersAPI, settingsAPI } from "../../../services/api";

const emptyForm = { name: "", phone: "", cnic: "", address: "" };

export default function ShopPharmacyCreditCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState("");
  const [hospitalSettings, setHospitalSettings] = useState(null);

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [formLoading, setFormLoading] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingCustomer, setDeletingCustomer] = useState(null);

  const [showPayModal, setShowPayModal] = useState(false);
  const [payingCustomer, setPayingCustomer] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [payLoading, setPayLoading] = useState(false);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    settingsAPI.get(JSON.parse(localStorage.getItem("user") || "{}").username || "admin")
      .then((r) => setHospitalSettings(r.data)).catch(() => {});
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await petshopPharmacyCreditCustomersAPI.getAll();
      setCustomers(res.data || []);
    } catch (err) {
      showToast("Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return q ? customers.filter((c) =>
      (c.name || "").toLowerCase().includes(q) ||
      (c.phone || "").includes(q) ||
      (c.cnic || "").includes(q)
    ) : customers;
  }, [customers, searchQuery]);

  const openAdd = () => { setEditingCustomer(null); setFormData(emptyForm); setShowFormModal(true); };
  const openEdit = (c) => {
    setEditingCustomer(c);
    setFormData({ name: c.name || "", phone: c.phone || "", cnic: c.cnic || "", address: c.address || "" });
    setShowFormModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) { showToast("Name is required"); return; }
    try {
      setFormLoading(true);
      if (editingCustomer) {
        await petshopPharmacyCreditCustomersAPI.update(editingCustomer._id, formData);
        showToast("Customer updated");
      } else {
        await petshopPharmacyCreditCustomersAPI.create(formData);
        showToast("Customer added");
      }
      setShowFormModal(false);
      fetchCustomers();
    } catch (err) {
      showToast(err.message || "Failed to save");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await petshopPharmacyCreditCustomersAPI.delete(deletingCustomer._id);
      showToast("Customer deleted");
      setShowDeleteModal(false);
      fetchCustomers();
    } catch (err) {
      showToast(err.message || "Failed to delete");
    }
  };

  const openPay = (c) => { setPayingCustomer(c); setPayAmount(""); setPayNotes(""); setShowPayModal(true); };

  const handlePay = async () => {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) { showToast("Enter a valid amount"); return; }
    try {
      setPayLoading(true);
      await petshopPharmacyCreditCustomersAPI.pay(payingCustomer._id, amount, payNotes);
      showToast(`Payment of ${currency} ${amount.toLocaleString()} recorded`);
      setShowPayModal(false);
      fetchCustomers();
    } catch (err) {
      showToast(err.message || "Failed to record payment");
    } finally {
      setPayLoading(false);
    }
  };

  const openHistory = async (c) => {
    setHistoryCustomer(c);
    setShowHistoryModal(true);
    setHistoryLoading(true);
    try {
      const res = await petshopPharmacyCreditCustomersAPI.getPaymentHistory(c._id);
      setPaymentHistory(res.data || []);
    } catch {
      setPaymentHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const currency = hospitalSettings?.currency || "PKR";
  const totalOutstanding = customers.reduce((sum, c) => sum + (c.currentBalance || c.outstandingBalance || 0), 0);

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Credit Customers</h1>
          <p className="text-slate-500 text-sm mt-1">Manage credit accounts for petshop pharmacy</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm">
          <FiPlus className="w-4 h-4" /> Add Customer
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Total Customers</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{customers.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Total Outstanding</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{currency} {totalOutstanding.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">With Balance</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">{customers.filter((c) => (c.currentBalance || c.outstandingBalance || 0) > 0).length}</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm"
            placeholder="Search by name, phone, or CNIC..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <FiCreditCard className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p>No customers found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Name", "Phone", "CNIC", "Address", "Outstanding", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => {
                  const balance = c.currentBalance || c.outstandingBalance || 0;
                  return (
                    <tr key={c._id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                      <td className="px-4 py-3 text-slate-600">{c.phone || "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{c.cnic || "—"}</td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{c.address || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${balance > 0 ? "text-red-600" : "text-green-600"}`}>
                          {currency} {balance.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {balance > 0 && (
                            <button onClick={() => openPay(c)} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200">Pay</button>
                          )}
                          <button onClick={() => openHistory(c)} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200">History</button>
                          <button onClick={() => openEdit(c)} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded"><FiEdit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => { setDeletingCustomer(c); setShowDeleteModal(true); }} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><FiTrash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showFormModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">{editingCustomer ? "Edit Customer" : "Add Customer"}</h2>
              <button onClick={() => setShowFormModal(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {[
                { label: "Name *", key: "name", placeholder: "Customer name" },
                { label: "Phone", key: "phone", placeholder: "Phone number" },
                { label: "CNIC", key: "cnic", placeholder: "CNIC number" },
                { label: "Address", key: "address", placeholder: "Address" },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                  <input
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    placeholder={placeholder}
                    value={formData[key]}
                    onChange={(e) => setFormData((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowFormModal(false)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
                <button onClick={handleSave} disabled={formLoading} className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50">
                  {formLoading ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && deletingCustomer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-2">Delete Customer</h2>
            <p className="text-slate-600 text-sm mb-4">Are you sure you want to delete <strong>{deletingCustomer.name}</strong>?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
              <button onClick={handleDelete} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Modal */}
      {showPayModal && payingCustomer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">Record Payment</h2>
              <button onClick={() => setShowPayModal(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-lg p-3 text-sm">
                <p className="text-slate-600">Customer: <span className="font-medium">{payingCustomer.name}</span></p>
                <p className="text-slate-600 mt-1">Outstanding: <span className="font-bold text-red-600">{currency} {(payingCustomer.currentBalance || payingCustomer.outstandingBalance || 0).toLocaleString()}</span></p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount ({currency})</label>
                <input
                  type="number"
                  min={0}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="Enter amount..."
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="Payment notes..."
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowPayModal(false)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
                <button onClick={handlePay} disabled={payLoading} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
                  {payLoading ? "Processing..." : "Record Payment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && historyCustomer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">Payment History — {historyCustomer.name}</h2>
              <button onClick={() => setShowHistoryModal(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">✕</button>
            </div>
            <div className="p-6">
              {historyLoading ? (
                <div className="flex items-center justify-center h-24">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600" />
                </div>
              ) : paymentHistory.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No payment history found</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {["Date", "Amount", "Notes", "Invoice"].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paymentHistory.map((p, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2">{p.date ? new Date(p.date).toLocaleDateString() : "—"}</td>
                        <td className="px-3 py-2 font-medium text-green-600">{currency} {(p.amount || 0).toLocaleString()}</td>
                        <td className="px-3 py-2 text-slate-600">{p.notes || "—"}</td>
                        <td className="px-3 py-2 text-purple-600">{p.invoiceNumber || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
