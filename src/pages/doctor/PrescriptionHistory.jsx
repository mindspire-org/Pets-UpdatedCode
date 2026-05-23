import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { prescriptionsAPI, labRequestsAPI, appointmentsAPI } from '../../services/api'
import PrintPrescription from '../../components/print/PrintPrescription'
import { useSettings } from '../../context/SettingsContext'

export default function DoctorPrescriptionHistory(){
  const { settings } = useSettings()
  const navigate = useNavigate()

  const auth = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('doctor_auth') || '{}') } catch { return {} }
  }, [])
  const role = String(auth?.role || '').toLowerCase()
  const username = String(auth?.username || '').trim()

  const [loading, setLoading] = useState(false)
  const [list, setList] = useState([])
  const [q, setQ] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [preview, setPreview] = useState(null)
  const [signature, setSignature] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [pharmacyTarget, setPharmacyTarget] = useState(null)
  const [referringPharmacy, setReferringPharmacy] = useState(false)
  const [labTarget, setLabTarget] = useState(null)
  const [referringLab, setReferringLab] = useState(false)
  const [successMessage, setSuccessMessage] = useState(null)

  useEffect(()=>{
    try {
      const stored = localStorage.getItem('doctor_signature')
      if (stored) setSignature(stored)
    } catch {}
  },[])

  const load = async () => {
    setLoading(true)
    try {
      const res = await prescriptionsAPI.getAll()
      const raw = res.data || []
      const scoped = (role === 'admin' || !username) ? raw : raw.filter(p => String(p?.doctor?.username || '').trim() === username)
      setList(scoped)
    } catch (e) {
      console.error('Error loading prescriptions:', e)
      setList([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{ load() },[])

  const filtered = useMemo(()=>{
    const s = String(q||'').trim().toLowerCase()
    if(!s) return list
    return (list||[]).filter(prx=>{
      const p = prx.patient || {}
      const hay = [
        prx.id,
        prx.when,
        p.id,
        p.petName,
        p.ownerName,
        p.breed,
        p.species,
        prx.doctor?.name,
        prx.doctor?.username,
        ...(prx.items||[]).map(it=>it?.name),
        ...(prx.items||[]).map(it=>it?.condition),
      ].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(s)
    })
  },[list,q])

  const openPreview = (prx) => {
    const merged = mergePatientVitals(prx.patient || {}, prx)
    
    // CRITICAL FIX: Ensure items have the isVaccine flag so the report groups them correctly.
    // When loading from the database, this flag might be missing.
    const itemsWithFlags = (prx.items || []).map(it => ({
      ...it,
      // If it has shotStage or dateGiven, it's definitely a vaccine
      isVaccine: it.isVaccine || !!it.shotStage || !!it.dateGiven
    }))

    const doc = { ...prx, patient: merged, items: itemsWithFlags }
    setPreview(doc)
    setShowPreview(true)
  }

  // Merging logic to ensure historical reports show the correct saved vitals (Weight, Temp, etc.)
  const mergePatientVitals = (base = {}, full = null) => {
    const pick = (...vals) => {
      for (const v of vals) { if (v != null && String(v).trim() !== '') return v }
      return ''
    }
    const get = (obj, path) => {
      try {
        if (!obj) return ''
        const parts = path.split('.')
        let cur = obj
        for (const p of parts) { cur = cur?.[p] }
        return (cur == null ? '' : cur)
      } catch { return '' }
    }
    const tF = pick(
      get(base, 'tempF'), get(base, 'temp'), get(base, 'temperatureF'), get(base, 'vitals.tempF'),
      get(full, 'patient.tempF'), get(full, 'patient.temp'), get(full, 'vitals.tempF')
    )
    const tC = pick(get(base, 'tempC'), get(full, 'patient.tempC'))
    let tempUnit = pick(get(base, 'tempUnit'), get(full, 'patient.tempUnit'))
    let tempVal = tF
    if (!String(tempVal).trim()) { tempVal = tC; if (!String(tempUnit).trim()) tempUnit = '°C' }
    if (!String(tempUnit).trim()) tempUnit = '°F'

    return {
      ...base,
      weightKg: pick(
        get(base, 'weightKg'), get(base, 'weight'), get(base, 'details.weightKg'),
        get(full, 'patient.weightKg'), get(full, 'vitals.weightKg')
      ),
      tempF: tempVal,
      tempUnit,
      dehydration: pick(
        get(base, 'dehydration'), get(base, 'details.dehydration'),
        get(full, 'patient.dehydration'), get(full, 'vitals.dehydration')
      )
    }
  }

  const edit = async (prx) => {
    navigate('/doctor/prescription', { state: { loadPrescription: prx } })
  }

  const confirmDelete = (prx) => setDeleteTarget(prx)

  const cancelDelete = () => setDeleteTarget(null)

  const executeDelete = async () => {
    if (!deleteTarget) return
    const prx = deleteTarget
    
    try {
      setDeleting(true)
      
      // 1. Revert appointment status if it exists for today/this record
      try {
        const aptRes = await appointmentsAPI.getAll()
        const appointments = aptRes?.data || []
        const patientData = prx.patient || {}
        const today = new Date().toISOString().slice(0, 10)
        
        // Find matching appointment that was marked completed
        const apt = appointments.find(a => {
          const isPatientMatch = (
            (a.petId && a.petId === patientData.id) ||
            (a.petName?.toLowerCase().trim() === patientData.petName?.toLowerCase().trim() &&
             a.ownerName?.toLowerCase().trim() === patientData.ownerName?.toLowerCase().trim())
          )
          // Also match the date of the prescription to be safe, or just today's
          const prxDate = new Date(prx.when).toISOString().slice(0, 10)
          const aptDate = a.date || (a.createdAt ? new Date(a.createdAt).toISOString().slice(0, 10) : '')
          
          return isPatientMatch && a.status === 'Completed' && (aptDate === prxDate || aptDate === today)
        })

        if (apt) {
          console.log('Reverting appointment status to Pending for:', patientData.petName)
          await appointmentsAPI.update(apt.id, { ...apt, status: 'Pending' })
        }
      } catch (aptErr) {
        console.error('Error reverting appointment status:', aptErr)
      }

      // 2. Delete the prescription
      await prescriptionsAPI.delete(prx.id)
      
      // 3. Refresh list
      await load()
      setDeleteTarget(null)
    } catch (e) {
      console.error('Error deleting prescription:', e)
      alert('Failed to delete prescription')
    } finally {
      setDeleting(false)
    }
  }

  const confirmLabReferral = (prx) => setLabTarget(prx)

  const cancelLabReferral = () => setLabTarget(null)

  const executeLabReferral = async () => {
    if (!labTarget) return
    const prx = labTarget
    
    try {
      setReferringLab(true)
      const selectedTests = Array.isArray(prx?.notes?.tests) ? prx.notes.tests.filter(t => String(t || '').trim()) : []
      if (selectedTests.length === 0) {
        alert('No tests found in this prescription')
        setReferringLab(false)
        setLabTarget(null)
        return
      }

      const patient = prx.patient || {}
      const doctorName = prx.doctor?.name || prx.doctor?.username || ''
      const now = new Date()
      const requestDate = now.toISOString().slice(0,10)
      const requestTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      const clinicalBlocks = [
        ...(Array.isArray(prx?.notes?.hx) ? prx.notes.hx.map(x=>`Hx: ${x}`) : []),
        ...(Array.isArray(prx?.notes?.oe) ? prx.notes.oe.map(x=>`O/E: ${x}`) : []),
        ...(Array.isArray(prx?.notes?.dx) ? prx.notes.dx.map(x=>`Dx: ${x}`) : []),
        ...(Array.isArray(prx?.notes?.advice) ? prx.notes.advice.map(x=>`Advice: ${x}`) : []),
        ...(String(prx?.note||'').trim() ? [`Note: ${String(prx.note).trim()}`] : []),
      ].filter(Boolean)

      const baseLabRequest = {
        petName: patient.petName || '',
        ownerName: patient.ownerName || '',
        contact: '',
        referredBy: doctorName || undefined,
        technician: '',
        fee: '',
        paymentStatus: 'Pending',
        requestDate,
        requestTime,
        clinicalNotes: clinicalBlocks.join(' | '),
      }

      for (const testNameRaw of selectedTests) {
        const testName = String(testNameRaw || '').trim()
        if (!testName) continue
        const payload = {
          ...baseLabRequest,
          testType: testName,
          testId: `T-${(patient.id || 'PT')}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
        }
        await labRequestsAPI.create(payload)
      }

      setLabTarget(null)
      setSuccessMessage(`Lab requests created successfully! (${selectedTests.length} test${selectedTests.length > 1 ? 's' : ''})`)
    } catch (e) {
      console.error('Error creating lab requests:', e)
      alert('Failed to create lab requests')
    } finally {
      setReferringLab(false)
    }
  }

  const confirmPharmacyReferral = (prx) => setPharmacyTarget(prx)

  const cancelPharmacyReferral = () => setPharmacyTarget(null)

  const executePharmacyReferral = async () => {
    if (!pharmacyTarget) return
    const prx = pharmacyTarget
    
    try {
      setReferringPharmacy(true)
      const patient = prx.patient || {}
      const items = Array.isArray(prx.items) ? prx.items : []
      const medicineItems = items.filter(x => !x?.isVaccine)
      const vaccineItems = items.filter(x => !!x?.isVaccine)
      const referral = {
        id: 'REF-'+Date.now(),
        prescriptionId: prx.id,
        patientId: patient?.id,
        petName: patient?.petName,
        ownerName: patient?.ownerName,
        contact: '',
        medicines: [
          ...medicineItems.map(m => ({
            name: m.name,
            dosage: m.dose ? `${m.dose} ${m.unit || ''}`.trim() : '',
            instructions: m.instructions || '',
            isVaccine: false,
          })),
          ...vaccineItems.map(v => ({
            name: v.name,
            dosage: '',
            instructions: v.instructions || '',
            isVaccine: true,
            route: v.route || '',
            shots: Array.isArray(v.shots) ? v.shots : [],
          })),
        ],
        note: prx.note || '',
        doctor: prx.doctor || {},
        date: new Date().toISOString(),
        status: 'Pending'
      }
      const referrals = JSON.parse(localStorage.getItem('pharmacy_referrals')||'[]')
      localStorage.setItem('pharmacy_referrals', JSON.stringify([referral, ...referrals]))
      setPharmacyTarget(null)
      setSuccessMessage('Prescription successfully referred to Pharmacy!')
    } catch (e) {
      console.error('Error referring to pharmacy:', e)
      alert('Failed to refer to Pharmacy')
    } finally {
      setReferringPharmacy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-green-100 shadow-xl ring-1 ring-emerald-200/50 p-6 border border-emerald-100">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-emerald-800 font-bold text-2xl">Prescription History</div>
            <div className="text-sm text-emerald-700 mt-1">Preview / Print, Edit, Refer to Pharmacy, Refer to Lab</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow">Refresh</button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Search</label>
            <input className="h-11 px-4 rounded-xl border-2 border-slate-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 w-full transition-all bg-white" placeholder="Search by Pet ID, pet name, owner name, medicine..." value={q} onChange={e=>setQ(e.target.value)} />
          </div>
          <div className="flex items-end">
            <div className="text-sm text-slate-600">{loading ? 'Loading...' : `${filtered.length} records`}</div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((prx)=> (
          <div key={prx.id} className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="font-bold text-slate-800">{new Date(prx.when).toLocaleString()}</div>
                <div className="text-xs text-slate-500 mt-1">Rx ID: {prx.id}</div>
                <div className="text-xs text-slate-500">Doctor: {prx.doctor?.name || prx.doctor?.username || 'N/A'}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-slate-700">{prx.patient?.petName || '—'}</div>
                <div className="text-xs text-slate-500">{prx.patient?.ownerName || '—'}</div>
                <div className="text-xs text-slate-500">Pet ID: {prx.patient?.id || '—'}</div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={()=>openPreview(prx)} className="h-10 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold">Preview / Print</button>
              <button onClick={()=>edit(prx)} className="h-10 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold">Edit</button>
              <button onClick={()=>confirmPharmacyReferral(prx)} className="h-10 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold">Refer to Pharmacy</button>
              <button onClick={()=>confirmLabReferral(prx)} className="h-10 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-semibold">Refer to Lab</button>
              <button onClick={()=>confirmDelete(prx)} className="h-10 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clipRule="evenodd"/><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/></svg>
                Delete
              </button>
            </div>
          </div>
        ))}

        {!loading && filtered.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-slate-300 text-slate-500 p-12 text-center">No prescriptions found.</div>
        )}
      </div>

      {(showPreview && preview) ? (
        <PrintPrescription
          doc={preview}
          settings={settings}
          signature={signature}
          fallbackNotes={preview?.notes}
          fallbackPatient={preview?.patient}
          onClose={()=>{ setShowPreview(false); setPreview(null) }}
          onAfterPrint={()=>{ setShowPreview(false); setPreview(null) }}
        />
      ) : null}

      {/* Custom Delete Confirmation Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={cancelDelete}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e=>e.stopPropagation()}>
            <div className="bg-gradient-to-r from-red-500 to-rose-600 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clipRule="evenodd"/><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/></svg>
                </div>
                <div>
                  <div className="font-bold text-white text-lg">Confirm Delete</div>
                  <div className="text-red-100 text-sm">This action cannot be undone</div>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="text-slate-700 mb-4">
                Are you sure you want to delete this prescription?
              </div>
              
              <div className="bg-slate-50 rounded-xl p-4 mb-4 border border-slate-200">
                <div className="text-sm text-slate-600 space-y-1">
                  <div><span className="font-semibold">Pet:</span> {deleteTarget.patient?.petName || '—'}</div>
                  <div><span className="font-semibold">Owner:</span> {deleteTarget.patient?.ownerName || '—'}</div>
                  <div><span className="font-semibold">Date:</span> {new Date(deleteTarget.when).toLocaleString()}</div>
                </div>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                  <div className="text-sm text-amber-800">
                    <span className="font-semibold">Warning:</span> This will also revert the patient's appointment status back to "Pending".
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={cancelDelete}
                  disabled={deleting}
                  className="flex-1 h-11 px-4 rounded-xl border-2 border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={executeDelete}
                  disabled={deleting}
                  className="flex-1 h-11 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  {deleting ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 10h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      Deleting...
                    </>
                  ) : (
                    'Delete Prescription'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Pharmacy Referral Dialog */}
      {pharmacyTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={cancelPharmacyReferral}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e=>e.stopPropagation()}>
            <div className="bg-gradient-to-r from-purple-500 to-violet-600 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd"/></svg>
                </div>
                <div>
                  <div className="font-bold text-white text-lg">Refer to Pharmacy</div>
                  <div className="text-purple-100 text-sm">Send prescription to pharmacy</div>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="text-slate-700 mb-4">
                This will send the prescription details to the pharmacy for dispensing.
              </div>
              
              <div className="bg-slate-50 rounded-xl p-4 mb-4 border border-slate-200">
                <div className="text-sm text-slate-600 space-y-1">
                  <div><span className="font-semibold">Pet:</span> {pharmacyTarget.patient?.petName || '—'}</div>
                  <div><span className="font-semibold">Owner:</span> {pharmacyTarget.patient?.ownerName || '—'}</div>
                  <div><span className="font-semibold">Doctor:</span> {pharmacyTarget.doctor?.name || pharmacyTarget.doctor?.username || '—'}</div>
                </div>
              </div>
              
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 mb-4">
                <div className="text-sm text-purple-800">
                  <span className="font-semibold">Medicines:</span> {(pharmacyTarget.items || []).filter(x => !x?.isVaccine).length} item{((pharmacyTarget.items || []).filter(x => !x?.isVaccine).length !== 1) ? 's' : ''}
                  <span className="mx-2">|</span>
                  <span className="font-semibold">Vaccines:</span> {(pharmacyTarget.items || []).filter(x => !!x?.isVaccine).length} item{((pharmacyTarget.items || []).filter(x => !!x?.isVaccine).length !== 1) ? 's' : ''}
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={cancelPharmacyReferral}
                  disabled={referringPharmacy}
                  className="flex-1 h-11 px-4 rounded-xl border-2 border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={executePharmacyReferral}
                  disabled={referringPharmacy}
                  className="flex-1 h-11 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  {referringPharmacy ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 10h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      Referring...
                    </>
                  ) : (
                    'Refer to Pharmacy'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Lab Referral Dialog */}
      {labTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={cancelLabReferral}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e=>e.stopPropagation()}>
            <div className="bg-gradient-to-r from-cyan-500 to-teal-600 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7 2a1 1 0 00-.894.553L2.382 8H2a1 1 0 000 2h.382l1.724 3.447A1 1 0 005 14h10a1 1 0 00.894-.553L17.618 10H18a1 1 0 100-2h-.382l-1.724-3.447A1 1 0 0015 2H7zM6 8a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0zm-5 5a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/></svg>
                </div>
                <div>
                  <div className="font-bold text-white text-lg">Refer to Lab</div>
                  <div className="text-cyan-100 text-sm">Create lab test requests</div>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="text-slate-700 mb-4">
                This will create lab test requests for the selected tests.
              </div>
              
              <div className="bg-slate-50 rounded-xl p-4 mb-4 border border-slate-200">
                <div className="text-sm text-slate-600 space-y-1">
                  <div><span className="font-semibold">Pet:</span> {labTarget.patient?.petName || '—'}</div>
                  <div><span className="font-semibold">Owner:</span> {labTarget.patient?.ownerName || '—'}</div>
                  <div><span className="font-semibold">Doctor:</span> {labTarget.doctor?.name || labTarget.doctor?.username || '—'}</div>
                </div>
              </div>
              
              <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-3 mb-4">
                <div className="text-sm text-cyan-800">
                  <span className="font-semibold">Tests:</span> {Array.isArray(labTarget?.notes?.tests) ? labTarget.notes.tests.filter(t => String(t || '').trim()).length : 0} test{((Array.isArray(labTarget?.notes?.tests) ? labTarget.notes.tests.filter(t => String(t || '').trim()).length : 0) !== 1) ? 's' : ''}
                  {(Array.isArray(labTarget?.notes?.tests) ? labTarget.notes.tests.filter(t => String(t || '').trim()).length : 0) === 0 && (
                    <span className="text-red-600 ml-2">(No tests found)</span>
                  )}
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={cancelLabReferral}
                  disabled={referringLab}
                  className="flex-1 h-11 px-4 rounded-xl border-2 border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={executeLabReferral}
                  disabled={referringLab || (Array.isArray(labTarget?.notes?.tests) ? labTarget.notes.tests.filter(t => String(t || '').trim()).length === 0 : true)}
                  className="flex-1 h-11 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  {referringLab ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 10h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      Creating...
                    </>
                  ) : (
                    'Create Lab Requests'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Message Dialog */}
      {successMessage && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={()=>setSuccessMessage(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e=>e.stopPropagation()}>
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-4">
              <div className="flex items-center justify-center">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                </div>
              </div>
            </div>
            
            <div className="p-6 text-center">
              <div className="text-slate-700 font-semibold text-lg mb-4">{successMessage}</div>
              <button
                onClick={()=>setSuccessMessage(null)}
                className="h-10 px-6 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors"
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
