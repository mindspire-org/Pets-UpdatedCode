import React, { useState, useEffect } from 'react'
import { FiTrendingDown, FiCalendar, FiDollarSign } from 'react-icons/fi'
import { expensesAPI } from '../services/api'

export default function ExpenseCard({ portal, title, color = 'red' }) {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadExpenses()
  }, [portal])

  const loadExpenses = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Try API first
      try {
        const response = await expensesAPI.getByPortal(portal)
        if (response && response.data) {
          setExpenses(response.data)
          return
        }
      } catch (apiError) {
        console.log(`API not available for ${portal} expenses, using localStorage`)
      }
      
      // Fallback to localStorage
      const stored = localStorage.getItem('admin_expenses')
      if (stored) {
        const allExpenses = JSON.parse(stored)
        setExpenses(allExpenses.filter(e => e.portal === portal))
      } else {
        setExpenses([])
      }
    } catch (err) {
      console.error(`Error loading ${portal} expenses:`, err)
      setError('Failed to load expenses')
      setExpenses([])
    } finally {
      setLoading(false)
    }
  }

  // Calculate today's expenses
  const today = new Date().toISOString().slice(0, 10)
  const todayExpenses = expenses.filter(exp => exp.date === today)
  const todayTotal = todayExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0)

  // Calculate this month's expenses
  const thisMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
  const monthExpenses = expenses.filter(exp => exp.date?.startsWith(thisMonth))
  const monthTotal = monthExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0)

  // Get recent expenses (last 3)
  const recentExpenses = expenses
    .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))
    .slice(0, 3)

  const colorMap = {
    red: {
      bg: 'from-red-50 to-rose-50',
      border: 'border-red-200',
      text: 'text-red-700',
      icon: 'text-red-600',
      accent: 'bg-red-100 text-red-700'
    },
    orange: {
      bg: 'from-orange-50 to-amber-50',
      border: 'border-orange-200',
      text: 'text-orange-700',
      icon: 'text-orange-600',
      accent: 'bg-orange-100 text-orange-700'
    },
    blue: {
      bg: 'from-blue-50 to-sky-50',
      border: 'border-blue-200',
      text: 'text-blue-700',
      icon: 'text-blue-600',
      accent: 'bg-blue-100 text-blue-700'
    },
    purple: {
      bg: 'from-purple-50 to-violet-50',
      border: 'border-purple-200',
      text: 'text-purple-700',
      icon: 'text-purple-600',
      accent: 'bg-purple-100 text-purple-700'
    },
    green: {
      bg: 'from-green-50 to-emerald-50',
      border: 'border-green-200',
      text: 'text-green-700',
      icon: 'text-green-600',
      accent: 'bg-green-100 text-green-700'
    },
    slate: {
      bg: 'from-slate-50 to-gray-50',
      border: 'border-slate-200',
      text: 'text-slate-700',
      icon: 'text-slate-600',
      accent: 'bg-slate-100 text-slate-700'
    }
  }

  const colors = colorMap[color] || colorMap.red

  if (loading) {
    return (
      <div className={`rounded-xl p-4 bg-gradient-to-br ${colors.bg} border ${colors.border} shadow-sm`}>
        <div className="animate-pulse">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 bg-gray-300 rounded"></div>
            <div className="h-4 bg-gray-300 rounded w-20"></div>
          </div>
          <div className="h-6 bg-gray-300 rounded w-16 mb-2"></div>
          <div className="h-3 bg-gray-300 rounded w-24"></div>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-xl p-4 bg-gradient-to-br ${colors.bg} border ${colors.border} shadow-sm hover:shadow-md transition-shadow`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FiTrendingDown className={`w-5 h-5 ${colors.icon}`} />
          <span className={`font-semibold text-sm ${colors.text}`}>{title} Expenses</span>
        </div>
        {error && (
          <div className="text-xs text-red-500" title={error}>⚠</div>
        )}
      </div>

      {/* Today's Total */}
      <div className="mb-3">
        <div className={`text-2xl font-bold ${colors.text}`}>
          Rs. {todayTotal.toLocaleString()}
        </div>
        <div className="text-xs text-slate-500 flex items-center gap-1">
          <FiCalendar className="w-3 h-3" />
          Today ({todayExpenses.length} expenses)
        </div>
      </div>

      {/* Month Summary */}
      <div className="mb-3 pb-3 border-b border-slate-200">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-600">This Month</span>
          <span className={`font-semibold ${colors.text}`}>
            Rs. {monthTotal.toLocaleString()}
          </span>
        </div>
        <div className="text-xs text-slate-500 mt-1">
          {monthExpenses.length} total expenses
        </div>
      </div>

      {/* Recent Expenses */}
      {recentExpenses.length > 0 && (
        <div>
          <div className="text-xs font-medium text-slate-600 mb-2">Recent</div>
          <div className="space-y-1">
            {recentExpenses.map((expense, idx) => (
              <div key={expense.id || expense._id || idx} className="flex items-center justify-between text-xs">
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium text-slate-700">
                    {expense.description || expense.category}
                  </div>
                  <div className="text-slate-500">
                    {new Date(expense.date || expense.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className={`font-semibold ${colors.text} ml-2`}>
                  Rs. {(expense.amount || 0).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No expenses message */}
      {expenses.length === 0 && !loading && (
        <div className="text-center py-2">
          <FiDollarSign className="w-8 h-8 text-slate-300 mx-auto mb-1" />
          <div className="text-xs text-slate-500">No expenses recorded</div>
        </div>
      )}
    </div>
  )
}
