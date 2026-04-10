import React, { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import AdminSidebar from '../components/AdminSidebar'
import AdminTopbar from '../components/AdminTopbar'
import { useActivity } from '../context/ActivityContext'
import DaySessionBanner from '../components/DaySessionBanner'

export default function AdminLayout() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false) // mobile drawer
  const [collapsed, setCollapsed] = useState(false) // desktop collapsed icon-only
  const { addActivity } = useActivity()
  const handleLogout = () => {
    try { addActivity({ user: 'Admin', text: 'Logout' }) } catch {}
    localStorage.removeItem('portal')
    navigate('/admin/login')
  }

  const handleToggle = () => {
    const isDesktop = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(min-width: 768px)').matches
    if (isDesktop) {
      setCollapsed(v => !v)
    } else {
      setOpen(v => !v)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-hospital-blue text-slate-800">
      <div className="print:hidden">
        <AdminTopbar adminName="Main Admin" onLogout={handleLogout} onToggle={handleToggle} />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="print:hidden">
          <AdminSidebar collapsed={collapsed} open={open} onClose={()=>setOpen(false)} onLogout={handleLogout} />
        </div>
        <main className="flex-1 overflow-y-auto min-w-0 p-4 md:p-6 print:p-0">
          <DaySessionBanner portal="admin" userName="Main Admin" />
          <Outlet />
        </main>
      </div>
    </div>
  )
}

