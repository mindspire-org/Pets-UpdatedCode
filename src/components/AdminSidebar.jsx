import React from 'react'
import { NavLink } from 'react-router-dom'
import { FiGrid, FiUsers, FiBookOpen, FiDollarSign, FiBox, FiActivity, FiLogOut, FiSettings, FiTrendingDown, FiUserCheck, FiHome, FiClock, FiUserPlus } from 'react-icons/fi'
import { useSettings } from '../context/SettingsContext'

export default function AdminSidebar({ onLogout, open = false, onClose = () => {}, collapsed = false, onCollapse = () => {} }) {
  const { settings } = useSettings()
  const linkClass = ({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl transition text-sm font-medium ${
    isActive ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'
  }`
  const iconSize = collapsed ? 19 : 18
  const iconClass = collapsed ? 'transition-transform hover:scale-110' : ''

  const Nav = (
    <nav className="space-y-1">
      <NavLink to="/admin" end className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiGrid size={iconSize} className={iconClass} /> {!collapsed && <span>Dashboard</span>}
      </NavLink>
      <NavLink to="/admin/users" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiUsers size={iconSize} className={iconClass} /> {!collapsed && <span>Users</span>}
      </NavLink>
      <NavLink to="/admin/doctors" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiUserCheck size={iconSize} className={iconClass} /> {!collapsed && <span>Doctors</span>}
      </NavLink>
      <NavLink to="/admin/staff" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiUserPlus size={iconSize} className={iconClass} /> {!collapsed && <span>Staff Management</span>}
      </NavLink>
      <NavLink to="/admin/pets" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiBookOpen size={iconSize} className={iconClass} /> {!collapsed && <span>Pets Records</span>}
      </NavLink>
      <NavLink to="/admin/clients" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiUserCheck size={iconSize} className={iconClass} /> {!collapsed && <span>Clients Directory</span>}
      </NavLink>
      <NavLink to="/admin/financials" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiDollarSign size={iconSize} className={iconClass} /> {!collapsed && <span>Financial Reports</span>}
      </NavLink>
      <NavLink to="/admin/finance-center" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiDollarSign size={iconSize} className={iconClass} /> {!collapsed && <span>Finance and Center</span>}
      </NavLink>
      <NavLink to="/admin/accounting-overview" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiDollarSign size={iconSize} className={iconClass} /> {!collapsed && <span>Accounting Overview</span>}
      </NavLink>
      <NavLink to="/admin/chart-of-accounts" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiBookOpen size={iconSize} className={iconClass} /> {!collapsed && <span>Chart of Accounts</span>}
      </NavLink>
      <NavLink to="/admin/vouchers" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiDollarSign size={iconSize} className={iconClass} /> {!collapsed && <span>Vouchers</span>}
      </NavLink>
      <NavLink to="/admin/petty-cash" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiDollarSign size={iconSize} className={iconClass} /> {!collapsed && <span>Petty Cash</span>}
      </NavLink>
      <NavLink to="/admin/suppliers" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiUsers size={iconSize} className={iconClass} /> {!collapsed && <span>Suppliers</span>}
      </NavLink>
      <NavLink to="/admin/receivables" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiDollarSign size={iconSize} className={iconClass} /> {!collapsed && <span>Receivables</span>}
      </NavLink>
      <NavLink to="/admin/payables" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiDollarSign size={iconSize} className={iconClass} /> {!collapsed && <span>Payables</span>}
      </NavLink>
      <NavLink to="/admin/vendor-payments" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiDollarSign size={iconSize} className={iconClass} /> {!collapsed && <span>Vendor Payments</span>}
      </NavLink>
      <NavLink to="/admin/budget-planner" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiDollarSign size={iconSize} className={iconClass} /> {!collapsed && <span>Budget Planner</span>}
      </NavLink>
      <NavLink to="/admin/staff-advances" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiDollarSign size={iconSize} className={iconClass} /> {!collapsed && <span>Staff Advances</span>}
      </NavLink>
      <NavLink to="/admin/day-sessions" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiClock size={iconSize} className={iconClass} /> {!collapsed && <span>Day Sessions</span>}
      </NavLink>
      <NavLink to="/admin/expenses" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiTrendingDown size={iconSize} className={iconClass} /> {!collapsed && <span>Expenses</span>}
      </NavLink>
      <NavLink to="/admin/inventory" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiBox size={iconSize} className={iconClass} /> {!collapsed && <span>Inventory</span>}
      </NavLink>
      <NavLink to="/admin/hospital-inventory" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiHome size={iconSize} className={iconClass} /> {!collapsed && <span>Hospital Inventory</span>}
      </NavLink>
      <NavLink to="/admin/logs" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiActivity size={iconSize} className={iconClass} /> {!collapsed && <span>System Logs</span>}
      </NavLink>
      <NavLink to="/admin/settings" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiSettings size={iconSize} className={iconClass} /> {!collapsed && <span>Settings</span>}
      </NavLink>
      <button onClick={onLogout} className={`${collapsed ? 'justify-center px-2' : ''} w-full mt-4 flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 hover:bg-red-50 hover:text-red-600 transition text-sm font-medium`}>
        <FiLogOut size={iconSize} className={iconClass} /> {!collapsed && <span>Logout</span>}
      </button>
    </nav>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={`h-full ${collapsed ? 'w-20' : 'w-64'} bg-white/80 backdrop-blur border-r border-slate-200 p-3 hidden md:block transition-all overflow-y-auto`}>
        {Nav}
      </aside>

      {/* Mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 bg-white p-3 border-r border-slate-200 shadow-xl md:hidden transform transition-transform duration-200 overflow-y-auto ${open ? 'translate-x-0' : '-translate-x-full'}`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-end">
          <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-md border border-slate-300 text-slate-600" aria-label="Close sidebar">×</button>
        </div>
        <div className="mt-2">{Nav}</div>
      </aside>
    </>
  )
}

