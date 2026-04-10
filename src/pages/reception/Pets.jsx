import React, { useEffect, useMemo, useRef, useState } from 'react'
import { FiSearch, FiUserPlus, FiHeart, FiStar, FiActivity, FiCalendar, FiUser, FiShield, FiBell, FiUpload } from 'react-icons/fi'
import { useActivity } from '../../context/ActivityContext'
import { useSettings } from '../../context/SettingsContext'
import { petsAPI, taxonomyAPI, doctorProfileAPI, pharmacySalesAPI, proceduresAPI, pharmacyDuesAPI, fullRecordAPI, financialSummaryAPI, backupAPI } from '../../services/api'
import DateRangePicker from '../../components/DateRangePicker'
import * as XLSX from 'xlsx'

const TYPE_TO_SPECIES = {
  Dog: 'Canis lupus familiaris',
  Cat: 'Felis catus',
  Chicken: 'Gallus gallus domesticus',
  Goat: 'Capra hircus',
  Rabbit: 'Oryctolagus cuniculus',
  Sheep: 'Ovis aries',
  Cow: 'Bos taurus',
  Horse: 'Equus caballus',
  Donkey: 'Equus asinus',
  Parrot: 'Psittaciformes',
  Pigeon: 'Columbinae',
  Peacock: 'Pavo cristatus',
  Turkey: 'Meleagris',
  Quail: 'Coturnix coturnix'
}

const BREEDS = {
  Dog: ['German Shepherd','Labrador Retriever','Rottweiler','Golden Retriever','Poodle','Bulldog','Siberian Husky','Pug','Beagle'],
  Cat: ['Persian','Siamese','Maine Coon','Bengal','British Shorthair','Ragdoll','Sphynx'],
  Chicken: ['Rhode Island Red','Leghorn','Silkie','Plymouth Rock'],
  Rabbit: ['Netherland Dwarf','Lionhead','Rex'],
  Parrot: ['African Grey','Budgerigar','Macaw','Cockatiel'],
  Pigeon: ['Homing Pigeon','King Pigeon'],
  Horse: ['Arabian','Thoroughbred','Quarter Horse'],
  Cow: ['Holstein Friesian','Jersey','Sahiwal'],
  Sheep: ['Merino','Dorper'],
  Goat: ['Boer','Beetal','Kamori']
}

const getBreedOptionsForType = (type, custom = {}) => {
  const base = BREEDS[type] || []
  const extra = Array.isArray(custom?.[type]) ? custom[type] : []
  const merged = Array.from(new Set([...extra, ...base]))
  return [...merged, 'Non-Descript', 'Mixed Breed']
}

// Helper to compute next due date based on shot stage
const calcNextDue = (dateStr, stage) => {
  if(!dateStr || !stage) return ''
  const dt = new Date(dateStr)
  const days = ['1st','2nd','3rd'].includes(stage) ? 21 : 365
  dt.setDate(dt.getDate() + days)
  return dt.toISOString().slice(0,10)
}

const calcDewormingNext = (dateStr, daysVal) => {
  if (!dateStr) return ''
  try {
    const dt = new Date(dateStr)
    const d = Number(daysVal || 90)
    const add = Number.isFinite(d) ? d : 90
    dt.setDate(dt.getDate() + add)
    return dt.toISOString().slice(0,10)
  } catch { return '' }
}

const toISODate = (value) => {
  if (!value) return ''
  if (typeof value === 'string') {
    if (value.length >= 10) return value.slice(0,10)
    try { return new Date(value).toISOString().slice(0,10) } catch { return '' }
  }
  try {
    return new Date(value).toISOString().slice(0,10)
  } catch {
    return ''
  }
}

const formatLocalDate = (value) => {
  if (!value) return ''
  try {
    const normalized = value.length <= 10 ? `${value}T00:00:00` : value
    return new Date(normalized).toLocaleDateString()
  } catch {
    return value
  }
}

const toNum = (v) => {
  if (v == null) return 0
  const n = typeof v === 'string' ? Number(v.replace(/,/g, '')) : Number(v)
  return Number.isNaN(n) ? 0 : n
}

const calcAgeParts = (dobStr, refDate = new Date()) => {
  try {
    if (!dobStr) return null
    const dob = new Date(dobStr)
    const t = new Date(refDate)
    if (isNaN(dob.getTime())) return null
    t.setHours(0,0,0,0)
    dob.setHours(0,0,0,0)
    let y = t.getFullYear() - dob.getFullYear()
    let m = t.getMonth() - dob.getMonth()
    let d = t.getDate() - dob.getDate()
    if (d < 0) {
      const daysInPrevMonth = new Date(t.getFullYear(), t.getMonth(), 0).getDate()
      d += daysInPrevMonth
      m -= 1
    }
    if (m < 0) { m += 12; y -= 1 }
    if (y < 0) return { y: 0, m: 0, d: 0 }
    return { y, m, d }
  } catch { return null }
}

const formatAgeYMD = (parts) => {
  if (!parts) return ''
  const out = []
  if (parts.y > 0) out.push(parts.y + 'Y')
  if (parts.m > 0) out.push(parts.m + 'M')
  if (parts.d > 0 || out.length === 0) out.push(parts.d + 'D')
  return out.join(' ')
}

const ageFromDOB = (dobStr) => {
  const p = calcAgeParts(dobStr)
  return formatAgeYMD(p)
}

const dobFromAgeText = (text, refDate = new Date()) => {
  if (!text) return ''
  const s = String(text).toLowerCase().replace(/\//g,' ')
  let y=0,m=0,d=0
  const re = /(\d+)\s*(years?|year|y|months?|month|m|weeks?|week|w|days?|day|d)/g
  let match
  while ((match = re.exec(s))) {
    const n = parseInt(match[1], 10)
    const u = match[2][0]
    if (u === 'y') y += n
    else if (u === 'm') m += n
    else if (u === 'w') d += n * 7
    else if (u === 'd') d += n
  }
  if (y===0 && m===0 && d===0) {
    const parts = s.split(/\s+/).filter(Boolean)
    if (parts.length === 3 && parts.every(p=>/^\d+$/.test(p))) {
      y = parseInt(parts[0],10); m = parseInt(parts[1],10); d = parseInt(parts[2],10)
    }
  }
  const ref = new Date(refDate)
  ref.setHours(0,0,0,0)
  const dob = new Date(ref)
  dob.setFullYear(dob.getFullYear() - y)
  dob.setMonth(dob.getMonth() - m)
  dob.setDate(dob.getDate() - d)
  return dob.toISOString().slice(0,10)
}

// Helper to generate a Client ID
const makeClientId = () => `CL-${Date.now()}`

export default function ReceptionPets(){
  const receptionAuth = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('reception_auth')||'{}') } catch { return {} }
  }, [])
  const { settings, save: saveSettings } = useSettings()
  const hospital = useMemo(() => ({
    name: settings.companyName || 'Pets Hospital',
    tagline: settings.billingFooter || 'Professional Pet Care & Veterinary Services',
    address: settings.address || '—',
    phone: settings.phone || '—',
    email: settings.email || '—',
    website: settings.website || '',
    logo: settings.companyLogo || ''
  }), [settings])

  const initialForm = {
    owner: {
      clientId: '',
      ownerId: '',
      fullName: '',
      nic: '',
      contact: '',
      email: '',
      address: '',
      emergencyContactPerson: '',
      emergencyContactNumber: ''
    },
    pet: {
      petId: '',
      petName: '',
      type: '',
      species: '',
      breed: '',
      gender: '',
      dateOfBirth: '',
      approxAge: '',
      colorMarkings: '',
      microchipTag: '',
      neuteredSpayed: '',
      vaccinationStatus: '',
      dewormingStatus: ''
    },
    medical: {
      allergies: '',
      chronicDiseases: '',
      previousSurgeries: '',
      regularMedications: '',
      dietaryHabits: '',
      temperamentNotes: ''
    },
    vaccines: [
      { name: 'Rabies', dateGiven: '', nextDue: '', vet: '', shotStage: '' },
      { name: 'DHPP/L • FVRCP', dateGiven: '', nextDue: '', vet: '', shotStage: '' },
      { name: 'Others', dateGiven: '', nextDue: '', vet: '', shotStage: '' },
    ],
    deworming: { name: 'Deworming', dateGiven: '', nextDue: '', vet: '', days: 90 },
    complaint: { visitType: 'Emergency', chiefComplaint: '' },
    clinic: {
      dateOfRegistration: new Date().toISOString().slice(0,10),
      registeredBy: receptionAuth?.username || 'Reception',
      consultingVet: '',
      recordEntered: 'Yes',
      remarks: '',
      consultantFees: ''
    },
    life: { dead: false, deathDate: '', deathNote: '' }
  }
  const [form, setForm] = useState(initialForm)
  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState('create') // create | view | edit
  const [currentId, setCurrentId] = useState('')
  const [query, setQuery] = useState('')
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [receipt, setReceipt] = useState(null)
  const { addActivity } = useActivity()

  const [rows, setRows] = useState([])
  const [owners, setOwners] = useState([])
  const [doctors, setDoctors] = useState([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [rowToDelete, setRowToDelete] = useState(null)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [clientIdValidation, setClientIdValidation] = useState({ isValidating: false, error: '', isValid: true })
  const [payLoading, setPayLoading] = useState(false)
  const [payError, setPayError] = useState('')
  const [paymentSummary, setPaymentSummary] = useState({ due: 0, totalBilled: 0, totalReceived: 0, totalPending: 0, lastPayment: null, consultant: { paidBefore: false, amount: 0, date: '' }, modules: {}, pets: [], entries: [] })
  const [dateRange, setDateRange] = useState({
    fromDate: '1900-01-01',
    toDate: '2999-12-31'
  })
  const [showAll, setShowAll] = useState(true)
  const [taxonomy, setTaxonomy] = useState([])
  const [taxLoading, setTaxLoading] = useState(false)
  const [taxonomyDialog, setTaxonomyDialog] = useState({
    open: false,
    type: 'name',
    commonName: '',
    speciesName: '',
    error: ''
  })
  const [manageTaxonomy, setManageTaxonomy] = useState({ open: false, items: [], newCommonName: '', newSpeciesName: '', error: '' })
  const [customBreeds, setCustomBreeds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('custom_breeds')||'{}') } catch { return {} }
  })
  const [breedDialog, setBreedDialog] = useState({ open: false, typeName: '', breedName: '', error: '' })
  const [manageBreeds, setManageBreeds] = useState({ open: false, typeName: '', items: [], newItem: '', error: '' })
  const [genderOptions, setGenderOptions] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pet_gender_options')||'["Male","Female"]') } catch { return ['Male','Female'] }
  })
  const [neuteredSpayedOptions, setNeuteredSpayedOptions] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pet_neutered_spayed_options')||'["Yes","No"]') } catch { return ['Yes','No'] }
  })
  const [vaccinationStatusOptions, setVaccinationStatusOptions] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pet_vaccination_status_options')||'["Up to date","Due"]') } catch { return ['Up to date','Due'] }
  })
  const [dewormingStatusOptions, setDewormingStatusOptions] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pet_deworming_status_options')||'["Up to date","Due"]') } catch { return ['Up to date','Due'] }
  })
  const [manageList, setManageList] = useState({ open: false, key: '', title: '', items: [], newItem: '', error: '' })
  const [vaccineItems, setVaccineItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('vaccine_items')||'["Rabies","DHPP/L • FVRCP","Others"]') } catch { return ['Rabies','DHPP/L • FVRCP','Others'] }
  })
  const [dewormItems, setDewormItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('deworm_items')||'["Albendazole","Mebendazole","Pyrantel Pamoate","Fenbendazole","Ivermectin","Deworming"]') } catch { return ['Albendazole','Mebendazole','Pyrantel Pamoate','Fenbendazole','Ivermectin','Deworming'] }
  })
  const [openVaccIndex, setOpenVaccIndex] = useState(-1)
  const [openDeworm, setOpenDeworm] = useState(false)
  const [quickAdd, setQuickAdd] = useState({ open:false, type:'', value:'', targetIndex:-1 })
  const [manageVaccines, setManageVaccines] = useState({ open:false, items:[], newItem:'', error:'' })
  const [manageDeworm, setManageDeworm] = useState({ open:false, items:[], newItem:'', error:'' })
  const [dismissedAlerts, setDismissedAlerts] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('dismissed_alerts')||'[]')) } catch { return new Set() }
  })
  const persistDismissed = (setObj) => { try { localStorage.setItem('dismissed_alerts', JSON.stringify(Array.from(setObj))) } catch {} }
  const dismissAlert = (key) => setDismissedAlerts(prev => { const next = new Set(prev); next.add(key); persistDismissed(next); return next })
  const upcomingVaccines = useMemo(() => {
    if (!rows?.length) return []
    const tomorrow = new Date(); tomorrow.setHours(0,0,0,0); tomorrow.setDate(tomorrow.getDate() + 1)
    const target = tomorrow.toISOString().slice(0,10)
    const alerts = []
    rows.forEach(row => {
      const vaccines = row?.details?.vaccines
      if (!Array.isArray(vaccines)) return
      const pid = row?.id || row?._id || row?.details?.pet?.petId
      vaccines.forEach(v => {
        const due = toISODate(v?.nextDue)
        if (!due || due !== target) return
        const key = `vax|${pid}|${String(v?.name||'').trim()}|${due}`
        if (dismissedAlerts.has(key)) return
        alerts.push({
          key,
          petId: pid,
          petName: v?.petName || row?.details?.pet?.petName || row?.petName || 'Unknown Pet',
          ownerName: row?.details?.owner?.fullName || row?.ownerName || '',
          vaccineName: v?.name || 'Vaccine',
          shotStage: v?.shotStage || '',
          dueDate: due
        })
      })
    })
    return alerts
  }, [rows, dismissedAlerts])

  const upcomingDeworm = useMemo(() => {
    if (!rows?.length) return []
    const tomorrow = new Date(); tomorrow.setHours(0,0,0,0); tomorrow.setDate(tomorrow.getDate() + 1)
    const target = tomorrow.toISOString().slice(0,10)
    const alerts = []
    rows.forEach(row => {
      const dew = row?.details?.deworming
      if (!dew) return
      const due = toISODate(dew?.nextDue)
      if (!due || due !== target) return
      const pid = row?.id || row?._id || row?.details?.pet?.petId
      const key = `dew|${pid}|${due}`
      if (dismissedAlerts.has(key)) return
      alerts.push({ key, petId: pid, petName: row?.details?.pet?.petName || row?.petName || 'Unknown Pet', ownerName: row?.details?.owner?.fullName || row?.ownerName || '', itemName: dew?.name || 'Deworming', dueDate: due })
    })
    return alerts
  }, [rows, dismissedAlerts])

  const matchedOwnerPets = useMemo(() => {
    try {
      const cid = (form?.owner?.clientId || form?.owner?.ownerId || '').trim()
      if (!cid) return []
      return (rows || []).filter(p => 
        (p.clientId && String(p.clientId).trim() === cid) ||
        (p.details?.owner?.clientId && String(p.details.owner.clientId).trim() === cid) ||
        (p.details?.owner?.ownerId && String(p.details.owner.ownerId).trim() === cid)
      )
    } catch { return [] }
  }, [rows, form.owner.clientId, form.owner.ownerId])

  const loadTaxonomy = async () => {
    try {
      setTaxLoading(true)
      // Try API first
      try {
        const res = await taxonomyAPI.getAll()
        const list = res.data || []
        if (Array.isArray(list) && list.length) {
          setTaxonomy(list)
          localStorage.setItem('taxonomy_list', JSON.stringify(list))
          return
        }
      } catch {}

      // Fallback to localStorage
      try {
        const stored = JSON.parse(localStorage.getItem('taxonomy_list')||'[]')
        if (Array.isArray(stored) && stored.length) {
          setTaxonomy(stored)
          return
        }
      } catch {}

      // Seed minimal defaults and upsert to API (best-effort)
      const defaults = [
        { commonName: 'Dog', speciesName: 'Canis lupus familiaris' },
        { commonName: 'Cat', speciesName: 'Felis catus' },
        { commonName: 'Goat', speciesName: 'Capra hircus' },
        { commonName: 'Rabbit', speciesName: 'Oryctolagus cuniculus' },
        { commonName: 'Sheep', speciesName: 'Ovis aries' },
        { commonName: 'Cow', speciesName: 'Bos taurus' },
        { commonName: 'Horse', speciesName: 'Equus caballus' },
        { commonName: 'Donkey', speciesName: 'Equus asinus' },
        { commonName: 'Chicken', speciesName: 'Gallus gallus domesticus' },
        { commonName: 'Turkey', speciesName: 'Meleagris' },
        { commonName: 'Parrot', speciesName: 'Psittaciformes' },
        { commonName: 'Pigeon', speciesName: 'Columbinae' },
        { commonName: 'Peacock', speciesName: 'Pavo cristatus' },
        { commonName: 'Common Myna', speciesName: 'Acridotheres tristis' },
        { commonName: 'Quail', speciesName: 'Coturnix coturnix' }
      ]
      setTaxonomy(defaults)
      localStorage.setItem('taxonomy_list', JSON.stringify(defaults))
      try {
        await Promise.all(defaults.map(d => taxonomyAPI.upsert(d.commonName, d.speciesName)))
      } catch {}
    } finally {
      setTaxLoading(false)
    }
  }

  // Load client financial summary (per-pet consultant status)
  const loadClientPayments = async (clientId, focusPetId = null) => {
    const cid = (clientId || '').trim()
    if (!cid) {
      setPaymentSummary({ due: 0, totalBilled: 0, totalReceived: 0, totalPending: 0, lastPayment: null, consultant: { paidBefore: false, amount: 0, date: '' }, modules: {}, pets: [], entries: [] })
      setPayError('')
      setPayLoading(false)
      return
    }
    try {
      setPayLoading(true)
      setPayError('')
      try {
        const res = await financialSummaryAPI.getByClient(cid)
        const data = res.data || {}
        const entries = Array.isArray(data.entries) ? data.entries : []
        const lastPaid = entries.find(e => toNum(e.received) > 0)
        const petsArr = Array.isArray(data.pets) ? data.pets : []
        let consultant = { paidBefore: false, amount: 0, date: '' }
        try {
          if (focusPetId) {
            const pid = String(focusPetId).trim()
            const perPet = petsArr.find(p => String(p.petId || p.id || p.patientId || '').trim() === pid)
            if (perPet && perPet.modules && perPet.modules.consultant) {
              const c = perPet.modules.consultant
              const paid = !!c.paid
              const amt = toNum(c.amount)
              const date = c.date || ''
              consultant = { paidBefore: paid, amount: paid ? amt : 0, date: paid ? date : '' }
            }
          }
        } catch {}
        setPaymentSummary({
          due: toNum(data.totals?.currentDue),
          totalBilled: toNum(data.totals?.totalBilled),
          totalReceived: toNum(data.totals?.totalReceived),
          totalPending: toNum(data.totals?.totalPending),
          lastPayment: lastPaid ? { date: lastPaid.date, amount: toNum(lastPaid.received), mode: lastPaid.mode, source: lastPaid.type } : null,
          consultant,
          modules: data.modules || {},
          pets: petsArr,
          entries
        })
        return
      } catch {}
      let sales = []
      let procs = []
      try {
        const s = await pharmacySalesAPI.getAll()
        sales = (s.data || []).filter(x => (x.clientId || '').trim() === cid)
      } catch {}
      try {
        try {
          const r = await proceduresAPI.getAll(`?clientId=${cid}`)
          procs = r.data || []
        } catch {
          const r = await proceduresAPI.getAll('')
          procs = (r.data || []).filter(x => (x.clientId || '').trim() === cid)
        }
      } catch {}

      const entries = []
      sales.forEach(s => {
        const subtotal = toNum(s.subtotal)
        const discount = toNum(s.discount)
        const grand = toNum(s.totalAmount ?? (subtotal - discount))
        const received = toNum(s.receivedAmount != null ? s.receivedAmount : grand)
        const pending = Math.max(0, grand - received)
        entries.push({
          id: s._id || s.id,
          type: 'Pharmacy',
          date: s.createdAt || s.when || new Date().toISOString(),
          amount: grand,
          received,
          pending,
          mode: s.paymentMethod || s.paymentMode || '—'
        })
      })
      procs.forEach(p => {
        const gt = toNum(p.grandTotal ?? (toNum(p.subtotal) + toNum(p.previousDues)))
        const received = (p.receivedAmount != null) ? toNum(p.receivedAmount) : (p.receivable != null ? Math.max(0, gt - toNum(p.receivable)) : 0)
        const pending = (p.receivable != null) ? toNum(p.receivable) : Math.max(0, gt - received)
        entries.push({
          id: p._id || p.id,
          type: 'Procedure',
          date: p.createdAt || p.when || new Date().toISOString(),
          amount: gt,
          received,
          pending,
          mode: p.paymentMethod || p.paymentMode || '—'
        })
      })
      entries.sort((a,b)=> new Date(b.date||0) - new Date(a.date||0))

      let due = 0
      try {
        const d = await pharmacyDuesAPI.getByClient(cid)
        due = toNum(d.previousDue || d.data?.previousDue || d.data?.totalDue)
      } catch {}

      const totalBilled = entries.reduce((sum,e)=> sum + toNum(e.amount), 0)
      const totalReceived = entries.reduce((sum,e)=> sum + toNum(e.received), 0)
      const totalPending = entries.reduce((sum,e)=> sum + Math.max(0, toNum(e.pending)), 0)
      const lastPaid = entries.find(e => toNum(e.received) > 0)

      // Build per-pet list from local rows (consultant defaults to Pending in fallback)
      const clientPets = (rows || []).filter(p =>
        (p.clientId && String(p.clientId).trim() === cid) ||
        (p.details?.owner?.clientId && String(p.details.owner.clientId).trim() === cid) ||
        (p.details?.owner?.ownerId && String(p.details.owner.ownerId).trim() === cid)
      )
      const petsList = clientPets.map(p => ({
        petId: p.id || p._id || p.details?.pet?.petId || '',
        petName: p.petName || p.details?.pet?.petName || '',
        modules: { consultant: { paid: false, amount: 0, date: '' } },
        totals: { received: 0, pending: 0 }
      }))
      const consultant = { paidBefore: false, amount: 0, date: '' }

      setPaymentSummary({
        due: due || totalPending,
        totalBilled,
        totalReceived,
        totalPending: due || totalPending,
        lastPayment: lastPaid ? { date: lastPaid.date, amount: toNum(lastPaid.received), mode: lastPaid.mode, source: lastPaid.type } : null,
        consultant,
        pets: petsList,
        entries
      })
    } catch (e) {
      setPayError(e?.message || 'Failed to load client payments')
    } finally {
      setPayLoading(false)
    }
  }

  useEffect(() => {
    const cid = (form.owner.clientId || form.owner.ownerId || '').trim()
    if (!cid) return
    const focusPetId = (currentId || form?.pet?.petId || '').toString()
    loadClientPayments(cid, focusPetId)
    // rows dependency ensures consultant fee status updates after pets load
  }, [form.owner.clientId, form.owner.ownerId, rows, currentId, form?.pet?.petId])

  // Real-time refresh of client payment summary on financial updates
  useEffect(() => {
    const refresh = () => {
      try {
        const cid = (form.owner.clientId || form.owner.ownerId || '').trim()
        const focusPetId = (currentId || form?.pet?.petId || '').toString()
        if (cid) loadClientPayments(cid, focusPetId)
      } catch {}
    }
    const onStorage = (e) => { try { if (e.key === 'financial_updated_at') refresh() } catch {} }
    window.addEventListener('financial-updated', refresh)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('financial-updated', refresh)
      window.removeEventListener('storage', onStorage)
    }
  }, [form.owner.clientId, form.owner.ownerId, currentId, form?.pet?.petId])

  const typeOptions = useMemo(() => {
    const fromTax = (taxonomy || []).map(t => t.commonName).filter(Boolean)
    const base = fromTax.length ? fromTax : Object.keys(TYPE_TO_SPECIES)
    const current = form?.pet?.type ? [form.pet.type] : []
    const merged = Array.from(new Set([...base, ...current].filter(Boolean)))
    return merged.sort()
  }, [taxonomy, form?.pet?.type])

  useEffect(() => {
    try {
      if (!manageBreeds.open) return
      const t = String(manageBreeds.typeName || '').trim()
      const items = Array.isArray(customBreeds?.[t]) ? customBreeds[t] : []
      setManageBreeds(prev => ({ ...prev, items: [...items] }))
    } catch {}
  }, [manageBreeds.open, manageBreeds.typeName])

  const speciesOptions = useMemo(() => {
    const base = Array.from(new Set((taxonomy||[]).map(t => t.speciesName))).sort()
    const current = form.pet?.species ? [form.pet.species] : []
    return Array.from(new Set([...current, ...base]))
  }, [taxonomy, form.pet.species])

  const breedOptions = useMemo(() => {
    return getBreedOptionsForType(form.pet.type, customBreeds)
  }, [form.pet.type, customBreeds])

  const doctorOptions = useMemo(() => {
    if (!Array.isArray(doctors)) return []
    return doctors
      .map(doc => doc?.name || doc?.username)
      .filter(Boolean)
      .sort()
  }, [doctors])

  // Keep doctors list in sync if Admin updates local cache
  useEffect(() => {
    const onStorage = (e) => {
      try {
        if (e.key === 'doctor_profiles') {
          const list = JSON.parse(e.newValue || '[]')
          if (Array.isArray(list)) setDoctors(list)
        }
      } catch {}
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Auto-fill Consultant Fee when a doctor is selected (editable afterwards)
  useEffect(() => {
    try {
      if (mode === 'view') return
      const sel = String(form?.clinic?.consultingVet || '').trim()
      if (!sel) return
      const doc = (doctors||[]).find(d => String(d?.name || d?.username || '').trim() === sel)
      const feeStr = doc && (doc.fee != null && doc.fee !== '') ? String(doc.fee) : ''
      if (feeStr && feeStr !== String(form?.clinic?.consultantFees || '')) {
        setForm(prev => ({ ...prev, clinic: { ...prev.clinic, consultantFees: feeStr } }))
      }
    } catch {}
  }, [form.clinic.consultingVet, doctors, mode])

  const loadDoctors = async () => {
    try {
      const res = await doctorProfileAPI.list?.()
      if (res?.data) {
        setDoctors(res.data)
        localStorage.setItem('doctor_profiles', JSON.stringify(res.data))
        return
      }
    } catch (err) {
      console.warn('Doctor load failed, using local cache', err)
    }

    try {
      const cached = JSON.parse(localStorage.getItem('doctor_profiles') || '[]')
      if (Array.isArray(cached)) setDoctors(cached)
    } catch {}
  }

  const upsertTaxonomy = async (commonName, speciesName) => {
    try {
      const res = await taxonomyAPI.upsert(commonName, speciesName)
      const saved = res.data || { commonName, speciesName }
      setTaxonomy(prev => {
        const other = prev.filter(t => t.commonName !== saved.commonName)
        const next = [...other, saved]
        localStorage.setItem('taxonomy_list', JSON.stringify(next))
        return next
      })
    } catch (e) {
      // Local fallback
      setTaxonomy(prev => {
        const other = prev.filter(t => t.commonName !== commonName)
        const next = [...other, { commonName, speciesName }]
        localStorage.setItem('taxonomy_list', JSON.stringify(next))
        return next
      })
    }
  }

  const openTaxonomyDialog = (type, initialCommonName = '') => {
    setTaxonomyDialog({
      open: true,
      type,
      commonName: initialCommonName,
      speciesName: '',
      error: ''
    })
  }

  const closeTaxonomyDialog = () => {
    setTaxonomyDialog(prev => ({ ...prev, open: false, error: '' }))
  }

  const handleTaxonomyDialogSubmit = async () => {
    const commonName = (taxonomyDialog.commonName || '').trim()
    const speciesName = (taxonomyDialog.speciesName || '').trim()
    if (!commonName || !speciesName) {
      setTaxonomyDialog(prev => ({ ...prev, error: 'Both fields are required.' }))
      return
    }
    await upsertTaxonomy(commonName, speciesName)
    if (taxonomyDialog.type === 'name') {
      updateSection('pet','petName', commonName)
      updateSection('pet','species', speciesName)
    } else {
      updateSection('pet','species', speciesName)
    }
    closeTaxonomyDialog()
  }

  const handlePetNameChange = (value) => {
    updateSection('pet','petName', value)
  }

  const handleSpeciesChange = (value) => {
    updateSection('pet','species', value)
  }

  const handleSpeciesSelectChange = (value) => {
    if (value === '__add_species__') {
      if (form.pet.type) {
        openTaxonomyDialog('species', form.pet.type)
      } else {
        openTaxonomyDialog('name')
      }
      return
    }
    if (value === '__manage_types__') {
      openManageTaxonomy()
      return
    }
    handleSpeciesChange(value)
  }

  const handleBreedChange = (value) => {
    if (value === '__add_breed__') {
      setBreedDialog({ open: true, typeName: form.pet.type || '', breedName: '', error: '' })
      return
    }
    if (value === '__manage_breeds__') {
      openManageBreeds(form.pet.type || '')
      return
    }
    updateSection('pet','breed', value)
  }

  const handleTypeChange = (value) => {
    if (value === '__add_new__') {
      openTaxonomyDialog('name')
      return
    }
    if (value === '__manage_types__') {
      openManageTaxonomy()
      return
    }
    updateSection('pet','type', value)
    const match = taxonomy.find(t => t.commonName === value)
    const species = match?.speciesName || TYPE_TO_SPECIES[value] || ''
    updateSection('pet','species', species)
    updateSection('pet','breed', '')
    if (species && value) {
      try { upsertTaxonomy(value, species) } catch {}
    }
  }

  const handleBreedDialogSubmit = async () => {
    const typeName = (breedDialog.typeName || '').trim()
    const breedName = (breedDialog.breedName || '').trim()
    if (!typeName || !breedName) {
      setBreedDialog(prev => ({ ...prev, error: 'Both fields are required.' }))
      return
    }
    const current = customBreeds || {}
    const list = Array.isArray(current?.[typeName]) ? current[typeName] : []
    const nextList = Array.from(new Set([...list, breedName])).sort()
    const next = { ...(current || {}), [typeName]: nextList }
    await saveBreedsMap(next)
    if (typeName !== form.pet.type) {
      handleTypeChange(typeName)
      setTimeout(() => { updateSection('pet','breed', breedName) }, 0)
    } else {
      updateSection('pet','breed', breedName)
    }
    setBreedDialog({ open: false, typeName: '', breedName: '', error: '' })
  }

  // Load pets and taxonomy from MongoDB on mount
  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('reception_pets')||'[]')
      if (Array.isArray(cached) && cached.length) setRows(cached)
    } catch {}
    loadPets()
    loadTaxonomy()
    loadDoctors()
    // Load owners for lookup (from localStorage)
    try {
      const storedOwners = JSON.parse(localStorage.getItem('reception_owners')||'[]')
      if (Array.isArray(storedOwners)) setOwners(storedOwners)
    } catch {}
  }, [])

  const loadPets = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await petsAPI.getAll()
      if (response && response.data) {
        setRows(response.data)
        // Backup to localStorage
        localStorage.setItem('reception_pets', JSON.stringify(response.data))
      }
    } catch (err) {
      console.error('Error loading pets:', err)
      setError('Failed to load pets')
      // Fallback to localStorage
      try {
        const stored = localStorage.getItem('reception_pets')
        if (stored) setRows(JSON.parse(stored))
      } catch (e) {}
    } finally {
      setLoading(false)
    }
  }

  // Persist owners when changed indirectly via submit
  const saveOwner = owner => {
    let list
    try { list = JSON.parse(localStorage.getItem('reception_owners')||'[]') } catch { list = [] }
    const existing = list.find(o => 
      (o.ownerId && o.ownerId===owner.ownerId) ||
      (o.clientId && o.clientId===owner.clientId) ||
      (o.nic && o.nic===owner.nic) ||
      (o.contact && o.contact===owner.contact)
    )
    list = existing ? list.map(o => (o.ownerId===existing.ownerId? owner : o)) : [{...owner}, ...list]
    localStorage.setItem('reception_owners', JSON.stringify(list))
  }

  // Nested updates
  const updateSection = (section, key, value) => {
    setForm(prev => ({ ...prev, [section]: { ...prev[section], [key]: value } }))
  }
  const savePetList = async (storageKey, settingKey, items, setter) => {
    const next = Array.from(new Set((items||[]).map(s=>String(s||'').trim()).filter(Boolean)))
    setter(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch {}
    try { await saveSettings({ customSettings: { ...(settings.customSettings||{}), [settingKey]: next } }) } catch {}
    return next
  }
  const saveBreedsMap = async (mapObj) => {
    const next = { ...(mapObj || {}) }
    Object.keys(next).forEach(k => {
      if (!Array.isArray(next[k])) next[k] = []
      next[k] = Array.from(new Set(next[k].map(s => String(s||'').trim()).filter(Boolean))).sort()
    })
    setCustomBreeds(next)
    try { localStorage.setItem('custom_breeds', JSON.stringify(next)) } catch {}
    try { await saveSettings({ customSettings: { ...(settings.customSettings||{}), customBreeds: next } }) } catch {}
    return next
  }
  const saveVaccineItems = async (items) => {
    const next = Array.from(new Set((items||[]).map(s=>String(s||'').trim()).filter(Boolean)))
    setVaccineItems(next)
    try { localStorage.setItem('vaccine_items', JSON.stringify(next)) } catch {}
    try { await saveSettings({ customSettings: { ...(settings.customSettings||{}), vaccineItems: next } }) } catch {}
  }
  const saveDewormItems = async (items) => {
    const next = Array.from(new Set((items||[]).map(s=>String(s||'').trim()).filter(Boolean)))
    setDewormItems(next)
    try { localStorage.setItem('deworm_items', JSON.stringify(next)) } catch {}
    try { await saveSettings({ customSettings: { ...(settings.customSettings||{}), dewormItems: next } }) } catch {}
  }
  const ensureVaccineItem = (name) => {
    const n = String(name||'').trim(); if(!n) return
    setVaccineItems(prev => { if (prev.includes(n)) return prev; const next=[...prev,n]; try{localStorage.setItem('vaccine_items', JSON.stringify(next))}catch{}; return next })
  }
  const ensureDewormItem = (name) => {
    const n = String(name||'').trim(); if(!n) return
    setDewormItems(prev => { if (prev.includes(n)) return prev; const next=[...prev,n]; try{localStorage.setItem('deworm_items', JSON.stringify(next))}catch{}; return next })
  }

  const openManageList = (key, title, items) => {
    setManageList({ open: true, key, title, items: [...(items || [])], newItem: '', error: '' })
  }
  const closeManageList = () => setManageList(prev => ({ ...prev, open: false, error: '' }))
  const addManageListItem = () => setManageList(prev => {
    const n = (prev.newItem || '').trim()
    if (!n) return prev
    const items = Array.from(new Set([...(prev.items || []), n]))
    return { ...prev, items, newItem: '' }
  })
  const removeManageListItem = (i) => setManageList(prev => ({ ...prev, items: prev.items.filter((_, idx) => idx !== i) }))
  const setManageListItem = (i, text) => setManageList(prev => ({ ...prev, items: prev.items.map((it, idx) => idx === i ? text : it) }))
  const saveManageList = async () => {
    const key = manageList.key
    if (key === 'genderOptions') {
      await savePetList('pet_gender_options', 'genderOptions', manageList.items, setGenderOptions)
    } else if (key === 'neuteredSpayedOptions') {
      await savePetList('pet_neutered_spayed_options', 'neuteredSpayedOptions', manageList.items, setNeuteredSpayedOptions)
    } else if (key === 'vaccinationStatusOptions') {
      await savePetList('pet_vaccination_status_options', 'vaccinationStatusOptions', manageList.items, setVaccinationStatusOptions)
    } else if (key === 'dewormingStatusOptions') {
      await savePetList('pet_deworming_status_options', 'dewormingStatusOptions', manageList.items, setDewormingStatusOptions)
    }
    closeManageList()
  }

  const openManageBreeds = (typeName) => {
    const t = String(typeName || form.pet.type || '').trim()
    const items = Array.isArray(customBreeds?.[t]) ? customBreeds[t] : []
    setManageBreeds({ open: true, typeName: t, items: [...items], newItem: '', error: '' })
  }
  const closeManageBreeds = () => setManageBreeds(prev => ({ ...prev, open: false, error: '' }))
  const addManageBreedItem = () => setManageBreeds(prev => {
    const n = (prev.newItem || '').trim()
    if (!n) return prev
    const items = Array.from(new Set([...(prev.items || []), n]))
    return { ...prev, items, newItem: '' }
  })
  const removeManageBreedItem = (i) => setManageBreeds(prev => ({ ...prev, items: prev.items.filter((_, idx) => idx !== i) }))
  const setManageBreedItem = (i, text) => setManageBreeds(prev => ({ ...prev, items: prev.items.map((it, idx) => idx === i ? text : it) }))
  const saveManageBreeds = async () => {
    const t = String(manageBreeds.typeName || '').trim()
    if (!t) { setManageBreeds(prev => ({ ...prev, error: 'Type is required.' })); return }
    const next = { ...(customBreeds || {}), [t]: (manageBreeds.items || []).map(x => String(x || '').trim()).filter(Boolean) }
    const saved = await saveBreedsMap(next)
    const selected = String(form.pet?.breed || '').trim()
    if (selected && !getBreedOptionsForType(t, saved).includes(selected)) {
      updateSection('pet', 'breed', '')
    }
    closeManageBreeds()
  }

  const openManageTaxonomy = () => {
    const items = (taxonomy || []).map(t => ({
      _id: t._id,
      commonName: t.commonName || '',
      speciesName: t.speciesName || '',
      originalCommonName: t.commonName || ''
    }))
    setManageTaxonomy({ open: true, items, newCommonName: '', newSpeciesName: '', error: '' })
  }
  const closeManageTaxonomy = () => setManageTaxonomy(prev => ({ ...prev, open: false, error: '' }))
  const setManageTaxonomyField = (i, field, value) => setManageTaxonomy(prev => ({
    ...prev,
    items: prev.items.map((it, idx) => idx === i ? { ...it, [field]: value } : it)
  }))
  const removeManageTaxonomyItem = (i) => setManageTaxonomy(prev => ({
    ...prev,
    items: prev.items.filter((_, idx) => idx !== i)
  }))
  const addManageTaxonomyItem = () => setManageTaxonomy(prev => {
    const commonName = (prev.newCommonName || '').trim()
    const speciesName = (prev.newSpeciesName || '').trim()
    if (!commonName || !speciesName) return { ...prev, error: 'Both fields are required.' }
    const items = [...prev.items, { _id: '', commonName, speciesName, originalCommonName: '' }]
    return { ...prev, items, newCommonName: '', newSpeciesName: '', error: '' }
  })
  const saveManageTaxonomy = async () => {
    const cleaned = manageTaxonomy.items
      .map(it => ({ ...it, commonName: (it.commonName || '').trim(), speciesName: (it.speciesName || '').trim() }))
      .filter(it => it.commonName && it.speciesName)

    const seen = new Set()
    for (const it of cleaned) {
      const k = it.commonName.toLowerCase()
      if (seen.has(k)) { setManageTaxonomy(prev => ({ ...prev, error: 'Duplicate Common Name found.' })); return }
      seen.add(k)
    }

    const originalByName = new Map((taxonomy || []).map(t => [String(t.commonName || '').trim(), t]))

    const newNames = new Set(cleaned.map(it => it.commonName))
    const removed = (taxonomy || []).filter(t => !newNames.has(String(t.commonName || '').trim()))
    await Promise.all(removed.map(async t => {
      try {
        if (t?._id) await taxonomyAPI.delete(t._id)
      } catch {}
    }))

    const renamedOldNames = cleaned
      .filter(it => it.originalCommonName && it.originalCommonName !== it.commonName)
      .map(it => it.originalCommonName)

    await Promise.all(renamedOldNames.map(async oldName => {
      const found = originalByName.get(oldName)
      try {
        if (found?._id) await taxonomyAPI.delete(found._id)
      } catch {}
    }))

    const savedList = await Promise.all(cleaned.map(async it => {
      try {
        const res = await taxonomyAPI.upsert(it.commonName, it.speciesName)
        return res?.data || { commonName: it.commonName, speciesName: it.speciesName }
      } catch {
        return { commonName: it.commonName, speciesName: it.speciesName }
      }
    }))

    setTaxonomy(savedList)
    try { localStorage.setItem('taxonomy_list', JSON.stringify(savedList)) } catch {}

    const selectedType = String(form.pet?.type || '').trim()
    if (selectedType && !savedList.some(t => String(t.commonName || '').trim() === selectedType)) {
      updateSection('pet', 'type', '')
      updateSection('pet', 'species', '')
      updateSection('pet', 'breed', '')
    } else if (selectedType) {
      const match = savedList.find(t => String(t.commonName || '').trim() === selectedType)
      const nextSpecies = String(match?.speciesName || '').trim()
      if (nextSpecies && String(form.pet?.species || '').trim() !== nextSpecies) {
        updateSection('pet', 'species', nextSpecies)
      }
    }
    closeManageTaxonomy()
  }
  const updateVaccine = (idx, field, value) => {
    setForm(prev => {
      const vaccines = [...prev.vaccines]
      const v = { ...vaccines[idx], [field]: value }
      if(field==='dateGiven' || field==='shotStage') {
        v.nextDue = calcNextDue(v.dateGiven, v.shotStage)
      }
      if(field==='name') { ensureVaccineItem(value) }
      vaccines[idx] = v
      return { ...prev, vaccines }
    })
  }

  // Update Deworming record (independent from vaccination logic)
  const updateDeworming = (field, value) => {
    setForm(prev => {
      const base = (prev.deworming || { name: 'Deworming', dateGiven: '', nextDue: '', vet: '', days: 90 })
      const next = { ...base, [field]: value }
      if (field === 'days') {
        const d = Number(value)
        next.days = Number.isFinite(d) && d>0 ? d : 90
        if (next.dateGiven) next.nextDue = calcDewormingNext(next.dateGiven, next.days)
      }
      if (field === 'dateGiven') {
        next.nextDue = calcDewormingNext(value, next.days)
      }
      if (field === 'name') { ensureDewormItem(value) }
      return { ...prev, deworming: next }
    })
  }

  const openManageVaccines = () => setManageVaccines({ open:true, items:[...vaccineItems], newItem:'', error:'' })
  const openManageDeworm = () => setManageDeworm({ open:true, items:[...dewormItems], newItem:'', error:'' })
  const closeManageVaccines = () => setManageVaccines(prev=>({ ...prev, open:false, error:'' }))
  const closeManageDeworm = () => setManageDeworm(prev=>({ ...prev, open:false, error:'' }))
  const addVaccineItem = () => setManageVaccines(prev=>{ const n=(prev.newItem||'').trim(); if(!n) return prev; const items=Array.from(new Set([...prev.items, n])); return { ...prev, items, newItem:'' } })
  const addDewormItem = () => setManageDeworm(prev=>{ const n=(prev.newItem||'').trim(); if(!n) return prev; const items=Array.from(new Set([...prev.items, n])); return { ...prev, items, newItem:'' } })
  const removeVaccineItem = (i) => setManageVaccines(prev=>({ ...prev, items: prev.items.filter((_,idx)=>idx!==i) }))
  const removeDewormItem = (i) => setManageDeworm(prev=>({ ...prev, items: prev.items.filter((_,idx)=>idx!==i) }))
  const setManageVaccineItem = (i, text) => setManageVaccines(prev=>({ ...prev, items: prev.items.map((it,idx)=> idx===i ? text : it) }))
  const setManageDewormItem = (i, text) => setManageDeworm(prev=>({ ...prev, items: prev.items.map((it,idx)=> idx===i ? text : it) }))
  const saveManageVaccines = () => { saveVaccineItems(manageVaccines.items); closeManageVaccines() }
  const saveManageDeworm = () => { saveDewormItems(manageDeworm.items); closeManageDeworm() }
  const handleVaccineSelect = (idx, value) => { if (value==='__add_vaccine__'){ openManageVaccines(); return } updateVaccine(idx,'name', value) }
  const handleDewormSelect = (value) => { if (value==='__add_deworm__'){ openManageDeworm(); return } updateDeworming('name', value) }

  // Sync lists from DB settings when available
  useEffect(() => {
    try {
      const s = settings?.customSettings || {}
      if (Array.isArray(s.vaccineItems) && s.vaccineItems.length) setVaccineItems(Array.from(new Set(s.vaccineItems)))
      if (Array.isArray(s.dewormItems) && s.dewormItems.length) setDewormItems(Array.from(new Set(s.dewormItems)))
      if (Array.isArray(s.genderOptions) && s.genderOptions.length) setGenderOptions(Array.from(new Set(s.genderOptions)))
      if (Array.isArray(s.neuteredSpayedOptions) && s.neuteredSpayedOptions.length) setNeuteredSpayedOptions(Array.from(new Set(s.neuteredSpayedOptions)))
      if (Array.isArray(s.vaccinationStatusOptions) && s.vaccinationStatusOptions.length) setVaccinationStatusOptions(Array.from(new Set(s.vaccinationStatusOptions)))
      if (Array.isArray(s.dewormingStatusOptions) && s.dewormingStatusOptions.length) setDewormingStatusOptions(Array.from(new Set(s.dewormingStatusOptions)))
      if (s.customBreeds && typeof s.customBreeds === 'object') setCustomBreeds(s.customBreeds)
    } catch {}
  }, [settings?.customSettings])

  const openQuickAdd = (type, targetIndex = -1, preset = '') => {
    setQuickAdd({ open:true, type, value:preset, targetIndex })
  }
  const saveQuickAdd = async () => {
    const name = (quickAdd.value||'').trim(); if(!name) { setQuickAdd(prev=>({ ...prev, open:false })); return }
    if (quickAdd.type === 'vaccine') {
      await saveVaccineItems([ ...vaccineItems, name ])
      if (quickAdd.targetIndex >= 0) updateVaccine(quickAdd.targetIndex, 'name', name)
      setOpenVaccIndex(-1)
    } else if (quickAdd.type === 'deworm') {
      await saveDewormItems([ ...dewormItems, name ])
      updateDeworming('name', name)
      setOpenDeworm(false)
    }
    setQuickAdd({ open:false, type:'', value:'', targetIndex:-1 })
  }

  // Auto-fill owner only if ID matches (clientId/ownerId)
  const tryOwnerLookup = (cidParam) => {
    const { ownerId, clientId } = form.owner
    const cid = cidParam || clientId || ownerId
    if (!cid) return
    const found = owners.find(o => (o.clientId===cid) || (o.ownerId===cid))
    if(found) { 
      setForm(prev => ({ ...prev, owner: { ...prev.owner, ...found } }))
      return
    }
    // Fallback: hydrate from existing pets in list
    const matchPet = rows.find(p => (p.clientId && p.clientId===cid) || (p.details?.owner?.clientId===cid) || (p.details?.owner?.ownerId===cid))
    if (matchPet) {
      const d = matchPet.details || {}
      const ow = d.owner || {}
      setForm(prev => ({
        ...prev,
        owner: {
          ...prev.owner,
          clientId: prev.owner.clientId || ow.clientId || cid,
          ownerId: prev.owner.ownerId || ow.ownerId || cid,
          fullName: prev.owner.fullName || ow.fullName || matchPet.ownerName || '',
          nic: prev.owner.nic || ow.nic || '',
          contact: prev.owner.contact || ow.contact || matchPet.ownerContact || '',
          email: prev.owner.email || ow.email || '',
          address: prev.owner.address || ow.address || matchPet.ownerAddress || '',
          emergencyContactPerson: prev.owner.emergencyContactPerson || ow.emergencyContactPerson || '',
          emergencyContactNumber: prev.owner.emergencyContactNumber || ow.emergencyContactNumber || ''
        }
      }))
    }
  }

  // Real-time Client ID validation
  const handleClientIdValidation = async (clientId) => {
    if (!clientId.trim()) {
      setClientIdValidation({ isValidating: false, error: '', isValid: true })
      return
    }

    setClientIdValidation({ isValidating: true, error: '', isValid: true })
    
    const validation = await validateClientId(clientId, mode === 'edit' ? currentId : null)
    setClientIdValidation({ 
      isValidating: false, 
      error: validation.isValid ? '' : validation.error,
      isValid: validation.isValid 
    })
  }

  // Validate Client ID uniqueness
  const validateClientId = async (clientId, excludeCurrentId = null) => {
    if (!clientId) return { isValid: true }
    
    try {
      // Check against existing pets in database
      const response = await petsAPI.getAll()
      const existingPets = response.data || []
      
      const duplicate = existingPets.find(pet => 
        pet.clientId === clientId && 
        pet.id !== excludeCurrentId && 
        pet._id !== excludeCurrentId
      )
      
      if (duplicate) {
        // Allow multiple pets under the same client; treat as valid
        return { isValid: true }
      }
      
      return { isValid: true }
    } catch (error) {
      console.error('Error validating Client ID:', error)
      return { isValid: true } // Allow submission if validation fails
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return
    
    try {
      setLoading(true)
      setError(null)
      
      const clientId = form.owner.clientId || form.owner.ownerId || `CL-${Date.now()}`
      
      // Validate Client ID uniqueness (skip for edit mode with same ID)
      const validation = await validateClientId(clientId, mode === 'edit' ? currentId : null)
      if (!validation.isValid) {
        setError(validation.error)
        setLoading(false)
        return
      }
      
      const ownerId = clientId
      const petId = form.pet.petId || `PET-${Date.now()}`
      const owner = { ...form.owner, ownerId, clientId }
      // Derive DOB from approxAge if DOB not provided
      const parseApproxAgeToDOB = (text) => {
        if (!text) return ''
        const s = String(text).trim().toLowerCase()
        const m = s.match(/(\d+)\s*(day|days|week|weeks|month|months|year|years)/)
        if (!m) return ''
        const n = parseInt(m[1], 10)
        const unit = m[2]
        const d = new Date()
        if (['day','days'].includes(unit)) d.setDate(d.getDate() - n)
        else if (['week','weeks'].includes(unit)) d.setDate(d.getDate() - n*7)
        else if (['month','months'].includes(unit)) d.setMonth(d.getMonth() - n)
        else if (['year','years'].includes(unit)) d.setFullYear(d.getFullYear() - n)
        return d.toISOString().slice(0,10)
      }
      const usingApprox = !!form.pet.approxAge
      const ageCapturedAt = usingApprox ? new Date().toISOString().slice(0,10) : ''
      const derivedDOB = (!form.pet.dateOfBirth && usingApprox) ? parseApproxAgeToDOB(form.pet.approxAge) : ''
      const pet = { 
        ...form.pet, 
        petId, 
        ownerId, 
        dateOfBirth: form.pet.dateOfBirth || derivedDOB 
      }
      
      const petData = {
        id: petId,
        clientId: clientId,
        petName: pet.petName,
        type: pet.type || 'Unknown',
        species: pet.species,
        breed: pet.breed || 'Non-Descript',
        age: pet.approxAge,
        ageCapturedAt: ageCapturedAt,
        dateOfBirth: pet.dateOfBirth,
        gender: pet.gender,
        ownerName: owner.fullName,
        ownerContact: owner.contact,
        ownerAddress: owner.address,
        details: {
          pet: {
            petId: petId,
            petName: pet.petName,
            type: pet.type || 'Unknown',
            species: pet.species,
            breed: pet.breed || 'Non-Descript',
            dateOfBirth: pet.dateOfBirth,
            dobOrAge: pet.approxAge,
            ageCapturedAt: ageCapturedAt,
            gender: pet.gender,
            colorMarkings: pet.colorMarkings,
            microchipTag: pet.microchipTag,
            vaccinationStatus: pet.vaccinationStatus,
            dewormingStatus: pet.dewormingStatus,
            neuteredSpayed: pet.neuteredSpayed
          },
          owner: {
            ownerId: owner.ownerId,
            clientId: owner.clientId,
            fullName: owner.fullName,
            nic: owner.nic,
            contact: owner.contact,
            email: owner.email,
            address: owner.address,
            emergencyContactPerson: owner.emergencyContactPerson,
            emergencyContactNumber: owner.emergencyContactNumber
          },
          medical: {
            allergies: form.medical.allergies,
            chronicDiseases: form.medical.chronicDiseases,
            previousSurgeries: form.medical.previousSurgeries,
            regularMedications: form.medical.regularMedications,
            dietaryHabits: form.medical.dietaryHabits,
            temperamentNotes: form.medical.temperamentNotes
          },
          vaccines: form.vaccines,
          deworming: form.deworming,
          complaint: {
            visitType: form.complaint.visitType,
            chiefComplaint: form.complaint.chiefComplaint
          },
          clinic: {
            dateOfRegistration: form.clinic.dateOfRegistration,
            registeredBy: form.clinic.registeredBy,
            consultingVet: form.clinic.consultingVet,
            remarks: form.clinic.remarks,
            consultantFees: form.clinic.consultantFees
          },
          life: {
            dead: !!form?.life?.dead,
            deathDate: form?.life?.deathDate || '',
            deathNote: form?.life?.deathNote || ''
          }
        },
        status: form?.life?.dead ? 'Expired' : 'Active',
        dateOfDeath: form?.life?.dead ? (form?.life?.deathDate || new Date().toISOString().slice(0,10)) : undefined,
        deathNote: form?.life?.dead ? (form?.life?.deathNote || '') : undefined
      }

      let savedPet
      if (mode === 'edit' && currentId) {
        // Update existing pet
        const response = await petsAPI.update(currentId, petData)
        savedPet = response.data
        setRows(prev => prev.map(r => (r.id === currentId || r._id === currentId) ? savedPet : r))
      } else {
        // Create new pet
        const response = await petsAPI.create(petData)
        savedPet = response.data
        setRows(prev => [savedPet, ...prev])
      }

      // Close dialog immediately
      setIsOpen(false)
      setForm(initialForm)
      setMode('create')
      setCurrentId('')
      
      // Save owner to localStorage for autocomplete
      saveOwner(owner)
      
      try { 
        addActivity({ 
          user: 'Reception', 
          text: `${mode === 'edit' ? 'Updated' : 'Registered'} pet: ${pet.petName}` 
        }) 
      } catch {}
      
      // Reload pets to ensure sync
      await loadPets()
    try {
      if (isOpen) {
        const cidNow = (form?.owner?.clientId || form?.owner?.ownerId || '').trim()
        const pidNow = (savedPet?.id || savedPet?._id || savedPet?.details?.pet?.petId || '').toString()
        if (cidNow) await loadClientPayments(cidNow, pidNow)
      }
    } catch {}
      
      try {
        const wasPaidBefore = !!paymentSummary?.consultant?.paidBefore
        const feeRaw = (petData?.details?.clinic?.consultantFees ?? savedPet?.details?.clinic?.consultantFees ?? savedPet?.consultantFees)
        const feeNum = (() => { const n = parseFloat(feeRaw); return Number.isFinite(n) ? n : 0 })()
        if (feeNum > 0 && !wasPaidBefore) {
          setReceipt(savedPet)
          setReceiptOpen(true)
        }
        try { localStorage.setItem('financial_updated_at', String(Date.now())); window.dispatchEvent(new Event('financial-updated')) } catch {}
      } catch {}
      
    } catch (err) {
      console.error('Error saving pet:', err)
      setError(err.message || 'Failed to save pet')
    } finally {
      setLoading(false)
    }
  }

  const isDateInRange = (dateStr) => {
    if (showAll) return true
    if (!dateStr) return false
    const d = new Date(dateStr).toISOString().slice(0,10)
    return d >= dateRange.fromDate && d <= dateRange.toDate
  }

  const filtered = useMemo(() => {
    const s = query.trim().toLowerCase()
    return rows.filter(r => {
      const d = r.details || {}
      const owner = d.owner || {}
      const pet = d.pet || {}
      const matchesSearch = !s || [
        r.petName,
        r.ownerName,
        r.type,
        r.breed,
        r.ownerContact,
        r.clientId,
        r.id,
        owner.ownerId,
        owner.clientId,
        owner.fullName,
        owner.contact,
        pet.petId,
        pet.petName
      ].some(v => String(v||'').toLowerCase().includes(s))
      const dateField = d.clinic?.dateOfRegistration || r.createdAt || r.when
      const matchesDate = showAll ? true : isDateInRange(dateField)
      return matchesSearch && (s ? true : matchesDate)
    })
  }, [rows, query, dateRange.fromDate, dateRange.toDate, showAll])

  useEffect(() => {
    setPage(1)
  }, [query, pageSize, dateRange.fromDate, dateRange.toDate, showAll])

  const totalPages = useMemo(() => {
    const ps = Number(pageSize) || 10
    return Math.max(1, Math.ceil((filtered?.length || 0) / ps))
  }, [filtered, pageSize])

  const pagedPets = useMemo(() => {
    const ps = Number(pageSize) || 10
    const p = Math.min(Math.max(1, Number(page) || 1), totalPages)
    const start = (p - 1) * ps
    return (filtered || []).slice(start, start + ps)
  }, [filtered, page, pageSize, totalPages])

  const csvEscape = v => `"${String(v??'').replace(/"/g,'""')}"`
  const importInputRef = useRef(null)
  const [exporting, setExporting] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', confirmText: 'Confirm', cancelText: 'Cancel', onConfirm: null })
  const [infoDialog, setInfoDialog] = useState({ open: false, title: '', message: '', okText: 'OK' })

  const handleDeleteAllPets = () => {
    setConfirmDialog({
      open: true,
      title: 'Delete All Pets',
      message: 'Are you sure you want to permanently delete ALL reception data? This will remove registered pets and related reception records. It will also clear pharmacy dues/sales to keep Client Directory in sync. This action cannot be undone.',
      confirmText: 'Delete All',
      cancelText: 'Cancel',
      onConfirm: async () => {
        setConfirmDialog(d => ({ ...d, open: false }))
        try {
          setLoading(true)
          setError('')
          // Clear reception data (pets, appointments, procedure records)
          try { await backupAPI.clearReception() } catch {}
          // Clear pharmacy data (sales, dues) so client directory totals are reset
          try { await backupAPI.clearPharmacy() } catch {}
          // Optional: clear other modules to ensure system-wide reset (lab, shop, doctor)
          try { await backupAPI.clearLab() } catch {}
          try { await backupAPI.clearShop() } catch {}
          try { await backupAPI.clearDoctor() } catch {}
          await loadPets()
          try { localStorage.setItem('data_reset_at', String(Date.now())); window.dispatchEvent(new Event('data-reset')) } catch {}
          setInfoDialog({ open: true, title: 'Delete All', message: 'All reception and pharmacy data have been cleared. Client Directory will reflect the changes after refresh.', okText: 'OK' })
        } catch (e) {
          setError(e?.message || 'Failed to clear data')
          setInfoDialog({ open: true, title: 'Delete All', message: e?.message || 'Failed to clear data. Please try again.', okText: 'OK' })
        } finally {
          setLoading(false)
        }
      }
    })
  }

  const runImportFile = async (file) => {
    try {
      setImporting(true)
      const ext = file.name.toLowerCase().split('.').pop()
      let records = []
      if (ext==='xlsx' || ext==='xls'){
        const buf = await file.arrayBuffer()
        const wb = XLSX.read(buf, { type:'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rowsAoA = XLSX.utils.sheet_to_json(ws, { header:1, defval:'', raw:false })
        const nk = s => String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'')
        let headerIndex = 0
        for (let i=0;i<Math.min(rowsAoA.length, 10);i++){
          const r = rowsAoA[i]
          const set = new Set(r.map(nk))
          if (set.has('patientid') && (set.has('animalname') || set.has('petname')) && set.has('ownername')) { headerIndex = i; break }
        }
        const header = (rowsAoA[headerIndex]||[]).map(h=>String(h||'').trim())
        const recs = []
        for (let i=headerIndex+1; i<rowsAoA.length; i++){
          const row = rowsAoA[i]
          if (!row || row.every(x=>String(x||'').trim()==='')) continue
          const obj = {}
          header.forEach((h,idx)=>{ obj[h] = row[idx] ?? '' })
          recs.push(obj)
        }
        records = recs
      } else {
        const text = await file.text()
        const rows = parseCSVText(text)
        if(rows.length===0) return
        const header = rows[0].map(h=>String(h||'').trim())
        for(let i=1;i<rows.length;i++){
          const row = rows[i]
          if(row.every(x=>String(x||'').trim()==='')) continue
          const obj = {}
          header.forEach((h,idx)=>{ obj[h] = row[idx] ?? '' })
          records.push(obj)
        }
      }
      await importRecords(records)
    } catch (err) {
      setInfoDialog({ open: true, title: 'Import Failed', message: err?.message || 'Import failed. Please check file format and required columns.', okText: 'OK' })
    } finally {
      setImporting(false)
    }
  }

  const buildFinanceByClient = async () => {
    let sales = []
    let procs = []
    try { const s = await pharmacySalesAPI.getAll(); sales = s.data||[] } catch {}
    try { const p = await proceduresAPI.getAll(''); procs = p.data||[] } catch {}
    const toNum = (v)=>{ if(v==null) return 0; const n=typeof v==='string'? Number(v.replace(/,/g,'')) : Number(v); return Number.isNaN(n)?0:n }
    const map = {}
    sales.forEach(s=>{
      const cid = (s.clientId||'').trim(); if(!cid) return
      if(!map[cid]) map[cid] = { billed:0, received:0 }
      const subtotal = toNum(s.subtotal)
      const discount = toNum(s.discount)
      const billed = toNum(s.totalAmount ?? (subtotal - discount))
      const received = toNum(s.receivedAmount != null ? s.receivedAmount : billed)
      map[cid].billed += billed
      map[cid].received += received
    })
    procs.forEach(p=>{
      const cid = (p.clientId||'').trim(); if(!cid) return
      if(!map[cid]) map[cid] = { billed:0, received:0 }
      const gt = toNum(p.grandTotal ?? (toNum(p.subtotal) + toNum(p.previousDues)))
      const recv = (p.receivedAmount != null) ? toNum(p.receivedAmount) : (p.receivable != null ? Math.max(0, gt - toNum(p.receivable)) : 0)
      map[cid].billed += gt
      map[cid].received += recv
    })
    Object.keys(map).forEach(cid=>{ map[cid].balance = Math.max(0, map[cid].billed - map[cid].received) })
    return map
  }

  const exportExcelCSV = async () => {
    try {
      setExporting(true)
      const fin = await buildFinanceByClient()
      const headers = ['Patient ID','Pet Name','Client ID','Owner Name','Common Name','Species','DOB','Age','Gender','Contact','Receivable Total','Received Total','Balance']
      const lines = filtered.map(r=>{
        const d = r.details || {}
        const owner = d.owner || {}
        const pet = d.pet || {}
        const cid = (r.clientId || owner.clientId || '').trim()
        const f = fin[cid] || { billed:0, received:0, balance:0 }
        const dob = pet.dateOfBirth ? String(pet.dateOfBirth).slice(0,10) : ''
        const row = [pet.petId || r.id, r.petName, cid, r.ownerName || owner.fullName, r.type || pet.type, r.species || pet.species, dob, r.age || pet.dobOrAge, r.gender || pet.gender, r.ownerContact || owner.contact, (f.billed - f.received), f.received, f.balance]
        return row.map(csvEscape).join(',')
      })
      const csv = [headers.join(','), ...lines].join('\n')
      const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'registered_pets.csv'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  // Backward-compatibility: if any older JSX still calls exportCSV, route to new exporter
  const exportCSV = () => exportExcelCSV()

  const ensureXLSX = () => new Promise((resolve, reject) => {
    if (window.XLSX) return resolve(window.XLSX)
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
    s.onload = () => resolve(window.XLSX)
    s.onerror = () => reject(new Error('XLSX load failed'))
    document.head.appendChild(s)
  })

  const parseCSVText = (text) => {
    const rows = []
    let i=0, field='', inQ=false, row=[]
    while(i<text.length){
      const c=text[i]
      if(inQ){
        if(c==='"' && text[i+1]==='"'){ field+='"'; i+=2; continue }
        if(c==='"'){ inQ=false; i++; continue }
        field+=c; i++; continue
      }
      if(c==='"'){ inQ=true; i++; continue }
      if(c===','){ row.push(field); field=''; i++; continue }
      if(c==='\n' || c==='\r'){ if(field!==''||row.length){ row.push(field); rows.push(row); row=[]; field='' } ; i++; continue }
      field+=c; i++
    }
    if(field!==''||row.length) { row.push(field); rows.push(row) }
    return rows
  }

  const handleImportClick = () => { importInputRef.current?.click() }

  const handleImportFile = async (e) => {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''
    if(!file) return
    setConfirmDialog({
      open: true,
      title: 'Import from Excel',
      message: 'Are you sure you want to import pets from this Excel file? New pets will be created and existing patient IDs may be updated or backfilled.',
      confirmText: 'Import',
      cancelText: 'Cancel',
      onConfirm: async () => {
        setConfirmDialog(d => ({ ...d, open: false }))
        await runImportFile(file)
      }
    })
  }

  const importRecords = async (rowsIn) => {
    console.log('Import started. Rows received:', rowsIn.length);
    
    // Show loading state
    setImporting(true);

    try {
      const norm = s => String(s||'').trim()
      const normKey = k => String(k||'').toLowerCase().replace(/[^a-z0-9]/g,'')
      const valFromObject = (obj, aliases) => {
        const safeAliases = Array.isArray(aliases) ? aliases : []
        // Try direct keys first
        for (const a of safeAliases) {
          if (obj && Object.prototype.hasOwnProperty.call(obj, a)) {
            const v = obj[a]
            if (v != null && v !== '') return v
          }
        }
        // Build normalized table once
        const table = {}
        const keys = Object.keys(obj||{})
        keys.forEach(k=>{ table[normKey(k)] = obj[k] })
        // Exact normalized match
        for (const a of safeAliases) {
          const nk = normKey(a)
          if (table[nk] != null && table[nk] !== '') return table[nk]
        }
        // Fuzzy: include/substring match to support truncated headers like "Owner N", "Animal N", "Common"
        for (const a of safeAliases) {
          const nk = normKey(a)
          for (const tk of Object.keys(table)) {
            if (tk.includes(nk) || nk.includes(tk)) {
              const v = table[tk]
              if (v != null && v !== '') return v
            }
          }
        }
        return ''
      }
      const toISO = (v) => {
        if (!v) return ''
        if (v instanceof Date) {
          try { return v.toISOString().slice(0,10) } catch { return '' }
        }
        const s = String(v)
        // Excel serial number?
        if (/^\d{5,}$/.test(s)) {
          try {
            const base = new Date(Date.UTC(1899,11,30))
            base.setUTCDate(base.getUTCDate() + parseInt(s,10))
            return base.toISOString().slice(0,10)
          } catch {}
        }
        // e.g. 21-Apr-23
        try { return new Date(s).toISOString().slice(0,10) } catch { return '' }
      }
      const normalizeGender = (v) => {
        const s = String(v || '').trim().toLowerCase()
        if (!s) return ''
        if (['m', 'male', 'boy'].includes(s)) return 'Male'
        if (['f', 'female', 'girl'].includes(s)) return 'Female'
        return ''
      }
      const existed = new Set((rows||[]).map(r=>norm(r.id)))
      let created = 0, skipped = 0
      const rowErrors = []
      const openings = []

    // Expected headers + aliases - matching the actual Excel format
    const H = {
      pid: 'Client ID',
      animalName: 'Pet Name',
      clientId: 'Client ID',
      ownerName: 'Owner Name',
      commonName: 'Species',
      species: 'Species',
      dob: 'DOB',
      age: 'Age',
      gender: 'Gender',
      contact: 'Contact',
      email: 'Email',
      // Payment fields
      billed: 'Total Paid',
      received: 'Total Paid',
      due: 'Current Due'
    }
    const ALIASES = {
      pid: ['Client ID', 'Patient ID', 'ID', 'clientid', 'client_id'],
      animalName: ['Pet Name', 'Animal Name', 'petname', 'pet_name', 'Name'],
      clientId: ['Client ID', 'clientid', 'client_id', 'Owner ID'],
      ownerName: ['Owner Name', 'ownername', 'owner_name', 'Client Name'],
      commonName: ['Species', 'Common Name', 'Type', 'species', 'commonname'],
      species: ['Species', 'Scientific Name', 'species', 'speciesname'],
      contact: ['Contact', 'Phone', 'Mobile', 'contact', 'phone'],
      email: ['Email', 'E-mail', 'email', 'mail'],
      age: ['Age', 'age', 'Pet Age', 'Years'],
      gender: ['Gender', 'gender', 'Sex'],
      billed: ['Total Paid', 'Paid', 'Amount Paid', 'totalpaid', 'total_paid'],
      received: ['Total Paid', 'Paid', 'Amount Paid', 'totalpaid', 'total_paid'],
      due: ['Current Due', 'Due', 'Balance', 'Pending', 'currentdue', 'current_due']
    }
    // Prepare all pets for bulk import
    const petsToImport = [];
    const existingIds = new Set((rows||[]).map(r=>norm(r.id)));
    
    for (const rec of rowsIn){
      // Read strictly by the specified headers, but allow light normalization fallback
      const pid = norm(rec[H.pid] ?? valFromObject(rec, [H.pid, ...ALIASES.pid]))
      const petName = norm(rec[H.animalName] ?? valFromObject(rec, [H.animalName, ...ALIASES.animalName]))
      const clientId = norm(rec[H.clientId] ?? valFromObject(rec, [H.clientId, ...ALIASES.clientId]))
      const ownerName = norm(rec[H.ownerName] ?? valFromObject(rec, [H.ownerName, ...ALIASES.ownerName]))
      const commonName = norm(rec[H.commonName] ?? valFromObject(rec, [H.commonName, ...ALIASES.commonName]))
      const species = norm(rec[H.species] ?? valFromObject(rec, [H.species, ...ALIASES.species]))
      const dob = toISO(rec[H.dob] ?? valFromObject(rec, [H.dob]))
      const ageText = norm(rec[H.age] ?? valFromObject(rec, [H.age, ...ALIASES.age]))
      const gender = normalizeGender(rec[H.gender] ?? valFromObject(rec, [H.gender, ...ALIASES.gender]))
      const contact = norm(rec[H.contact] ?? valFromObject(rec, [H.contact, ...ALIASES.contact]))
      const email = norm(rec[H.email] ?? valFromObject(rec, [H.email, ...ALIASES.email]))
      
      // Extract payment fields using aliases and auto-calc where needed
      const numVal = (s) => { const t=String(s||'').replace(/,/g,'').replace(/[^0-9.\-]/g,'').trim(); const n=Number(t); return Number.isFinite(n)? n : 0 }
      const billedRaw = rec[H.billed] ?? valFromObject(rec, [H.billed, ...ALIASES.billed])
      const receivedRaw = rec[H.received] ?? valFromObject(rec, [H.received, ...ALIASES.received])
      const dueRaw = rec[H.due] ?? valFromObject(rec, [H.due, ...ALIASES.due])
      let billed = numVal(billedRaw)
      let received = numVal(receivedRaw)
      let due = numVal(dueRaw)
      if (!billed && (received || due)) billed = Math.max(0, received + due)
      if (!due && billed) due = Math.max(0, billed - received)
      const id = pid

      // Row-level validation (only require essential fields)
      const missing = []
      if (!id) missing.push('Client ID')
      if (!petName) missing.push('Pet Name')
      if (!ownerName) missing.push('Owner Name')
      if (missing.length) {
        skipped++
        rowErrors.push(`Row ${created+skipped}: Missing ${missing.join(', ')}`)
        continue
      }
      
      if(existingIds.has(id)) {
        // Backfill financials for existing pet
        if (billed>0 || received>0 || due>0) {
          openings.push({ petId:id, clientId: clientId || id, petName, ownerName, contact, billed, received, due, note:'Imported from Excel (Backfill)' })
        }
        if ((clientId || id) && due>0) {
          try { await pharmacyDuesAPI.upsert((clientId||id), { previousDue: due, name: ownerName, customerContact: contact }) } catch {}
        }
        skipped++; rowErrors.push(`Duplicate: ${id}`); continue
      }
      
      const ownerId = clientId || id
      const petData = {
        id,
        clientId: clientId || ownerId,
        petName: petName,
        type: commonName,
        species: species,
        breed: '',
        age: ageText,
        dateOfBirth: dob,
        gender: gender,
        ownerName: ownerName,
        ownerContact: contact,
        ownerAddress: '',
        details: {
          pet: { petId:id, petName:petName, type:commonName, species, breed:'', dateOfBirth:dob, dobOrAge:ageText, gender, colorMarkings:'', microchipTag:'', vaccinationStatus:'', dewormingStatus:'' },
          owner: { ownerId, clientId: clientId || ownerId, fullName: ownerName, nic:'', contact: contact, email, address:'', emergencyContactPerson:'', emergencyContactNumber:'' },
          medical: initialForm.medical,
          vaccines: initialForm.vaccines,
          complaint: initialForm.complaint,
          clinic: initialForm.clinic
        },
        status: 'Active'
      }
      
      petsToImport.push(petData);
      existingIds.add(id);
      
      // Queue financial opening
      if (billed>0 || received>0 || due>0) {
        openings.push({ petId:id, clientId: clientId || ownerId, petName, ownerName, contact, billed, received, due, note:'Imported from Excel' })
      }
      if ((clientId || ownerId) && due>0) {
        try { await pharmacyDuesAPI.upsert((clientId||ownerId), { previousDue: due, name: ownerName, customerContact: contact }) } catch {}
      }
    }
    
    // Update progress before bulk import
    console.log(`Starting bulk import of ${petsToImport.length} pets...`);
    
    // Use bulk import for faster processing
    if (petsToImport.length > 0) {
      try {
        const result = await petsAPI.bulkImport(petsToImport);
        created = result.data?.created || petsToImport.length;
        skipped += result.data?.skipped || 0;
        if (result.data?.errors) {
          rowErrors.push(...result.data.errors.map(e => `ID ${e.id}: ${e.error}`));
        }
        console.log(`Bulk import complete: ${created} created, ${skipped} skipped`);
      } catch (error) {
        console.error('Bulk import failed:', error);
        // Fallback to individual creation if bulk fails
        for (const petData of petsToImport) {
          try {
            await petsAPI.create(petData);
            created++;
          } catch (e) {
            skipped++;
            rowErrors.push(e?.message || 'Server rejected row');
          }
        }
      }
    }
    
    // Final processing
    console.log('Processing financial data...');
    // Write all opening financials in bulk (bypass dayGuard)
    if (openings.length) {
      try { await proceduresAPI.importOpenings(openings) } catch (e) { rowErrors.push('Failed to post opening balances') }
    }
    await loadPets()
    
    // Debug alert with full summary
    alert(`Import Summary:\nCreated: ${created}\nSkipped: ${skipped}\nTotal: ${created + skipped}\n\nFirst few errors:\n${rowErrors.slice(0, 5).join('\n') || 'None'}`);
    } catch (e) {
      console.error('Import failed:', e)
      alert(`Import failed: ${e?.message || 'Unknown error'}`)
    } finally {
      setImporting(false)
    }
  }

  const printReceipt = (payload = null) => {
    const activeReceipt = payload || receipt
    if(!activeReceipt) return
    const d = activeReceipt.details || {}
    const owner = d.owner || {}
    const pet = d.pet || {}
    const when = new Date(activeReceipt.when || Date.now())
    const dateStr = `${when.toLocaleDateString()} ${when.toLocaleTimeString()}`
    // Robust fallbacks so printed fields are never missing (merge receipt + rows)
    const recRow = (() => {
      try {
        const rid = activeReceipt.id || activeReceipt._id || pet.petId
        return (rows || []).find(r => r.id === rid || r._id === rid || r.details?.pet?.petId === pet.petId)
      } catch { return null }
    })()
    const ownerName = owner.fullName || activeReceipt.ownerName || recRow?.ownerName || form?.owner?.fullName || '-'
    const ownerId = owner.ownerId || owner.clientId || activeReceipt.clientId || recRow?.clientId || recRow?.details?.owner?.clientId || recRow?.details?.owner?.ownerId || form?.owner?.clientId || form?.owner?.ownerId || '-'
    const petName = pet.petName || activeReceipt.petName || activeReceipt.name || recRow?.petName || form?.pet?.petName || '-'
    const petId = pet.petId || activeReceipt.petId || activeReceipt.id || recRow?.id || recRow?.details?.pet?.petId || form?.pet?.petId || '-'
    const visitType = (d.complaint && d.complaint.visitType) || recRow?.details?.complaint?.visitType || recRow?.purpose || form?.complaint?.visitType || 'Visit'
    const consultingVet = (d.clinic && d.clinic.consultingVet) || recRow?.details?.clinic?.consultingVet || form?.clinic?.consultingVet || '-'
    const consultantFeeNum = (() => {
      const v = (d.clinic && d.clinic.consultantFees)
      const n1 = v != null ? parseFloat(v) : NaN
      const n2 = parseFloat(recRow?.details?.clinic?.consultantFees)
      const n3 = parseFloat(recRow?.consultantFees)
      const pick = [n1, n2, n3].find(x => !isNaN(x) && x > 0)
      return pick || 0
    })()
    
    const isBlankCore = [ownerName, ownerId, petName, petId].every(v => !v || v === '-')
    if (isBlankCore) { setReceiptOpen(false); return }

    const receiptNo = (activeReceipt.receiptNo || activeReceipt.id || d?.pet?.petId || pet?.petId || '-')
    const html = `<!doctype html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Pet Registration Receipt - ${hospital.name}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'IBM Plex Mono', 'Courier New', monospace; color: #111; width: 76mm; margin: 0 auto; padding: 6mm 4mm; font-size: 12px; font-weight: 500; line-height: 1.25; }
        h1 { font-size: 14px; text-align: center; margin-bottom: 4px; }
        .sub { text-align: center; font-size: 11px; margin-bottom: 6px; }
        .divider { border-top: 1px dashed #555; margin: 6px 0; }
        .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
        .label { color: #000; font-weight: 700; }
        .value { color: #111; font-weight: 600; text-align: right; }
        .totals { font-weight: 700; font-size: 13px; }
        .meta { font-size: 11px; margin-bottom: 4px; display: flex; justify-content: space-between; font-weight: 600; }
        .center { text-align: center; }
        .cut-spacer { height: 0; }
        @page { size: 80mm auto; margin: 3mm; }
        @media print { body { width: 76mm; padding: 0; } .cut-spacer { height: 18mm; } }
      </style>
    </head>
    <body>
      <h1>${hospital.name}</h1>
      <div class="sub">${hospital.tagline || ''}</div>
      ${hospital.address !== '—' ? `<div class="center" style="font-size:10px;">${hospital.address}</div>` : ''}
      ${hospital.phone !== '—' ? `<div class="center" style="font-size:10px;">Phone: ${hospital.phone}</div>` : ''}
      <div class="divider"></div>
      <div class="meta">
        <span>Receipt # ${receiptNo}</span>
        <span>${dateStr}</span>
      </div>
      <div class="divider"></div>
      <div class="row"><span class="label">Owner</span><span class="value">${ownerName}</span></div>
      <div class="row"><span class="label">Owner ID</span><span class="value">${ownerId}</span></div>
      <div class="row"><span class="label">Pet</span><span class="value">${petName}</span></div>
      <div class="row"><span class="label">Pet ID</span><span class="value">${petId}</span></div>
      <div class="divider"></div>
      <div class="row"><span class="label">Visit Type</span><span class="value">${visitType}</span></div>
      <div class="row"><span class="label">Consulting Vet</span><span class="value">${consultingVet}</span></div>
      <div class="divider"></div>
      ${consultantFeeNum > 0 ? `
        <div class="row totals"><span class="label">Consultant Fees</span><span class="value">Rs. ${consultantFeeNum.toFixed(2)}</span></div>
      ` : ''}
      <div class="divider"></div>
      <div class="center" style="font-size:10px;margin-top:6px;">Thank you for visiting ${hospital.name}</div>
      <div class="center" style="font-size:10px;">This is a system generated receipt.</div>
      <div class="cut-spacer"></div>
    </body>
    </html>`

    // Prefer Electron native print (no blank window)
    try {
      if (window.electronAPI && typeof window.electronAPI.printHTML === 'function') {
        window.electronAPI.printHTML(html)
        setReceiptOpen(false)
        return
      }
    } catch {}

    // Fallback: hidden iframe (keeps current window; no about:blank tab)
    try {
      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = '0'
      iframe.srcdoc = html
      document.body.appendChild(iframe)
      iframe.onload = () => {
        try { iframe.contentWindow?.focus(); iframe.contentWindow?.print() } finally {
          setTimeout(() => { try { document.body.removeChild(iframe) } catch {}; setReceiptOpen(false) }, 200)
        }
      }
      return
    } catch {}

    // No separate window fallback
    setReceiptOpen(false)
  }

  const openCreate = () => {
    setForm(prev => ({
      ...initialForm,
      owner: { ...initialForm.owner, clientId: makeClientId() }
    }))
    setMode('create'); setCurrentId(''); setIsOpen(true)
  }
  const openView = row => {
    const d = row.details || {}
    setForm({
      owner: {
        ...initialForm.owner,
        ...(d.owner || {}),
        fullName: d.owner?.fullName || row.ownerName || '',
        contact: d.owner?.contact || row.ownerContact || '',
        address: d.owner?.address || row.ownerAddress || ''
      },
      pet: {
        ...initialForm.pet,
        ...(d.pet || {}),
        petName: d.pet?.petName || row.petName || '',
        type: d.pet?.type || row.type || '',
        species: d.pet?.species || row.species || '',
        breed: d.pet?.breed || row.breed || '',
        gender: d.pet?.gender || row.gender || '',
        dateOfBirth: d.pet?.dateOfBirth || row.dateOfBirth || '',
        approxAge: d.pet?.dobOrAge || row.age || ''
      },
      medical: d.medical || initialForm.medical,
      vaccines: Array.isArray(d.vaccines) ? d.vaccines : initialForm.vaccines,
      deworming: d.deworming || initialForm.deworming,
      complaint: d.complaint || initialForm.complaint,
      clinic: d.clinic || initialForm.clinic,
      life: d.life || {
        dead: (row.status==='Expired' || row.status==='Deceased'),
        deathDate: row.dateOfDeath || d.life?.deathDate || '',
        deathNote: d.life?.deathNote || ''
      }
    })
    setMode('view'); setCurrentId(row.id || row._id); setIsOpen(true)
    try {
      const cid = (d.owner?.clientId || row.clientId || d.owner?.ownerId || row.ownerId || '').trim()
      const pid = (row.id || row._id || d.pet?.petId || '').toString()
      if (cid) loadClientPayments(cid, pid)
    } catch {}
  }
  const openEdit = row => {
    const d = row.details || {}
    setForm({
      owner: {
        ...initialForm.owner,
        ...(d.owner || {}),
        fullName: d.owner?.fullName || row.ownerName || '',
        contact: d.owner?.contact || row.ownerContact || '',
        address: d.owner?.address || row.ownerAddress || ''
      },
      pet: {
        ...initialForm.pet,
        ...(d.pet || {}),
        petName: d.pet?.petName || row.petName || '',
        type: d.pet?.type || row.type || '',
        species: d.pet?.species || row.species || '',
        breed: d.pet?.breed || row.breed || '',
        gender: d.pet?.gender || row.gender || '',
        dateOfBirth: d.pet?.dateOfBirth || row.dateOfBirth || '',
        approxAge: d.pet?.dobOrAge || row.age || ''
      },
      medical: d.medical || initialForm.medical,
      vaccines: Array.isArray(d.vaccines) ? d.vaccines : initialForm.vaccines,
      deworming: d.deworming || initialForm.deworming,
      complaint: d.complaint || initialForm.complaint,
      clinic: d.clinic || initialForm.clinic,
      life: d.life || {
        dead: (row.status==='Expired' || row.status==='Deceased'),
        deathDate: row.dateOfDeath || d.life?.deathDate || '',
        deathNote: d.life?.deathNote || ''
      }
    })
    setMode('edit'); setCurrentId(row.id || row._id); setIsOpen(true)
    try {
      const cid = (d.owner?.clientId || row.clientId || d.owner?.ownerId || row.ownerId || '').trim()
      const pid = (row.id || row._id || d.pet?.petId || '').toString()
      if (cid) loadClientPayments(cid, pid)
    } catch {}
  }
  const askDelete = row => { setRowToDelete(row); setShowDeleteConfirm(true) }
  const confirmDelete = async () => {
    if(!rowToDelete) return
    
    try {
      setLoading(true)
      setError(null)
      
      const id = rowToDelete.id || rowToDelete._id
      await petsAPI.delete(id)
      
      setRows(prev => prev.filter(r => r.id !== id && r._id !== id))
      setShowDeleteConfirm(false)
      setRowToDelete(null)
      
      try { 
        addActivity({ user: 'Reception', text: `Deleted pet: ${rowToDelete.petName || rowToDelete.name}` }) 
      } catch {}
      
      // Reload to ensure sync
      await loadPets()
      
    } catch (err) {
      console.error('Error deleting pet:', err)
      setError(err.message || 'Failed to delete pet')
      setShowDeleteConfirm(false)
    } finally {
      setLoading(false)
    }
  }
  const cancelDelete = () => { setShowDeleteConfirm(false); setRowToDelete(null) }

  const openReceiptDialog = () => {
    try {
      const row = rows.find(r => (r.id===currentId || r._id===currentId))
      if (row) { setReceipt(row); setReceiptOpen(true); return }
    } catch {}
  }

  const focusNextFieldOnEnter = (e) => {
    try {
      if (e.key !== 'Enter' || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return
      const el = e.target
      if (!el) return
      const tag = (el.tagName || '').toLowerCase()
      if (tag === 'textarea') return
      if (tag === 'button') return
      if (tag === 'a') return
      const type = (el.getAttribute?.('type') || '').toLowerCase()
      if (type === 'submit') return

      const formEl = e.currentTarget
      if (!formEl?.querySelectorAll) return

      const focusables = Array.from(
        formEl.querySelectorAll('input, select, textarea, button, [tabindex]')
      ).filter((node) => {
        try {
          if (!node) return false
          if (node.hasAttribute?.('disabled') || node.getAttribute?.('aria-disabled') === 'true') return false
          const t = (node.getAttribute?.('type') || '').toLowerCase()
          if (t === 'hidden') return false
          if (node.getAttribute?.('tabindex') === '-1') return false
          if (node.offsetParent === null && getComputedStyle(node).position !== 'fixed') return false
          return true
        } catch {
          return false
        }
      })

      const idx = focusables.indexOf(el)
      if (idx === -1) return
      const next = focusables[idx + 1]
      if (!next) return
      e.preventDefault()
      next.focus?.()
      if (next.select) next.select()
    } catch {}
  }

  return (
    <div className="space-y-8">
      {/* Import Loading Overlay */}
      {importing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <svg className="w-8 h-8 text-emerald-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Importing Pets...</h3>
            <p className="text-slate-600 mb-4">Please wait while we import your data. This may take a few minutes for large files.</p>
            <div className="w-full bg-slate-200 rounded-full h-2 mb-2">
              <div className="bg-emerald-600 h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
            </div>
            <p className="text-sm text-slate-500">Processing...</p>
          </div>
        </div>
      )}

      {/* Professional Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent mb-2">
          Pet Registration
        </h1>
        <p className="text-slate-600 text-lg">Complete pet and owner information management</p>
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500">
          <FiHeart className="w-4 h-4 text-red-500" />
          <span>Caring for every pet with love and precision</span>
          <FiStar className="w-4 h-4 text-yellow-500" />
        </div>
      </div>

      {upcomingVaccines.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 shadow-md p-5 flex flex-col gap-3">
          <div className="flex items-center gap-3 text-amber-800">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center">
              <FiBell className="w-6 h-6" />
            </div>
            <div>
              <div className="text-lg font-semibold">Vaccination Reminder</div>
              <p className="text-sm text-amber-700">The patients listed below have vaccines due tomorrow. Please confirm their schedule.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {upcomingVaccines.map((rem, idx) => (
              <div key={`${rem.petName}-${rem.vaccineName}-${idx}`} className="rounded-xl bg-white/70 border border-amber-100 p-3">
                <div className="text-sm font-semibold text-slate-800">{rem.petName}</div>
                {rem.ownerName && <div className="text-xs text-slate-500">Owner: {rem.ownerName}</div>}
                <div className="mt-2 text-sm text-slate-700">Vaccine: <span className="font-medium">{rem.vaccineName}</span>{rem.shotStage ? ` (${rem.shotStage})` : ''}</div>
                <div className="text-xs text-slate-500">Due: {formatLocalDate(rem.dueDate)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Date Range Picker */}
      <div className="rounded-2xl bg-gradient-to-br from-white via-emerald-50 to-teal-50 shadow-xl ring-1 ring-emerald-200 border border-emerald-100 p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <FiCalendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-emerald-600">Date Range</div>
              <div className="text-lg font-bold text-slate-800">
                {showAll
                  ? 'All'
                  : (dateRange.fromDate === dateRange.toDate 
                      ? new Date(dateRange.fromDate).toLocaleDateString()
                      : `${new Date(dateRange.fromDate).toLocaleDateString()} - ${new Date(dateRange.toDate).toLocaleDateString()}`)
                }
              </div>
            </div>
          </div>
          <DateRangePicker 
            onDateChange={(dr)=>{ setDateRange(dr); setShowAll(dr.fromDate === '1900-01-01' && dr.toDate === '2999-12-31') }}
            defaultFromDate={dateRange.fromDate}
            defaultToDate={dateRange.toDate}
            showAllButton={true}
            onAllClick={()=> setShowAll(true)}
          />
        </div>
      </div>

      {/* Taxonomy Dialog */}
      {taxonomyDialog.open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeTaxonomyDialog}></div>
          <div className="relative w-[95%] max-w-md max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-emerald-200 p-4 md:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-800">
                  {taxonomyDialog.type === 'name' ? 'Add New Pet Name' : 'Add Species for ' + taxonomyDialog.commonName}
                </h3>
                <p className="text-sm text-slate-500">Values will be saved for future registrations.</p>
              </div>
              <button onClick={closeTaxonomyDialog} className="text-slate-500 hover:text-slate-700 text-2xl leading-none">×</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Pet Name (Common Name)</label>
                <input
                  value={taxonomyDialog.commonName}
                  onChange={e=>setTaxonomyDialog(prev=>({...prev, commonName: e.target.value}))}
                  placeholder="e.g., Dog"
                  className="w-full h-11 px-3 rounded-lg border border-slate-300"
                  disabled={taxonomyDialog.type === 'species'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Species (Scientific Name)</label>
                <input
                  value={taxonomyDialog.speciesName}
                  onChange={e=>setTaxonomyDialog(prev=>({...prev, speciesName: e.target.value}))}
                  placeholder="e.g., Canis lupus familiaris"
                  className="w-full h-11 px-3 rounded-lg border border-slate-300"
                />
              </div>
              {taxonomyDialog.error && (
                <div className="text-sm text-red-600">{taxonomyDialog.error}</div>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={closeTaxonomyDialog} className="h-11 px-6 rounded-xl border border-slate-300 text-slate-600">Cancel</button>
              <button onClick={handleTaxonomyDialogSubmit} className="h-11 px-6 rounded-xl bg-emerald-600 text-white font-semibold">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Breed Dialog */}
      {breedDialog.open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={()=>setBreedDialog(prev=>({...prev, open:false, error:''}))}></div>
          <div className="relative w-[95%] max-w-md max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-emerald-200 p-4 md:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Add New Breed</h3>
                <p className="text-sm text-slate-500">Breed will be saved for the selected Type.</p>
              </div>
              <button onClick={()=>setBreedDialog(prev=>({...prev, open:false, error:''}))} className="text-slate-500 hover:text-slate-700 text-2xl leading-none">×</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                <select value={breedDialog.typeName} onChange={e=>setBreedDialog(prev=>({...prev, typeName: e.target.value}))} className="w-full h-11 px-3 rounded-lg border border-slate-300">
                  <option value="">Select Type</option>
                  {typeOptions.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Breed Name</label>
                <input value={breedDialog.breedName} onChange={e=>setBreedDialog(prev=>({...prev, breedName: e.target.value}))} placeholder="e.g., Ragdoll" className="w-full h-11 px-3 rounded-lg border border-slate-300" />
              </div>
              {breedDialog.error && (
                <div className="text-sm text-red-600">{breedDialog.error}</div>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={()=>setBreedDialog(prev=>({...prev, open:false, error:''}))} className="h-11 px-6 rounded-xl border border-slate-300 text-slate-600">Cancel</button>
              <button onClick={handleBreedDialogSubmit} className="h-11 px-6 rounded-xl bg-emerald-600 text-white font-semibold">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Taxonomy (Type + Species) */}
      {manageTaxonomy.open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeManageTaxonomy}></div>
          <div className="relative w-[95%] max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-emerald-200 p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Manage Types & Species</h3>
                <p className="text-sm text-slate-500">Edit or delete Type/Species pairs. Changes are saved for future registrations.</p>
              </div>
              <button onClick={closeManageTaxonomy} className="text-slate-500 hover:text-slate-700 text-2xl leading-none">×</button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={manageTaxonomy.newCommonName} onChange={e=>setManageTaxonomy(prev=>({ ...prev, newCommonName: e.target.value, error:'' }))} placeholder="New Common Name (e.g., Dog)" className="h-11 px-3 rounded-lg border border-slate-300" />
                <input value={manageTaxonomy.newSpeciesName} onChange={e=>setManageTaxonomy(prev=>({ ...prev, newSpeciesName: e.target.value, error:'' }))} placeholder="New Species (e.g., Canis lupus familiaris)" className="h-11 px-3 rounded-lg border border-slate-300" />
              </div>
              <div className="flex justify-end">
                <button type="button" onClick={addManageTaxonomyItem} className="h-10 px-4 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">Add</button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-sm min-w-[620px]">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Type</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Species</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manageTaxonomy.items.map((it, idx) => (
                      <tr key={idx} className="border-t border-slate-100">
                        <td className="px-3 py-2">
                          <input value={it.commonName} onChange={e=>setManageTaxonomyField(idx,'commonName', e.target.value)} className="w-full h-9 px-2 rounded border border-slate-300" />
                        </td>
                        <td className="px-3 py-2">
                          <input value={it.speciesName} onChange={e=>setManageTaxonomyField(idx,'speciesName', e.target.value)} className="w-full h-9 px-2 rounded border border-slate-300" />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button type="button" onClick={()=>removeManageTaxonomyItem(idx)} className="h-9 px-3 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">Delete</button>
                        </td>
                      </tr>
                    ))}
                    {manageTaxonomy.items.length === 0 && (
                      <tr><td colSpan="3" className="px-3 py-4 text-center text-slate-500">No items</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {manageTaxonomy.error && (
                <div className="text-sm text-red-600">{manageTaxonomy.error}</div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeManageTaxonomy} className="h-11 px-6 rounded-xl border border-slate-300 text-slate-600">Cancel</button>
                <button type="button" onClick={saveManageTaxonomy} className="h-11 px-6 rounded-xl bg-emerald-600 text-white font-semibold">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage Breeds */}
      {manageBreeds.open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeManageBreeds}></div>
          <div className="relative w-[95%] max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-emerald-200 p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Manage Breeds</h3>
                <p className="text-sm text-slate-500">Manage custom breeds (base breeds remain available).</p>
              </div>
              <button onClick={closeManageBreeds} className="text-slate-500 hover:text-slate-700 text-2xl leading-none">×</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                <select value={manageBreeds.typeName} onChange={e=>setManageBreeds(prev=>({ ...prev, typeName: e.target.value, error:'' }))} className="w-full h-11 px-3 rounded-lg border border-slate-300">
                  <option value="">Select Type</option>
                  {typeOptions.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input value={manageBreeds.newItem} onChange={e=>setManageBreeds(prev=>({ ...prev, newItem: e.target.value }))} placeholder="New breed" className="flex-1 h-11 px-3 rounded-lg border border-slate-300" />
                <button type="button" onClick={addManageBreedItem} className="h-11 px-4 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">Add</button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-sm min-w-[520px]">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Breed</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manageBreeds.items.map((it, idx) => (
                      <tr key={idx} className="border-t border-slate-100">
                        <td className="px-3 py-2">
                          <input value={it} onChange={e=>setManageBreedItem(idx, e.target.value)} className="w-full h-9 px-2 rounded border border-slate-300" />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button type="button" onClick={()=>removeManageBreedItem(idx)} className="h-9 px-3 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">Delete</button>
                        </td>
                      </tr>
                    ))}
                    {manageBreeds.items.length === 0 && (
                      <tr><td colSpan="2" className="px-3 py-4 text-center text-slate-500">No custom breeds</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {manageBreeds.error && (
                <div className="text-sm text-red-600">{manageBreeds.error}</div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeManageBreeds} className="h-11 px-6 rounded-xl border border-slate-300 text-slate-600">Cancel</button>
                <button type="button" onClick={saveManageBreeds} className="h-11 px-6 rounded-xl bg-emerald-600 text-white font-semibold">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage Options (generic) */}
      {manageList.open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeManageList}></div>
          <div className="relative w-[95%] max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-emerald-200 p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-800">{manageList.title}</h3>
                <p className="text-sm text-slate-500">Edit, add, or delete options.</p>
              </div>
              <button onClick={closeManageList} className="text-slate-500 hover:text-slate-700 text-2xl leading-none">×</button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input value={manageList.newItem} onChange={e=>setManageList(prev=>({ ...prev, newItem: e.target.value }))} placeholder="New option" className="flex-1 h-11 px-3 rounded-lg border border-slate-300" />
                <button type="button" onClick={addManageListItem} className="h-11 px-4 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">Add</button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-sm min-w-[520px]">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Option</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manageList.items.map((it, idx) => (
                      <tr key={idx} className="border-t border-slate-100">
                        <td className="px-3 py-2">
                          <input value={it} onChange={e=>setManageListItem(idx, e.target.value)} className="w-full h-9 px-2 rounded border border-slate-300" />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button type="button" onClick={()=>removeManageListItem(idx)} className="h-9 px-3 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">Delete</button>
                        </td>
                      </tr>
                    ))}
                    {manageList.items.length === 0 && (
                      <tr><td colSpan="2" className="px-3 py-4 text-center text-slate-500">No options</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {manageList.error && (
                <div className="text-sm text-red-600">{manageList.error}</div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeManageList} className="h-11 px-6 rounded-xl border border-slate-300 text-slate-600">Cancel</button>
                <button type="button" onClick={saveManageList} className="h-11 px-6 rounded-xl bg-emerald-600 text-white font-semibold">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">×</button>
        </div>
      )}

      {/* Loading Indicator */}
      {false && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg flex items-center">
          <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Processing...</span>
        </div>
      )}

      {/* Enhanced Registration Card */}
      <div className="rounded-3xl bg-gradient-to-br from-white via-emerald-50 to-teal-50 shadow-2xl ring-1 ring-emerald-200 border border-emerald-100 p-8">
        <div className="mb-6 flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center">
            <FiUserPlus className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1">
            <div className="text-2xl font-bold text-slate-800 mb-1">Register New Pet</div>
            <div className="text-slate-600">Add comprehensive pet and owner information</div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-emerald-600">{filtered.length}</div>
            <div className="text-sm text-slate-600">Total Registered</div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white/60 rounded-2xl p-4 text-center">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <FiUser className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="font-semibold text-slate-800">Owner Details</div>
            <div className="text-sm text-slate-600">Complete owner information</div>
          </div>
          <div className="bg-white/60 rounded-2xl p-4 text-center">
            <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <FiHeart className="w-6 h-6 text-teal-600" />
            </div>
            <div className="font-semibold text-slate-800">Pet Information</div>
            <div className="text-sm text-slate-600">Detailed pet records</div>
          </div>
          <div className="bg-white/60 rounded-2xl p-4 text-center">
            <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <FiShield className="w-6 h-6 text-cyan-600" />
            </div>
            <div className="font-semibold text-slate-800">Medical History</div>
            <div className="text-sm text-slate-600">Health and vaccination records</div>
          </div>
        </div>
        
        <button 
          onClick={openCreate} 
          className="w-full h-16 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-lg shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 flex items-center justify-center gap-3"
        >
          <FiUserPlus className="w-6 h-6" />
          Open Registration Form
        </button>
      </div>

      {/* Modal Dialog */}
      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40"></div>
          <div className="relative w-[95%] max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl ring-1 ring-slate-200 p-6" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="font-semibold text-slate-800">{mode==='view'?'View Registration':mode==='edit'?'Edit Registration':'New Registration'}</div>
              <button onClick={()=>{setIsOpen(false); setMode('create'); setCurrentId('')}} className="text-slate-600 hover:text-slate-800 cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleSubmit} onKeyDown={focusNextFieldOnEnter} className="space-y-6">
          {/* 1. Owner Information */}
          <section className="rounded-xl p-4 bg-gradient-to-br from-slate-50 to-white ring-1 ring-slate-200/70">
            <div className="font-semibold text-slate-800 mb-3">Owner Information</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Client ID</label>
                <div className="relative">
                  <input 
                    value={form.owner.clientId} 
                    onChange={e => {
                      updateSection('owner','clientId',e.target.value)
                      if (e.target.value.trim()) {
                        handleClientIdValidation(e.target.value.trim())
                        tryOwnerLookup(e.target.value.trim())
                      } else {
                        setClientIdValidation({ isValidating: false, error: '', isValid: true })
                      }
                    }} 
                    onBlur={() => tryOwnerLookup()} 
                    placeholder="Enter or scan Client ID" 
                    className={`w-full h-10 px-3 rounded-lg border bg-white pr-10 ${
                      clientIdValidation.isValidating ? 'border-blue-300' :
                      !clientIdValidation.isValid ? 'border-red-300 bg-red-50' :
                      clientIdValidation.isValid && form.owner.clientId ? 'border-green-300 bg-green-50' :
                      'border-slate-300'
                    }`}
                    disabled={mode==='view'} 
                  />
                  {clientIdValidation.isValidating && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    </div>
                  )}
                  {!clientIdValidation.isValidating && form.owner.clientId && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      {clientIdValidation.isValid ? (
                        <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {clientIdValidation.error && (
                  <p className="text-red-600 text-xs mt-1 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {clientIdValidation.error}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input value={form.owner.fullName} onChange={e=>updateSection('owner','fullName',e.target.value)} placeholder="Full Name" className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" required disabled={mode==='view'} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">CNIC / ID Card No.</label>
                <input value={form.owner.nic} onChange={e=>updateSection('owner','nic',e.target.value)} onBlur={tryOwnerLookup} placeholder="CNIC / ID Card No." className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" disabled={mode==='view'} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contact Number</label>
                <input value={form.owner.contact} onChange={e=>updateSection('owner','contact',e.target.value)} onBlur={tryOwnerLookup} placeholder="Contact Number" className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" disabled={mode==='view'} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <input value={form.owner.email} onChange={e=>updateSection('owner','email',e.target.value)} placeholder="Email Address" className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" disabled={mode==='view'} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <input value={form.owner.address} onChange={e=>updateSection('owner','address',e.target.value)} placeholder="Address" className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" disabled={mode==='view'} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Emergency Contact Person</label>
                <input value={form.owner.emergencyContactPerson} onChange={e=>updateSection('owner','emergencyContactPerson',e.target.value)} placeholder="Emergency Contact Person" className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" disabled={mode==='view'} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Emergency Contact No.</label>
                <input value={form.owner.emergencyContactNumber} onChange={e=>updateSection('owner','emergencyContactNumber',e.target.value)} placeholder="Emergency Contact No." className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" disabled={mode==='view'} />
              </div>
            </div>
          </section>

          {matchedOwnerPets.length > 0 && (
            <section className="rounded-xl p-4 bg-gradient-to-br from-slate-50 to-white ring-1 ring-slate-200/70">
              <div className="font-semibold text-slate-800 mb-3">Existing Pets for this Client</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {matchedOwnerPets.map(p => (
                  <div key={p.id || p._id} className="border border-slate-200 rounded-lg p-3 bg-white">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-semibold text-slate-800">{p.petName || p.details?.pet?.petName || 'Pet'}</div>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${ (p.status || 'Active')==='Active' ? 'bg-emerald-100 text-emerald-700' : ((p.status==='Expired'||p.status==='Deceased') ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600') }`}>
                        {(p.status==='Deceased') ? 'Expired' : (p.status || 'Active')}
                      </span>
                    </div>
                    <div className="text-sm text-slate-600 space-y-0.5">
                      <div><span className="font-medium">Type:</span> {p.type || p.details?.pet?.type || '-'}</div>
                      <div><span className="font-medium">Breed:</span> {p.breed || p.details?.pet?.breed || '-'}</div>
                      <div><span className="font-medium">Gender:</span> {p.gender || p.details?.pet?.gender || '-'}</div>
                      <div><span className="font-medium">ID:</span> {p.id || p._id || p.details?.pet?.petId || '-'}</div>
                      {((p.status==='Expired'||p.status==='Deceased') && (p.dateOfDeath || p.details?.life?.deathDate)) && (
                        <div className="text-xs text-red-600 mt-1">Died: {formatLocalDate(p.dateOfDeath || p.details?.life?.deathDate)}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {(form.owner.clientId || form.owner.ownerId) && (
            <section className="rounded-xl p-4 bg-gradient-to-br from-indigo-50 to-white ring-1 ring-indigo-200/70">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold text-slate-800">Payment Summary</div>
                {payLoading && (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                )}
              </div>
              {payError && (
                <div className="mb-3 text-sm text-red-600">{payError}</div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="bg-white rounded-lg border border-indigo-200 p-3">
                  <div className="text-slate-600 text-xs">Total Billed</div>
                  <div className="text-xl font-bold text-slate-800">Rs. {Number(paymentSummary.totalBilled||0).toLocaleString()}</div>
                </div>
                <div className="bg-white rounded-lg border border-green-200 p-3">
                  <div className="text-slate-600 text-xs">Total Received</div>
                  <div className="text-xl font-bold text-green-700">Rs. {Number(paymentSummary.totalReceived||0).toLocaleString()}</div>
                </div>
                <div className="bg-white rounded-lg border border-amber-200 p-3">
                  <div className="text-slate-600 text-xs">Total Receivable (Balance)</div>
                  <div className="text-xl font-bold text-amber-700">Rs. {Number(paymentSummary.totalPending||0).toLocaleString()}</div>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 p-3">
                  <div className="text-slate-600 text-xs">Last Payment</div>
                  <div className="text-sm font-semibold text-slate-800">
                    {paymentSummary.lastPayment ? `Rs. ${Number(paymentSummary.lastPayment.amount||0).toLocaleString()} • ${formatLocalDate(paymentSummary.lastPayment.date)} • ${paymentSummary.lastPayment.mode || '—'}` : '—'}
                  </div>
                </div>
              </div>
              {paymentSummary.modules && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3">
                  {['pharmacy','lab','procedures','petShop'].map(key => (
                    <div key={key} className="bg-white rounded-lg border border-slate-200 p-3">
                      <div className="text-xs font-semibold text-slate-700 capitalize">{key === 'petShop' ? 'Pet Shop' : key}</div>
                      <div className="text-xs text-slate-600">Received: Rs. {Number(paymentSummary.modules?.[key]?.received||0).toLocaleString()}</div>
                      <div className="text-xs text-slate-600">Pending: Rs. {Number(paymentSummary.modules?.[key]?.pending||0).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3">
                {(() => {
                  const pid = String((currentId || form?.pet?.petId || '') || '')
                  const list = Array.isArray(paymentSummary.pets) ? paymentSummary.pets : []
                  const it = list.find(p => String(p.petId||'') === pid)
                  const pname = form?.pet?.petName || it?.petName || ''
                  const paid = !!(it && it.modules && it.modules.consultant && it.modules.consultant.paid)
                  const amt = Number(it?.modules?.consultant?.amount || 0)
                  const d = it?.modules?.consultant?.date || paymentSummary.consultant?.date || ''
                  return (
                    <div className={`p-3 rounded-lg ${paid ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                      {paid
                        ? `Consultant Fee Paid${pname?` for ${pname}`:''}: Rs. ${amt.toLocaleString()}${d?` on ${formatLocalDate(d)}`:''}`
                        : `Consultant Fee Pending${pname?` for ${pname}`:''}`}
                    </div>
                  )
                })()}
              </div>
              <div className="mt-3">
                {Array.isArray(paymentSummary.pets) && paymentSummary.pets.length > 0 && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Pet</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Pharmacy Due</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Lab Due</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Procedures Due</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Pet Shop Due</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Consultant</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Total Received</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Total Pending</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentSummary.pets.map(p => (
                          <tr key={p.petId} className="border-t border-slate-100">
                            <td className="px-3 py-2">{p.petName}</td>
                            <td className="px-3 py-2 text-right">{Number(p.modules?.pharmacy?.pending||0).toLocaleString()}</td>
                            <td className="px-3 py-2 text-right">{Number(p.modules?.lab?.pending||0).toLocaleString()}</td>
                            <td className="px-3 py-2 text-right">{Number(p.modules?.procedures?.pending||0).toLocaleString()}</td>
                            <td className="px-3 py-2 text-right">{Number(p.modules?.petShop?.pending||0).toLocaleString()}</td>
                            <td className="px-3 py-2">{p.modules?.consultant?.paid ? `Paid ${Number(p.modules.consultant.amount||0).toLocaleString()}` : 'Pending'}</td>
                            <td className="px-3 py-2 text-right">{Number(p.totals?.received||0).toLocaleString()}</td>
                            <td className="px-3 py-2 text-right">{Number(p.totals?.pending||0).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Date</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Source</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Amount</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Received</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Pending</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Mode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentSummary.entries.map(e => (
                      <tr key={e.id} className="border-t border-slate-100">
                        <td className="px-3 py-2">{formatLocalDate(e.date)}</td>
                        <td className="px-3 py-2">{e.type}</td>
                        <td className="px-3 py-2 text-right">{Number(e.amount||0).toLocaleString()}</td>
                        <td className="px-3 py-2 text-right">{Number(e.received||0).toLocaleString()}</td>
                        <td className="px-3 py-2 text-right">{Number(e.pending||0).toLocaleString()}</td>
                        <td className="px-3 py-2">{e.mode || '—'}</td>
                      </tr>
                    ))}
                    {paymentSummary.entries.length === 0 && (
                      <tr><td colSpan="6" className="px-3 py-4 text-center text-slate-500">No invoices found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 2. Pet Information */}
          <section className="rounded-xl p-4 bg-gradient-to-br from-teal-50 to-white ring-1 ring-teal-200/70">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Pet Name</label>
                <input value={form.pet.petName} onChange={e=>handlePetNameChange(e.target.value)} placeholder="Enter pet name" className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" required disabled={mode==='view'} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                <select 
                  value={form.pet.type}
                  onChange={e=>handleTypeChange(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white"
                  disabled={mode==='view'}
                >
                  <option value="">Select Type</option>
                  {typeOptions.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                  <option value="__add_new__">+ Add new</option>
                  <option value="__manage_types__">Manage</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Breed</label>
                <select 
                  value={form.pet.breed}
                  onChange={e=>handleBreedChange(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white"
                  disabled={mode==='view'}
                >
                  <option value="">Select Breed</option>
                  {breedOptions.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                  <option value="__add_breed__">+ Add new</option>
                  <option value="__manage_breeds__">Manage</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
                <select value={form.pet.gender} onChange={e=>{ const v=e.target.value; if(v==='__manage_gender__'){ openManageList('genderOptions','Manage Gender Options', genderOptions); return } updateSection('pet','gender',v) }} className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" disabled={mode==='view'}>
                  <option value="">Gender</option>
                  {genderOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                  <option value="__manage_gender__">Manage</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Species (auto)</label>
                <select 
                  value={form.pet.species}
                  onChange={e=>handleSpeciesSelectChange(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white"
                  disabled={mode==='view'}
                >
                  <option value="">Select Species</option>
                  {speciesOptions.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                  <option value="__add_species__">+ Add new</option>
                  <option value="__manage_types__">Manage</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth</label>
                <input type="date" value={form.pet.dateOfBirth} onChange={e=>{ const v=e.target.value; updateSection('pet','dateOfBirth', v); updateSection('pet','approxAge', v ? ageFromDOB(v) : '') }} className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" disabled={mode==='view'} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Approx. Age</label>
                <input value={form.pet.approxAge} onChange={e=>{ const v=e.target.value; updateSection('pet','approxAge', v); const dob = dobFromAgeText(v); if(dob) updateSection('pet','dateOfBirth', dob) }} placeholder="e.g. 10 days, 3 weeks, 2 months, 1 year or 3Y 2M 6D" className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" disabled={mode==='view'} />
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-slate-500">Pick either <strong>Date of Birth</strong> or enter <strong>Approx. Age</strong> (auto-calculates the other).</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Color / Markings</label>
              <input value={form.pet.colorMarkings} onChange={e=>updateSection('pet','colorMarkings',e.target.value)} placeholder="Color / Markings" className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" disabled={mode==='view'} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Microchip / Tag No. (if available)</label>
              <input value={form.pet.microchipTag} onChange={e=>updateSection('pet','microchipTag',e.target.value)} placeholder="Microchip / Tag No. (if available)" className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" disabled={mode==='view'} />
            </div>
            <div className="grid grid-cols-2 gap-3 md:col-span-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Neutered / Spayed</label>
                <select value={form.pet.neuteredSpayed} onChange={e=>{ const v=e.target.value; if(v==='__manage_neutered__'){ openManageList('neuteredSpayedOptions','Manage Neutered/Spayed Options', neuteredSpayedOptions); return } updateSection('pet','neuteredSpayed',v) }} className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" disabled={mode==='view'}>
                  <option value="">Select option</option>
                  {neuteredSpayedOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                  <option value="__manage_neutered__">Manage</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Vaccination Status</label>
                <select value={form.pet.vaccinationStatus} onChange={e=>{ const v=e.target.value; if(v==='__manage_vax_status__'){ openManageList('vaccinationStatusOptions','Manage Vaccination Status Options', vaccinationStatusOptions); return } updateSection('pet','vaccinationStatus',v) }} className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" disabled={mode==='view'}>
                  <option value="">Select option</option>
                  {vaccinationStatusOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                  <option value="__manage_vax_status__">Manage</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Deworming Status</label>
                <select value={form.pet.dewormingStatus} onChange={e=>{ const v=e.target.value; if(v==='__manage_deworm_status__'){ openManageList('dewormingStatusOptions','Manage Deworming Status Options', dewormingStatusOptions); return } updateSection('pet','dewormingStatus',v) }} className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" disabled={mode==='view'}>
                  <option value="">Select option</option>
                  {dewormingStatusOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                  <option value="__manage_deworm_status__">Manage</option>
                </select>
              </div>
            </div>
          </section>

          {/* 3. Medical & Behavioral History */}
          <section className="rounded-xl p-4 bg-gradient-to-br from-amber-50 to-white ring-1 ring-amber-200/70">
            <div className="font-semibold text-slate-800 mb-3">Medical & Behavioral History</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Known Allergies</label>
                <input value={form.medical.allergies} onChange={e=>updateSection('medical','allergies',e.target.value)} placeholder="Known Allergies" className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" disabled={mode==='view'} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Chronic Diseases / Ongoing Treatments</label>
                <input value={form.medical.chronicDiseases} onChange={e=>updateSection('medical','chronicDiseases',e.target.value)} placeholder="Chronic Diseases / Ongoing Treatments" className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" disabled={mode==='view'} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Previous Surgeries / Procedures</label>
                <input value={form.medical.previousSurgeries} onChange={e=>updateSection('medical','previousSurgeries',e.target.value)} placeholder="Previous Surgeries / Procedures" className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" disabled={mode==='view'} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Regular Medications</label>
                <input value={form.medical.regularMedications} onChange={e=>updateSection('medical','regularMedications',e.target.value)} placeholder="Regular Medications" className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" disabled={mode==='view'} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Dietary Habits</label>
                <input value={form.medical.dietaryHabits} onChange={e=>updateSection('medical','dietaryHabits',e.target.value)} placeholder="Dietary Habits" className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" disabled={mode==='view'} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Temperament / Behavior Notes</label>
                <input value={form.medical.temperamentNotes} onChange={e=>updateSection('medical','temperamentNotes',e.target.value)} placeholder="Temperament / Behavior Notes" className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" disabled={mode==='view'} />
              </div>
            </div>
          </section>

          {/* 4. Vaccination Record */}
          <section className="rounded-xl p-4 bg-gradient-to-br from-emerald-50 to-white ring-1 ring-emerald-200/70">
            <div className="font-semibold text-slate-800 mb-3">Vaccination Record (if available)</div>
            <div className="grid grid-cols-1 gap-3">
              {form.vaccines.map((v, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Vaccine</label>
                    <div className="relative">
                      <button type="button" onClick={()=>{ if(mode!=='view'){ setOpenVaccIndex(openVaccIndex===idx? -1 : idx) } }} className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-left">
                        {v.name || 'Vaccine'}
                      </button>
                      {openVaccIndex===idx && (
                        <div className="absolute z-[60] mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                          {Array.from(new Set([v.name, ...vaccineItems].filter(Boolean))).map(opt => (
                            <div key={opt} onClick={()=>{ updateVaccine(idx,'name', opt); setOpenVaccIndex(-1) }} className="px-3 py-2 hover:bg-slate-50 cursor-pointer">{opt}</div>
                          ))}
                          <div className="border-t border-slate-100"></div>
                          <button type="button" onClick={()=>openQuickAdd('vaccine', idx)} className="w-full text-left px-3 py-2 text-indigo-600 hover:bg-indigo-50 cursor-pointer">+ ADD NEW</button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Date Given</label>
                    <input type="date" value={v.dateGiven} onChange={e=>updateVaccine(idx,'dateGiven',e.target.value)} className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" disabled={mode==='view'} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Next Due (auto)</label>
                    <input value={v.nextDue} readOnly placeholder="Next Due (auto)" className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Vet's Name / Signature</label>
                    <input value={v.vet} onChange={e=>updateVaccine(idx,'vet',e.target.value)} placeholder="Vet's Name / Signature" className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" disabled={mode==='view'} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Shot Stage</label>
                    <select value={v.shotStage} onChange={e=>updateVaccine(idx,'shotStage',e.target.value)} className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" disabled={mode==='view'}>
                      <option value="">Shot Stage</option>
                      <option>1st</option>
                      <option>2nd</option>
                      <option>3rd</option>
                      <option>4th</option>
                      <option>Annual</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-xs text-slate-600 mt-2">Note: 1st–3rd shots → next due +21 days; 4th/Annual → +1 year.</div>
          </section>

          {/* Deworming (separate from Vaccination) */}
          <section className="rounded-xl p-4 bg-gradient-to-br from-lime-50 to-white ring-1 ring-lime-200/70">
            <div className="font-semibold text-slate-800 mb-3">Deworming (if available)</div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Deworming Name</label>
                <div className="relative">
                  <button type="button" onClick={()=>{ if(mode!=='view'){ setOpenDeworm(!openDeworm) } }} className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-left">
                    {form.deworming?.name || 'Deworming'}
                  </button>
                  {openDeworm && (
                    <div className="absolute z-[60] mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                      {Array.from(new Set([form.deworming?.name, ...dewormItems].filter(Boolean))).map(opt => (
                        <div key={opt} onClick={()=>{ updateDeworming('name', opt); setOpenDeworm(false) }} className="px-3 py-2 hover:bg-slate-50 cursor-pointer">{opt}</div>
                      ))}
                      <div className="border-t border-slate-100"></div>
                      <button type="button" onClick={()=>openQuickAdd('deworm')} className="w-full text-left px-3 py-2 text-indigo-600 hover:bg-indigo-50 cursor-pointer">+ ADD NEW</button>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date Given</label>
                <input type="date" value={form.deworming?.dateGiven || ''} onChange={e=>updateDeworming('dateGiven', e.target.value)} className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" disabled={mode==='view'} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Next Deworming Days</label>
                <input type="number" min="1" value={form.deworming?.days ?? 90} onChange={e=>updateDeworming('days', e.target.value)} placeholder="e.g. 90" className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" disabled={mode==='view'} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Next Due (auto)</label>
                <input value={form.deworming?.nextDue || ''} readOnly placeholder="Next Due (auto)" className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Vet's Name / Signature</label>
                <input value={form.deworming?.vet || ''} onChange={e=>updateDeworming('vet', e.target.value)} placeholder="Vet's Name / Signature" className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" disabled={mode==='view'} />
              </div>
            </div>
            <div className="text-xs text-slate-600 mt-2">Note: Deworming next due = Date Given + entered days (default 90).</div>
          </section>

          {/* 5. Chief Complaint */}
          <section className="rounded-xl p-4 bg-gradient-to-br from-rose-50 to-white ring-1 ring-rose-200/70">
            <div className="font-semibold text-slate-800 mb-3">Chief Complaint</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Visit Type</label>
                <select value={form.complaint.visitType} onChange={e=>setForm(prev=>({ ...prev, complaint:{ ...prev.complaint, visitType: e.target.value } }))} className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" disabled={mode==='view'}>
                  <option>Emergency</option>
                  <option>Routine</option>
                  <option>Follow-up</option>
                  <option>Vaccination</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Chief Complaint</label>
                <input value={form.complaint.chiefComplaint} onChange={e=>setForm(prev=>({ ...prev, complaint:{ ...prev.complaint, chiefComplaint: e.target.value } }))} placeholder="Chief Complaint" className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" disabled={mode==='view'} />
              </div>
            </div>
          </section>

          {/* 6. Clinic Use Only */}
          <section className="rounded-xl p-4 bg-gradient-to-br from-sky-50 to-white ring-1 ring-sky-200/70">
            <div className="font-semibold text-slate-800 mb-3">Clinic Use Only</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date of Registration</label>
                <input type="date" value={form.clinic.dateOfRegistration} onChange={e=>updateSection('clinic','dateOfRegistration',e.target.value)} placeholder="Date of Registration" className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" disabled={mode==='view'} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Registered By (Staff Name)</label>
                <input value={form.clinic.registeredBy} onChange={e=>updateSection('clinic','registeredBy',e.target.value)} placeholder="Registered By (Staff Name)" className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" disabled={mode==='view'} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Consulting Veterinarian</label>
                <select
                  value={form.clinic.consultingVet}
                  onChange={e=>updateSection('clinic','consultingVet',e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white"
                  disabled={mode==='view'}
                >
                  <option value="">Select Consulting Veterinarian</option>
                  {doctorOptions.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                  {doctorOptions.length === 0 && (
                    <option value="Dr. Mazhar Hussain">Dr. Mazhar Hussain</option>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Record Entered</label>
                <select value={form.clinic.recordEntered} onChange={e=>updateSection('clinic','recordEntered',e.target.value)} className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" disabled={mode==='view'}>
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Remarks / Notes</label>
                <input value={form.clinic.remarks} onChange={e=>updateSection('clinic','remarks',e.target.value)} placeholder="Remarks / Notes" className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" disabled={mode==='view'} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Consultant Fees (Optional)</label>
                <input value={form.clinic.consultantFees} onChange={e=>updateSection('clinic','consultantFees',e.target.value)} placeholder="Consultant Fees (Optional)" type="number" min="0" step="0.01" className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" disabled={mode==='view'} />
              </div>
            </div>
          </section>

          {/* Life Status */}
          <section className="rounded-xl p-4 bg-gradient-to-br from-red-50 to-white ring-1 ring-red-200/70">
            <div className="font-semibold text-slate-800 mb-3">Life Status</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="flex items-center gap-2">
                <input
                  id="life-dead"
                  type="checkbox"
                  checked={!!form.life?.dead}
                  onChange={e=>{
                    const v = !!e.target.checked
                    setForm(prev=>({
                      ...prev,
                      life: {
                        ...(prev.life||{}),
                        dead: v,
                        deathDate: v ? (prev.life?.deathDate || new Date().toISOString().slice(0,10)) : '',
                        deathNote: v ? (prev.life?.deathNote || '') : ''
                      }
                    }))
                  }}
                  disabled={mode==='view'}
                />
                <label htmlFor="life-dead" className="text-sm font-medium text-slate-700">Mark as Dead / Expired</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date of Death</label>
                <input type="date" value={form.life?.deathDate||''} onChange={e=>updateSection('life','deathDate',e.target.value)} disabled={mode==='view' || !form.life?.dead} className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <input value={form.life?.deathNote||''} onChange={e=>updateSection('life','deathNote',e.target.value)} placeholder="Reason / notes" disabled={mode==='view' || !form.life?.dead} className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white" />
              </div>
            </div>
            {form.life?.dead && form.life?.deathDate && (
              <div className="mt-2 text-sm text-red-700">This pet will be marked as Expired. Date: {formatLocalDate(form.life.deathDate)}</div>
            )}
          </section>

          {/* Radiology Records (view mode) */}
          {mode==='view' && (()=>{
            const current = rows.find(r => (r.id===currentId || r._id===currentId)) || {}
            let records = Array.isArray(current?.details?.radiology) ? [...current.details.radiology] : []
            if (!records.length) {
              try {
                const local = JSON.parse(localStorage.getItem('radiology_records')||'[]')
                records = local.filter(r => (r.patientId||'') === (current?.id||''))
              } catch {}
            }
            if (!records.length) return null
            records.sort((a,b)=> new Date(b.testDate || b.createdAt || 0) - new Date(a.testDate || a.createdAt || 0))
            return (
              <section className="rounded-xl p-4 bg-gradient-to-br from-rose-50 to-white ring-1 ring-rose-200/70">
                <div className="font-semibold text-slate-800 mb-3">Radiology Records</div>
                <div className="space-y-3">
                  {records.map((rec, idx) => (
                    <div key={idx} className="border border-rose-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">{rec.testType || 'Imaging'}</span>
                        <span className="text-xs text-slate-500">{new Date(rec.testDate || rec.createdAt || Date.now()).toLocaleDateString()}</span>
                      </div>
                      <div className="text-sm text-slate-600">
                        {rec.bodyPart && <div><span className="font-medium">Body Part:</span> {rec.bodyPart}</div>}
                        {rec.findings && <div className="mt-1"><span className="font-medium">Findings:</span> {rec.findings}</div>}
                      </div>
                      {Array.isArray(rec.images) && rec.images.length>0 && (
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-2">
                          {rec.images.slice(0,5).map((img,i)=> (
                            <img key={i} src={img.data} alt={`img-${i}`} className="w-full h-20 object-cover rounded border" />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )
          })()}

          {mode!=='view' && (
            <div className="flex items-center gap-2">
              <button className="px-4 h-10 rounded-lg bg-sky-600 hover:bg-sky-700 text-white shadow-sm cursor-pointer">Save Registration</button>
              {currentId && (
                <button type="button" onClick={(e)=>{ e.preventDefault(); openReceiptDialog() }} className="px-4 h-10 rounded-lg bg-slate-700 hover:bg-slate-800 text-white shadow-sm cursor-pointer">Print Receipt</button>
              )}
            </div>
          )}
        </form>
          </div>
        </div>
      ) : null}

      {/* Receipt Dialog */}
      {receiptOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setReceiptOpen(false)}></div>
          <div className="relative w-[95%] max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-xl ring-1 ring-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="font-semibold text-slate-800">Registration Receipt</div>
              <button className="text-slate-500 hover:text-slate-700 cursor-pointer" onClick={()=>setReceiptOpen(false)}>Close</button>
            </div>
            {/* Compact hospital header */}
            <div className="mb-4 text-center">
              {hospital.logo && (
                <div className="mb-3 flex justify-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-sky-50 to-blue-50 rounded-xl border-2 border-sky-200 flex items-center justify-center p-2 shadow-sm">
                    <img 
                      src={hospital.logo} 
                      alt={hospital.name + ' Logo'} 
                      className="max-h-full max-w-full object-contain"
                      onError={(e) => {
                        e.target.style.display = 'none'
                        e.target.parentElement.style.display = 'none'
                      }}
                    />
                  </div>
                </div>
              )}
              <div className="text-lg font-semibold text-sky-700">{hospital.name}</div>
              <div className="text-xs text-slate-500 mt-1">{hospital.tagline}</div>
              {hospital.address !== '—' && <div className="text-xs text-slate-500">{hospital.address}</div>}
              {hospital.phone !== '—' && <div className="text-xs text-slate-500">Phone: {hospital.phone}</div>}
            </div>

            {/* Minimal fields only */}
            <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200/70 p-4 mb-4 text-sm">
              <div className="flex items-center justify-between">
                <div><span className="text-slate-500">Receipt No.</span><div className="font-medium">{receipt?.id}</div></div>
                <div className="text-right"><span className="text-slate-500">Visit Date/Time</span><div className="font-medium">{receipt ? new Date(receipt.when).toLocaleString() : ''}</div></div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 text-sm">
              <div className="flex items-center justify-between gap-6">
                <div className="text-slate-500">Owner ID</div>
                <div className="font-medium">{receipt?.details?.owner?.ownerId || '-'}</div>
              </div>
              <div className="flex items-center justify-between gap-6">
                <div className="text-slate-500">Owner Name</div>
                <div className="font-medium">{receipt?.details?.owner?.fullName || '-'}</div>
              </div>
              <div className="flex items-center justify-between gap-6">
                <div className="text-slate-500">Pet ID</div>
                <div className="font-medium">{receipt?.details?.pet?.petId || '-'}</div>
              </div>
              <div className="flex items-center justify-between gap-6">
                <div className="text-slate-500">Pet Name</div>
                <div className="font-medium">{receipt?.details?.pet?.petName || '-'}</div>
              </div>
              {receipt?.details?.clinic?.consultantFees && parseFloat(receipt.details.clinic.consultantFees) > 0 && (
                <div className="flex items-center justify-between gap-6 pt-2 border-t border-slate-200">
                  <div className="text-slate-500 font-semibold">Consultant Fees</div>
                  <div className="font-bold text-lg text-emerald-600">Rs. {parseFloat(receipt.details.clinic.consultantFees).toFixed(2)}</div>
                </div>
              )}
            </div>

            <div className="text-xs text-slate-500 mt-4 text-center">
              System-generated receipt • {new Date().toLocaleDateString()}
            </div>
            <div className="mt-6 flex items-center gap-3 justify-center">
              <button onClick={()=>setReceiptOpen(false)} className="px-6 h-12 rounded-xl bg-gradient-to-r from-slate-600 to-gray-600 hover:from-slate-700 hover:to-gray-700 text-white font-semibold cursor-pointer transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
                OK
              </button>
              <button onClick={() => printReceipt(receipt)} className="px-6 h-12 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold cursor-pointer transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd"/></svg>
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Enhanced Registered Pets List (suspended while dialogs are open for speed) */}
      {(!isOpen && !receiptOpen) && (
        <div className="rounded-3xl bg-gradient-to-br from-white via-emerald-50 to-teal-50 shadow-2xl ring-1 ring-emerald-200 border border-emerald-100 p-8">
          <div className="mb-6 flex items-center justify-between gap-3 flex-nowrap min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shrink-0">
                <FiHeart className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0 flex items-baseline gap-2">
                <div className="text-xl font-bold text-slate-800 truncate">Registered Pets</div>
                <div className="text-sm text-slate-600 whitespace-nowrap">{filtered.length} pets</div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-nowrap min-w-0">
              <div className="relative w-56 md:w-72 min-w-0">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search..."
                  className="h-10 pl-10 pr-3 rounded-xl border border-slate-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 bg-white w-full shadow-md transition-all duration-200 text-sm"
                />
              </div>

              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-10 px-3 rounded-xl border border-slate-200 bg-white shadow-md text-sm"
              >
                <option value={10}>10</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="h-10 px-3 rounded-xl border border-slate-200 bg-white shadow-md text-sm disabled:opacity-50"
                >
                  Prev
                </button>
                <div className="text-sm text-slate-600 whitespace-nowrap">
                  Page {Math.min(page, totalPages)} / {totalPages}
                </div>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="h-10 px-3 rounded-xl border border-slate-200 bg-white shadow-md text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>

              <input
                ref={importInputRef}
                onChange={handleImportFile}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
              />

              <button
                onClick={handleImportClick}
                disabled={importing}
                className="px-4 h-10 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2 whitespace-nowrap"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 3a1 1 0 011-1h12a1 1 0 011 1v6a1 1 0 11-2 0V4H5v12h4a1 1 0 110 2H4a1 1 0 01-1-1V3z" />
                  <path d="M10 6a1 1 0 011 1v4.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3A1 1 0 016.707 10.293L8 11.586V7a1 1 0 011-1z" />
                </svg>
                {importing ? 'Importing...' : 'Import'}
              </button>

              <button
                onClick={exportExcelCSV}
                disabled={exporting}
                className="px-4 h-10 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2 whitespace-nowrap"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M3 3a1 1 0 011-1h12a1 1 0 011 1v6a1 1 0 11-2 0V4H5v12h4a1 1 0 110 2H4a1 1 0 01-1-1V3zm11.707 6.293a1 1 0 010 1.414L12.414 13H17a1 1 0 110 2h-4.586l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                {exporting ? 'Exporting...' : 'Export'}
              </button>

              <button
                onClick={handleDeleteAllPets}
                className="px-4 h-10 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2 whitespace-nowrap"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                Delete All
              </button>
            </div>
          </div>
          <div className="grid gap-6">
          <div className="text-sm text-slate-600">
            Showing {filtered.length ? (((Math.min(page, totalPages) - 1) * pageSize) + 1) : 0}-{Math.min(filtered.length, (Math.min(page, totalPages) * pageSize))} of {filtered.length}
          </div>
          {pagedPets.map(r => (
            <div key={r.id} className="group">
              <div className="rounded-3xl border-2 border-slate-200 bg-gradient-to-br from-white via-slate-50 to-emerald-50 hover:from-emerald-50 hover:to-teal-50 hover:border-emerald-300 transition-all duration-300 shadow-lg hover:shadow-2xl p-6 group-hover:-translate-y-1">
                <div className="flex items-start justify-between gap-6">
                  <div className="flex items-start gap-4 flex-1">
                    {/* Pet Avatar */}
                    <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shrink-0">
                      <span className="text-2xl font-bold text-white">
                        {r.petName ? r.petName.charAt(0).toUpperCase() : '🐾'}
                      </span>
                    </div>
                    
                    {/* Pet Information */}
                    <div className="flex-1 min-w-0">
                      {/* Pet ID Badge */}
                      <div className="flex items-center gap-3 mb-3">
                        <button 
                          title="Click to copy Pet ID" 
                          onClick={()=>{ 
                            navigator.clipboard?.writeText(r.id); 
                            // Show copied feedback
                            const btn = event.target;
                            const original = btn.textContent;
                            btn.textContent = 'Copied!';
                            btn.className = btn.className.replace('bg-emerald-100', 'bg-green-100').replace('text-emerald-700', 'text-green-700');
                            setTimeout(() => {
                              btn.textContent = original;
                              btn.className = btn.className.replace('bg-green-100', 'bg-emerald-100').replace('text-green-700', 'text-emerald-700');
                            }, 1200);
                          }} 
                          className="px-3 py-2 text-sm font-mono bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-xl border border-emerald-200 cursor-pointer transition-all duration-200 flex items-center gap-2 shadow-sm"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/>
                            <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/>
                          </svg>
                          {r.id}
                        </button>
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">Click ID to copy</span>
                      </div>
                      
                      {/* Pet Details */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-2xl font-bold text-slate-900">{r.petName}</h3>
                          {(r.status==='Expired'||r.status==='Deceased') && (
                            <span className="px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                              Expired{r.dateOfDeath ? (' • ' + formatLocalDate(r.dateOfDeath)) : ''}
                            </span>
                          )}
                          <span className="text-slate-400">•</span>
                          <span className="text-lg font-semibold text-emerald-600">{r.type}</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-lg text-slate-600">{r.breed}</span>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-slate-600">
                          <div className="flex items-center gap-1">
                            <span className="font-semibold">Gender:</span>
                            <span className="bg-slate-100 px-2 py-1 rounded-lg">{r.gender || 'Unknown'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-semibold">Age:</span>
                            <span className="bg-slate-100 px-2 py-1 rounded-lg">{r.age || 'Unknown'}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-semibold text-slate-700">Owner:</span>
                          <span className="text-slate-900 font-medium">{r.ownerName}</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-600">{r.ownerContact}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex flex-col gap-3 shrink-0">
                    <button 
                      onClick={()=>openView(r)} 
                      className="px-6 py-3 rounded-xl border-2 border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 font-semibold cursor-pointer transition-all duration-200 flex items-center gap-2 shadow-sm hover:shadow-md"
                    >
                      <FiUser className="w-4 h-4" />
                      View
                    </button>
                    <button 
                      onClick={()=>openEdit(r)} 
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold cursor-pointer transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                      </svg>
                      Edit
                    </button>
                    <button 
                      onClick={()=>askDelete(r)} 
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white font-semibold cursor-pointer transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/>
                      </svg>
                      Delete
                    </button>
                  </div>
                </div>
                {r.details && (
                  <div className="mt-2 text-xs text-slate-600">
                    <div className="flex flex-wrap gap-y-1 gap-x-3">
                      <span>Vaccination: <span className="font-medium">{r.details.pet?.vaccinationStatus || 'Unknown'}</span></span>
                      <span>•</span>
                      <span>Deworming: <span className="font-medium">{r.details.pet?.dewormingStatus || 'Unknown'}</span></span>
                    </div>
                    {Array.isArray(r.details.vaccines) && r.details.vaccines.some(v=>v.nextDue) && (
                      <div className="mt-1 text-slate-500">Next Due: {r.details.vaccines.filter(v=>v.nextDue).map(v=>`${v.name}: ${v.nextDue}`).join(' • ')}</div>
                    )}
                    {r.details?.deworming?.nextDue && (
                      <div className="mt-1 text-slate-500">Deworming Next Due: {r.details.deworming.nextDue}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {filtered.length===0 && (
            <div className="py-16 text-center">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiHeart className="w-10 h-10 text-slate-400" />
              </div>
              <div className="text-slate-500 text-xl font-medium">No pets found</div>
              <div className="text-slate-400 text-sm mt-1">Try adjusting your search or register a new pet</div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && rowToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70]">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 ring-1 ring-slate-200/70">
            <div className="flex items-center gap-4 mb-4">
              <div className="h-12 w-12 rounded-full bg-red-100 text-red-600 grid place-items-center">!</div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Confirm Delete</h3>
                <p className="text-slate-500 text-sm">Are you sure you want to delete this pet registration?</p>
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 mb-5 text-sm text-slate-700">
              <div><span className="font-medium">Pet:</span> {rowToDelete.petName} • {rowToDelete.type} • {rowToDelete.breed}</div>
              <div><span className="font-medium">Owner:</span> {rowToDelete.ownerName} ({rowToDelete.contact})</div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={cancelDelete} className="px-4 h-10 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer">Cancel</button>
              <button onClick={confirmDelete} className="px-4 h-10 rounded-lg bg-red-600 text-white hover:bg-red-700 cursor-pointer">Delete</button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80]">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 ring-1 ring-slate-200/70">
            <div className="text-lg font-bold text-slate-900 mb-2">{confirmDialog.title}</div>
            <div className="text-slate-600 whitespace-pre-line mb-5">{confirmDialog.message}</div>
            <div className="flex justify-end gap-3">
              <button onClick={()=>setConfirmDialog(d=>({ ...d, open:false }))} className="px-4 h-10 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer">{confirmDialog.cancelText || 'Cancel'}</button>
              <button onClick={()=>{ const fn = confirmDialog.onConfirm; if (typeof fn === 'function') fn(); }} className="px-4 h-10 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer">{confirmDialog.confirmText || 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}

      {quickAdd.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[90]">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 ring-1 ring-slate-200/70">
            <div className="text-lg font-bold text-slate-900 mb-2">Add {quickAdd.type==='vaccine' ? 'Vaccine' : 'Deworming Item'}</div>
            <div className="space-y-3">
              <input
                autoFocus
                value={quickAdd.value}
                onChange={e=>setQuickAdd(prev=>({ ...prev, value: e.target.value }))}
                onKeyDown={e=>{ if(e.key==='Enter') saveQuickAdd() }}
                placeholder={quickAdd.type==='vaccine' ? 'e.g., Rabies' : 'e.g., Albendazole'}
                className="w-full h-11 px-3 rounded-lg border border-slate-300"
              />
              <div className="flex justify-end gap-3">
                <button onClick={()=>setQuickAdd({ open:false, type:'', value:'', targetIndex:-1 })} className="px-4 h-10 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer">Cancel</button>
                <button onClick={saveQuickAdd} className="px-4 h-10 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}