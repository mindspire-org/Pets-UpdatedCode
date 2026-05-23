import React, { useEffect, useMemo, useState } from 'react'
import { FiCalendar, FiSearch, FiClock, FiUser, FiHeart, FiStar, FiActivity, FiCheckCircle, FiInfo, FiDollarSign } from 'react-icons/fi'
import { useActivity } from '../../context/ActivityContext'
import { appointmentsAPI, petsAPI, doctorProfileAPI, usersAPI } from '../../services/api'
import DateRangePicker from '../../components/DateRangePicker'

export default function ReceptionAppointments(){
  const [form, setForm] = useState({ 
    petId:'', 
    petName:'', 
    ownerName:'', 
    contact:'', 
    petType:'', 
    petSpecies:'', 
    gender:'', 
    age:'', 
    registrationDate: '',
    doctor:'', 
    date:'', 
    time:'', 
    purpose:'', 
    status:'Scheduled' 
  })
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [doctors, setDoctors] = useState([])
  const { addActivity } = useActivity()

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
    Quail: 'Coturnix coturnix',
    Other: 'Other'
  }

  const resolveTypeFromScientificSpecies = (value) => {
    const v = String(value || '').trim();
    if (!v) return '';
    const s = v.toLowerCase();
    if (s.includes('canis lupus familiaris')) return 'Dog';
    if (s.includes('felis catus') || s.includes('felis silvestris catus') || s.includes('felis')) return 'Cat';
    if (s.includes('gallus gallus domesticus')) return 'Chicken';
    if (s.includes('capra hircus')) return 'Goat';
    if (s.includes('oryctolagus cuniculus')) return 'Rabbit';
    if (s.includes('ovis aries')) return 'Sheep';
    if (s.includes('bos taurus')) return 'Cow';
    if (s.includes('equus caballus')) return 'Horse';
    if (s.includes('equus asinus')) return 'Donkey';
    if (s.includes('psittaciformes')) return 'Parrot';
    if (s.includes('columbinae')) return 'Pigeon';
    if (s.includes('pavo cristatus')) return 'Peacock';
    if (s.includes('meleagris')) return 'Turkey';
    if (s.includes('coturnix coturnix')) return 'Quail';
    if (s.includes('other')) return 'Other';
    return '';
  };

  const resolvePetType = (pet) => {
    const direct = pet?.type || pet?.petType || pet?.details?.pet?.type;
    if (direct) return direct;
    const sci = pet?.species || pet?.details?.pet?.species;
    return resolveTypeFromScientificSpecies(sci) || '';
  };

  const resolveScientificSpecies = (pet) => {
    const direct = pet?.species || pet?.details?.pet?.species;
    if (direct) return direct;
    const t = pet?.type || pet?.petType || pet?.details?.pet?.type;
    return TYPE_TO_SPECIES[t] || '';
  };

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [dateRange, setDateRange] = useState({
    fromDate: new Date().toISOString().slice(0,10),
    toDate: new Date().toISOString().slice(0,10)
  })
  const [singleDate, setSingleDate] = useState('')

  // Load appointments from MongoDB
  useEffect(() => {
    loadAppointments()
    loadDoctors()
  }, [])

  const loadDoctors = async () => {
    try {
      console.log('Loading doctors...')
      
      // First try to load from doctor profiles
      const response = await doctorProfileAPI.list()
      console.log('Doctor API response:', response)
      
      let doctorsList = []
      
      if (response && response.data && response.data.length > 0) {
        console.log('Doctors from API:', response.data)
        doctorsList = response.data
      } else {
        // Fallback to localStorage if API returns empty
        const cached = JSON.parse(localStorage.getItem('doctor_profiles') || '[]')
        console.log('Doctors from localStorage:', cached)
        doctorsList = cached
      }
      
      // If still no doctors, try to get users with doctor role
      if (doctorsList.length === 0) {
        try {
          console.log('No doctor profiles found, checking users with doctor role...')
          const usersResponse = await usersAPI.getAll()
          if (usersResponse && usersResponse.data) {
            const doctorUsers = usersResponse.data.filter(user => user.role === 'doctor')
            console.log('Doctor users found:', doctorUsers)
            
            // Convert user accounts to doctor format
            doctorsList = doctorUsers.map(user => ({
              _id: user._id || user.username,
              username: user.username,
              name: user.name || user.username,
              fee: 0, // Default fee, can be updated later
              specialization: '',
              phone: '',
              email: user.email || ''
            }))
          }
        } catch (userErr) {
          console.error('Error loading doctor users:', userErr)
        }
      }
      
      console.log('Final doctors list:', doctorsList)
      setDoctors(doctorsList)
      
      if (doctorsList.length > 0) {
        localStorage.setItem('doctor_profiles', JSON.stringify(doctorsList))
      }
      
    } catch (err) {
      console.error('Error loading doctors:', err)
      // Fallback to localStorage on error
      try {
        const cached = JSON.parse(localStorage.getItem('doctor_profiles') || '[]')
        console.log('Doctors from localStorage (error fallback):', cached)
        setDoctors(cached)
      } catch (e) {
        console.error('Error loading cached doctors:', e)
      }
    }
  }

  // Also add a useEffect to log when doctors state changes
  useEffect(() => {
    console.log('Doctors state updated:', doctors)
  }, [doctors])

  const todayISO = () => new Date().toISOString().slice(0,10)
  const ALL_FROM = '1900-01-01'
  const ALL_TO = '2999-12-31'
  const lastNDays = (n) => {
    const to = todayISO()
    const d = new Date()
    d.setDate(d.getDate() - (n - 1))
    const from = d.toISOString().slice(0,10)
    return { from, to }
  }

  useEffect(() => {
    if (!showAll) {
      const { from, to } = lastNDays(10)
      setDateRange({ fromDate: from, toDate: to })
    }
  }, [showAll])

  const loadAppointments = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await appointmentsAPI.getAll()
      if (response && response.data) {
        setRows(response.data)
        localStorage.setItem('reception_appointments', JSON.stringify(response.data))
      }
    } catch (err) {
      console.error('Error loading appointments:', err)
      setError('Failed to load appointments')
      try {
        const stored = localStorage.getItem('reception_appointments')
        if (stored) setRows(JSON.parse(stored))
      } catch (e) {}
    } finally {
      setLoading(false)
    }
  }

  // Auto-refresh appointments data when localStorage changes (for real-time updates from doctor portal)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'reception_appointments') {
        try {
          const updatedAppointments = JSON.parse(e.newValue || '[]')
          setRows(updatedAppointments)
        } catch (error) {
          console.error('Error parsing updated appointments:', error)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  // Also check for updates when window gains focus (for same-tab updates)
  useEffect(() => {
    const handleFocus = () => {
      try {
        const currentAppointments = JSON.parse(localStorage.getItem('reception_appointments')||'[]')
        setRows(currentAppointments)
      } catch (error) {
        console.error('Error refreshing appointments on focus:', error)
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  const handleChange = e => {
    const { name, value } = e.target
    
    // Handle doctor selection
    if (name === 'doctor') {
      setForm(prev => ({...prev, doctor: value}))
      return
    }
    
    setForm(prev => ({...prev, [name]: value}))
    
    // Auto-fill pet information when Pet ID is entered
    if (name === 'petId') {
      if (value.trim()) {
        const pets = JSON.parse(localStorage.getItem('reception_pets')||'[]')
        const foundPet = pets.find(p => {
          const pid = String(p?.id || p?.petId || p?.patientId || p?._id || p?.details?.pet?.petId || '').trim()
          return pid === value.trim()
        })
        if (foundPet) {
          const resolvedType = resolvePetType(foundPet);
          const resolvedSpecies = resolveScientificSpecies(foundPet);
          const petName = foundPet.petName || foundPet?.details?.pet?.petName || ''
          const ownerName = foundPet.ownerName || foundPet?.details?.owner?.fullName || ''
          const contact = foundPet.ownerContact || foundPet.contact || foundPet?.details?.owner?.contact || ''
          const gender = foundPet.gender || foundPet?.details?.pet?.gender || ''
          const age = foundPet.age || foundPet?.details?.pet?.approxAge || foundPet?.details?.pet?.age || ''
          const registrationDate = foundPet.details?.clinic?.dateOfRegistration || foundPet.createdAt || ''
          setForm(prev => ({
            ...prev,
            petName,
            ownerName,
            contact,
            petType: resolvedType || '',
            petSpecies: resolvedSpecies || '',
            gender,
            age,
            registrationDate
          }))
        }
      } else {
        // Clear pet details when Pet ID is removed
        setForm(prev => ({
          ...prev,
          petName: '',
          ownerName: '',
          contact: '',
          petType: '',
          petSpecies: '',
          gender: '',
          age: '',
          registrationDate: ''
        }))
      }
    }
    
    // Auto-generate Pet ID when pet info is entered for new pets
    if ((name === 'petName' || name === 'ownerName') && value.trim() && !form.petId) {
      // Check if this combination already exists
      const pets = JSON.parse(localStorage.getItem('reception_pets')||'[]')
      const existingPet = pets.find(p => 
        p.petName?.toLowerCase() === (name === 'petName' ? value : form.petName)?.toLowerCase() && 
        p.ownerName?.toLowerCase() === (name === 'ownerName' ? value : form.ownerName)?.toLowerCase()
      )
      
      if (existingPet) {
        const resolvedType = resolvePetType(existingPet);
        const resolvedSpecies = resolveScientificSpecies(existingPet);
        const existingId = existingPet.id || existingPet.petId || existingPet.patientId || existingPet._id || existingPet?.details?.pet?.petId
        const existingContact = existingPet.contact || existingPet.ownerContact || existingPet?.details?.owner?.contact
        const existingGender = existingPet.gender || existingPet?.details?.pet?.gender
        const existingAge = existingPet.age || existingPet?.details?.pet?.approxAge || existingPet?.details?.pet?.age
        const existingRegDate = existingPet.details?.clinic?.dateOfRegistration || existingPet.createdAt || ''
        // If pet exists, fill the ID and other details
        setForm(prev => ({
          ...prev,
          petId: existingId || prev.petId,
          petName: existingPet.petName || existingPet?.details?.pet?.petName || prev.petName,
          ownerName: existingPet.ownerName || existingPet?.details?.owner?.fullName || prev.ownerName,
          contact: existingContact || prev.contact,
          petType: resolvedType || prev.petType,
          petSpecies: resolvedSpecies || prev.petSpecies,
          gender: existingGender || prev.gender,
          age: existingAge || prev.age,
          registrationDate: existingRegDate || prev.registrationDate
        }))
      } else if (form.petName && form.ownerName && (name === 'petName' ? value : form.petName) && (name === 'ownerName' ? value : form.ownerName)) {
        // Generate new Pet ID for unregistered pet
        const newPetId = `PET-${Date.now()}`
        setForm(prev => ({...prev, petId: newPetId}))
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    try {
      setLoading(true)
      setError(null)
      
      // Get clientId from pet data if available
      let clientId = ''
      if (form.petId) {
        const pets = JSON.parse(localStorage.getItem('reception_pets')||'[]')
        const foundPet = pets.find(p => {
          const pid = String(p?.id || p?.petId || p?.patientId || p?._id || p?.details?.pet?.petId || '').trim()
          return pid === form.petId.trim()
        })
        if (foundPet) {
          clientId = foundPet.clientId || foundPet.details?.owner?.clientId || foundPet.details?.owner?.ownerId || ''
        }
      }
      
      const appointmentData = {
        id: editMode ? editingId : `APT-${Date.now()}`,
        petId: form.petId || `PET-${Date.now()}`,
        clientId: clientId,
        petName: form.petName,
        ownerName: form.ownerName,
        ownerContact: form.contact,
        type: form.petType || 'Unknown',
        species: form.petSpecies || '',
        date: form.date,
        time: form.time,
        doctor: form.doctor || '',
        purpose: form.purpose || '',
        reason: form.purpose || '',
        status: form.status || 'Scheduled',
        notes: '',
        createdBy: 'Reception'
      }
      
      if (editMode) {
        const response = await appointmentsAPI.update(editingId, appointmentData)
        setRows(prev => prev.map(r => (r.id === editingId || r._id === editingId) ? response.data : r))
        try { 
          addActivity({ 
            user: 'Reception', 
            text: `Updated appointment: ${form.petName}` 
          }) 
        } catch {}
      } else {
        const response = await appointmentsAPI.create(appointmentData)
        setRows(prev => [response.data, ...prev])
        try { 
          addActivity({ 
            user: 'Reception', 
            text: `Scheduled appointment: ${form.petName} with ${form.doctor}` 
          }) 
        } catch {}
      }
      
      setShowAll(true)
      setForm({ 
        petId:'', 
        petName:'', 
        ownerName:'', 
        contact:'', 
        petType:'', 
        petSpecies:'', 
        gender:'', 
        age:'', 
        registrationDate: '',
        doctor:'', 
        date:'', 
        time:'', 
        purpose:'', 
        status:'Scheduled' 
      })
      setEditMode(false)
      setEditingId(null)
      
      await loadAppointments()
      
    } catch (err) {
      console.error('Error saving appointment:', err)
      setError(err.message || 'Failed to save appointment')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (appointment) => {
    setEditMode(true)
    setEditingId(appointment.id || appointment._id)
    setForm({
      petId: appointment.petId || '',
      petName: appointment.petName || '',
      ownerName: appointment.ownerName || '',
      contact: appointment.ownerContact || '',
      petType: appointment.type || appointment.petType || '',
      petSpecies: appointment.species || appointment.petSpecies || '',
      gender: appointment.gender || appointment.petGender || '',
      age: appointment.age || appointment.petAge || '',
      registrationDate: appointment.registrationDate || '',
      doctor: appointment.doctor || '',
      date: appointment.date || '',
      time: appointment.time || '',
      purpose: appointment.purpose || appointment.reason || '',
      status: appointment.status || 'Scheduled'
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancelEdit = () => {
    setForm({ 
      petId:'', 
      petName:'', 
      ownerName:'', 
      contact:'', 
      petType:'', 
      petSpecies:'', 
      gender:'', 
      age:'', 
      registrationDate: '',
      doctor:'', 
      date:'', 
      time:'', 
      purpose:'', 
      status:'Scheduled' 
    })
    setEditMode(false)
    setEditingId(null)
  }

  const confirmDeleteAppointment = async () => {
    if (!deleteId) return
    try {
      setLoading(true)
      await appointmentsAPI.delete(deleteId)
      setRows(prev => prev.filter(r => r.id !== deleteId && r._id !== deleteId))
      setDeleteConfirm(false)
      setDeleteId(null)
      await loadAppointments()
    } catch (err) {
      console.error('Error deleting appointment:', err)
      setError('Failed to delete appointment')
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (id, status) => {
    try {
      setLoading(true)
      await appointmentsAPI.update(id, { status })
      setRows(prev => prev.map(r => (r.id === id || r._id === id) ? ({...r, status}) : r))
      await loadAppointments()
    } catch (err) {
      console.error('Error updating status:', err)
      setError('Failed to update status')
    } finally {
      setLoading(false)
    }
  }

  const deleteAppointment = async (id) => {
    try {
      setLoading(true)
      await appointmentsAPI.delete(id)
      setRows(prev => prev.filter(r => r.id !== id && r._id !== id))
      await loadAppointments()
    } catch (err) {
      console.error('Error deleting appointment:', err)
      setError('Failed to delete appointment')
    } finally {
      setLoading(false)
    }
  }

  const normalizeDate = (val) => {
    if (!val) return ''
    const s = String(val)
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10)
    try {
      const d = new Date(s)
      if (!isNaN(d)) return d.toISOString().slice(0,10)
    } catch {}
    return ''
  }

  const isDateInRange = (dateStr) => {
    if (!dateStr) return false
    const d = normalizeDate(dateStr)
    return d >= dateRange.fromDate && d <= dateRange.toDate
  }

  const filtered = useMemo(() => {
    const s = query.trim().toLowerCase()
    const items = rows.filter(r => {
      const matchesSearch = !s || [r.petName,r.ownerName,r.doctor,r.status,(r.purpose||r.reason)].some(v => String(v||'').toLowerCase().includes(s))
      const dateField = r.date || r.appointmentDate || r.createdAt
      let matchesDate = true
      if (!showAll) {
        if (singleDate) {
          const d = dateField ? normalizeDate(dateField) : ''
          matchesDate = singleDate === d
        } else {
          matchesDate = isDateInRange(dateField)
        }
      }
      return matchesSearch && matchesDate
    })
    const ts = (r) => {
      const d = r.date || r.appointmentDate
      const t = r.time || '00:00'
      const dt = d ? new Date(`${d}T${t}`) : (r.createdAt ? new Date(r.createdAt) : null)
      return dt ? dt.getTime() : 0
    }
    return items.slice().sort((a,b) => ts(b) - ts(a))
  }, [rows, query, dateRange.fromDate, dateRange.toDate, showAll, singleDate])

  const toCSV = rows => {
    const headers = ['Pet ID','Pet Name','Owner Name','Contact','Type','Species','Gender','Age','Doctor','Date','Time','Purpose/Complaint','Status']
    const lines = rows.map(r => [r.petId,r.petName,r.ownerName,r.contact,(r.petType||r.type),(r.petSpecies||r.species),r.gender,r.age,r.doctor,r.date,r.time,(r.purpose||r.reason),r.status].map(v=>`"${String(v||'').replace(/"/g,'""')}"`).join(','))
    return [headers.join(','), ...lines].join('\n')
  }

  const exportCSV = () => {
    const blob = new Blob([toCSV(filtered)], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'appointments.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-8">
      {/* Professional Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
          Appointments
        </h1>
        <p className="text-slate-600 text-lg">Schedule and manage pet appointments with ease</p>
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-500">
          <FiHeart className="w-4 h-4 text-red-500" />
          <span>Scheduling care for every pet's health journey</span>
          <FiStar className="w-4 h-4 text-yellow-500" />
        </div>
      </div>

      {/* Date Range Picker */}
      <div className="rounded-2xl bg-gradient-to-br from-white via-sky-50 to-blue-50 shadow-xl ring-1 ring-sky-200 border border-sky-100 p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl flex items-center justify-center">
              <FiCalendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-sky-600">Filter by Date</div>
              <div className="text-lg font-bold text-slate-800">
                {dateRange.fromDate === dateRange.toDate
                  ? new Date(dateRange.fromDate).toLocaleDateString()
                  : `${new Date(dateRange.fromDate).toLocaleDateString()} - ${new Date(dateRange.toDate).toLocaleDateString()}`}
              </div>
            </div>
          </div>
          <DateRangePicker 
            onDateChange={(dr)=>{
              setDateRange(dr)
              setSingleDate('')
              if (dr?.fromDate === ALL_FROM && dr?.toDate === ALL_TO) setShowAll(true)
              else setShowAll(false)
            }}
            defaultFromDate={dateRange.fromDate}
            defaultToDate={dateRange.toDate}
            showAllButton={true}
            onAllClick={() => { setShowAll(true); setSingleDate('') }}
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">×</button>
        </div>
      )}

      {/* Loading Indicator */}
      {loading && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg flex items-center">
          <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Processing...</span>
        </div>
      )}

      {/* Enhanced Appointment Scheduling Card */}
      <div className="rounded-3xl bg-gradient-to-br from-white via-sky-50 to-blue-50 shadow-2xl ring-1 ring-sky-200 border border-sky-100 p-8">
        <div className="mb-6 flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-sky-500 to-blue-600 rounded-2xl flex items-center justify-center">
            <FiCalendar className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1">
            <div className="text-2xl font-bold text-slate-800 mb-1">Schedule New Appointment</div>
            <div className="text-slate-600">Book appointments with doctors and veterinarians</div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-sky-600">{filtered.length}</div>
            <div className="text-sm text-slate-600">Total Appointments</div>
          </div>
        </div>

        {form.registrationDate && (
          <div className="mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className={`p-4 rounded-2xl border-2 flex flex-col md:flex-row items-center justify-between gap-4 ${
              (() => {
                const regDate = new Date(form.registrationDate)
                const today = new Date()
                const diffTime = Math.abs(today - regDate)
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
                return diffDays > 30 
                  ? 'bg-red-50 border-red-200 text-red-800' 
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              })()
            }`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  (() => {
                    const regDate = new Date(form.registrationDate)
                    const today = new Date()
                    const diffTime = Math.abs(today - regDate)
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
                    return diffDays > 30 ? 'bg-red-500' : 'bg-emerald-500'
                  })()
                }`}>
                  <FiInfo className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="font-bold text-lg">Registration Info</div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm opacity-90">
                    <span>Registered on: <b>{new Date(form.registrationDate).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' })}</b></span>
                    <span>Days elapsed: <b>{Math.floor(Math.abs(new Date() - new Date(form.registrationDate)) / (1000 * 60 * 60 * 24))} days</b></span>
                  </div>
                </div>
              </div>

              {(() => {
                const regDate = new Date(form.registrationDate)
                const today = new Date()
                const diffTime = Math.abs(today - regDate)
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
                if (diffDays > 30) {
                  return (
                    <div className="flex items-center gap-3 bg-red-100 px-4 py-2 rounded-xl border border-red-200">
                      <FiDollarSign className="w-5 h-5 text-red-600" />
                      <span className="font-bold">Consultation Fee Required (30+ days elapsed)</span>
                    </div>
                  )
                } else {
                  return (
                    <div className="flex items-center gap-3 bg-emerald-100 px-4 py-2 rounded-xl border border-emerald-200">
                      <FiCheckCircle className="w-5 h-5 text-emerald-600" />
                      <span className="font-bold">Free Follow-up Period (within 30 days)</span>
                    </div>
                  )
                }
              })()}
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white/60 rounded-2xl p-4 text-center">
            <div className="w-12 h-12 bg-sky-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <FiUser className="w-6 h-6 text-sky-600" />
            </div>
            <div className="font-semibold text-slate-800">Pet & Owner</div>
            <div className="text-sm text-slate-600">Patient information</div>
          </div>
          <div className="bg-white/60 rounded-2xl p-4 text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <FiCalendar className="w-6 h-6 text-blue-600" />
            </div>
            <div className="font-semibold text-slate-800">Date & Time</div>
            <div className="text-sm text-slate-600">Schedule appointment</div>
          </div>
          <div className="bg-white/60 rounded-2xl p-4 text-center">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <FiActivity className="w-6 h-6 text-indigo-600" />
            </div>
            <div className="font-semibold text-slate-800">Doctor</div>
            <div className="text-sm text-slate-600">Assign veterinarian</div>
          </div>
          <div className="bg-white/60 rounded-2xl p-4 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <FiCheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="font-semibold text-slate-800">Status</div>
            <div className="text-sm text-slate-600">Track progress</div>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <FiUser className="w-4 h-4 text-white" />
              </div>
              <div className="font-semibold text-slate-800">Pet ID & Auto-Fill</div>
            </div>
            <input 
              name="petId" 
              value={form.petId} 
              onChange={handleChange} 
              placeholder="Enter Pet ID (e.g., PET-1234567890123) to auto-fill information" 
              className="h-14 px-6 rounded-xl border-2 border-slate-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 bg-white font-mono text-lg w-full shadow-sm transition-all duration-200" 
            />
            <div className="text-sm text-slate-600 mt-2 flex items-center gap-2">
              <FiInfo className="w-4 h-4 text-slate-500" />
              <span>Enter existing Pet ID to auto-fill information, or fill pet details below to auto-generate new ID</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Pet Name *</label>
              <input 
                name="petName" 
                value={form.petName} 
                onChange={handleChange} 
                placeholder="Pet Name" 
                className="h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 bg-white shadow-sm transition-all duration-200 w-full" 
                required 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Owner Name *</label>
              <input 
                name="ownerName" 
                value={form.ownerName} 
                onChange={handleChange} 
                placeholder="Owner Name" 
                className="h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 bg-white shadow-sm transition-all duration-200 w-full" 
                required 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Contact Number</label>
              <input 
                name="contact" 
                value={form.contact} 
                onChange={handleChange} 
                placeholder="Contact Number" 
                className="h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 bg-white shadow-sm transition-all duration-200 w-full" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Type</label>
              <input
                value={form.petType}
                readOnly
                placeholder="Auto-filled from Pet ID"
                className="h-12 px-4 rounded-xl border-2 border-slate-200 bg-slate-50 shadow-sm transition-all duration-200 w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Species</label>
              <input
                value={form.petSpecies}
                readOnly
                placeholder="Auto-filled from Pet ID"
                className="h-12 px-4 rounded-xl border-2 border-slate-200 bg-slate-50 shadow-sm transition-all duration-200 w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Gender</label>
              <select 
                name="gender" 
                value={form.gender} 
                onChange={handleChange} 
                className="h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 bg-white shadow-sm transition-all duration-200 w-full"
              >
                <option value="">Select Gender</option>
                <option>Male</option>
                <option>Female</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Age</label>
              <input 
                name="age" 
                value={form.age} 
                onChange={handleChange} 
                placeholder="Age (e.g., 2 years, 6 months)" 
                className="h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 bg-white shadow-sm transition-all duration-200 w-full" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Doctor/Vet *</label>
              <select 
                name="doctor" 
                value={form.doctor} 
                onChange={handleChange} 
                className="h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 bg-white shadow-sm transition-all duration-200 w-full" 
                required
              >
                <option value="">Select Doctor ({doctors.length} available)</option>
                {doctors.map((doc, index) => {
                  console.log(`Doctor ${index}:`, doc)
                  return (
                    <option key={doc._id || doc.username || index} value={doc.username}>
                      {doc.name || doc.username} {doc.fee ? `- Rs ${doc.fee}` : ''}
                    </option>
                  )
                })}
              </select>
              {doctors.length === 0 && (
                <div className="text-xs text-red-600 mt-1">
                  No doctors found. Please add doctors in Admin Portal first.
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Appointment Date *</label>
              <input 
                type="date" 
                name="date" 
                value={form.date} 
                onChange={handleChange} 
                className="h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 bg-white shadow-sm transition-all duration-200 w-full" 
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Appointment Time *</label>
              <input 
                type="time" 
                name="time" 
                value={form.time} 
                onChange={handleChange} 
                className="h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 bg-white shadow-sm transition-all duration-200 w-full" 
                required
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Purpose / Complaint</label>
            <textarea
              name="purpose"
              value={form.purpose}
              onChange={handleChange}
              placeholder="e.g., Vomiting since morning, vaccination due, follow-up, post-op check, skin allergy, diarrhea, lethargy, etc."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 bg-white shadow-sm transition-all duration-200"
            />
          </div>

          <div className="flex justify-center gap-4">
            {editMode && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-8 h-16 rounded-2xl border-2 border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-3"
              >
                Cancel
              </button>
            )}
            <button className="px-12 h-16 rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white font-bold text-lg shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 flex items-center gap-3">
              <FiCalendar className="w-6 h-6" />
              {editMode ? 'Update Appointment' : 'Schedule Appointment'}
            </button>
          </div>
        </form>
      </div>

      {/* Enhanced Appointments List */}
      <div className="rounded-3xl bg-gradient-to-br from-white via-slate-50 to-gray-50 shadow-2xl ring-1 ring-slate-200 border border-slate-100 p-8">
        <div className="mb-6 flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-slate-500 to-gray-600 rounded-2xl flex items-center justify-center shrink-0">
            <FiActivity className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <div className="text-2xl font-bold text-slate-800 mb-1">All Appointments</div>
            <div className="text-slate-600">{filtered.length} appointments found</div>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto lg:justify-end">
            <button
              type="button"
              onClick={() => {
                const t = todayISO()
                setShowAll(false)
                setSingleDate(t)
                setDateRange({ fromDate: t, toDate: t })
              }}
              className="px-3 h-10 text-sm rounded-lg border-2 shadow-sm transition-all duration-200 whitespace-nowrap bg-blue-600 border-blue-600 text-white hover:bg-blue-700"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAll(true)
                setSingleDate('')
                setDateRange({ fromDate: ALL_FROM, toDate: ALL_TO })
              }}
              className={`px-3 h-10 text-sm rounded-lg border-2 shadow-sm transition-all duration-200 whitespace-nowrap ${showAll ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
            >
              All
            </button>
            {!showAll && (
              <>
                <input
                  type="date"
                  value={singleDate}
                  onChange={e => setSingleDate(e.target.value)}
                  className="h-10 px-3 text-sm rounded-lg border-2 border-slate-200 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 bg-white shadow-sm transition-all duration-200"
                  title="Filter by date"
                />
                <button
                  type="button"
                  onClick={() => setSingleDate('')}
                  className="px-3 h-10 text-sm rounded-lg border-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm whitespace-nowrap"
                >
                  Clear Date
                </button>
                <button
                  type="button"
                  onClick={() => { const { from, to } = lastNDays(10); setDateRange({ fromDate: from, toDate: to }); setSingleDate(''); setShowAll(false); }}
                  className="px-3 h-10 text-sm rounded-lg border-2 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 shadow-sm whitespace-nowrap"
                >
                  Last 10 days
                </button>
              </>
            )}
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                value={query} 
                onChange={e=>setQuery(e.target.value)} 
                placeholder="Search appointments..." 
                className="h-10 pl-9 pr-3 text-sm rounded-lg border-2 border-slate-200 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 bg-white shadow-sm transition-all duration-200 w-56" 
              />
            </div>
            <button 
              onClick={exportCSV} 
              className="px-4 h-10 text-sm rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 whitespace-nowrap"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/>
              </svg>
              Export CSV
            </button>
          </div>
        </div>
        <div className="grid gap-6 mt-6">
          {filtered.map(r => (
            <div key={r.id} className="group">
              <div className="rounded-3xl border-2 border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50 hover:from-sky-50 hover:to-blue-50 hover:border-sky-300 transition-all duration-300 shadow-lg hover:shadow-2xl p-6 group-hover:-translate-y-1">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  {/* Appointment Avatar */}
                  <div className="w-16 h-16 bg-gradient-to-br from-sky-400 to-blue-500 rounded-2xl flex items-center justify-center shrink-0">
                    <FiCalendar className="w-8 h-8 text-white" />
                  </div>
                  
                  {/* Appointment Information */}
                  <div className="flex-1 min-w-0">
                    {/* Pet ID Badge */}
                    {r.petId && (
                      <div className="flex items-center gap-3 mb-3">
                        <button 
                          title="Click to copy Pet ID" 
                          onClick={()=>{ 
                            navigator.clipboard?.writeText(r.petId); 
                            // Show copied feedback
                            const btn = event.target;
                            const original = btn.textContent;
                            btn.textContent = 'Copied!';
                            btn.className = btn.className.replace('bg-sky-100', 'bg-green-100').replace('text-sky-700', 'text-green-700');
                            setTimeout(() => {
                              btn.textContent = original;
                              btn.className = btn.className.replace('bg-green-100', 'bg-sky-100').replace('text-green-700', 'text-sky-700');
                            }, 1200);
                          }} 
                          className="px-3 py-2 text-sm font-mono bg-sky-100 text-sky-700 hover:bg-sky-200 rounded-xl border border-sky-200 cursor-pointer transition-all duration-200 flex items-center gap-2 shadow-sm"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/>
                            <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/>
                          </svg>
                          {r.petId}
                        </button>
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">Click ID to copy</span>
                      </div>
                    )}
                    
                    {/* Appointment Details */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-2xl font-bold text-slate-900">{r.petName}</h3>
                        <span className="text-slate-400">•</span>
                        <span className="text-lg font-semibold text-sky-600">{r.ownerName}</span>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        {(r.petType || r.type) && (
                          <div className="flex items-center gap-1">
                            <span className="font-semibold text-slate-700">Type:</span>
                            <span className="bg-slate-100 px-2 py-1 rounded-lg">{r.petType || r.type}</span>
                          </div>
                        )}
                        {(r.petSpecies || r.species) && (
                          <div className="flex items-center gap-1">
                            <span className="font-semibold text-slate-700">Species:</span>
                            <span className="bg-slate-100 px-2 py-1 rounded-lg">{r.petSpecies || r.species}</span>
                          </div>
                        )}
                        {r.gender && (
                          <div className="flex items-center gap-1">
                            <span className="font-semibold text-slate-700">Gender:</span>
                            <span className="bg-slate-100 px-2 py-1 rounded-lg">{r.gender}</span>
                          </div>
                        )}
                        {r.age && (
                          <div className="flex items-center gap-1">
                            <span className="font-semibold text-slate-700">Age:</span>
                            <span className="bg-slate-100 px-2 py-1 rounded-lg">{r.age}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <span className="font-semibold text-slate-700">Doctor:</span>
                          <span className="bg-blue-100 px-2 py-1 rounded-lg text-blue-700">{r.doctor || 'Not assigned'}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <FiCalendar className="w-4 h-4 text-slate-500" />
                          <span className="font-semibold text-slate-700">Date:</span>
                          <span className="bg-slate-100 px-3 py-1 rounded-lg font-mono">{r.date}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FiClock className="w-4 h-4 text-slate-500" />
                          <span className="font-semibold text-slate-700">Time:</span>
                          <span className="bg-slate-100 px-3 py-1 rounded-lg font-mono">{r.time || 'Not set'}</span>
                        </div>
                      </div>

                      {(r.purpose || r.reason) && (
                        <div className="mt-3 text-sm flex items-start gap-2">
                          <FiInfo className="w-4 h-4 text-slate-500 mt-0.5" />
                          <div>
                            <span className="font-semibold text-slate-700">Purpose/Complaint:</span>{' '}
                            <span className="bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg inline-block break-words max-w-full">
                              {r.purpose || r.reason}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Status Badge & Action Buttons */}
                <div className="flex flex-col sm:flex-row lg:flex-col gap-2 sm:items-center sm:justify-between lg:items-end shrink-0 w-full lg:w-auto">
                  <div className={`px-4 py-2 rounded-xl font-bold text-xs lg:text-sm flex items-center gap-2 shadow-lg whitespace-nowrap ${
                    r.status==='Completed'?'bg-gradient-to-r from-emerald-500 to-green-500 text-white':
                    r.status==='Cancelled'?'bg-gradient-to-r from-red-500 to-pink-500 text-white':
                    r.status==='No Show'?'bg-gradient-to-r from-gray-500 to-slate-500 text-white':
                    r.status==='In Progress'?'bg-gradient-to-r from-blue-500 to-indigo-500 text-white':
                    r.status==='Confirmed'?'bg-gradient-to-r from-green-500 to-emerald-500 text-white':
                    'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                  }`}>
                    {r.status === 'Completed' ? (
                      <>
                        <FiCheckCircle className="w-4 h-4" />
                        <span>Completed</span>
                      </>
                    ) : r.status === 'Cancelled' ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span>Cancelled</span>
                      </>
                    ) : r.status === 'No Show' ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                        <span>No Show</span>
                      </>
                    ) : r.status === 'In Progress' ? (
                      <>
                        <FiActivity className="w-4 h-4" />
                        <span>In Progress</span>
                      </>
                    ) : r.status === 'Confirmed' ? (
                      <>
                        <FiCheckCircle className="w-4 h-4" />
                        <span>Confirmed</span>
                      </>
                    ) : (
                      <>
                        <FiCalendar className="w-4 h-4" />
                        <span>{r.status}</span>
                      </>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-2 sm:justify-end lg:justify-end">
                    <button
                      onClick={() => handleEdit(r)}
                      className="px-4 h-10 text-sm rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 whitespace-nowrap"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                    <button
                      onClick={() => { setDeleteId(r.id || r._id); setDeleteConfirm(true); }}
                      className="px-4 h-10 text-sm rounded-lg bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 whitespace-nowrap"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
            </div>
          ))}
          {filtered.length===0 && (
            <div className="py-16 text-center">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiCalendar className="w-10 h-10 text-slate-400" />
              </div>
              <div className="text-slate-500 text-xl font-medium">No appointments found</div>
              <div className="text-slate-400 text-sm mt-1">Try adjusting your search or schedule a new appointment</div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 transform transition-all">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Delete Appointment?</h3>
              <p className="text-slate-600 mb-6">Are you sure you want to delete this appointment? This action cannot be undone.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setDeleteConfirm(false); setDeleteId(null); }}
                  className="flex-1 px-6 py-3 rounded-xl border-2 border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteAppointment}
                  className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}