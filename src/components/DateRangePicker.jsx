import React, { useState, useEffect } from 'react'
import { FiCalendar, FiRefreshCw } from 'react-icons/fi'

export default function DateRangePicker({ 
  onDateChange, 
  defaultFromDate = null, 
  defaultToDate = null,
  className = "",
  showTodayButton = true,
  showAllButton = false,
  onAllClick
}) {
  const today = new Date().toISOString().slice(0, 10)
  
  const [fromDate, setFromDate] = useState(defaultFromDate || today)
  const [toDate, setToDate] = useState(defaultToDate || today)

  useEffect(() => {
    // Notify parent component when dates change
    if (onDateChange) {
      onDateChange({ fromDate, toDate })
    }
  }, [fromDate, toDate])

  const handleTodayClick = () => {
    setFromDate(today)
    setToDate(today)
  }

  const handleAllClick = () => {
    const min = '1900-01-01'
    const max = '2999-12-31'
    setFromDate(min)
    setToDate(max)
    if (onAllClick) try { onAllClick() } catch {}
  }

  const handleFromDateChange = (e) => {
    const newFromDate = e.target.value
    setFromDate(newFromDate)
    
    // If from date is after to date, update to date
    if (newFromDate > toDate) {
      setToDate(newFromDate)
    }
  }

  const handleToDateChange = (e) => {
    const newToDate = e.target.value
    setToDate(newToDate)
    
    // If to date is before from date, update from date
    if (newToDate < fromDate) {
      setFromDate(newToDate)
    }
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-4 py-2 shadow-sm">
        <FiCalendar className="w-4 h-4 text-slate-500" />
        <span className="text-sm font-medium text-slate-600">From:</span>
        <input
          type="date"
          value={fromDate}
          onChange={handleFromDateChange}
          className="border-none outline-none bg-transparent text-sm font-medium text-slate-800"
        />
      </div>
      
      <div className="text-slate-400">—</div>
      
      <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-4 py-2 shadow-sm">
        <FiCalendar className="w-4 h-4 text-slate-500" />
        <span className="text-sm font-medium text-slate-600">To:</span>
        <input
          type="date"
          value={toDate}
          onChange={handleToDateChange}
          className="border-none outline-none bg-transparent text-sm font-medium text-slate-800"
        />
      </div>

      {showTodayButton && (
        <button
          onClick={handleTodayClick}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors text-sm font-medium shadow-sm"
        >
          <FiRefreshCw className="w-4 h-4" />
          Today
        </button>
      )}

      {showAllButton && (
        <button
          onClick={handleAllClick}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-xl hover:bg-slate-800 transition-colors text-sm font-medium shadow-sm"
        >
          All
        </button>
      )}
    </div>
  )
}
