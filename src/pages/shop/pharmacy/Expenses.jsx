import React, { useState, useEffect } from "react";
import {
  FiPlus, FiSearch, FiDownload, FiTrash2, FiEdit2, FiX, FiCheck, FiFilter, FiDollarSign,
} from "react-icons/fi";
import { expensesAPI } from "../../../services/api";
import DateRangePicker from "../../../components/DateRangePicker";

const CATEGORIES = ["Rent", "Utilities", "Salaries", "Supplies", "Maintenance", "Marketing", "Transport", "Other"];

const emptyForm = {
  date: new Date().toISOString().split("T")[0],
  time: new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" }),
  category: "Other",
  description: "",
  amount: "",
  portal: "shop",
};

export default function ShopPharmacyExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentExpense, setCurrentExpense] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({ startDate: "", endDate: "", type: "All Types" });
  const [formData, setFormData] = useState(emptyForm);
  const [toast, setToast] = useState("");

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const res = await expensesAPI.getByPortal("shop");
      setExpenses(res.data || []);
    } catch (err) {
      console.error("Error fetching expenses:", err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const handleSave = async () => {
    if (!formData.description || !formData.amount) { showToast("Description and amount are required"); return; }
    try {
      if (isEditing && currentExpense) {
        await expensesAPI.update(currentExpense._id, formData);
        showToast("Expense updated");
      } else {
        await expensesAPI.create({ ...formData, portal: "shop" });
        showToast("Expense added");
      }
      setShowAddModal(false);
      setFormData(emptyForm);
      fetchExpenses();
    } catch (err) {
      showToast(err.message || "Failed to save expense");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this expense?")) return;
    try {
      await expensesAPI.delete(id);
      showToast("Expense deleted");
      fetchExpenses();
    } catch (err) {
      showToast(err.message || "Failed to delete");
    }
  };

  const openEdit = (expense) => {
    setCurrentExpense(expense);
    setFormData({
      date: expense.date || new Date().toISOString().split("T")[0],
      time: expense.time || "",
      category: expense.category || "Other",
      description: expense.description || "",
      amount: expense.amount || "",
      portal: "shop",
    });
    setIsEditing(true);
    setShowAddModal(true);
  };

  const filtered = expenses.filter((e) => {
    const matchSearch = !searchTerm || (e.description || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = filters.type === "All Types" || e.category === filters.type;
    const matchStart = !filters.startDate || (e.date || "") >= filters.startDate;
    const matchEnd = !filters.endDate || (e.date || "") <= filters.endDate;
    return matchSearch && matchType && matchStart && matchEnd;
  });

  const totalAmount = filtered.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Expenses</h1>
          <p className="text-slate-500 text-sm mt-1">Track shop pharmacy expenses</p>
        </div>
        <button
          onClick={() => { setIsEditing(false); setCurrentExpense(null); setFormData(emptyForm); setShowAddModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
        >
          <FiPlus className="w-4 h-4" /> Add Expense
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Total Expenses</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{filtered.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Total Amount</p>
          <p className="text-2xl font-bold text-red-600 mt-1">PKR {totalAmount.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Average Expense</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">PKR {filtered.length > 0 ? (totalAmount / filtered.length).toLocaleString(undefined, { maximumFractionDigits: 0 }) : 0}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm"
              placeholder="Search expenses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={filters.type}
            onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
          >
            <option>All Types</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <DateRangePicker
            onDateChange={({ fromDate, toDate }) =>
              setFilters((f) => ({ ...f, startDate: fromDate, endDate: toDate }))
            }
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
          <div className="text-center py-16 text-slate-500">No expenses found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Date", "Category", "Description", "Amount", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((expense) => (
                  <tr key={expense._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">{expense.date || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-700">{expense.category || "Other"}</span>
                    </td>
                    <td className="px-4 py-3">{expense.description || "—"}</td>
                    <td className="px-4 py-3 font-semibold text-red-600">PKR {(parseFloat(expense.amount) || 0).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(expense)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit">
                          <FiEdit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(expense._id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">{isEditing ? "Edit Expense" : "Add Expense"}</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                  <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={formData.date} onChange={(e) => setFormData((f) => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                  <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" value={formData.category} onChange={(e) => setFormData((f) => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
                <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Expense description..." value={formData.description} onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount (PKR) *</label>
                <input type="number" min={0} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="0.00" value={formData.amount} onChange={(e) => setFormData((f) => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
                <button onClick={handleSave} className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
                  {isEditing ? "Update" : "Add Expense"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
