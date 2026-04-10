import React, { useState, useEffect, useMemo, useRef } from 'react'
import { FiUpload, FiImage, FiX, FiEye, FiTrash2, FiDownload } from 'react-icons/fi'
import { petsAPI, labReportsAPI } from '../../services/api'
import DateRangePicker from '../../components/DateRangePicker'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export default function Radiology() {
  const [patients, setPatients] = useState([])
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [radiologyRecords, setRadiologyRecords] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showImagePreview, setShowImagePreview] = useState(false)
  const [previewImage, setPreviewImage] = useState(null)
  const pdfRef = useRef(null)
  const exportRef = useRef(null)
  const todayStr = useMemo(()=> new Date().toISOString().slice(0,10), [])
  const [dateRange, setDateRange] = useState({ fromDate: todayStr, toDate: todayStr })
  
  // Clear found patient when search query is cleared
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFoundPatient(null)
    }
  }, [searchQuery])
  const [foundPatient, setFoundPatient] = useState(null)
  const [petExists, setPetExists] = useState(true)
  const [toast, setToast] = useState('')
  const [showPatientModal, setShowPatientModal] = useState(false)
  const [patientModal, setPatientModal] = useState(null) // { pet, reports, records, total }
  
  const [uploadForm, setUploadForm] = useState({
    patientId: '',
    petName: '',
    ownerName: '',
    testType: 'X-Ray',
    testDate: new Date().toISOString().slice(0, 10),
    bodyPart: '',
    findings: '',
    images: []
  })

  useEffect(() => {
    fetchPatients()
    loadRadiologyRecords()
  }, [])

  const fetchPatients = async () => {
    try {
      const response = await petsAPI.getAll()
      const list = response.data || []
      setPatients(list)
      // hydrate radiology records from pets.details.radiology
      const aggregated = []
      for (const p of list) {
        const recs = p.details?.radiology || []
        for (const r of recs) {
          aggregated.push({
            ...r,
            patientId: p.id,
            petName: p.petName,
            ownerName: p.ownerName,
          })
        }
      }
      if (aggregated.length) setRadiologyRecords(aggregated)
    } catch (err) {
      console.error('Error fetching patients:', err)
    }
  }

  const openPatientModal = async (patientId) => {
    try {
      let pet = null
      try {
        const p = await petsAPI.getById(patientId)
        pet = p?.data || null
      } catch (e) {
        // Pet not found, continue with null
      }
      // collect lab reports for this patient
      let reports = []
      try {
        const r = await labReportsAPI.getAll()
        const all = r?.data || []
        reports = all.filter(x => (x.petId||x.patientId||'').toLowerCase() === String(patientId).toLowerCase())
      } catch (e) {
        // No reports found
      }
      // collect radiology records already loaded
      const records = radiologyRecords.filter(r => String(r.patientId).toLowerCase() === String(patientId).toLowerCase())
      const total = reports.reduce((s, r) => s + (Number(r.amount)||0), 0)
      setPatientModal({ pet, reports, records, total, patientId })
      setShowPatientModal(true)
    } catch (e) {
      console.error('Error opening patient modal:', e)
    }
  }

  const loadRadiologyRecords = () => {
    try {
      const stored = localStorage.getItem('radiology_records')
      if (stored) {
        setRadiologyRecords(JSON.parse(stored))
      }
    } catch (err) {
      console.error('Error loading radiology records:', err)
    }
  }

  const saveRadiologyRecords = (records) => {
    try {
      localStorage.setItem('radiology_records', JSON.stringify(records))
      setRadiologyRecords(records)
    } catch (err) {
      console.error('Error saving radiology records:', err)
    }
  }

  const handlePatientSelect = (patient) => {
    setUploadForm({
      ...uploadForm,
      patientId: patient.id,
      petName: patient.petName,
      ownerName: patient.ownerName
    })
    setShowUploadModal(true)
  }

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files)
    const readers = []
    
    files.forEach(file => {
      const reader = new FileReader()
      readers.push(new Promise((resolve) => {
        reader.onload = (event) => {
          resolve({
            name: file.name,
            data: event.target.result,
            size: file.size,
            type: file.type
          })
        }
        reader.readAsDataURL(file)
      }))
    })

    Promise.all(readers).then(images => {
      setUploadForm(prev => ({
        ...prev,
        images: [...prev.images, ...images]
      }))
    })
  }

  const removeImage = (index) => {
    setUploadForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const newRecord = {
      id: `RAD-${Date.now()}`,
      ...uploadForm,
      createdAt: new Date().toISOString()
    }
    // persist to local list immediately
    const updatedLocal = [...radiologyRecords, newRecord]
    saveRadiologyRecords(updatedLocal)
    // persist into pet.details.radiology in MongoDB
    try {
      let pet
      try {
        const petResp = await petsAPI.getById(uploadForm.patientId)
        pet = petResp.data
      } catch (e) {
        // create minimal pet if missing
        const payload = {
          id: uploadForm.patientId,
          petName: uploadForm.petName || 'Unknown',
          ownerName: uploadForm.ownerName || 'Unknown',
          type: foundPatient?.type || 'Other',
          species: foundPatient?.species || foundPatient?.type || 'Other',
          breed: foundPatient?.breed || '',
          details: {}
        }
        const created = await petsAPI.create(payload)
        pet = created.data
      }
      const details = { ...(pet.details || {}) }
      const existing = Array.isArray(details.radiology) ? details.radiology : []
      details.radiology = [...existing, newRecord]
      await petsAPI.update(pet.id, { ...pet, details })
      await fetchPatients()
    } catch (err) {
      console.error('Error saving radiology to pet:', err)
    }
    setShowUploadModal(false)
    setUploadForm({
      patientId: '',
      petName: '',
      ownerName: '',
      testType: 'X-Ray',
      testDate: new Date().toISOString().slice(0, 10),
      bodyPart: '',
      findings: '',
      images: []
    })
    setToast('Radiology record saved successfully!')
    setTimeout(()=>setToast(''), 2000)
  }

  const deleteRecord = (id) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      const updated = radiologyRecords.filter(r => r.id !== id)
      saveRadiologyRecords(updated)
    }
  }

  const openImagePreview = (img) => {
    if (!img) return
    setPreviewImage(img)
    setShowImagePreview(true)
  }

  const closeImagePreview = () => {
    setShowImagePreview(false)
    setPreviewImage(null)
  }

  useEffect(() => {
    if (!showImagePreview) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeImagePreview()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showImagePreview])

  const inRange = (dateStr) => {
    if (!dateStr) return false
    const d = String(dateStr).slice(0,10)
    const from = dateRange.fromDate || '0000-01-01'
    const to = dateRange.toDate || '9999-12-31'
    return d >= from && d <= to
  }

  const recordsInRange = useMemo(()=> (radiologyRecords||[]).filter(r => inRange(r.testDate)), [radiologyRecords, dateRange.fromDate, dateRange.toDate])

  const filteredRecords = (recordsInRange||[]).filter(r => {
    const s = searchQuery.toLowerCase()
    return (
      r.petName?.toLowerCase().includes(s) ||
      r.ownerName?.toLowerCase().includes(s) ||
      r.testType?.toLowerCase().includes(s) ||
      r.patientId?.toLowerCase().includes(s)
    )
  })

  // Group records by patient for card display
  const patientGroups = {}
  filteredRecords.forEach(r => {
    const pid = r.patientId || 'unknown'
    if (!patientGroups[pid]) {
      patientGroups[pid] = {
        patientId: pid,
        petName: r.petName,
        ownerName: r.ownerName,
        count: 0
      }
    }
    patientGroups[pid].count++
  })
  const patientCards = Object.values(patientGroups)

  const filteredPatients = patients.filter(p =>
    p.petName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.ownerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.id?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const quickFindById = async () => {
    const id = searchQuery.trim()
    if (!id) return
    
    setFoundPatient(null)
    
    // First try API by ID
    try {
      const resp = await petsAPI.getById(id)
      if (resp?.data) {
        const p = resp.data
        setFoundPatient(p)
        setPetExists(true)
        setUploadForm(prev => ({
          ...prev,
          patientId: p.id,
          petName: p.petName,
          ownerName: p.ownerName
        }))
        return
      }
    } catch (e) {
      // Continue to next method
    }
    
    // Try backend fuzzy search
    try {
      const s = await petsAPI.search(id)
      const arr = s?.data || []
      const p = arr.find(x => (x.id||'').toLowerCase() === id.toLowerCase()) || arr[0]
      if (p) {
        setFoundPatient(p)
        setPetExists(true)
        setUploadForm(prev => ({
          ...prev,
          patientId: p.id,
          petName: p.petName,
          ownerName: p.ownerName
        }))
        return
      }
    } catch (e) {
      // Continue to next method
    }
    
    // Fallback: search lab reports
    try {
      const all = await labReportsAPI.getAll()
      const list = all?.data || []
      const fromRep = list.find(r => (r.petId||r.patientId||'').toLowerCase() === id.toLowerCase())
      if (fromRep) {
        const p = {
          id: fromRep.petId || fromRep.patientId,
          petName: fromRep.petName || 'Unknown',
          ownerName: fromRep.ownerName || '',
          type: fromRep.species || fromRep.type || 'Other',
          breed: fromRep.breed || ''
        }
        setFoundPatient(p)
        setPetExists(false)
        setUploadForm(prev => ({
          ...prev,
          patientId: p.id,
          petName: p.petName,
          ownerName: p.ownerName
        }))
        return
      }
    } catch (e) {
      // Continue to next method
    }
    
    // Last resort: local list
    const p = patients.find(x => (x.id||'').toLowerCase() === id.toLowerCase())
    if (p) {
      setFoundPatient(p)
      setPetExists(true)
      setUploadForm(prev => ({
        ...prev,
        patientId: p.id,
        petName: p.petName,
        ownerName: p.ownerName
      }))
    } else {
      setFoundPatient(null)
      setToast('Patient ID not found. Please verify the ID or add the patient first.')
      setTimeout(()=>setToast(''), 3000)
    }
  }

  const printPatientViewFallback = () => {
    try {
      const node = exportRef.current || pdfRef.current
      if (!node) return
      const html = `<!doctype html><html><head><meta charset="utf-8" />
        <title>Radiology - ${patientModal?.pet?.petName || ''}</title>
        <style>
          @page { size: A4; margin: 10mm; }
          html, body { width: 210mm; background: #fff; }
          body { font-family: Inter, system-ui, Segoe UI, Roboto, Arial, sans-serif; }
          .container { width: 190mm; margin: 0 auto; }
          img { max-width: 100%; }
        </style>
      </head><body><div class="container">${node.innerHTML}</div>
      <script>window.onload=()=>{window.print(); setTimeout(()=>window.close(), 300)}</script>
      </body></html>`
      const w = window.open('', '_blank', 'width=1024,height=800')
      if (w) { w.document.open(); w.document.write(html); w.document.close() }
    } catch {}
  }

  const downloadPatientPDF = async () => {
    try {
      setToast('Preparing PDF…')
      const node = pdfRef.current
      if (!node) { printPatientViewFallback(); setToast('Opened print preview'); setTimeout(()=>setToast(''), 2000); return }
      const canvas = await html2canvas(node, { scale: Math.min(2, window.devicePixelRatio || 1.5), useCORS: true, allowTaint: true, backgroundColor: '#ffffff', logging: false })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'pt', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 24 // pts ~ 8.5mm
      // Compute scale to fit both width and height on a single page
      const scale = Math.min(
        (pageWidth - margin * 2) / canvas.width,
        (pageHeight - margin * 2) / canvas.height
      )
      const renderWidth = canvas.width * scale
      const renderHeight = canvas.height * scale
      const x = (pageWidth - renderWidth) / 2
      const y = (pageHeight - renderHeight) / 2
      pdf.addImage(imgData, 'PNG', x, y, renderWidth, renderHeight)
      const n = patientModal?.pet?.petName || 'Patient'
      const id = patientModal?.patientId || ''
      const dateStr = new Date().toISOString().slice(0,10)
      pdf.save(`Radiology_${n}_${id}_${dateStr}.pdf`)
      setToast('PDF saved')
      setTimeout(()=>setToast(''), 2000)
    } catch (e) {
      console.error('PDF export failed', e)
      setToast('PDF export failed, opening print instead')
      printPatientViewFallback()
      setTimeout(()=>setToast(''), 2500)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Radiology</h1>
          <p className="text-slate-500 mt-1">X-Ray, Ultrasound & Imaging Tests</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Enter Patient ID (exact)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e)=>{ if(e.key==='Enter'){ e.preventDefault(); quickFindById() } }}
              className="px-4 h-11 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 pr-10"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')} 
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 w-6 h-6 flex items-center justify-center"
              >
                ✕
              </button>
            )}
          </div>
          <button onClick={quickFindById} className="px-4 h-11 rounded-lg bg-purple-600 hover:bg-purple-700 text-white">Find</button>
        </div>
      </div>

      {/* Date Range Picker */}
      <div className="rounded-2xl bg-gradient-to-br from-white via-purple-50 to-pink-50 shadow-xl ring-1 ring-purple-200 border border-purple-100 p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm font-semibold text-purple-700">Date Range</div>
          <DateRangePicker onDateChange={setDateRange} defaultFromDate={dateRange.fromDate} defaultToDate={dateRange.toDate} showAllButton />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
          <div className="text-sm opacity-90">Total Records</div>
          <div className="text-3xl font-bold mt-1">{recordsInRange.length}</div>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
          <div className="text-sm opacity-90">X-Rays</div>
          <div className="text-3xl font-bold mt-1">{recordsInRange.filter(r => r.testType === 'X-Ray').length}</div>
        </div>
        <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl p-4 text-white">
          <div className="text-sm opacity-90">Ultrasounds</div>
          <div className="text-3xl font-bold mt-1">{recordsInRange.filter(r => r.testType === 'Ultrasound').length}</div>
        </div>
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-4 text-white">
          <div className="text-sm opacity-90">Other Scans</div>
          <div className="text-3xl font-bold mt-1">{recordsInRange.filter(r => !['X-Ray', 'Ultrasound'].includes(r.testType)).length}</div>
        </div>
      </div>

      {/* Selected Patient by ID */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-slate-800 mb-4">Patient</h2>
        {!foundPatient ? (
          <div className="text-slate-500">{searchQuery ? 'No patient found. Please verify the ID.' : 'Search a Patient ID to display details and upload images.'}</div>
        ) : (
          <div className="flex items-center justify-between border-2 border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                {foundPatient.petName?.charAt(0) || 'P'}
              </div>
              {/* Hidden condensed export layout for single-page PDF */}
              <div
                ref={exportRef}
                style={{ position: 'fixed', left: '-10000px', top: 0, width: '794px', background: '#fff', padding: '16px' }}
              >
                <div style={{ textAlign: 'center', borderBottom: '3px solid #7c3aed', paddingBottom: 8, marginBottom: 12 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#7c3aed' }}>Radiology Summary</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, marginBottom: 12 }}>
                  <div><strong>Patient:</strong> {patientModal?.pet?.petName || '-'}</div>
                  <div><strong>ID:</strong> {patientModal?.patientId}</div>
                  <div><strong>Owner:</strong> {patientModal?.pet?.ownerName || '-'}</div>
                  <div><strong>Species:</strong> {patientModal?.pet?.species || patientModal?.pet?.type || '-'}</div>
                  <div><strong>Breed:</strong> {patientModal?.pet?.breed || '-'}</div>
                  <div><strong>Gender:</strong> {patientModal?.pet?.gender || '-'}</div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Lab Reports (Total: Rs. {Number(patientModal?.total || 0).toLocaleString()})</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '4px 6px', borderBottom: '1px solid #e5e7eb' }}>Date</th>
                        <th style={{ textAlign: 'left', padding: '4px 6px', borderBottom: '1px solid #e5e7eb' }}>Test</th>
                        <th style={{ textAlign: 'right', padding: '4px 6px', borderBottom: '1px solid #e5e7eb' }}>Amount</th>
                        <th style={{ textAlign: 'left', padding: '4px 6px', borderBottom: '1px solid #e5e7eb' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(patientModal?.reports || []).slice(0, 10).map((r, idx) => (
                        <tr key={idx}>
                          <td style={{ padding: '4px 6px' }}>{r.collectionDate ? new Date(r.collectionDate).toLocaleDateString() : (r.date||'-')}</td>
                          <td style={{ padding: '4px 6px' }}>{r.testType || r.testName}</td>
                          <td style={{ padding: '4px 6px', textAlign: 'right' }}>Rs. {Number(r.amount||0).toLocaleString()}</td>
                          <td style={{ padding: '4px 6px' }}>{r.paymentStatus || 'Paid'}</td>
                        </tr>
                      ))}
                      {(!patientModal?.reports || patientModal.reports.length===0) && (
                        <tr><td colSpan="4" style={{ padding: '6px', textAlign: 'center', color: '#6b7280' }}>No lab reports</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Radiology Records</div>
                  {(!patientModal?.records || patientModal.records.length === 0) ? (
                    <div style={{ fontSize: 12, color: '#6b7280' }}>No radiology records.</div>
                  ) : (
                    (patientModal?.records || []).map((record, idx) => (
                      <div key={idx} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                          <div><strong>{record.testType}</strong></div>
                          <div>{new Date(record.testDate).toLocaleDateString()}</div>
                        </div>
                        <div style={{ fontSize: 11, color: '#374151', marginBottom: 4 }}>
                          <strong>Body Part:</strong> {record.bodyPart}
                          {record.findings ? <span> • <strong>Findings:</strong> {record.findings}</span> : null}
                        </div>
                        {Array.isArray(record.images) && record.images.length>0 && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                            {record.images.slice(0, 8).map((img, i) => (
                              <img key={i} src={img.data} alt={`${record.testType}-${i}`} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 6, border: '1px solid #e5e7eb' }} />
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div>
                <div className="font-semibold text-slate-800">{foundPatient.petName}</div>
                <div className="text-sm text-slate-500">{foundPatient.ownerName}</div>
                <div className="text-xs text-slate-400">{foundPatient.id} • {foundPatient.type} • {foundPatient.breed}</div>
              </div>
            </div>
            <button
              onClick={() => handlePatientSelect(foundPatient)}
              className="px-4 h-10 rounded-lg bg-purple-600 hover:bg-purple-700 text-white inline-flex items-center gap-2"
            >
              <FiUpload /> Upload Images
            </button>
          </div>
        )}
      {showPatientModal && patientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setShowPatientModal(false)}></div>
          <div className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-t-2xl p-5 flex items-center justify-between">
              <div>
                <div className="text-xl font-bold">{patientModal.pet?.petName || 'Patient'}</div>
                <div className="text-xs text-white/80">ID: {patientModal.patientId}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={downloadPatientPDF} className="px-3 h-9 rounded-lg bg-white/20 hover:bg-white/30 text-white inline-flex items-center gap-2"><FiDownload className="w-4 h-4"/> Download PDF</button>
                <button onClick={()=>setShowPatientModal(false)} className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white text-xl">×</button>
              </div>
            </div>
            <div ref={pdfRef} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="text-sm font-semibold text-slate-700 mb-2">Patient Info</div>
                  <div className="text-sm text-slate-600 space-y-1">
                    <div><span className="font-medium">Name:</span> {patientModal.pet?.petName || '-'}</div>
                    <div><span className="font-medium">Owner:</span> {patientModal.pet?.ownerName || '-'}</div>
                    <div><span className="font-medium">Species:</span> {patientModal.pet?.species || patientModal.pet?.type || '-'}</div>
                    <div><span className="font-medium">Breed:</span> {patientModal.pet?.breed || '-'}</div>
                    <div><span className="font-medium">Gender:</span> {patientModal.pet?.gender || '-'}</div>
                    <div><span className="font-medium">Age:</span> {patientModal.pet?.age || '-'}</div>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 p-4 md:col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold text-slate-700">Lab Reports</div>
                    <div className="text-sm text-slate-500">Total: <span className="font-bold text-purple-700">Rs. {patientModal.total.toLocaleString()}</span></div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="text-left py-2 px-3">Date</th>
                          <th className="text-left py-2 px-3">Test</th>
                          <th className="text-left py-2 px-3">Amount</th>
                          <th className="text-left py-2 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {patientModal.reports.map((r, idx) => (
                          <tr key={idx} className="border-t border-slate-200">
                            <td className="py-2 px-3">{r.collectionDate ? new Date(r.collectionDate).toLocaleDateString() : (r.date||'-')}</td>
                            <td className="py-2 px-3">{r.testType || r.testName}</td>
                            <td className="py-2 px-3">Rs. {Number(r.amount||0).toLocaleString()}</td>
                            <td className="py-2 px-3">{r.paymentStatus || 'Paid'}</td>
                          </tr>
                        ))}
                        {patientModal.reports.length===0 && (
                          <tr><td colSpan={4} className="py-6 px-3 text-center text-slate-500">No lab reports</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="text-sm font-semibold text-slate-700 mb-3">Radiology Records</div>
                {patientModal.records.length===0 ? (
                  <div className="text-slate-500 text-sm">No radiology records.</div>
                ) : (
                  <div className="space-y-4">
                    {patientModal.records.map((record, idx) => (
                      <div key={idx} className="border border-slate-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                            {record.testType}
                          </span>
                          <span className="text-xs text-slate-500">{new Date(record.testDate).toLocaleDateString()}</span>
                        </div>
                        <div className="text-sm text-slate-600 mb-2">
                          <span className="font-medium">Body Part:</span> {record.bodyPart}
                        </div>
                        {record.findings && (
                          <div className="text-sm text-slate-600 mb-2 bg-slate-50 p-2 rounded">
                            <span className="font-medium">Findings:</span> {record.findings}
                          </div>
                        )}
                        {record.images && record.images.length > 0 && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                            {record.images.map((img, i) => (
                              <div key={i} className="relative group">
                                <img src={img.data} alt={`${record.testType}-${i}`} className="w-full h-24 object-cover rounded-lg border" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-1">
                                  <button onClick={() => openImagePreview(img)} className="p-1 bg-white rounded hover:bg-slate-100">
                                    <FiEye className="w-3 h-3" />
                                  </button>
                                  <a href={img.data} download={img.name} className="p-1 bg-white rounded hover:bg-slate-100">
                                    <FiDownload className="w-3 h-3" />
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Radiology Records */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-slate-800 mb-4">Patients with Radiology Records</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {patientCards.length === 0 ? (
            <div className="text-center py-12 text-slate-500 col-span-full">
              <FiImage className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <div>No patients with radiology records</div>
            </div>
          ) : (
            patientCards.map(card => (
              <div
                key={card.patientId}
                onClick={() => openPatientModal(card.patientId)}
                className="border-2 border-slate-200 rounded-xl p-4 hover:border-purple-500 hover:shadow-lg transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg">
                    {card.petName?.charAt(0) || 'P'}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-slate-800">{card.petName}</div>
                    <div className="text-sm text-slate-500">{card.ownerName}</div>
                    <div className="text-xs text-slate-400 mt-1">{card.count} record{card.count>1?'s':''}</div>
                  </div>
                  <FiEye className="w-5 h-5 text-purple-500" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-800">Upload Radiology Images</h3>
              <button onClick={() => setShowUploadModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <FiX className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Patient Info */}
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="font-semibold text-purple-900 mb-2">Patient Information</div>
                <div className="text-sm text-purple-800">
                  <div><span className="font-semibold">Pet:</span> {uploadForm.petName}</div>
                  <div><span className="font-semibold">Owner:</span> {uploadForm.ownerName}</div>
                </div>
              </div>

              {/* Test Type */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Test Type</label>
                <select
                  value={uploadForm.testType}
                  onChange={(e) => setUploadForm({...uploadForm, testType: e.target.value})}
                  className="w-full px-4 h-11 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                >
                  <option value="X-Ray">X-Ray</option>
                  <option value="Ultrasound">Ultrasound</option>
                  <option value="CT Scan">CT Scan</option>
                  <option value="MRI">MRI</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Test Date */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Test Date</label>
                <input
                  type="date"
                  value={uploadForm.testDate}
                  onChange={(e) => setUploadForm({...uploadForm, testDate: e.target.value})}
                  className="w-full px-4 h-11 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              {/* Body Part */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Body Part / Area</label>
                <input
                  type="text"
                  value={uploadForm.bodyPart}
                  onChange={(e) => setUploadForm({...uploadForm, bodyPart: e.target.value})}
                  placeholder="e.g., Chest, Abdomen, Leg"
                  className="w-full px-4 h-11 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              {/* Findings */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Findings / Notes</label>
                <textarea
                  value={uploadForm.findings}
                  onChange={(e) => setUploadForm({...uploadForm, findings: e.target.value})}
                  placeholder="Enter findings or observations..."
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows="3"
                />
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Upload Images</label>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-purple-500 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                    id="image-upload"
                  />
                  <label htmlFor="image-upload" className="cursor-pointer">
                    <FiUpload className="w-12 h-12 mx-auto mb-2 text-slate-400" />
                    <div className="text-sm text-slate-600">Click to upload images</div>
                    <div className="text-xs text-slate-400 mt-1">PNG, JPG, JPEG up to 10MB</div>
                  </label>
                </div>
              </div>

              {/* Uploaded Images Preview */}
              {uploadForm.images.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-slate-700 mb-2">Uploaded Images ({uploadForm.images.length})</div>
                  <div className="grid grid-cols-3 gap-3">
                    {uploadForm.images.map((img, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={img.data}
                          alt={`Upload ${idx + 1}`}
                          className="w-full h-24 object-cover rounded-lg border-2 border-slate-200"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <FiX className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-6 h-11 rounded-lg border-2 border-slate-300 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadForm.images.length === 0}
                  className="px-6 h-11 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImagePreview && previewImage && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={closeImagePreview}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-800 truncate">
                {previewImage.name || 'Image Preview'}
              </div>
              <button type="button" onClick={closeImagePreview} className="p-2 rounded-lg hover:bg-slate-100" title="Close">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-slate-50">
              <div className="w-full rounded-xl bg-white border border-slate-200 overflow-hidden">
                <img
                  src={previewImage.data}
                  alt={previewImage.name || 'Preview'}
                  className="w-full max-h-[75vh] object-contain"
                />
              </div>
              <div className="mt-3 flex items-center justify-end gap-2">
                <a
                  href={previewImage.data}
                  download={previewImage.name}
                  className="px-4 h-10 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 inline-flex items-center gap-2"
                >
                  <FiDownload className="w-4 h-4" />
                  Download
                </a>
                <button
                  type="button"
                  onClick={closeImagePreview}
                  className="px-4 h-10 rounded-lg bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className="fixed bottom-4 right-4 z-[100] rounded-lg bg-emerald-600 text-white text-sm px-4 py-2 shadow-lg">{toast}</div>
      )}
    </div>
  )
}
