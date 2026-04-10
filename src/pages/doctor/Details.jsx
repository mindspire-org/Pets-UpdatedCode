import React, { useEffect, useState } from 'react'
import { doctorProfileAPI, backupAPI } from '../../services/api'
import { FiDownload, FiUpload, FiTrash2, FiAlertTriangle, FiDatabase, FiSettings } from 'react-icons/fi'

export default function DoctorDetails(){
  const [form, setForm] = useState({ name:'', specialization:'', fee:'', phone:'', email:'', address:'' })
  const [signature, setSignature] = useState('')
  const [showThanks, setShowThanks] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [showError, setShowError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [showLoginError, setShowLoginError] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(()=>{
    const fetchProfile = async () => {
      try {
        const auth = JSON.parse(localStorage.getItem('doctor_auth')||'{}')
        if (auth.username) {
          const response = await doctorProfileAPI.get(auth.username)
          const profile = response?.data
          if (profile) {
            setForm({
              name: profile.name || '',
              specialization: profile.specialization || '',
              fee: profile.fee || '',
              phone: profile.phone || '',
              email: profile.email || '',
              address: profile.address || ''
            })
            setSignature(profile.signature || '')
          }
        }
      } catch (error) {
        console.error('Error fetching doctor profile:', error)
        // Fallback to localStorage
        try { 
          const p = JSON.parse(localStorage.getItem('doctor_profile')||'{}')
          if(p && Object.keys(p).length) setForm(p)
        } catch {}
        try { setSignature(localStorage.getItem('doctor_signature')||'') } catch {}
      }
    }
    fetchProfile()
  },[])

  const save = async (e) => {
    e.preventDefault()
    try {
      const auth = JSON.parse(localStorage.getItem('doctor_auth')||'{}')
      if (!auth.username) {
        setShowLoginError(true)
        return
      }
      
      const profileData = {
        username: auth.username,
        ...form,
        signature
      }
      
      // Save to MongoDB
      await doctorProfileAPI.save(profileData)
      
      // Also save to localStorage for backward compatibility
      localStorage.setItem('doctor_profile', JSON.stringify(form))
      localStorage.setItem('doctor_signature', signature)
      
      setShowThanks(true)
    } catch (error) {
      console.error('Error saving doctor profile:', error)
      setErrorMessage('Failed to save profile. Please try again.')
      setShowError(true)
    }
  }

  const pickDoctorOnly = (data) => {
    if (!data) return { doctorProfiles: [], prescriptions: [] }
    const { doctorProfiles = [], prescriptions = [] } = data
    return { doctorProfiles, prescriptions }
  }

  const handleExport = async () => {
    try {
      setBusy(true); setMessage('')
      const res = await backupAPI.exportAll()
      const payload = pickDoctorOnly(res.data || res)
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      a.href = url
      a.download = `doctor-backup-${ts}.json`
      a.click()
      URL.revokeObjectURL(url)
      setMessage('Export complete. File downloaded.')
    } catch (e) {
      console.error(e)
      setMessage(e?.message || 'Failed to export')
    } finally {
      setBusy(false)
    }
  }

  const handleImport = async () => {
    if (!importFile) { setMessage('Please select a JSON file to import.'); return }
    try {
      setBusy(true); setMessage('')
      const text = await importFile.text()
      let json
      try { json = JSON.parse(text) } catch { throw new Error('Invalid JSON file') }
      const payload = pickDoctorOnly(json)
      await backupAPI.importAll(payload)
      setMessage('Import completed successfully.')
    } catch (e) {
      console.error(e)
      setMessage(e?.message || 'Failed to import')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    const ok = window.confirm('This will DELETE all Doctor data (Doctor profiles and prescriptions). Continue?')
    if (!ok) return
    try {
      setBusy(true); setMessage('')
      await backupAPI.clearDoctor()
      setMessage('Doctor data cleared successfully.')
    } catch (e) {
      console.error(e)
      setMessage(e?.message || 'Failed to clear data')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Doctor Profile</h1>
        <p className="text-slate-500 mt-1">Manage your professional information and signature</p>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-white to-indigo-50 shadow-xl ring-1 ring-indigo-200/50 p-6 border border-indigo-100">
        <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-indigo-700 mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/></svg>
              Doctor Name
            </label>
            <input className="h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 w-full transition-all duration-200 bg-white shadow-sm" placeholder="Enter your full name" value={form.name} onChange={e=>setForm(s=>({...s,name:e.target.value}))} required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-indigo-700 mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd"/></svg>
              Specialization
            </label>
            <input className="h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 w-full transition-all duration-200 bg-white shadow-sm" placeholder="e.g., Veterinary Medicine" value={form.specialization} onChange={e=>setForm(s=>({...s,specialization:e.target.value}))} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-indigo-700 mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"/></svg>
              Consultation Fee
            </label>
            <input className="h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 w-full transition-all duration-200 bg-white shadow-sm" placeholder="e.g., $100" value={form.fee} onChange={e=>setForm(s=>({...s,fee:e.target.value}))} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-indigo-700 mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/></svg>
              Phone Number
            </label>
            <input className="h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 w-full transition-all duration-200 bg-white shadow-sm" placeholder="Your contact number" value={form.phone} onChange={e=>setForm(s=>({...s,phone:e.target.value}))} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-indigo-700 mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg>
              Email Address
            </label>
            <input type="email" className="h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 w-full transition-all duration-200 bg-white shadow-sm" placeholder="your.email@example.com" value={form.email} onChange={e=>setForm(s=>({...s,email:e.target.value}))} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-indigo-700 mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>
              Address
            </label>
            <input className="h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 w-full transition-all duration-200 bg-white shadow-sm" placeholder="Your clinic/practice address" value={form.address} onChange={e=>setForm(s=>({...s,address:e.target.value}))} />
          </div>
          <div className="md:col-span-2 mt-4">
            <label className="block text-sm font-semibold text-indigo-700 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 3a1 1 0 00-1.447-.894L8.763 6H5a3 3 0 000 6h.28l1.771 5.316A1 1 0 008 18h1a1 1 0 001-1v-4.382l6.553 3.276A1 1 0 0018 15V3z" clipRule="evenodd"/></svg>
              Digital Signature
            </label>
            <div className="flex items-center gap-3">
              <input type="file" accept="image/*" onChange={e=>{ const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=async ()=>{ const data=String(r.result||''); setSignature(data); try{ localStorage.setItem('doctor_signature', data); const auth = JSON.parse(localStorage.getItem('doctor_auth')||'{}'); if(auth.username) await doctorProfileAPI.updateSignature(auth.username, data) }catch{} }; r.readAsDataURL(f) }} />
              {signature && (
                <>
                  <img src={signature} alt="signature" className="h-16 object-contain border border-slate-200 rounded" />
                  <button type="button" onClick={()=> setConfirmRemove(true)} className="h-9 px-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer">Remove</button>
                </>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-1">This signature will appear on printed prescriptions.</div>
          </div>
          <div className="md:col-span-2 mt-4">
            <button className="px-8 h-14 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold cursor-pointer transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-3 text-lg">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
              Save Profile Details
            </button>
          </div>
        </form>
      </div>
      {confirmRemove && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={()=>setConfirmRemove(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md ring-1 ring-slate-200 overflow-hidden" onClick={e=>e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200 font-semibold text-slate-800">Remove Signature</div>
            <div className="px-6 py-4 text-sm text-slate-700">Are you sure you want to remove the saved signature?</div>
            <div className="px-6 py-4 bg-slate-50 flex justify-end gap-2">
              <button onClick={()=>setConfirmRemove(false)} className="h-9 px-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer">Cancel</button>
              <button onClick={async ()=>{ setSignature(''); try{ localStorage.removeItem('doctor_signature'); const auth = JSON.parse(localStorage.getItem('doctor_auth')||'{}'); if(auth.username) await doctorProfileAPI.updateSignature(auth.username, '') }catch{}; setConfirmRemove(false) }} className="h-9 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white cursor-pointer">Remove</button>
            </div>
          </div>
        </div>
      )}

      {showThanks && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center animate-fadeIn" onClick={()=>setShowThanks(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md ring-1 ring-emerald-200 overflow-hidden transform transition-all animate-slideUp" onClick={e=>e.stopPropagation()}>
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-8 text-center">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
              </div>
              <div className="text-2xl font-bold text-white mb-2">Success!</div>
              <div className="text-emerald-50">Your profile has been saved successfully</div>
            </div>
            <div className="px-6 py-6 text-center bg-gradient-to-b from-white to-emerald-50">
              <p className="text-slate-600 mb-4">All your professional information has been updated and is now available across the system.</p>
              <button 
                onClick={()=>setShowThanks(false)} 
                className="px-8 h-12 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold cursor-pointer transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Got it, thanks!
              </button>
            </div>
          </div>
        </div>
      )}

      {showError && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center animate-fadeIn" onClick={()=>setShowError(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md ring-1 ring-red-200 overflow-hidden transform transition-all animate-slideUp" onClick={e=>e.stopPropagation()}>
            <div className="bg-gradient-to-r from-red-500 to-rose-600 px-6 py-8 text-center">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                </svg>
              </div>
              <div className="text-2xl font-bold text-white mb-2">Oops!</div>
              <div className="text-red-50">Something went wrong</div>
            </div>
            <div className="px-6 py-6 text-center bg-gradient-to-b from-white to-red-50">
              <p className="text-slate-700 font-medium mb-2">{errorMessage}</p>
              <p className="text-slate-600 text-sm mb-4">Please check your connection and try again.</p>
              <button 
                onClick={()=>setShowError(false)} 
                className="px-8 h-12 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-semibold cursor-pointer transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {showLoginError && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center animate-fadeIn" onClick={()=>setShowLoginError(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md ring-1 ring-amber-200 overflow-hidden transform transition-all animate-slideUp" onClick={e=>e.stopPropagation()}>
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-8 text-center">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                </svg>
              </div>
              <div className="text-2xl font-bold text-white mb-2">Login Required</div>
              <div className="text-amber-50">Authentication needed</div>
            </div>
            <div className="px-6 py-6 text-center bg-gradient-to-b from-white to-amber-50">
              <p className="text-slate-700 font-medium mb-2">Please login to save your profile</p>
              <p className="text-slate-600 text-sm mb-4">You need to be logged in as a doctor to update profile information.</p>
              <button 
                onClick={()=>setShowLoginError(false)} 
                className="px-8 h-12 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-semibold cursor-pointer transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
