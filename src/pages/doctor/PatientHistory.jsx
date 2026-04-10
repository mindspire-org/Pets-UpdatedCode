import React, { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { prescriptionsAPI, petsAPI } from '../../services/api'

export default function PatientHistory(){
  const { id } = useParams()
  const [patient, setPatient] = useState(null)
  const [history, setHistory] = useState([])

  // Helpers
  const num = (v) => {
    if(v===0) return 0
    const s = String(v||'')
    const m = s.match(/[-+]?[0-9]*\.?[0-9]+/)
    return m? parseFloat(m[0]) : NaN
  }
  const calcDose = (x, wKg) => {
    const dr = num(x?.doseRate)
    const per = num(x?.perMl)
    const w = num(wKg)
    if(!Number.isFinite(dr) || !Number.isFinite(per) || !Number.isFinite(w) || per<=0) return null
    return (dr * w) / per
  }

  // Dehydration helpers for history view
  const dehyPct = (txt) => {
    const s = String(txt||'').toLowerCase()
    if (s.includes('>')) return 8
    const m = s.match(/([0-9]+(\.[0-9]+)?)\s*%?/)
    if (m) return parseFloat(m[1])
    if (s.includes('mild')) return 5
    if (s.includes('moderate')) return 7
    if (s.includes('normal')) return 0
    return NaN
  }
  const mergeVitals = (h) => {
    const p = h?.patient || {}
    const v = h?.vitals || {}
    const pick = (...vals) => { for (const val of vals) { if (val != null && String(val).trim() !== '') return val } return '' }
    const weight = pick(p.weightKg, p.weight, p.details?.weightKg, v.weightKg, v.weight, h.weightKg, h.weight, patient?.weightKg, patient?.weight)
    const dehydration = pick(p.dehydration, p.details?.dehydration, v.dehydration, h.dehydration, h.dehydrationPercent, patient?.dehydration)
    return { weight, dehydration }
  }

  const loadData = async () => {
    try {
      try {
        const p = await petsAPI.getById(id)
        setPatient(p?.data || null)
      } catch (e) {
        const all = JSON.parse(localStorage.getItem('reception_pets')||'[]')
        const foundPatient = all.find(p=>p.id===id) || null
        setPatient(foundPatient)
      }

      try {
        const res = await prescriptionsAPI.getByPatient(id)
        setHistory(res?.data || [])
      } catch (e) {
        const all = JSON.parse(localStorage.getItem('reception_pets')||'[]')
        const foundPatient = all.find(p=>p.id===id) || null
        const prs = JSON.parse(localStorage.getItem('doctor_prescriptions')||'[]')||[]
        let filtered = prs.filter(p=>p.patient?.id===id)
        if (filtered.length === 0 && foundPatient) {
          filtered = prs.filter(p=> {
            const pPatient = p.patient || {}
            const nameMatch = pPatient.petName?.toLowerCase().trim() === foundPatient.petName?.toLowerCase().trim()
            const ownerMatch = pPatient.ownerName?.toLowerCase().trim() === foundPatient.ownerName?.toLowerCase().trim()
            return nameMatch && ownerMatch
          })
        }
        if (filtered.length === 0 && foundPatient) {
          filtered = prs.filter(p=> {
            const pPatient = p.patient || {}
            return pPatient.petName?.toLowerCase().trim() === foundPatient.petName?.toLowerCase().trim()
          })
        }
        setHistory(filtered)
      }
    } catch (error) {
      console.error('Error loading patient history:', error)
    }
  }

  useEffect(()=>{
    loadData()
    
    // Listen for prescription saved events
    const handlePrescriptionSaved = (event) => {
      console.log('Prescription saved event received in history:', event.detail)
      setTimeout(() => {
        loadData()
      }, 500)
    }
    
    // Listen for storage changes
    const handleStorageChange = (event) => {
      if (event.key === 'doctor_prescriptions') {
        console.log('Prescriptions storage changed, reloading history')
        setTimeout(() => {
          loadData()
        }, 100)
      }
    }
    
    // Listen for window focus
    const handleFocus = () => {
      loadData()
    }
    
    window.addEventListener('prescriptionSaved', handlePrescriptionSaved)
    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('focus', handleFocus)
    
    return () => {
      window.removeEventListener('prescriptionSaved', handlePrescriptionSaved)
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('focus', handleFocus)
    }
  },[id])

  const title = patient ? `${patient.petName} • ${patient.type} • ${patient.breed}` : id

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Patient History</h1>
          <p className="text-slate-500 mt-1">Complete medical history and prescription records</p>
        </div>
        <Link to="/doctor/patients" className="h-12 px-6 rounded-xl bg-gradient-to-r from-slate-600 to-gray-600 hover:from-slate-700 hover:to-gray-700 text-white font-semibold cursor-pointer transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/></svg>
          Back to Patients
        </Link>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-white to-blue-50 shadow-xl ring-1 ring-blue-200/50 p-6 border border-blue-100">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/></svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <button title="Click to copy" onClick={()=>{ navigator.clipboard?.writeText(id) }} className="px-3 py-1 rounded-lg bg-blue-100 border-2 border-blue-200 hover:bg-blue-200 cursor-pointer font-mono text-blue-800 font-semibold transition-all duration-200">{id}</button>
              <div className="px-3 py-1 bg-green-100 rounded-lg border border-green-200">
                <span className="text-green-700 font-semibold text-sm">{history.length} Prescriptions</span>
              </div>
            </div>
            <div className="font-bold text-xl text-slate-800">{title}</div>
            {patient && (
              <div className="text-sm text-slate-600 mt-1">Owner: <span className="font-semibold">{patient.ownerName}</span> • {patient.contact}</div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-white to-purple-50 shadow-xl ring-1 ring-purple-200/50 p-6 border border-purple-100">
        <div className="flex items-center gap-2 mb-6">
          <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>
          <div className="text-purple-800 font-bold text-xl">Prescription History</div>
        </div>
        {history.length===0 && (
          <div className="text-center py-12 text-purple-400">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>
            <div className="text-lg font-semibold mb-1">No prescription history</div>
            <div className="text-sm">This patient hasn't received any prescriptions yet</div>
          </div>
        )}
        <div className="space-y-4">
          {history.map((h,i)=> (
            <div key={i} className="group rounded-2xl border-2 border-purple-200 hover:border-purple-300 p-5 bg-gradient-to-br from-white to-purple-50/30 shadow-lg hover:shadow-xl transition-all duration-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/></svg>
                  </div>
                  <div>
                    <div className="font-bold text-slate-800">Prescription #{i + 1}</div>
                    <div className="text-sm text-slate-600">{new Date(h.when).toLocaleString()}</div>
                  </div>
                </div>
                <div className="px-3 py-1 bg-purple-100 rounded-lg border border-purple-200">
                  <span className="text-purple-700 font-semibold text-sm">{(h.items||[]).length} medicines</span>
                </div>
              </div>
              <div className="space-y-3">
                {(h.items||[]).map((it,idx)=> (
                  <div key={idx} className="bg-gradient-to-r from-slate-50 to-purple-50/50 rounded-xl p-4 border border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-md text-xs font-semibold">{it.route||'Oral'}</span>
                        <span className="font-bold text-lg text-slate-800">{it.name}</span>
                      </div>
                      {(() => {
                        const vit = mergeVitals(history[i])
                        const w = vit.weight
                        const wNum = num(w)
                        const pct = dehyPct(vit.dehydration)
                        const fluid = (Number.isFinite(wNum) && wNum>0 && Number.isFinite(pct)) ? (pct * wNum * 10) : NaN
                        let show = num(it.dose)
                        if ((!Number.isFinite(show) || show<=0) && Number.isFinite(fluid) && fluid>0) {
                          show = fluid
                        } else if (!Number.isFinite(show)) {
                          const computed = calcDose(it, w)
                          if (computed!=null) show = computed
                        }
                        const unit = it.unit || 'ml'
                        return (
                          <div className="text-right">
                            <div className="text-xs text-slate-500 mb-1">Calculated Dose</div>
                            <span className="font-bold text-lg text-emerald-700">
                              {Number.isFinite(show)? `${show.toFixed(2)} ${unit}` : '—'}
                            </span>
                          </div>
                        )
                      })()}
                    </div>
                    
                    {/* Medicine Details Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                      {it.composition && (
                        <div className="bg-white rounded-lg p-2 border border-slate-200">
                          <div className="text-xs text-slate-500 mb-1">Composition</div>
                          <div className="text-sm font-semibold text-slate-700">{it.composition}</div>
                        </div>
                      )}
                      {it.doseRate && (
                        <div className="bg-white rounded-lg p-2 border border-slate-200">
                          <div className="text-xs text-slate-500 mb-1">Dose Rate</div>
                          <div className="text-sm font-semibold text-slate-700">{it.doseRate}</div>
                        </div>
                      )}
                      {it.perMl && (
                        <div className="bg-white rounded-lg p-2 border border-slate-200">
                          <div className="text-xs text-slate-500 mb-1">Composition per ml</div>
                          <div className="text-sm font-semibold text-slate-700">{it.perMl}</div>
                        </div>
                      )}
                      {it.unit && (
                        <div className="bg-white rounded-lg p-2 border border-slate-200">
                          <div className="text-xs text-slate-500 mb-1">Unit</div>
                          <div className="text-sm font-semibold text-slate-700">{it.unit}</div>
                        </div>
                      )}
                    </div>
                    
                    {it.instructions && (
                      <div className="text-sm text-slate-600 italic bg-blue-50 rounded-lg p-3 border border-blue-200">
                        <svg className="w-4 h-4 inline mr-1 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/></svg>
                        <span className="font-semibold text-blue-700">Instructions:</span> {it.instructions}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
