import React, { useMemo } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { FiGrid, FiUsers, FiBookOpen, FiDollarSign, FiBox, FiActivity, FiLogOut, FiSettings, FiTrendingDown, FiUserCheck, FiHome, FiClock, FiUserPlus, FiShield } from 'react-icons/fi'
import { useSettings } from '../context/SettingsContext'

export default function AdminSidebar({ sidebarConfig = null, onLogout, open = false, onClose = () => {}, collapsed = false, onCollapse = () => {} }) {
  const { settings } = useSettings()
  const location = useLocation()
  const auth = JSON.parse(localStorage.getItem('admin_auth') || '{}')

  const iconSize = collapsed ? 19 : 18
  const iconClass = collapsed ? 'transition-transform hover:scale-110' : ''

  const iconMap = {
    FiGrid,
    FiUsers,
    FiBookOpen,
    FiDollarSign,
    FiBox,
    FiActivity,
    FiSettings,
    FiTrendingDown,
    FiUserCheck,
    FiHome,
    FiClock,
    FiUserPlus,
    FiShield,
  }

  const isActive = (path, exact = false) => {
    if (exact) {
      return location.pathname === path
    }
    return location.pathname.startsWith(path)
  }

  const menuGroups = useMemo(() => {
    const groups = (sidebarConfig?.groups || [])
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0))

    const isAdmin = auth.role === 'admin' || auth.role === 'Admin'
    const permissions = auth.sidebarPermissions?.admin

    return groups
      .map(group => {
        const items = (group.items || [])
          .filter(it => it?.isVisible !== false)
          .slice()
          .sort((a, b) => (a.order || 0) - (b.order || 0))
          .map(it => {
            const Icon = iconMap[it.iconKey] || FiGrid
            return { to: it.path, icon: Icon, label: it.label, end: !!it.end, id: it.id }
          })
          .filter(item => {
            if (isAdmin) return true
            if (!Array.isArray(permissions)) return false
            return permissions.includes(item.id)
          })

        return { ...group, items }
      })
      .filter(group => group.items.length > 0)
  }, [auth.role, auth.sidebarPermissions, sidebarConfig])

  const Nav = (
    <nav className="flex-1 overflow-y-auto">
      {menuGroups.map((group, groupIdx) => (
        <div key={group.id || group.title} className={`${groupIdx !== 0 ? 'mt-6' : ''}`}>
          {!collapsed && group.title && (
            <div className="px-4 mb-2">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em]">
                {group.title}
              </h3>
            </div>
          )}
          <div className="px-2 space-y-1">
            {group.items.map(item => {
              const active = isActive(item.to, item.end)
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive: navActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${
                      navActive || active
                        ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-100'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'
                    } ${collapsed ? 'justify-center' : ''}`
                  }
                  onClick={onClose}
                  title={collapsed ? item.label : ''}
                >
                  <div className={`flex items-center justify-center ${collapsed ? 'mx-auto' : ''}`}>
                    <item.icon
                      className={`${active ? 'w-5 h-5' : 'w-5 h-5 text-slate-400'}`}
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
      ))}

      {/* Logout Button */}
      <div className="px-2 mt-8 pb-4">
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

