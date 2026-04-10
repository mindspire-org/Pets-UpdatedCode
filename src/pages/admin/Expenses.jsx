import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { FiDollarSign, FiPlus, FiTrash2, FiEdit2, FiCalendar, FiFileText, FiTrendingUp } from 'react-icons/fi'
import { expensesAPI } from '../../services/api'
import { useActivity } from '../../context/ActivityContext'
import DateRangePicker from '../../components/DateRangePicker'

const PORTALS = [
  { value: 'reception', label: 'Reception', color: 'emerald' },
  { value: 'doctor', label: 'Doctor', color: 'blue' },
  { value: 'pharmacy', label: 'Pharmacy', color: 'violet' },
  { value: 'lab', label: 'Laboratory', color: 'cyan' },
  { value: 'shop', label: 'Shop', color: 'orange' },
  { value: 'admin', label: 'Admin/General', color: 'slate' },
]

export default function AdminExpenses() {
  const { addActivity } = useActivity()
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [filterPortal, setFilterPortal] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateRange, setDateRange] = useState({
    fromDate: new Date().toISOString().slice(0,10),
    toDate: new Date().toISOString().slice(0,10)
  })
  
  const [form, setForm] = useState({
    portal: 'admin',
    category: '',
    description: '',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    paymentMethod: 'Cash',
    notes: ''
  })

  useEffect(() => {
    loadExpenses()
  }, [])

  const loadExpenses = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Try API first, fallback to localStorage if API fails
      try {
        const response = await expensesAPI.getAll()
        if (response && response.data) {
          setExpenses(response.data)
          // Backup to localStorage
          localStorage.setItem('admin_expenses', JSON.stringify(response.data))
          return
        }
      } catch (apiError) {
        console.log('API not available, using localStorage:', apiError.message)
      }
      
      // Fallback to localStorage
      const stored = localStorage.getItem('admin_expenses')
      if (stored) {
        setExpenses(JSON.parse(stored))
      } else {
        setExpenses([])
      }
    } catch (err) {
      console.error('Error loading expenses:', err)
      setError('Failed to load expenses')
      setExpenses([])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!form.category || !form.description || !form.amount) {
      setError('Please fill in all required fields')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const expenseData = {
        ...form,
        amount: parseFloat(form.amount),
        createdAt: new Date().toISOString(),
        id: editingId || `exp_${Date.now()}`
      }

      try {
        if (editingId) {
          // Try API first
          try {
            const response = await expensesAPI.update(editingId, expenseData)
            setExpenses(prev => prev.map(exp => (exp.id === editingId || exp._id === editingId) ? response.data : exp))
          } catch (apiError) {
            // Fallback to localStorage
            setExpenses(prev => prev.map(exp => (exp.id === editingId) ? expenseData : exp))
          }
          addActivity({ user: 'Admin', text: `Updated expense: ${form.description}` })
        } else {
          // Try API first
          try {
            const response = await expensesAPI.create(expenseData)
            setExpenses(prev => [response.data, ...prev])
          } catch (apiError) {
            // Fallback to localStorage
            setExpenses(prev => [expenseData, ...prev])
          }
          addActivity({ user: 'Admin', text: `Added expense: ${form.description} - Rs. ${form.amount}` })
        }
        
        // Save to localStorage
        const currentExpenses = JSON.parse(localStorage.getItem('admin_expenses') || '[]')
        if (editingId) {
          const updatedExpenses = currentExpenses.map(exp => (exp.id === editingId) ? expenseData : exp)
          localStorage.setItem('admin_expenses', JSON.stringify(updatedExpenses))
        } else {
          localStorage.setItem('admin_expenses', JSON.stringify([expenseData, ...currentExpenses]))
        }
      } catch (error) {
        console.error('Error saving expense:', error)
        setError('Failed to save expense')
        return
      }

      // Reset form
      setForm({
        portal: 'admin',
        category: '',
        description: '',
        amount: '',
        date: new Date().toISOString().slice(0, 10),
        paymentMethod: 'Cash',
        notes: ''
      })
      setShowForm(false)
      setEditingId(null)
      await loadExpenses()
    } catch (err) {
      console.error('Error saving expense:', err)
      setError(err.message || 'Failed to save expense')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (expense) => {
    setForm({
      portal: expense.portal || 'admin',
      category: expense.category || '',
      description: expense.description || '',
      amount: expense.amount?.toString() || '',
      date: expense.date || new Date().toISOString().slice(0, 10),
      paymentMethod: expense.paymentMethod || 'Cash',
      notes: expense.notes || ''
    })
    setEditingId(expense.id || expense._id)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return

    try {
      setLoading(true)
      
      // Try API first
      try {
        await expensesAPI.delete(id)
      } catch (apiError) {
        console.log('API not available for delete, using localStorage')
      }
      
      // Update state
      setExpenses(prev => prev.filter(exp => exp.id !== id && exp._id !== id))
      
      // Update localStorage
      const currentExpenses = JSON.parse(localStorage.getItem('admin_expenses') || '[]')
      const updatedExpenses = currentExpenses.filter(exp => exp.id !== id)
      localStorage.setItem('admin_expenses', JSON.stringify(updatedExpenses))
      
      addActivity({ user: 'Admin', text: 'Deleted an expense' })
    } catch (err) {
      console.error('Error deleting expense:', err)
      setError('Failed to delete expense')
    } finally {
      setLoading(false)
    }
  }

  // Date filtering function
  const isDateInRange = (dateStr) => {
    if (!dateStr) return false
    const date = new Date(dateStr).toISOString().slice(0,10)
    return date >= dateRange.fromDate && date <= dateRange.toDate
  }
  
  const handleDateRangeChange = useCallback((newDateRange) => {
    setDateRange(newDateRange)
  }, [])

  const filteredExpenses = useMemo(() => expenses.filter(exp => {
    const matchesPortal = filterPortal === 'all' || exp.portal === filterPortal
    const matchesSearch = !searchQuery || 
      exp.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exp.category?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesDate = isDateInRange(exp.date || exp.createdAt)
    return matchesPortal && matchesSearch && matchesDate
  }), [expenses, filterPortal, searchQuery, dateRange.fromDate, dateRange.toDate])

  const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0)

  const expensesByPortal = PORTALS.map(portal => ({
    ...portal,
    total: filteredExpenses
      .filter(exp => exp.portal === portal.value)
      .reduce((sum, exp) => sum + (exp.amount || 0), 0)
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Expense Management
          </h1>
          <p className="text-slate-600 mt-1">Track and manage expenses across all portals</p>
        </div>
        <button
          onClick={() => {
            setShowForm(true)
            setEditingId(null)
            setForm({
              portal: 'admin',
              category: '',
              description: '',
              amount: '',
              date: new Date().toISOString().slice(0, 10),
              paymentMethod: 'Cash',
              notes: ''
            })
          }}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
        >
          <FiPlus className="w-5 h-5" />
          Add Expense
        </button>
      </div>

      {/* Date Range Filter */}
      <div className="rounded-2xl bg-gradient-to-br from-white via-indigo-50 to-purple-50 shadow-xl ring-1 ring-indigo-200 border border-indigo-100 p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <FiCalendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-indigo-600">Filter by Expense Date</div>
              <div className="text-lg font-bold text-slate-800">
                {dateRange.fromDate === dateRange.toDate 
                  ? new Date(dateRange.fromDate).toLocaleDateString()
                  : `${new Date(dateRange.fromDate).toLocaleDateString()} - ${new Date(dateRange.toDate).toLocaleDateString()}`
                }
              </div>
            </div>
          </div>
          
          <DateRangePicker 
            onDateChange={handleDateRangeChange}
            defaultFromDate={dateRange.fromDate}
            defaultToDate={dateRange.toDate}
            showAllButton={true}
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">×</button>
        </div>
      )}

      {/* Portal Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {expensesByPortal.map(portal => (
          <div
            key={portal.value}
            className={`bg-gradient-to-br from-${portal.color}-50 to-white rounded-xl p-4 border border-${portal.color}-200 shadow-sm hover:shadow-md transition-all cursor-pointer`}
            onClick={() => setFilterPortal(portal.value)}
          >
            <div className={`text-${portal.color}-600 font-semibold text-sm mb-1`}>{portal.label}</div>
            <div className="text-2xl font-bold text-slate-800">Rs. {portal.total.toLocaleString()}</div>
            <div className="text-xs text-slate-500 mt-1">
              {expenses.filter(e => e.portal === portal.value).length} expenses
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg p-4 border border-slate-200">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search expenses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-12 px-4 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <select
            value={filterPortal}
            onChange={(e) => setFilterPortal(e.target.value)}
            className="h-12 px-4 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="all">All Portals</option>
            {PORTALS.map(portal => (
              <option key={portal.value} value={portal.value}>{portal.label}</option>
            ))}
          </select>
          {filterPortal !== 'all' && (
            <button
              onClick={() => setFilterPortal('all')}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
            >
              Clear Filter
            </button>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-slate-600">
            Showing {filteredExpenses.length} of {expenses.length} expenses
          </div>
          <div className="text-lg font-bold text-indigo-600">
            Total: Rs. {totalExpenses.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Expense Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-800">
                {editingId ? 'Edit Expense' : 'Add New Expense'}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false)
                  setEditingId(null)
                }}
                className="text-slate-500 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Portal *</label>
                  <select
                    value={form.portal}
                    onChange={(e) => setForm(prev => ({ ...prev, portal: e.target.value }))}
                    className="w-full h-12 px-4 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    {PORTALS.map(portal => (
                      <option key={portal.value} value={portal.value}>{portal.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
                  <input
                    type="text"
                    value={form.category}
                    onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value }))}
                    placeholder="e.g., Utilities, Supplies, Salary"
                    className="w-full h-12 px-4 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of the expense"
                    className="w-full h-12 px-4 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount (Rs.) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full h-12 px-4 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full h-12 px-4 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={form.paymentMethod}
                    onChange={(e) => setForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                    className="w-full h-12 px-4 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option>Cash</option>
                    <option>Bank Transfer</option>
                    <option>Credit Card</option>
                    <option>Cheque</option>
                    <option>Other</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Additional notes (optional)"
                    rows="3"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 h-12 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : editingId ? 'Update Expense' : 'Add Expense'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingId(null)
                  }}
                  className="px-6 h-12 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expenses List */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Portal</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Category</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">Description</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase">Amount</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.map(expense => {
                const portal = PORTALS.find(p => p.value === expense.portal)
                return (
                  <tr key={expense.id || expense._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(expense.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold bg-${portal?.color}-100 text-${portal?.color}-700`}>
                        {portal?.label || expense.portal}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-700">{expense.category}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{expense.description}</td>
                    <td className="px-6 py-4 text-right text-sm font-bold text-slate-800">
                      Rs. {expense.amount?.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(expense)}
                          className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                          title="Edit"
                        >
                          <FiEdit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(expense.id || expense._id)}
                          className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition"
                          title="Delete"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {filteredExpenses.length === 0 && (
            <div className="text-center py-12">
              <FiDollarSign className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">No expenses found</p>
              <p className="text-slate-400 text-sm mt-1">Add your first expense to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
