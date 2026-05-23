import React, { useMemo } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { FiGrid, FiUserPlus, FiCalendar, FiFileText, FiLogOut, FiClipboard, FiUsers, FiSettings, FiBell } from 'react-icons/fi'

export default function ReceptionSidebar({ open = false, onClose = () => {}, collapsed = false }) {
  const navigate = useNavigate()
  const auth = JSON.parse(localStorage.getItem('reception_auth') || '{}')
  const role = auth.role?.toLowerCase()

  const linkClass = ({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl transition text-sm font-medium ${
    isActive ? 'bg-sky-600 text-white shadow' : 'text-slate-600 hover:bg-sky-50 hover:text-sky-700'
  }`

  const handleLogout = () => {
    localStorage.removeItem('portal')
    localStorage.removeItem('reception_auth')
    navigate('/reception/login')
  }

  const menuItems = useMemo(() => {
    const allItems = [
      { to: "/reception", icon: FiGrid, label: "Dashboard", end: true, id: 'dashboard' },
      { to: "/reception/pets", icon: FiUserPlus, label: "Pets Registration", id: 'pets' },
      { to: "/reception/clients", icon: FiUsers, label: "Clients Directory", id: 'clients' },
      { to: "/reception/appointments", icon: FiCalendar, label: "Appointments", id: 'appointments' },
      { to: "/reception/visits", icon: FiFileText, label: "Visit Records", id: 'visits' },
      { to: "/reception/forms", icon: FiClipboard, label: "Medical Forms", id: 'forms' },
      { to: "/reception/procedures", icon: FiClipboard, label: "Procedure Patients", id: 'procedures' },
      { to: "/reception/procedure-catalog", icon: FiClipboard, label: "Procedure Catalog", id: 'procedure-catalog' },
      { to: "/reception/procedure-patients", icon: FiUsers, label: "Procedure Profile", id: 'procedure-patients' },
      { to: "/reception/shots-reminder", icon: FiBell, label: "Shots Reminder", id: 'shots-reminder' },
      { to: "/reception/settings", icon: FiSettings, label: "Settings", id: 'settings' },
    ]

    // If user is admin, show all
    if (role === 'admin') return allItems;

    // Filter based on permissions
    const permissions = auth.sidebarPermissions?.reception;
    if (!Array.isArray(permissions)) return [];

    // Always show Shots Reminder, Procedure Patients and Procedure Catalog (reception operational features)
    return allItems.filter(item => ['shots-reminder', 'procedure-patients', 'procedure-catalog'].includes(item.id) || permissions.includes(item.id));
  }, [role, auth.sidebarPermissions]);

  const Nav = (
    <nav className="space-y-1">
      {menuItems.map(item => (
        <NavLink 
          key={item.to}
          to={item.to} 
          end={item.end}
          className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} 
          onClick={onClose}
        >
          <item.icon size={collapsed ? 19 : 18} className={collapsed ? 'transition-transform hover:scale-110' : ''} /> 
          {!collapsed && <span>{item.label}</span>}
        </NavLink>
      ))}
      <button onClick={handleLogout} className={`${collapsed ? 'justify-center px-2' : ''} w-full mt-4 flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 hover:bg-red-50 hover:text-red-600 transition text-sm font-medium`}>
        <FiLogOut size={collapsed ? 19 : 18} className={collapsed ? 'transition-transform hover:scale-110' : ''} /> {!collapsed && <span>Logout</span>}
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