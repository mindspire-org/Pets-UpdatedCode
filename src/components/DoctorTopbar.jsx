import React from 'react'
import { useSettings } from '../context/SettingsContext'
import { FiMenu, FiArrowLeft } from 'react-icons/fi'
import { useNavigate, Link } from 'react-router-dom'

export default function DoctorTopbar({ onToggle }) {
  const { settings } = useSettings()
  const navigate = useNavigate()
  let auth
  try { auth = JSON.parse(localStorage.getItem('doctor_auth') || '{}') } catch {}
  let profile = {}
  try { profile = JSON.parse(localStorage.getItem('doctor_profile')||'{}')||{} } catch {}
  const doctorName = profile?.name || auth?.name || auth?.username || 'Doctor'

  const logout = () => {
    localStorage.removeItem('portal')
    localStorage.removeItem('doctor_auth')
    navigate('/doctor/login')
  }

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="px-3 md:px-5 py-2">
        <div className="h-12 w-full rounded-full border border-emerald-100 bg-emerald-50/60 shadow-sm flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-white text-slate-600 hover:text-slate-800 border border-slate-200"
              aria-label="Back to modules"
            >
              <FiArrowLeft className="h-5 w-5" />
            </Link>
            <button
              onClick={onToggle}
              className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-white text-slate-600 hover:text-slate-800 border border-slate-200"
              aria-label="Toggle sidebar"
            >
              <FiMenu className="h-5 w-5" />
            </button>
            <div className="hidden sm:block h-6 w-px bg-slate-200/70" />
            <div className="min-w-0 flex items-center gap-2">
              {settings.companyLogo && (
                <img src={settings.companyLogo} alt="Logo" className="h-7 w-7 rounded-md object-contain ring-1 ring-slate-200" />
              )}
              <div className="text-sm md:text-base font-semibold tracking-wide text-slate-800 truncate">
                {settings.companyName || 'Abbottabad Pet Hospital'}
                <span className="ml-2 text-xs font-medium text-emerald-600 align-middle">Doctor • {doctorName}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Welcome</span>
            <button onClick={logout} className="ml-2 h-8 px-3 rounded-full border border-slate-300 text-slate-600 hover:bg-red-50 hover:text-red-600 cursor-pointer text-sm">Logout</button>
          </div>
        </div>
      </div>
    </header>
  )
}
