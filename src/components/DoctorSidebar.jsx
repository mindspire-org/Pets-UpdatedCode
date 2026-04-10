import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { FiGrid, FiLogOut, FiFileText, FiUser, FiClipboard, FiLayers, FiSettings } from 'react-icons/fi'

export default function DoctorSidebar({ collapsed=false, open=false, onClose=()=>{} }){
  const navigate = useNavigate()
  const linkClass = ({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl transition text-sm font-medium ${isActive ? 'bg-emerald-600 text-white shadow' : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'}`
  const iconSize = collapsed ? 19 : 18
  const iconClass = collapsed ? 'transition-transform hover:scale-110' : ''

  const logout = () => {
    localStorage.removeItem('portal')
    localStorage.removeItem('doctor_auth')
    navigate('/doctor/login')
  }

  const Nav = (
    <nav className="space-y-1">
      <NavLink to="/doctor" end className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiGrid size={iconSize} className={iconClass} /> {!collapsed && <span>Dashboard</span>}
      </NavLink>
      <NavLink to="/doctor/medicines" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiLayers size={iconSize} className={iconClass} /> {!collapsed && <span>Medicines</span>}
      </NavLink>
      <NavLink to="/doctor/prescription" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiFileText size={iconSize} className={iconClass} /> {!collapsed && <span>Prescription</span>}
      </NavLink>
      <NavLink to="/doctor/medical-forms" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiClipboard size={iconSize} className={iconClass} /> {!collapsed && <span>Medical Forms</span>}
      </NavLink>
      <NavLink to="/doctor/details" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiUser size={iconSize} className={iconClass} /> {!collapsed && <span>Doctor Details</span>}
      </NavLink>
      <NavLink to="/doctor/patients" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiClipboard size={iconSize} className={iconClass} /> {!collapsed && <span>Patients</span>}
      </NavLink>
      <NavLink to="/doctor/settings" className={({isActive}) => `${linkClass({isActive})} ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiSettings size={iconSize} className={iconClass} /> {!collapsed && <span>Settings</span>}
      </NavLink>
      <button onClick={logout} className={`${collapsed ? 'justify-center px-2' : ''} w-full mt-4 flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 hover:bg-red-50 hover:text-red-600 transition text-sm font-medium`}>
        <FiLogOut size={iconSize} className={iconClass} /> {!collapsed && <span>Logout</span>}
      </button>
    </nav>
  )

  return (
    <>
      <aside className={`h-full ${collapsed ? 'w-20' : 'w-64'} bg-white/80 backdrop-blur border-r border-slate-200 p-3 hidden md:block transition-all overflow-y-auto`}>
        {Nav}
      </aside>
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-white p-3 border-r border-slate-200 shadow-xl md:hidden transform transition-transform duration-200 overflow-y-auto ${open ? 'translate-x-0' : '-translate-x-full'}`} role="dialog" aria-modal="true">
        <div className="flex items-center justify-end">
          <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-md border border-slate-300 text-slate-600" aria-label="Close sidebar">×</button>
        </div>
        <div className="mt-2">{Nav}</div>
      </aside>
    </>
  )
}
