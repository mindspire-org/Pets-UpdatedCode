import React, { useEffect, useMemo, useState } from 'react'
import { FiFileText, FiSearch, FiUser, FiCalendar, FiDollarSign, FiActivity, FiEye, FiX } from 'react-icons/fi'
import { MdLocalPharmacy } from 'react-icons/md'
import { useActivity } from '../../context/ActivityContext'
import { petsAPI, appointmentsAPI, prescriptionsAPI, pharmacySalesAPI, pharmacyDuesAPI, fullRecordAPI } from '../../services/api'

// Enhanced Visit Records - Professional UI with comprehensive pet history

export default function ReceptionVisits(){
  const [pets, setPets] = useState([])
  const [appointments, setAppointments] = useState([])
  const [prescriptions, setPrescriptions] = useState([])
  const [pharmacySales, setPharmacySales] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showMedicineHistory, setShowMedicineHistory] = useState(false)
  const [selectedPatientHistory, setSelectedPatientHistory] = useState(null)
  const [selectedClientId, setSelectedClientId] = useState('')
  const [clientDue, setClientDue] = useState(0)
  const [fullRecord, setFullRecord] = useState(null)

  // Load data from MongoDB
  useEffect(() => {
    loadAllData()
  }, [])

  // Refresh on cross-app financial updates (e.g., consultant fee paid via registration)
  useEffect(() => {
    const refresh = () => { try { loadAllData() } catch {} }
    const onStorage = (e) => { try { if (e.key === 'financial_updated_at') refresh() } catch {} }
    window.addEventListener('financial-updated', refresh)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('financial-updated', refresh)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const loadAllData = async () => {
    try {
      setLoading(true)
      const [petsRes, appointmentsRes, prescriptionsRes, pharmacyRes] = await Promise.all([
        petsAPI.getAll().catch(() => ({ data: [] })),
        appointmentsAPI.getAll().catch(() => ({ data: [] })),
        prescriptionsAPI.getAll().catch(() => ({ data: [] })),
        pharmacySalesAPI.getAll().catch(() => ({ data: [] }))
      ])
      setPets(petsRes.data || [])
      setAppointments(appointmentsRes.data || [])
      setPrescriptions(prescriptionsRes.data || [])
      setPharmacySales(pharmacyRes.data || [])
      
      // Visits are derived from appointments and prescriptions
      const visits = [...(appointmentsRes.data || []), ...(prescriptionsRes.data || [])]
      setRows(visits)
    } catch (err) {
      console.error('Error loading data:', err)
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }
  const [form, setForm] = useState({ petId:'', petName:'', ownerName:'', ownerId:'', doctor:'', reason:'', notes:'', status:'Pending', date:new Date().toISOString().slice(0,10), time:'', consultantFees:'' })
  const [query, setQuery] = useState('')
  const [selectedPet, setSelectedPet] = useState(null)
  const [selectedOwner, setSelectedOwner] = useState(null)
  const { addActivity } = useActivity()

  // No need to save visits to localStorage as they're derived from other collections

  const handleChange = e => {
    const { name, value } = e.target
    setForm(prev => ({...prev, [name]: value}))
  }

  const handlePetSelect = e => {
    const petId = e.target.value
    const pet = pets.find(p => String(p.id)===String(petId))
    if (pet) {
      setForm(prev => ({
        ...prev,
        petId,
        petName: pet.petName || '',
        ownerName: pet.ownerName || '',
        ownerId: pet.details?.owner?.ownerId || `OWN-${Date.now()}`
      }))
      setSelectedPet(pet)
      // Find owner and their other pets
      const ownerPets = pets.filter(p => 
        p.ownerName?.toLowerCase() === pet.ownerName?.toLowerCase() ||
        p.details?.owner?.ownerId === pet.details?.owner?.ownerId
      )
      setSelectedOwner({
        id: pet.details?.owner?.ownerId || `OWN-${Date.now()}`,
        name: pet.ownerName,
        contact: pet.contact || pet.details?.owner?.contact,
        pets: ownerPets
      })
    } else {
      setSelectedPet(null)
      setSelectedOwner(null)
    }
  }

  const handleSubmit = e => {
    e.preventDefault()
    const entry = { 
      ...form, 
      id: Date.now(), 
      when: new Date().toISOString(),
      consultantFees: parseFloat(form.consultantFees) || 0
    }
    setRows(prev => [entry, ...prev])
    try { addActivity({ user: 'Reception', text: `Recorded visit: ${entry.petName} • ${entry.reason}` }) } catch {}
    setForm({ petId:'', petName:'', ownerName:'', ownerId:'', doctor:'', reason:'', notes:'', status:'Pending', date:new Date().toISOString().slice(0,10), time:'', consultantFees:'' })
    setSelectedPet(null)
    setSelectedOwner(null)
  }

  const updateStatus = (id, status) => {
    setRows(prev => prev.map(r => r.id===id ? ({...r, status}) : r))
  }

  const viewMedicineHistory = (patientId, petName, ownerName) => {
    // Find all pharmacy purchases for this patient
    const patientPharmacySales = pharmacySales.filter(sale => 
      sale.patientId === patientId ||
      (sale.petName?.toLowerCase() === petName?.toLowerCase() && 
       sale.customerName?.toLowerCase() === ownerName?.toLowerCase())
    ).sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))

    setSelectedPatientHistory({
      patientId,
      petName,
      ownerName,
      pharmacySales: patientPharmacySales
    })
    setShowMedicineHistory(true)
  }

  const filtered = rows.filter(r => {
    const s = query.trim().toLowerCase()
    if(!s) return true
    return [r.petName,r.ownerName,r.doctor,r.reason,r.status].some(v => String(v||'').toLowerCase().includes(s))
  })

  const todayStr = new Date().toISOString().slice(0,10)
  const todays = rows.filter(r => (r.date||'').slice(0,10)===todayStr)

  // Get comprehensive pet history
  const getPetHistory = (petId, petName, ownerName) => {
    // Get visits
    const petVisits = rows.filter(r => 
      r.petId === petId || 
      (r.petName?.toLowerCase() === petName?.toLowerCase() && r.ownerName?.toLowerCase() === ownerName?.toLowerCase())
    ).sort((a, b) => new Date(b.when || b.date) - new Date(a.when || a.date))

    // Get appointments
    const petAppointments = appointments.filter(apt => 
      apt.petId === petId || 
      (apt.petName?.toLowerCase() === petName?.toLowerCase() && apt.ownerName?.toLowerCase() === ownerName?.toLowerCase())
    ).sort((a, b) => new Date(b.date + ' ' + (b.time || '00:00')) - new Date(a.date + ' ' + (a.time || '00:00')))

    // Get prescriptions
    const petPrescriptions = prescriptions.filter(p => 
      p.patient?.id === petId || 
      (p.patient?.petName?.toLowerCase() === petName?.toLowerCase() && p.patient?.ownerName?.toLowerCase() === ownerName?.toLowerCase())
    ).sort((a, b) => new Date(b.when) - new Date(a.when))

    // Calculate total fees paid - get from pet record
    const pet = pets.find(p => p.id === petId)
    const consultantFees = pet?.details?.clinic?.consultantFees || 0
    const totalFees = parseFloat(consultantFees) || 0

    // Get last visit date
    const lastVisit = petVisits.length > 0 ? petVisits[0] : null
    const lastAppointment = petAppointments.length > 0 ? petAppointments[0] : null

    return {
      visits: petVisits,
      appointments: petAppointments,
      prescriptions: petPrescriptions,
      totalVisits: petVisits.length,
      totalAppointments: petAppointments.length,
      totalPrescriptions: petPrescriptions.length,
      totalFees,
      lastVisit,
      lastAppointment,
      lastVisitDate: lastVisit ? new Date(lastVisit.when || lastVisit.date).toLocaleDateString() : 'Never'
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Visit Records</h1>
        <p className="text-slate-500 mt-1">Comprehensive pet history and owner management</p>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-white to-indigo-50 shadow-xl ring-1 ring-indigo-200 p-6 border border-indigo-100">
        <div className="mb-6 flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
            <FiSearch className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="text-indigo-800 font-bold text-xl">Pet ID Search</div>
            <div className="text-indigo-600 text-sm">Enter Pet ID to view complete history</div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <input 
              type="text" 
              value={query} 
              onChange={(e) => {
                setQuery(e.target.value)
                const input = e.target.value.trim()
                if (!input) { setSelectedPet(null); setSelectedOwner(null); setSelectedClientId(''); setClientDue(0); return }
                // Try Pet ID first
                const pet = pets.find(p => String(p.id)===String(input))
                if (pet) {
                  setSelectedPet(pet)
                  const ownerPets = pets.filter(p => 
                    (p.details?.owner?.clientId && p.details.owner.clientId === (pet.details?.owner?.clientId)) ||
                    (p.details?.owner?.ownerId && p.details.owner.ownerId === pet.details?.owner?.ownerId)
                  )
                  const cid = pet.clientId || pet.details?.owner?.clientId || pet.details?.owner?.ownerId || ''
                  setSelectedClientId(cid)
                  setSelectedOwner({
                    id: cid || pet.details?.owner?.ownerId || `OWN-${Date.now()}`,
                    name: pet.ownerName,
                    contact: pet.contact || pet.details?.owner?.contact,
                    pets: ownerPets
                  })
                  // Fetch dues for this client
                  if (cid) {
                    pharmacyDuesAPI.getByClient(cid).then(res=> setClientDue(Number(res.previousDue||0))).catch(()=> setClientDue(0))
                  }
                  // Load unified full record for this pet
                  (async () => {
                    try {
                      const fr = await fullRecordAPI.getByPet(pet.id)
                      setFullRecord(fr.data)
                    } catch (e) { setFullRecord(null) }
                  })()
                  return
                }
                // Else try Client ID match across pets
                const clientIdMatch = pets.find(p => (p.clientId && p.clientId===input) || (p.details?.owner?.clientId===input) || (p.details?.owner?.ownerId===input))
                if (clientIdMatch) {
                  const cid = input
                  const ownerPets = pets.filter(p => (p.clientId && p.clientId===cid) || (p.details?.owner?.clientId===cid) || (p.details?.owner?.ownerId===cid))
                  setSelectedPet(ownerPets[0] || null)
                  setSelectedClientId(cid)
                  setSelectedOwner({
                    id: cid,
                    name: ownerPets[0]?.ownerName || clientIdMatch.ownerName || 'Owner',
                    contact: ownerPets[0]?.details?.owner?.contact || clientIdMatch.details?.owner?.contact,
                    pets: ownerPets
                  })
                  pharmacyDuesAPI.getByClient(cid).then(res=> setClientDue(Number(res.previousDue||0))).catch(()=> setClientDue(0))
                  // Best-effort: load unified client record (optional display)
                  ;(async () => {
                    try {
                      const fr = await fullRecordAPI.getByClient(cid)
                      setFullRecord(fr.data)
                    } catch (e) { setFullRecord(null) }
                  })()
                  return
                }
                setSelectedPet(null)
                setSelectedOwner(null)
                setSelectedClientId('')
                setClientDue(0)
                setFullRecord(null)
              }}
              placeholder="Enter Pet ID or Client ID (e.g., PET-..., CL-...)" 
              className="h-14 px-6 rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 bg-white shadow-sm transition-all duration-200 w-full text-lg font-mono"
            />
          </div>
          <button 
            onClick={() => {
              setQuery('')
              setSelectedPet(null)
              setSelectedOwner(null)
            }}
            className="h-14 px-6 rounded-xl bg-slate-500 hover:bg-slate-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Selected Pet & Owner Information */}
      {selectedPet && selectedOwner && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pet History */}
          <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 shadow-xl ring-1 ring-blue-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <FiActivity className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="font-bold text-blue-800 text-lg">{selectedPet.petName} History</div>
                <div className="text-blue-600 text-sm">{selectedPet.type} • {selectedPet.breed}</div>
              </div>
            </div>
            
            {(() => {
              const history = getPetHistory(selectedPet.id, selectedPet.petName, selectedPet.ownerName)
              const consultantPaid = (Number(fullRecord?.totals?.consultationFees||0) > 0) || (history.totalFees > 0)
              return (
                <div className="space-y-4">
                  <div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${consultantPaid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      Consultation: {consultantPaid ? 'Paid' : 'Pending'}
                    </span>
                  </div>
                  {/* Unified financial snapshot (if available) */}
                  {fullRecord?.totals && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/70 rounded-lg p-3">
                        <div className="text-xs text-blue-600 font-semibold">Pharmacy</div>
                        <div className="text-sm text-slate-700">Total: Rs. {Number(fullRecord.totals.pharmacyTotal||0).toLocaleString()}</div>
                        <div className="text-xs text-slate-600">Paid: Rs. {Number(fullRecord.totals.pharmacyPaid||0).toLocaleString()} • Due: Rs. {Number(fullRecord.totals.pharmacyDue||0).toLocaleString()}</div>
                      </div>
                      <div className="bg-white/70 rounded-lg p-3">
                        <div className="text-xs text-blue-600 font-semibold">Lab / Radiology</div>
                        <div className="text-sm text-slate-700">Lab: Rs. {Number(fullRecord.totals.labTotal||0).toLocaleString()}</div>
                        <div className="text-sm text-slate-700">Radiology: Rs. {Number(fullRecord.totals.radiologyTotal||0).toLocaleString()}</div>
                      </div>
                    </div>
                  )}
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/60 rounded-lg p-3 text-center">
                      <div className="text-xs text-blue-600 font-semibold">Total Appointments</div>
                      <div className="font-bold text-2xl text-slate-800">{history.totalAppointments}</div>
                    </div>
                    <div className="bg-white/60 rounded-lg p-3 text-center">
                      <div className="text-xs text-blue-600 font-semibold">Last Appointment</div>
                      <div className="font-bold text-sm text-slate-800">
                        {history.lastAppointment ? new Date(history.lastAppointment.date).toLocaleDateString() : 'Never'}
                      </div>
                    </div>
                    <div className="bg-white/60 rounded-lg p-3 text-center">
                      <div className="text-xs text-blue-600 font-semibold">Completed</div>
                      <div className="font-bold text-xl text-green-600">
                        {history.appointments.filter(apt => apt.status === 'Completed').length}
                      </div>
                    </div>
                    <div className="bg-white/60 rounded-lg p-3 text-center">
                      <div className="text-xs text-blue-600 font-semibold">Pending</div>
                      <div className="font-bold text-xl text-amber-600">
                        {history.appointments.filter(apt => apt.status === 'Pending').length}
                      </div>
                    </div>
                  </div>

                  {/* Appointment History */}
                  {history.appointments.length > 0 && (
                    <div>
                      <div className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                        <FiCalendar className="w-4 h-4" />
                        Appointment History ({history.appointments.length})
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {history.appointments.map((appointment, idx) => (
                          <div key={idx} className="bg-white/60 rounded-lg p-3 border-l-4 border-blue-400">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <div className="font-semibold text-slate-800">{new Date(appointment.date).toLocaleDateString()}</div>
                                <div className="text-xs text-slate-600">{appointment.time || 'Time not specified'}</div>
                              </div>
                              <div className={`px-2 py-1 rounded text-xs font-semibold ${
                                appointment.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                appointment.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                                'bg-amber-100 text-amber-700'
                              }`}>
                                {appointment.status}
                              </div>
                            </div>
                            <div className="text-xs text-slate-600">
                              <div><strong>Doctor:</strong> {appointment.doctor || 'Not assigned'}</div>
                              {appointment.species && <div><strong>Species:</strong> {appointment.species}</div>}
                              {appointment.age && <div><strong>Age:</strong> {appointment.age}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Radiology Records */}
                  {(() => {
                    // Pull from selectedPet.details.radiology or localStorage fallback
                    let recs = Array.isArray(selectedPet?.details?.radiology) ? [...selectedPet.details.radiology] : []
                    if (!recs.length) {
                      try {
                        const local = JSON.parse(localStorage.getItem('radiology_records')||'[]')
                        recs = local.filter(r => (r.patientId||'') === (selectedPet?.id||''))
                      } catch {}
                    }
                    if (!recs.length) return null
                    recs.sort((a,b)=> new Date(b.testDate || b.createdAt || 0) - new Date(a.testDate || a.createdAt || 0))
                    return (
                      <div>
                        <div className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                          <svg className="w-4 h-4 text-rose-600" fill="currentColor" viewBox="0 0 20 20"><path d="M4 3a1 1 0 00-1 1v12a1 1 0 001.555.832l4.89-3.26a1 1 0 011.11 0l4.89 3.26A1 1 0 0018 16V4a1 1 0 00-1-1H4z"/></svg>
                          Radiology Records ({recs.length})
                        </div>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {recs.map((rec, idx) => (
                            <div key={idx} className="bg-white/80 rounded-lg p-3 border border-rose-200 shadow-sm">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 text-xs rounded-full bg-rose-100 text-rose-700 font-semibold">{rec.testType || 'Imaging'}</span>
                                  <span className="text-xs text-slate-600">{new Date(rec.testDate || rec.createdAt || Date.now()).toLocaleDateString()}</span>
                                </div>
                                {rec.bodyPart && <div className="text-xs text-slate-600">{rec.bodyPart}</div>}
                              </div>
                              {rec.findings && (
                                <div className="text-xs text-slate-600 mb-2"><span className="font-medium">Findings:</span> {rec.findings}</div>
                              )}
                              {Array.isArray(rec.images) && rec.images.length>0 && (
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                  {rec.images.slice(0,6).map((img,i)=> (
                                    <img key={i} src={img.data} alt={`img-${i}`} className="w-full h-20 object-cover rounded border" />
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}

                  {/* Last Visit Info */}
                  {history.lastAppointment && (
                    <div className="bg-gradient-to-r from-blue-100 to-indigo-100 rounded-lg p-3 border border-blue-200">
                      <div className="font-semibold text-blue-800 mb-1 flex items-center gap-2">
                        <FiCalendar className="w-4 h-4" />
                        Last Appointment
                      </div>
                      <div className="text-sm text-slate-700">
                        <div><strong>Date:</strong> {new Date(history.lastAppointment.date).toLocaleDateString()}</div>
                        <div><strong>Time:</strong> {history.lastAppointment.time || 'Not specified'}</div>
                        <div><strong>Status:</strong> {history.lastAppointment.status}</div>
                      </div>
                    </div>
                  )}

                  {/* Recent Medicines */}
                  {history.prescriptions.length > 0 && (
                    <div>
                      <div className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                        <FiFileText className="w-4 h-4" />
                        Recent Prescriptions ({history.prescriptions.length})
                      </div>
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {history.prescriptions.slice(0, 5).map((prescription, idx) => (
                          <div key={idx} className="bg-white/80 rounded-lg p-3 border border-blue-200 shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                              <div className="font-semibold text-slate-800 text-sm">
                                {new Date(prescription.when).toLocaleDateString()}
                              </div>
                              <div className="text-xs text-blue-600 font-medium">
                                {(prescription.items || []).length} medicine{(prescription.items || []).length !== 1 ? 's' : ''}
                              </div>
                            </div>
                            {prescription.doctor?.name && (
                              <div className="text-xs text-slate-600 mb-2">
                                <strong>Doctor:</strong> {prescription.doctor.name}
                              </div>
                            )}
                            <div className="space-y-2">
                              {(prescription.items || []).map((item, itemIdx) => (
                                <div key={itemIdx} className="bg-blue-50/50 rounded p-2 text-xs">
                                  <div className="font-semibold text-indigo-700 mb-1">{item.name}</div>
                                  <div className="grid grid-cols-2 gap-1 text-slate-600">
                                    {item.dose && (
                                      <div><span className="font-medium">Dose:</span> {item.dose} {item.unit || ''}</div>
                                    )}
                                    {item.route && (
                                      <div><span className="font-medium">Route:</span> {item.route}</div>
                                    )}
                                    {item.doseRate && (
                                      <div className="col-span-2"><span className="font-medium">Dose Rate:</span> {item.doseRate}</div>
                                    )}
                                    {item.instructions && (
                                      <div className="col-span-2"><span className="font-medium">Instructions:</span> {item.instructions}</div>
                                    )}
                                    {item.condition && (
                                      <div className="col-span-2"><span className="font-medium">Condition:</span> {item.condition}</div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                            {prescription.note && (
                              <div className="mt-2 text-xs text-slate-600 bg-amber-50 rounded p-2">
                                <strong>Note:</strong> {prescription.note}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Medicine Purchase History Button */}
                  <div className="mt-4">
                    <button
                      onClick={() => viewMedicineHistory(selectedPet.id, selectedPet.petName, selectedPet.ownerName)}
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
                    >
                      <MdLocalPharmacy className="w-5 h-5" />
                      View Medicine Purchase History
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Owner Information */}
          <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-green-50 shadow-xl ring-1 ring-emerald-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center">
                <FiUser className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="font-bold text-emerald-800 text-lg">Owner Information</div>
                <div className="text-emerald-600 text-sm">{selectedOwner.name}</div>
              </div>
            </div>

            <div className="space-y-4">
              {/* Owner Details */}
              <div className="bg-white/60 rounded-lg p-3">
                <div className="text-xs text-emerald-600 font-semibold mb-2">Owner Details</div>
                <div className="space-y-1 text-sm">
                  <div><span className="font-semibold">ID:</span> {selectedOwner.id}</div>
                  <div><span className="font-semibold">Name:</span> {selectedOwner.name}</div>
                  <div><span className="font-semibold">Contact:</span> {selectedOwner.contact || 'Not provided'}</div>
                </div>
              </div>

              {/* Owner's Pets */}
              <div>
                <div className="font-semibold text-emerald-800 mb-2">Owner's Pets ({selectedOwner.pets.length})</div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedOwner.pets.map((pet, idx) => {
                    const petHistory = getPetHistory(pet.id, pet.petName, pet.ownerName)
                    const paid = (Number(fullRecord?.totals?.consultationFees||0) > 0) || (petHistory.totalFees > 0)
                    return (
                      <div key={idx} className={`bg-white/60 rounded-lg p-3 border-l-4 ${pet.id === selectedPet.id ? 'border-emerald-500 bg-emerald-100/60' : 'border-slate-300'}`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-semibold text-slate-800">{pet.petName}</div>
                            <div className="text-xs text-slate-600">{pet.type} • {pet.breed}</div>
                            <div className="text-xs text-slate-500">ID: {pet.id}</div>
                          </div>
                          <div className="text-right text-xs">
                            <div className="text-slate-600">{petHistory.totalVisits} visits</div>
                            <div className="text-emerald-600 font-semibold">Rs. {petHistory.totalFees.toFixed(2)}</div>
                            <div className={`mt-1 inline-flex px-2 py-0.5 rounded-full ${paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{paid ? 'Consultation: Paid' : 'Consultation: Pending'}</div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Owner Summary */}
              <div className="bg-white/60 rounded-lg p-3">
                <div className="text-xs text-emerald-600 font-semibold mb-2">Owner Summary</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="font-semibold">Total Pets:</div>
                    <div className="text-slate-600">{selectedOwner.pets.length}</div>
                  </div>
                  <div>
                    <div className="font-semibold">Current Due:</div>
                    <div className="text-amber-600 font-bold">Rs. {Number(clientDue||0).toLocaleString()}</div>
                  </div>
                  <div className="col-span-2 grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <div className="font-semibold">Total Paid (Pharmacy):</div>
                      <div className="text-emerald-600 font-semibold">
                        Rs. {(() => {
                          const totalPaid = pharmacySales
                            .filter(s => (s.clientId && s.clientId===selectedClientId))
                            .reduce((sum, s) => sum + (Number(s.receivedAmount)||0), 0)
                          return totalPaid.toLocaleString()
                        })()}
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold">Total Consultant Fees:</div>
                      <div className="text-blue-700 font-semibold">
                        Rs. {selectedOwner.pets.reduce((sum, pet) => {
                          const history = getPetHistory(pet.id, pet.petName, pet.ownerName)
                          return sum + history.totalFees
                        }, 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Medicine Purchase History Modal */}
      {showMedicineHistory && selectedPatientHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full p-6 animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                  <MdLocalPharmacy className="h-6 w-6 text-violet-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Medicine Purchase History</h2>
                  <p className="text-slate-500">{selectedPatientHistory.petName} - {selectedPatientHistory.ownerName}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowMedicineHistory(false)} 
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition cursor-pointer"
              >
                <FiX className="h-6 w-6" />
              </button>
            </div>

            {selectedPatientHistory.pharmacySales.length > 0 ? (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl p-4 border border-violet-200 mb-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-violet-700">{selectedPatientHistory.pharmacySales.length}</div>
                      <div className="text-sm text-violet-600">Total Purchases</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-violet-700">
                        {selectedPatientHistory.pharmacySales.reduce((sum, sale) => sum + (sale.items?.length || 0), 0)}
                      </div>
                      <div className="text-sm text-violet-600">Total Medicines</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-violet-700">
                        Rs. {selectedPatientHistory.pharmacySales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0).toLocaleString()}
                      </div>
                      <div className="text-sm text-violet-600">Total Amount</div>
                    </div>
                  </div>
                </div>

                {selectedPatientHistory.pharmacySales.map((sale, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-4 shadow-md border border-violet-200">
                    <div className="flex justify-between items-start mb-3 pb-3 border-b border-slate-200">
                      <div>
                        <div className="font-bold text-slate-800 text-lg">
                          Invoice #{sale.invoiceNumber || sale.id}
                        </div>
                        <div className="text-sm text-slate-600">
                          {new Date(sale.createdAt || sale.date).toLocaleDateString()} at {new Date(sale.createdAt || sale.date).toLocaleTimeString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-violet-700">Rs. {(sale.totalAmount || 0).toLocaleString()}</div>
                        <div className="text-xs text-slate-500 bg-violet-100 px-2 py-1 rounded">
                          {sale.paymentMethod || 'Cash'}
                        </div>
                      </div>
                    </div>
                    
                    {sale.items && sale.items.length > 0 && (
                      <div className="space-y-2">
                        <div className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                          <MdLocalPharmacy className="w-4 h-4 text-violet-500" />
                          Medicines Purchased ({sale.items.length})
                        </div>
                        <div className="grid gap-2">
                          {sale.items.map((item, itemIdx) => (
                            <div key={itemIdx} className="bg-violet-50 rounded p-3 border-l-4 border-violet-400">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="font-medium text-violet-800 text-base">{item.medicineName || item.name}</div>
                                  <div className="text-sm text-slate-600 mt-1">
                                    <span className="font-medium">Quantity:</span> {item.quantity || item.mlUsed} {item.unit || (item.category === 'Injection' ? 'ml' : '')}
                                    {item.batchNo && <span className="ml-3"><span className="font-medium">Batch:</span> {item.batchNo}</span>}
                                    {item.dosage && <span className="ml-3"><span className="font-medium">Dosage:</span> {item.dosage}</span>}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-slate-800">Rs. {(item.totalPrice || item.price || 0).toLocaleString()}</div>
                                  <div className="text-xs text-slate-500">@ Rs. {(item.pricePerUnit || item.actualSalePrice || 0).toLocaleString()}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(sale.comments || sale.followUpDate) && (
                      <div className="mt-3 bg-slate-50 rounded p-3 text-sm">
                        {sale.followUpDate && (
                          <div className="mb-2">
                            <span className="font-semibold text-slate-700">Follow-up Date:</span>
                            <span className="ml-2 text-slate-600">{new Date(sale.followUpDate).toLocaleDateString()}</span>
                          </div>
                        )}
                        {sale.comments && (
                          <div>
                            <span className="font-semibold text-slate-700">Comments:</span>
                            <div className="text-slate-600 mt-1">{sale.comments}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-slate-50 rounded-xl p-8 text-center">
                <MdLocalPharmacy className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 font-medium text-lg">No medicine purchases found</p>
                <p className="text-slate-400 text-sm mt-2">This patient has not purchased any medicines from the pharmacy yet.</p>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setShowMedicineHistory(false)} 
                className="px-6 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition cursor-pointer font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}