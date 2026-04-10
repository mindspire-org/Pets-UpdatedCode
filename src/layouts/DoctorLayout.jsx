import React, { useState, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import DoctorSidebar from '../components/DoctorSidebar'
import DoctorTopbar from '../components/DoctorTopbar'

export default function DoctorLayout() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const auth = localStorage.getItem('doctor_auth')
    if (!auth) navigate('/doctor/login')
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
    <div className="flex flex-col h-screen bg-hospital-blue text-slate-800">
      <div className="print:hidden">
        <DoctorTopbar onToggle={handleToggle} />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="print:hidden">
          <DoctorSidebar collapsed={collapsed} open={open} onClose={()=>setOpen(false)} />
        </div>
        <main className="flex-1 overflow-y-auto p-4 md:p-6 print:p-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
