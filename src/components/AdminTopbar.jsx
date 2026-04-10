import React from 'react'
import { useSettings } from '../context/SettingsContext'
import { FiBell, FiUser, FiLogOut, FiSun, FiMenu, FiEye, FiEyeOff, FiArrowLeft } from 'react-icons/fi'
import { useActivity } from '../context/ActivityContext'
import { Link } from 'react-router-dom'

export default function AdminTopbar({ adminName = 'Main Admin', onLogout, onToggle }) {
  const { settings } = useSettings()
  const { logs } = useActivity()
  const [showProfile, setShowProfile] = React.useState(false)
  const [showNotif, setShowNotif] = React.useState(false)
  const [reveal, setReveal] = React.useState(false)
  let auth
  try { auth = JSON.parse(localStorage.getItem('admin_auth') || '{}') } catch {}
  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="px-3 md:px-5 py-2">
        <div className="h-12 w-full rounded-full border border-indigo-100 bg-indigo-50/60 shadow-sm flex items-center justify-between px-2">
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
                <span className="ml-2 text-xs font-medium text-indigo-600 align-middle">Admin</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 relative">
            <div className="relative">
              <button onClick={()=>{setShowNotif(s=>!s); setShowProfile(false)}} className="inline-flex items-center gap-2 h-9 px-3 rounded-full bg-white border border-slate-200 text-slate-600 hover:text-slate-800 cursor-pointer">
                <FiBell className="h-4 w-4" />
              </button>
              {showNotif && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg ring-1 ring-slate-200 p-3 z-50">
                  <div className="text-sm font-semibold mb-2">Notifications</div>
                  <ul className="max-h-60 overflow-auto divide-y divide-slate-100 text-sm">
                    {logs.slice(0,6).map(l => (
                      <li key={l.id} className="py-2">
                        <div className="font-medium text-slate-700">{l.text}</div>
                        <div className="text-xs text-slate-500">{l.when} • {l.user}</div>
                      </li>
                    ))}
                    {logs.length===0 && <li className="py-2 text-slate-500">No notifications</li>}
                  </ul>
                  <div className="mt-2 text-right">
                    <Link to="/admin/logs" className="text-indigo-600 text-sm hover:underline" onClick={()=>setShowNotif(false)}>View all logs</Link>
                  </div>
                </div>
              )}
            </div>
            <div className="relative">
              <button onClick={()=>{setShowProfile(s=>!s); setShowNotif(false)}} className="inline-flex items-center gap-2 h-9 px-3 rounded-full bg-white border border-slate-200 text-slate-600 hover:text-slate-800 cursor-pointer">
                <FiUser className="h-4 w-4" /> <span className="hidden sm:inline text-sm">Profile</span>
              </button>
              {showProfile && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl ring-1 ring-slate-200 p-4 z-50">
                  <div className="text-base font-bold text-slate-900 truncate">{settings.companyName || 'Abbottabad Pet Hospital'}</div>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Role</span>
                      <span className="font-semibold text-slate-800">Admin</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Username</span>
                      <span className="font-semibold text-slate-800">{auth?.username || 'admin'}</span>
                    </div>
                  </div>
                  <button
                    onClick={()=>setShowProfile(false)}
                    type="button"
                    className="mt-4 w-full h-9 rounded-full bg-slate-800 hover:bg-slate-900 text-white font-semibold shadow cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-2 h-9 px-3 rounded-full bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
            >
              <FiLogOut className="h-4 w-4" /> <span className="hidden sm:inline text-sm">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
