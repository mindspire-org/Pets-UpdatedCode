import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { FiGrid, FiUserPlus, FiCalendar, FiFileText, FiLogOut, FiClipboard, FiUsers, FiSettings } from 'react-icons/fi'

export default function ReceptionSidebar({ open = false, onClose = () => {}, collapsed = false }) {
  const navigate = useNavigate()
  const linkClass = ({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl transition text-sm font-medium ${
    isActive ? 'bg-sky-600 text-white shadow' : 'text-slate-600 hover:bg-sky-50 hover:text-sky-700'
  }`

  const handleLogout = () => {
    localStorage.removeItem('portal')
    localStorage.removeItem('reception_auth')
    navigate('/reception/login')
  }

  const Nav = (
    <nav className="space-y-1">
      <NavLink to="/reception" end className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiGrid size={collapsed ? 19 : 18} className={collapsed ? 'transition-transform hover:scale-110' : ''} /> {!collapsed && <span>Dashboard</span>}
      </NavLink>
      <NavLink to="/reception/pets" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiUserPlus size={collapsed ? 19 : 18} className={collapsed ? 'transition-transform hover:scale-110' : ''} /> {!collapsed && <span>Pets Registration</span>}
      </NavLink>
      <NavLink to="/reception/clients" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiUsers size={collapsed ? 19 : 18} className={collapsed ? 'transition-transform hover:scale-110' : ''} /> {!collapsed && <span>Clients Directory</span>}
      </NavLink>
      <NavLink to="/reception/appointments" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiCalendar size={collapsed ? 19 : 18} className={collapsed ? 'transition-transform hover:scale-110' : ''} /> {!collapsed && <span>Appointments</span>}
      </NavLink>
      <NavLink to="/reception/visits" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiFileText size={collapsed ? 19 : 18} className={collapsed ? 'transition-transform hover:scale-110' : ''} /> {!collapsed && <span>Visit Records</span>}
      </NavLink>
      <NavLink to="/reception/forms" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiClipboard size={collapsed ? 19 : 18} className={collapsed ? 'transition-transform hover:scale-110' : ''} /> {!collapsed && <span>Medical Forms</span>}
      </NavLink>
      <NavLink to="/reception/procedures" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiClipboard size={collapsed ? 19 : 18} className={collapsed ? 'transition-transform hover:scale-110' : ''} /> {!collapsed && <span>Procedures</span>}
      </NavLink>
      <NavLink to="/reception/settings" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiSettings size={collapsed ? 19 : 18} className={collapsed ? 'transition-transform hover:scale-110' : ''} /> {!collapsed && <span>Settings</span>}
      </NavLink>
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