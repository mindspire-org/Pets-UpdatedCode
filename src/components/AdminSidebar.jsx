import React, { useMemo } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { 
  FiGrid, FiUsers, FiBookOpen, FiDollarSign, FiBox, FiActivity, 
  FiLogOut, FiSettings, FiTrendingDown, FiUserCheck, FiHome, 
  FiClock, FiUserPlus, FiShield, FiFileText, FiCalendar, FiBarChart2, FiClipboard
} from 'react-icons/fi'
import { useSettings } from '../context/SettingsContext'
import { usePermissions } from '../hooks/usePermissions'

export default function AdminSidebar({ onLogout, open = false, onClose = () => {}, collapsed = false }) {
  const { settings } = useSettings()
  const location = useLocation()
  const permissions = usePermissions('admin')

  const isActive = (path, exact = false) => {
    if (exact) return location.pathname === path
    return location.pathname.startsWith(path)
  }

  // Hardcoded groups to match exactly what was requested
  const menuGroups = useMemo(() => {
    const allGroups = [
      {
        id: "dashboard",
        title: null,
        items: [
          { id: "dashboard", label: "Dashboard", path: "/admin", icon: FiGrid, end: true },
        ],
      },
      {
        id: "pets-clients",
        title: "Pets & Clients",
        items: [
          { id: "pets", label: "Pets Records", path: "/admin/pets", icon: FiBookOpen },
          { id: "clients", label: "Clients Directory", path: "/admin/clients", icon: FiUserCheck },
        ],
      },
      {
        id: "inventory",
        title: "Inventory",
        items: [
          { id: "inventory", label: "Inventory", path: "/admin/inventory", icon: FiBox },
          { id: "hospital-inventory", label: "Hospital Inventory", path: "/admin/hospital-inventory", icon: FiHome },
        ],
      },
      {
        id: "accounts-finance",
        title: "Accounts & Finance",
        items: [
          { id: "financials", label: "Financial Reports", path: "/admin/financials", icon: FiDollarSign },
          { id: "finance-center", label: "Finance and Center", path: "/admin/finance-center", icon: FiDollarSign },
          { id: "accounting-overview", label: "Accounting Overview", path: "/admin/accounting-overview", icon: FiDollarSign },
          { id: "chart-of-accounts", label: "Chart of Accounts", path: "/admin/chart-of-accounts", icon: FiBookOpen },
          { id: "vouchers", label: "Vouchers", path: "/admin/vouchers", icon: FiDollarSign },
          { id: "petty-cash", label: "Petty Cash", path: "/admin/petty-cash", icon: FiDollarSign },
          { id: "suppliers", label: "Suppliers", path: "/admin/suppliers", icon: FiUsers },
          { id: "receivables", label: "Receivables", path: "/admin/receivables", icon: FiDollarSign },
          { id: "payables", label: "Payables", path: "/admin/payables", icon: FiDollarSign },
          { id: "vendor-payments", label: "Vendor Payments", path: "/admin/vendor-payments", icon: FiDollarSign },
          { id: "budget-planner", label: "Budget Planner", path: "/admin/budget-planner", icon: FiDollarSign },
          { id: "staff-advances", label: "Staff Advances", path: "/admin/staff-advances", icon: FiDollarSign },
          { id: "day-sessions", label: "Day Sessions", path: "/admin/day-sessions", icon: FiClock },
          { id: "expenses", label: "Expenses", path: "/admin/expenses", icon: FiTrendingDown },
        ],
      },
      {
        id: "staff-management",
        title: "Staff Management",
        items: [
          { id: "doctors", label: "Doctors", path: "/admin/doctors", icon: FiUserCheck },
          { id: "staff", label: "Staff", path: "/admin/staff", icon: FiUserPlus },
        ],
      },
      {
        id: "user-management",
        title: "User Management",
        items: [
          { id: "users", label: "Users", path: "/admin/users", icon: FiUsers },
          { id: "sidebar-permissions", label: "Sidebar Permissions", path: "/admin/sidebar-permissions", icon: FiShield },
        ],
      },
      {
        id: "other",
        title: "Other",
        items: [
          { id: "logs", label: "System Logs", path: "/admin/logs", icon: FiActivity },
          { id: "settings", label: "Settings", path: "/admin/settings", icon: FiSettings },
        ],
      },
    ]

    // Filter menu groups based on permissions
    return permissions.filterMenuGroups(allGroups)
  }, [permissions])

  const Nav = (
    <nav className="flex-1 overflow-y-auto custom-sidebar-scrollbar py-4">
      {menuGroups.length === 0 ? (
        <div className="p-6 text-center">
          <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <FiSettings className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-sm text-slate-500 font-medium">No pages available</p>
          <p className="text-xs text-slate-400 mt-1">Contact administrator for access</p>
        </div>
      ) : (
        menuGroups.map((group, groupIdx) => (
          <div key={group.id} className={`${groupIdx !== 0 ? 'mt-6' : ''}`}>
            {!collapsed && group.title && (
              <div className="px-6 mb-2">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em]">
                  {group.title}
                </h3>
              </div>
            )}
            <div className="px-3 space-y-1">
              {group.items.map(item => {
                const active = isActive(item.path, item.end)
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.end}
                    className={() =>
                      `flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${
                        active
                          ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-100'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'
                      } ${collapsed ? 'justify-center' : ''}`
                    }
                    onClick={onClose}
                    title={collapsed ? item.label : ''}
                  >
                    <div className={`flex items-center justify-center ${collapsed ? 'mx-auto' : ''}`}>
                      <Icon
                        className={`${active ? 'w-5 h-5 text-white' : 'w-5 h-5 text-slate-400 group-hover:text-indigo-500'}`}
                        strokeWidth={active ? 2.5 : 2}
                      />
                    </div>
                    {!collapsed && (
                      <span className={`text-[13px] ${active ? 'font-bold' : 'font-semibold'}`}>
                        {item.label}
                      </span>
                    )}
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))
      )}

      {/* Logout Button */}
      <div className="px-3 mt-8 pb-4">
        <button
          onClick={onLogout}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-red-600 hover:bg-red-50 transition-all border border-transparent hover:border-red-100 ${collapsed ? 'justify-center' : ''}`}
          title={collapsed ? 'Logout' : ''}
        >
          <FiLogOut className="w-5 h-5" />
          {!collapsed && <span className="text-[13px] font-bold">Logout</span>}
        </button>
      </div>
    </nav>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={`h-full ${collapsed ? 'w-20' : 'w-64'} bg-white/80 backdrop-blur border-r border-slate-200 p-3 hidden md:flex flex-col transition-all`}>
        {Nav}
      </aside>

      {/* Mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 bg-white p-3 border-r border-slate-200 shadow-xl md:hidden transform transition-transform duration-200 flex flex-col ${open ? 'translate-x-0' : '-translate-x-full'}`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-end mb-2">
          <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-md border border-slate-300 text-slate-600" aria-label="Close sidebar">×</button>
        </div>
        {Nav}
      </aside>
    </>
  )
}

