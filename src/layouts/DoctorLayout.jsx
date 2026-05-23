import React, { useState, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import DoctorSidebar from '../components/DoctorSidebar'
import DoctorTopbar from '../components/DoctorTopbar'
import { FiXCircle } from 'react-icons/fi'

export default function DoctorLayout() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const auth = localStorage.getItem('doctor_auth')
    if (!auth) navigate('/doctor/login')
  }, [navigate])

  const doctorUser = JSON.parse(localStorage.getItem('doctor_auth') || '{}')
  const isAdmin = doctorUser.role?.toLowerCase() === 'admin'
  const hasAccess = isAdmin || (Array.isArray(doctorUser.portalAccess) && doctorUser.portalAccess.map(p => String(p).toLowerCase()).includes('doctor'))

  if (doctorUser?.username && !hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center p-8 bg-white rounded-2xl shadow-lg border border-red-100">
          <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiXCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Access Denied</h2>
          <p className="text-slate-600">You don't have access to the Doctor Portal.</p>
          <p className="text-sm text-slate-500 mt-2">Contact your administrator to request access.</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Return to Home
          </button>
        </div>
      </div>
    )
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
