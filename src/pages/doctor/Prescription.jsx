import React, { useEffect, useMemo, useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useSettings } from '../../context/SettingsContext'
import { medicinesAPI, vaccinesAPI, petsAPI, prescriptionsAPI, appointmentsAPI, doctorProfileAPI, pharmacyMedicinesAPI, labRequestsAPI } from '../../services/api'
import PrintPrescription from '../../components/print/PrintPrescription'

export default function DoctorPrescription(){
  const { settings } = useSettings()
  const location = useLocation()
  const [patientId, setPatientId] = useState('')
  const [patient, setPatient] = useState(null)
  const [notFound, setNotFound] = useState('')
  const [medicines, setMedicines] = useState([])
  const [vaccines, setVaccines] = useState([])
  const [regimens, setRegimens] = useState([]) // grouped by condition
  const [vaccineRegimens, setVaccineRegimens] = useState([]) // grouped by condition
  const [items, setItems] = useState([]) // selected medicines for prescription
  const [note, setNote] = useState('')
  const [allPatients, setAllPatients] = useState([])
  const [draftLoaded, setDraftLoaded] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [preview, setPreview] = useState(null)
  const [signature, setSignature] = useState('')
  const [previewPatient, setPreviewPatient] = useState(null)
  const [resetOnClose, setResetOnClose] = useState(false)
  const [patientHistory, setPatientHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [pharmacyMeds, setPharmacyMeds] = useState([])
  const [pharmacyLoading, setPharmacyLoading] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [selectedManualId, setSelectedManualId] = useState('')
  const [hxOptions, setHxOptions] = useState(['Vomiting','Diarrhea','Anorexia','Fever'])
  const [oeOptions, setOeOptions] = useState(['Dehydrated','Pale mucosa','Lethargic','Normal vitals'])
  const [dxOptions, setDxOptions] = useState(['Gastroenteritis','Dehydration','Infection','Parasitic'])
  const [testsOptions, setTestsOptions] = useState([])
  const [adviceOptions, setAdviceOptions] = useState([])
  const [notes, setNotes] = useState({ hx: [], oe: [], dx: [], advice: [], tests: [] })
  const [addNoteModal, setAddNoteModal] = useState({ open: false, type: 'hx', value: '' })
  const [deleteNoteModal, setDeleteNoteModal] = useState({ open: false, type: '', value: '' })
  const [dupMedModal, setDupMedModal] = useState({ open: false, regimen: null })
  const [dupVaccineModal, setDupVaccineModal] = useState({ open: false, regimen: null })
  const [hiddenRegimens, setHiddenRegimens] = useState([])
  const [hiddenVaccineRegimens, setHiddenVaccineRegimens] = useState([])
  const [showReferralSuccess, setShowReferralSuccess] = useState(false)
  const [referralData, setReferralData] = useState(null)
  const [editingId, setEditingId] = useState(null) // Track if editing existing prescription
  const lastLoadedRef = useRef(null) // Track last loaded prescription to prevent duplicates
  const isEditingRef = useRef(false) // Track editing mode immediately (for useEffect timing)
  const [toast, setToast] = useState('') // Toast message state

  // Show toast message
  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(''), 3000)
  }

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('doctor_note_options') || '{}')
      if (Array.isArray(saved.hx) && saved.hx.length) setHxOptions(saved.hx)
      if (Array.isArray(saved.oe) && saved.oe.length) setOeOptions(saved.oe)
      if (Array.isArray(saved.dx) && saved.dx.length) setDxOptions(saved.dx)
      if (Array.isArray(saved.tests) && saved.tests.length) setTestsOptions(saved.tests)
      if (Array.isArray(saved.advice) && saved.advice.length) setAdviceOptions(saved.advice)
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('doctor_note_options', JSON.stringify({ hx: hxOptions, oe: oeOptions, dx: dxOptions, tests: testsOptions, advice: adviceOptions }))
    } catch {}
  }, [hxOptions, oeOptions, dxOptions, testsOptions, adviceOptions])

  const openAddOption = (type) => {
    setAddNoteModal({ open: true, type, value: '' })
  }
  const confirmAddOption = () => {
    const type = addNoteModal.type
    const v = String(addNoteModal.value || '').trim()
    if (!v) { setAddNoteModal(m => ({ ...m, open: false })); return }
    if (type === 'hx') setHxOptions(prev => Array.from(new Set([...(prev||[]), v])))
    else if (type === 'oe') setOeOptions(prev => Array.from(new Set([...(prev||[]), v])))
    else if (type === 'dx') setDxOptions(prev => Array.from(new Set([...(prev||[]), v])))
    else if (type === 'tests') {
      setTestsOptions(prev => Array.from(new Set([...(prev||[]), v])))
      // Do not auto-check newly added test; user will tick explicitly
    }
    else if (type === 'advice') {
      setAdviceOptions(prev => Array.from(new Set([...(prev||[]), v])))
      setNotes(n => ({ ...n, advice: Array.from(new Set([...(n.advice||[]), v])) }))
    }
    else {
      setNotes(n => ({ ...n, [type]: Array.from(new Set([...(n[type]||[]), v])) }))
    }
    setAddNoteModal({ open: false, type, value: '' })
  }
  const cancelAddOption = () => setAddNoteModal(m => ({ ...m, open: false, value: '' }))
  const deleteOption = (type, value) => {
    const v = String(value||'')
    if (!v) return
    setDeleteNoteModal({ open: true, type, value: v })
  }
  const confirmDeleteOption = () => {
    const { type, value } = deleteNoteModal
    const v = String(value||'')
    if (!v) { setDeleteNoteModal({ open:false, type:'', value:'' }); return }
    if (type === 'hx') setHxOptions(prev => (prev||[]).filter(o=>o!==v))
    else if (type === 'oe') setOeOptions(prev => (prev||[]).filter(o=>o!==v))
    else if (type === 'dx') setDxOptions(prev => (prev||[]).filter(o=>o!==v))
    else if (type === 'tests') setTestsOptions(prev => (prev||[]).filter(o=>o!==v))
    else if (type === 'advice') setAdviceOptions(prev => (prev||[]).filter(o=>o!==v))
    setNotes(n => ({ ...n, [type]: Array.isArray(n[type]) ? n[type].filter(x=>x!==v) : [] }))
    setDeleteNoteModal({ open:false, type:'', value:'' })
  }
  const cancelDeleteOption = () => setDeleteNoteModal({ open:false, type:'', value:'' })

  // Compute Fluid requirement based on dehydration % and weight
  const fluidMl = useMemo(()=>{
    const wMatch = String(patient?.weightKg||'').match(/[-+]?[0-9]*\.?[0-9]+/)
    const w = wMatch ? parseFloat(wMatch[0]) : NaN
    if(!Number.isFinite(w) || w<=0) return null
    const level = String(patient?.dehydration||'').toLowerCase()
    let pct = NaN
    if(level.includes('>')) pct = 8
    else {
      const m = level.match(/([0-9]+(\.[0-9]+)?)\s*%?/)
      pct = m? parseFloat(m[1]) : (
        level.includes('mild')? 5 : level.includes('moderate')? 7 : level.includes('normal')? 0 : NaN
      )
    }
    if(!Number.isFinite(pct)) return null
    return pct * w * 10
  }, [patient?.weightKg, patient?.dehydration])

  const getDehydrationPct = () => {
    const level = String(patient?.dehydration||'').toLowerCase()
    if(level.includes('>')) return 8
    const m = level.match(/([0-9]+(\.[0-9]+)?)\s*%?/)
    if(m) return parseFloat(m[1])
    if(level.includes('mild')) return 5
    if(level.includes('moderate')) return 7
    if(level.includes('normal')) return 0
    return NaN
  }

  // Helpers: parse first numeric value from a string like "10 mg/kg" -> 10
  const num = (v) => {
    if(v===0) return 0
    const s = String(v||'').toString()
    const m = s.match(/[-+]?[0-9]*\.?[0-9]+/)
    return m? parseFloat(m[0]) : NaN
  }
  const calcDose = (x, wKg) => {
    const dr = num(x?.doseRate)
    const per = num(x?.perMl)
    const w = num(wKg)
    if(!isFinite(dr) || !isFinite(per) || !isFinite(w) || per<=0) return null
    return (dr * w) / per
  }
  const resetAll = () => {
    setPatientId('')
    setPatient(null)
    setItems([])
    setHiddenRegimens([])
    setNote('')
    setNotes({ hx: [], oe: [], dx: [], advice: [], tests: [] })
    setShowHistory(false)
    setPreview(null)
    setPreviewPatient(null)
    setResetOnClose(false)
    setEditingId(null) // Clear editing state
    lastLoadedRef.current = null // Clear loaded prescription ref
    isEditingRef.current = false // Clear editing mode ref
    try { localStorage.removeItem('doctor_prescription_draft') } catch (e) {}
  }

  // Merge vitals for preview/edit from multiple sources (saved record, current page state, history)
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
        return (cur==null? '' : cur)
      } catch { return '' }
    }
    const fromHist = (() => {
      try {
        const list = Array.isArray(patientHistory) ? patientHistory : []
        const hit = list.find(h => {
          const pp = h?.patient || {}
          const vv = h?.vitals || {}
          return (
            (pp.weightKg || pp.weight || pp.details?.weightKg || vv.weightKg || vv.weight || h.weightKg || h.weight) ||
            (pp.tempF || pp.temp || vv.tempF || vv.temp || h.tempF || h.temp || vv.temperature || pp.temperature) ||
            (pp.dehydration || pp.details?.dehydration || vv.dehydration || h.dehydration || h.dehydrationPercent)
          )
        })
        if (!hit) return {}
        // Prefer patient, then vitals, then root
        return { ...(hit.vitals||{}), ...(hit.patient||{}), ...hit }
      } catch { return {} }
    })()
    // Temperature candidates: support legacy keys and C values
    const tF = pick(
      get(base,'tempF'), get(base,'temp'), get(base,'temperatureF'), get(base,'temperature'), get(base,'vitals.tempF'), get(base,'vitals.temperature'),
      get(full,'patient.tempF'), get(full,'patient.temp'), get(full,'patient.temperatureF'), get(full,'patient.temperature'),
      get(full,'vitals.tempF'), get(full,'vitals.temperature'), get(full,'tempF'), get(full,'temp'), get(full,'temperatureF'), get(full,'temperature'),
      get(patient,'tempF'), get(patient,'temp'),
      get(fromHist,'tempF'), get(fromHist,'temp'), get(fromHist,'temperatureF'), get(fromHist,'temperature')
    )
    const tC = pick(
      get(base,'tempC'), get(base,'vitals.tempC'),
      get(full,'patient.tempC'), get(full,'vitals.tempC'), get(full,'tempC'),
      get(patient,'tempC'),
      get(fromHist,'tempC')
    )
    let tempUnit = pick(
      get(base,'tempUnit'), get(base,'vitals.tempUnit'),
      get(full,'patient.tempUnit'), get(full,'vitals.tempUnit'), get(full,'tempUnit'),
      get(patient,'tempUnit'),
      get(fromHist,'tempUnit')
    )
    let tempVal = tF
    if (!String(tempVal).trim()) { tempVal = tC; if (!String(tempUnit).trim()) tempUnit = '°C' }
    if (!String(tempUnit).trim()) tempUnit = '°F'
    return {
      ...base,
      weightKg: pick(
        get(base,'weightKg'), get(base,'weight'), get(base,'details.weightKg'), get(base,'vitals.weightKg'), get(base,'vitals.weight'),
        get(full,'patient.weightKg'), get(full,'patient.weight'), get(full,'patient.details.weightKg'),
        get(full,'vitals.weightKg'), get(full,'vitals.weight'), get(full,'weightKg'), get(full,'weight'),
        get(patient,'weightKg'), get(patient,'weight'), get(patient,'details.weightKg'),
        get(fromHist,'weightKg'), get(fromHist,'weight'), get(fromHist,'details.weightKg')
      ),
      tempF: tempVal,
      tempUnit,
      dehydration: pick(
        get(base,'dehydration'), get(base,'details.dehydration'), get(base,'vitals.dehydration'),
        get(full,'patient.dehydration'), get(full,'patient.details.dehydration'), get(full,'vitals.dehydration'), get(full,'dehydration'), get(full,'dehydrationPercent'),
        get(patient,'dehydration'), get(patient,'details.dehydration'),
        get(fromHist,'dehydration'), get(fromHist,'details.dehydration')
      )
    }
  }

  useEffect(() => {
    const prx = location?.state?.loadPrescription
    if (!prx) {
      console.log('No prescription to load from location.state')
      return
    }
    
    const prxId = prx.id || prx._id
    
    // Prevent re-loading same prescription using ref
    if (lastLoadedRef.current === prxId) {
      console.log('Already loaded prescription:', prxId, '- skipping')
      return
    }
    
    console.log('=== LOADING PRESCRIPTION FOR EDIT ===')
    console.log('Prescription ID:', prxId)
    console.log('Full prescription object:', JSON.stringify(prx, null, 2))
    lastLoadedRef.current = prxId
    
    try {
      const merged = mergePatientVitals(prx.patient || {}, prx)
      console.log('Merged patient data:', merged)
      
      // Set patient ID
      const patientIdValue = String(merged?.id || prx.patient?.id || '').trim()
      console.log('Setting patient ID:', patientIdValue)
      setPatientId(patientIdValue)
      
      // Set patient with all vitals - explicitly set all fields
      const patientData = {
        ...(merged || {}),
        id: merged?.id || prx.patient?.id || '',
        petName: merged?.petName || prx.patient?.petName || prx.patient?.name || '',
        ownerName: merged?.ownerName || prx.patient?.ownerName || prx.patient?.owner || '',
        species: merged?.species || prx.patient?.species || '',
        breed: merged?.breed || prx.patient?.breed || '',
        age: merged?.age || prx.patient?.age || '',
        gender: merged?.gender || prx.patient?.gender || '',
        weightKg: merged?.weightKg || prx.patient?.weightKg || prx.notes?.vitals?.weightKg || '',
        tempF: merged?.tempF || prx.patient?.tempF || prx.notes?.vitals?.tempF || '',
        tempUnit: merged?.tempUnit || prx.patient?.tempUnit || prx.notes?.vitals?.tempUnit || '°F',
        dehydration: merged?.dehydration || prx.patient?.dehydration || prx.notes?.vitals?.dehydration || '',
      }
      console.log('Setting patient data:', patientData)
      setPatient(patientData)
      
      // Set items (medicines and vaccines)
      const loadedItems = Array.isArray(prx.items) ? prx.items : []
      console.log('Setting items:', loadedItems.length, 'items')
      setItems(loadedItems)
      
      // Set notes
      const notesData = {
        hx: prx.notes?.hx || [],
        oe: prx.notes?.oe || [],
        dx: prx.notes?.dx || [],
        advice: prx.notes?.advice || [],
        tests: prx.notes?.tests || [],
      }
      console.log('Setting notes:', notesData)
      setNotes(notesData)
      
      setNote(prx.note || '')
      
      // Set editing ID to track we're editing an existing prescription
      console.log('Setting editingId:', prxId)
      setEditingId(prxId)
      isEditingRef.current = true // Set immediately for other useEffects
      
      console.log('=== PRESCRIPTION LOAD COMPLETE ===')
      
      setTimeout(() => {
        try {
          const prescriptionForm = document.querySelector('.prescription-form-section')
          if (prescriptionForm) prescriptionForm.scrollIntoView({ behavior: 'smooth', block: 'start' })
        } catch {}
      }, 50)
    } catch (e) {
      console.error('Error loading prescription from history:', e)
    }
  }, [location?.state?.loadPrescription])

  useEffect(()=>{
    const fetchData = async () => {
      try {
        // Fetch medicines from MongoDB
        const medicinesResponse = await medicinesAPI.getAll()
        const rawMeds = medicinesResponse?.data || medicinesResponse || []
        const medRegimens = Array.isArray(rawMeds) ? rawMeds : []
        setRegimens(medRegimens)

        // Flatten: each regimen row becomes one suggestion item
        const flatMeds = []
        for (const m of medRegimens) {
          if (m && Array.isArray(m.rows)) {
            m.rows.forEach((r, idx) => {
              flatMeds.push({
                id: `${m.id || m._id || 'M'}-${idx}`,
                name: r.name,
                composition: r.composition || r.dosage,
                ingredients: r.ingredients || '',
                condition: m.condition || '',
                route: r.route || '',
                doseRate: r.doseRate || '',
                perMl: r.perMl || '',
                dose: r.dose || '',
                unit: r.unit || '',
                description: [m.condition ? `Cond: ${m.condition}` : '', r.route ? `${r.route}` : '', (r.dose || r.unit) ? `${r.dose || ''}${r.unit || ''}` : '', r.instructions || ''].filter(Boolean).join(' • '),
              })
            })
          } else if (m && (m.name || m.dosage || m.description)) {
            flatMeds.push(m)
          }
        }
        setMedicines(flatMeds)
      } catch (e) {
        console.error('Error fetching medicines:', e)
        // Fallback to localStorage
        try {
          const raw = JSON.parse(localStorage.getItem('doctor_medicines') || '[]')
          const medRegs = Array.isArray(raw) ? raw : []
          setRegimens(medRegs)
          const flat = []
          for (const m of medRegs) {
            if (m && Array.isArray(m.rows)) {
              m.rows.forEach((r, idx) => {
                flat.push({
                  id: `${m.id || m._id || 'M'}-${idx}`,
                  name: r.name,
                  composition: r.composition || r.dosage,
                  ingredients: r.ingredients || '',
                  condition: m.condition || '',
                  route: r.route || '',
                  doseRate: r.doseRate || '',
                  perMl: r.perMl || '',
                  dose: r.dose || '',
                  unit: r.unit || '',
                  description: [m.condition ? `Cond: ${m.condition}` : '', r.route ? `${r.route}` : '', (r.dose || r.unit) ? `${r.dose || ''}${r.unit || ''}` : '', r.instructions || ''].filter(Boolean).join(' • '),
                })
              })
            } else if (m && (m.name || m.dosage || m.description)) {
              flat.push(m)
            }
          }
          setMedicines(flat)
        } catch (e) {}
      }

      try {
        // Fetch vaccines from MongoDB
        console.log('Fetching vaccines from database...');
        const vaccinesResponse = await vaccinesAPI.getAll()
        const rawVac = vaccinesResponse?.data || vaccinesResponse || []
        const vacRegimens = Array.isArray(rawVac) ? rawVac : []
        setVaccineRegimens(vacRegimens)

        const flatVac = []
        for (const v of vacRegimens) {
      if (v && Array.isArray(v.rows)) {
        v.rows.forEach((r, idx) => {
          // Flatten vaccine rows but keep shots info if available
          const shots = Array.isArray(r.shots) ? r.shots : []
          flatVac.push({
            id: `${v.id || v._id || 'V'}-${idx}`,
            name: r.name,
            condition: v.condition || '',
            route: r.route || '',
            instructions: r.instructions || '',
            shots: shots.length > 0 ? shots : [{
              dateGiven: r.dateGiven || '',
              nextDue: r.nextDue || '',
              vet: r.vet || '',
              shotStage: r.shotStage || '',
            }],
            isVaccine: true,
            description: [v.condition ? `Cond: ${v.condition}` : '', r.route ? `${r.route}` : '', (r.shotStage || (shots[0]?.shotStage)) ? `Stage: ${r.shotStage || shots[0]?.shotStage}` : '', r.instructions || ''].filter(Boolean).join(' • '),
          })
        })
      }
        }
        setVaccines(flatVac)
      } catch (e) {
        console.error('Error fetching vaccines:', e)
        // Fallback to localStorage
        try {
          const raw = JSON.parse(localStorage.getItem('doctor_vaccines') || '[]')
          const vacRegs = Array.isArray(raw) ? raw : []
          setVaccineRegimens(vacRegs)
          const flat = []
      if (v && Array.isArray(v.rows)) {
        v.rows.forEach((r, idx) => {
          const shots = Array.isArray(r.shots) ? r.shots : []
          flat.push({
            id: `${v.id || v._id || 'V'}-${idx}`,
            name: r.name,
            condition: v.condition || '',
            route: r.route || '',
            instructions: r.instructions || '',
            shots: shots.length > 0 ? shots : [{
              dateGiven: r.dateGiven || '',
              nextDue: r.nextDue || '',
              vet: r.vet || '',
              shotStage: r.shotStage || '',
            }],
            isVaccine: true,
            description: [v.condition ? `Cond: ${v.condition}` : '', r.route ? `${r.route}` : '', (r.shotStage || (shots[0]?.shotStage)) ? `Stage: ${r.shotStage || shots[0]?.shotStage}` : '', r.instructions || ''].filter(Boolean).join(' • '),
          })
        })
      }
          setVaccines(flat)
        } catch (err) {}
      }

      try {
        setPharmacyLoading(true)
        const resp = await pharmacyMedicinesAPI.getAll()
        const list = resp?.data || resp || []
        setPharmacyMeds(Array.isArray(list) ? list : [])
      } catch (e) {
        setPharmacyMeds([])
      } finally {
        setPharmacyLoading(false)
      }
      
      try {
        // Fetch patients from MongoDB
        const petsResponse = await petsAPI.getAll()
        setAllPatients(petsResponse?.data || [])
      } catch (e) {
        console.error('Error fetching patients:', e)
        try { setAllPatients(JSON.parse(localStorage.getItem('reception_pets')||'[]')) } catch (e) {}
      }
      
      try {
        // Fetch doctor signature from MongoDB
        const auth = JSON.parse(localStorage.getItem('doctor_auth')||'{}')
        if (auth.username) {
          const profileResponse = await doctorProfileAPI.get(auth.username)
          setSignature(profileResponse?.data?.signature || '')
        }
      } catch (e) {
        console.error('Error fetching signature:', e)
        try { setSignature(localStorage.getItem('doctor_signature')||'') } catch (e) {}
      }
      
      // Load draft if any (still from localStorage as it's temporary)
      // Skip draft loading if we're loading a prescription for editing
      const prxToLoad = location?.state?.loadPrescription
      if (!prxToLoad) {
        try {
          const draft = JSON.parse(localStorage.getItem('doctor_prescription_draft')||'null')
          if(draft){
            console.log('Loading draft from localStorage')
            setPatientId(draft.patientId || '')
            setPatient(draft.patient || null)
            setItems(Array.isArray(draft.items)? draft.items : [])
            setNote(draft.note || '')
            if(draft.notes){
              const n = draft.notes || {}
              setNotes({
                hx: Array.isArray(n.hx) ? n.hx : [],
                oe: Array.isArray(n.oe) ? n.oe : [],
                dx: Array.isArray(n.dx) ? n.dx : [],
                advice: Array.isArray(n.advice) ? n.advice : [],
                tests: Array.isArray(n.tests) ? n.tests : []
              })
            }
          }
        } catch (e) {}
      } else {
        console.log('Skipping draft load - prescription to edit detected')
      }
      setDraftLoaded(true)
    }
    fetchData()
  },[])

  // Persist draft on changes
  useEffect(()=>{
    if(!draftLoaded) return
    const draft = { patientId, patient, items, note, notes }
    try { localStorage.setItem('doctor_prescription_draft', JSON.stringify(draft)) } catch (e) {}
  }, [patientId, patient, items, note, notes, draftLoaded])

  useEffect(()=>{
    // Skip patient search when editing an existing prescription
    // The patient data is already loaded from the prescription
    // Use ref for immediate check (state might not be updated yet)
    if (editingId || isEditingRef.current) {
      console.log('Skipping patient search - in editing mode')
      return
    }
    
    const pid = (patientId||'').trim()
    if(!pid){ setPatient(null); setNotFound(''); return }
    const norm = pid.toLowerCase()
    
    console.log('=== PATIENT SEARCH DEBUG ===')
    console.log('Searching for patient ID:', pid)
    console.log('Total patients available:', allPatients.length)
    
    const match = (r) => {
      const ids = [r.id, r.details?.pet?.petId, r.details?.owner?.ownerId]
      const names = [r.petName, r.ownerName]
      const exactMatch = ids.some(v=>String(v||'').toLowerCase()===norm)
      const partialMatch = (pid.length>=3 && ids.some(v=>String(v||'').toLowerCase().includes(norm)))
      const nameMatch = (pid.length>=3 && names.some(v=>String(v||'').toLowerCase().includes(norm)))
      
      if (exactMatch || partialMatch || nameMatch) {
        console.log('Found match:', r.id, r.petName, 'Match type:', exactMatch ? 'exact' : partialMatch ? 'partial' : 'name')
      }
      
      return exactMatch || partialMatch || nameMatch
    }
    
    const p = allPatients.find(match)
    if(p){
      const d = p.details||{}
      const owner = d.owner || {}
      const pet = d.pet || {}
      
      const patientData = {
        id: p.id,
        petName: p.petName || pet.petName,
        species: p.type || pet.species,
        age: p.age || pet.dobOrAge,
        gender: p.gender || pet.gender || '',
        breed: p.breed || pet.breed || '',
        ownerName: p.ownerName || owner.fullName,
        appointment: new Date(p.when || Date.now()).toLocaleString(),
        weightKg: pet.weightKg || pet.weight || '',
        tempF: '',
        dehydration: '',
      }
      
      console.log('Patient found and set:', patientData)
      setPatient(patientData)
      setNotFound('')
    } else {
      console.log('No patient found for ID:', pid)
      setPatient(null)
      setNotFound('No patient found for the entered ID')
    }
  },[patientId, allPatients, editingId])

  // Load patient prescription history
  useEffect(()=>{
    if(!patient) { setPatientHistory([]); setHistoryLoading(false); return }
    const fetchHistory = async () => {
      try {
        setHistoryLoading(true)
        console.log('🔍 Fetching prescription history for patient:', patient.id)
        const response = await prescriptionsAPI.getByPatient(patient.id)
        const list = response?.data || []
        console.log('📋 Prescriptions from API:', list.length, 'records')
        console.log('📋 Full prescription data:', list)
        list.sort((a,b)=> new Date(b.when) - new Date(a.when))
        setPatientHistory(list)
        console.log('✅ Patient history set with', list.length, 'prescriptions')
      } catch (e) {
        console.error('❌ Error fetching prescription history:', e)
        // Fallback to localStorage
        try {
          const prs = JSON.parse(localStorage.getItem('doctor_prescriptions')||'[]')||[]
          console.log('📦 LocalStorage prescriptions:', prs.length, 'total')
          const list = prs.filter(p=>p?.patient?.id===patient.id)
          console.log('📦 Filtered for patient:', list.length, 'records')
          list.sort((a,b)=> new Date(b.when) - new Date(a.when))
          setPatientHistory(list)
        } catch (e) { 
          console.error('❌ LocalStorage fallback failed:', e)
          setPatientHistory([]) 
        }
      } finally { setHistoryLoading(false) }
    }
    fetchHistory()
  }, [patient])

  // If a known patient is selected and there are no current items yet,
  // auto-load the last saved prescription for convenience (editable).
  useEffect(()=>{
    if(!patient) return
    // Intentionally do not auto-populate old prescription items.
    // User can load a previous prescription from history if needed.
  }, [patient])

  const addMed = (m) => {
    const nameKey = normalizeKey(m?.name)
    if (!nameKey) return
    setItems(prev => {
      const list = Array.isArray(prev) ? prev : []
      const exists = list.some(x => normalizeKey(x?.name) === nameKey)
      if (exists) return list.filter(x => normalizeKey(x?.name) !== nameKey)
      return [...list, {
        id: Date.now()+Math.random(),
        name: m.name,
        composition: m.composition || m.dosage,
        doseRate: m.doseRate || '',
        perMl: m.perMl || '',
        ingredients: m.ingredients || '',
        description: m.description || '',
        route: m.route || '',
        dose: m.dose || '',
        unit: m.unit || '',
        condition: m.condition || '',
        instructions: '',
        doseType: 'Weight Based',
        useDehydration: false,
        isVaccine: false,
        shots: [],
      }]
    })
  }
  const addCondition = (cond, isVaccine = false) => {
    if(!cond || !Array.isArray(cond.rows)) return
    const mapped = cond.rows.map(r => ({
      id: Date.now()+Math.random(),
      name: r.name,
      composition: r.composition || r.dosage || '',
      doseRate: r.doseRate || '',
      perMl: r.perMl || '',
      ingredients: r.ingredients || '',
      route: r.route || '',
      dose: r.dose || '',
      unit: r.unit || '',
      doseType: isVaccine ? 'Fixed Dose' : (r.doseType || 'Weight Based'),
      condition: cond.condition || '',
      description: [cond.condition? `Cond: ${cond.condition}`: '', r.route? `${r.route}`:'', (r.dose||r.unit)? `${r.dose||''}${r.unit||''}`:'', r.instructions||''].filter(Boolean).join(' • '),
      instructions: r.instructions || '',
      useDehydration: false,
      isVaccine,
      shots: Array.isArray(r.shots) ? r.shots : [{
        dateGiven: r.dateGiven || '',
        nextDue: r.nextDue || '',
        vet: r.vet || '',
        shotStage: r.shotStage || '',
      }]
    }))
    setItems(prev=>[...prev, ...mapped])
  }

  const normalizeKey = (v) => String(v || '').toLowerCase().replace(/\s+/g, '').replace(/_/g, '')

  const hideRegimenButton = (cond) => {
    try {
      const k = normalizeKey(cond?.condition)
      if (!k) return
      setHiddenRegimens(prev => Array.from(new Set([...(Array.isArray(prev) ? prev : []), k])))
    } catch {
      // ignore
    }
  }

  const hasRegimenAlready = (cond, isVaccine = false) => {
    try {
      if (!cond || !Array.isArray(cond.rows)) return false
      const condKey = normalizeKey(cond.condition)
      const rowNames = cond.rows.map(r => normalizeKey(r?.name)).filter(Boolean)
      if (!condKey || rowNames.length === 0) return false
      return items.some(it => normalizeKey(it?.condition) === condKey && rowNames.includes(normalizeKey(it?.name)) && !!it.isVaccine === isVaccine)
    } catch {
      return false
    }
  }

  const handleConditionClick = (cond, isVaccine = false) => {
    try {
      if (!cond || !Array.isArray(cond.rows)) return
      const condKey = normalizeKey(cond.condition)
      const rowNames = (cond.rows || []).map(r => normalizeKey(r?.name)).filter(Boolean)

      const hasAny = (items || []).some(it => (
        normalizeKey(it?.condition) === condKey && rowNames.includes(normalizeKey(it?.name)) && !!it.isVaccine === isVaccine
      ))

      // Toggle behavior:
      // - if any medicine from this regimen is already in prescription -> remove them
      // - otherwise -> add all regimen medicines
      if (hasAny) {
        setItems(prev => (prev || []).filter(it => !(
          normalizeKey(it?.condition) === condKey && rowNames.includes(normalizeKey(it?.name)) && !!it.isVaccine === isVaccine
        )))
        return
      }

      addCondition(cond, isVaccine)
    } catch {
      addCondition(cond, isVaccine)
    }
  }

  const confirmRemoveDuplicateRegimen = () => {
    setDupMedModal({ open: false, regimen: null })
  }
  // When weight changes, auto-update calculated dose if computable
  useEffect(()=>{
    if(!patient) return
    setItems(prev=>{
      let changed=false
      const next = prev.map(x=>{
        const d = x.useDehydration ? (Number.isFinite(Number(fluidMl))? Number(fluidMl) : null) : calcDose(x, patient.weightKg)
        if(d!=null){
          const newDose = d.toFixed(2)
          if(String(x.dose||'')!==newDose){ changed=true; return { ...x, dose: newDose } }
        }
        return x
      })
      return changed? next : prev
    })
  },[patient?.weightKg])

  // If medicine fields change (doseRate/perMl), recompute that item's dose
  const onFieldChangeRecalc = (id, patch) => {
    setItems(prev=>{
      return prev.map(x=>{
        if(x.id!==id) return x
        const nx = { ...x, ...patch }
        const d = nx.useDehydration ? (Number.isFinite(Number(fluidMl))? Number(fluidMl) : null) : calcDose(nx, patient?.weightKg)
        return d!=null ? { ...nx, dose: d.toFixed(2) } : nx
      })
    })
  }

  // When user types medicine name, if it matches our list, fill related fields
  const tryAttachMedicine = (id, name) => {
    const m = medicines.find(mm=> String(mm.name||'').toLowerCase()===String(name||'').toLowerCase())
    if(!m) return
    onFieldChangeRecalc(id, { 
      name: m.name,
      composition: m.composition||'',
      doseRate: m.doseRate||'',
      perMl: m.perMl||'',
      unit: m.unit||''
    })
  }

  const tryAttachVaccine = (id, name) => {
    const v = vaccines.find(vv => String(vv.name || '').toLowerCase() === String(name || '').toLowerCase())
    if (!v) return
    setItems(prev => prev.map(x => {
      if (x.id !== id) return x
      const shots = Array.isArray(v.shots) ? v.shots : [{
        dateGiven: v.dateGiven || '',
        nextDue: v.nextDue || '',
        vet: v.vet || '',
        shotStage: v.shotStage || '',
      }]
      return {
        ...x,
        name: v.name,
        condition: v.condition || x.condition || '',
        route: v.route || x.route || '',
        instructions: v.instructions || x.instructions || '',
        shots: shots,
        doseType: 'Fixed Dose',
        isVaccine: true,
      }
    }))
  }
  const mapPharmacyToRx = (p) => {
    if (!p) return null
    const routeFromCategory = (cat) => {
      const s = String(cat||'').toLowerCase()
      if (s.includes('inject')) return 'Injection'
      if (s.includes('infus')) return 'Infusion'
      if (s.includes('tablet')) return 'Tablet'
      if (s.includes('capsule')) return 'Capsule'
      if (s.includes('syrup') || s.includes('liquid')) return 'Syrup'
      return (p.category || 'Other')
    }
    return {
      id: Date.now()+Math.random(),
      name: p.medicineName || p.name || '',
      composition: p.dosage || p.description || '',
      doseRate: '',
      perMl: '',
      ingredients: '',
      description: p.description || '',
      route: routeFromCategory(p.category),
      dose: '',
      unit: p.unit || (String(p.category||'').toLowerCase().includes('inject') ? 'ml' : ''),
      condition: 'General',
      instructions: '',
      doseType: 'Weight Based',
      useDehydration: false,
      isVaccine: false,
      shots: [],
    }
  }
  const addManualFromPharmacy = (id) => {
    if (!id) return
    const med = pharmacyMeds.find(m => String(m._id||m.id) === String(id))
    const rx = mapPharmacyToRx(med)
    if (!rx) return
    const nameKey = normalizeKey(rx?.name)
    if (!nameKey) return
    setItems(prev => {
      const list = Array.isArray(prev) ? prev : []
      const exists = list.some(x => normalizeKey(x?.name) === nameKey)
      if (exists) return list.filter(x => normalizeKey(x?.name) !== nameKey)
      return [...list, rx]
    })
  }
  // Helper to compute next due date based on shot stage (same as Vaccines page)
  const calcNextDue = (dateStr, stage) => {
    if(!dateStr || !stage) return ''
    const dt = new Date(dateStr)
    const days = ['1st','2nd','3rd','4th'].includes(stage) ? 21 : 365
    dt.setDate(dt.getDate() + days)
    return dt.toISOString().slice(0,10)
  }

  const addShotToItem = (id) => setItems(prev => prev.map(x => {
    if (x.id !== id) return x
    const shots = Array.isArray(x.shots) ? x.shots : []
    return { ...x, shots: [...shots, { dateGiven: '', nextDue: '', vet: '', shotStage: '' }] }
  }))

  const removeShotFromItem = (id, sIdx) => setItems(prev => prev.map(x => {
    if (x.id !== id) return x
    const shots = Array.isArray(x.shots) ? x.shots : []
    if (shots.length <= 1) return x
    return { ...x, shots: shots.filter((_, i) => i !== sIdx) }
  }))

  const updateItemShot = (id, sIdx, field, value) => setItems(prev => prev.map(x => {
    if (x.id !== id) return x
    const shots = Array.isArray(x.shots) ? x.shots : []
    const newShots = shots.map((s, i) => {
      if (i !== sIdx) return s
      const updated = { ...s, [field]: value }
      if (field === 'dateGiven' || field === 'shotStage') {
        updated.nextDue = calcNextDue(updated.dateGiven, updated.shotStage)
      }
      return updated
    })
    return { ...x, shots: newShots }
  }))

  const updateItem = (id, field, value) => setItems(prev=>prev.map(x=>{
    if(x.id!==id) return x
    return { ...x, [field]: value }
  }))
  const removeItem = (id) => setItems(prev=>prev.filter(x=>x.id!==id))
  const toggleDehydration = (id) => {
    setItems(prev => prev.map(x => {
      if (x.id !== id) return x
      const nx = { ...x, useDehydration: !x.useDehydration }
      const d = nx.useDehydration ? (Number.isFinite(Number(fluidMl))? Number(fluidMl) : null) : calcDose(nx, patient?.weightKg)
      return d!=null ? { ...nx, dose: d.toFixed(2), unit: nx.unit || 'ml' } : nx
    }))
  }

  const canSave = patient && items.length>0

  const saveAndPrint = async () => {
    if (!canSave) {
      showToast('Please select a patient and add at least one medicine', 'error')
      return
    }
    const doc = {
      id: editingId || 'PRX-' + Date.now(),
      when: new Date().toISOString(),
      patient: { ...patient, id: patient.id || patientId },
      items: [...items],
      note,
      notes: { ...notes },
      doctor: JSON.parse(localStorage.getItem('doctor_auth') || '{}')
    }
    await save()
    openPreview(doc)
  }

  const referToPharmacy = async () => {
    if (!canSave) {
      showToast('Please select a patient and add at least one medicine', 'error')
      return
    }
    await save()
    const meds = items
      .filter(x => !x.isVaccine)
      .map(x => ({ name: x.name, dosage: x.dose ? `${x.dose} ${x.unit || 'ml'}` : (x.unit || ''), instructions: x.instructions || '', quantity: 1, unit: x.unit || '' }))
    const referral = {
      id: 'REF-' + Date.now(),
      patientId: patient.id || patientId,
      petName: patient.petName || '',
      ownerName: patient.ownerName || '',
      contact: patient.ownerContact || '',
      medicines: meds,
      note,
      status: 'Pending',
      createdAt: new Date().toISOString(),
    }
    try {
      const existing = JSON.parse(localStorage.getItem('pharmacy_referrals') || '[]')
      localStorage.setItem('pharmacy_referrals', JSON.stringify([referral, ...(Array.isArray(existing) ? existing : [])]))
      setReferralData(referral)
      setShowReferralSuccess(true)
    } catch (e) {
      showToast('Failed to send referral to pharmacy', 'error')
    }
  }

  const save = async () => {
    if(!canSave) {
      showToast('Please select a patient and add at least one medicine', 'error')
      return
    }
    
    // Ensure patient data is complete and properly structured
    const patientData = {
      ...patient,
      id: patient.id || patientId, // Ensure ID is present
      petName: patient.petName || patient.name, // Handle different name fields
      ownerName: patient.ownerName || patient.owner, // Handle different owner fields
      // Persist vitals for future view/print
      weightKg: patient.weightKg || patient.weight || (patient.details?.weightKg) || '',
      tempF: (patient.tempF ?? patient.temp ?? ''),
      tempUnit: patient.tempUnit || '°F',
      dehydration: patient.dehydration || patient.details?.dehydration || '',
    }
    
    console.log('=== PRESCRIPTION SAVE DEBUG ===')
    console.log('Original patient:', patient)
    console.log('Patient ID from input:', patientId)
    console.log('Final patientData:', patientData)
    
    // Build notes object with vitals included
    const notesWithVitals = {
      ...notes,
      vitals: {
        weightKg: patientData.weightKg || '',
        tempF: patientData.tempF || '',
        tempUnit: patientData.tempUnit || '°F',
        dehydration: patientData.dehydration || '',
      }
    }

    // Get original prescription if editing (from location state)
    const originalPrx = location?.state?.loadPrescription
    const entry = {
      id: editingId || 'PRX-'+Date.now(),
      when: editingId ? (originalPrx?.when || new Date().toISOString()) : new Date().toISOString(),
      patient: patientData,
      items, // Contains medicines and vaccines with full data including nested shots
      note,
      notes: notesWithVitals, // Contains hx, oe, dx, advice, tests, and vitals
      doctor: JSON.parse(localStorage.getItem('doctor_auth')||'{}'),
    }
    
    try {
      // Save or update prescription to MongoDB
      console.log(editingId ? 'Updating prescription in MongoDB:' : 'Saving prescription to MongoDB:', entry)
      if (editingId) {
        await prescriptionsAPI.update(editingId, entry)
        console.log('Prescription updated to MongoDB successfully')
      } else {
        await prescriptionsAPI.create(entry)
        console.log('Prescription saved to MongoDB successfully')
      }

      // Automatically create Lab Sample Intake entries for selected tests (Lab Portal)
      try {
        const selectedTests = Array.isArray(notes?.tests) ? notes.tests.filter(t => String(t || '').trim()) : []
        if (selectedTests.length > 0) {
          const now = new Date()
          const requestDate = now.toISOString().slice(0,10)
          const requestTime = now.toTimeString().slice(0,5)
          const doctorAuth = entry.doctor || {}
          const doctorName = doctorAuth.name || doctorAuth.fullName || doctorAuth.username || ''

          const clinicalBlocks = [
            Array.isArray(notes.hx) && notes.hx.length ? `Hx: ${notes.hx.join(', ')}` : '',
            Array.isArray(notes.oe) && notes.oe.length ? `O/E: ${notes.oe.join(', ')}` : '',
            Array.isArray(notes.dx) && notes.dx.length ? `Dx: ${notes.dx.join(', ')}` : '',
            Array.isArray(notes.advice) && notes.advice.length ? `Advice: ${notes.advice.join(', ')}` : '',
            note ? `Note: ${note}` : ''
          ].filter(Boolean)

          const baseLabRequest = {
            petName: patientData.petName || '',
            ownerName: patientData.ownerName || '',
            contact: '',
            doctorName,
            patientId: patientData.id || patientId || '',
            species: patientData.species || '',
            age: patientData.age || '',
            gender: patientData.gender || '',
            priority: 'Routine',
            collectedBy: '',
            requestDate,
            requestTime,
            clinicalNotes: clinicalBlocks.join(' | '),
            referredBy: doctorName || undefined,
            technician: '',
            fee: '',
            paymentStatus: 'Pending',
            status: 'Pending',
          }

          for (const testNameRaw of selectedTests) {
            const testName = String(testNameRaw || '').trim()
            if (!testName) continue
            const payload = {
              ...baseLabRequest,
              testType: testName,
              // Let backend assign primary id; use a stable testId so stickers / reports can reference it
              testId: `T-${(patientData.id || patientId || 'PT')}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
            }
            try {
              await labRequestsAPI.create(payload)
            } catch (e) {
              console.error('Error creating lab request from prescription test:', testName, e)
            }
          }
        }
      } catch (e) {
        console.error('Error auto-creating lab sample intakes from prescription:', e)
      }
      
      // Also save to localStorage for backward compatibility
      const list = JSON.parse(localStorage.getItem('doctor_prescriptions')||'[]')
      const updatedPrescriptions = [entry, ...list]
      localStorage.setItem('doctor_prescriptions', JSON.stringify(updatedPrescriptions))
      
      // Auto-update appointment status to 'Completed' when prescription is saved
      try {
        const appointmentsResponse = await appointmentsAPI.getAll()
        const appointments = appointmentsResponse?.data || []
        
        // Find appointment for this patient (check multiple conditions)
        for (const apt of appointments) {
          const isPatientMatch = (
            // Match by Pet ID
            (apt.petId && (apt.petId === patientData.id || apt.petId === patientId)) ||
            // Match by pet name and owner name
            (apt.petName?.toLowerCase().trim() === patientData.petName?.toLowerCase().trim() && 
             apt.ownerName?.toLowerCase().trim() === patientData.ownerName?.toLowerCase().trim()) ||
            // Match by pet name only if owner not available
            (apt.petName?.toLowerCase().trim() === patientData.petName?.toLowerCase().trim() && 
             (!apt.ownerName || !patientData.ownerName))
          )
          
          // Update status to 'Completed' if it's an appointment for this patient
          if (isPatientMatch && apt.status !== 'Completed') {
            console.log('Updating appointment status to Completed for:', patientData.petName, 'Appointment:', apt)
            await appointmentsAPI.update(apt.id, { ...apt, status: 'Completed' })
          }
        }
        
        // Also update localStorage appointments
        const localAppointments = JSON.parse(localStorage.getItem('reception_appointments')||'[]')
        const updatedLocalAppointments = localAppointments.map(apt => {
          const isPatientMatch = (
            (apt.petId && (apt.petId === patientData.id || apt.petId === patientId)) ||
            (apt.petName?.toLowerCase().trim() === patientData.petName?.toLowerCase().trim() && 
             apt.ownerName?.toLowerCase().trim() === patientData.ownerName?.toLowerCase().trim()) ||
            (apt.petName?.toLowerCase().trim() === patientData.petName?.toLowerCase().trim() && 
             (!apt.ownerName || !patientData.ownerName))
          )
          if (isPatientMatch && apt.status !== 'Completed') {
            return { ...apt, status: 'Completed' }
          }
          return apt
        })
        localStorage.setItem('reception_appointments', JSON.stringify(updatedLocalAppointments))
        
        // Trigger storage event for real-time updates
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'reception_appointments',
          newValue: JSON.stringify(updatedLocalAppointments)
        }))
        
      } catch (error) {
        console.error('Error updating appointment status:', error)
      }
      
      // Force refresh of doctor patients page data
      try {
        // Trigger a custom event to refresh doctor patients
        window.dispatchEvent(new CustomEvent('prescriptionSaved', { 
          detail: { patientId: patientData.id, patientData } 
        }))
      } catch (error) {
        console.error('Error triggering refresh event:', error)
      }
      
      // Refresh patient history to show the newly saved prescription
      try {
        console.log('🔄 Refreshing prescription history after save...')
        const response = await prescriptionsAPI.getByPatient(patient.id)
        const list = response?.data || []
        console.log('📋 Fetched after save:', list.length, 'prescriptions')
        list.sort((a,b)=> new Date(b.when) - new Date(a.when))
        setPatientHistory(list)
        console.log('✅ History refreshed successfully')
      } catch (e) {
        console.error('❌ Error refreshing prescription history:', e)
      }
      
      try { localStorage.removeItem('doctor_prescription_draft') } catch (e) {}
      setResetOnClose(true)
      // Capture editing state before resetting (for toast message)
      const wasEditing = !!editingId
      // Reset form and clear editing state
      resetAll()
      // Show success message (use captured state)
      showToast(wasEditing ? 'Prescription updated successfully!' : 'Prescription saved successfully!', 'success')
      
    } catch (error) {
      console.error('Error saving prescription:', error)
      showToast('Failed to save prescription. Please try again.', 'error')
    }
  }
  const openPreview = (entry) => {
    setResetOnClose(!!entry)
    const doc = entry || { id:'', when:new Date().toISOString(), patient, items, note, doctor: JSON.parse(localStorage.getItem('doctor_auth')||'{}') }
    const merged = mergePatientVitals(entry?.patient || patient || {}, entry || null)
    setPreviewPatient(merged)
    // Also ensure preview doc carries merged patient so both paths have data
    doc.patient = merged
    setPreview(doc)
    setShowPreview(true)
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-slide-in ${
          toast.type === 'error' 
            ? 'bg-red-600 text-white' 
            : 'bg-emerald-600 text-white'
        }`}>
          {toast.type === 'success' ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
          )}
          {toast.message}
        </div>
      )}
      
      <div className="text-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">{editingId ? 'Edit Prescription' : 'Create Prescription'}</h1>
        <p className="text-slate-500 mt-1">{editingId ? 'Modify and update the existing prescription' : 'Generate professional prescriptions for your patients'}</p>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-white to-slate-50 shadow-xl ring-1 ring-slate-200/50 p-6 border border-slate-100">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
              <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/></svg>
              Patient ID / Search
            </label>
            <input className="h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 w-full transition-all duration-200 bg-white shadow-sm" placeholder="Enter Patient ID (e.g., PET-...) or name/contact" value={patientId} onChange={e=>setPatientId(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); setPatientId(v=>v.trim()) } }} />
          </div>
          <div className="flex items-end">
            <button type="button" onClick={()=>{ try{ setAllPatients(JSON.parse(localStorage.getItem('reception_pets')||'[]')) }catch(e){}; setPatientId(v=>v.trim()) }} className="h-12 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold cursor-pointer transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd"/></svg>
              Fetch
            </button>
          </div>
          <div className="md:col-span-2 text-sm text-slate-600 flex items-center">
            {patient ? `${patient.petName} â€¢ ${patient.species} â€¢ Owner: ${patient.ownerName} â€¢ ${patient.appointment}` : (notFound || 'Patient will appear if ID matches.')}
          </div>
        </div>
      </div>

      {patient && (
        <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100 shadow-xl ring-1 ring-blue-200/50 p-6 border border-blue-100">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/></svg>
            <div className="text-blue-800 font-bold text-lg">Patient Details</div>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <div className="h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center"><b className="mr-2">Patient ID:</b> {patient.id}</div>
            <div className="h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center"><b className="mr-2">Pet:</b> {patient.petName}</div>
            <div className="h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center"><b className="mr-2">Owner:</b> {patient.ownerName}</div>
            <div className="h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center"><b className="mr-2">Species:</b> {patient.species}</div>
            <div className="h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center"><b className="mr-2">Gender:</b> {patient.gender||'-'}</div>
            <div className="h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center"><b className="mr-2">Age:</b> {patient.age||'-'}</div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Weight */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Weight (kg)</label>
              <input 
                className="h-10 px-3 rounded-lg border-2 border-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 w-full transition-all" 
                placeholder="Enter weight" 
                value={patient.weightKg||''} 
                onChange={e=>setPatient(p=>({...p, weightKg:e.target.value}))} 
              />
            </div>
            
            {/* Temperature with Unit Selector */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Temperature</label>
              <div className="flex gap-2">
                <input 
                  className="h-10 px-3 rounded-lg border-2 border-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 flex-1 transition-all" 
                  placeholder="Enter temp" 
                  value={patient.tempF||''} 
                  onChange={e=>setPatient(p=>({...p, tempF:e.target.value}))} 
                />
                <select 
                  className="h-10 px-3 rounded-lg border-2 border-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-white transition-all font-medium" 
                  value={patient.tempUnit||'°F'} 
                  onChange={e=>setPatient(p=>({...p, tempUnit:e.target.value}))}
                >
                  <option value="°F">°F</option>
                  <option value="°C">°C</option>
                  <option value="K">K</option>
                </select>
              </div>
            </div>
            
            {/* Dehydration */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Dehydration</label>
              <select 
                className="h-10 px-3 rounded-lg border-2 border-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-white w-full transition-all" 
                value={patient.dehydration||''} 
                onChange={e=>setPatient(p=>({...p, dehydration:e.target.value}))}
              >
                <option value="">Select level</option>
                <option value="Normal (0%)">Normal</option>
                <option value="Mild (5%)">Mild (5% approx.)</option>
                <option value="Moderate (7%)">Moderate (7% approx.)</option>
                <option value=">7% (Severe)">Severe (&gt;7%)</option>
              </select>
              <div className="mt-1 text-xs text-slate-600">Fluid (ml): <span className="font-semibold">{fluidMl!=null? fluidMl.toFixed(0) : '—'}</span></div>
            </div>
          </div>

          {/* Clinical Notes */}
          <div className="mt-6">
            <div className="text-slate-700 font-medium mb-2">Clinical Notes (will show on left in print)</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-slate-600 font-semibold mb-1">Hx</div>
                <div className="space-y-1">
                  {hxOptions.map(opt=> (
                    <label key={opt} className="flex items-center gap-2 justify-between">
                      <span className="flex items-center gap-2">
                        <input type="checkbox" className="accent-sky-600" checked={(notes.hx||[]).includes(opt)} onChange={e=>setNotes(n=>({ ...n, hx: e.target.checked ? [...new Set([...(n.hx||[]), opt])] : (n.hx||[]).filter(x=>x!==opt) }))} /> {opt}
                      </span>
                      <button type="button" onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); deleteOption('hx', opt) }} className="text-red-600 hover:text-red-700 text-xs px-1">×</button>
                    </label>
                  ))}
                </div>
                <button type="button" onClick={()=>openAddOption('hx')} className="mt-2 text-xs px-2 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-50">+ Add New</button>
              </div>
              <div>
                <div className="text-slate-600 font-semibold mb-1">O/E</div>
                <div className="space-y-1">
                  {oeOptions.map(opt=> (
                    <label key={opt} className="flex items-center gap-2 justify-between">
                      <span className="flex items-center gap-2">
                        <input type="checkbox" className="accent-sky-600" checked={(notes.oe||[]).includes(opt)} onChange={e=>setNotes(n=>({ ...n, oe: e.target.checked ? [...new Set([...(n.oe||[]), opt])] : (n.oe||[]).filter(x=>x!==opt) }))} /> {opt}
                      </span>
                      <button type="button" onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); deleteOption('oe', opt) }} className="text-red-600 hover:text-red-700 text-xs px-1">×</button>
                    </label>
                  ))}
                </div>
                <button type="button" onClick={()=>openAddOption('oe')} className="mt-2 text-xs px-2 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-50">+ Add New</button>
              </div>
              <div>
                <div className="text-slate-600 font-semibold mb-1">Dx</div>
                <div className="space-y-1">
                  {dxOptions.map(opt=> (
                    <label key={opt} className="flex items-center gap-2 justify-between">
                      <span className="flex items-center gap-2">
                        <input type="checkbox" className="accent-sky-600" checked={(notes.dx||[]).includes(opt)} onChange={e=>setNotes(n=>({ ...n, dx: e.target.checked ? [...new Set([...(n.dx||[]), opt])] : (n.dx||[]).filter(x=>x!==opt) }))} /> {opt}
                      </span>
                      <button type="button" onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); deleteOption('dx', opt) }} className="text-red-600 hover:text-red-700 text-xs px-1">×</button>
                    </label>
                  ))}
                </div>
                <button type="button" onClick={()=>openAddOption('dx')} className="mt-2 text-xs px-2 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-50">+ Add New</button>
              </div>
            </div>
          </div>

          {/* Advice */}
          <div className="mt-6">
            <div className="text-slate-700 font-medium mb-2">Advice</div>
            <div className="rounded-xl p-4 bg-gradient-to-br from-emerald-50 to-white ring-1 ring-emerald-200/70">
              <div className="flex flex-wrap gap-2 mb-3">
                {(notes.advice||[]).map((a,i)=> (
                  <span key={`adv${i}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs">
                    {a}
                    <button onClick={()=>setNotes(n=>({ ...n, advice: n.advice.filter((_,idx)=>idx!==i) }))} className="ml-1 text-emerald-700 hover:text-emerald-900">×</button>
                  </span>
                ))}
              </div>
              <button type="button" onClick={()=>openAddOption('advice')} className="text-xs px-3 h-9 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50">+ Add New</button>
            </div>
          </div>

          {/* Tests */}
          <div className="mt-6">
            <div className="text-slate-700 font-medium mb-2">Tests</div>
            <div className="rounded-xl p-4 bg-gradient-to-br from-cyan-50 to-white ring-1 ring-cyan-200/70">
              <div className="space-y-1 text-sm">
                {(testsOptions||[]).map(opt=> (
                  <label key={opt} className="flex items-center gap-2 justify-between">
                    <span className="flex items-center gap-2">
                      <input type="checkbox" className="accent-sky-600" checked={(notes.tests||[]).includes(opt)} onChange={e=>setNotes(n=>({ ...n, tests: e.target.checked ? [...new Set([...(n.tests||[]), opt])] : (n.tests||[]).filter(x=>x!==opt) }))} /> {opt}
                    </span>
                    <button type="button" onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); deleteOption('tests', opt) }} className="text-red-600 hover:text-red-700 text-xs px-1">×</button>
                  </label>
                ))}
              </div>
              <button type="button" onClick={()=>openAddOption('tests')} className="mt-2 text-xs px-3 h-9 rounded-lg border border-cyan-300 text-cyan-700 hover:bg-cyan-50">+ Add New</button>
            </div>
          </div>

          {/* Patient Prescription History */}
          <div className="mt-6">
            <button onClick={()=>setShowHistory(!showHistory)} className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg disabled:opacity-70" disabled={historyLoading}>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/></svg>
                <span>Prescription History {historyLoading? '(loading...)' : `(${patientHistory.length} records)`}</span>
              </div>
              <svg className={`w-5 h-5 transition-transform ${showHistory?'rotate-180':''}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
            </button>
            {showHistory && (
              <div className="mt-4 space-y-3 max-h-96 overflow-y-auto">
                {historyLoading && (
                  <div className="text-center py-6 text-amber-600">Loading history...</div>
                )}
                {!historyLoading && patientHistory.length===0 && (
                  <div className="text-center py-12 text-purple-400">
                    <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>
                    <div className="text-lg font-semibold mb-1">No prescription history</div>
                    <div className="text-sm">This patient hasn't received any prescriptions yet</div>
                  </div>
                )}
                {!historyLoading && patientHistory.map((prx, idx)=> (
                    <div key={prx.id||idx} className="bg-white rounded-xl border-2 border-amber-200 p-4 hover:shadow-lg transition-all">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-bold text-slate-800 flex items-center gap-2">
                            <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/></svg>
                            {new Date(prx.when).toLocaleString()}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">Doctor: {prx.doctor?.name || prx.doctor?.username || 'N/A'}</div>
                        </div>
                        <div className="text-xs bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-semibold">
                          {prx.items?.length || 0} medicines
                        </div>
                      </div>
                      
                      {/* Clinical Notes */}
                      {(prx.notes?.hx?.length || prx.notes?.oe?.length || prx.notes?.dx?.length || prx.notes?.advice?.length || prx.notes?.tests?.length) ? (
                        <div className="mb-3 p-3 bg-slate-50 rounded-lg text-xs">
                          {prx.notes.hx?.length > 0 && <div><b className="text-blue-700">Hx:</b> {prx.notes.hx.join(', ')}</div>}
                          {prx.notes.oe?.length > 0 && <div><b className="text-green-700">O/E:</b> {prx.notes.oe.join(', ')}</div>}
                          {prx.notes.dx?.length > 0 && <div><b className="text-rose-700">Dx:</b> {prx.notes.dx.join(', ')}</div>}
                          {prx.notes.advice?.length > 0 && <div><b className="text-emerald-700">Advice:</b> {prx.notes.advice.join(', ')}</div>}
                          {prx.notes.tests?.length > 0 && <div><b className="text-cyan-700">Tests:</b> {prx.notes.tests.join(', ')}</div>}
                        </div>
                      ) : null}
                      
                      {/* Medicines List */}
                      <div className="space-y-2">
                        {(prx.items||[]).map((med, i)=> {
                          // Calculate dose with dehydration support
                          const extractNum = (val) => {
                            const m = String(val ?? '').match(/[-+]?[0-9]*\.?[0-9]+/)
                            return m ? parseFloat(m[0]) : NaN
                          }
                          const hasPos = (val) => { const n = extractNum(val); return Number.isFinite(n) && n>0 }
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
                          const pcalc = mergePatientVitals(prx.patient||{}, prx)
                          const weightSrc = pcalc?.weightKg || pcalc?.weight || pcalc?.details?.weightKg || patient?.weightKg || patient?.weight
                          const weightNum = extractNum(weightSrc)
                          const pct = dehyPct(pcalc?.dehydration || pcalc?.details?.dehydration)
                          const fluid = (Number.isFinite(weightNum) && weightNum>0 && Number.isFinite(pct)) ? (pct * weightNum * 10) : NaN
                          let displayDose = med.dose
                          
                          if ((med.useDehydration || !hasPos(displayDose)) && Number.isFinite(fluid) && fluid>0) {
                            displayDose = fluid.toFixed(2)
                          } else if (!hasPos(displayDose) && med.doseRate && med.perMl) {
                            const doseRateNum = extractNum(med.doseRate)
                            const perMlNum = extractNum(med.perMl)
                            if (doseRateNum > 0 && perMlNum > 0 && weightNum > 0) {
                              const calculated = (doseRateNum * weightNum) / perMlNum
                              if (!isNaN(calculated) && calculated > 0) {
                                displayDose = calculated.toFixed(2)
                              }
                            }
                          }
                          
                          return (
                            <div key={i} className="flex items-start gap-2 text-sm border-l-2 border-amber-400 pl-3 py-1">
                              <div className="flex-1">
                                <div className="font-semibold text-slate-800">{med.name}</div>
                                <div className="text-xs text-slate-600 flex flex-wrap gap-1">
                                  {med.route && <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">• {med.route}</span>}
                                  {displayDose && displayDose !== '-' && displayDose !== '—' && <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-semibold">• Dose: {displayDose} {med.unit||'ml'}</span>}
                                </div>
                              </div>
                              <div className="text-right min-w-[120px]">
                                <div className="text-xs text-slate-500 mb-1">Calculated Dose</div>
                                <div className={`font-bold text-lg ${displayDose && displayDose!=='-' && displayDose!=='—'? 'text-emerald-700':'text-slate-400'}`}>{displayDose && displayDose!=='-' && displayDose!=='—'? `${displayDose} ${med.unit||'ml'}` : '—'}</div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      
                      <div className="mt-3 flex gap-2">
                        <button 
                          onClick={()=>{ 
                            // Load prescription into form for editing
                            setItems(prx.items || [])
                            setNotes({
                              hx: prx.notes?.hx || [],
                              oe: prx.notes?.oe || [],
                              dx: prx.notes?.dx || [],
                              advice: prx.notes?.advice || [],
                              tests: prx.notes?.tests || []
                            })
                            setNote(prx.note || '')
                            if (prx.patient) {
                              const merged = mergePatientVitals(prx.patient, prx)
                              setPatient(prev => ({ ...prev, ...merged }))
                            }
                            // Scroll to prescription form
                            setTimeout(() => {
                              const prescriptionForm = document.querySelector('.prescription-form-section')
                              if (prescriptionForm) {
                                prescriptionForm.scrollIntoView({ behavior: 'smooth', block: 'start' })
                              }
                            }, 100)
                          }} 
                          className="flex-1 h-9 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
                          Edit
                        </button>
                        <button 
                          onClick={()=>{ const merged = mergePatientVitals(prx.patient||{}, prx); setPreviewPatient(merged); setPreview({ ...prx, patient: merged }); setResetOnClose(false); setShowPreview(true) }} 
                          className="flex-1 h-9 rounded-lg bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></svg>
                          View / Print
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-100 shadow-xl ring-1 ring-purple-200/50 p-6 border border-purple-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/></svg>
            <div className="text-purple-800 font-bold text-lg">Medicine Suggestions</div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={()=>{ setManualOpen(v=>!v) }} className="h-9 px-4 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-sm font-semibold shadow-md hover:shadow-lg">
              + Add Manual Medicine
            </button>
          </div>
        </div>
        {manualOpen && (
          <div className="mb-3 bg-white/70 border border-purple-200 rounded-lg p-3">
            <div className="flex items-center gap-3">
              <select
                value={selectedManualId}
                onChange={(e)=>{ const v=e.target.value; setSelectedManualId(v); if(v){ addManualFromPharmacy(v); } setTimeout(()=>setSelectedManualId(''), 0) }}
                disabled={pharmacyLoading}
                className="flex-1 h-11 px-3 rounded-lg border-2 border-slate-300 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 bg-white"
              >
                <option value="">{pharmacyLoading? 'Loading medicines…' : 'Select medicine from Pharmacy…'}</option>
                {pharmacyMeds.map(m => (
                  <option key={m._id||m.id} value={m._id||m.id}>
                    {(m.medicineName||m.name||'Unnamed')} {m.category? `(${m.category})` : ''}
                  </option>
                ))}
              </select>
              <button type="button" onClick={()=>setManualOpen(false)} className="h-11 px-3 rounded-lg border-2 border-slate-300 text-slate-700 hover:bg-slate-50">Close</button>
            </div>
          </div>
        )}
        {/* Condition chips */}
        {regimens.length>0 && (
          <div className="mb-3 flex flex-wrap gap-3">
            {regimens
              .filter(g => !hiddenRegimens.includes(normalizeKey(g?.condition)))
              .map(g => (
              <button key={g.id} onClick={()=>handleConditionClick(g)} className={`group h-10 px-4 rounded-xl text-white border-2 cursor-pointer text-sm font-semibold transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 flex items-center gap-2 ${hasRegimenAlready(g)?'bg-gradient-to-r from-emerald-600 to-teal-600 border-emerald-300 hover:from-emerald-700 hover:to-teal-700':'bg-gradient-to-r from-sky-500 to-blue-500 border-sky-300 hover:from-sky-600 hover:to-blue-600 hover:border-sky-400'}`}>
                {hasRegimenAlready(g) ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 10a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1z" clipRule="evenodd"/></svg>
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 01-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/></svg>
                )}
                {g.condition || 'Condition'}
              </button>
            ))}
          </div>
        )}
        {regimens.length===0 && (
          <div className="text-center py-8 text-purple-400">
            <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/></svg>
            <div className="text-sm font-medium">No medicine regimens available</div>
            <div className="text-xs">Add regimens in Medicines page first</div>
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-100 shadow-xl ring-1 ring-emerald-200/50 p-6 border border-emerald-100 mt-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zM9 10a1 1 0 00-1 1v3a1 1 0 102 0v-3a1 1 0 00-1-1zm1-4a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd"/></svg>
            <div className="text-emerald-800 font-bold text-lg">Vaccine Suggestions</div>
          </div>
        </div>
        
        {/* Vaccine chips */}
        {vaccineRegimens.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-3">
            {vaccineRegimens
              .filter(g => !hiddenVaccineRegimens.includes(normalizeKey(g?.condition)))
              .map(g => (
              <button key={g._id || g.id} onClick={()=>handleConditionClick(g, true)} className={`group h-10 px-4 rounded-xl text-white border-2 cursor-pointer text-sm font-semibold transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 flex items-center gap-2 ${hasRegimenAlready(g, true)?'bg-gradient-to-r from-emerald-600 to-teal-600 border-emerald-300 hover:from-emerald-700 hover:to-teal-700':'bg-gradient-to-r from-emerald-500 to-teal-500 border-emerald-300 hover:from-emerald-600 hover:to-teal-600 hover:border-emerald-400'}`}>
                {hasRegimenAlready(g, true) ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 10a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1z" clipRule="evenodd"/></svg>
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 01-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/></svg>
                )}
                {g.condition || 'Vaccine'}
              </button>
            ))}
          </div>
        )}
        {vaccineRegimens.length === 0 && (
          <div className="text-center py-8 text-emerald-400">
            <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zM9 10a1 1 0 00-1 1v3a1 1 0 102 0v-3a1 1 0 00-1-1zm1-4a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd"/></svg>
            <div className="text-sm font-medium">No vaccine regimens available</div>
            <div className="text-xs">Add regimens in Vaccines page first</div>
          </div>
        )}
      </div>

      <div className="prescription-form-section rounded-2xl bg-gradient-to-br from-emerald-50 to-green-100 shadow-xl ring-1 ring-emerald-200/50 p-6 border border-emerald-100">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>
          <div className="text-emerald-800 font-bold text-lg">Prescription Items</div>
        </div>
        <div className="space-y-4">
          {items.map(x=> {
            const computed = x.useDehydration ? (Number.isFinite(Number(fluidMl))? Number(fluidMl) : null) : calcDose(x, patient?.weightKg)
            return (
              <div key={x.id} className="group relative rounded-2xl border-2 border-slate-200 hover:border-emerald-400 bg-white shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden">
                {/* Header with medicine name and route */}
                <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z"/></svg>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-emerald-50 mb-1">{x.isVaccine ? 'Vaccine Name' : 'Medicine Name'}</label>
                      <input list={x.isVaccine ? "vacnames" : "mednames"} className="w-full h-10 px-3 rounded-lg bg-white/95 backdrop-blur-sm border-0 text-slate-800 font-semibold text-base placeholder-slate-400 focus:ring-2 focus:ring-white/50 transition-all" placeholder={x.isVaccine ? "Enter vaccine name" : "Enter medicine name"} value={x.name} onChange={e=>{ updateItem(x.id,'name',e.target.value); (x.isVaccine ? tryAttachVaccine : tryAttachMedicine)(x.id, e.target.value) }} />
                    </div>
                  </div>
                  <div className="ml-4">
                    <label className="block text-xs font-medium text-emerald-50 mb-1">Type/Route</label>
                    <input className="w-32 h-10 px-3 rounded-lg bg-white/95 backdrop-blur-sm border-0 text-slate-800 font-medium placeholder-slate-400 focus:ring-2 focus:ring-white/50 transition-all" placeholder="Injection" value={x.route||''} onChange={e=>updateItem(x.id,'route',e.target.value)} />
                  </div>
                  <button onClick={()=>removeItem(x.id)} className="ml-3 w-8 h-8 rounded-lg bg-red-500/20 hover:bg-red-500 text-white/80 hover:text-white transition-all flex items-center justify-center group/del">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
                  </button>
                </div>

                {/* Body with organized sections */}
                <div className="p-6 space-y-5">
                  {x.isVaccine ? (
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-200">
                      <div className="mb-4">
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Condition</label>
                        <input className="w-full h-10 px-3 rounded-lg border-2 border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 bg-white text-slate-700 text-sm placeholder-slate-400 transition-all" value={x.condition||''} onChange={e=>updateItem(x.id,'condition',e.target.value)} />
                      </div>
                      
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-bold text-emerald-700 uppercase tracking-wider">Vaccination Shots</label>
                          <button type="button" onClick={() => addShotToItem(x.id)} className="text-xs bg-emerald-100 text-emerald-600 px-3 py-1.5 rounded-lg border border-emerald-200 hover:bg-emerald-200 font-bold transition-all">+ Add Shot</button>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-3">
                          {(x.shots || []).map((shot, sIdx) => (
                            <div key={sIdx} className="bg-white rounded-xl p-4 border border-emerald-100 relative group/shot">
                              {x.shots.length > 1 && (
                                <button type="button" onClick={() => removeShotFromItem(x.id, sIdx)} className="absolute -top-2 -right-2 w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center opacity-0 group-hover/shot:opacity-100 transition-all border border-red-200 hover:bg-red-600 hover:text-white">×</button>
                              )}
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                <div>
                                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Date Given</label>
                                  <input type="date" value={shot.dateGiven} onChange={e=>updateItemShot(x.id, sIdx, 'dateGiven', e.target.value)} className="h-10 px-3 rounded-lg border-2 border-slate-200 focus:border-emerald-400 w-full text-sm bg-white" />
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Shot Stage</label>
                                  <select value={shot.shotStage} onChange={e=>updateItemShot(x.id, sIdx, 'shotStage', e.target.value)} className="h-10 px-3 rounded-lg border-2 border-slate-200 focus:border-emerald-400 w-full bg-white text-sm">
                                    <option value="">Select Stage</option>
                                    <option>1st</option>
                                    <option>2nd</option>
                                    <option>3rd</option>
                                    <option>4th</option>
                                    <option>Annual booster</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Next Due (auto)</label>
                                  <input value={shot.nextDue} readOnly placeholder="Next Due (auto)" className="h-10 px-3 rounded-lg border-2 border-slate-200 bg-slate-50 w-full text-sm" />
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Vet Name</label>
                                  <input value={shot.vet} onChange={e=>updateItemShot(x.id, sIdx, 'vet', e.target.value)} placeholder="Vet's Name" className="h-10 px-4 rounded-lg border-2 border-slate-200 focus:border-emerald-400 w-full text-sm bg-white" />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : x.doseType === 'Weight Based' ? (
                    <>
                      {/* Dosage Calculation Section - Weight Based */}
                      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-200">
                        <div className="flex items-center gap-2 mb-3">
                          <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/></svg>
                          <label className="text-xs font-bold text-blue-700 uppercase tracking-wide">Dosage Calculation (Weight Based)</label>
                          <div className="ml-auto">
                            <button type="button" onClick={()=>toggleDehydration(x.id)} className={`h-8 px-3 rounded-md text-xs font-semibold transition-all ${x.useDehydration? 'bg-emerald-600 text-white hover:bg-emerald-700':'bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-50'}`}>
                              {x.useDehydration? 'Dehydration: ON' : 'Apply Dehydration'}
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Dose Rate</label>
                            <input className="w-full h-10 px-3 rounded-lg border-2 border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-white text-slate-700 text-sm placeholder-slate-400 transition-all" placeholder="25 mg/kg" value={x.doseRate||''} onChange={e=>onFieldChangeRecalc(x.id,{doseRate:e.target.value})} />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Composition per ml</label>
                            <input className="w-full h-10 px-3 rounded-lg border-2 border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-white text-slate-700 text-sm placeholder-slate-400 transition-all" placeholder="100mg/ml" value={x.perMl||''} onChange={e=>onFieldChangeRecalc(x.id,{perMl:e.target.value})} />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Unit</label>
                            <input className="w-full h-10 px-3 rounded-lg border-2 border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-white text-slate-700 text-sm placeholder-slate-400 transition-all" placeholder="ml" value={x.unit||''} onChange={e=>updateItem(x.id,'unit',e.target.value)} />
                          </div>
                          <div>
                            <label className="flex items-center gap-1 text-xs font-semibold text-emerald-700 mb-1.5">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                              Calculated Dose
                            </label>
                            <div className={`w-full h-10 px-3 rounded-lg border-2 flex items-center font-bold text-sm transition-all ${computed!=null? 'border-emerald-400 bg-emerald-50 text-emerald-700':'border-slate-300 bg-slate-100 text-slate-500'}`}>
                              {computed!=null? `${computed.toFixed(2)} ${x.unit||'ml'}` : '—'}
                            </div>
                          </div>
                        </div>
                        {/* Formula display */}
                        <div className="mt-3 pt-3 border-t border-blue-200">
                          <div className="text-xs text-slate-600">
                            {x.useDehydration ? (
                              <>
                                <span className="font-semibold text-blue-700">Formula (Dehydration Fluid):</span> Fluid = (Dehydration% × Body Weight × 10)
                                {computed!=null && (
                                  <div className="mt-1 text-emerald-700 font-semibold">
                                    = {(Number.isFinite(getDehydrationPct())? getDehydrationPct() : 0)}% × {(num(patient?.weightKg)||0)} kg × 10 = <span className="text-base">{computed.toFixed(2)} {x.unit||'ml'}</span>
                                  </div>
                                )}
                              </>
                            ) : (
                              <>
                                <span className="font-semibold text-blue-700">Formula:</span> Dose = (Dose Rate × Body Weight) ÷ Composition per ml
                                {computed!=null && (
                                  <div className="mt-1 text-emerald-700 font-semibold">
                                    = {(num(x.doseRate)||0)} × {(num(patient?.weightKg)||0)} kg ÷ {(num(x.perMl)||0)} = <span className="text-base">{computed.toFixed(2)} {x.unit||'ml'}</span>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Fixed Dose Section */}
                      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-200">
                        <div className="flex items-center gap-2 mb-3">
                          <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd"/></svg>
                          <label className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Fixed Dose (Vaccine/Standard)</label>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Dose Amount</label>
                            <input className="w-full h-10 px-3 rounded-lg border-2 border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 bg-white text-slate-700 text-sm placeholder-slate-400 transition-all" placeholder="e.g., 1" value={x.dose||''} onChange={e=>updateItem(x.id,'dose',e.target.value)} />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Unit (ml, vial, tablet, etc.)</label>
                            <input className="w-full h-10 px-3 rounded-lg border-2 border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 bg-white text-slate-700 text-sm placeholder-slate-400 transition-all" placeholder="ml / vial / tablet" value={x.unit||''} onChange={e=>updateItem(x.id,'unit',e.target.value)} />
                          </div>
                        </div>
                        <div className="mt-3 text-xs text-emerald-700">
                          <span className="font-semibold">Note:</span> Fixed dose medicines (like vaccines) use a standard amount regardless of animal weight.
                        </div>
                      </div>
                    </>
                  )}

                  {!x.isVaccine && (
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200">
                      <div className="flex items-center gap-2 mb-3">
                        <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"/></svg>
                        <label className="text-xs font-bold text-amber-700 uppercase tracking-wide">Dose Type</label>
                      </div>
                      <div className="flex gap-4">
                        <label className={`flex-1 cursor-pointer rounded-lg border-2 p-3 transition-all ${x.doseType === 'Weight Based' ? 'border-amber-500 bg-amber-100' : 'border-slate-200 hover:border-amber-300'}`}>
                          <input type="radio" name={`doseType-${x.id}`} value="Weight Based" checked={x.doseType === 'Weight Based'} onChange={()=>updateItem(x.id,'doseType','Weight Based')} className="sr-only" />
                          <div className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${x.doseType === 'Weight Based' ? 'border-amber-600' : 'border-slate-400'}`}>
                              {x.doseType === 'Weight Based' && <div className="w-3 h-3 rounded-full bg-amber-600" />}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-800">Weight Based</div>
                              <div className="text-xs text-slate-500">Dose depends on animal weight (mg/kg)</div>
                            </div>
                          </div>
                        </label>
                        <label className={`flex-1 cursor-pointer rounded-lg border-2 p-3 transition-all ${x.doseType === 'Fixed Dose' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-300'}`}>
                          <input type="radio" name={`doseType-${x.id}`} value="Fixed Dose" checked={x.doseType === 'Fixed Dose'} onChange={()=>updateItem(x.id,'doseType','Fixed Dose')} className="sr-only" />
                          <div className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${x.doseType === 'Fixed Dose' ? 'border-emerald-600' : 'border-slate-400'}`}>
                              {x.doseType === 'Fixed Dose' && <div className="w-3 h-3 rounded-full bg-emerald-600" />}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-800">Fixed Dose</div>
                              <div className="text-xs text-slate-500">Vaccine/standard dose (fixed amount)</div>
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Instructions Section */}
                  <div>
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">
                      <svg className="w-4 h-4 text-purple-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/></svg>
                      Instructions
                    </label>
                    <textarea className="w-full h-20 px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 bg-white text-slate-700 placeholder-slate-400 resize-none transition-all" placeholder="e.g., Administer 1 ml twice daily for 5 days" value={x.instructions||''} onChange={e=>updateItem(x.id,'instructions',e.target.value)} />
                  </div>
                </div>
              </div>
            )
          })}
          <datalist id="mednames">
            {medicines.map(m=> (
              <option key={m.id} value={m.name} />
            ))}
          </datalist>
          <datalist id="vacnames">
            {vaccines.map(v=> (
              <option key={v.id} value={v.name} />
            ))}
          </datalist>
            </div>
          {items.length===0 && (
            <div className="rounded-2xl border-2 border-dashed border-emerald-300 text-emerald-400 p-12 text-center">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>
              <div className="text-lg font-semibold mb-1">No prescription items yet</div>
              <div className="text-sm">Click a condition above to add medicines</div>
            </div>
          )}
        
        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={save} disabled={!canSave} className={`px-8 h-12 rounded-xl font-semibold cursor-pointer transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2 ${canSave?'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white':'bg-slate-300 text-slate-500 cursor-not-allowed'}`}>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
            {editingId ? 'Update Prescription' : 'Save Prescription'}
          </button>
          <button onClick={saveAndPrint} disabled={!canSave} className={`px-8 h-12 rounded-xl font-semibold cursor-pointer transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2 ${canSave?'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white':'bg-slate-300 text-slate-500 cursor-not-allowed'}`}>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a1 1 0 001 1h8a1 1 0 001-1v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a1 1 0 00-1-1H6a1 1 0 00-1 1zm2 0h6v3H7V4zm-1 9h8v3H6v-3zm8-4a1 1 0 110 2 1 1 0 010-2z" clipRule="evenodd"/></svg>
            Save &amp; Print
          </button>
          <button onClick={referToPharmacy} disabled={!canSave} className={`px-8 h-12 rounded-xl font-semibold cursor-pointer transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2 ${canSave?'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white':'bg-slate-300 text-slate-500 cursor-not-allowed'}`}>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M8 5a1 1 0 100 2h5.586l-1.293 1.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L13.586 5H8zM12 15a1 1 0 100-2H6.414l1.293-1.293a1 1 0 10-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L6.414 15H12z"/></svg>
            Refer to Pharmacy
          </button>
          <button onClick={resetAll} className="px-6 h-12 rounded-xl font-semibold cursor-pointer transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2 bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700 text-white">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd"/></svg>
            Reset Form
          </button>
        </div>
      </div>

      {dupMedModal.open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setDupMedModal({ open:false, regimen:null })}></div>
          <div className="relative w-[95%] max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.72-1.36 3.485 0l6.518 11.59c.75 1.334-.214 3.01-1.742 3.01H3.48c-1.528 0-2.492-1.676-1.742-3.01L8.257 3.1zM11 14a1 1 0 10-2 0 1 1 0 002 0zm-1-2a1 1 0 01-1-1V8a1 1 0 112 0v3a1 1 0 01-1 1z" clipRule="evenodd"/></svg>
              </div>
              <div>
                <div className="font-semibold text-slate-800">Already added</div>
                <div className="text-xs text-slate-500">This regimen is already in the prescription.</div>
              </div>
            </div>
            <div className="px-6 py-4 text-sm text-slate-700">
              You already added <b>{dupMedModal?.regimen?.condition || 'this regimen'}</b>.
              No duplicate medicines will be added.
            </div>
            <div className="px-6 py-4 bg-slate-50 flex justify-end gap-2">
              <button onClick={()=>setDupMedModal({ open:false, regimen:null })} className="h-10 px-4 rounded-lg border-2 border-slate-300 text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={confirmRemoveDuplicateRegimen} className="h-10 px-4 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold">OK</button>
            </div>
          </div>
        </div>
      )}

      {addNoteModal.open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={cancelAddOption}></div>
          <div className="relative w-[95%] max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-slate-800">Add New {({hx:'Hx', oe:'O/E', dx:'Dx', advice:'Advice', tests:'Test'}[addNoteModal.type]||'Note')}</div>
              <button onClick={cancelAddOption} className="text-slate-500 hover:text-slate-700 text-2xl leading-none">×</button>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Label</label>
              <input
                autoFocus
                value={addNoteModal.value}
                onChange={e=>setAddNoteModal(m=>({...m, value: e.target.value}))}
                onKeyDown={e=>{ if(e.key==='Enter') confirmAddOption(); if(e.key==='Escape') cancelAddOption() }}
                placeholder="Enter new note"
                className="w-full h-11 px-3 rounded-lg border-2 border-slate-300 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 bg-white"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={cancelAddOption} className="h-10 px-4 rounded-lg border-2 border-slate-300 text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={confirmAddOption} className="h-10 px-4 rounded-lg bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white font-semibold">Add</button>
            </div>
          </div>
        </div>
      )}

      {deleteNoteModal.open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={cancelDeleteOption}></div>
          <div className="relative w-[95%] max-w-sm rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/></svg>
              <div className="font-semibold text-slate-800">Delete Option</div>
            </div>
            <div className="text-sm text-slate-700">
              Are you sure you want to delete <b>{deleteNoteModal.value}</b> from {({hx:'Hx', oe:'O/E', dx:'Dx', advice:'Advice', tests:'Tests'}[deleteNoteModal.type]||'this list')}?
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={cancelDeleteOption} className="h-9 px-3 rounded-lg border-2 border-slate-300 text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={confirmDeleteOption} className="h-9 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Referral Success Modal */}
      {showReferralSuccess && referralData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full my-8 transform animate-slideUp max-h-[90vh] flex flex-col">
            {/* Header with gradient - Fixed */}
            <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 text-white p-6 rounded-t-3xl relative overflow-hidden flex-shrink-0">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24"></div>
              <div className="relative z-10 text-center">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-3 animate-bounce">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                </div>
                <h2 className="text-2xl font-bold mb-1">Successfully Referred!</h2>
                <p className="text-purple-100">Prescription sent to Pharmacy</p>
              </div>
            </div>

            {/* Content - Scrollable */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Patient Info Card */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4 border-2 border-purple-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-purple-600">Patient Details</div>
                    <div className="text-xl font-bold text-slate-800">{referralData.petName}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Owner</div>
                    <div className="font-semibold text-slate-700 text-sm">{referralData.ownerName}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Contact</div>
                    <div className="font-semibold text-slate-700 text-sm">{referralData.contact || 'N/A'}</div>
                  </div>
                </div>
              </div>

              {/* Medicines Card */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 border-2 border-blue-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                      <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-blue-600">Prescribed Medicines</div>
                    <div className="text-xs text-slate-600">{referralData.medicines?.length || 0} items</div>
                  </div>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {referralData.medicines?.map((med, idx) => (
                    <div key={idx} className="bg-white rounded-lg p-3 border border-blue-100">
                      <div className="font-semibold text-slate-800 text-sm">{med.name}</div>
                      {med.dosage && <div className="text-xs text-slate-600 mt-1">Dosage: {med.dosage}</div>}
                      {med.instructions && <div className="text-xs text-slate-600">Instructions: {med.instructions}</div>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Referral ID */}
              <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl p-3 border-2 border-emerald-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-emerald-600 font-semibold mb-1">Referral ID</div>
                    <div className="font-mono text-sm font-bold text-slate-800">{referralData.id}</div>
                  </div>
                  <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                      <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Info Message */}
              <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-3 flex items-start gap-2">
                <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
                </svg>
                <div className="text-sm text-amber-800">
                  <div className="font-semibold mb-1">Referral sent to Pharmacy</div>
                  <div className="text-amber-700 text-xs">The pharmacy team will process this referral and prepare the medicines for the patient.</div>
                </div>
              </div>
            </div>

            {/* Close Button - Fixed at bottom */}
            <div className="p-6 pt-0 flex-shrink-0">
              <button
                onClick={() => {
                  setShowReferralSuccess(false)
                  setReferralData(null)
                }}
                className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold hover:from-purple-700 hover:to-pink-700 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
