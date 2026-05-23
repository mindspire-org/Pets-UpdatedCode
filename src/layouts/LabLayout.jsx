import React, { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import LabSidebar from '../components/LabSidebar'
import LabTopbar from '../components/LabTopbar'
import DaySessionBanner from '../components/DaySessionBanner'
import { FiXCircle } from 'react-icons/fi'

export default function LabLayout(){
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(()=>{
    const auth = localStorage.getItem('lab_auth')
    if(!auth) navigate('/lab/login', { replace: true })
  }, [navigate])

  const labUser = JSON.parse(localStorage.getItem('lab_auth') || '{}')
  const isAdmin = labUser.role?.toLowerCase() === 'admin'
  const hasAccess = isAdmin || (Array.isArray(labUser.portalAccess) && labUser.portalAccess.map(p => String(p).toLowerCase()).includes('lab'))

  if (labUser?.username && !hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center p-8 bg-white rounded-2xl shadow-lg border border-red-100">
          <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiXCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Access Denied</h2>
          <p className="text-slate-600">You don't have access to the Lab Portal.</p>
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
    const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
    if (isDesktop) setCollapsed(v=>!v)
    else setOpen(v=>!v)
  }

  return (
    <div className="flex flex-col h-screen bg-hospital-blue text-slate-800">
      <LabTopbar onToggle={handleToggle} />
      <div className="flex flex-1 overflow-hidden">
        <LabSidebar collapsed={collapsed} open={open} onClose={()=>setOpen(false)} />
        <main className="flex-1 overflow-y-auto p-3 md:p-4">
          <DaySessionBanner portal="lab" userName={(JSON.parse(localStorage.getItem('lab_auth')||'{}').name)||'Lab Staff'} />
          <Outlet />
        </main>
      </div>
    </div>
  )
}
