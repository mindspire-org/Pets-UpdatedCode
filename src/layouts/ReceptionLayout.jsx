import React, { useState, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import ReceptionSidebar from '../components/ReceptionSidebar'
import ReceptionTopbar from '../components/ReceptionTopbar'
import DaySessionBanner from '../components/DaySessionBanner'

export default function ReceptionLayout() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    // auth guard
    const auth = localStorage.getItem('reception_auth')
    if (!auth) navigate('/reception/login')
  }, [navigate])

  const handleToggle = () => {
    const isDesktop = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(min-width: 768px)').matches
    if (isDesktop) {
      setCollapsed(v => !v)
    } else {
      setOpen(v => !v)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-hospital-blue text-slate-800 overflow-x-hidden">
      <div className="print:hidden">
        <ReceptionTopbar onToggle={handleToggle} />
      </div>
      <div className="flex flex-1 overflow-hidden min-w-0 w-full">
        <div className="print:hidden">
          <ReceptionSidebar collapsed={collapsed} open={open} onClose={()=>setOpen(false)} />
        </div>
        <main className="flex-1 overflow-y-auto min-w-0 p-4 md:p-6 print:p-0">
          <DaySessionBanner
            portal="reception"
            userName={(JSON.parse(localStorage.getItem('reception_auth')||'{}').name)||'Reception Staff'}
          />
          <Outlet />
        </main>
      </div>
    </div>
  )
}