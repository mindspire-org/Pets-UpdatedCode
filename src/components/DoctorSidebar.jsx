import React, { useMemo } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { FiGrid, FiLogOut, FiFileText, FiUser, FiClipboard, FiLayers, FiSettings, FiShield } from 'react-icons/fi'

export default function DoctorSidebar({ collapsed=false, open=false, onClose=()=>{} }){
  const navigate = useNavigate()
  const auth = JSON.parse(localStorage.getItem('doctor_auth') || '{}')
  const role = auth.role?.toLowerCase()

  const linkClass = ({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl transition text-sm font-medium ${isActive ? 'bg-emerald-600 text-white shadow' : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'}`
  const iconSize = collapsed ? 19 : 18
  const iconClass = collapsed ? 'transition-transform hover:scale-110' : ''

  const logout = () => {
    localStorage.removeItem('portal')
    localStorage.removeItem('doctor_auth')
    navigate('/doctor/login')
  }

  const menuItems = useMemo(() => {
    const allItems = [
      { to: "/doctor", icon: FiGrid, label: "Dashboard", end: true, id: 'dashboard' },
      { to: "/doctor/medicines", icon: FiLayers, label: "Medicines", id: 'medicines' },
      { to: "/doctor/vaccines", icon: FiShield, label: "Vaccines", id: 'vaccines' },
      { to: "/doctor/prescription", icon: FiFileText, label: "Prescription", id: 'prescription' },
      { to: "/doctor/prescription-history", icon: FiFileText, label: "Prescription History", id: 'prescription-history' },
      { to: "/doctor/medical-forms", icon: FiClipboard, label: "Medical Forms", id: 'medical-forms' },
      { to: "/doctor/details", icon: FiUser, label: "Doctor Details", id: 'details' },
      { to: "/doctor/patients", icon: FiClipboard, label: "Patients", id: 'patients' },
      { to: "/doctor/settings", icon: FiSettings, label: "Settings", id: 'settings' },
    ]

    // If user is admin, show all
    if (role === 'admin') return allItems;

    // Filter based on permissions
    let permissions = auth.sidebarPermissions?.doctor;
    if (!Array.isArray(permissions)) return [];

    // Ensure vaccines shows up if medicines is allowed
    if (permissions.includes('medicines') && !permissions.includes('vaccines')) {
      permissions = [...permissions, 'vaccines'];
    }

    // Ensure prescription-history shows up if prescription is allowed
    if (permissions.includes('prescription') && !permissions.includes('prescription-history')) {
      permissions = [...permissions, 'prescription-history'];
    }

    return allItems.filter(item => permissions.includes(item.id));
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
          <item.icon size={iconSize} className={iconClass} /> 
          {!collapsed && <span>{item.label}</span>}
        </NavLink>
      ))}
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
