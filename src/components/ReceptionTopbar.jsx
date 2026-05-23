import React, { useEffect, useState } from 'react'
import { useSettings } from '../context/SettingsContext'
import { FiBell, FiMenu } from 'react-icons/fi'
import { Link } from 'react-router-dom'

export default function ReceptionTopbar({ onToggle }) {
  const { settings } = useSettings()
  let auth
  try { auth = JSON.parse(localStorage.getItem('reception_auth') || '{}') } catch {}
  const receptionistName = auth?.name || auth?.username || 'Reception'

  const [shotsSummary, setShotsSummary] = useState({ count: 0, nextDueDate: null })

  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem('reception_upcoming_shots_summary')
        const parsed = raw ? JSON.parse(raw) : null
        if (parsed && typeof parsed === 'object') {
          setShotsSummary({
            count: Number(parsed.count) || 0,
            nextDueDate: parsed.nextDueDate || null,
          })
        }
      } catch {}
    }
    read()
    const t = setInterval(read, 15000)
    return () => clearInterval(t)
  }, [])

  const nextDueLabel = (() => {
    if (!shotsSummary?.nextDueDate) return ''
    const d = new Date(shotsSummary.nextDueDate)
    if (!Number.isFinite(d.getTime())) return ''
    return d.toLocaleDateString()
  })()

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="px-3 md:px-5 py-2">
        <div className="h-12 w-full rounded-full border border-sky-100 bg-sky-50/60 shadow-sm flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
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
                <span className="ml-2 text-xs font-medium text-sky-600 align-middle">Reception • {receptionistName}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/reception/shots-reminder"
              className="relative inline-flex items-center justify-center h-9 w-9 rounded-full bg-white text-slate-600 hover:text-slate-800 border border-slate-200"
              aria-label="Shots reminder"
              title={shotsSummary.count > 0 ? `Upcoming shots: ${shotsSummary.count}${nextDueLabel ? ` (next: ${nextDueLabel})` : ''}` : 'No upcoming shots'}
            >
              <FiBell className="h-5 w-5" />
              {shotsSummary.count > 0 ? (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-amber-600 text-white text-[11px] font-bold grid place-items-center shadow">
                  {shotsSummary.count > 99 ? '99+' : shotsSummary.count}
                </span>
              ) : null}
            </Link>
            <div className="text-sm text-slate-600">Welcome</div>
          </div>
        </div>
      </div>
    </header>
  )
}