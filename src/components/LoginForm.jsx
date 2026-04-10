import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AiOutlineHome } from 'react-icons/ai'
import { FiUser, FiLock, FiEye, FiEyeOff, FiAlertCircle } from 'react-icons/fi'
import { useSettings } from '../context/SettingsContext'

export default function LoginForm({ title, onSubmit, error }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const navigate = useNavigate()
  const { settings } = useSettings()

  // Removed auto-clear to avoid wiping values needed for profile display

  return (
    <div className="min-h-screen bg-white relative">
      <button
        aria-label="Go Home"
        className="absolute right-4 top-4 grid place-items-center h-9 w-9 rounded-lg border border-slate-300/80 bg-white/70 text-slate-600 hover:text-slate-800 shadow-sm hover:shadow hover:cursor-pointer transition"
        onClick={() => navigate('/')}
      >
        <AiOutlineHome size={18} />
      </button>

      <div className="max-w-3xl mx-auto px-4 pt-16">
        {/* Centered Company Logo (from Settings) */}
        <div className="flex justify-center mb-6">
          {settings.companyLogo ? (
            <img
              src={settings.companyLogo}
              alt="Company Logo"
              className="h-24 w-24 md:h-28 md:w-28 object-contain rounded-xl shadow-xl ring-1 ring-slate-200"
            />
          ) : (
            <div className="text-3xl md:text-4xl font-extrabold text-center tracking-tight bg-gradient-to-b from-indigo-700 to-blue-600 bg-clip-text text-transparent">
              {settings.companyName || 'Abbottabad Pet Hospital'}
            </div>
          )}
        </div>

        {/* Portal Title under logo */}
        <h2 className="text-4xl md:text-5xl font-extrabold text-center tracking-tight bg-gradient-to-b from-indigo-700 to-blue-600 bg-clip-text text-transparent drop-shadow-[0_8px_24px_rgba(59,130,246,0.25)]">
          {title}
        </h2>

        <div className="mt-8 mx-auto w-full max-w-md bg-white rounded-3xl shadow-2xl ring-1 ring-slate-200/70 p-6 md:p-8">
          <form
            onSubmit={e => { e.preventDefault(); onSubmit({ username, password }) }}
            className="space-y-5"
            autoComplete="off"
          >
            <div>
              <label className="block text-base font-semibold text-slate-700 mb-1">Username</label>
              <div className="flex items-center gap-3 rounded-full border-2 border-indigo-300 bg-white px-4 h-14 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-200 shadow-sm overflow-hidden">
                <FiUser className="text-indigo-500" />
                <input
                  className="w-full bg-transparent placeholder-slate-400/90 appearance-none border-0 outline-none focus:outline-none focus:ring-0 text-base font-medium"
                  placeholder="Enter your username"
                  name="login_user"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  inputMode="text"
                  value={username}
                  onChange={e=>setUsername(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-base font-semibold text-slate-700 mb-1">Password</label>
              <div className="flex items-center gap-3 rounded-full border-2 border-indigo-300 bg-white px-4 h-14 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-200 shadow-sm overflow-hidden">
                <FiLock className="text-indigo-500" />
                <input
                  type={showPwd ? 'text' : 'password'}
                  className="w-full bg-transparent placeholder-slate-400/90 appearance-none border-0 outline-none focus:outline-none focus:ring-0 text-base font-medium"
                  placeholder="Enter your password"
                  name="login_pass"
                  autoComplete="new-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={password}
                  onChange={e=>setPassword(e.target.value)}
                />
                <button type="button" onClick={()=>setShowPwd(s=>!s)} className="grid place-items-center h-8 w-8 rounded-full border-2 border-indigo-300 text-slate-500 hover:text-slate-700 hover:border-indigo-400 flex-shrink-0">
                  {showPwd ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                <FiAlertCircle className="flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <button className="w-full h-12 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-semibold shadow-lg transition border-0">Login</button>
          </form>

          <p className="text-xs text-center text-slate-400 mt-5">© 2025 {settings.companyName || 'Abbottabad Pet Hospital'}. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}
