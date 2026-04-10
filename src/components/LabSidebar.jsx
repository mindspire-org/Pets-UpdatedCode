import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { FiGrid, FiFilePlus, FiList, FiActivity, FiPackage, FiSettings, FiLogOut, FiImage, FiClipboard } from 'react-icons/fi'

export default function LabSidebar({ collapsed=false, open=false, onClose=()=>{} }){
  const navigate = useNavigate()
  const linkClass = ({ isActive }) => `flex items-center gap-3 px-3 h-10 rounded-xl transition text-sm font-medium whitespace-nowrap ${isActive ? 'bg-emerald-600 text-white shadow' : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'}`
  const iconSize = collapsed ? 19 : 18
  const iconClass = collapsed ? 'transition-transform hover:scale-110' : ''

  const logout = () => {
    localStorage.removeItem('portal')
    localStorage.removeItem('lab_auth')
    navigate('/lab/login')
  }

  const Nav = (
    <nav className="space-y-1">
      <NavLink to="/lab" end className={({isActive}) => `${linkClass({isActive})} min-w-0 ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiGrid size={iconSize} className={iconClass} /> {!collapsed && <span className="truncate">Dashboard</span>}
      </NavLink>
      <NavLink to="/lab/catalog" className={({isActive}) => `${linkClass({isActive})} min-w-0 ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiActivity size={iconSize} className={iconClass} /> {!collapsed && <span className="truncate">Test Catalog</span>}
      </NavLink>
      <NavLink to="/lab/add-report" className={({isActive}) => `${linkClass({isActive})} min-w-0 ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiFilePlus size={iconSize} className={iconClass} /> {!collapsed && <span className="truncate">Test Reports</span>}
      </NavLink>
      <NavLink to="/lab/radiology" className={({isActive}) => `${linkClass({isActive})} min-w-0 ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiImage size={iconSize} className={iconClass} /> {!collapsed && <span className="truncate">Radiology</span>}
      </NavLink>
      <NavLink to="/lab/inventory" className={({isActive}) => `${linkClass({isActive})} min-w-0 ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiPackage size={iconSize} className={iconClass} /> {!collapsed && <span className="truncate">Inventory</span>}
      </NavLink>
      <NavLink to="/lab/sample-intake" className={({isActive}) => `${linkClass({isActive})} min-w-0 ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiClipboard size={iconSize} className={iconClass} /> {!collapsed && <span className="truncate">Sample Intake</span>}
      </NavLink>
      <NavLink to="/lab/suppliers" className={({isActive}) => `${linkClass({isActive})} min-w-0 ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiList size={iconSize} className={iconClass} /> {!collapsed && <span className="truncate">Suppliers</span>}
      </NavLink>
      <NavLink to="/lab/settings" className={({isActive}) => `${linkClass({isActive})} min-w-0 ${collapsed ? 'justify-center px-2' : ''}`} onClick={onClose}>
        <FiSettings size={iconSize} className={iconClass} /> {!collapsed && <span className="truncate">Settings</span>}
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
