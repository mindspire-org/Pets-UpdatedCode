import React, { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiDownload, FiTrash2, FiEdit2, FiX, FiCheck, FiFilter, FiCalendar, FiDollarSign } from 'react-icons/fi';
import { expensesAPI } from '../../services/api';

export default function PharmacyExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentExpense, setCurrentExpense] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    type: 'All Types',
    minAmount: 0,
    user: ''
  });
  const [limit, setLimit] = useState(10);
  const [page, setPage] = useState(1);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
    category: 'Other',
    description: '',
    amount: '',
    portal: 'pharmacy'
  });

  const expenseTypes = ['Rent', 'Utilities', 'Supplies', 'Salaries', 'Maintenance', 'Other'];

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const response = await expensesAPI.getByPortal('pharmacy');
      setExpenses(response.data || []);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Create a combined notes/description to store the time if the backend model doesn't have a dedicated field
      const submissionData = {
        ...formData,
        amount: Number(formData.amount),
        notes: `Time: ${formData.time} | ${formData.description}` // Back up time in notes field
      };

      if (isEditing) {
        await expensesAPI.update(currentExpense.id, submissionData);
      } else {
        await expensesAPI.create(submissionData);
      }
      setShowAddModal(false);
      resetForm();
      fetchExpenses();
    } catch (error) {
      console.error('Error saving expense:', error);
      alert('Error saving expense. Please try again.');
    }
  };

  const handleEdit = (expense) => {
    setIsEditing(true);
    setCurrentExpense(expense);
    setFormData({
      date: new Date(expense.date).toISOString().split('T')[0],
      time: expense.time || '',
      category: expense.category,
      description: expense.description,
      amount: expense.amount,
      portal: 'pharmacy'
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    try {
      await expensesAPI.delete(id);
      fetchExpenses();
    } catch (error) {
      console.error('Error deleting expense:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
      category: 'Other',
      description: '',
      amount: '',
      portal: 'pharmacy'
    });
    setIsEditing(false);
    setCurrentExpense(null);
  };

  const formatTime12h = (exp) => {
    // Priority 1: Check for dedicated time field
    let timeStr = exp.time;
    
    // Priority 2: Extract from notes if we stored it there as backup
    if (!timeStr && exp.notes && exp.notes.startsWith('Time: ')) {
      timeStr = exp.notes.split('|')[0].replace('Time: ', '').trim();
    }

    // Priority 3: Extract from createdAt if available
    if (!timeStr && exp.createdAt) {
      return new Date(exp.createdAt).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: true 
      });
    }

    if (!timeStr) return '—';
    
    try {
      const [hours, minutes] = timeStr.split(':');
      const h = parseInt(hours);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      return `${h12}:${minutes} ${ampm}`;
    } catch (e) {
      return timeStr;
    }
  };

  const filteredExpenses = expenses.filter(exp => {
    const matchesSearch = exp.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         exp.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filters.type === 'All Types' || exp.category === filters.type;
    const matchesMinAmount = exp.amount >= Number(filters.minAmount || 0);
    
    let matchesDate = true;
    if (filters.startDate || filters.endDate) {
      const expDate = new Date(exp.date);
      if (filters.startDate && expDate < new Date(filters.startDate)) matchesDate = false;
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        if (expDate > endDate) matchesDate = false;
      }
    }

    return matchesSearch && matchesType && matchesMinAmount && matchesDate;
  });

  const totalPages = Math.ceil(filteredExpenses.length / limit);
  const paginatedExpenses = filteredExpenses.slice((page - 1) * limit, page * limit);

  const exportCSV = () => {
    const headers = ['Date', 'Category', 'Description', 'Amount'];
    const rows = filteredExpenses.map(e => [
      new Date(e.date).toLocaleDateString(),
      e.category,
      e.description,
      e.amount
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pharmacy-expenses-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-800">Expense Tracker</h1>
        <button 
          onClick={() => { resetForm(); setShowAddModal(true); }}
          className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-all active:scale-95 shadow-lg shadow-slate-200"
        >
          <FiPlus className="w-5 h-5" /> Add Expense
        </button>
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="md:col-span-1">
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Date Range</label>
            <div className="flex gap-2">
              <input 
                type="date" 
                value={filters.startDate}
                onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm outline-none focus:border-blue-500"
              />
              <input 
                type="date" 
                value={filters.endDate}
                onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Expense Type</label>
            <select 
              value={filters.type}
              onChange={(e) => setFilters({...filters, type: e.target.value})}
              className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm outline-none focus:border-blue-500 appearance-none cursor-pointer"
            >
              <option>All Types</option>
              {expenseTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Minimum Amount</label>
            <input 
              type="number" 
              value={filters.minAmount}
              onChange={(e) => setFilters({...filters, minAmount: e.target.value})}
              placeholder="0"
              className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">User</label>
            <input 
              type="text" 
              placeholder="Username"
              className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex gap-2">
            <button 
              onClick={fetchExpenses}
              className="flex-1 py-2 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-all active:scale-95 text-sm"
            >
              Apply
            </button>
            <select 
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="px-3 py-2 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm outline-none focus:border-blue-500"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      {/* Expenses List */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-700">Expenses</h2>
          <div className="flex gap-2">
            <div className="relative">
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search expenses..." 
                className="pl-9 pr-4 py-1.5 bg-slate-50 border-2 border-slate-100 rounded-full text-sm outline-none focus:border-blue-500"
              />
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
            <button onClick={exportCSV} className="px-4 py-1.5 border-2 border-slate-100 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all">Download CSV</button>
            <button onClick={() => window.print()} className="px-4 py-1.5 border-2 border-slate-100 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all">Download PDF</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Time</th>
                <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Type</th>
                <th className="px-6 py-4 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Note</th>
                <th className="px-6 py-4 text-right text-xs font-black text-slate-400 uppercase tracking-widest">Amount</th>
                <th className="px-6 py-4 text-center text-xs font-black text-slate-400 uppercase tracking-widest">User</th>
                <th className="px-6 py-4 text-right text-xs font-black text-slate-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-20 text-center">
                    <div className="w-10 h-10 border-4 border-slate-800 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="mt-4 text-slate-400 font-medium tracking-wide">Loading expenses...</p>
                  </td>
                </tr>
              ) : paginatedExpenses.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-20 text-center">
                    <FiDollarSign className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                    <p className="text-lg font-bold text-slate-400">No expenses found</p>
                  </td>
                </tr>
              ) : (
                paginatedExpenses.map((exp) => (
                  <tr key={exp._id} className="hover:bg-slate-50/80 transition-all group">
                    <td className="px-6 py-4 text-sm font-bold text-slate-700 whitespace-nowrap">
                      {new Date(exp.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-400 whitespace-nowrap">
                      {formatTime12h(exp)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-black uppercase rounded tracking-widest">
                        {exp.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 min-w-[200px]">
                      {exp.description}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-black text-slate-800">
                      PKR {exp.amount?.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-xs font-bold text-slate-500">{exp.user || 'Admin'}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEdit(exp)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><FiEdit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(exp.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><FiTrash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {!loading && filteredExpenses.length > 0 && (
          <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              {filteredExpenses.length} results
            </span>
            <div className="flex items-center gap-4">
              <button 
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-4 py-1.5 bg-white border-2 border-slate-100 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-50"
              >
                Prev
              </button>
              <span className="text-sm font-bold text-slate-600">Page {page} of {totalPages}</span>
              <button 
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-4 py-1.5 bg-white border-2 border-slate-100 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-800">{isEditing ? 'Edit Expense' : 'Add Expense'}</h3>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-white rounded-full transition-colors group">
                <FiX className="w-5 h-5 text-slate-400 group-hover:text-slate-600" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">Date</label>
                <input 
                  type="date" 
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">Time (optional)</label>
                <input 
                  type="time" 
                  name="time"
                  value={formData.time}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">Type</label>
                <select 
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-500 appearance-none cursor-pointer"
                >
                  {expenseTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">Note</label>
                <input 
                  type="text" 
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Description"
                  required
                  className="w-full px-4 py-2 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">Amount</label>
                <div className="relative">
                  <input 
                    type="number" 
                    name="amount"
                    value={formData.amount}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    required
                    className="w-full px-4 py-2 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-500 font-bold"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs tracking-widest uppercase">PKR</span>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 border-2 border-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-all active:scale-95 shadow-lg shadow-slate-200"
                >
                  {isEditing ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
