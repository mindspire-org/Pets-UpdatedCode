import React, { useEffect, useMemo, useState } from 'react'
import { useSettings } from '../../context/SettingsContext'
import { petsAPI, medicinesAPI, medicalFormsAPI } from '../../services/api'
import { useAlert } from '../../context/AlertContext'

const TREATMENT_TYPES = ['Infusion', 'Injection', 'Tablet', 'Syrup', 'Other']
const TREATMENT_SLOTS = ['1st', '2nd', '3rd']
const DEFAULT_TRANSFUSION_PURPOSES = ['Severe anemia', 'Blood loss', 'Clotting dis']

export default function DoctorMedicalForms() {
  const { settings, save } = useSettings()
  const { success, error } = useAlert()
  const hospital = useMemo(() => ({
    name: settings.companyName || 'Abbottabad Pet Hospital',
    address: settings.address || '',
    phone: settings.phone || '',
    logo: settings.companyLogo || ''
  }), [settings])

  const [selectedForm, setSelectedForm] = useState(null)
  const [petId, setPetId] = useState('')
  const [regimens, setRegimens] = useState([])
  const [showMedicineButtons, setShowMedicineButtons] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [modalMessage, setModalMessage] = useState('')
  const [showPrintDialog, setShowPrintDialog] = useState(false)
  const [addingCustomPurpose, setAddingCustomPurpose] = useState(false)
  const [newPurposeText, setNewPurposeText] = useState('')

  const [treatmentDates, setTreatmentDates] = useState(() => {
    const today = new Date()
    const base = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(base)
      d.setDate(base.getDate() + i)
      return d.toISOString().slice(0, 10)
    })
  })

  const transfusionPurposeOptions = useMemo(() => {
    const customs = (settings?.customSettings?.bloodTransfusionPurposes) || []
    const merged = [...DEFAULT_TRANSFUSION_PURPOSES, ...customs]
      .map(s => String(s || '').trim())
      .filter(Boolean)
    return Array.from(new Set(merged))
  }, [settings])

  const addCustomPurpose = async () => {
    const v = String(newPurposeText || '').trim()
    if (!v) return
    const existing = Array.isArray(settings?.customSettings?.bloodTransfusionPurposes)
      ? settings.customSettings.bloodTransfusionPurposes
      : []
    const exists = existing.some(x => String(x).toLowerCase() === v.toLowerCase())
    const nextCustoms = exists ? existing : [...existing, v]
    const nextCS = { ...(settings?.customSettings || {}), bloodTransfusionPurposes: nextCustoms }
    try { await save({ customSettings: nextCS }) } catch {}
    setFormData(p => ({ ...p, transfusionPurpose: v }))
    setAddingCustomPurpose(false)
    setNewPurposeText('')
    setModalMessage('✅ Saved')
    setShowModal(true)
  }

  const newPatientId = () => `PET-${Date.now()}`

  const [formData, setFormData] = useState({
    patientId: newPatientId(),
    animalName: '',
    ownerName: '',
    species: '',
    age: '',
    bodyWeight: '',
    tempF: '',
    contact: '',
    contactPerson: '',
    gender: '',
    doa: new Date().toISOString().split('T')[0],
    dehydrationLevel: '',
    hct: '',
    desiredHct: '',
    recipientHct: '',
    donorHct: '',
    donorWeightKg: '',
    factorMode: 'auto',
    customFactor: '',
    // Treatment Chart specific
    drugs: Array.from({ length: 8 }, () => ({ name: '', type: '', concentration: '', route: '', dose: '', frequency: '', dates: {} })),
    temp: {},
    dehydration: {},
    tempNote: '',
    dehydrationNote: '',
    // Blood Transfusion specific
    presentingComplaint: '',
    lastImmunization: '',
    lastAntihelmintics: '',
    bloodType: 'Whole Blood',
    transfusionPurpose: '',
    transfusionMeds: [
      { name: 'Dexamethosone', route: 'Injection', dose: '', timing: 'Intravenous 10 minutes before transfusion' },
      { name: 'Phenramine Maleate', route: 'Injection', dose: '1 ml', timing: 'Intravenous once only' },
      { name: 'Omeprazole', route: 'Injection', dose: '4mg/ml', timing: '' },
      { name: 'Onset', route: 'Injection', dose: '2mg/ml', timing: 'Intravenous once' }
    ],
    labFindings: '',
    medicationsAdministered: [{ name: '', dosage: '', frequency: '', duration: '' }]
  })

  // Helpers
  const num = (v) => {
    if (v === 0) return 0
    const s = String(v || '').toString()
    const m = s.match(/[-+]?[0-9]*\.?[0-9]+/)
    return m ? parseFloat(m[0]) : NaN
  }

  // Transfusion helpers
  const ns = (s) => String(s||'').toLowerCase()
  const isDog = (s) => {
    const v = ns(s)
    return v.includes('dog') || v.includes('canine') || v.includes('canis')
  }
  const isCat = (s) => {
    const v = ns(s)
    return v.includes('cat') || v.includes('feline') || v.includes('felis')
  }
  const transfusionFactor = () => {
    if (formData.factorMode === 'custom') {
      const cf = num(formData.customFactor); return Number.isFinite(cf) && cf>0 ? cf : 0
    }
    if (isDog(formData.species)) return 80
    if (isCat(formData.species)) return 60
    return 0
  }
  const wholeBloodMl = () => {
    const f = transfusionFactor(); const w = num(formData.bodyWeight)
    const des = num(formData.desiredHct); const rec = num(formData.recipientHct||formData.hct); const don = num(formData.donorHct||formData.hct)
    if(!(f>0) || !(w>0) || !isFinite(des) || !isFinite(rec) || !(don>0)) return ''
    return Math.max(0, f*w*((des-rec)/don)).toFixed(0)
  }

  const safePhlebotomyDog = () => {
    const w = num(formData.donorWeightKg)
    if (!Number.isFinite(w) || w <= 0) return ''
    return (w * 20).toFixed(0)
  }

  const safePhlebotomyCat = () => {
    const w = num(formData.donorWeightKg)
    if (!Number.isFinite(w) || w <= 0) return ''
    return (w * 10).toFixed(0)
  }

  const updateMedRow = (i, k, v) => setFormData(p=>{const a=[...(p.medicationsAdministered||[])]; if(!a[i]) return p; a[i]={...a[i],[k]:v}; const d=calcDose(a[i],p.bodyWeight); a[i].dosage=d!=null?`${d.toFixed(2)} ${a[i].unit||'ml'}`:(a[i].dosage||''); return {...p,medicationsAdministered:a}})
  const addEmptyMedRow = () => setFormData(p=>({...p, medicationsAdministered:[...(p.medicationsAdministered||[]),{name:'',doseRate:'',perMl:'',unit:'ml',dosage:'',frequency:'',duration:''}]}))
  const removeMedRow = (i) => setFormData(p=>({...p,medicationsAdministered:(p.medicationsAdministered||[]).filter((_,x)=>x!==i)}))
  useEffect(()=>{setFormData(p=>({...p,medicationsAdministered:(p.medicationsAdministered||[]).map(r=>{const d=calcDose(r,p.bodyWeight);return {...r,dosage:d!=null?`${d.toFixed(2)} ${r.unit||'ml'}`:(r.dosage||'')}})}))},[formData.bodyWeight])

  const calcDose = (x, wKg) => {
    const dr = num(x?.doseRate)
    const per = num(x?.perMl)
    const w = num(wKg)
    if (!isFinite(dr) || !isFinite(per) || !isFinite(w) || per <= 0) return null
    return (dr * w) / per
  }

  const addConditionMedicines = (condition) => {
    if (!formData.bodyWeight) {
      setModalMessage('⚠️ Please enter patient body weight first!')
      setShowModal(true)
      return
    }
    const weight = num(formData.bodyWeight)
    if (!isFinite(weight) || weight <= 0) {
      setModalMessage('⚠️ Please enter a valid body weight!')
      setShowModal(true)
      return
    }
    const currentMeds = formData.medicationsAdministered || [{ name: '', dosage: '', frequency: '', duration: '' }]
    const newMeds = (condition.rows || []).map(r => {
      // Keep raw fields so dose can update dynamically when weight changes
      const dose = (r.doseRate && r.perMl) ? calcDose(r, weight) : null
      return {
        name: r.name || '',
        dosage: dose != null ? `${dose.toFixed(2)} ${r.unit || 'ml'}` : (r.dose || ''),
        doseRate: r.doseRate || '',
        perMl: r.perMl || '',
        unit: r.unit || 'ml',
        frequency: r.instructions || r.route || '',
        duration: ''
      }
    })
    const filteredCurrent = currentMeds.filter(m => m.name || m.dosage || m.frequency || m.duration)
    const merged = [...filteredCurrent, ...newMeds]
    handleInputChange('medicationsAdministered', merged)
    setModalMessage(`✅ Added ${newMeds.length} medicine(s) for ${condition.condition}`)
    setShowModal(true)

    // Also populate Treatment Chart rows with these medicines
    setFormData(prev => {
      const baseRow = { name: '', type: '', concentration: '', route: '', dose: '', frequency: '', dates: {} }
      const prevDrugs = Array.isArray(prev.drugs) ? prev.drugs : []
      const nextDrugs = prevDrugs.map(d => ({ ...baseRow, ...d }))
      while (nextDrugs.length < 8) nextDrugs.push({ ...baseRow })

      const w = num(prev.bodyWeight)

      let idx = 0
      for (const r of (condition.rows || [])) {
        // find next empty slot
        while (idx < nextDrugs.length && String(nextDrugs[idx].name || '').trim()) {
          idx++
        }
        if (idx >= nextDrugs.length) break

        const doseVal = (r.doseRate && r.perMl && isFinite(w) && w > 0)
          ? calcDose(r, w)
          : null

        nextDrugs[idx] = {
          ...nextDrugs[idx],
          type: r.route || nextDrugs[idx].type,
          name: r.name || '',
          concentration: r.perMl || nextDrugs[idx].concentration,
          route: r.route || nextDrugs[idx].route,
          dose: doseVal != null
            ? `${doseVal.toFixed(2)} ${r.unit || 'ml'}`
            : (r.dose || nextDrugs[idx].dose || ''),
          frequency: r.instructions || r.route || nextDrugs[idx].frequency
        }

        idx++
      }

      return { ...prev, drugs: nextDrugs }
    })
  }

  const formatTreatmentDate = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    const day = String(d.getDate()).padStart(2, '0')
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const mon = months[d.getMonth()] || ''
    const yr = String(d.getFullYear()).slice(-2)
    return `${day}-${mon}-${yr}`
  }

  const handleTreatmentDateChange = (index, value) => {
    setTreatmentDates(prev => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  const updateTreatmentDrugRow = (index, field, value) => {
    setFormData(prev => {
      const baseRow = { name: '', type: '', concentration: '', route: '', dose: '', frequency: '', dates: {} }
      const prevDrugs = Array.isArray(prev.drugs) ? prev.drugs : []
      const nextDrugs = prevDrugs.map(d => ({ ...baseRow, ...d }))
      while (nextDrugs.length < 8) nextDrugs.push({ ...baseRow })

      const row = { ...baseRow, ...(nextDrugs[index] || {}) }
      row[field] = value

      if (field === 'name') {
        const nameLower = String(value || '').toLowerCase()
        let found = null
        for (const g of regimens || []) {
          for (const r of g.rows || []) {
            if (String(r.name || '').toLowerCase() === nameLower) {
              found = r
              break
            }
          }
          if (found) break
        }

        if (found) {
          if (found.route) {
            row.type = found.route
            row.route = found.route
          }
          if (found.perMl) row.concentration = found.perMl
          const doseVal = calcDose(found, prev.bodyWeight)
          if (doseVal != null) {
            row.dose = `${doseVal.toFixed(2)} ${found.unit || 'ml'}`
          } else if (found.dose) {
            row.dose = found.dose
          }
          if (found.instructions) row.frequency = found.instructions
        }
      }

      nextDrugs[index] = row
      return { ...prev, drugs: nextDrugs }
    })
  }

  const updateTreatmentDoseCell = (rowIndex, colIndex, slotIndex, value) => {
    const key = `${colIndex}_${slotIndex}`
    setFormData(prev => {
      const baseRow = { name: '', type: '', concentration: '', route: '', dose: '', frequency: '', dates: {} }
      const prevDrugs = Array.isArray(prev.drugs) ? prev.drugs : []
      const nextDrugs = prevDrugs.map(d => ({ ...baseRow, ...d }))
      while (nextDrugs.length < 8) nextDrugs.push({ ...baseRow })

      const row = { ...baseRow, ...(nextDrugs[rowIndex] || {}) }
      const dates = { ...(row.dates || {}) }
      dates[key] = value
      row.dates = dates
      nextDrugs[rowIndex] = row
      return { ...prev, drugs: nextDrugs }
    })
  }

  const updateTempCell = (colIndex, slotIndex, value) => {
    const key = `${colIndex}_${slotIndex}`
    setFormData(prev => ({
      ...prev,
      temp: { ...(prev.temp || {}), [key]: value }
    }))
  }

  const updateDehydrationCell = (colIndex, slotIndex, value) => {
    const key = `${colIndex}_${slotIndex}`
    setFormData(prev => ({
      ...prev,
      dehydration: { ...(prev.dehydration || {}), [key]: value }
    }))
  }

  useEffect(() => { loadMedicines() }, [])
  const loadMedicines = async () => {
    try {
      const response = await medicinesAPI.getAll()
      setRegimens(response?.data || [])
    } catch (err) {
      console.error('Error loading medicines:', err)
      try {
        const raw = JSON.parse(localStorage.getItem('doctor_medicines') || '[]')
        setRegimens(Array.isArray(raw) ? raw : [])
      } catch {}
    }
  }

  // Load saved form if passed from another page
  useEffect(() => {
    try {
      const savedForm = localStorage.getItem('loadMedicalForm')
      if (savedForm) {
        const formToLoad = JSON.parse(savedForm)
        localStorage.removeItem('loadMedicalForm') // Clear after loading
        
        console.log('Loading saved form:', formToLoad)
        
        // Set form type first
        if (formToLoad.formType === 'Treatment Chart') {
          setSelectedForm('treatment')
        } else if (formToLoad.formType === 'Blood Transfusion') {
          setSelectedForm('blood')
        }
        
        // Use setTimeout to ensure state updates properly
        setTimeout(() => {
          // Load treatment dates if available
          if (formToLoad.treatmentDates && Array.isArray(formToLoad.treatmentDates)) {
            setTreatmentDates(formToLoad.treatmentDates)
          }
          
          // Load form data - merge with existing structure to ensure all fields exist
          setFormData(prev => {
            const merged = {
              ...prev,
              ...formToLoad,
              // Ensure arrays are properly initialized
              drugs: Array.isArray(formToLoad.drugs) && formToLoad.drugs.length > 0 
                ? formToLoad.drugs.map(d => ({
                    name: d.name || '',
                    type: d.type || '',
                    concentration: d.concentration || '',
                    route: d.route || '',
                    dose: d.dose || '',
                    frequency: d.frequency || '',
                    dates: d.dates || {}
                  }))
                : prev.drugs,
              transfusionMeds: Array.isArray(formToLoad.transfusionMeds) && formToLoad.transfusionMeds.length > 0
                ? formToLoad.transfusionMeds
                : prev.transfusionMeds,
              medicationsAdministered: Array.isArray(formToLoad.medicationsAdministered) && formToLoad.medicationsAdministered.length > 0
                ? formToLoad.medicationsAdministered
                : prev.medicationsAdministered,
              temp: formToLoad.temp || prev.temp || {},
              dehydration: formToLoad.dehydration || prev.dehydration || {},
            }
            console.log('Form data merged:', merged)
            return merged
          })
        }, 100)
        
        console.log('Form loaded successfully')
      }
    } catch (err) {
      console.error('Error loading saved form:', err)
    }
  }, [])

  const treatmentMedicineOptions = useMemo(() => {
    const names = []
    ;(regimens || []).forEach(g => {
      ;(g.rows || []).forEach(r => {
        const n = String(r.name || '').trim()
        if (n) names.push(n)
      })
    })
    return Array.from(new Set(names))
  }, [regimens])

  useEffect(() => {
    if (petId.trim()) loadPetData(petId.trim())
  }, [petId])

  const loadPetData = async (id) => {
    try {
      const response = await petsAPI.getAll()
      const pets = response?.data || []
      const foundPet = pets.find(p => p.id === id || p._id === id)
      if (foundPet) {
        const petDetails = foundPet.details?.pet || {}
        const ownerDetails = foundPet.details?.owner || {}
        const clientId = `CLIENT-${Date.now()}`
        setFormData(prev => ({
          ...prev,
          patientId: foundPet.id,
          animalName: petDetails.petName || foundPet.petName || '',
          ownerName: ownerDetails.fullName || foundPet.ownerName || '',
          species: petDetails.species || foundPet.type || '',
          age: petDetails.dobOrAge || foundPet.age || '',
          bodyWeight: foundPet.weight || '',
          contact: ownerDetails.contact || foundPet.contact || '',
          gender: petDetails.gender || foundPet.gender || '',
          sex: petDetails.gender || foundPet.gender || '',
          neuteredSpayed: petDetails.neuteredSpayed || '',
          colorMarking: petDetails.colorMarkings || '',
          microchipNumber: petDetails.microchipTag || '',
          clientId,
          cnicOwner: ownerDetails.nic || '',
          contactOwnerGuardian: ownerDetails.contact || foundPet.contact || '',
          alternateContact: ownerDetails.emergencyContactNumber || '',
          homeAddress: ownerDetails.address || '',
          contactPerson: ownerDetails.emergencyContactPerson || ''
        }))
      }
    } catch (err) { console.error('Error loading pet data:', err) }
  }

  useEffect(() => {
    if (!petId.trim()) {
      setFormData({
        patientId: newPatientId(),
        animalName: '',
        ownerName: '',
        species: '',
        age: '',
        bodyWeight: '',
        tempF: '',
        contact: '',
        contactPerson: '',
        gender: '',
        doa: new Date().toISOString().split('T')[0],
        dehydrationLevel: '',
        hct: '',
        desiredHct: '',
        recipientHct: '',
        donorHct: '',
        donorWeightKg: '',
        factorMode: 'auto',
        customFactor: '',
        drugs: Array.from({ length: 8 }, () => ({ name: '', type: '', concentration: '', route: '', dose: '', frequency: '', dates: {} })),
        temp: {},
        dehydration: {},
        tempNote: '',
        dehydrationNote: '',
        presentingComplaint: '',
        lastImmunization: '',
        lastAntihelmintics: '',
        bloodType: 'Whole Blood',
        transfusionPurpose: '',
        transfusionMeds: [
          { name: 'Dexamethosone', route: 'Injection', dose: '', timing: 'Intravenous 10 minutes before transfusion' },
          { name: 'Phenramine Maleate', route: 'Injection', dose: '1 ml', timing: 'Intravenous once only' },
          { name: 'Omeprazole', route: 'Injection', dose: '4mg/ml', timing: '' },
          { name: 'Onset', route: 'Injection', dose: '2mg/ml', timing: 'Intravenous once' }
        ],
        labFindings: '',
        medicationsAdministered: [{ name: '', dosage: '', frequency: '', duration: '' }]
      })
    }
  }, [petId])

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if ((field === 'animalName' || field === 'ownerName') && !formData.patientId && formData.animalName && formData.ownerName) {
      checkExistingPet()
    }
  }

  const checkExistingPet = async () => {
    try {
      const response = await petsAPI.getAll()
      const pets = response?.data || []
      const existingPet = pets.find(p =>
        p.petName?.toLowerCase() === formData.animalName?.toLowerCase() &&
        p.ownerName?.toLowerCase() === formData.ownerName?.toLowerCase()
      )
      if (!existingPet) {
        const newId = `PET-${Date.now()}`
        setFormData(prev => ({ ...prev, patientId: newId }))
        setPetId(newId)
      }
    } catch (err) { console.error('Error checking existing pet:', err) }
  }

  const handlePrint = () => {
    const styleEl = document.createElement('style')
    styleEl.setAttribute('data-print-a4', 'true')
    styleEl.innerHTML = `.print-only{display:none !important;}
@page { size: A4; margin: 6mm; }
@media print {
  html, body { background: #fff !important; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  /* Only print the selected form area */
  body * { visibility: hidden !important; }
  .doctor-medical-forms-print-area, .doctor-medical-forms-print-area * { visibility: visible !important; }
  .doctor-medical-forms-print-area { position: absolute; inset: 0 auto auto 0; width: 100%; }
  .doctor-medical-forms-print-area * { color: #000 !important; background: transparent !important; box-shadow: none !important; text-shadow: none !important; border-radius: 0 !important; }
  /* Make inputs look like text */
  input, textarea, select { border: 0 !important; padding: 0 !important; outline: 0 !important; box-shadow: none !important; background: transparent !important; color: #000 !important; width: 100% !important; white-space: normal !important; word-break: break-word !important; overflow-wrap: anywhere !important; }
  button, .print-hidden, .screen-only { display: none !important; }
  .doctor-medical-forms-print-area .print-only { display: block !important; }
  /* Tighter layout to fit one page */
  .doctor-medical-forms-print-area { padding: 5mm !important; font-size: 10.5px !important; }
  .doctor-medical-forms-print-area h1 { font-size: 15px !important; margin: 0 0 2px 0 !important; text-transform: uppercase; }
  .doctor-medical-forms-print-area h3 { font-size: 10.5px !important; margin: 3px 0 !important; }
  .doctor-medical-forms-print-area table { border-collapse: collapse !important; }
  .doctor-medical-forms-print-area table td,
  .doctor-medical-forms-print-area table th { padding: 1px 3px !important; font-size: 9px !important; }
  .doctor-medical-forms-print-area table, .doctor-medical-forms-print-area td, .doctor-medical-forms-print-area th { border-color: #000 !important; }
  .doctor-medical-forms-print-area .border-2 { border-width: 1px !important; }
  .doctor-medical-forms-print-area .p-8 { padding: 12px !important; }
  .doctor-medical-forms-print-area .mb-6 { margin-bottom: 8px !important; }
  .doctor-medical-forms-print-area .mb-3 { margin-bottom: 4px !important; }
  .doctor-medical-forms-print-area .cb { display:inline-block; width:10px; height:10px; border:1px solid #000; margin-right:6px; vertical-align:-1px; }
  .doctor-medical-forms-print-area td.w-28, .doctor-medical-forms-print-area th.w-28 { width: 60px !important; }
  .doctor-medical-forms-print-area td.w-32, .doctor-medical-forms-print-area th.w-32 { width: 80px !important; }
  .doctor-medical-forms-print-area .bt-block .col-1 { width: 100px !important; }
  .doctor-medical-forms-print-area .bt-block .col-2 { width: 140px !important; }
  .doctor-medical-forms-print-area .bt-block .col-3 { width: auto !important; }
  .doctor-medical-forms-print-area .space-y-4 > :not([hidden]) ~ :not([hidden]) { margin-top: 6px !important; }
  /* Avoid section breaks */
  .doctor-medical-forms-print-area .avoid-break { page-break-inside: avoid !important; break-inside: avoid !important; }
}
`
    try { document.head.appendChild(styleEl) } catch {}
    window.print()
    setTimeout(() => {
      try { if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl) } catch {}
      setPetId('')
    }, 500)
  }

  const handleSave = async () => {
    // Validate required fields
    if (!formData.patientId || !formData.animalName || !formData.ownerName) {
      error('Please fill in Patient ID, Animal Name, and Owner Name')
      return
    }

    if (!selectedForm) {
      error('Please select a form type')
      return
    }

    try {
      const formType = selectedForm === 'treatment' ? 'Treatment Chart' : 'Blood Transfusion'
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}')
      
      // Clean the data - remove any undefined or null values, keep empty strings
      const cleanData = JSON.parse(JSON.stringify({
        ...formData,
        formType,
        treatmentDates: selectedForm === 'treatment' ? treatmentDates : undefined,
        createdBy: currentUser.username || 'unknown',
      }))

      const response = await medicalFormsAPI.create(cleanData)
      
      if (response.success) {
        success(`${formType} saved successfully to patient history`)
      } else {
        error('Failed to save form')
      }
    } catch (err) {
      console.error('Error saving medical form:', err)
      error(err.response?.message || err.message || 'Failed to save form')
    }
  }

  const renderTreatmentChart = () => (
    <div className="bg-white p-8 rounded-xl shadow-lg print:shadow-none">
      <div className="border-b-2 border-blue-600 pb-4 mb-4 print-header">
        <div className="flex items-start justify-between">
          <div className="text-left">
            <h1 className="text-2xl font-bold text-blue-600">Abbottabad Pet Hospital</h1>
            {hospital.address && <p className="text-sm text-slate-600 mt-1">{hospital.address}</p>}
            {hospital.phone && <p className="text-sm text-slate-600">{hospital.phone}</p>}
          </div>
          {hospital.logo && <img src={hospital.logo} alt="Hospital Logo" className="h-16" />}
        </div>
        <h3 className="text-lg font-bold text-red-600 mt-3 text-center">Treatment Chart</h3>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6 text-sm">
        <div className="flex items-center gap-2">
          <label className="font-semibold">Patient ID:</label>
          <input value={formData.patientId} onChange={e => handleInputChange('patientId', e.target.value)} className="flex-1 border-b border-slate-300 px-2 py-1 font-semibold text-red-600" />
        </div>
        <div className="flex items-center gap-2">
          <label className="font-semibold">Owner Name:</label>
          <input value={formData.ownerName} onChange={e => handleInputChange('ownerName', e.target.value)} className="flex-1 border-b border-slate-300 px-2 py-1" />
        </div>
        <div className="flex items-center gap-2">
          <label className="font-semibold">Contact #:</label>
          <input value={formData.contact} onChange={e => handleInputChange('contact', e.target.value)} className="flex-1 border-b border-slate-300 px-2 py-1 font-semibold text-red-600" />
        </div>
        <div className="flex items-center gap-2">
          <label className="font-semibold">Animal Name:</label>
          <input value={formData.animalName} onChange={e => handleInputChange('animalName', e.target.value)} className="flex-1 border-b border-slate-300 px-2 py-1" />
        </div>
        <div className="flex items-center gap-2">
          <label className="font-semibold">Species:</label>
          <input value={formData.species} onChange={e => handleInputChange('species', e.target.value)} className="flex-1 border-b border-slate-300 px-2 py-1" />
        </div>
        <div className="flex items-center gap-2">
          <label className="font-semibold">Contact Person Name:</label>
          <input value={formData.contactPerson} onChange={e => handleInputChange('contactPerson', e.target.value)} className="flex-1 border-b border-slate-300 px-2 py-1 font-semibold text-red-600" />
        </div>
        <div className="flex items-center gap-2">
          <label className="font-semibold">Age:</label>
          <input value={formData.age} onChange={e => handleInputChange('age', e.target.value)} className="flex-1 border-b border-slate-300 px-2 py-1" />
        </div>
        <div className="flex items-center gap-2">
          <label className="font-semibold">Body Weight (kg):</label>
          <input value={formData.bodyWeight} onChange={e => handleInputChange('bodyWeight', e.target.value)} className="flex-1 border-b border-slate-300 px-2 py-1 font-semibold text-red-600" />
        </div>
        <div className="flex items-center gap-2">
          <label className="font-semibold">DOA:</label>
          <input value={formData.doa} onChange={e => handleInputChange('doa', e.target.value)} className="flex-1 border-b border-slate-300 px-2 py-1 font-semibold text-red-600" />
        </div>
        <div className="flex items-center gap-2">
          <label className="font-semibold">Temp °F (at Admis):</label>
          <input value={formData.tempF} onChange={e => handleInputChange('tempF', e.target.value)} className="flex-1 border-b border-slate-300 px-2 py-1" />
        </div>
        <div className="flex items-center gap-2">
          <label className="font-semibold">Dehydration:</label>
          <select
            value={formData.dehydrationLevel || ''}
            onChange={e => handleInputChange('dehydrationLevel', e.target.value)}
            className="flex-1 h-9 px-2 rounded-lg border border-slate-300 bg-white text-xs"
          >
            <option value="">Select level</option>
            <option value="Normal (0%)">Normal</option>
            <option value="Mild (5%)">Mild (5% approx.)</option>
            <option value="Moderate (7%)">Moderate (7% approx.)</option>
            <option value=">7% (Severe)">Severe (&gt;7%)</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="font-semibold">Gender:</label>
          <input value={formData.gender} onChange={e => handleInputChange('gender', e.target.value)} className="flex-1 border-b border-slate-300 px-2 py-1" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-2 border-slate-800 text-[11px]">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-800 p-1 align-middle" rowSpan={2}>S.No</th>
              <th className="border border-slate-800 p-1 align-middle" rowSpan={2}>Type</th>
              <th className="border border-slate-800 p-1 align-middle" rowSpan={2}>Drugs to be administered</th>
              <th className="border border-slate-800 p-1 align-middle" rowSpan={2}>Concentration</th>
              <th className="border border-slate-800 p-1 align-middle" rowSpan={2}>Route</th>
              <th className="border border-slate-800 p-1 align-middle" rowSpan={2}>Dose</th>
              <th className="border border-slate-800 p-1 align-middle" rowSpan={2}>Frequency</th>
              {treatmentDates.map((d, colIdx) => (
                <th key={colIdx} className="border border-slate-800 p-0" colSpan={TREATMENT_SLOTS.length}>
                  <div className="flex flex-col">
                    <span className="hidden print:inline-block px-1 py-0.5">{d}</span>
                    <input
                      type="text"
                      value={d}
                      onChange={e => handleTreatmentDateChange(colIdx, e.target.value)}
                      className="px-1 py-0.5 text-[10px] border-0 w-full print:hidden"
                    />
                  </div>
                </th>
              ))}
            </tr>
            <tr className="bg-slate-100">
              {treatmentDates.map((_, colIdx) => (
                TREATMENT_SLOTS.map((slot, slotIdx) => (
                  <th key={`${colIdx}-${slotIdx}`} className="border border-slate-800 p-0.5 text-center">{slot}</th>
                ))
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Temp row */}
            <tr>
              <td className="border border-slate-800 p-1 text-center align-middle"></td>
              <td className="border border-slate-800 p-1 align-middle" colSpan={6}>
                <input
                  value={formData.tempNote || ''}
                  onChange={e => handleInputChange('tempNote', e.target.value)}
                  placeholder="Temp:"
                  className="w-full border-0 px-1 text-[11px] font-semibold"
                />
              </td>
              {treatmentDates.map((_, colIdx) => (
                TREATMENT_SLOTS.map((_, slotIdx) => {
                  const key = `${colIdx}_${slotIdx}`
                  const val = (formData.temp || {})[key] || ''
                  return (
                    <td key={key} className="border border-slate-800 p-0.5 h-7">
                      <input
                        value={val}
                        onChange={e => updateTempCell(colIdx, slotIdx, e.target.value)}
                        className="w-full border-0 px-1 text-[10px]"
                      />
                    </td>
                  )
                })
              ))}
            </tr>
            {/* Dehydration row */}
            <tr>
              <td className="border border-slate-800 p-1 text-center align-middle"></td>
              <td className="border border-slate-800 p-1 align-middle" colSpan={6}>
                <input
                  value={formData.dehydrationNote || ''}
                  onChange={e => handleInputChange('dehydrationNote', e.target.value)}
                  placeholder="Dehydration:"
                  className="w-full border-0 px-1 text-[11px] font-semibold"
                />
              </td>
              {treatmentDates.map((_, colIdx) => (
                TREATMENT_SLOTS.map((_, slotIdx) => {
                  const key = `${colIdx}_${slotIdx}`
                  const val = (formData.dehydration || {})[key] || ''
                  return (
                    <td key={key} className="border border-slate-800 p-0.5 h-7">
                      <input
                        value={val}
                        onChange={e => updateDehydrationCell(colIdx, slotIdx, e.target.value)}
                        className="w-full border-0 px-1 text-[10px]"
                      />
                    </td>
                  )
                })
              ))}
            </tr>
            {/* Medicine rows */}
            {Array.from({ length: 8 }).map((_, rowIdx) => {
              const row = (formData.drugs || [])[rowIdx] || {}
              return (
                <tr key={rowIdx}>
                  <td className="border border-slate-800 p-1 text-center align-middle">{rowIdx + 1}</td>
                  <td className="border border-slate-800 p-0.5 w-20">
                    <input
                      value={row.type || ''}
                      onChange={e => updateTreatmentDrugRow(rowIdx, 'type', e.target.value)}
                      list="treatment-types"
                      className="w-full border-0 px-1 text-[10px]"
                    />
                  </td>
                  <td className="border border-slate-800 p-0.5">
                    <input
                      value={row.name || ''}
                      onChange={e => updateTreatmentDrugRow(rowIdx, 'name', e.target.value)}
                      list="treatment-meds"
                      className="w-full border-0 px-1 text-[11px]"
                    />
                  </td>
                  <td className="border border-slate-800 p-0.5 w-24">
                    <input
                      value={row.concentration || ''}
                      onChange={e => updateTreatmentDrugRow(rowIdx, 'concentration', e.target.value)}
                      className="w-full border-0 px-1 text-[10px]"
                    />
                  </td>
                  <td className="border border-slate-800 p-0.5 w-20">
                    <input
                      value={row.route || ''}
                      onChange={e => updateTreatmentDrugRow(rowIdx, 'route', e.target.value)}
                      className="w-full border-0 px-1 text-[10px]"
                    />
                  </td>
                  <td className="border border-slate-800 p-0.5 w-20">
                    <input
                      value={row.dose || ''}
                      onChange={e => updateTreatmentDrugRow(rowIdx, 'dose', e.target.value)}
                      className="w-full border-0 px-1 text-[10px]"
                    />
                  </td>
                  <td className="border border-slate-800 p-0.5 w-28">
                    <input
                      value={row.frequency || ''}
                      onChange={e => updateTreatmentDrugRow(rowIdx, 'frequency', e.target.value)}
                      className="w-full border-0 px-1 text-[10px]"
                    />
                  </td>
                  {treatmentDates.map((_, colIdx) => (
                    TREATMENT_SLOTS.map((_, slotIdx) => {
                      const key = `${colIdx}_${slotIdx}`
                      const cellVal = (row.dates || {})[key] || ''
                      return (
                        <td key={`${rowIdx}-${key}`} className="border border-slate-800 p-0.5 h-7">
                          <input
                            value={cellVal}
                            onChange={e => updateTreatmentDoseCell(rowIdx, colIdx, slotIdx, e.target.value)}
                            className="w-full border-0 px-1 text-[10px]"
                          />
                        </td>
                      )
                    })
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
        {/* Suggestions for drug name and type, sourced from Doctor Medicines and defaults */}
        <datalist id="treatment-meds">
          {treatmentMedicineOptions.map(name => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <datalist id="treatment-types">
          {TREATMENT_TYPES.map(t => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </div>

      <div className="mt-6">
        <table className="w-full border-2 border-slate-800">
          <tbody>
            <tr>
              <td className="border border-slate-800 p-2 font-semibold w-40">Counter sign by Sr. Dr</td>
              {[...Array(5)].map((_, i) => <td key={i} className="border border-slate-800 p-2 h-12"></td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderBloodTransfusion = () => (
    <div className="bg-white p-8 rounded-xl shadow-lg print:shadow-none">
      <div className="border-b-2 border-blue-600 pb-4 mb-4 print-header">
        <div className="flex items-center justify-between gap-4">
          {hospital.logo ? (
            <img src={hospital.logo} alt="Hospital Logo" className="h-16" />
          ) : (
            <div style={{ width: '64px', height: '64px' }}></div>
          )}
          <div className="flex-1 text-center">
            <h1 className="text-2xl font-bold text-blue-600">Abbottabad Pet Hospital</h1>
            {hospital.address && <p className="text-sm text-slate-600 mt-1">{hospital.address}</p>}
            {hospital.phone && <p className="text-sm text-slate-600">{hospital.phone}</p>}
          </div>
          <div style={{ width: '64px' }}></div>
        </div>
        <h3 className="text-sm font-bold text-red-600 mt-2 text-center">Note: Not Valid for Court</h3>
      </div>

      {/* Recipient info */}
      <table className="w-full border-2 border-slate-800 text-sm mb-3">
        <thead><tr className="bg-slate-100"><th className="text-left border border-slate-800 px-2 py-1" colSpan="6">Recipient Information</th></tr></thead>
        <tbody>
          <tr>
            <td className="border border-slate-800 px-2 py-1 w-28">Patient ID</td>
            <td className="border border-slate-800 px-2 py-1"><input value={formData.patientId} onChange={e=>handleInputChange('patientId',e.target.value)} className="w-full border-b border-slate-300 font-semibold text-red-600"/></td>
            <td className="border border-slate-800 px-2 py-1 w-28">Owner Name</td>
            <td className="border border-slate-800 px-2 py-1"><input value={formData.ownerName} onChange={e=>handleInputChange('ownerName',e.target.value)} className="w-full border-b border-slate-300"/></td>
            <td className="border border-slate-800 px-2 py-1 w-32">Body Weight (kg)</td>
            <td className="border border-slate-800 px-2 py-1"><input value={formData.bodyWeight} onChange={e=>handleInputChange('bodyWeight',e.target.value)} className="w-full border-b border-slate-300 font-semibold text-red-600"/></td>
          </tr>
          <tr>
            <td className="border border-slate-800 px-2 py-1">Name</td>
            <td className="border border-slate-800 px-2 py-1"><input value={formData.animalName} onChange={e=>handleInputChange('animalName',e.target.value)} className="w-full border-b border-slate-300"/></td>
            <td className="border border-slate-800 px-2 py-1">Species</td>
            <td className="border border-slate-800 px-2 py-1"><input value={formData.species} onChange={e=>handleInputChange('species',e.target.value)} className="w-full border-b border-slate-300"/></td>
            <td className="border border-slate-800 px-2 py-1">Temp °F</td>
            <td className="border border-slate-800 px-2 py-1"><input value={formData.tempF} onChange={e=>handleInputChange('tempF',e.target.value)} className="w-full border-b border-slate-300"/></td>
          </tr>
          <tr>
            <td className="border border-slate-800 px-2 py-1">Gender</td>
            <td className="border border-slate-800 px-2 py-1"><input value={formData.gender} onChange={e=>handleInputChange('gender',e.target.value)} className="w-full border-b border-slate-300"/></td>
            <td className="border border-slate-800 px-2 py-1">Recipient HCT</td>
            <td className="border border-slate-800 px-2 py-1"><input value={formData.recipientHct} onChange={e=>handleInputChange('recipientHct',e.target.value)} className="w-full border-b border-slate-300 font-semibold text-red-600"/></td>
            <td className="border border-slate-800 px-2 py-1">Desired HCT</td>
            <td className="border border-slate-800 px-2 py-1"><input value={formData.desiredHct} onChange={e=>handleInputChange('desiredHct',e.target.value)} className="w-full border-b border-slate-300 font-semibold text-red-600"/></td>
          </tr>
        </tbody>
      </table>

      {/* Donor info */}
      <table className="w-full border-2 border-slate-800 text-sm mb-6">
        <thead>
          <tr className="bg-slate-100">
            <th className="text-left border border-slate-800 px-2 py-1" colSpan="6">Donor Information</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-slate-800 px-2 py-1 w-32">Donor Body Weight (kg)</td>
            <td className="border border-slate-800 px-2 py-1">
              <input
                value={formData.donorWeightKg}
                onChange={e => handleInputChange('donorWeightKg', e.target.value)}
                className="w-full border-b border-slate-300 font-semibold text-red-600"
              />
            </td>
            <td className="border border-slate-800 px-2 py-1 w-28">Donor HCT</td>
            <td className="border border-slate-800 px-2 py-1">
              <input
                value={formData.donorHct}
                onChange={e => handleInputChange('donorHct', e.target.value)}
                className="w-full border-b border-slate-300 font-semibold text-red-600"
              />
            </td>
            <td className="border border-slate-800 px-2 py-1 w-28">Date</td>
            <td className="border border-slate-800 px-2 py-1">
              <input
                value={formData.doa}
                onChange={e => handleInputChange('doa', e.target.value)}
                className="w-full border-b border-slate-300"
              />
            </td>
          </tr>
          {(isDog(formData.species) || isCat(formData.species)) && (
            <tr>
              <td className="border border-slate-800 px-2 py-1" colSpan={6}>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold">
                    {isDog(formData.species)
                      ? 'Safe Phlebotomy Limit (Dog):'
                      : 'Safe Phlebotomy Limit (Cat):'}
                  </span>
                  {isDog(formData.species) && safePhlebotomyDog() && (
                    <span className="font-bold text-red-600">{safePhlebotomyDog()} ml</span>
                  )}
                  {isCat(formData.species) && safePhlebotomyCat() && (
                    <span className="font-bold text-red-600">{safePhlebotomyCat()} ml</span>
                  )}
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Calculation */}
      <div className="mb-6 avoid-break">
        <h3 className="text-center text-red-600 font-bold">BLOOD TRANSFUSION</h3>
        <div className="mt-2 flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-4 print:hidden">
            <label className="flex items-center gap-1"><input type="radio" name="factorMode" checked={formData.factorMode==='auto'} onChange={()=>handleInputChange('factorMode','auto')}/> Auto (Dog 80 / Cat 60)</label>
            <label className="flex items-center gap-1"><input type="radio" name="factorMode" checked={formData.factorMode==='custom'} onChange={()=>handleInputChange('factorMode','custom')}/> Custom</label>
            {formData.factorMode==='custom' && (<input value={formData.customFactor} onChange={e=>handleInputChange('customFactor',e.target.value)} placeholder="Factor" className="w-20 border-b border-slate-300 px-1"/>) }
            <span className="text-slate-600">Current factor: <b>{transfusionFactor() || (isDog(formData.species)?80:(isCat(formData.species)?60:'-'))}</b></span>
          </div>
          <div className="flex items-center gap-2 screen-only print-hidden">
            <span className="font-semibold">Whole Blood (ml):</span>
            <span className="font-bold text-red-600 text-lg">{wholeBloodMl() || '—'}</span>
            <span className="italic">ml Intravenous</span>
          </div>
          <div className="text-xs text-slate-500 screen-only print-hidden">Formula: Factor × Body Weight × ((Desired HCT − Recipient HCT) / Donor HCT)</div>
        </div>
        {/* Print-only BLOOD TRANSFUSION block (Whole Blood row + medicines list) */}
        <div className="print-only mt-2 bt-block">
          {/* Whole Blood summary */}
          <table className="w-full text-xs border-0" style={{marginBottom:'6px'}}>
            <tbody>
              <tr>
                <td className="align-top col-1"><div className="font-bold">Whole Blood</div></td>
                <td className="align-top col-2"><div>Intravenous</div></td>
                <td className="align-top col-3"><div className="text-right">{(wholeBloodMl()||'0')} ml</div></td>
              </tr>
            </tbody>
          </table>
          {/* Medicines: user-added only (prescription-like layout) */}
          <div>
            {(formData.medicationsAdministered||[]).filter(r=> (r.name||'').trim()!=='' ).map((r,i)=>{
              const drVal = r.perMl || ''
              const dose = (function(){
                try {
                  const d = calcDose(r, formData.bodyWeight)
                  if (d!=null && isFinite(d) && d>0) return `${d.toFixed(2)} ${r.unit||'ml'}`
                } catch(_){ }
                return r.dosage||''
              })()
              const instr = [r.frequency||'', r.duration||''].filter(Boolean).join(' ')
              return (
                <div key={`um-${i}`} style={{marginBottom:'4px'}}>
                  <div style={{display:'grid',gridTemplateColumns:'25% 1fr 12%',columnGap:'8px',alignItems:'baseline'}}>
                    <div>{r.route || 'Injection'}</div>
                    <div className="font-bold">{r.name||''}</div>
                    <div className="text-right font-bold">{drVal}</div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'25% 1fr 12%',columnGap:'8px',fontSize:'11px'}}>
                    <div style={{fontStyle:'italic'}}>{dose}</div>
                    <div style={{fontStyle:'italic'}}>{instr}</div>
                    <div></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Medicine calculation (screen only) */}
      <div className="mb-6 avoid-break screen-only print-hidden print:hidden">
        <div className="font-bold text-lg mb-2">Rx</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-2 border-slate-800">
            <thead className="bg-slate-100"><tr>
              <th className="border border-slate-800 p-2 text-left">Medicine</th>
              <th className="border border-slate-800 p-2 text-left">Dose rate</th>
              <th className="border border-slate-800 p-2 text-left">per ml</th>
              <th className="border border-slate-800 p-2 text-left">Unit</th>
              <th className="border border-slate-800 p-2 text-left">Computed dose</th>
              <th className="border border-slate-800 p-2 text-left">Frequency/Route</th>
              <th className="border border-slate-800 p-2 text-left">Duration</th>
              <th className="border border-slate-800 p-2 print:hidden">-</th>
            </tr></thead>
            <tbody>
              {(formData.medicationsAdministered||[]).map((r,i)=>(
                <tr key={i}>
                  <td className="border border-slate-800 p-1"><input value={r.name||''} onChange={e=>updateMedRow(i,'name',e.target.value)} className="w-full border-b border-slate-300"/></td>
                  <td className="border border-slate-800 p-1 w-24"><input value={r.doseRate||''} onChange={e=>updateMedRow(i,'doseRate',e.target.value)} className="w-full border-b border-slate-300"/></td>
                  <td className="border border-slate-800 p-1 w-20"><input value={r.perMl||''} onChange={e=>updateMedRow(i,'perMl',e.target.value)} className="w-full border-b border-slate-300"/></td>
                  <td className="border border-slate-800 p-1 w-16"><input value={r.unit||'ml'} onChange={e=>updateMedRow(i,'unit',e.target.value)} className="w-full border-b border-slate-300"/></td>
                  <td className="border border-slate-800 p-1 font-semibold text-emerald-700">{r.dosage||''}</td>
                  <td className="border border-slate-800 p-1"><input value={r.frequency||''} onChange={e=>updateMedRow(i,'frequency',e.target.value)} className="w-full border-b border-slate-300"/></td>
                  <td className="border border-slate-800 p-1 w-24"><input value={r.duration||''} onChange={e=>updateMedRow(i,'duration',e.target.value)} className="w-full border-b border-slate-300"/></td>
                  <td className="border border-slate-800 p-1 text-center print:hidden"><button onClick={()=>removeMedRow(i)} className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded">×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 print:hidden"><button onClick={addEmptyMedRow} className="h-8 px-3 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold">Add Row</button></div>
      </div>

      {/* Consent sections */}
      <div className="text-sm space-y-4 avoid-break">
        <div>
          <div className="font-bold">BLOOD TRANSFUSION CONSENT</div>
          <div className="mt-2 font-semibold">1. PURPOSE OF TRANSFUSION</div>
          <div className="pl-4">A blood transfusion is recommended to treat:</div>
          <div className="pl-4 mt-2 flex flex-col sm:flex-row sm:items-center gap-2">
            <select
              value={formData.transfusionPurpose || ''}
              onChange={e => {
                const v = e.target.value
                if (v === '__CUSTOM__') { setAddingCustomPurpose(true); return }
                handleInputChange('transfusionPurpose', v)
              }}
              className="h-9 px-2 rounded-lg border border-slate-300 bg-white text-xs min-w-[220px]"
            >
              <option value="">Select purpose</option>
              {transfusionPurposeOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
              <option value="__CUSTOM__">+ Add custom…</option>
            </select>
            {addingCustomPurpose && (
              <div className="flex items-center gap-2 print:hidden">
                <input
                  value={newPurposeText}
                  onChange={e => setNewPurposeText(e.target.value)}
                  placeholder="Enter custom purpose"
                  className="h-9 px-2 rounded-lg border border-slate-300 bg-white text-xs min-w-[240px]"
                />
                <button onClick={addCustomPurpose} className="h-9 px-3 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs">Add & Select</button>
                <button onClick={() => { setAddingCustomPurpose(false); setNewPurposeText('') }} className="h-9 px-3 rounded border border-slate-300 text-slate-600 text-xs">Cancel</button>
              </div>
            )}
          </div>

          <div className="mt-3 font-semibold">2. RISKS EXPLAINED TO OWNERS</div>
          <div className="pl-4">I acknowledge that the veterinarian has explained the potential risks, including but not limited to:</div>
          <div className="pl-4 grid grid-cols-2 gap-6 mt-1">
            <div>
              <div className="font-semibold">Recipient Risks</div>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Transfusion reactions (mild to severe)</li>
                <li>Allergic reactions, fever, hemolysis</li>
                <li>Transmission of undetected infectious disease</li>
                <li>Need for additional transfusions</li>
                <li>Rare risk of death</li>
              </ol>
            </div>
            <div>
              <div className="font-semibold">Donor Risks</div>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Temporary stress</li>
                <li>Mild sedation-related risks (if sedation is used)</li>
                <li>Bruising or discomfort at blood collection site</li>
                <li>Rare risk of complications during collection</li>
              </ol>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="font-semibold mb-1">Owner Consent</div>
            <div className="space-y-2">
              <div className="flex items-end gap-2"><span>Recipient Owner Name:</span><div className="flex-1 border-b border-slate-800 h-6"></div></div>
              <div className="flex items-end gap-2"><span>CNIC / Contact #:</span><div className="flex-1 border-b border-slate-800 h-6"></div></div>
              <div className="flex items-end gap-2"><span>Signature:</span><div className="flex-1 border-b border-slate-800 h-6"></div></div>
              <div className="flex items-end gap-2"><span>Date:</span><div className="flex-1 border-b border-slate-800 h-6"></div></div>
            </div>
          </div>
          <div>
            <div className="font-semibold mb-1">Veterinarian Declaration</div>
            <div className="space-y-2">
              <div className="flex items-end gap-2"><span>Name:</span><div className="flex-1 border-b border-slate-800 h-6"></div></div>
              <div className="flex items-end gap-2"><span>Signature:</span><div className="flex-1 border-b border-slate-800 h-6"></div></div>
              <div className="flex items-end gap-2"><span>Date:</span><div className="flex-1 border-b border-slate-800 h-6"></div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6 print:space-y-0">
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 print:hidden" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 transform transition-all animate-bounce-in" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="mb-4">
                {modalMessage.includes('✅') ? (
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
                    <svg className="w-10 h-10 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                )}
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">
                {modalMessage.includes('✅') ? 'Success!' : 'Attention'}
              </h3>
              <p className="text-slate-600 mb-6 text-lg">{modalMessage.replace('✅', '').replace('⚠️', '')}</p>
              <button onClick={() => setShowModal(false)} className="w-full h-12 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold text-lg cursor-pointer transition-all duration-200 shadow-lg hover:shadow-xl">OK</button>
            </div>
          </div>
        </div>
      )}

      {showPrintDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 print:hidden" onClick={() => setShowPrintDialog(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="border-b border-slate-200 px-5 py-3 flex items-center justify-between">
              <div className="font-semibold">Print</div>
              <button onClick={() => setShowPrintDialog(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="p-5 text-sm">
              <div className="text-center mb-3">
                <div className="font-bold text-lg">{hospital.name}</div>
                {hospital.address && <div className="text-slate-500">{hospital.address}</div>}
                {hospital.phone && <div className="text-slate-500">Phone: {hospital.phone}</div>}
              </div>
              <div className="text-slate-600 text-center">The selected form will be printed on A4. Click Print to continue.</div>
            </div>
            <div className="border-t border-slate-200 px-5 py-4 flex gap-3">
              <button onClick={() => setShowPrintDialog(false)} className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-semibold">OK</button>
              <button onClick={() => { setShowPrintDialog(false); setTimeout(() => handlePrint(), 10) }} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd"/></svg>
                Print
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="text-center print:hidden">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Medical Forms</h1>
        <p className="text-slate-500 mt-1">Select and fill out medical forms for patients</p>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-white to-purple-50 shadow-xl ring-1 ring-purple-200/50 p-6 border border-purple-100 print:hidden">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 flex-1">
            <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/></svg>
            <input value={petId} onChange={e => setPetId(e.target.value)} placeholder="🔍 Enter Pet ID to auto-fill patient information" className="flex-1 h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all duration-200 bg-white shadow-sm font-mono" />
          </div>
        </div>
      </div>

      {!selectedForm && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:hidden">
          <button onClick={() => setSelectedForm('treatment')} className="h-32 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold text-xl cursor-pointer transition-all duration-200 shadow-lg hover:shadow-xl flex flex-col items-center justify-center gap-3">
            <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/></svg>
            Treatment Chart
          </button>
          <button onClick={() => setSelectedForm('blood')} className="h-32 rounded-2xl bg-gradient-to-br from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-bold text-xl cursor-pointer transition-all duration-200 shadow-lg hover:shadow-xl flex flex-col items-center justify-center gap-3">
            <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd"/></svg>
            Blood Transfusion
          </button>
        </div>
      )}

      {selectedForm && (
        <div>
          <div className="flex gap-3 mb-4 print:hidden">
            <button onClick={() => setSelectedForm(null)} className="h-10 px-4 rounded-lg bg-slate-600 hover:bg-slate-700 text-white font-semibold cursor-pointer transition-all duration-200 flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/></svg>
              Back
            </button>
            <button onClick={handleSave} className="h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer transition-all duration-200 flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z"/></svg>
              Save
            </button>
            <button onClick={() => setShowPrintDialog(true)} className="h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer transition-all duration-200 flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd"/></svg>
              Print
            </button>
          </div>
          {selectedForm === 'treatment' && (
            <>
              {regimens.length > 0 && (
                <div className="rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-100 shadow-xl ring-1 ring-purple-200/50 p-6 border border-purple-100 mb-6 print:hidden">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/></svg>
                      <div className="text-purple-800 font-bold text-lg">Quick Add Medicines</div>
                    </div>
                    <button onClick={() => setShowMedicineButtons(!showMedicineButtons)} className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm transition-all duration-200">
                      {showMedicineButtons ? 'Hide' : 'Show'} Medicines
                    </button>
                  </div>
                  {showMedicineButtons && (
                    <div className="flex flex-wrap gap-3">
                      {regimens.map(g => (
                        <button key={g.id} onClick={() => addConditionMedicines(g)} className="group h-10 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 text-white border-2 border-sky-300 hover:border-sky-400 cursor-pointer text-sm font-semibold transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/></svg>
                          {g.condition || 'Condition'}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-purple-700 mt-3">💡 Tip: Enter patient body weight first, then click a condition to auto-calculate and add medicines</p>
                </div>
              )}
              <div className="doctor-medical-forms-print-area">
                {renderTreatmentChart()}
              </div>
            </>
          )}

          {selectedForm === 'blood' && (
            <>
              {regimens.length > 0 && (
                <div className="rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-100 shadow-xl ring-1 ring-purple-200/50 p-6 border border-purple-100 mb-6 print:hidden">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/></svg>
                      <div className="text-purple-800 font-bold text-lg">Quick Add Medicines</div>
                    </div>
                    <button onClick={() => setShowMedicineButtons(!showMedicineButtons)} className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm transition-all duration-200">
                      {showMedicineButtons ? 'Hide' : 'Show'} Medicines
                    </button>
                  </div>
                  {showMedicineButtons && (
                    <div className="flex flex-wrap gap-3">
                      {regimens.map(g => (
                        <button key={g.id} onClick={() => addConditionMedicines(g)} className="group h-10 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 text-white border-2 border-sky-300 hover:border-sky-400 cursor-pointer text-sm font-semibold transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/></svg>
                          {g.condition || 'Condition'}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-purple-700 mt-3">💡 Tip: Enter patient body weight first, then click a condition to auto-calculate and add medicines</p>
                </div>
              )}
              <div className="doctor-medical-forms-print-area">
                {renderBloodTransfusion()}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
