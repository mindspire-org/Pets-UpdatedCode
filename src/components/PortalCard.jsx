import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function PortalCard({ name, icon, description, to, bg = 'bg-white', accentColor = 'bg-sky-500' }) {
  const navigate = useNavigate()
  return (
    <div
      className={`${bg} rounded-3xl shadow-sm border border-slate-200 p-6 md:p-8 hover:shadow-lg hover:-translate-y-0.5 transition cursor-pointer group`}
      onClick={() => navigate(to)}
    >
      <div className="flex flex-col items-center text-center gap-4 md:gap-5">
        <div className={`h-14 w-14 md:h-16 md:w-16 rounded-2xl ${accentColor} bg-opacity-90 text-white grid place-items-center shadow-sm`}> 
          <div className="text-2xl md:text-3xl">
            {icon}
          </div>
        </div>
        <div className="flex-1">
          <div className="text-lg md:text-xl font-semibold text-slate-800">{name}</div>
          {description && (
            <p className="mt-1 text-slate-600 text-sm md:text-base leading-relaxed max-w-[48ch] mx-auto">{description}</p>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); navigate(to) }}
            className="mt-4 inline-flex items-center gap-1 px-3 md:px-4 py-1.5 md:py-2 text-sm md:text-[0.95rem] rounded-md bg-sky-600 hover:bg-sky-700 text-white transition shadow-sm border-0 focus:outline-none focus:ring-0"
            aria-label={`Open ${name}`}
          >
            Open
            <span aria-hidden>→</span>
          </button>
        </div>
      </div>
    </div>
  )
}
