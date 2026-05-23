import React, { useState, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import ReceptionSidebar from '../components/ReceptionSidebar'
import ReceptionTopbar from '../components/ReceptionTopbar'
import DaySessionBanner from '../components/DaySessionBanner'
import { FiXCircle, FiBell } from 'react-icons/fi'
import { shotRemindersAPI } from '../services/api'

export default function ReceptionLayout() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (message) => {
    setToast(message)
    setTimeout(() => setToast(''), 3500)
  }

  useEffect(() => {
    // auth guard
    const auth = localStorage.getItem('reception_auth')
    if (!auth) navigate('/reception/login')
  }, [navigate])

  useEffect(() => {
    const loadWithFallback = async (apiCall, localKey, fallback = []) => {
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('API timeout')), 2500)
        )
        const res = await Promise.race([apiCall(), timeoutPromise])
        const data = res?.data || fallback
        try { localStorage.setItem(localKey, JSON.stringify(data)) } catch {}
        return data
      } catch {
        try {
          const cached = JSON.parse(localStorage.getItem(localKey) || '[]')
          return Array.isArray(cached) ? cached : fallback
        } catch {
          return fallback
        }
      }
    }

    const checkShots = async () => {
      try {
        // Auto-sync reminders when portal loads
        await shotRemindersAPI.sync();

        const res = await shotRemindersAPI.getUpcoming()
        const { count, nextDueDate } = res
        
        try {
          localStorage.setItem(
            'reception_upcoming_shots_summary',
            JSON.stringify({
              count,
              nextDueDate: nextDueDate ? new Date(nextDueDate).toISOString() : null,
              updatedAt: new Date().toISOString(),
            })
          )
        } catch {}
        
        // Show notification if count increased or first time
        const prev = JSON.parse(localStorage.getItem('reception_shot_reminder_last_count') || '0')
        if (count > prev && count > 0) {
          showToast(`Reminder: ${count} upcoming vaccine shot(s) within 2 days`)
        }
        localStorage.setItem('reception_shot_reminder_last_count', JSON.stringify(count))
      } catch (e) {
        console.error('Failed to check upcoming shots:', e)
      }
    }

    checkShots()
    const interval = setInterval(checkShots, 3 * 60 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const receptionUser = JSON.parse(localStorage.getItem('reception_auth') || '{}')
  const isAdmin = receptionUser.role?.toLowerCase() === 'admin'
  const hasAccess = isAdmin || (Array.isArray(receptionUser.portalAccess) && receptionUser.portalAccess.map(p => String(p).toLowerCase()).includes('reception'))

  if (receptionUser?.username && !hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center p-8 bg-white rounded-2xl shadow-lg border border-red-100">
          <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiXCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Access Denied</h2>
          <p className="text-slate-600">You don't have access to the Reception Portal.</p>
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
    <div className="flex flex-col h-screen bg-hospital-blue text-slate-800 overflow-x-hidden">
      {toast ? (
        <div className="fixed top-4 right-4 z-50 bg-amber-600 text-white px-6 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      ) : null}
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