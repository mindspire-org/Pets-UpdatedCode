import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useActivity } from '../context/ActivityContext'
import { useSettings } from '../context/SettingsContext'

export default function Navbar({ title }) {
  const navigate = useNavigate()
  const { addActivity } = useActivity()
  const { settings } = useSettings()
  const handleLogout = () => {
    try {
      const portal = localStorage.getItem('portal') || 'Unknown'
      addActivity({ user: portal.charAt(0).toUpperCase() + portal.slice(1), text: 'Logout' })
    } catch {}
    localStorage.removeItem('portal')
    navigate('/')
  }

  return (
    <nav className="w-full bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="min-w-0 flex items-center gap-2">
          {settings.companyLogo && (
            <img src={settings.companyLogo} alt="Logo" className="h-7 w-7 rounded-md object-contain ring-1 ring-slate-200" />
          )}
          <div className="text-base font-semibold text-slate-800 truncate">
            {settings.companyName || 'Abbottabad Pet Hospital'}
            <span className="ml-2 text-sm text-slate-600">• {title}</span>
          </div>
        </div>
        <button onClick={handleLogout} className="px-4 py-2 text-sm font-medium rounded-md bg-emerald-500 hover:bg-emerald-600 text-white transition">
          Logout
        </button>
      </div>
    </nav>
  )
}
