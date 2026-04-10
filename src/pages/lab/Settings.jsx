import React, { useEffect, useState } from 'react'
import { FiDownload, FiUpload, FiTrash2, FiAlertTriangle, FiDatabase, FiSettings } from 'react-icons/fi'
import { backupAPI } from '../../services/api'

export default function LabSettings(){
  const [profile, setProfile] = useState(()=>{
    try { return JSON.parse(localStorage.getItem('lab_profile')||'{}') } catch { return {} }
  })
  const [activities] = useState(()=>{
    try { return JSON.parse(localStorage.getItem('lab_activities')||'[]') } catch { return [] }
  })

  const [importFile, setImportFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [confirmDialog, setConfirmDialog] = useState({ show: false, title: '', message: '', onConfirm: null })

  const pickLabOnly = (data) => {
    if (!data) return { labReports: [], labRequests: [], labTests: [], radiologyReports: [] }
    const { labReports = [], labRequests = [], labTests = [], radiologyReports = [] } = data
    return { labReports, labRequests, labTests, radiologyReports }
  }

  const handleExport = async () => {
    try {
      setBusy(true); setMessage('')
      const res = await backupAPI.exportAll()
      const payload = pickLabOnly(res.data || res)
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      a.href = url
      a.download = `lab-backup-${ts}.json`
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
      const payload = pickLabOnly(json)
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
    setConfirmDialog({
      show: true,
      title: 'Delete Lab Data',
      message: 'This will DELETE all Lab data (Reports, Requests, Tests, Radiology). This action cannot be undone. Continue?',
      onConfirm: async () => {
        try {
          setBusy(true); setMessage('');
          await backupAPI.clearLab();
          setMessage('Lab data cleared successfully.');
        } catch (error) {
          setMessage('Error deleting data');
        } finally {
          setBusy(false);
          setConfirmDialog(prev => ({ ...prev, show: false }));
        }
      }
    });
  };

  useEffect(()=>{ localStorage.setItem('lab_profile', JSON.stringify(profile)) }, [profile])

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent flex items-center justify-center gap-2">
          <FiSettings /> Lab Settings
        </h1>
        <p className="text-slate-600">Profile and data management for the Lab portal</p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg mb-6 flex items-center gap-2 ${message.includes('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          <div className={`w-2 h-2 rounded-full ${message.includes('Error') ? 'bg-red-500' : 'bg-emerald-500'} animate-pulse`} />
          <p className="font-medium">{message}</p>
        </div>
      )}

      {/* Custom Confirmation Dialog */}
      {confirmDialog.show && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 flex items-center gap-3 bg-red-50 text-red-700">
              <div className="p-2 rounded-full bg-red-100 text-red-600">
                <FiTrash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold">{confirmDialog.title}</h3>
            </div>
            <div className="p-6 text-slate-600 leading-relaxed">
              {confirmDialog.message}
            </div>
            <div className="px-6 py-4 bg-slate-50 flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDialog(prev => ({ ...prev, show: false }))}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-lg shadow-red-200 transition-all"
              >
                Delete Everything
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input value={profile.name||''} onChange={e=>setProfile(p=>({...p, name:e.target.value}))} placeholder="Full Name" className="h-10 px-3 rounded-lg border border-slate-300" />
          <input value={profile.email||''} onChange={e=>setProfile(p=>({...p, email:e.target.value}))} placeholder="Email" className="h-10 px-3 rounded-lg border border-slate-300" />
          <input value={profile.phone||''} onChange={e=>setProfile(p=>({...p, phone:e.target.value}))} placeholder="Phone" className="h-10 px-3 rounded-lg border border-slate-300" />
          <input value={profile.role||'Lab Technician'} onChange={e=>setProfile(p=>({...p, role:e.target.value}))} placeholder="Role" className="h-10 px-3 rounded-lg border border-slate-300" />
        </div>
        <div className="mt-4"><button className="px-4 h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm cursor-pointer">Save</button></div>
      </div>

      <div className="rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-3">Login Activity</h2>
        <ul className="space-y-2 text-sm">
          {activities.map((a,i)=> (<li key={i} className="text-slate-600">{a.time} — {a.text}</li>))}
          {activities.length===0 && <li className="text-slate-400">No activity yet</li>}
        </ul>
      </div>

      {/* Data Management */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 grid place-items-center"><FiDownload /></div>
            <div className="font-semibold">Export Lab Data</div>
          </div>
          <p className="text-sm text-slate-600 mb-4">Download lab reports, requests, tests, and radiology as JSON.</p>
          <button disabled={busy} onClick={handleExport} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm disabled:opacity-60">
            <FiDownload className="w-4 h-4"/> Export JSON
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 grid place-items-center"><FiUpload /></div>
            <div className="font-semibold">Import Lab Data</div>
          </div>
          <p className="text-sm text-slate-600 mb-3">Select a previously exported JSON file to restore.</p>
          <input type="file" accept="application/json" onChange={(e)=>setImportFile(e.target.files?.[0]||null)} className="block w-full text-sm mb-3" />
          <button disabled={busy || !importFile} onClick={handleImport} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm disabled:opacity-60">
            <FiUpload className="w-4 h-4"/> Import JSON
          </button>
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3 text-red-700">
            <div className="w-10 h-10 rounded-xl bg-red-100 grid place-items-center"><FiTrash2 /></div>
            <div className="font-semibold">Delete Lab Data</div>
          </div>
          <div className="flex items-start gap-2 text-sm text-red-700 mb-4">
            <FiAlertTriangle className="mt-0.5"/>
            <p>Danger action. This will permanently delete lab data from the database.</p>
          </div>
          <button disabled={busy} onClick={handleDelete} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm disabled:opacity-60">
            <FiTrash2 className="w-4 h-4"/> Delete All
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 flex items-center gap-2">
        <FiDatabase className="text-slate-400"/> Scope: Lab collections only (Lab Reports, Requests, Tests, Radiology). Export/Import uses JSON files created here.
      </div>
    </div>
  )
}
