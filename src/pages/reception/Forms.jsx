import React, { useState, useEffect, useMemo } from 'react'
import { useSettings } from '../../context/SettingsContext'
import { petsAPI, medicinesAPI, procedureCatalogAPI } from '../../services/api'

const DEFAULT_ANESTHESIA_PROCEDURES = [
  'Abscess Drainage (Cat)',
  'Abscess Drainage under G.A (Cat)',
  'Abscess Drainage (Dog)',
  'Abscess Drainage under G.A (Dog)',
  'Abdominocentesis (Cat) US Guided',
  'Abdominocentesis (Dog) US Guided',
  'Acquired Clef Palate Reconstruction',
  'Adminintration of IM Injection',
  'Adminintration of IV Injection',
  'Adminintration of Tablet',
  'Adminintration of Infusion',
  'Placement of I/V Cannula',
  'Anal Gland Drainage (Cat)',
  'Anal Gland Drainage (Dog)',
  'Anti-Parasite Spray',
  'Aural Hematoma',
  'Bilaetral Entropion',
  'Blood Transfusion (Cat)',
  'Blood Transfusion (Dog)',
  'Bird Necropsy',
  'Bird Post Martem',
  'Cesarean Section (Dog)',
  'Cesarean Section (Queen)',
  'Cyst Drainage',
  'Dental Imaging (Cat/Small Breed Dog/Puppy)',
  'Dental Imaging (Large Breed Dog)',
  'Dewclaw Amputation (Surgery) Puppy',
  'Dewclaw Amputation (Surgery) Adult',
  'Ear Tapping (Dog)',
  'Endoscopy (Dog)',
  'Endoscopy (Queen)',
  'Entropion Unilateral (Dog)',
  'Enucleation',
  'Euthanaisia Cat',
  'Euthanaisia Dog',
  'Euthanaisia kitten',
  'Euthanaisia Puppy',
  'Examination under G.A',
  'Explorative Laparotomy',
  'Feeding Tube',
  'FHO (Unilateral)',
  'General Examination/ Procedure',
  'Gastric Levage (Cat/Small Breed Dog/Puppy)',
  'Gastropexy',
  'Herniaplasty',
  'Ingluvioplasty (Crop Reconstruction)',
  'Leg Amputation Large Bird',
  'Limb Amputation Cat',
  'Limb Amputation Dog',
  'Lime-Sulfur Dip',
  'Maggot Extraction Stage 1',
  'Maggot Extraction Stage 2',
  'Maggot Extraction Stage 3',
  'Maggot Extraction Stage 4',
  'Microchip Implantation & scanning',
  'Microchip Implantation (including Microchip)',
  'Microchip Scanning',
  'Induction of Parturation',
  'Nasogastric tube',
  'Nebulize',
  'Onychectomy (Cat)',
  'Onychectomy (Dog)',
  'Oral Tumor Extraction (Cat)',
  'Oral Tumor Extraction (Dog)',
  'Orchiectomy (Cat/Small Breed Dog)',
  'Orchiectomy (Large Breed Dog)',
  'Ovariohysterictomy (Large Breed Dog)',
  'Ovariohysterictomy (Queen/Small Breed Dog)',
  'Ovariohysterictomy Pyometra (Large Breed Dog)',
  'Ovariohysterictomy Pyometra (Queen/Small Breed Dog)',
  'Cesarian / C-Section (Cat/Small Breed Dog)',
  'Cesarian / C-Section (Large Breed Dog)',
  'Parenteral Administration of Drugs',
  'Parineal Hernoaplasty',
  'Stitch Removal Cat',
  'Scaling (Cat/Small Breed Dog)',
  'Dental Scaling (Dog)',
  'Scaling (Large Breed Dog)',
  'Surgical Gluing',
  'Reduction of Rectum Prolapse',
  'Tail Docking (Cat)',
  'Tail Docking (Dog)',
  'Tooth Extraction per Tooth (Excluding GA) (Cat/Small Breed Dog)',
  'Tooth Extraction per Tooth (Excluding GA) (Large Breed Dog)',
  'Tooth Extraction Full Mouth (Excluding GA & Canine teeth) (Cat/Small Breed Dog)',
  'Tooth Extraction Full Mouth (Excluding GA & Canine teeth) (Large Breed Dog)',
  'Tumor Extraction (Cat)',
  'Tumor Extraction (Dog)',
  'Tumor Extraction (Mammary Gland) Cat',
  'Tumor Extraction (Mammary Gland) Dog',
  'TVT Surgery',
  'Unilaetral Entropion',
  'Urinary Catheterization (Cat)',
  'Urinary Catheterization (Dog)',
  'Vaginal Prolapse Reduction',
  'Vaginopexy',
  'Wound Cleaning & ASD',
  'Wound Reconstruction Surgery',
  'Minor Wound Reconstruction Cat',
  'Wound Reconstruction bird',
  'Wound Reconstruction Horse'
]

export default function ReceptionForms() {
  const { settings } = useSettings()
  const hospital = useMemo(() => ({
    name: settings.companyName || 'Abbottabad Pet Hospital',
    address: settings.address || '',
    phone: settings.phone || '',
    logo: settings.companyLogo || ''
  }), [settings])
  const [selectedForm, setSelectedForm] = useState(null)
  const [petId, setPetId] = useState('')
  const [regimens, setRegimens] = useState([]) // Medicine conditions
  const [procedureOptions, setProcedureOptions] = useState(DEFAULT_ANESTHESIA_PROCEDURES)
  const [procedureCatalog, setProcedureCatalog] = useState([])
  const [newProcedure, setNewProcedure] = useState('')
  const [showMedicineButtons, setShowMedicineButtons] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [modalMessage, setModalMessage] = useState('')
  const [showPrintDialog, setShowPrintDialog] = useState(false)
  const [formData, setFormData] = useState({
    patientId: '',
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
    hct: '',
    desiredHct: '',
    // Treatment Chart specific
    drugs: Array(8).fill({ name: '', dates: {} }),
    temp: {},
    dehydration: {},
    // Blood Transfusion specific
    presentingComplaint: '',
    lastImmunization: '',
    lastAntihelmintics: '',
    bloodType: 'Whole Blood',
    transfusionMeds: [
      { name: 'Dexamethosone', route: 'Injection', dose: '', timing: 'Intravenous 10 minutes before transfusion' },
      { name: 'Phenramine Maleate', route: 'Injection', dose: '1 ml', timing: 'Intravenous once only' },
      { name: 'Omeprazole', route: 'Injection', dose: '4mg/ml', timing: '' },
      { name: 'Onset', route: 'Injection', dose: '2mg/ml', timing: 'Intravenous once' }
    ],
    labFindings: '',
    // Anesthesia form specific
    anesthesiaProcedure: '',
    clientId: '',
    cnicOwner: '',
    contactOwnerGuardian: '',
    alternateContact: '',
    homeAddress: '',
    sex: '',
    neuteredSpayed: '',
    colorMarking: '',
    microchipNumber: '',
    dateDropOff: '',
    datePickUp: '',
    foodTypeBrand: '',
    amountPerFeeding: '',
    feedingFrequency: '',
    specialDietaryRequirements: '',
    medicationName: '',
    dosageFrequency: '',
    instructionsForAdministration: '',
    reasonForMedication: '',
    veterinarianName: '',
    spendingLimit: '',
    vaccinationsUpToDate: '',
    rabiesVaccination: '',
    dhppVaccination: '',
    bordetellaVaccination: '',
    leptospirosisVaccination: '',
    otherVaccination: '',
    fleaTickPrevention: '',
    recentSurgeries: '',
    surgeriesDescription: '',
    allergies: '',
    allergiesList: '',
    specialCareInstructions: '',
    pickUpPersonName: '',
    pickUpPersonPhone: '',
    ownerSignature: '',
    ownerSignatureDate: '',
    clinicRepSignature: '',
    clinicRepSignatureDate: '',
    bathingGrooming: '',
    extraPlaytime: '',
    otherServices: '',
    // Pet Boarding Discharge specific
    dischargeDate: new Date().toISOString().split('T')[0],
    careProvidedDuringStay: '',
    dailyCareFeeding: '',
    feedingFrequencyDischarge: '',
    medicationNameDischarge: '',
    dosageFrequencyDischarge: '',
    administerAsPerDirection: '',
    veterinaryCareRequired: '',
    veterinaryCareDescription: '',
    testTreatmentProvided: '',
    totalVeterinaryCharges: '',
    specialNotesIncidents: '',
    injuriesIllnesses: '',
    injuriesDescription: '',
    specialCareInstructionsHome: '',
    pickUpDateTime: '',
    pickUpPersonNameDischarge: '',
    pickUpPersonPhoneDischarge: '',
    ownerSignatureDischarge: '',
    ownerSignatureDateDischarge: '',
    // Patient Admission Form specific
    admissionDate: new Date().toISOString().split('T')[0],
    emergencyContactName: '',
    emergencyContactPhone: '',
    relationshipToOwner: '',
    contactNumber: '',
    reasonForAdmission: '',
    symptomsObserved: '',
    durationOfSymptoms: '',
    previousTreatment: '',
    currentMedications: '',
    medicationsList: [{ name: '', dosage: '', frequency: '', duration: '' }],
    knownAllergies: '',
    allergiesListAdmission: '',
    previousIllnesses: '',
    vaccinationsUpToDateAdmission: '',
    rabiesVaccine: '',
    bordetellaVaccine: '',
    leptospirosisVaccine: '',
    otherVaccine: '',
    recentSurgeriesAdmission: '',
    surgeriesDescriptionAdmission: '',
    knownAllergiesAdmission: '',
    allergiesListDetails: '',
    specialDiet: '',
    specialDietDescription: '',
    
    feedingSchedule: '',
    aggressionTowardPeople: false,
    aggressionTowardAnimals: false,
    difficultyHandling: false,
    fearAnxiety: false,
    otherBehavior: '',
    specialHandlingInstructions: '',
    spendingLimitEmergency: '',
    limitedToPKR: '',
    consentAnesthesia: '',
    overnightHospitalization: '',
    personalItemsLeft: '',
    preferredContactMethod: '',
    ownerSignatureAdmission: '',
    ownerSignatureDateAdmission: '',
    clinicRepSignatureAdmission: '',
    clinicRepSignatureDateAdmission: '',
    // Patient Discharge Form specific
    dateOfAdmissionDischargeForm: '',
    dateOfDischarge: new Date().toISOString().split('T')[0],
    reasonForAdmissionDischargeForm: '',
    diagnosis: '',
    medicationsAdministered: [{ name: '', dosage: '', frequency: '', duration: '' }],
    otherProcedures: { deworming: '', vaccination: '', test: '' },
    generalCondition: '',
    weightDischarge: '',
    bodyTemperature: '',
    heartRate: '',
    respiratoryRate: '',
    otherVitalSigns: '',
    medicationsAtHome: [{ name: '', dosage: '', frequency: '', duration: '' }],
    specialInstructionsAttendant: '',
    dietaryInstructions: { foodType: '', feedingSchedule: '', specialRestrictions: '' },
    activityInstructions: { exercise: '', otherRestrictions: '' },
    woundCare: { instructions: '', monitorInfection: '' },
    followUpDate: '',
    followUpReason: '',
    signsToWatch: {
      vomiting: false,
      refusalToEat: false,
      difficultyBreathing: false,
      lethargy: false,
      lameness: false,
      coughing: false,
      swelling: false,
      other: ''
    },
    doctorSignatureDischarge: '',
    doctorSignatureDateDischarge: '',
    ownerSignatureDischargeForm: '',
    ownerSignatureDateDischargeForm: ''
  })

  // Load anesthesia procedure options from backend/local storage
  useEffect(() => {
    const loadAnesthesiaProcedures = async () => {
      let names = [...DEFAULT_ANESTHESIA_PROCEDURES]

      try {
        const res = await procedureCatalogAPI.getAll()
        const items = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : [])
        const anesthesiaItems = (items || []).filter(i => i.mainCategory === 'Procedure' && i.subCategory === 'Procedure' && i.drug)
        setProcedureCatalog(anesthesiaItems)
        const fromApi = anesthesiaItems.map(i => i.drug)
        names = Array.from(new Set([...names, ...fromApi]))
      } catch (e) {
        // ignore API error here, we'll still fall back to localStorage/defaults
      }

      try {
        const stored = JSON.parse(localStorage.getItem('anesthesia_procedures') || '[]')
        if (Array.isArray(stored)) {
          names = Array.from(new Set([...names, ...stored]))
        }
      } catch (e) {}

      // Apply local deleted list so removed options stay hidden
      try {
        const deleted = JSON.parse(localStorage.getItem('anesthesia_procedures_deleted') || '[]')
        if (Array.isArray(deleted) && deleted.length) {
          names = names.filter(n => !deleted.includes(n))
        }
      } catch (e) {}

      setProcedureOptions(names)
    }

    loadAnesthesiaProcedures()
  }, [])

  // Medicine calculation helpers (same as Prescription page)
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

  // Function to add medicines from a condition
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

    // Get current medications list
    const currentMeds = formData.medicationsAdministered || [{ name: '', dosage: '', frequency: '', duration: '' }]
    
    // Add medicines from the selected condition
    const newMeds = condition.rows.map(r => {
      let calculatedDose = r.dose || ''
      
      // Calculate dose if doseRate and perMl are available
      if (r.doseRate && r.perMl) {
        const dose = calcDose(r, weight)
        if (dose !== null) {
          calculatedDose = `${dose.toFixed(2)} ${r.unit || 'ml'}`
        }
      }

      return {
        name: r.name || '',
        dosage: calculatedDose,
        frequency: r.instructions || r.route || '',
        duration: ''
      }
    })

    // Merge with existing medications (remove empty first row if exists)
    const filteredCurrent = currentMeds.filter(m => m.name || m.dosage || m.frequency || m.duration)
    const merged = [...filteredCurrent, ...newMeds]

    handleInputChange('medicationsAdministered', merged)
    setModalMessage(`✅ Added ${newMeds.length} medicine(s) for ${condition.condition}`)
    setShowModal(true)
  }

  // Load medicine regimens from MongoDB
  useEffect(() => {
    loadMedicines()
  }, [])

  const loadMedicines = async () => {
    try {
      const response = await medicinesAPI.getAll()
      setRegimens(response?.data || [])
    } catch (err) {
      console.error('Error loading medicines:', err)
      try {
        const raw = JSON.parse(localStorage.getItem('doctor_medicines')||'[]')
        setRegimens(Array.isArray(raw) ? raw : [])
      } catch (e) {}
    }
  }

  useEffect(() => {
    if (petId.trim()) {
      loadPetData(petId.trim())
    }
  }, [petId])

  const loadPetData = async (id) => {
    try {
      const response = await petsAPI.getAll()
      const pets = response?.data || []
      const foundPet = pets.find(p => p.id === id || p._id === id)
      if (foundPet) {
        // Extract pet details from the registered pet data
        const petDetails = foundPet.details?.pet || {}
        const ownerDetails = foundPet.details?.owner || {}
        
        // Auto-generate unique Client ID
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
          // New auto-fill fields
          sex: petDetails.gender || foundPet.gender || '',
          neuteredSpayed: petDetails.neuteredSpayed || '',
          colorMarking: petDetails.colorMarkings || '',
          microchipNumber: petDetails.microchipTag || '',
          // Owner details
          clientId: clientId,
          cnicOwner: ownerDetails.nic || '',
          contactOwnerGuardian: ownerDetails.contact || foundPet.contact || '',
          alternateContact: ownerDetails.emergencyContactNumber || '',
          homeAddress: ownerDetails.address || '',
          contactPerson: ownerDetails.emergencyContactPerson || ''
        }))
      }
    } catch (err) {
      console.error('Error loading pet data:', err)
    }
  }

  useEffect(() => {
    if (!petId.trim()) return
  }, [petId])

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Auto-generate Pet ID for new patients
    if ((field === 'animalName' || field === 'ownerName') && !formData.patientId && formData.animalName && formData.ownerName) {
      checkExistingPet()
    }
  }

  const handleAddProcedure = async () => {
    const name = (newProcedure || '').trim()
    if (!name) return

    // If already present, just select it
    if (procedureOptions.includes(name)) {
      setFormData(prev => ({ ...prev, anesthesiaProcedure: name }))
      setNewProcedure('')
      return
    }

    // Try to persist in backend procedure catalog
    const payload = {
      mainCategory: 'Procedure',
      subCategory: 'Procedure',
      drug: name,
      unit: 'No',
      defaultAmount: 0,
      defaultQuantity: 1
    }

    try {
      const res = await procedureCatalogAPI.create(payload)
      const created = res?.data || res || payload
      setProcedureCatalog(prev => [...prev, created])
    } catch (e) {
      // Backend might be offline; still proceed with local list/localStorage
      console.warn('Failed to save anesthesia procedure to backend', e?.message || e)
    }

    setProcedureOptions(prev => {
      const updated = [...prev, name]
      // Persist custom procedures in localStorage (only those beyond defaults)
      try {
        const custom = updated.filter(x => !DEFAULT_ANESTHESIA_PROCEDURES.includes(x))
        localStorage.setItem('anesthesia_procedures', JSON.stringify(custom))
      } catch (e) {}
      return updated
    })

    // If this name was previously marked deleted, un-delete it locally
    try {
      const deleted = JSON.parse(localStorage.getItem('anesthesia_procedures_deleted') || '[]')
      if (Array.isArray(deleted) && deleted.includes(name)) {
        const filtered = deleted.filter(x => x !== name)
        localStorage.setItem('anesthesia_procedures_deleted', JSON.stringify(filtered))
      }
    } catch (e) {}

    setFormData(prev => ({
      ...prev,
      anesthesiaProcedure: name
    }))

    setNewProcedure('')
  }

  const handleDeleteProcedure = async () => {
    const name = (formData.anesthesiaProcedure || '').trim()
    if (!name) {
      setModalMessage('⚠️ Please select a procedure to delete first.')
      setShowModal(true)
      return
    }

    // Optimistically update options list and clear selection
    setProcedureOptions(prev => {
      const updated = prev.filter(p => p !== name)
      try {
        const custom = updated.filter(x => !DEFAULT_ANESTHESIA_PROCEDURES.includes(x))
        localStorage.setItem('anesthesia_procedures', JSON.stringify(custom))
      } catch (e) {}
      return updated
    })

    // Track deleted names so they stay hidden even if part of defaults
    try {
      const deleted = JSON.parse(localStorage.getItem('anesthesia_procedures_deleted') || '[]')
      const arr = Array.isArray(deleted) ? deleted : []
      if (!arr.includes(name)) {
        arr.push(name)
        localStorage.setItem('anesthesia_procedures_deleted', JSON.stringify(arr))
      }
    } catch (e) {}

    setFormData(prev => ({
      ...prev,
      anesthesiaProcedure: ''
    }))
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
    } catch (err) {
      console.error('Error checking existing pet:', err)
    }
  }

  const handlePrint = () => {
    // Force A4 print size for forms
    const styleEl = document.createElement('style')
    styleEl.setAttribute('data-print-a4', 'true')
    const scale = selectedForm === 'anesthesia'
      ? 1
      : (selectedForm === 'admission' ? 0.74 : (selectedForm === 'discharge' ? 0.72 : 0.72))
    styleEl.innerHTML = `
@page { size: A4; margin: 0; }

@media print {
  html, body {
    height: auto !important;
    overflow: visible !important;
    background: #fff !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    outline: none !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  html { zoom: ${scale}; }

  .bg-hospital-blue,
  .bg-gradient-to-br,
  .bg-gradient-to-r {
    background: #fff !important;
  }

  .shadow,
  .shadow-lg,
  .shadow-xl,
  .shadow-2xl {
    box-shadow: none !important;
  }

  input::placeholder,
  textarea::placeholder {
    color: transparent !important;
    opacity: 0 !important;
  }

  .overflow-x-auto,
  .overflow-y-auto,
  .overflow-auto {
    overflow: visible !important;
    max-height: none !important;
  }

  *::-webkit-scrollbar { display: none !important; }
  * { scrollbar-width: none !important; }

  table { width: 100% !important; }
  th, td { word-break: break-word; }

  .bg-white { break-inside: avoid; page-break-inside: avoid; }
}
`.trim()
    try { document.head.appendChild(styleEl) } catch (e) {}

    let placeholderSnapshot = []
    try {
      const nodes = Array.from(document.querySelectorAll('input[placeholder], textarea[placeholder]'))
      placeholderSnapshot = nodes.map(n => ({ n, p: n.getAttribute('placeholder') }))
      nodes.forEach(n => {
        try { n.setAttribute('data-print-placeholder', '1') } catch {}
        try { n.setAttribute('placeholder', '') } catch {}
      })
    } catch {}

    let hasRun = false
    const resetForm = () => {
      if (hasRun) return
      hasRun = true
      // Clear the search bar
      setPetId('')
      
      // Reset form data
      setFormData({
        patientId: '',
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
        hct: '',
        desiredHct: '',
        drugs: Array(8).fill({ name: '', dates: {} }),
        temp: {},
        dehydration: {},
        presentingComplaint: '',
        lastImmunization: '',
        lastAntihelmintics: '',
        bloodType: 'Whole Blood',
        transfusionMeds: [
          { name: 'Dexamethosone', route: 'Injection', dose: '', timing: 'Intravenous 10 minutes before transfusion' },
          { name: 'Phenramine Maleate', route: 'Injection', dose: '1 ml', timing: 'Intravenous once only' },
          { name: 'Omeprazole', route: 'Injection', dose: '4mg/ml', timing: '' },
          { name: 'Onset', route: 'Injection', dose: '2mg/ml', timing: 'Intravenous once' }
        ],
        labFindings: '',
        clientId: '',
        cnicOwner: '',
        contactOwnerGuardian: '',
        alternateContact: '',
        homeAddress: '',
        sex: '',
        neuteredSpayed: '',
        colorMarking: '',
        microchipNumber: '',
        dateDropOff: '',
        datePickUp: '',
        foodTypeBrand: '',
        amountPerFeeding: '',
        feedingFrequency: '',
        specialDietaryRequirements: '',
        medicationName: '',
        dosageFrequency: '',
        instructionsForAdministration: '',
        reasonForMedication: '',
        veterinarianName: '',
        spendingLimit: '',
        vaccinationsUpToDate: '',
        rabiesVaccination: '',
        dhppVaccination: '',
        bordetellaVaccination: '',
        leptospirosisVaccination: '',
        otherVaccination: '',
        fleaTickPrevention: '',
        recentSurgeries: '',
        surgeriesDescription: '',
        allergies: '',
        allergiesList: '',
        specialCareInstructions: '',
        pickUpPersonName: '',
        pickUpPersonPhone: '',
        ownerSignature: '',
        ownerSignatureDate: '',
        clinicRepSignature: '',
        clinicRepSignatureDate: '',
        bathingGrooming: '',
        extraPlaytime: '',
        otherServices: '',
        dischargeDate: new Date().toISOString().split('T')[0],
        careProvidedDuringStay: '',
        dailyCareFeeding: '',
        feedingFrequencyDischarge: '',
        medicationNameDischarge: '',
        dosageFrequencyDischarge: '',
        administerAsPerDirection: '',
        veterinaryCareRequired: '',
        veterinaryCareDescription: '',
        testTreatmentProvided: '',
        totalVeterinaryCharges: '',
        specialNotesIncidents: '',
        injuriesIllnesses: '',
        injuriesDescription: '',
        specialCareInstructionsHome: '',
        pickUpDateTime: '',
        pickUpPersonNameDischarge: '',
        pickUpPersonPhoneDischarge: '',
        ownerSignatureDischarge: '',
        ownerSignatureDateDischarge: '',
        admissionDate: new Date().toISOString().split('T')[0],
        emergencyContactName: '',
        emergencyContactPhone: '',
        relationshipToOwner: '',
        contactNumber: '',
        reasonForAdmission: '',
        symptomsObserved: '',
        durationOfSymptoms: '',
        previousTreatment: '',
        currentMedications: '',
        medicationsList: [{ name: '', dosage: '', frequency: '', duration: '' }],
        knownAllergies: '',
        allergiesListAdmission: '',
        previousIllnesses: '',
        vaccinationsUpToDateAdmission: '',
        rabiesVaccine: '',
        bordetellaVaccine: '',
        leptospirosisVaccine: '',
        otherVaccine: '',
        recentSurgeriesAdmission: '',
        surgeriesDescriptionAdmission: '',
        knownAllergiesAdmission: '',
        allergiesListDetails: '',
        specialDiet: '',
        specialDietDescription: '',
        feedingSchedule: '',
        aggressionTowardPeople: false,
        aggressionTowardAnimals: false,
        difficultyHandling: false,
        fearAnxiety: false,
        otherBehavior: '',
        specialHandlingInstructions: '',
        spendingLimitEmergency: '',
        limitedToPKR: '',
        consentAnesthesia: '',
        overnightHospitalization: '',
        personalItemsLeft: '',
        preferredContactMethod: '',
        ownerSignatureAdmission: '',
        ownerSignatureDateAdmission: '',
        clinicRepSignatureAdmission: '',
        clinicRepSignatureDateAdmission: '',
        dateOfAdmissionDischargeForm: '',
        dateOfDischarge: new Date().toISOString().split('T')[0],
        reasonForAdmissionDischargeForm: '',
        diagnosis: '',
        medicationsAdministered: [{ name: '', dosage: '', frequency: '', duration: '' }],
        otherProcedures: { deworming: '', vaccination: '', test: '' },
        generalCondition: '',
        weightDischarge: '',
        bodyTemperature: '',
        heartRate: '',
        respiratoryRate: '',
        otherVitalSigns: '',
        medicationsAtHome: [{ name: '', dosage: '', frequency: '', duration: '' }],
        specialInstructionsAttendant: '',
        dietaryInstructions: { foodType: '', feedingSchedule: '', specialRestrictions: '' },
        activityInstructions: { exercise: '', otherRestrictions: '' },
        woundCare: { instructions: '', monitorInfection: '' },
        followUpDate: '',
        followUpReason: '',
        signsToWatch: {
          vomiting: false,
          refusalToEat: false,
          difficultyBreathing: false,
          lethargy: false,
          lameness: false,
          coughing: false,
          swelling: false,
          other: ''
        },
        doctorSignatureDischarge: '',
        doctorSignatureDateDischarge: '',
        ownerSignatureDischargeForm: '',
        ownerSignatureDateDischargeForm: ''
      })
    }
    
    const done = () => {
      if (hasRun) return
      hasRun = true
      try { window.removeEventListener('afterprint', done) } catch (e) {}
      try { window.onafterprint = null } catch (e) {}
      try { if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl) } catch (e) {}

      try {
        ;(placeholderSnapshot || []).forEach(({ n, p }) => {
          try { n.setAttribute('placeholder', p || '') } catch {}
          try { n.removeAttribute('data-print-placeholder') } catch {}
        })
      } catch {}

      setTimeout(resetForm, 500)
    }
    
    try { window.addEventListener('afterprint', done, { once: true }) } catch (e) {}
    window.print()
    // Fallback in case afterprint doesn't fire
    setTimeout(() => { if (!hasRun) done() }, 2000)
  }

  const renderTreatmentChart = () => (
    <div className="bg-white p-8 rounded-xl shadow-lg print:shadow-none">
      {/* Header */}
      <div className="border-b-2 border-blue-600 pb-4 mb-4">
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

      {/* Patient Info Grid */}
      <div className="grid grid-cols-3 gap-4 mb-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-semibold">Patient ID:</span>
          <input value={formData.patientId} onChange={e => handleInputChange('patientId', e.target.value)} className="flex-1 border-b border-slate-300 px-2 py-1 font-semibold text-red-600" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">Owner Name:</span>
          <input value={formData.ownerName} onChange={e => handleInputChange('ownerName', e.target.value)} className="flex-1 border-b border-slate-300 px-2 py-1" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">Contact #:</span>
          <input value={formData.contact} onChange={e => handleInputChange('contact', e.target.value)} className="flex-1 border-b border-slate-300 px-2 py-1 font-semibold text-red-600" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">Animal Name:</span>
          <input value={formData.animalName} onChange={e => handleInputChange('animalName', e.target.value)} className="flex-1 border-b border-slate-300 px-2 py-1" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">Species:</span>
          <input value={formData.species} onChange={e => handleInputChange('species', e.target.value)} className="flex-1 border-b border-slate-300 px-2 py-1" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">Contact Person Name:</span>
          <input value={formData.contactPerson} onChange={e => handleInputChange('contactPerson', e.target.value)} className="flex-1 border-b border-slate-300 px-2 py-1 font-semibold text-red-600" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">Age:</span>
          <input value={formData.age} onChange={e => handleInputChange('age', e.target.value)} className="flex-1 border-b border-slate-300 px-2 py-1" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">Body Weight (kg):</span>
          <input value={formData.bodyWeight} onChange={e => handleInputChange('bodyWeight', e.target.value)} className="flex-1 border-b border-slate-300 px-2 py-1 font-semibold text-red-600" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">DOA:</span>
          <input value={formData.doa} onChange={e => handleInputChange('doa', e.target.value)} className="flex-1 border-b border-slate-300 px-2 py-1 font-semibold text-red-600" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">Temp °F (at Admis):</span>
          <input value={formData.tempF} onChange={e => handleInputChange('tempF', e.target.value)} className="flex-1 border-b border-slate-300 px-2 py-1" />
        </div>
        <div></div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">Gender:</span>
          <input value={formData.gender} onChange={e => handleInputChange('gender', e.target.value)} className="flex-1 border-b border-slate-300 px-2 py-1" />
        </div>
      </div>

      {/* Treatment Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-2 border-slate-800 text-xs">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-800 p-2" rowSpan="2">S.No</th>
              <th className="border border-slate-800 p-2" rowSpan="2">Drugs to be administered</th>
              <th className="border border-slate-800 p-2" colSpan="2">30-Oct-25</th>
              <th className="border border-slate-800 p-2" colSpan="2">31-Oct-25</th>
              <th className="border border-slate-800 p-2" colSpan="2">01-Nov-25</th>
              <th className="border border-slate-800 p-2" colSpan="2">02-Nov-25</th>
              <th className="border border-slate-800 p-2" colSpan="2">03-Nov-25</th>
            </tr>
            <tr className="bg-slate-100">
              <th className="border border-slate-800 p-1">Morning</th>
              <th className="border border-slate-800 p-1">Evening</th>
              <th className="border border-slate-800 p-1">Morning</th>
              <th className="border border-slate-800 p-1">Evening</th>
              <th className="border border-slate-800 p-1">Morning</th>
              <th className="border border-slate-800 p-1">Evening</th>
              <th className="border border-slate-800 p-1">Morning</th>
              <th className="border border-slate-800 p-1">Evening</th>
              <th className="border border-slate-800 p-1">Morning</th>
              <th className="border border-slate-800 p-1">Evening</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-800 p-2"></td>
              <td className="border border-slate-800 p-2 font-semibold">Temp:</td>
              {[...Array(10)].map((_, i) => <td key={i} className="border border-slate-800 p-2 h-8"></td>)}
            </tr>
            <tr>
              <td className="border border-slate-800 p-2"></td>
              <td className="border border-slate-800 p-2 font-semibold">Dehydration:</td>
              {[...Array(10)].map((_, i) => <td key={i} className="border border-slate-800 p-2 h-8"></td>)}
            </tr>
            {['Normal Saline', 'Cefotaxime', 'Metronidazole', 'Ondansetron', 'Omeprazole', 'Dimenhydranate', '', ''].map((drug, idx) => (
              <tr key={idx}>
                <td className="border border-slate-800 p-2 text-center">{idx + 1}</td>
                <td className="border border-slate-800 p-2">{drug}</td>
                {[...Array(10)].map((_, i) => <td key={i} className="border border-slate-800 p-2 h-8"></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Counter Sign */}
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
      {/* Header */}
      <div className="border-b-2 border-blue-600 pb-4 mb-4">
        <div className="flex items-start justify-between">
          <div className="text-left">
            <h1 className="text-2xl font-bold text-blue-600">Abbottabad Pet Hospital</h1>
            {hospital.address && <p className="text-sm text-slate-600 mt-1">{hospital.address}</p>}
            {hospital.phone && <p className="text-sm text-slate-600">{hospital.phone}</p>}
          </div>
          {hospital.logo && <img src={hospital.logo} alt="Hospital Logo" className="h-16" />}
        </div>
        <h3 className="text-sm font-bold text-red-600 mt-2 text-center">Note: Not Valid for Court</h3>
      </div>

      {/* Patient Info Grid */}
      <div className="grid grid-cols-3 gap-4 mb-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-semibold">Patient ID:</span>
          <input value={formData.patientId} onChange={e => handleInputChange('patientId', e.target.value)} className="flex-1 border-b border-slate-300 px-2 py-1 font-semibold text-red-600" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">Owner Name:</span>
          <input value={formData.ownerName} onChange={e => handleInputChange('ownerName', e.target.value)} className="flex-1 border-b border-slate-300 px-2 py-1" />
        </div>
        <div></div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">Animal Name:</span>
          <input value={formData.animalName} onChange={e => handleInputChange('animalName', e.target.value)} className="flex-1 border-b border-slate-300 px-2 py-1" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">Gender:</span>
          <input value={formData.gender} onChange={e => handleInputChange('gender', e.target.value)} className="flex-1 border-b border-slate-300 px-2 py-1" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">Date:</span>
          <input value={formData.doa} onChange={e => handleInputChange('doa', e.target.value)} className="flex-1 border-b border-slate-300 px-2 py-1" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">Species:</span>
          <input value={formData.species} onChange={e => handleInputChange('species', e.target.value)} className="flex-1 border-b border-slate-300 px-2 py-1" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">Age:</span>
          <input value={formData.age} onChange={e => handleInputChange('age', e.target.value)} className="flex-1 border-b border-slate-300 px-2 py-1" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">Temp °F:</span>
          <input value={formData.tempF} onChange={e => handleInputChange('tempF', e.target.value)} className="flex-1 border-b border-slate-300 px-2 py-1 font-semibold text-red-600" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">Body Weight (Kg):</span>
          <input value={formData.bodyWeight} onChange={e => handleInputChange('bodyWeight', e.target.value)} className="flex-1 border-b border-slate-300 px-2 py-1 font-semibold text-red-600" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">HCT Donor:</span>
          <input value={formData.hct} onChange={e => handleInputChange('hct', e.target.value)} className="flex-1 border-b border-slate-300 px-2 py-1 font-semibold text-red-600" />
        </div>
        <div></div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">Current HCT:</span>
          <input value={formData.hct} onChange={e => handleInputChange('hct', e.target.value)} className="flex-1 border-b border-slate-300 px-2 py-1 font-semibold text-red-600" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">Desired HCT:</span>
          <input value={formData.desiredHct} onChange={e => handleInputChange('desiredHct', e.target.value)} className="flex-1 border-b border-slate-300 px-2 py-1 font-semibold text-red-600" />
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Left Column */}
        <div className="space-y-4">
          <div>
            <div className="font-bold text-lg mb-2">H<sub>x</sub></div>
            <div className="font-semibold mb-1">Presenting Complaint:</div>
            <textarea value={formData.presentingComplaint} onChange={e => handleInputChange('presentingComplaint', e.target.value)} className="w-full border border-slate-300 rounded p-2 h-20" placeholder="- Anemia" />
          </div>
          <div>
            <div className="italic mb-1">Last Immunization:</div>
            <input value={formData.lastImmunization} onChange={e => handleInputChange('lastImmunization', e.target.value)} className="w-full border-b border-slate-300 px-2 py-1" />
          </div>
          <div>
            <div className="italic mb-1">Last Antihelmintics Rx:</div>
            <input value={formData.lastAntihelmintics} onChange={e => handleInputChange('lastAntihelmintics', e.target.value)} className="w-full border-b border-slate-300 px-2 py-1" />
          </div>
          <div>
            <div className="font-bold text-lg mb-2">O<sub>E</sub></div>
            <div className="space-y-1 text-sm">
              <div>-</div>
              <div>-</div>
              <div>-</div>
            </div>
          </div>
          <div>
            <div className="font-bold mb-2">Lab Findings</div>
            <div className="space-y-1 text-sm">
              <div>-</div>
              <div>-</div>
              <div>-</div>
            </div>
          </div>
        </div>

        {/* Right Column - Rx */}
        <div>
          <div className="font-bold text-lg mb-3">Rx</div>
          <div className="bg-yellow-300 text-center font-bold py-1 mb-3">BLOOD</div>
          
          <div className="mb-4">
            <div className="font-bold mb-2">Whole Blood</div>
            <div className="text-sm space-y-1">
              <div className="flex gap-2">
                <span className="font-semibold">#VALUE!</span>
                <span className="italic">ml Intravenous</span>
              </div>
            </div>
          </div>

          {/* Medications Table */}
          <div className="space-y-2 text-sm">
            {formData.transfusionMeds.map((med, idx) => (
              <div key={idx} className="grid grid-cols-4 gap-2 items-center">
                <span className="font-semibold">{med.route}</span>
                <span className="font-semibold">{med.name}</span>
                <span className="font-semibold">{med.dose}</span>
                <span className="text-xs">{med.timing}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  const renderAnesthesia = () => (
    <div className="bg-white p-8 rounded-xl shadow-lg print:shadow-none text-[12px] leading-tight">
      {/* Header */}
      <div className="border-b border-slate-400 pb-2 mb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 text-center">
            <h1 className="text-2xl font-extrabold text-blue-700 tracking-wide">Abbottabad Pet Hospital</h1>
            {hospital.address && <p className="text-xs mt-1">{hospital.address}</p>}
            {hospital.phone && <p className="text-xs">{hospital.phone}</p>}
            <h2 className="mt-3 text-base font-bold underline">Anesthesia Consent Form</h2>
          </div>
          {hospital.logo && <img src={hospital.logo} alt="Hospital Logo" className="h-14 ml-4" />}
        </div>
      </div>

      {/* Patient / Owner Details */}
      <div className="border-b border-slate-400 pb-2 mb-2">
        <div className="grid grid-cols-2 gap-4">
          {/* Patient Details */}
          <div>
            <h3 className="font-semibold mb-1 text-sm">Patient Details:</h3>
            <div className="space-y-0.5 text-xs">
              <div className="grid grid-cols-2 gap-1">
                <span className="font-semibold">Patient ID:</span>
                <input value={formData.patientId} onChange={e => handleInputChange('patientId', e.target.value)} className="border-b border-slate-300 px-1 font-semibold text-red-600" />
              </div>
              <div className="grid grid-cols-2 gap-1">
                <span className="font-semibold">Pet Name:</span>
                <input value={formData.animalName} onChange={e => handleInputChange('animalName', e.target.value)} className="border-b border-slate-300 px-1" />
              </div>
              <div className="grid grid-cols-2 gap-1">
                <span className="font-semibold">Species:</span>
                <input value={formData.species} onChange={e => handleInputChange('species', e.target.value)} className="border-b border-slate-300 px-1" />
              </div>
              <div className="grid grid-cols-2 gap-1">
                <span className="font-semibold">Age:</span>
                <input value={formData.age} onChange={e => handleInputChange('age', e.target.value)} className="border-b border-slate-300 px-1" />
              </div>
              <div className="grid grid-cols-2 gap-1">
                <span className="font-semibold">B. Wt(kg):</span>
                <input value={formData.bodyWeight} onChange={e => handleInputChange('bodyWeight', e.target.value)} className="border-b border-slate-300 px-1 font-semibold text-red-600" />
              </div>
              <div className="grid grid-cols-2 gap-1">
                <span className="font-semibold">Sex (Male/Female):</span>
                <input value={formData.sex} onChange={e => handleInputChange('sex', e.target.value)} className="border-b border-slate-300 px-1" />
              </div>
            </div>
          </div>

          {/* Owner Details */}
          <div>
            <h3 className="font-semibold mb-1 text-sm">Owner Details:</h3>
            <div className="space-y-0.5 text-xs">
              <div className="grid grid-cols-2 gap-1">
                <span className="font-semibold">Client ID:</span>
                <input value={formData.clientId} onChange={e => handleInputChange('clientId', e.target.value)} className="border-b border-slate-300 px-1" />
              </div>
              <div className="grid grid-cols-2 gap-1">
                <span className="font-semibold">Name:</span>
                <input value={formData.ownerName} onChange={e => handleInputChange('ownerName', e.target.value)} className="border-b border-slate-300 px-1 font-semibold text-red-600" />
              </div>
              <div className="grid grid-cols-2 gap-1">
                <span className="font-semibold">CNIC # of Owner/Guardian:</span>
                <input value={formData.cnicOwner} onChange={e => handleInputChange('cnicOwner', e.target.value)} className="border-b border-slate-300 px-1 font-semibold text-red-600" />
              </div>
              <div className="grid grid-cols-2 gap-1">
                <span className="font-semibold">Contact # of Owner/Guardian:</span>
                <input value={formData.contactOwnerGuardian} onChange={e => handleInputChange('contactOwnerGuardian', e.target.value)} className="border-b border-slate-300 px-1 font-semibold text-red-600" />
              </div>
              <div className="grid grid-cols-2 gap-1">
                <span className="font-semibold">Alternate Contact #:</span>
                <input value={formData.alternateContact} onChange={e => handleInputChange('alternateContact', e.target.value)} className="border-b border-slate-300 px-1 font-semibold text-red-600" />
              </div>
              <div className="grid grid-cols-2 gap-1">
                <span className="font-semibold">Date:</span>
                <input value={formData.doa} onChange={e => handleInputChange('doa', e.target.value)} className="border-b border-slate-300 px-1" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Procedure heading */}
      <div className="mb-3 text-xs">
        {/* Screen controls */}
        <div className="flex items-center gap-2 mb-1 print:hidden">
          <span className="font-semibold text-red-600 whitespace-nowrap">Procedure:</span>
          <select
            value={formData.anesthesiaProcedure}
            onChange={e => handleInputChange('anesthesiaProcedure', e.target.value)}
            className="flex-1 border border-slate-400 px-1 py-0.5 rounded text-[11px]"
          >
            <option value="">Select planned procedure</option>
            {procedureOptions.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 mt-1 print:hidden">
          <input
            value={newProcedure}
            onChange={e => setNewProcedure(e.target.value)}
            className="flex-1 border-b border-dashed border-slate-400 px-1"
            placeholder="Add new procedure name"
          />
          <button
            type="button"
            onClick={handleAddProcedure}
            className="px-2 py-0.5 text-[11px] border border-blue-500 text-blue-600 rounded hover:bg-blue-50"
          >
            Add New
          </button>
          <button
            type="button"
            onClick={handleDeleteProcedure}
            className="px-2 py-0.5 text-[11px] border border-red-500 text-red-600 rounded hover:bg-red-50"
          >
            Delete
          </button>
        </div>

        {/* Print-only display */}
        <div className="hidden print:flex items-center gap-2 mb-1">
          <span className="font-semibold text-red-600 whitespace-nowrap">Procedure:</span>
          <span className="flex-1 border-b border-slate-800 font-semibold text-center">
            {formData.anesthesiaProcedure || '\u00A0'}
          </span>
        </div>
      </div>

      {/* Consent text */}
      <div className="text-xs space-y-1 mb-3">
        <p>
          I understand that in performing the above procedure(s) my pet will receive an anesthetic. I understand that some risk of
          injury or death always exists with anesthesia and/or surgery, and I am encouraged to discuss any concerns I have about
          these risks with the attending veterinarian before the procedure is started.
        </p>
        <h3 className="text-center font-bold mt-2">ACKNOWLEDGEMENT AND CONSENT OF SURGICAL RISKS</h3>
        <p>
          I certify that I am the owner or authorized agent for the owner of the animal described above and that I have the
          authority to execute this consent. I hereby give my consent to Abbottabad Pet Hospital to perform the procedure described
          above and to administer such anesthetics as are necessary.
        </p>
        <p>
          I understand that the staff will use all reasonable precautions against injury, escape, or death of my pet, but that no
          guarantee can be made regarding the outcome of any anesthetic or surgical procedure. I have been advised of the material
          risks and possible complications and accept full financial responsibility for all services rendered.
        </p>
        <p className="font-semibold text-red-600 mt-1">
          ***In the event that we are unable to reach you at the given contact number(s) below:***
        </p>
        <div className="space-y-1">
          <p>
            _____ I give the Abbottabad Pet Hospital staff permission to complete any procedures deemed medically necessary to
            preserve the health of my animal. Furthermore, I agree to pay the additional associated costs.
          </p>
          <p>
            _____ I only permit the agreed upon procedure. I do not want any other veterinary medical care given to my animal
            without my permission. I understand that this may necessitate another anesthetic and/or surgical procedure later. I
            also understand that this decision may possibly affect the recovery and future health of my pet.
          </p>
          <p>
            _____ I acknowledge that my pet will be going home with an Elizabeth Collar (E-collar) on to protect my pet from
            damaging his/her incision(s). In addition to restricting my pet's physical activity, this collar must remain on my
            pet, except for eating, for 10-14 days. I agree to monitor my pet closely to ensure he/she does not find a way to
            damage the incision or area protected by the E-collar. Failure to follow discharge instructions could result in
            self-inflicted injuries to my pet due to excess movement, licking, biting, or otherwise damage to the incision or
            treatment area. Abbottabad Pet Hospital is not responsible for any costs incurred for failure to follow.
          </p>
        </div>
      </div>

      {/* Signature section */}
      <div className="mt-3 text-xs">
        <div className="grid grid-cols-2 gap-10 mb-4">
          <div>
            <div className="border-b border-slate-800 h-6 mb-1"></div>
            <div className="text-center">Signature of Owner/Agent:</div>
          </div>
          <div>
            <div className="border-b border-slate-800 h-6 mb-1"></div>
            <div className="text-center">Thumb of Owner/Agent:</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-10">
          <div>
            <div className="border-b border-slate-800 h-6 mb-1"></div>
            <div className="text-center">Witness / Staff Signature:</div>
          </div>
          <div>
            <div className="border-b border-slate-800 h-6 mb-1"></div>
            <div className="text-center">Date:</div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderDischarge = () => (
    <div className="bg-white p-8 rounded-xl shadow-lg print:shadow-none">
      {/* Header */}
      <div className="border-b-2 border-blue-600 pb-4 mb-6">
        <div className="flex items-start justify-between">
          <div className="text-left">
            <h1 className="text-3xl font-bold text-blue-600">Abbottabad Pet Hospital</h1>
            {hospital.address && <p className="text-sm text-slate-600 mt-2">{hospital.address}</p>}
            {hospital.phone && <p className="text-sm text-slate-600">{hospital.phone}</p>}
          </div>
          {hospital.logo && <img src={hospital.logo} alt="Hospital Logo" className="h-20" />}
        </div>
        <h3 className="text-lg font-bold underline mt-3 text-center">Pet Boarding Discharge</h3>
      </div>

      {/* Pet Information and Owner Details Grid */}
      <div className="grid grid-cols-2 gap-8 mb-6">
        {/* Pet Information */}
        <div>
          <h3 className="font-bold text-base mb-3 border-b border-slate-300 pb-1">Pet Information:</h3>
          <div className="space-y-1 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <span className="font-semibold">Patient ID:</span>
              <input value={formData.patientId} onChange={e => handleInputChange('patientId', e.target.value)} className="border-b border-slate-300 px-1 font-semibold text-red-600" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="font-semibold">Pet Name:</span>
              <input value={formData.animalName} onChange={e => handleInputChange('animalName', e.target.value)} className="border-b border-slate-300 px-1" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="font-semibold">Species:</span>
              <input value={formData.species} onChange={e => handleInputChange('species', e.target.value)} className="border-b border-slate-300 px-1" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="font-semibold">Age:</span>
              <input value={formData.age} onChange={e => handleInputChange('age', e.target.value)} className="border-b border-slate-300 px-1" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="font-semibold">B. Wt(kg):</span>
              <input value={formData.bodyWeight} onChange={e => handleInputChange('bodyWeight', e.target.value)} className="border-b border-slate-300 px-1 font-semibold text-red-600" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="font-semibold">Sex (Male/Female):</span>
              <input value={formData.sex} onChange={e => handleInputChange('sex', e.target.value)} className="border-b border-slate-300 px-1" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="font-semibold">Neutered/Spayed:</span>
              <input value={formData.neuteredSpayed} onChange={e => handleInputChange('neuteredSpayed', e.target.value)} placeholder="Semi-Auto (Have both option)" className="border-b border-slate-300 px-1 text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="font-semibold">Color/Marking:</span>
              <input value={formData.colorMarking} onChange={e => handleInputChange('colorMarking', e.target.value)} placeholder="Semi-Auto (Have both option)" className="border-b border-slate-300 px-1 text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="font-semibold">Microchip # (if applicable):</span>
              <input value={formData.microchipNumber} onChange={e => handleInputChange('microchipNumber', e.target.value)} placeholder="Semi-Auto (Have both option)" className="border-b border-slate-300 px-1 text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="font-semibold">Date:</span>
              <input value={formData.dischargeDate} onChange={e => handleInputChange('dischargeDate', e.target.value)} className="border-b border-slate-300 px-1" />
            </div>
          </div>
        </div>

        {/* Owner Details */}
        <div>
          <h3 className="font-bold text-base mb-3 border-b border-slate-300 pb-1">Owner Details</h3>
          <div className="space-y-1 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <span className="font-semibold">Client ID:</span>
              <input value={formData.clientId} onChange={e => handleInputChange('clientId', e.target.value)} className="border-b border-slate-300 px-1" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="font-semibold">Name:</span>
              <input value={formData.ownerName} onChange={e => handleInputChange('ownerName', e.target.value)} className="border-b border-slate-300 px-1 font-semibold text-red-600" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="font-semibold">CNIC # of Owner/Guardian:</span>
              <input value={formData.cnicOwner} onChange={e => handleInputChange('cnicOwner', e.target.value)} className="border-b border-slate-300 px-1 font-semibold text-red-600" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="font-semibold">Contact # of Owner/Guardian:</span>
              <input value={formData.contactOwnerGuardian} onChange={e => handleInputChange('contactOwnerGuardian', e.target.value)} className="border-b border-slate-300 px-1 font-semibold text-red-600" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="font-semibold">Alternate Contact #:</span>
              <input value={formData.alternateContact} onChange={e => handleInputChange('alternateContact', e.target.value)} className="border-b border-slate-300 px-1 font-semibold text-red-600" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="font-semibold">Home Address:</span>
              <input value={formData.homeAddress} onChange={e => handleInputChange('homeAddress', e.target.value)} className="border-b border-slate-300 px-1 font-semibold text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Boarding Dates */}
      <div className="mb-6">
        <h3 className="font-bold text-base mb-2">Boarding Dates:</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Date of Drop-Off:</span>
            <input value={formData.dateDropOff} onChange={e => handleInputChange('dateDropOff', e.target.value)} className="flex-1 border-b border-slate-300 px-2" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">Date of Pick-Up:</span>
            <input value={formData.datePickUp} onChange={e => handleInputChange('datePickUp', e.target.value)} className="flex-1 border-b border-slate-300 px-2" />
          </div>
        </div>
      </div>

      {/* Care provided during stay */}
      <div className="mb-6">
        <h3 className="font-bold text-base mb-2">Care provided during stay:</h3>
        <textarea value={formData.careProvidedDuringStay} onChange={e => handleInputChange('careProvidedDuringStay', e.target.value)} className="w-full border border-slate-300 rounded p-2 text-sm" rows="2" />
      </div>

      {/* Daily Care & Feeding Routine and Medication */}
      <div className="grid grid-cols-2 gap-8 mb-6">
        <div>
          <h3 className="font-bold text-base mb-2">1. Daily Care & Feeding Routine:</h3>
          <div className="space-y-2 text-sm">
            <div className="flex gap-2">
              <span className="font-semibold whitespace-nowrap">Food Type/ Brand:</span>
              <input value={formData.dailyCareFeeding} onChange={e => handleInputChange('dailyCareFeeding', e.target.value)} className="flex-1 border-b border-slate-300 px-1" />
            </div>
            <div className="flex gap-2">
              <span className="font-semibold whitespace-nowrap">Amount per Feeding:</span>
              <input value={formData.amountPerFeeding} onChange={e => handleInputChange('amountPerFeeding', e.target.value)} className="flex-1 border-b border-slate-300 px-1" />
            </div>
            <div className="flex gap-2">
              <span className="font-semibold whitespace-nowrap">Feeding Frequency:</span>
              <input value={formData.feedingFrequencyDischarge} onChange={e => handleInputChange('feedingFrequencyDischarge', e.target.value)} className="flex-1 border-b border-slate-300 px-1" />
            </div>
          </div>
        </div>
        <div>
          <h3 className="font-bold text-base mb-2">2. Medication (if applicable):</h3>
          <div className="space-y-2 text-sm">
            <div className="flex gap-2">
              <span className="font-semibold whitespace-nowrap">Medication Name:</span>
              <input value={formData.medicationNameDischarge} onChange={e => handleInputChange('medicationNameDischarge', e.target.value)} className="flex-1 border-b border-slate-300 px-1" />
            </div>
            <div className="flex gap-2">
              <span className="font-semibold whitespace-nowrap">Dosage & Frequency:</span>
              <input value={formData.dosageFrequencyDischarge} onChange={e => handleInputChange('dosageFrequencyDischarge', e.target.value)} className="flex-1 border-b border-slate-300 px-1" />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold">Administer as per direction:</span>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={formData.administerAsPerDirection === 'yes'} onChange={e => handleInputChange('administerAsPerDirection', e.target.checked ? 'yes' : '')} className="w-4 h-4" />
                <span>YES</span>
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={formData.administerAsPerDirection === 'no'} onChange={e => handleInputChange('administerAsPerDirection', e.target.checked ? 'no' : '')} className="w-4 h-4" />
                <span>NO</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Veterinary Care */}
      <div className="mb-6">
        <h3 className="font-bold text-base mb-2">Veterinary Care:</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-4">
            <span className="font-semibold">Was veterinary care required during the stay?</span>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={formData.veterinaryCareRequired === 'yes'} onChange={e => handleInputChange('veterinaryCareRequired', e.target.checked ? 'yes' : '')} className="w-4 h-4" />
              <span>Yes</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={formData.veterinaryCareRequired === 'no'} onChange={e => handleInputChange('veterinaryCareRequired', e.target.checked ? 'no' : '')} className="w-4 h-4" />
              <span>No</span>
            </label>
          </div>
          <div className="ml-4">
            <span className="font-semibold">Description of Care:</span>
            <textarea value={formData.veterinaryCareDescription} onChange={e => handleInputChange('veterinaryCareDescription', e.target.value)} className="w-full border border-slate-300 rounded p-2 mt-1" rows="2" />
          </div>
          <div className="ml-4">
            <span className="font-semibold">Test or Treatment Provided:</span>
            <input value={formData.testTreatmentProvided} onChange={e => handleInputChange('testTreatmentProvided', e.target.value)} className="w-full border-b border-slate-300 px-2 mt-1" />
          </div>
          <div className="ml-4">
            <span className="font-semibold">Total Veterinary Charges: (PKR)</span>
            <input value={formData.totalVeterinaryCharges} onChange={e => handleInputChange('totalVeterinaryCharges', e.target.value)} className="w-full border-b border-slate-300 px-2 mt-1" />
          </div>
        </div>
      </div>

      {/* Special Notes or Incidents */}
      <div className="mb-6">
        <h3 className="font-bold text-base mb-2">Special Notes or Incidents:</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-4">
            <span className="font-semibold">Any injuries, illnesses, or incidents during the stay?</span>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={formData.injuriesIllnesses === 'yes'} onChange={e => handleInputChange('injuriesIllnesses', e.target.checked ? 'yes' : '')} className="w-4 h-4" />
              <span>Yes</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={formData.injuriesIllnesses === 'no'} onChange={e => handleInputChange('injuriesIllnesses', e.target.checked ? 'no' : '')} className="w-4 h-4" />
              <span>No</span>
            </label>
          </div>
          <div className="ml-4">
            <span className="font-semibold">If Yes, please describe:</span>
            <textarea value={formData.injuriesDescription} onChange={e => handleInputChange('injuriesDescription', e.target.value)} className="w-full border border-slate-300 rounded p-2 mt-1" rows="2" />
          </div>
          <div>
            <span className="font-semibold">Special care instructions for at-home care:</span>
            <textarea value={formData.specialCareInstructionsHome} onChange={e => handleInputChange('specialCareInstructionsHome', e.target.value)} className="w-full border border-slate-300 rounded p-2 mt-1" rows="2" />
          </div>
        </div>
      </div>

      {/* Pick-Up Information */}
      <div className="mb-6">
        <h3 className="font-bold text-base mb-2">Pick-Up Information:</h3>
        <div className="space-y-2 text-sm">
          <div className="flex gap-2">
            <span className="font-semibold">Pick-up Date and Time:</span>
            <input value={formData.pickUpDateTime} onChange={e => handleInputChange('pickUpDateTime', e.target.value)} className="flex-1 border-b border-slate-300 px-2" />
          </div>
          <div>
            <p className="font-semibold mb-2">Person Pick-Up (if other than owner):</p>
            <div className="grid grid-cols-2 gap-4 ml-4">
              <div className="flex gap-2">
                <span>Name:</span>
                <input value={formData.pickUpPersonNameDischarge} onChange={e => handleInputChange('pickUpPersonNameDischarge', e.target.value)} className="flex-1 border-b border-slate-300 px-2" />
              </div>
              <div className="flex gap-2">
                <span>Phone Number:</span>
                <input value={formData.pickUpPersonPhoneDischarge} onChange={e => handleInputChange('pickUpPersonPhoneDischarge', e.target.value)} className="flex-1 border-b border-slate-300 px-2" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Owner Acknowledgement and Signature */}
      <div className="mb-6">
        <h3 className="font-bold text-base mb-2">Owner Acknowledgement and Signature:</h3>
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-sm mb-3">
          <p>I have reviewed the care provided to my pet during their stay at <span className="font-bold">{hospital.name}</span> and the final charges. I confirm that my pet has been returned to me in good health, barring any pre-existing conditions or issues that arose during the stay, which were promptly communicated to me by the clinic. I acknowledge the total charges and agree to settle the amount at the time of discharge.</p>
        </div>
        <div className="grid grid-cols-2 gap-8">
          <div>
            <div className="flex items-end gap-2 mb-1">
              <span className="font-semibold">Owner's Signature:</span>
              <div className="flex-1 border-b-2 border-slate-800 h-8"></div>
            </div>
          </div>
          <div>
            <div className="flex items-end gap-2 mb-1">
              <span className="font-semibold">Date:</span>
              <div className="flex-1 border-b-2 border-slate-800 h-8"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6 print:space-y-0">
      {/* Custom Modal for Medicine Addition */}
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
              <button
                onClick={() => setShowModal(false)}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold text-lg cursor-pointer transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                OK
              </button>
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
              <div className="text-slate-600 text-center">
                The selected form will be printed on A4. Click Print to continue.
              </div>
            </div>
            <div className="border-t border-slate-200 px-5 py-4 flex gap-3">
              <button onClick={() => setShowPrintDialog(false)} className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-semibold">OK</button>
              <button
                onClick={() => { setShowPrintDialog(false); setTimeout(() => handlePrint(), 10) }}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd"/></svg>
                Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header - Hide on print */}
      <div className="text-center print:hidden">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Medical Forms</h1>
        <p className="text-slate-500 mt-1">Select and fill out medical forms for patients</p>
      </div>

      {/* Pet ID Search - Hide on print */}
      <div className="rounded-2xl bg-gradient-to-br from-white to-purple-50 shadow-xl ring-1 ring-purple-200/50 p-6 border border-purple-100 print:hidden">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 flex-1">
            <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/></svg>
            <input 
              value={petId} 
              onChange={e => setPetId(e.target.value)} 
              placeholder="🔍 Enter Pet ID to auto-fill patient information" 
              className="flex-1 h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 transition-all duration-200 bg-white shadow-sm font-mono" 
            />
          </div>
        </div>
      </div>

      {/* Form Selection Buttons - Hide on print */}
      {!selectedForm && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 print:hidden">
          <button onClick={() => setSelectedForm('anesthesia')} className="h-32 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-bold text-xl cursor-pointer transition-all duration-200 shadow-lg hover:shadow-xl flex flex-col items-center justify-center gap-3">
            <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/></svg>
            Anesthesia
          </button>
          <button onClick={() => setSelectedForm('discharge')} className="h-32 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold text-xl cursor-pointer transition-all duration-200 shadow-lg hover:shadow-xl flex flex-col items-center justify-center gap-3">
            <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
            Boarding Discharge
          </button>
          <button onClick={() => setSelectedForm('admission')} className="h-32 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xl cursor-pointer transition-all duration-200 shadow-lg hover:shadow-xl flex flex-col items-center justify-center gap-3">
            <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V8z" clipRule="evenodd"/></svg>
            Patient Admission
          </button>
          <button onClick={() => setSelectedForm('patientDischarge')} className="h-32 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-bold text-xl cursor-pointer transition-all duration-200 shadow-lg hover:shadow-xl flex flex-col items-center justify-center gap-3">
            <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd"/></svg>
            Patient Discharge
          </button>
        </div>
      )}

      {/* Form Display */}
      {selectedForm && (
        <div>
          <div className="flex gap-3 mb-4 print:hidden">
            <button onClick={() => setSelectedForm(null)} className="h-10 px-4 rounded-lg bg-slate-600 hover:bg-slate-700 text-white font-semibold cursor-pointer transition-all duration-200 flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/></svg>
              Back
            </button>
            <button onClick={() => setShowPrintDialog(true)} className="h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer transition-all duration-200 flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd"/></svg>
              Print
            </button>
          </div>
          {selectedForm === 'anesthesia' && (
            <>
              {/* Medicine Condition Buttons - Hide on print */}
              {regimens.length > 0 && (
                <div className="rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-100 shadow-xl ring-1 ring-purple-200/50 p-6 border border-purple-100 mb-6 print:hidden">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/></svg>
                      <div className="text-purple-800 font-bold text-lg">Quick Add Medicines</div>
                    </div>
                    <button 
                      onClick={() => setShowMedicineButtons(!showMedicineButtons)}
                      className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm transition-all duration-200"
                    >
                      {showMedicineButtons ? 'Hide' : 'Show'} Medicines
                    </button>
                  </div>
                  {showMedicineButtons && (
                    <div className="flex flex-wrap gap-3">
                      {regimens.map(g => (
                        <button 
                          key={g.id} 
                          onClick={() => addConditionMedicines(g)} 
                          className="group h-10 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 text-white border-2 border-sky-300 hover:border-sky-400 cursor-pointer text-sm font-semibold transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/></svg>
                          {g.condition || 'Condition'}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-purple-700 mt-3">💡 Tip: Enter patient body weight first, then click a condition to auto-calculate and add medicines</p>
                </div>
              )}
              {renderAnesthesia()}
            </>
          )}
          {selectedForm === 'discharge' && (
            <>
              {/* Medicine Condition Buttons - Hide on print */}
              {regimens.length > 0 && (
                <div className="rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-100 shadow-xl ring-1 ring-purple-200/50 p-6 border border-purple-100 mb-6 print:hidden">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/></svg>
                      <div className="text-purple-800 font-bold text-lg">Quick Add Medicines</div>
                    </div>
                    <button 
                      onClick={() => setShowMedicineButtons(!showMedicineButtons)}
                      className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm transition-all duration-200"
                    >
                      {showMedicineButtons ? 'Hide' : 'Show'} Medicines
                    </button>
                  </div>
                  {showMedicineButtons && (
                    <div className="flex flex-wrap gap-3">
                      {regimens.map(g => (
                        <button 
                          key={g.id} 
                          onClick={() => addConditionMedicines(g)} 
                          className="group h-10 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 text-white border-2 border-sky-300 hover:border-sky-400 cursor-pointer text-sm font-semibold transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/></svg>
                          {g.condition || 'Condition'}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-purple-700 mt-3">💡 Tip: Enter patient body weight first, then click a condition to auto-calculate and add medicines</p>
                </div>
              )}
              {renderDischarge()}
            </>
          )}
          {selectedForm === 'admission' && (
            <>
              {/* Medicine Condition Buttons - Hide on print */}
              {regimens.length > 0 && (
                <div className="rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-100 shadow-xl ring-1 ring-purple-200/50 p-6 border border-purple-100 mb-6 print:hidden">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/></svg>
                      <div className="text-purple-800 font-bold text-lg">Quick Add Medicines</div>
                    </div>
                    <button 
                      onClick={() => setShowMedicineButtons(!showMedicineButtons)}
                      className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm transition-all duration-200"
                    >
                      {showMedicineButtons ? 'Hide' : 'Show'} Medicines
                    </button>
                  </div>
                  {showMedicineButtons && (
                    <div className="flex flex-wrap gap-3">
                      {regimens.map(g => (
                        <button 
                          key={g.id} 
                          onClick={() => addConditionMedicines(g)} 
                          className="group h-10 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 text-white border-2 border-sky-300 hover:border-sky-400 cursor-pointer text-sm font-semibold transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/></svg>
                          {g.condition || 'Condition'}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-purple-700 mt-3">💡 Tip: Enter patient body weight first, then click a condition to auto-calculate and add medicines</p>
                </div>
              )}

              <div className="bg-white p-6 rounded-xl shadow-lg print:shadow-none text-sm">
                <div className="border-b-2 border-blue-600 pb-3 mb-4">
                  <div className="flex items-start justify-between">
                    <div className="text-left">
                      <h1 className="text-xl font-bold text-blue-600">Abbottabad Pet Hospital</h1>
                      {hospital.address && <p className="text-xs text-slate-600 mt-1">{hospital.address}</p>}
                      {hospital.phone && <p className="text-xs text-slate-600">{hospital.phone}</p>}
                    </div>
                    {hospital.logo && <img src={hospital.logo} alt="Hospital Logo" className="h-16" />}
                  </div>
                  <h3 className="text-base font-bold underline mt-3 text-center">Patient Admission Form</h3>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-4">
                <div>
                  <h3 className="font-bold text-sm mb-2 border-b border-slate-300 pb-1">Pet Information:</h3>
                  <div className="space-y-1 text-xs">
                    <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Patient ID:</span><input value={formData.patientId} onChange={e => handleInputChange('patientId', e.target.value)} className="border-b border-slate-300 px-1 text-red-600 font-semibold" /></div>
                    <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Pet Name:</span><input value={formData.animalName} onChange={e => handleInputChange('animalName', e.target.value)} className="border-b border-slate-300 px-1" /></div>
                    <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Species:</span><input value={formData.species} onChange={e => handleInputChange('species', e.target.value)} className="border-b border-slate-300 px-1" /></div>
                    <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Age:</span><input value={formData.age} onChange={e => handleInputChange('age', e.target.value)} className="border-b border-slate-300 px-1" /></div>
                    <div className="grid grid-cols-2 gap-1"><span className="font-semibold">B. Wt(kg):</span><input value={formData.bodyWeight} onChange={e => handleInputChange('bodyWeight', e.target.value)} className="border-b border-slate-300 px-1 text-red-600 font-semibold" /></div>
                    <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Sex (Male/Female):</span><input value={formData.sex} onChange={e => handleInputChange('sex', e.target.value)} className="border-b border-slate-300 px-1" /></div>
                    <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Neutered/Spayed:</span><input value={formData.neuteredSpayed} onChange={e => handleInputChange('neuteredSpayed', e.target.value)} className="border-b border-slate-300 px-1" /></div>
                    <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Color/Marking:</span><input value={formData.colorMarking} onChange={e => handleInputChange('colorMarking', e.target.value)} className="border-b border-slate-300 px-1" /></div>
                    <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Microchip #:</span><input value={formData.microchipNumber} onChange={e => handleInputChange('microchipNumber', e.target.value)} className="border-b border-slate-300 px-1" /></div>
                    <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Date:</span><input value={formData.admissionDate} onChange={e => handleInputChange('admissionDate', e.target.value)} className="border-b border-slate-300 px-1" /></div>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-sm mb-2 border-b border-slate-300 pb-1">Owner Details</h3>
                  <div className="space-y-1 text-xs">
                    <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Client ID:</span><input value={formData.clientId} onChange={e => handleInputChange('clientId', e.target.value)} className="border-b border-slate-300 px-1" /></div>
                    <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Name:</span><input value={formData.ownerName} onChange={e => handleInputChange('ownerName', e.target.value)} className="border-b border-slate-300 px-1 text-red-600 font-semibold" /></div>
                    <div className="grid grid-cols-2 gap-1"><span className="font-semibold">CNIC #:</span><input value={formData.cnicOwner} onChange={e => handleInputChange('cnicOwner', e.target.value)} className="border-b border-slate-300 px-1 text-red-600 font-semibold" /></div>
                    <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Contact #:</span><input value={formData.contactOwnerGuardian} onChange={e => handleInputChange('contactOwnerGuardian', e.target.value)} className="border-b border-slate-300 px-1 text-red-600 font-semibold" /></div>
                    <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Home Address:</span><input value={formData.homeAddress} onChange={e => handleInputChange('homeAddress', e.target.value)} className="border-b border-slate-300 px-1 text-red-600 font-semibold" /></div>
                    <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Emergency Contact:</span><input value={formData.emergencyContactName} onChange={e => handleInputChange('emergencyContactName', e.target.value)} className="border-b border-slate-300 px-1 text-red-600 font-semibold" /></div>
                    <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Emergency Phone:</span><input value={formData.emergencyContactPhone} onChange={e => handleInputChange('emergencyContactPhone', e.target.value)} className="border-b border-slate-300 px-1 text-red-600 font-semibold" /></div>
                    <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Relationship:</span><input value={formData.relationshipToOwner} onChange={e => handleInputChange('relationshipToOwner', e.target.value)} className="border-b border-slate-300 px-1 text-red-600 font-semibold" /></div>
                    <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Contact #:</span><input value={formData.contactNumber} onChange={e => handleInputChange('contactNumber', e.target.value)} className="border-b border-slate-300 px-1 text-red-600 font-semibold" /></div>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <h3 className="font-bold text-sm mb-2 border-b border-slate-300 pb-1">Admission Details:</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex gap-2"><span className="font-semibold whitespace-nowrap">Date of Admission:</span><input value={formData.admissionDate} onChange={e => handleInputChange('admissionDate', e.target.value)} className="flex-1 border-b border-slate-300 px-1" /></div>
                  <div><span className="font-semibold">Reason for admission (Diagnosis/Condition):</span><textarea value={formData.reasonForAdmission} onChange={e => handleInputChange('reasonForAdmission', e.target.value)} className="w-full border border-slate-300 rounded p-1 mt-1" rows="2" /></div>
                  <div><span className="font-semibold">Symptoms Observed by Owner:</span><textarea value={formData.symptomsObserved} onChange={e => handleInputChange('symptomsObserved', e.target.value)} className="w-full border border-slate-300 rounded p-1 mt-1" rows="2" /></div>
                  <div><span className="font-semibold">Duration of Symptoms:</span><input value={formData.durationOfSymptoms} onChange={e => handleInputChange('durationOfSymptoms', e.target.value)} className="w-full border-b border-slate-300 px-1 mt-1" /></div>
                  <div><span className="font-semibold">Previous Treatment or Medications Given (if any):</span><textarea value={formData.previousTreatment} onChange={e => handleInputChange('previousTreatment', e.target.value)} className="w-full border border-slate-300 rounded p-1 mt-1" rows="2" /></div>
                </div>
              </div>

              <div className="mb-4">
                <h3 className="font-bold text-sm mb-2 border-b border-slate-300 pb-1">Medical History:</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-3"><span className="font-semibold">Is your pet currently on any medications?</span><label className="flex items-center gap-1"><input type="checkbox" checked={formData.currentMedications === 'yes'} onChange={e => handleInputChange('currentMedications', e.target.checked ? 'yes' : '')} className="w-3 h-3" /><span>Yes</span></label><label className="flex items-center gap-1"><input type="checkbox" checked={formData.currentMedications === 'no'} onChange={e => handleInputChange('currentMedications', e.target.checked ? 'no' : '')} className="w-3 h-3" /><span>No</span></label></div>
                  <div className="flex items-center gap-3"><span className="font-semibold">Does your pet have any known allergies?</span><label className="flex items-center gap-1"><input type="checkbox" checked={formData.knownAllergiesAdmission === 'yes'} onChange={e => handleInputChange('knownAllergiesAdmission', e.target.checked ? 'yes' : '')} className="w-3 h-3" /><span>Yes</span></label><label className="flex items-center gap-1"><input type="checkbox" checked={formData.knownAllergiesAdmission === 'no'} onChange={e => handleInputChange('knownAllergiesAdmission', e.target.checked ? 'no' : '')} className="w-3 h-3" /><span>No</span></label></div>
                  {formData.knownAllergiesAdmission === 'yes' && <div className="ml-3"><span className="font-semibold">If yes, please list:</span><input value={formData.allergiesListDetails} onChange={e => handleInputChange('allergiesListDetails', e.target.value)} className="w-full border-b border-slate-300 px-1 mt-1" /></div>}
                  <div><span className="font-semibold">Previous Illnesses, Surgeries, or Chronic Conditions:</span><textarea value={formData.previousIllnesses} onChange={e => handleInputChange('previousIllnesses', e.target.value)} className="w-full border border-slate-300 rounded p-1 mt-1" rows="2" /></div>
                  <div className="flex items-center gap-3"><span className="font-semibold">Is your pet up-to-date on vaccinations?</span><label className="flex items-center gap-1"><input type="checkbox" checked={formData.vaccinationsUpToDateAdmission === 'yes'} onChange={e => handleInputChange('vaccinationsUpToDateAdmission', e.target.checked ? 'yes' : '')} className="w-3 h-3" /><span>Yes</span></label><label className="flex items-center gap-1"><input type="checkbox" checked={formData.vaccinationsUpToDateAdmission === 'no'} onChange={e => handleInputChange('vaccinationsUpToDateAdmission', e.target.checked ? 'no' : '')} className="w-3 h-3" /><span>No</span></label></div>
                  <div className="ml-3"><p className="font-semibold mb-1">Vaccinations Received:</p><div className="grid grid-cols-2 gap-x-4 gap-y-1"><div className="flex gap-1"><span>Rabies:</span><input value={formData.rabiesVaccine} onChange={e => handleInputChange('rabiesVaccine', e.target.value)} className="flex-1 border-b border-slate-300 px-1" /></div><div className="flex gap-1"><span>Leptospirosis:</span><input value={formData.leptospirosisVaccine} onChange={e => handleInputChange('leptospirosisVaccine', e.target.value)} className="flex-1 border-b border-slate-300 px-1" /></div><div className="flex gap-1"><span>Bordetella:</span><input value={formData.bordetellaVaccine} onChange={e => handleInputChange('bordetellaVaccine', e.target.value)} className="flex-1 border-b border-slate-300 px-1" /></div><div className="flex gap-1"><span>Other:</span><input value={formData.otherVaccine} onChange={e => handleInputChange('otherVaccine', e.target.value)} className="flex-1 border-b border-slate-300 px-1" /></div></div></div>
                  <div className="flex items-center gap-3"><span className="font-semibold">Is your pet currently on flea/tick/parasite prevention?</span><label className="flex items-center gap-1"><input type="checkbox" checked={formData.fleaTickPrevention === 'yes'} onChange={e => handleInputChange('fleaTickPrevention', e.target.checked ? 'yes' : '')} className="w-3 h-3" /><span>Yes</span></label><label className="flex items-center gap-1"><input type="checkbox" checked={formData.fleaTickPrevention === 'no'} onChange={e => handleInputChange('fleaTickPrevention', e.target.checked ? 'no' : '')} className="w-3 h-3" /><span>No</span></label></div>
                  <div className="flex items-center gap-3"><span className="font-semibold">Has your pet had any recent surgeries, injuries, or illnesses?</span><label className="flex items-center gap-1"><input type="checkbox" checked={formData.recentSurgeriesAdmission === 'yes'} onChange={e => handleInputChange('recentSurgeriesAdmission', e.target.checked ? 'yes' : '')} className="w-3 h-3" /><span>Yes</span></label><label className="flex items-center gap-1"><input type="checkbox" checked={formData.recentSurgeriesAdmission === 'no'} onChange={e => handleInputChange('recentSurgeriesAdmission', e.target.checked ? 'no' : '')} className="w-3 h-3" /><span>No</span></label></div>
                  {formData.recentSurgeriesAdmission === 'yes' && <div className="ml-3"><span className="font-semibold">If yes, please describe:</span><textarea value={formData.surgeriesDescriptionAdmission} onChange={e => handleInputChange('surgeriesDescriptionAdmission', e.target.value)} className="w-full border border-slate-300 rounded p-1 mt-1" rows="2" /></div>}
                </div>
              </div>

              <div className="mb-4">
                <h3 className="font-bold text-sm mb-2 border-b border-slate-300 pb-1">Dietary Information:</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-3"><span className="font-semibold">Is your pet on a special diet?</span><label className="flex items-center gap-1"><input type="checkbox" checked={formData.specialDiet === 'yes'} onChange={e => handleInputChange('specialDiet', e.target.checked ? 'yes' : '')} className="w-3 h-3" /><span>Yes</span></label><label className="flex items-center gap-1"><input type="checkbox" checked={formData.specialDiet === 'no'} onChange={e => handleInputChange('specialDiet', e.target.checked ? 'no' : '')} className="w-3 h-3" /><span>No</span></label></div>
                  {formData.specialDiet === 'yes' && <div className="ml-3"><span className="font-semibold">If yes, please describe:</span><textarea value={formData.specialDietDescription} onChange={e => handleInputChange('specialDietDescription', e.target.value)} className="w-full border border-slate-300 rounded p-1 mt-1" rows="2" /></div>}
                  <div className="grid grid-cols-2 gap-3"><div className="flex gap-1"><span className="font-semibold">Food Type/Brand:</span><input value={formData.foodTypeBrand} onChange={e => handleInputChange('foodTypeBrand', e.target.value)} className="flex-1 border-b border-slate-300 px-1" /></div><div className="flex gap-1"><span className="font-semibold">Feeding Schedule:</span><input value={formData.feedingSchedule} onChange={e => handleInputChange('feedingSchedule', e.target.value)} className="flex-1 border-b border-slate-300 px-1" /></div></div>
                </div>
              </div>

              <div className="mb-4">
                <h3 className="font-bold text-sm mb-2 border-b border-slate-300 pb-1">Behavioral Information:</h3>
                <div className="space-y-2 text-xs">
                  <p className="font-semibold">Has your pet exhibited any of the following behaviors? (Check all that apply)</p>
                  <div className="grid grid-cols-2 gap-1 ml-3"><label className="flex items-center gap-1"><input type="checkbox" checked={formData.aggressionTowardPeople} onChange={e => handleInputChange('aggressionTowardPeople', e.target.checked)} className="w-3 h-3" /><span>Aggression toward people</span></label><label className="flex items-center gap-1"><input type="checkbox" checked={formData.aggressionTowardAnimals} onChange={e => handleInputChange('aggressionTowardAnimals', e.target.checked)} className="w-3 h-3" /><span>Aggression toward other animals</span></label><label className="flex items-center gap-1"><input type="checkbox" checked={formData.difficultyHandling} onChange={e => handleInputChange('difficultyHandling', e.target.checked)} className="w-3 h-3" /><span>Difficulty handling (e.g., for medications, grooming)</span></label><label className="flex items-center gap-1"><input type="checkbox" checked={formData.fearAnxiety} onChange={e => handleInputChange('fearAnxiety', e.target.checked)} className="w-3 h-3" /><span>Fear or anxiety in new environments</span></label></div>
                  <div className="flex gap-1"><span className="font-semibold">Other (please specify):</span><input value={formData.otherBehavior} onChange={e => handleInputChange('otherBehavior', e.target.value)} className="flex-1 border-b border-slate-300 px-1" /></div>
                </div>
              </div>

              <div className="mb-4">
                <h3 className="font-bold text-sm mb-2 border-b border-slate-300 pb-1">Special Handling Instructions (if any):</h3>
                <p className="text-xs font-semibold mb-1">Has your pet exhibited any of the following behaviors? (Check all that apply)</p>
                <textarea value={formData.specialHandlingInstructions} onChange={e => handleInputChange('specialHandlingInstructions', e.target.value)} className="w-full border border-slate-300 rounded p-1 text-xs" rows="2" />
              </div>

              <div className="mb-4">
                <h3 className="font-bold text-sm mb-2 border-b border-slate-300 pb-1">Authorization for Medical Treatment:</h3>
                <div className="bg-slate-50 p-2 rounded border border-slate-200 text-xs mb-2">
                  <p>I, the undersigned owner/guardian, authorize <span className="font-bold">{hospital.name}</span> and its staff to administer the necessary medications and treatments as discussed and recommended by the attending veterinarian. In the event of an emergency, I give permission for the clinic to take all necessary medical actions to stabilize my pet, including but not limited to diagnostic testing, surgical intervention, and emergency care.</p>
                </div>
                <div className="flex items-center gap-3 text-xs"><span className="font-semibold">Spending Limit for Emergency Care (if applicable):</span><label className="flex items-center gap-1"><input type="checkbox" checked={formData.spendingLimitEmergency === 'no-limit'} onChange={e => handleInputChange('spendingLimitEmergency', e.target.checked ? 'no-limit' : '')} className="w-3 h-3" /><span>No Limit</span></label><label className="flex items-center gap-1"><input type="checkbox" checked={formData.spendingLimitEmergency === 'limited'} onChange={e => handleInputChange('spendingLimitEmergency', e.target.checked ? 'limited' : '')} className="w-3 h-3" /><span>Limited to PKR</span></label>{formData.spendingLimitEmergency === 'limited' && <input value={formData.limitedToPKR} onChange={e => handleInputChange('limitedToPKR', e.target.value)} className="border-b border-slate-300 px-1 w-24" />}</div>
              </div>

              <div className="mb-4">
                <h3 className="font-bold text-sm mb-2 border-b border-slate-300 pb-1">Consent for Anesthesia (if applicable):</h3>
                <div className="bg-slate-50 p-2 rounded border border-slate-200 text-xs mb-2">
                  <p>If your pet requires a procedure that involves anesthesia, we will take every precaution to ensure their safety. Please acknowledge that any anesthesia procedure carries inherent risks.</p>
                </div>
                <div className="flex items-center gap-3 text-xs"><span className="font-semibold">Do you consent to the use of anesthesia if required?</span><label className="flex items-center gap-1"><input type="checkbox" checked={formData.consentAnesthesia === 'yes'} onChange={e => handleInputChange('consentAnesthesia', e.target.checked ? 'yes' : '')} className="w-3 h-3" /><span>Yes</span></label><label className="flex items-center gap-1"><input type="checkbox" checked={formData.consentAnesthesia === 'no'} onChange={e => handleInputChange('consentAnesthesia', e.target.checked ? 'no' : '')} className="w-3 h-3" /><span>No</span></label></div>
              </div>

              <div className="mb-4">
                <h3 className="font-bold text-sm mb-2 border-b border-slate-300 pb-1">Hospitalization and Boarding:</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-3"><span className="font-semibold">Will your pet require overnight hospitalization or boarding?</span><label className="flex items-center gap-1"><input type="checkbox" checked={formData.overnightHospitalization === 'yes'} onChange={e => handleInputChange('overnightHospitalization', e.target.checked ? 'yes' : '')} className="w-3 h-3" /><span>Yes</span></label><label className="flex items-center gap-1"><input type="checkbox" checked={formData.overnightHospitalization === 'no'} onChange={e => handleInputChange('overnightHospitalization', e.target.checked ? 'no' : '')} className="w-3 h-3" /><span>No</span></label></div>
                  <div><span className="font-semibold">Any personal items left with your pet (blanket, toy, etc.):</span><input value={formData.personalItemsLeft} onChange={e => handleInputChange('personalItemsLeft', e.target.value)} className="w-full border-b border-slate-300 px-1 mt-1" /></div>
                </div>
              </div>

              <div className="mb-4">
                <h3 className="font-bold text-sm mb-2 border-b border-slate-300 pb-1">Discharge and Follow-Up:</h3>
                <div className="bg-slate-50 p-2 rounded border border-slate-200 text-xs mb-2">
                  <p>I understand that the clinic will contact me when my pet is ready for discharge and provide me with instructions for continued care at home. I agree to follow the prescribed treatment plan and attend any recommended follow-up appointments.</p>
                </div>
                <div><span className="font-semibold text-xs">Preferred Contact Method for Updates (Phone/Email/Text):</span><input value={formData.preferredContactMethod} onChange={e => handleInputChange('preferredContactMethod', e.target.value)} className="w-full border-b border-slate-300 px-1 mt-1" /></div>
              </div>

              <div className="mb-4">
                <h3 className="font-bold text-sm mb-2 border-b border-slate-300 pb-1">Liability Waiver:</h3>
                <div className="bg-slate-50 p-2 rounded border border-slate-200 text-xs">
                  <p>I understand that <span className="font-bold">{hospital.name}</span> will take all reasonable precautions to ensure the health and safety of my pet during their stay. I agree to release <span className="font-bold">{hospital.name}</span>, its veterinarians, and staff from any claims or liabilities arising from unforeseen complications during treatment or hospitalization, provided that all reasonable care has been exercised.</p>
                </div>
              </div>

              <div className="mb-4">
                <h3 className="font-bold text-sm mb-2 border-b border-slate-300 pb-1">Owner Acknowledgement and Signature:</h3>
                <div className="bg-slate-50 p-2 rounded border border-slate-200 text-xs mb-2">
                  <p>I have provided accurate and complete information about my pet's health, medical history, and behavioral issues. I understand the risks associated with the treatment and hospitalization of my pet and agree to the terms outlined in this admission form.</p>
                </div>
                <div className="grid grid-cols-2 gap-6 text-xs">
                  <div><div className="flex items-end gap-2 mb-1"><span className="font-semibold">Owner's Signature:</span><div className="flex-1 border-b-2 border-slate-800 h-6"></div></div></div>
                  <div><div className="flex items-end gap-2 mb-1"><span className="font-semibold">Date:</span><div className="flex-1 border-b-2 border-slate-800 h-6"></div></div></div>
                </div>
              </div>

              <div className="mb-4">
                <div className="grid grid-cols-2 gap-6 text-xs">
                  <div><div className="flex items-end gap-2 mb-1"><span className="font-semibold">Clinic Representative's Signature:</span><div className="flex-1 border-b-2 border-slate-800 h-6"></div></div></div>
                  <div><div className="flex items-end gap-2 mb-1"><span className="font-semibold">Date:</span><div className="flex-1 border-b-2 border-slate-800 h-6"></div></div></div>
                </div>
              </div>
            </div>
            </>
          )}
          {selectedForm === 'patientDischarge' && (
            <>
              {/* Medicine Condition Buttons - Hide on print */}
              {regimens.length > 0 && (
                <div className="rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-100 shadow-xl ring-1 ring-purple-200/50 p-6 border border-purple-100 mb-6 print:hidden">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/></svg>
                      <div className="text-purple-800 font-bold text-lg">Quick Add Medicines</div>
                    </div>
                    <button 
                      onClick={() => setShowMedicineButtons(!showMedicineButtons)}
                      className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm transition-all duration-200"
                    >
                      {showMedicineButtons ? 'Hide' : 'Show'} Medicines
                    </button>
                  </div>
                  {showMedicineButtons && (
                    <div className="flex flex-wrap gap-3">
                      {regimens.map(g => (
                        <button 
                          key={g.id} 
                          onClick={() => addConditionMedicines(g)} 
                          className="group h-10 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-500 hover:from-sky-600 hover:to-blue-600 text-white border-2 border-sky-300 hover:border-sky-400 cursor-pointer text-sm font-semibold transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/></svg>
                          {g.condition || 'Condition'}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-purple-700 mt-3">💡 Tip: Enter patient body weight first, then click a condition to auto-calculate and add medicines</p>
                </div>
              )}

              <div className="bg-white p-6 rounded-xl shadow-lg print:shadow-none text-sm">
                <div className="border-b-2 border-blue-600 pb-3 mb-4">
                  <div className="flex items-start justify-between">
                    <div className="text-left">
                      <h1 className="text-xl font-bold text-blue-600">Abbottabad Pet Hospital</h1>
                      {hospital.address && <p className="text-xs text-slate-600 mt-1">{hospital.address}</p>}
                      {hospital.phone && <p className="text-xs text-slate-600">{hospital.phone}</p>}
                    </div>
                    {hospital.logo && <img src={hospital.logo} alt="Hospital Logo" className="h-16" />}
                  </div>
                  <h3 className="text-base font-bold underline mt-3 text-center">Patient Discharge Form</h3>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-4">
                <div>
                  <h3 className="font-bold text-sm mb-2 border-b border-slate-300 pb-1">Pet Information:</h3>
                  <div className="space-y-1 text-xs">
                    <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Patient ID:</span><input value={formData.patientId} onChange={e => handleInputChange('patientId', e.target.value)} className="border-b border-slate-300 px-1 text-red-600 font-semibold" /></div>
                    <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Pet Name:</span><input value={formData.animalName} onChange={e => handleInputChange('animalName', e.target.value)} className="border-b border-slate-300 px-1" /></div>
                    <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Species:</span><input value={formData.species} onChange={e => handleInputChange('species', e.target.value)} className="border-b border-slate-300 px-1" /></div>
                    <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Age:</span><input value={formData.age} onChange={e => handleInputChange('age', e.target.value)} className="border-b border-slate-300 px-1" /></div>
                    <div className="grid grid-cols-2 gap-1"><span className="font-semibold">B. Wt(kg):</span><input value={formData.bodyWeight} onChange={e => handleInputChange('bodyWeight', e.target.value)} className="border-b border-slate-300 px-1 text-red-600 font-semibold" /></div>
                    <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Sex (Male/Female):</span><input value={formData.sex} onChange={e => handleInputChange('sex', e.target.value)} className="border-b border-slate-300 px-1" /></div>
                    <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Neutered/Spayed:</span><input value={formData.neuteredSpayed} onChange={e => handleInputChange('neuteredSpayed', e.target.value)} className="border-b border-slate-300 px-1" /></div>
                    <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Color/Marking:</span><input value={formData.colorMarking} onChange={e => handleInputChange('colorMarking', e.target.value)} className="border-b border-slate-300 px-1" /></div>
                    <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Microchip # (If applicable):</span><input value={formData.microchipNumber} onChange={e => handleInputChange('microchipNumber', e.target.value)} className="border-b border-slate-300 px-1" /></div>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-sm mb-2 border-b border-slate-300 pb-1">Owner Details</h3>
                  <div className="space-y-1 text-xs">
                    <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Client ID:</span><input value={formData.clientId} onChange={e => handleInputChange('clientId', e.target.value)} className="border-b border-slate-300 px-1" /></div>
                    <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Name:</span><input value={formData.ownerName} onChange={e => handleInputChange('ownerName', e.target.value)} className="border-b border-slate-300 px-1 text-red-600 font-semibold" /></div>
                    <div className="grid grid-cols-2 gap-1"><span className="font-semibold">CNIC # of Owner:</span><input value={formData.cnicOwner} onChange={e => handleInputChange('cnicOwner', e.target.value)} className="border-b border-slate-300 px-1 text-red-600 font-semibold" /></div>
                    <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Contact # of Owner/Guardian:</span><input value={formData.contactOwnerGuardian} onChange={e => handleInputChange('contactOwnerGuardian', e.target.value)} className="border-b border-slate-300 px-1 text-red-600 font-semibold" /></div>
                    <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Home Address:</span><input value={formData.homeAddress} onChange={e => handleInputChange('homeAddress', e.target.value)} className="border-b border-slate-300 px-1 text-red-600 font-semibold" /></div>
                    <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Date of Admission:</span><input value={formData.dateOfAdmissionDischargeForm} onChange={e => handleInputChange('dateOfAdmissionDischargeForm', e.target.value)} className="border-b border-slate-300 px-1" /></div>
                    <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Date of Discharge:</span><input value={formData.dateOfDischarge} onChange={e => handleInputChange('dateOfDischarge', e.target.value)} className="border-b border-slate-300 px-1" /></div>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <h3 className="font-bold text-sm mb-2 border-b border-slate-300 pb-1">Admission Details:</h3>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="flex gap-2"><span className="font-semibold">Date of Admission:</span><input value={formData.dateOfAdmissionDischargeForm} onChange={e => handleInputChange('dateOfAdmissionDischargeForm', e.target.value)} className="flex-1 border-b border-slate-300 px-1" /></div>
                  <div className="flex gap-2"><span className="font-semibold">Reason for Admission:</span><input value={formData.reasonForAdmissionDischargeForm} onChange={e => handleInputChange('reasonForAdmissionDischargeForm', e.target.value)} className="flex-1 border-b border-slate-300 px-1" /></div>
                </div>
              </div>

              <div className="mb-4">
                <h3 className="font-bold text-sm mb-2 border-b border-slate-300 pb-1">Diagnosis:</h3>
                <textarea value={formData.diagnosis} onChange={e => handleInputChange('diagnosis', e.target.value)} className="w-full border border-slate-300 rounded p-2 text-xs" rows="2" />
              </div>

              <div className="mb-4">
                <h3 className="font-bold text-sm mb-2 border-b border-slate-300 pb-1">Medication Administered:</h3>
                <table className="w-full border border-slate-300 text-xs">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="border border-slate-300 p-1">Medication Name</th>
                      <th className="border border-slate-300 p-1">Dosage</th>
                      <th className="border border-slate-300 p-1">Frequency</th>
                      <th className="border border-slate-300 p-1">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.medicationsAdministered.map((med, idx) => (
                      <tr key={idx}>
                        <td className="border border-slate-300 p-1"><input value={med.name} onChange={e => {
                          const newList = [...formData.medicationsAdministered]
                          newList[idx].name = e.target.value
                          handleInputChange('medicationsAdministered', newList)
                        }} className="w-full px-1" /></td>
                        <td className="border border-slate-300 p-1"><input value={med.dosage} onChange={e => {
                          const newList = [...formData.medicationsAdministered]
                          newList[idx].dosage = e.target.value
                          handleInputChange('medicationsAdministered', newList)
                        }} className="w-full px-1" /></td>
                        <td className="border border-slate-300 p-1"><input value={med.frequency} onChange={e => {
                          const newList = [...formData.medicationsAdministered]
                          newList[idx].frequency = e.target.value
                          handleInputChange('medicationsAdministered', newList)
                        }} className="w-full px-1" /></td>
                        <td className="border border-slate-300 p-1"><input value={med.duration} onChange={e => {
                          const newList = [...formData.medicationsAdministered]
                          newList[idx].duration = e.target.value
                          handleInputChange('medicationsAdministered', newList)
                        }} className="w-full px-1" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button onClick={() => handleInputChange('medicationsAdministered', [...formData.medicationsAdministered, { name: '', dosage: '', frequency: '', duration: '' }])} className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 print:hidden">+ Add Row</button>
              </div>

              <div className="mb-4">
                <h3 className="font-bold text-sm mb-2 border-b border-slate-300 pb-1">Other Procedures/Treatments Performed:</h3>
                <div className="space-y-1 text-xs">
                  <div className="grid grid-cols-2 gap-2"><span className="font-semibold">Deworming:</span><input value={formData.otherProcedures.deworming} onChange={e => handleInputChange('otherProcedures', {...formData.otherProcedures, deworming: e.target.value})} className="border-b border-slate-300 px-1" /></div>
                  <div className="grid grid-cols-2 gap-2"><span className="font-semibold">Vaccination:</span><input value={formData.otherProcedures.vaccination} onChange={e => handleInputChange('otherProcedures', {...formData.otherProcedures, vaccination: e.target.value})} className="border-b border-slate-300 px-1" /></div>
                  <div className="grid grid-cols-2 gap-2"><span className="font-semibold">Test:</span><input value={formData.otherProcedures.test} onChange={e => handleInputChange('otherProcedures', {...formData.otherProcedures, test: e.target.value})} className="border-b border-slate-300 px-1" /></div>
                </div>
              </div>

              <div className="mb-4">
                <h3 className="font-bold text-sm mb-2 border-b border-slate-300 pb-1">Condition at Discharge:</h3>
                <div className="space-y-1 text-xs">
                  <div className="grid grid-cols-2 gap-2"><span className="font-semibold">General Condition:</span><input value={formData.generalCondition} onChange={e => handleInputChange('generalCondition', e.target.value)} className="border-b border-slate-300 px-1" /></div>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="flex gap-1"><span className="font-semibold">Weight:</span><input value={formData.weightDischarge} onChange={e => handleInputChange('weightDischarge', e.target.value)} className="flex-1 border-b border-slate-300 px-1" /></div>
                    <div className="flex gap-1"><span className="font-semibold">Body Temperature:</span><input value={formData.bodyTemperature} onChange={e => handleInputChange('bodyTemperature', e.target.value)} className="flex-1 border-b border-slate-300 px-1" /></div>
                    <div className="flex gap-1"><span className="font-semibold">Heart Rate:</span><input value={formData.heartRate} onChange={e => handleInputChange('heartRate', e.target.value)} className="flex-1 border-b border-slate-300 px-1" /></div>
                    <div className="flex gap-1"><span className="font-semibold">Respiratory Rate:</span><input value={formData.respiratoryRate} onChange={e => handleInputChange('respiratoryRate', e.target.value)} className="flex-1 border-b border-slate-300 px-1" /></div>
                  </div>
                  <div className="flex gap-2"><span className="font-semibold">Other Vitals Signs:</span><input value={formData.otherVitalSigns} onChange={e => handleInputChange('otherVitalSigns', e.target.value)} className="flex-1 border-b border-slate-300 px-1" /></div>
                </div>
              </div>

              <div className="mb-4">
                <h3 className="font-bold text-sm mb-2 border-b border-slate-300 pb-1">Post-Discharge Care Instructions:</h3>
                <p className="font-semibold text-xs mb-2">1. Medication at Home:</p>
                <table className="w-full border border-slate-300 text-xs mb-3">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="border border-slate-300 p-1">Medication Name</th>
                      <th className="border border-slate-300 p-1">Dosage</th>
                      <th className="border border-slate-300 p-1">Frequency</th>
                      <th className="border border-slate-300 p-1">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.medicationsAtHome.map((med, idx) => (
                      <tr key={idx}>
                        <td className="border border-slate-300 p-1"><input value={med.name} onChange={e => {
                          const newList = [...formData.medicationsAtHome]
                          newList[idx].name = e.target.value
                          handleInputChange('medicationsAtHome', newList)
                        }} className="w-full px-1" /></td>
                        <td className="border border-slate-300 p-1"><input value={med.dosage} onChange={e => {
                          const newList = [...formData.medicationsAtHome]
                          newList[idx].dosage = e.target.value
                          handleInputChange('medicationsAtHome', newList)
                        }} className="w-full px-1" /></td>
                        <td className="border border-slate-300 p-1"><input value={med.frequency} onChange={e => {
                          const newList = [...formData.medicationsAtHome]
                          newList[idx].frequency = e.target.value
                          handleInputChange('medicationsAtHome', newList)
                        }} className="w-full px-1" /></td>
                        <td className="border border-slate-300 p-1"><input value={med.duration} onChange={e => {
                          const newList = [...formData.medicationsAtHome]
                          newList[idx].duration = e.target.value
                          handleInputChange('medicationsAtHome', newList)
                        }} className="w-full px-1" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button onClick={() => handleInputChange('medicationsAtHome', [...formData.medicationsAtHome, { name: '', dosage: '', frequency: '', duration: '' }])} className="mb-3 px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 print:hidden">+ Add Row</button>
                
                <p className="font-semibold text-xs mb-1">Special Instructions for Attendant:</p>
                <textarea value={formData.specialInstructionsAttendant} onChange={e => handleInputChange('specialInstructionsAttendant', e.target.value)} className="w-full border border-slate-300 rounded p-2 text-xs mb-3" rows="3" />
                
                <p className="font-semibold text-xs mb-1">2. Dietary Instructions:</p>
                <div className="space-y-1 text-xs mb-3">
                  <div className="flex gap-2"><span className="font-semibold">Food Type/Brand:</span><input value={formData.dietaryInstructions.foodType} onChange={e => handleInputChange('dietaryInstructions', {...formData.dietaryInstructions, foodType: e.target.value})} className="flex-1 border-b border-slate-300 px-1" /></div>
                  <div className="flex gap-2"><span className="font-semibold">Feeding Schedule:</span><input value={formData.dietaryInstructions.feedingSchedule} onChange={e => handleInputChange('dietaryInstructions', {...formData.dietaryInstructions, feedingSchedule: e.target.value})} className="flex-1 border-b border-slate-300 px-1" /></div>
                  <div className="flex gap-2"><span className="font-semibold">Special Dietary Restrictions or Supplements:</span><input value={formData.dietaryInstructions.specialRestrictions} onChange={e => handleInputChange('dietaryInstructions', {...formData.dietaryInstructions, specialRestrictions: e.target.value})} className="flex-1 border-b border-slate-300 px-1" /></div>
                </div>

                <p className="font-semibold text-xs mb-1">3. Activity Instruction:</p>
                <div className="space-y-1 text-xs mb-3">
                  <div className="flex gap-2"><span className="font-semibold">Exercise/ Movement:</span><input value={formData.activityInstructions.exercise} onChange={e => handleInputChange('activityInstructions', {...formData.activityInstructions, exercise: e.target.value})} className="flex-1 border-b border-slate-300 px-1" /></div>
                  <div className="flex gap-2"><span className="font-semibold">Other Restrictions (if any):</span><input value={formData.activityInstructions.otherRestrictions} onChange={e => handleInputChange('activityInstructions', {...formData.activityInstructions, otherRestrictions: e.target.value})} className="flex-1 border-b border-slate-300 px-1" /></div>
                </div>

                <p className="font-semibold text-xs mb-1">4. Wound/Incision Care (if applicable):</p>
                <div className="space-y-1 text-xs">
                  <div className="flex gap-2"><span className="font-semibold">Instructions for Cleaning/Care:</span><input value={formData.woundCare.instructions} onChange={e => handleInputChange('woundCare', {...formData.woundCare, instructions: e.target.value})} className="flex-1 border-b border-slate-300 px-1" /></div>
                  <div className="flex gap-2"><span className="font-semibold">Monitor for Signs of Infection:</span><input value={formData.woundCare.monitorInfection} onChange={e => handleInputChange('woundCare', {...formData.woundCare, monitorInfection: e.target.value})} className="flex-1 border-b border-slate-300 px-1" /></div>
                </div>
              </div>

              <div className="mb-4">
                <h3 className="font-bold text-sm mb-2 border-b border-slate-300 pb-1">5. Follow-Up Appointments:</h3>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="flex gap-2"><span className="font-semibold">Date of Next Appointment:</span><input value={formData.followUpDate} onChange={e => handleInputChange('followUpDate', e.target.value)} className="flex-1 border-b border-slate-300 px-1" /></div>
                  <div className="flex gap-2"><span className="font-semibold">Reason for Follow-Up:</span><input value={formData.followUpReason} onChange={e => handleInputChange('followUpReason', e.target.value)} className="flex-1 border-b border-slate-300 px-1" /></div>
                </div>
              </div>

              <div className="mb-4">
                <h3 className="font-bold text-sm mb-2 border-b border-slate-300 pb-1">Signs to Watch for at Home:</h3>
                <p className="text-xs mb-2">Please monitor your pet closely for the following signs, which may require immediate veterinary attention</p>
                <div className="grid grid-cols-2 gap-1 text-xs mb-2">
                  <label className="flex items-center gap-1"><input type="checkbox" checked={formData.signsToWatch.vomiting} onChange={e => handleInputChange('signsToWatch', {...formData.signsToWatch, vomiting: e.target.checked})} className="w-3 h-3" /><span>● Vomiting or diarrhea</span></label>
                  <label className="flex items-center gap-1"><input type="checkbox" checked={formData.signsToWatch.refusalToEat} onChange={e => handleInputChange('signsToWatch', {...formData.signsToWatch, refusalToEat: e.target.checked})} className="w-3 h-3" /><span>● Refusal to eat or drink</span></label>
                  <label className="flex items-center gap-1"><input type="checkbox" checked={formData.signsToWatch.difficultyBreathing} onChange={e => handleInputChange('signsToWatch', {...formData.signsToWatch, difficultyBreathing: e.target.checked})} className="w-3 h-3" /><span>● Difficulty breathing</span></label>
                  <label className="flex items-center gap-1"><input type="checkbox" checked={formData.signsToWatch.lethargy} onChange={e => handleInputChange('signsToWatch', {...formData.signsToWatch, lethargy: e.target.checked})} className="w-3 h-3" /><span>● Lethargy or weakness</span></label>
                  <label className="flex items-center gap-1"><input type="checkbox" checked={formData.signsToWatch.lameness} onChange={e => handleInputChange('signsToWatch', {...formData.signsToWatch, lameness: e.target.checked})} className="w-3 h-3" /><span>● Lameness or difficulty walking</span></label>
                  <label className="flex items-center gap-1"><input type="checkbox" checked={formData.signsToWatch.coughing} onChange={e => handleInputChange('signsToWatch', {...formData.signsToWatch, coughing: e.target.checked})} className="w-3 h-3" /><span>● Persistent coughing or sneezing</span></label>
                  <label className="flex items-center gap-1"><input type="checkbox" checked={formData.signsToWatch.swelling} onChange={e => handleInputChange('signsToWatch', {...formData.signsToWatch, swelling: e.target.checked})} className="w-3 h-3" /><span>● Excessive swelling or redness or discharge from wounds/incisions</span></label>
                </div>
                <div className="flex gap-2 text-xs"><span className="font-semibold">● Other (specify):</span><input value={formData.signsToWatch.other} onChange={e => handleInputChange('signsToWatch', {...formData.signsToWatch, other: e.target.value})} className="flex-1 border-b border-slate-300 px-1" /></div>
                <p className="text-xs mt-2 italic">If you notice any of these symptoms, contact the clinic immediately.</p>
              </div>

              <div className="mb-4 border-t-2 border-slate-300 pt-3">
                <div className="grid grid-cols-2 gap-6 text-xs mb-3">
                  <div><div className="flex items-end gap-2"><span className="font-semibold">Doctor's Signature:</span><div className="flex-1 border-b-2 border-slate-800 h-6"></div></div></div>
                  <div><div className="flex items-end gap-2"><span className="font-semibold">Date:</span><div className="flex-1 border-b-2 border-slate-800 h-6"></div></div></div>
                </div>
              </div>

              <div className="mb-4 border-t-2 border-slate-300 pt-3">
                <h3 className="font-bold text-sm mb-2">For {hospital.name} Record: (To be attached with the Content)</h3>
                <div className="grid grid-cols-2 gap-6 mb-3">
                  <div>
                    <h4 className="font-bold text-xs mb-2 border-b border-slate-300 pb-1">Pet Information:</h4>
                    <div className="space-y-1 text-xs">
                      <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Patient ID:</span><span className="text-green-600 font-semibold">{formData.patientId}</span></div>
                      <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Pet Name:</span><span>{formData.animalName}</span></div>
                      <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Species:</span><span>{formData.species}</span></div>
                      <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Age:</span><span>{formData.age}</span></div>
                      <div className="grid grid-cols-2 gap-1"><span className="font-semibold">B. Wt(kg):</span><span className="text-red-600 font-semibold">{formData.bodyWeight}</span></div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-bold text-xs mb-2 border-b border-slate-300 pb-1">Owner Details</h4>
                    <div className="space-y-1 text-xs">
                      <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Client ID:</span><span>{formData.clientId}</span></div>
                      <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Name:</span><span className="text-red-600 font-semibold">{formData.ownerName}</span></div>
                      <div className="grid grid-cols-2 gap-1"><span className="font-semibold">CNIC # of Owner:</span><span className="text-red-600 font-semibold">{formData.cnicOwner}</span></div>
                      <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Contact # of Owner/Guardian:</span><span className="text-red-600 font-semibold">{formData.contactOwnerGuardian}</span></div>
                      <div className="grid grid-cols-2 gap-1"><span className="font-semibold">Home Address:</span><span className="text-red-600 font-semibold">{formData.homeAddress}</span></div>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 p-3 rounded border border-slate-200 text-xs mb-3">
                  <p className="font-semibold mb-2">Owner Acknowledgement:</p>
                  <p>I acknowledge that I have received and understood the discharge instructions provided by <span className="font-bold">{hospital.name}</span>. I understand the importance of following the prescribed medication and care instructions and will ensure that my pet receives appropriate care at home. I will follow up with the clinic as advised.</p>
                </div>
                <div className="grid grid-cols-2 gap-6 text-xs">
                  <div><div className="flex items-end gap-2"><span className="font-semibold">Owner's Signature:</span><div className="flex-1 border-b-2 border-slate-800 h-6"></div></div></div>
                  <div><div className="flex items-end gap-2"><span className="font-semibold">Date:</span><div className="flex-1 border-b-2 border-slate-800 h-6"></div></div></div>
                </div>
              </div>
            </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
