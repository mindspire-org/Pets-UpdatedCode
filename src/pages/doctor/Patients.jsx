import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { petsAPI, prescriptionsAPI, appointmentsAPI, labReportsAPI, medicalFormsAPI } from '../../services/api'
import DateRangePicker from '../../components/DateRangePicker'

export default function DoctorPatients(){
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState(null)
  const [prescriptions, setPrescriptions] = useState([])
  const [appointments, setAppointments] = useState([])
  const [labReports, setLabReports] = useState([])
  const [medicalForms, setMedicalForms] = useState([])
  const [viewingForm, setViewingForm] = useState(null)
  const [loadingForms, setLoadingForms] = useState(false)
  const [copiedId, setCopiedId] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const navigate = useNavigate()
  const location = useLocation()
  const [toDelete, setToDelete] = useState(null)
  const [dateRange, setDateRange] = useState({
    fromDate: new Date().toISOString().slice(0,10),
    toDate: new Date().toISOString().slice(0,10)
  })

  const isDateInRange = (dateStr) => {
    if (!dateStr) return false
    const iso = new Date(dateStr).toISOString().slice(0,10)
    return iso >= (dateRange.fromDate || iso) && iso <= (dateRange.toDate || iso)
  }

  const withHistory = useMemo(()=>{
    const ids = new Set()
    
    console.log('Computing withHistory - Prescriptions:', prescriptions.length, 'Rows:', rows.length)
    
    // Add patients with exact ID matches
    for (const p of (prescriptions||[])){
      if (p?.patient?.id) {
        ids.add(p.patient.id)
        console.log('Added patient by exact ID:', p.patient.id, 'Pet:', p.patient.petName)
      }
    }
    
    // Add patients with enhanced name matches (fallback)
    for (const patient of rows) {
      const hasNameMatch = prescriptions.some(p => {
        const pPatient = p.patient || {}
        
        // Exact name and owner match
        const exactMatch = (
          (pPatient.petName?.toLowerCase().trim() === patient.petName?.toLowerCase().trim()) &&
          (pPatient.ownerName?.toLowerCase().trim() === patient.ownerName?.toLowerCase().trim())
        )
        
        // Pet name only match (if owner not available)
        const petNameMatch = (
          pPatient.petName?.toLowerCase().trim() === patient.petName?.toLowerCase().trim() &&
          (!pPatient.ownerName || !patient.ownerName)
        )
        
        return exactMatch || petNameMatch
      })
      
      if (hasNameMatch) {
        ids.add(patient.id)
        console.log('Added patient by name match:', patient.id, 'Pet:', patient.petName, 'Owner:', patient.ownerName)
      }
    }
    
    console.log('Final withHistory IDs:', Array.from(ids))
    console.log('Prescriptions data for debugging:', prescriptions.map(p => ({
      id: p.id,
      patientId: p.patient?.id,
      petName: p.patient?.petName,
      ownerName: p.patient?.ownerName
    })))
    
    return ids
  },[prescriptions, rows])

  const refreshData = async () => {
    try { 
      // Fetch data from MongoDB API
      const [petsResponse, prescriptionsResponse, appointmentsResponse, labReportsResponse] = await Promise.all([
        petsAPI.getAll(),
        prescriptionsAPI.getAll(),
        appointmentsAPI.getAll(),
        labReportsAPI.getAll()
      ])

      const pets = petsResponse?.data || []
      const prescriptions = prescriptionsResponse?.data || []
      const appointments = appointmentsResponse?.data || []
      const labReports = labReportsResponse?.data || []

      console.log('=== REFRESHING DOCTOR PATIENTS DATA ===')
      console.log('Pets:', pets.length, 'Prescriptions:', prescriptions.length, 'Appointments:', appointments.length, 'Lab Reports:', labReports.length)
      console.log('Prescription details:', prescriptions.map(p => ({
        id: p.id,
        patientId: p.patient?.id,
        petName: p.patient?.petName,
        ownerName: p.patient?.ownerName,
        when: p.when
      })))
      setRows(pets)
      setPrescriptions(prescriptions)
      setAppointments(appointments)
      setLabReports(labReports)
    } catch (e) {
      console.error('Error refreshing data:', e)
      // Fallback to localStorage if API fails
      try {
        const pets = JSON.parse(localStorage.getItem('reception_pets')||'[]')
        const prescriptions = JSON.parse(localStorage.getItem('doctor_prescriptions')||'[]')
        const appointments = JSON.parse(localStorage.getItem('reception_appointments')||'[]')
        setRows(pets)
        setPrescriptions(prescriptions)
        setAppointments(appointments)
      } catch (fallbackError) {
        console.error('Fallback error:', fallbackError)
      }
    }
  }

  useEffect(()=>{
    refreshData()
    
    // Listen for prescription saved events to refresh data
    const handlePrescriptionSaved = (event) => {
      console.log('Prescription saved event received:', event.detail)
      // Immediate refresh
      refreshData()
      // Additional refresh after delay to ensure all data is updated
      setTimeout(() => {
        console.log('Delayed refresh after prescription save')
        refreshData()
      }, 1000)
    }
    
    // Listen for storage changes (for real-time updates)
    const handleStorageChange = (event) => {
      if (event.key === 'doctor_prescriptions' || event.key === 'reception_pets') {
        console.log('Storage changed, refreshing data:', event.key)
        setTimeout(() => {
          refreshData()
        }, 100)
      }
    }
    
    // Listen for window focus to refresh data
    const handleFocus = () => {
      refreshData()
    }
    
    window.addEventListener('prescriptionSaved', handlePrescriptionSaved)
    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('focus', handleFocus)
    
    return () => {
      window.removeEventListener('prescriptionSaved', handlePrescriptionSaved)
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('focus', handleFocus)
    }
  },[])

  // Refresh data when returning to this page
  useEffect(()=>{
    refreshData()
  },[location.pathname])

  // Refresh data when page becomes visible (user returns from prescription page)
  useEffect(()=>{
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshData()
      }
    }
    const handleFocus = () => {
      refreshData()
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  },[])

  // Refresh prescriptions and appointments when modal opens (API first, LS fallback)
  useEffect(()=>{
    if(!selected) return
    setLoadingForms(true)
    ;(async()=>{
      try {
        const [presRes, aptRes, formsRes] = await Promise.all([
          prescriptionsAPI.getAll(),
          appointmentsAPI.getAll(),
          medicalFormsAPI.getByPatient(selected.id)
        ])
        setPrescriptions(presRes?.data || [])
        setAppointments(aptRes?.data || [])
        setMedicalForms(formsRes?.data || [])
      } catch (e) {
        try {
          setPrescriptions(JSON.parse(localStorage.getItem('doctor_prescriptions')||'[]'))
        } catch {}
        try {
          setAppointments(JSON.parse(localStorage.getItem('reception_appointments')||'[]'))
        } catch {}
        setMedicalForms([])
      } finally {
        setLoadingForms(false)
      }
    })()
  },[selected])

  // Filter to show only patients with appointments
  const patientsWithAppointments = useMemo(() => {
    // Get current logged-in doctor's username
    let currentDoctorUsername = ''
    try {
      const auth = JSON.parse(localStorage.getItem('doctor_auth') || '{}')
      currentDoctorUsername = auth?.username || ''
      console.log('Current logged-in doctor username:', currentDoctorUsername)
    } catch (e) {
      console.error('Error getting doctor auth:', e)
    }

    return rows.filter(pet => {
      const matchesPetApt = (apt) => {
        const petMatches = (
          (apt.petId && apt.petId === pet.id) ||
          (apt.petName?.toLowerCase().trim() === pet.petName?.toLowerCase().trim() &&
           apt.ownerName?.toLowerCase().trim() === pet.ownerName?.toLowerCase().trim())
        )
        
        // Doctor filtering logic:
        // If appointment has a doctor assigned, only show to that doctor
        // If appointment has no doctor (empty/null), show to all doctors
        if (apt.doctor && apt.doctor.trim() !== '') {
          // Appointment has a doctor assigned - check if it matches current doctor
          const doctorMatches = apt.doctor === currentDoctorUsername
          console.log(`Appointment doctor: "${apt.doctor}", Current doctor: "${currentDoctorUsername}", Matches: ${doctorMatches}`)
          return petMatches && doctorMatches
        } else {
          // No doctor assigned - show to all doctors
          console.log('No doctor assigned to appointment, showing to all doctors')
          return petMatches
        }
      }
      
      const hasAptInRange = appointments.some(apt => matchesPetApt(apt) && isDateInRange(apt.date || apt.createdAt))

      const matchesPetName = (p) => (
        (p.patient?.id === pet.id) ||
        ((p.patient?.petName||'').toLowerCase().trim() === (pet.petName||'').toLowerCase().trim() &&
         (p.patient?.ownerName||'').toLowerCase().trim() === (pet.ownerName||'').toLowerCase().trim())
      )
      
      // Only show prescriptions created by current doctor
      const hasPrInRange = (prescriptions||[]).some(p => {
        const petMatches = matchesPetName(p)
        const dateMatches = isDateInRange(p.when || p.createdAt)
        
        // Check if prescription was created by current doctor
        const prescriptionDoctor = p.doctor?.username || p.doctor?.name || ''
        const doctorMatches = prescriptionDoctor === currentDoctorUsername
        
        console.log(`Prescription doctor: "${prescriptionDoctor}", Current doctor: "${currentDoctorUsername}", Matches: ${doctorMatches}`)
        
        return petMatches && dateMatches && doctorMatches
      })

      const matchesPetLab = (r) => (
        (r.petId && r.petId === pet.id) ||
        ((r.petName||'').toLowerCase().trim() === (pet.petName||'').toLowerCase().trim() &&
         (r.ownerName||'').toLowerCase().trim() === (pet.ownerName||'').toLowerCase().trim())
      )
      const hasLabInRange = (labReports||[]).some(r => matchesPetLab(r) && isDateInRange(r.date || r.reportDate || r.createdAt))

      return hasAptInRange || hasPrInRange || hasLabInRange
    })
  }, [rows, appointments, prescriptions, labReports, dateRange])

  const filtered = useMemo(()=>{
    const s=q.trim().toLowerCase()
    if(!s) return patientsWithAppointments
    return patientsWithAppointments.filter(r=>[r.petName,r.ownerName,r.type,r.breed,r.contact,r.id].some(v=>String(v||'').toLowerCase().includes(s)))
  },[patientsWithAppointments,q])

  useEffect(()=>{
    setPage(1)
  },[q, dateRange?.fromDate, dateRange?.toDate])

  const totalPages = Math.max(1, Math.ceil((filtered?.length || 0) / pageSize))
  useEffect(()=>{
    setPage(p => Math.min(Math.max(1, p), totalPages))
  },[totalPages])
  const paged = useMemo(()=>{
    const list = Array.isArray(filtered) ? filtered : []
    const start = (page - 1) * pageSize
    return list.slice(start, start + pageSize)
  },[filtered, page, pageSize])

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">Patient Management</h1>
        <p className="text-slate-500 mt-1">View and manage your patient records and history</p>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-white to-emerald-50 shadow-xl ring-1 ring-emerald-200/50 p-6 border border-emerald-100">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/></svg>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by ID, pet, owner..." className="h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 w-80 transition-all duration-200 bg-white shadow-sm" />
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-white to-emerald-50 shadow-xl ring-1 ring-emerald-200/50 p-4 border border-emerald-100">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm font-semibold text-slate-700">
            {dateRange.fromDate === dateRange.toDate
              ? `Date: ${new Date(dateRange.fromDate).toLocaleDateString()}`
              : `${new Date(dateRange.fromDate).toLocaleDateString()} - ${new Date(dateRange.toDate).toLocaleDateString()}`}
          </div>
          <DateRangePicker 
            onDateChange={setDateRange}
            defaultFromDate={dateRange.fromDate}
            defaultToDate={dateRange.toDate}
            showAllButton={true}
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="text-sm text-slate-600 font-medium">
          Showing {filtered.length===0 ? 0 : ((page - 1) * pageSize + 1)}-{Math.min(page * pageSize, filtered.length)} of {filtered.length}
        </div>
        <div className="flex items-center gap-2">
          <select value={pageSize} onChange={e=>setPageSize(Number(e.target.value)||15)} className="h-9 px-2 rounded-lg border border-slate-300 bg-white text-sm">
            <option value={10}>10 / page</option>
            <option value={15}>15 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
          </select>
          <button type="button" onClick={()=>setPage(p=>Math.max(1, p-1))} disabled={page<=1} className={`h-9 px-3 rounded-lg border text-sm ${page<=1?'border-slate-200 text-slate-400 cursor-not-allowed':'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
            Prev
          </button>
          <div className="text-sm text-slate-700 font-semibold min-w-[84px] text-center">{page} / {totalPages}</div>
          <button type="button" onClick={()=>setPage(p=>Math.min(totalPages, p+1))} disabled={page>=totalPages} className={`h-9 px-3 rounded-lg border text-sm ${page>=totalPages?'border-slate-200 text-slate-400 cursor-not-allowed':'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
            Next
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {paged.map(r=> (
          <div key={r.id} className="group rounded-2xl border-2 border-slate-200 hover:border-emerald-300 bg-gradient-to-r from-white to-emerald-50/30 p-6 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs">
                  <button title="Click to copy" onClick={()=>{ navigator.clipboard?.writeText(r.id); setCopiedId(r.id); setTimeout(()=>setCopiedId(''), 1200) }} className="px-2 h-6 rounded-md border border-slate-300 hover:bg-slate-50 cursor-pointer font-mono">{r.id}</button>
                  {copiedId===r.id && <span className="text-emerald-600">Copied</span>}
                  
                  {/* Status Indicators */}
                  {withHistory.has(r.id) && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-semibold flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>
                      Has Prescriptions
                    </span>
                  )}
                  
                  {(() => {
                    // Check appointment status
                    const today = new Date().toISOString().slice(0, 10)
                    const patientAppointments = appointments.filter(apt => 
                      (apt.petId && apt.petId === r.id) ||
                      (apt.petName?.toLowerCase().trim() === r.petName?.toLowerCase().trim() && 
                       apt.ownerName?.toLowerCase().trim() === r.ownerName?.toLowerCase().trim())
                    )
                    const todayAppointment = patientAppointments.find(apt => apt.date === today)
                    
                    if (todayAppointment) {
                      if (todayAppointment.status === 'Completed') {
                        return (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-md text-xs font-semibold flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                            Completed Today
                          </span>
                        )
                      } else {
                        return (
                          <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-md text-xs font-semibold flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/></svg>
                            Today's Appointment
                          </span>
                        )
                      }
                    }
                    return null
                  })()}
                </div>
                <div className="font-semibold text-slate-800 truncate mt-1">{r.petName} • {r.type} • {r.breed}</div>
                <div className="text-xs text-slate-500 truncate">Owner: {r.ownerName} ({r.ownerContact || r.contact || 'N/A'})</div>
              </div>
              <div className="flex items-center gap-2">
                {withHistory.has(r.id) && (
                  <button onClick={()=>navigate(`/doctor/patient/${encodeURIComponent(r.id)}`)} className="text-xs px-3 h-9 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white cursor-pointer font-semibold transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>
                    History
                  </button>
                )}
                <button onClick={()=>setSelected(r)} className="text-xs px-3 h-9 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white cursor-pointer font-semibold transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></svg>
                  View
                </button>
                <button onClick={()=>setToDelete(r)} className="text-xs px-3 h-9 rounded-lg bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white cursor-pointer font-semibold transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clipRule="evenodd"/><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/></svg>
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length===0 && (
          <div className="rounded-xl bg-white border border-dashed border-slate-300 text-slate-500 p-8 text-center">No patients found.</div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4" onClick={()=>setSelected(null)}>
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-xs sm:max-w-lg md:max-w-2xl lg:max-w-4xl ring-1 ring-slate-200 overflow-hidden max-h-[95vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-4 sm:px-6 py-3 sm:py-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/></svg>
                  </div>
                  <div>
                    <div className="font-bold text-lg sm:text-xl">Patient Details</div>
                    <div className="text-emerald-100 text-xs sm:text-sm">Complete patient information</div>
                  </div>
                </div>
                <button onClick={()=>setSelected(null)} className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6">
              {(()=>{
                const d = selected
                const pet = { petName: d.petName, species: d.species||d.type, breed: d.breed }
                const owner = { fullName: d.ownerName, contact: d.ownerContact || d.contact || d.details?.owner?.contact || 'N/A' }
                const consultationFee = d.details?.clinic?.consultantFees || d.consultantFees || 'Not specified'
                const when = new Date(d.when||d.createdAt||Date.now())
                
                // Find patient appointments
                const patientAppointments = appointments.filter(apt => 
                  (apt.petId && apt.petId === d.id) ||
                  (apt.petName?.toLowerCase() === d.petName?.toLowerCase() && 
                   apt.ownerName?.toLowerCase() === d.ownerName?.toLowerCase())
                ).sort((a, b) => new Date(b.date + ' ' + (b.time || '00:00')) - new Date(a.date + ' ' + (a.time || '00:00')))
                
                // Check if there's an appointment today
                const today = new Date().toISOString().slice(0, 10)
                const todayAppointment = patientAppointments.find(apt => apt.date === today)
                
                // Get next upcoming appointment
                const upcomingAppointment = patientAppointments.find(apt => 
                  new Date(apt.date + ' ' + (apt.time || '00:00')) >= new Date()
                )

                const purposeAppointment = todayAppointment || upcomingAppointment || patientAppointments[0]
                const purposeText = purposeAppointment?.purpose || purposeAppointment?.reason || ''
                // Try multiple matching strategies for patient prescriptions
                let history = prescriptions.filter(p=>p.patient?.id===d.id)
                let matchedByName = false
                
                // If no exact ID match, try matching by pet name and owner name
                if (history.length === 0) {
                  history = prescriptions.filter(p=> {
                    const pPatient = p.patient || {}
                    return (
                      (pPatient.petName?.toLowerCase() === d.petName?.toLowerCase()) &&
                      (pPatient.ownerName?.toLowerCase() === d.ownerName?.toLowerCase())
                    )
                  })
                  matchedByName = history.length > 0
                }
                
                // Debug info removed - prescription matching should work now
                return (
                  <div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                          <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/></svg>
                          <div>
                            <div className="text-xs text-emerald-600 font-semibold">Pet Name</div>
                            <div className="font-bold text-slate-800">{pet.petName}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-200">
                          <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/></svg>
                          <div>
                            <div className="text-xs text-blue-600 font-semibold">Species & Breed</div>
                            <div className="font-bold text-slate-800">{pet.species} • {pet.breed}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-xl border border-purple-200">
                          <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/></svg>
                          <div>
                            <div className="text-xs text-purple-600 font-semibold">Registration Date</div>
                            <div className="font-bold text-slate-800">{when.toLocaleDateString()}</div>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-xl border border-orange-200">
                          <svg className="w-5 h-5 text-orange-600" fill="currentColor" viewBox="0 0 20 20"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
                          <div>
                            <div className="text-xs text-orange-600 font-semibold">Owner Name</div>
                            <div className="font-bold text-slate-800">{owner.fullName}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-200">
                          <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/></svg>
                          <div>
                            <div className="text-xs text-green-600 font-semibold">Contact</div>
                            <div className="font-bold text-slate-800">{owner.contact}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                          <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>
                          <div>
                            <div className="text-xs text-indigo-600 font-semibold">Prescriptions</div>
                            <div className="font-bold text-slate-800">{history.length} records</div>
                            <div className="text-xs text-slate-500">
                              Total in system: {prescriptions.length}
                              {matchedByName && <span className="text-green-600 ml-1">(matched by name)</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                          <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20"><path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"/></svg>
                          <div>
                            <div className="text-xs text-amber-600 font-semibold">Consultation Fee</div>
                            <div className="font-bold text-slate-800">{consultationFee}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Appointment Information Section */}
                    {(todayAppointment || upcomingAppointment || patientAppointments.length > 0) && (
                      <div className="mb-6">
                        <div className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                          <svg className="w-5 h-5 text-slate-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/></svg>
                          Appointment Information
                        </div>
                        
                        <div className="space-y-3">
                          {/* Today's Appointment - Special Highlight */}
                          {todayAppointment && (
                            <div className={`bg-gradient-to-r ${todayAppointment.status === 'Completed' ? 'from-green-50 to-emerald-50 border-2 border-green-200' : 'from-red-50 to-orange-50 border-2 border-red-200'} rounded-xl p-4 relative overflow-hidden`}>
                              <div className={`absolute top-0 right-0 w-16 h-16 ${todayAppointment.status === 'Completed' ? 'bg-green-500' : 'bg-red-500'} rounded-bl-full flex items-center justify-center`}>
                                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                              </div>
                              <div className="flex items-center gap-3 mb-2">
                                <div className={`w-8 h-8 ${todayAppointment.status === 'Completed' ? 'bg-green-500' : 'bg-red-500'} rounded-lg flex items-center justify-center`}>
                                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/></svg>
                                </div>
                                <div>
                                  <div className={`font-bold text-base sm:text-lg ${todayAppointment.status === 'Completed' ? 'text-green-800' : 'text-red-800'}`}>
                                    {todayAppointment.status === 'Completed' ? '✅ APPOINTMENT COMPLETED' : '🔥 TODAY\'S APPOINTMENT'}
                                  </div>
                                  <div className={`text-xs sm:text-sm font-semibold ${todayAppointment.status === 'Completed' ? 'text-green-600' : 'text-red-600'}`}>
                                    {todayAppointment.status === 'Completed' ? 'Patient visit completed successfully!' : 'Patient has appointment today!'}
                                  </div>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-3">
                                <div className="bg-white/60 rounded-lg p-3">
                                  <div className={`text-xs font-semibold ${todayAppointment.status === 'Completed' ? 'text-green-600' : 'text-red-600'}`}>Date</div>
                                  <div className="font-bold text-slate-800">{new Date(todayAppointment.date).toLocaleDateString()}</div>
                                </div>
                                <div className="bg-white/60 rounded-lg p-3">
                                  <div className={`text-xs font-semibold ${todayAppointment.status === 'Completed' ? 'text-green-600' : 'text-red-600'}`}>Time</div>
                                  <div className="font-bold text-slate-800">{todayAppointment.time || 'Not specified'}</div>
                                </div>
                                <div className="bg-white/60 rounded-lg p-3">
                                  <div className={`text-xs font-semibold ${todayAppointment.status === 'Completed' ? 'text-green-600' : 'text-red-600'}`}>Doctor</div>
                                  <div className="font-bold text-slate-800">{todayAppointment.doctor || 'Not assigned'}</div>
                                </div>
                                <div className="bg-white/60 rounded-lg p-3">
                                  <div className={`text-xs font-semibold ${todayAppointment.status === 'Completed' ? 'text-green-600' : 'text-red-600'}`}>Status</div>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-3 h-3 rounded-full ${todayAppointment.status === 'Completed' ? 'bg-green-500' : todayAppointment.status === 'Cancelled' ? 'bg-red-500' : 'bg-amber-500'}`}></div>
                                      <div className={`font-bold text-sm ${todayAppointment.status === 'Completed' ? 'text-green-600' : todayAppointment.status === 'Cancelled' ? 'text-red-600' : 'text-amber-600'}`}>
                                        {todayAppointment.status === 'Completed' ? '✅ Completed' : todayAppointment.status === 'Cancelled' ? '❌ Cancelled' : '⏳ ' + (todayAppointment.status || 'Pending')}
                                      </div>
                                    </div>
                                    {todayAppointment.status !== 'Completed' && (
                                      <button 
                                        onClick={() => {
                                          // Update appointment status to Completed
                                          const updatedAppointments = appointments.map(apt => {
                                            const isMatch = (
                                              (apt.petId && apt.petId === d.id) ||
                                              (apt.petName?.toLowerCase() === d.petName?.toLowerCase() && 
                                               apt.ownerName?.toLowerCase() === d.ownerName?.toLowerCase())
                                            )
                                            if (isMatch && apt.date === todayAppointment.date) {
                                              return { ...apt, status: 'Completed' }
                                            }
                                            return apt
                                          })
                                          localStorage.setItem('reception_appointments', JSON.stringify(updatedAppointments))
                                          setAppointments(updatedAppointments)
                                        }}
                                        className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded-md font-semibold transition-colors"
                                      >
                                        Mark Done
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Upcoming Appointment */}
                          {upcomingAppointment && upcomingAppointment !== todayAppointment && (
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
                              <div className="flex items-center gap-3 mb-3">
                                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/></svg>
                                </div>
                                <div>
                                  <div className="font-bold text-blue-800">Next Appointment</div>
                                  <div className="text-blue-600 text-sm">Upcoming scheduled visit</div>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="bg-white/60 rounded-lg p-2">
                                  <div className="text-xs text-blue-600 font-semibold">Date</div>
                                  <div className="font-bold text-slate-800 text-sm">{new Date(upcomingAppointment.date).toLocaleDateString()}</div>
                                </div>
                                <div className="bg-white/60 rounded-lg p-2">
                                  <div className="text-xs text-blue-600 font-semibold">Time</div>
                                  <div className="font-bold text-slate-800 text-sm">{upcomingAppointment.time || 'TBD'}</div>
                                </div>
                                <div className="bg-white/60 rounded-lg p-2">
                                  <div className="text-xs text-blue-600 font-semibold">Doctor</div>
                                  <div className="font-bold text-slate-800 text-sm">{upcomingAppointment.doctor || 'TBD'}</div>
                                </div>
                              </div>
                            </div>
                          )}

                          {purposeText && (
                            <div className="bg-gradient-to-r from-slate-50 to-gray-50 border border-slate-200 rounded-xl p-3">
                              <div className="flex items-center justify-between gap-3 mb-2">
                                <div className="flex items-center gap-2">
                                  <svg className="w-4 h-4 text-slate-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/></svg>
                                  <span className="text-sm font-semibold text-slate-700">Purpose / Complaint</span>
                                </div>
                                {purposeAppointment?.date && (
                                  <div className="text-xs text-slate-500 font-semibold">
                                    {new Date(purposeAppointment.date).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                              <div className="text-sm text-slate-700 bg-white/70 border border-slate-200 rounded-lg px-3 py-2 break-words">
                                {purposeText}
                              </div>
                            </div>
                          )}
                          
                          {/* Recent Appointments Summary */}
                          {patientAppointments.length > 0 && (
                            <div className="bg-gradient-to-r from-slate-50 to-gray-50 border border-slate-200 rounded-xl p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <svg className="w-4 h-4 text-slate-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/></svg>
                                  <span className="text-sm font-semibold text-slate-700">Total Appointments</span>
                                </div>
                                <div className="px-2 py-1 bg-slate-200 rounded-md">
                                  <span className="text-sm font-bold text-slate-800">{patientAppointments.length}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Lab Tests Section */}
                    {(() => {
                      // Find patient lab tests
                      const patientLabTests = labReports.filter(report => 
                        (report.petId && report.petId === d.id) ||
                        (report.petName?.toLowerCase().trim() === d.petName?.toLowerCase().trim() && 
                         report.ownerName?.toLowerCase().trim() === d.ownerName?.toLowerCase().trim())
                      ).sort((a, b) => new Date(b.date || b.reportDate || b.createdAt) - new Date(a.date || a.reportDate || a.createdAt))
                      
                      if (patientLabTests.length > 0) {
                        const totalTestAmount = patientLabTests.reduce((sum, test) => sum + (Number(test.amount) || 0), 0)
                        const paidTests = patientLabTests.filter(t => t.paymentStatus === 'Paid')
                        const pendingTests = patientLabTests.filter(t => t.paymentStatus === 'Pending')
                        
                        return (
                          <div className="mb-6">
                            <div className="font-bold text-slate-800 mb-3 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-teal-600" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                                Laboratory Tests ({patientLabTests.length})
                              </div>
                              <div className="text-sm font-semibold text-teal-600">
                                Total: Rs. {totalTestAmount.toLocaleString()}
                              </div>
                            </div>
                            
                            {/* Test Summary Cards */}
                            <div className="grid grid-cols-2 gap-3 mb-3">
                              <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 rounded-xl p-3">
                                <div className="text-xs text-emerald-600 font-semibold mb-1">Paid Tests</div>
                                <div className="flex items-center justify-between">
                                  <div className="text-2xl font-bold text-emerald-700">{paidTests.length}</div>
                                  <div className="text-sm font-semibold text-emerald-600">Rs. {paidTests.reduce((s, t) => s + (Number(t.amount) || 0), 0).toLocaleString()}</div>
                                </div>
                              </div>
                              <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-3">
                                <div className="text-xs text-amber-600 font-semibold mb-1">Pending Payment</div>
                                <div className="flex items-center justify-between">
                                  <div className="text-2xl font-bold text-amber-700">{pendingTests.length}</div>
                                  <div className="text-sm font-semibold text-amber-600">Rs. {pendingTests.reduce((s, t) => s + (Number(t.amount) || 0), 0).toLocaleString()}</div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Test Cards */}
                            <div className="space-y-3 max-h-80 overflow-y-auto">
                              {patientLabTests.map((test, idx) => (
                                <div key={idx} className="bg-gradient-to-r from-white to-teal-50 border-2 border-teal-200 rounded-xl p-3 hover:shadow-md transition-all">
                                  <div className="flex items-start justify-between gap-3 mb-2">
                                    <div className="flex items-start gap-2 flex-1">
                                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/></svg>
                                      </div>
                                      <div className="flex-1">
                                        <div className="font-bold text-slate-900 mb-1">{test.testName || test.testType || 'Lab Test'}</div>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                          <div className="flex items-center gap-1 text-slate-600">
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/></svg>
                                            {new Date(test.date || test.reportDate || test.createdAt).toLocaleDateString()}
                                          </div>
                                          {test.reportNumber && (
                                            <div className="flex items-center gap-1 text-slate-600">
                                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"/></svg>
                                              #{test.reportNumber}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                      <div className="text-lg font-bold text-slate-900">Rs. {Number(test.amount || 0).toLocaleString()}</div>
                                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${test.paymentStatus === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {test.paymentStatus || 'Pending'}
                                      </span>
                                    </div>
                                  </div>
                                  {test.testCategory && (
                                    <div className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded inline-block">
                                      Category: {test.testCategory}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      }
                      return null
                    })()}
                    
                    {/* Radiology Records Section */}
                    {(() => {
                      let records = Array.isArray(d?.details?.radiology) ? [...d.details.radiology] : []
                      if (!records.length) {
                        try {
                          const local = JSON.parse(localStorage.getItem('radiology_records')||'[]')
                          records = local.filter(r => (r.patientId||'') === d.id)
                        } catch {}
                      }
                      if (!records.length) return null
                      records.sort((a,b)=> new Date(b.testDate || b.createdAt || 0) - new Date(a.testDate || a.createdAt || 0))
                      return (
                        <div className="mb-6">
                          <div className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <svg className="w-5 h-5 text-rose-600" fill="currentColor" viewBox="0 0 20 20"><path d="M4 3a1 1 0 00-1 1v12a1 1 0 001.555.832l4.89-3.26a1 1 0 011.11 0l4.89 3.26A1 1 0 0018 16V4a1 1 0 00-1-1H4z"/></svg>
                            Radiology Records ({records.length})
                          </div>
                          <div className="space-y-3 max-h-80 overflow-y-auto">
                            {records.map((rec, idx) => (
                              <div key={idx} className="border-2 border-rose-200 rounded-xl p-3 bg-gradient-to-r from-white to-rose-50">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="px-2 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">{rec.testType || 'Imaging'}</span>
                                  <span className="text-xs text-slate-500">{new Date(rec.testDate || rec.createdAt || Date.now()).toLocaleDateString()}</span>
                                </div>
                                <div className="text-xs text-slate-600 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {rec.bodyPart && <div><span className="font-medium">Body Part:</span> {rec.bodyPart}</div>}
                                  {rec.findings && <div className="sm:col-span-2"><span className="font-medium">Findings:</span> {rec.findings}</div>}
                                </div>
                                {Array.isArray(rec.images) && rec.images.length>0 && (
                                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
                                    {rec.images.slice(0,6).map((img,i)=>(
                                      <img key={i} src={img.data} alt={`img-${i}`} className="w-full h-20 object-cover rounded-lg border" />
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })()}
                    
                    {/* Medical Forms Section */}
                    {loadingForms ? (
                      <div className="mb-6">
                        <div className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                          <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/></svg>
                          Loading Medical Forms...
                        </div>
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
                        </div>
                      </div>
                    ) : medicalForms.length > 0 && (
                      <div className="mb-6">
                        <div className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                          <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/></svg>
                          Saved Medical Forms ({medicalForms.length})
                        </div>
                        <div className="space-y-3 max-h-80 overflow-y-auto">
                          {medicalForms.map((form, idx) => (
                            <div key={form._id || idx} className="bg-gradient-to-r from-white to-blue-50 border-2 border-blue-200 rounded-xl p-4 hover:shadow-md transition-all">
                              <div className="flex items-start justify-between gap-3 mb-3">
                                <div className="flex items-start gap-3 flex-1">
                                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                    form.formType === 'Treatment Chart' 
                                      ? 'bg-gradient-to-br from-blue-500 to-cyan-500' 
                                      : 'bg-gradient-to-br from-red-500 to-pink-500'
                                  }`}>
                                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      {form.formType === 'Treatment Chart' ? (
                                        <>
                                          <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                                          <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/>
                                        </>
                                      ) : (
                                        <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd"/>
                                      )}
                                    </svg>
                                  </div>
                                  <div className="flex-1">
                                    <div className="font-bold text-slate-900 mb-1">{form.formType}</div>
                                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                                      <div className="flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/></svg>
                                        {new Date(form.createdAt).toLocaleDateString()}
                                      </div>
                                      {form.createdBy && (
                                        <div className="flex items-center gap-1">
                                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/></svg>
                                          By: {form.createdBy}
                                        </div>
                                      )}
                                    </div>
                                    {form.bodyWeight && (
                                      <div className="text-xs text-slate-500 mt-1">
                                        Weight: {form.bodyWeight} kg
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <button
                                  onClick={async () => {
                                    try {
                                      const response = await medicalFormsAPI.getById(form._id)
                                      if (response.success && response.data) {
                                        setViewingForm(response.data)
                                      }
                                    } catch (err) {
                                      console.error('Error loading form:', err)
                                    }
                                  }}
                                  className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors flex items-center gap-1"
                                >
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></svg>
                                  View
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  form.formType === 'Treatment Chart'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-red-100 text-red-700'
                                }`}>
                                  {form.formType}
                                </span>
                                {form.species && (
                                  <span className="px-2 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                                    {form.species}
                                  </span>
                                )}
                                {form.doa && (
                                  <span className="px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                                    DOA: {form.doa}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {history.length > 0 && (
                      <div>
                        <div className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                          <svg className="w-5 h-5 text-slate-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>
                          Recent Prescriptions
                        </div>
                        <div className="space-y-3 max-h-60 overflow-y-auto">
                          {history.slice(0, 3).map((h,i)=> (
                            <div key={i} className="bg-gradient-to-r from-slate-50 to-indigo-50/50 border border-slate-200 rounded-xl p-3">
                              <div className="text-xs text-slate-500 mb-2 font-semibold">
                                {new Date(h.when).toLocaleDateString()}
                              </div>
                              <div className="space-y-2">
                                {(h.items||[]).slice(0, 2).map((it,idx)=> {
                                  const extractNum = (val) => { const m = String(val ?? '').match(/[-+]?[0-9]*\.?[0-9]+/); return m ? parseFloat(m[0]) : NaN }
                                  const hasPos = (v) => { const n = extractNum(v); return Number.isFinite(n) && n>0 }
                                  const dehyPct = (txt) => { const s = String(txt||'').toLowerCase(); if (s.includes('>')) return 8; const m = s.match(/([0-9]+(\.[0-9]+)?)\s*%?/); if (m) return parseFloat(m[1]); if (s.includes('mild')) return 5; if (s.includes('moderate')) return 7; if (s.includes('normal')) return 0; return NaN }
                                  const pick = (...vals) => { for (const v of vals) { if (v!=null && String(v).trim()!=='') return v } return '' }
                                  const weightSrc = pick(h.patient?.weightKg, h.patient?.weight, h.patient?.details?.weightKg, h.vitals?.weightKg, h.vitals?.weight, h.weightKg, h.weight, (selected?.details?.pet?.weightKg), selected?.weightKg, selected?.weight)
                                  const wNum = extractNum(weightSrc)
                                  const dehyd = pick(h.patient?.dehydration, h.patient?.details?.dehydration, h.vitals?.dehydration, h.dehydration, h.dehydrationPercent, selected?.dehydration, selected?.details?.dehydration)
                                  const pct = dehyPct(dehyd)
                                  const fluid = (Number.isFinite(wNum) && wNum>0 && Number.isFinite(pct)) ? (pct * wNum * 10) : NaN
                                  let displayDose = it.dose
                                  if ((it.useDehydration || !hasPos(displayDose)) && Number.isFinite(fluid) && fluid>0) {
                                    displayDose = fluid.toFixed(2)
                                  } else if (!hasPos(displayDose) && it.doseRate && it.perMl) {
                                    const doseRateNum = extractNum(it.doseRate)
                                    const perMlNum = extractNum(it.perMl)
                                    if (doseRateNum > 0 && perMlNum > 0 && wNum > 0) {
                                      const calculated = (doseRateNum * wNum) / perMlNum
                                      if (!isNaN(calculated) && calculated > 0) {
                                        displayDose = calculated.toFixed(2)
                                      }
                                    }
                                  }
                                  return (
                                    <div key={idx} className="bg-white rounded-lg p-2 border border-slate-200">
                                      <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                          <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-semibold">{it.route||'Oral'}</span>
                                          <span className="font-semibold text-slate-800">{it.name}</span>
                                        </div>
                                        <span className="font-bold text-emerald-700 text-sm">{displayDose||'—'} {it.unit||''}</span>
                                      </div>
                                      <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                                        {it.doseRate && <span className="bg-slate-100 px-2 py-0.5 rounded">Rate: {it.doseRate}</span>}
                                        {it.perMl && <span className="bg-slate-100 px-2 py-0.5 rounded">Per ml: {it.perMl}</span>}
                                        {it.composition && <span className="bg-slate-100 px-2 py-0.5 rounded">{it.composition}</span>}
                                      </div>
                                    </div>
                                  )
                                })}
                                {(h.items||[]).length > 2 && (
                                  <div className="text-xs text-slate-500">+{(h.items||[]).length - 2} more medicines</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {toDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={()=>setToDelete(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md ring-1 ring-slate-200 overflow-hidden" onClick={e=>e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200 font-semibold text-slate-800">Delete Patient</div>
            <div className="px-6 py-4 text-sm text-slate-700">
              Are you sure you want to delete this patient?
              <div className="mt-2 p-3 bg-slate-50 rounded border border-slate-200">
                <div className="text-xs text-slate-500">Patient ID</div>
                <div className="font-mono text-slate-800">{toDelete.id}</div>
                <div className="text-xs text-slate-500 mt-1">Pet</div>
                <div className="text-slate-800">{toDelete.petName} • {toDelete.type} • {toDelete.breed}</div>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 flex justify-end gap-2">
              <button onClick={()=>setToDelete(null)} className="h-9 px-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer">Cancel</button>
              <button onClick={()=>{ const next=rows.filter(x=>x.id!==toDelete.id); setRows(next); try{ localStorage.setItem('reception_pets', JSON.stringify(next)) }catch{}; setToDelete(null) }} className="h-9 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white cursor-pointer">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Medical Form Viewer Modal */}
      {viewingForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={()=>setViewingForm(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col" onClick={e=>e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-white flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-xl font-bold">{viewingForm.formType}</h2>
                <p className="text-sm text-blue-100">Patient: {viewingForm.animalName} • Owner: {viewingForm.ownerName}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    // Store form data and navigate to Medical Forms page for full view
                    localStorage.setItem('loadMedicalForm', JSON.stringify(viewingForm))
                    setViewingForm(null)
                    setSelected(null)
                    navigate('/doctor/medical-forms')
                  }}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white font-semibold transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd"/></svg>
                  Open Full Form
                </button>
                <button onClick={()=>setViewingForm(null)} className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Patient Information */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="text-xs text-blue-600 font-semibold mb-1">Patient ID</div>
                  <div className="font-bold text-slate-800">{viewingForm.patientId}</div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <div className="text-xs text-emerald-600 font-semibold mb-1">Animal Name</div>
                  <div className="font-bold text-slate-800">{viewingForm.animalName}</div>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <div className="text-xs text-purple-600 font-semibold mb-1">Owner Name</div>
                  <div className="font-bold text-slate-800">{viewingForm.ownerName}</div>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <div className="text-xs text-orange-600 font-semibold mb-1">Species</div>
                  <div className="font-bold text-slate-800">{viewingForm.species || 'N/A'}</div>
                </div>
                <div className="bg-pink-50 border border-pink-200 rounded-lg p-3">
                  <div className="text-xs text-pink-600 font-semibold mb-1">Age</div>
                  <div className="font-bold text-slate-800">{viewingForm.age || 'N/A'}</div>
                </div>
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                  <div className="text-xs text-indigo-600 font-semibold mb-1">Body Weight</div>
                  <div className="font-bold text-slate-800">{viewingForm.bodyWeight || 'N/A'} kg</div>
                </div>
                <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
                  <div className="text-xs text-teal-600 font-semibold mb-1">Contact</div>
                  <div className="font-bold text-slate-800">{viewingForm.contact || 'N/A'}</div>
                </div>
                <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3">
                  <div className="text-xs text-cyan-600 font-semibold mb-1">Gender</div>
                  <div className="font-bold text-slate-800">{viewingForm.gender || 'N/A'}</div>
                </div>
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                  <div className="text-xs text-rose-600 font-semibold mb-1">DOA</div>
                  <div className="font-bold text-slate-800">{viewingForm.doa || 'N/A'}</div>
                </div>
              </div>

              {/* Treatment Chart Details */}
              {viewingForm.formType === 'Treatment Chart' && viewingForm.drugs && viewingForm.drugs.some(d => d.name) && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-slate-800 mb-3">Treatment Details</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-slate-300">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="border border-slate-300 px-3 py-2 text-left text-sm font-semibold">Drug Name</th>
                          <th className="border border-slate-300 px-3 py-2 text-left text-sm font-semibold">Type</th>
                          <th className="border border-slate-300 px-3 py-2 text-left text-sm font-semibold">Concentration</th>
                          <th className="border border-slate-300 px-3 py-2 text-left text-sm font-semibold">Route</th>
                          <th className="border border-slate-300 px-3 py-2 text-left text-sm font-semibold">Dose</th>
                          <th className="border border-slate-300 px-3 py-2 text-left text-sm font-semibold">Frequency</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewingForm.drugs.filter(d => d.name).map((drug, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="border border-slate-300 px-3 py-2 text-sm">{drug.name}</td>
                            <td className="border border-slate-300 px-3 py-2 text-sm">{drug.type || '-'}</td>
                            <td className="border border-slate-300 px-3 py-2 text-sm">{drug.concentration || '-'}</td>
                            <td className="border border-slate-300 px-3 py-2 text-sm">{drug.route || '-'}</td>
                            <td className="border border-slate-300 px-3 py-2 text-sm">{drug.dose || '-'}</td>
                            <td className="border border-slate-300 px-3 py-2 text-sm">{drug.frequency || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Blood Transfusion Details */}
              {viewingForm.formType === 'Blood Transfusion' && viewingForm.medicationsAdministered && viewingForm.medicationsAdministered.some(m => m.name) && (
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-slate-800 mb-3">Medications Administered</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-slate-300">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="border border-slate-300 px-3 py-2 text-left text-sm font-semibold">Medicine Name</th>
                          <th className="border border-slate-300 px-3 py-2 text-left text-sm font-semibold">Dosage</th>
                          <th className="border border-slate-300 px-3 py-2 text-left text-sm font-semibold">Frequency</th>
                          <th className="border border-slate-300 px-3 py-2 text-left text-sm font-semibold">Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewingForm.medicationsAdministered.filter(m => m.name).map((med, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="border border-slate-300 px-3 py-2 text-sm">{med.name}</td>
                            <td className="border border-slate-300 px-3 py-2 text-sm">{med.dosage || '-'}</td>
                            <td className="border border-slate-300 px-3 py-2 text-sm">{med.frequency || '-'}</td>
                            <td className="border border-slate-300 px-3 py-2 text-sm">{med.duration || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Footer Info */}
              <div className="mt-6 pt-4 border-t border-slate-200 text-sm text-slate-600">
                <div className="flex justify-between">
                  <div>Created by: <span className="font-semibold">{viewingForm.createdBy || 'N/A'}</span></div>
                  <div>Date: <span className="font-semibold">{new Date(viewingForm.createdAt).toLocaleString()}</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
