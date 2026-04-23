import React, { useState, useEffect } from 'react';
import { FiSearch, FiRefreshCw, FiFileText, FiDownload, FiActivity, FiFilter, FiUser, FiCalendar, FiClock } from 'react-icons/fi';
import { activityLogsAPI } from '../../services/api';

export default function PharmacyAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('All Actions');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      // We'll use the generic getAll or getByUser('pharmacy') if appropriate
      // For now, let's get all and filter locally for pharmacy related actions if needed
      const response = await activityLogsAPI.getAll();
      setLogs(response.data || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  // Extract unique actions for the filter dropdown
  const actions = ['All Actions', ...new Set(logs.map(log => {
    const parts = log.text.split(' ');
    return parts[0]; // Heuristic for action type
  }))].slice(0, 15);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.text.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         log.user.toLowerCase().includes(searchTerm.toLowerCase());
    
    const actionPart = log.text.split(' ')[0];
    const matchesAction = actionFilter === 'All Actions' || actionPart === actionFilter;
    
    // Simple date filtering (heuristic parsing of log.when "YYYY-MM-DD HH:MM")
    let matchesDate = true;
    if (dateRange.from || dateRange.to) {
      const logDate = new Date(log.when);
      if (dateRange.from && logDate < new Date(dateRange.from)) matchesDate = false;
      if (dateRange.to) {
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        if (logDate > toDate) matchesDate = false;
      }
    }

    return matchesSearch && matchesAction && matchesDate;
  }).slice(0, limit);

  const getActionColor = (text) => {
    const t = text.toLowerCase();
    if (t.includes('login')) return 'bg-blue-100 text-blue-700';
    if (t.includes('create') || t.includes('add') || t.includes('sale')) return 'bg-green-100 text-green-700';
    if (t.includes('delete') || t.includes('remove')) return 'bg-red-100 text-red-700';
    if (t.includes('update') || t.includes('edit')) return 'bg-amber-100 text-amber-700';
    if (t.includes('return')) return 'bg-purple-100 text-purple-700';
    return 'bg-slate-100 text-slate-700';
  };

  const exportToExcel = () => {
    const headers = ['ID', 'User', 'Action', 'Timestamp'];
    const rows = filteredLogs.map(log => [log.id, log.user, log.text, log.when]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-900 bg-clip-text text-transparent">
          Audit Logs
        </h1>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 border-2 border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all active:scale-95"
          >
            <FiDownload /> Export Logs PDF
          </button>
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 border-2 border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all active:scale-95"
          >
            <FiDownload /> Export Logs Excel
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
          <div className="md:col-span-1">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Search logs...</label>
            <div className="relative">
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..." 
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-blue-500 focus:ring-0 outline-none transition-all"
              />
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          <div className="md:col-span-1">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Action</label>
            <select 
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-blue-500 focus:ring-0 outline-none transition-all appearance-none cursor-pointer"
            >
              {actions.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div className="md:col-span-1">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">From</label>
            <input 
              type="date" 
              value={dateRange.from}
              onChange={(e) => setDateRange({...dateRange, from: e.target.value})}
              className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-blue-500 outline-none transition-all"
            />
          </div>

          <div className="md:col-span-1">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">To</label>
            <input 
              type="date" 
              value={dateRange.to}
              onChange={(e) => setDateRange({...dateRange, to: e.target.value})}
              className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-blue-500 outline-none transition-all"
            />
          </div>

          <div className="md:col-span-1">
            <select 
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-blue-500 outline-none transition-all"
            >
              <option value={10}>10</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={500}>500</option>
            </select>
          </div>

          <button 
            onClick={fetchLogs}
            className="md:col-span-1 flex items-center justify-center gap-2 py-2 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-all active:scale-95 shadow-lg shadow-slate-200"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Logs Content */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
          <FiActivity className="text-slate-400" />
          <h2 className="font-bold text-slate-700">System Activity</h2>
        </div>

        <div className="flex flex-col">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-10 h-10 border-4 border-slate-800 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-slate-500 font-medium">Loading activity logs...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <FiFileText className="w-16 h-16 text-slate-200 mb-4" />
              <p className="text-lg font-bold text-slate-400">No logs found</p>
              <p className="text-sm text-slate-400">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredLogs.map((log) => {
                const actionPart = log.text.split(' ')[0];
                const restOfText = log.text.substring(actionPart.length);
                
                return (
                  <div key={log.id} className="p-6 hover:bg-slate-50/80 transition-all group">
                    <div className="flex items-start gap-5">
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <FiUser className="w-6 h-6 text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="font-bold text-slate-800 tracking-tight">{log.user}</span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest ${getActionColor(actionPart)}`}>
                            {actionPart}
                          </span>
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-black rounded uppercase tracking-widest">POST</span>
                          <span className="text-[10px] font-mono text-slate-400">/api/pharmacy/{actionPart.toLowerCase()}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mb-1">
                          <FiClock className="w-3 h-3" />
                          {log.when} — {restOfText}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
