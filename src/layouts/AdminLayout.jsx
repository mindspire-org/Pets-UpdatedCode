import React, { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import AdminSidebar from '../components/AdminSidebar'
import AdminTopbar from '../components/AdminTopbar'
import { useActivity } from '../context/ActivityContext'
import DaySessionBanner from '../components/DaySessionBanner'
import { loadSidebarConfig, matchSidebarItemByPath } from '../utils/sidebarConfig'

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false) // mobile drawer
  const [collapsed, setCollapsed] = useState(false) // desktop collapsed icon-only
  const { addActivity } = useActivity()
  const [sidebarConfig, setSidebarConfig] = useState(null)

  useEffect(() => {
    const auth = localStorage.getItem('admin_auth')
    if (!auth) navigate('/admin/login', { replace: true })
  }, [navigate])

  useEffect(() => {
    try {
      const auth = JSON.parse(localStorage.getItem('admin_auth') || '{}')
      if (!auth?.username) return
      const role = auth.role?.toLowerCase()
      const hasPortalAccess = Array.isArray(auth.portalAccess)
        ? auth.portalAccess.map(p => String(p).toLowerCase()).includes('admin')
        : false
      if (role !== 'admin' || !hasPortalAccess) {
        navigate('/admin/login', { replace: true })
      }
    } catch {
      navigate('/admin/login', { replace: true })
    }
  }, [navigate])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const cfg = await loadSidebarConfig('admin')
      if (mounted) setSidebarConfig(cfg)
    })()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    try {
      const auth = JSON.parse(localStorage.getItem('admin_auth') || '{}')
      if (!auth?.role) return
      if (auth.role?.toLowerCase() === 'admin') return
      if (!sidebarConfig) return

      const item = matchSidebarItemByPath(sidebarConfig, location.pathname)
      if (!item) return
      const allowed = auth.sidebarPermissions?.admin
      if (!Array.isArray(allowed)) {
        navigate('/admin', { replace: true })
        return
      }
      if (!allowed.includes(item.id)) navigate('/admin', { replace: true })
    } catch {}
  }, [location.pathname, navigate, sidebarConfig])
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
          <AdminSidebar sidebarConfig={sidebarConfig} collapsed={collapsed} open={open} onClose={()=>setOpen(false)} onLogout={handleLogout} />
        </div>
        <main className="flex-1 overflow-y-auto min-w-0 p-4 md:p-6 print:p-0">
          <DaySessionBanner portal="admin" userName="Main Admin" />
          <Outlet />
        </main>
      </div>
    </div>
  )
}

