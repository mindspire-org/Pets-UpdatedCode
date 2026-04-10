import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { FiSearch, FiPlusCircle, FiEye, FiTrash2, FiAlertTriangle, FiX, FiCalendar, FiDollarSign, FiClock, FiFileText, FiPackage, FiActivity, FiShoppingCart, FiUpload } from 'react-icons/fi'
import { MdLocalPharmacy } from 'react-icons/md'
import { TbMicroscope } from 'react-icons/tb'
import { FaPaw } from 'react-icons/fa'
import { useActivity } from '../../context/ActivityContext'
import { petsAPI, prescriptionsAPI, labReportsAPI, pharmacySalesAPI, salesAPI, fullRecordAPI, financialSummaryAPI } from '../../services/api'
import DateRangePicker from '../../components/DateRangePicker'
import * as XLSX from 'xlsx'

export default function Pets(){
  const { addActivity } = useActivity()
  const [items, setItems] = useState([])
  const [prescriptions, setPrescriptions] = useState([])
  const [labReports, setLabReports] = useState([])
  const [pharmacySales, setPharmacySales] = useState([])
  const [shopSales, setShopSales] = useState([])
  const [fullRecord, setFullRecord] = useState(null)
  const [petFin, setPetFin] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [importing, setImporting] = useState(false)
  const importFileRef = useRef(null)
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, failed: 0 })
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const [dateRange, setDateRange] = useState({
    fromDate: '1900-01-01',
    toDate: '2999-12-31'
  })
  const [showAll, setShowAll] = useState(true)
  
  // Load pets from MongoDB on mount
  useEffect(() => {
    loadPets()
  }, [])

  const loadPets = async () => {
    try {
      setLoading(true)
      setError(null)
      const [petsResponse, prescriptionsResponse, labResponse, pharmacyResponse, shopResponse] = await Promise.all([
        petsAPI.getAll(),
        prescriptionsAPI.getAll().catch(() => ({ data: [] })),
        labReportsAPI.getAll().catch(() => ({ data: [] })),
        pharmacySalesAPI.getAll().catch(() => ({ data: [] })),
        salesAPI.getAll().catch(() => ({ data: [] }))
      ])
      
      if (petsResponse && petsResponse.data) {
        const parseApproxToDOB = (text) => {
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
          return d
        }
        const ageFromDOB = (dob) => {
          const birth = new Date(dob)
          if (isNaN(birth)) return ''
          const now = new Date()
          const diffDays = Math.floor((now - birth) / (1000*60*60*24))
          if (diffDays < 60) return `${diffDays} days`
          const months = Math.floor(diffDays / 30.4375)
          if (months < 24) return `${months} months`
          const years = Math.floor(months / 12)
          const remMonths = months % 12
          return remMonths ? `${years} years ${remMonths} months` : `${years} years`
        }
        // Map MongoDB pets to admin format
        const mappedPets = petsResponse.data.map(pet => {
          const dobStr = pet.dateOfBirth || pet.details?.pet?.dateOfBirth || ''
          const approx = pet.age || pet.details?.pet?.dobOrAge || ''
          const capturedAt = pet.ageCapturedAt || pet.details?.pet?.ageCapturedAt || pet.details?.clinic?.dateOfRegistration || pet.when || pet.createdAt || ''
          let ageText = ''
          if (dobStr) ageText = ageFromDOB(dobStr)
          else if (approx) {
            // Compute based on when the age was captured, if available
            const base = String(approx).trim().toLowerCase()
            const m = base.match(/(\d+)\s*(day|days|week|weeks|month|months|year|years)/)
            if (m) {
              let n = parseInt(m[1], 10)
              const unit = m[2]
              let baseDays = 0
              if (['day','days'].includes(unit)) baseDays = n
              else if (['week','weeks'].includes(unit)) baseDays = n*7
              else if (['month','months'].includes(unit)) baseDays = Math.round(n*30.4375)
              else if (['year','years'].includes(unit)) baseDays = Math.round(n*365.25)
              let daysSinceCapture = 0
              if (capturedAt) {
                const cap = new Date(capturedAt)
                if (!isNaN(cap)) {
                  const now = new Date()
                  daysSinceCapture = Math.max(0, Math.floor((now - cap)/(1000*60*60*24)))
                }
              }
              const totalDays = baseDays + daysSinceCapture
              if (totalDays < 60) ageText = `${totalDays} days`
              else {
                const months = Math.floor(totalDays / 30.4375)
                if (months < 24) ageText = `${months} months`
                else {
                  const years = Math.floor(months / 12)
                  const remMonths = months % 12
                  ageText = remMonths ? `${years} years ${remMonths} months` : `${years} years`
                }
              }
            } else {
              // Fallback: derive DOB today from approx
              const d = parseApproxToDOB(approx)
              ageText = d ? ageFromDOB(d.toISOString().slice(0,10)) : String(approx)
            }
          }
          return ({
            id: pet.id || pet._id,
            name: pet.petName || pet.name,
            type: pet.type || pet.species,
            breed: pet.breed || '',
            ageText,
            owner: pet.ownerName || pet.details?.owner?.fullName || '',
            contact: pet.ownerContact || pet.details?.owner?.contact || '',
            arrivalTime: pet.details?.clinic?.dateOfRegistration ? new Date(pet.details.clinic.dateOfRegistration).toLocaleString() : '',
            purpose: pet.details?.complaint?.visitType || 'Visit',
            payment: pet.payment || { status: 'Pending', amount: 0 },
            consultantFees: pet.details?.clinic?.consultantFees || 0,
            nextAppointment: pet.nextAppointment || '',
            medications: pet.medications || [],
            createdAt: pet.createdAt || pet.when || pet.details?.clinic?.dateOfRegistration || new Date().toISOString(),
            registrationDate: pet.details?.clinic?.dateOfRegistration || pet.createdAt || pet.when || new Date().toISOString(),
            status: (pet.status === 'Deceased') ? 'Expired' : (pet.status || 'Active'),
            dateOfDeath: pet.dateOfDeath || pet.details?.life?.deathDate || '',
            rawData: pet
          })
        })
        setItems(mappedPets)
      }
      
      if (prescriptionsResponse && prescriptionsResponse.data) {
        setPrescriptions(prescriptionsResponse.data)
      }
      
      if (labResponse && labResponse.data) {
        setLabReports(labResponse.data)
      }
      
      if (pharmacyResponse && pharmacyResponse.data) {
        setPharmacySales(pharmacyResponse.data)
      }
      
      if (shopResponse && shopResponse.data) {
        setShopSales(shopResponse.data)
      }
    } catch (err) {
      console.error('Error loading data from MongoDB:', err)
      setError('Failed to load data from database')
    } finally {
      setLoading(false)
    }
  }
  const [q, setQ] = useState('')
  const [showPetDetails, setShowPetDetails] = useState(false)
  const [selectedPet, setSelectedPet] = useState(null)
  
  // Date filtering function
  const isDateInRange = (dateStr) => {
    if (!dateStr) return true
    try {
      const date = new Date(dateStr).toISOString().slice(0,10)
      return date >= dateRange.fromDate && date <= dateRange.toDate
    } catch {
      return true
    }
  }
  
  const handleDateRangeChange = useCallback((newDateRange) => {
    setDateRange(newDateRange)
    setShowAll(newDateRange.fromDate === '1900-01-01' && newDateRange.toDate === '2999-12-31')
  }, [])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [petToDelete, setPetToDelete] = useState(null)

  const filtered = useMemo(() => items.filter(i => {
    const hay = [
      i.name, i.id, i.owner, i.contact, i.type, i.breed,
      i.rawData?.clientId, i.rawData?.details?.owner?.clientId, i.rawData?.details?.owner?.ownerId,
      i.rawData?.details?.owner?.fullName, i.rawData?.details?.owner?.contact
    ].map(v => String(v||'').toLowerCase()).join(' ')
    const matchesSearch = !q || hay.includes(q.toLowerCase())
    const matchesDate = showAll ? true : isDateInRange(i.createdAt || i.registrationDate)
    return matchesSearch && (q ? true : matchesDate)
  }), [items, q, dateRange.fromDate, dateRange.toDate, showAll])

  useEffect(() => {
    setPage(1)
  }, [q, pageSize, dateRange.fromDate, dateRange.toDate, showAll])

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

  const confirmDelete = (pet) => {
    setPetToDelete(pet)
    setShowDeleteConfirm(true)
  }

  const del = async (id) => {
    try {
      setLoading(true)
      await petsAPI.delete(id)
      const updatedItems = items.filter(p => p.id !== id)
      setItems(updatedItems)
      setShowDeleteConfirm(false)
      
      const pet = items.find(p => p.id === id)
      if (pet) addActivity({ user: 'Admin', text: `Deleted pet: ${pet.name}` })
    } catch (error) {
      console.error('Error deleting pet from MongoDB:', error)
      setError('Failed to delete pet')
    } finally {
      setLoading(false)
    }
  }

  const viewPetDetails = (pet) => {
    setSelectedPet(pet)
    setShowPetDetails(true)
  }

  // Load unified full record when dialog opens
  useEffect(() => {
    (async () => {
      try {
        if (showPetDetails && selectedPet?.id) {
          setLoading(true)
          const res = await fullRecordAPI.getByPet(selectedPet.id)
          setFullRecord(res.data)
          try {
            const cid = String(selectedPet?.rawData?.clientId || selectedPet?.rawData?.details?.owner?.clientId || '').trim()
            if (cid) {
              const fs = await financialSummaryAPI.getByClient(cid)
              const list = Array.isArray(fs?.data?.pets) ? fs.data.pets : []
              const petId = String(selectedPet.id || '').trim()
              const it = list.find(p => String(p.petId||'').trim() === petId)
              setPetFin(it || null)
            } else {
              setPetFin(null)
            }
          } catch { setPetFin(null) }
        }
      } catch (e) {
        console.warn('Failed to load full record, falling back to local lists', e)
        setFullRecord(null)
      } finally {
        setLoading(false)
      }
    })()
  }, [showPetDetails, selectedPet?.id])

  // Refresh on cross-app financial updates (e.g., consultant fee paid)
  useEffect(() => {
    const refresh = () => {
      try {
        loadPets()
        if (showPetDetails && selectedPet?.id) {
          (async () => {
            try {
              setLoading(true)
              const res = await fullRecordAPI.getByPet(selectedPet.id)
              setFullRecord(res.data)
              try {
                const cid = String(selectedPet?.rawData?.clientId || selectedPet?.rawData?.details?.owner?.clientId || '').trim()
                if (cid) {
                  const fs = await financialSummaryAPI.getByClient(cid)
                  const list = Array.isArray(fs?.data?.pets) ? fs.data.pets : []
                  const petId = String(selectedPet.id || '').trim()
                  const it = list.find(p => String(p.petId||'').trim() === petId)
                  setPetFin(it || null)
                } else {
                  setPetFin(null)
                }
              } catch {}
            } catch {}
            finally { setLoading(false) }
          })()
        }
      } catch {}
    }
    const onStorage = (e) => { try { if (e.key === 'financial_updated_at') refresh() } catch {} }
    window.addEventListener('financial-updated', refresh)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('financial-updated', refresh)
      window.removeEventListener('storage', onStorage)
    }
  }, [showPetDetails, selectedPet?.id])

  const handleImportClick = () => {
    console.log('Import button clicked');
    console.log('importFileRef.current:', importFileRef.current);
    if (importFileRef.current) {
      importFileRef.current.click();
      console.log('File input click triggered');
    } else {
      console.error('File input ref is null');
      alert('Error: File input not found');
    }
  }

  const parseRowsToPets = (rows) => {
    const out = [];
    for (const r of rows) {
      const isEmptyRow = !r || Object.values(r).every(v => (
        v === undefined || v === null || String(v).trim() === ''
      ));
      if (isEmptyRow) continue;

      const petName = (r.petname || r.petName || r.pet_name || r.name || r.pet || '').toString().trim();
      const type = (r.type || r.species || r.pettype || r.pet_type || '').toString().trim();
      const breed = (r.breed || '').toString().trim();
      const age = (r.age || r.doborage || r.agetext || '').toString().trim();
      const ownerName = (r.ownername || r.ownerName || r.owner_name || r.owner || r.client || '').toString().trim();
      const ownerContact = (r.ownercontact || r.ownerContact || r.owner_contact || r.contact || r.phone || '').toString().trim();
      const visitType = (r.visittype || r.visitType || r.visit_type || r.purpose || r.visit || 'Visit').toString().trim();
      
      if (!petName || !ownerName) {
        console.log('Skipping row - missing petName or ownerName:', r);
        continue;
      }
      
      out.push({
        petName,
        type: type || 'Pet',
        breed,
        age,
        ownerName,
        ownerContact,
        details: {
          complaint: { visitType },
          clinic: { dateOfRegistration: new Date().toISOString() }
        }
      });
    }
    return out;
  }

  const handleImportFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    alert('File selected: ' + (file ? file.name : 'none'));
    try {
      if (!file) return;
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (!['xlsx','csv','xls'].includes(ext)) {
        setError('Invalid file. Please upload .xlsx or .csv');
        return;
      }
      setImporting(true);
      setImportProgress({ current: 0, total: 0, failed: 0 });
      setError(null);
      
      alert('Reading file...');
      const data = await file.arrayBuffer();
      alert('File size: ' + data.byteLength);
      
      const wb = XLSX.read(data, { type: 'array' });
      alert('Sheets found: ' + wb.SheetNames.join(', '));
      
      const firstSheet = wb.SheetNames[0];
      const ws = wb.Sheets[firstSheet];
      if (!ws) { setError('No sheet found'); return; }
      
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 });
      alert('Total rows: ' + rows.length);
      if (!rows || rows.length < 2) { setError('No data rows found'); return; }
      
      const headers = rows[0].map(h => String(h).trim().toLowerCase().replace(/\s+/g, ''));
      alert('Headers: ' + headers.join(', '));
      
      const dataRows = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.every(v => !v || String(v).trim() === '')) continue;
        const obj = {};
        headers.forEach((h, idx) => { obj[h] = row[idx] || ''; });
        dataRows.push(obj);
      }
      
      alert('Data rows: ' + dataRows.length);
      
      const items = parseRowsToPets(dataRows);
      alert('Parsed items: ' + items.length);
      
      if (!items.length) { 
        setError(`No valid rows. Required: petName, ownerName. Found: ${headers.join(', ')}`); 
        return; 
      }
      
      setImportProgress({ current: 0, total: items.length, failed: 0 });
      
      let created = 0, failed = 0;
      for (const pet of items) {
        try {
          await petsAPI.create(pet);
          created++;
        } catch (err) { 
          failed++; 
          console.log('Failed to create pet:', pet.petName, err);
        }
        setImportProgress({ current: created + failed, total: items.length, failed });
      }
      
      alert(`Import complete! Created: ${created}, Failed: ${failed}`);
      addActivity({ user: 'Admin', text: `Imported ${created} pets from Excel (${items.length} rows)` });
      if (failed > 0) setError(`Import complete: ${created} created, ${failed} failed`);
      loadPets();
    } catch (err) {
      alert('Import error: ' + err.message);
      setError(err?.message || 'Import failed');
    } finally {
      setImporting(false);
      setImportProgress({ current: 0, total: 0, failed: 0 });
      try { if (importFileRef.current) importFileRef.current.value = ''; } catch {}
    }
  }

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiAlertTriangle className="w-5 h-5" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <FiX className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FaPaw className="h-8 w-8 text-indigo-600" />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-blue-500 bg-clip-text text-transparent">Pets Records</h1>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={importFileRef}
            type="file"
            accept=".xlsx,.csv,.xls"
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            onClick={handleImportClick}
            disabled={importing}
            className={`flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-sm font-medium ${importing ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <FiUpload className="w-4 h-4" />
            {importing ? `Importing ${importProgress.current}/${importProgress.total}` : 'Import'}
          </button>
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="h-10 pl-10 pr-4 w-64 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              placeholder="Search pets, client, phone, ID..."
              value={q}
              onChange={e=>setQ(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="rounded-2xl bg-gradient-to-br from-white via-indigo-50 to-purple-50 shadow-xl ring-1 ring-indigo-200 border border-indigo-100 p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <FiCalendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-indigo-600">Filter by Registration Date</div>
              <div className="text-lg font-bold text-slate-800">
                {showAll
                  ? 'All'
                  : dateRange.fromDate === dateRange.toDate 
                  ? new Date(dateRange.fromDate).toLocaleDateString()
                  : `${new Date(dateRange.fromDate).toLocaleDateString()} - ${new Date(dateRange.toDate).toLocaleDateString()}`
                }
              </div>
            </div>
          </div>
          
          <DateRangePicker 
            onDateChange={handleDateRangeChange}
            defaultFromDate={dateRange.fromDate}
            defaultToDate={dateRange.toDate}
            showAllButton={true}
            onAllClick={() => setShowAll(true)}
          />
        </div>
      </div>

      <div className="rounded-2xl bg-white shadow-lg ring-1 ring-slate-200/70 p-6 overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <FaPaw className="h-5 w-5" />
            </div>
            <div className="font-semibold text-slate-800">All Pets ({filtered.length})</div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="h-10 px-3 rounded-lg border border-slate-300 bg-white"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="h-10 px-3 rounded-lg border border-slate-300 bg-white disabled:opacity-50"
            >
              Prev
            </button>
            <div className="text-sm text-slate-600 whitespace-nowrap">
              Page {Math.min(page, totalPages)} / {totalPages}
            </div>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="h-10 px-3 rounded-lg border border-slate-300 bg-white disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>

        <div className="mb-4 text-sm text-slate-600">
          Showing {filtered.length ? (((Math.min(page, totalPages) - 1) * pageSize) + 1) : 0}-{Math.min(filtered.length, (Math.min(page, totalPages) * pageSize))} of {filtered.length}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-500 rounded-lg">
                <th className="py-3 px-4 font-medium rounded-l-lg">Pet</th>
                <th className="py-3 px-4 font-medium">Type</th>
                <th className="py-3 px-4 font-medium">Breed</th>
                <th className="py-3 px-4 font-medium">Age</th>
                <th className="py-3 px-4 font-medium">Owner</th>
                <th className="py-3 px-4 font-medium">Contact</th>
                <th className="py-3 px-4 font-medium">Purpose</th>
                <th className="py-3 px-4 font-medium rounded-r-lg">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedPets.map(p => (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 font-medium text-indigo-600">
                    <div className="flex items-center gap-2">
                      <span>{p.name}</span>
                      {(p.status==='Expired'||p.status==='Deceased') && (
                        <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-semibold">
                          Expired{p.dateOfDeath ? ` • ${new Date(p.dateOfDeath).toLocaleDateString()}` : ''}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">{p.type}</td>
                  <td className="py-3 px-4">{p.breed}</td>
                  <td className="py-3 px-4">{p.ageText || '—'}</td>
                  <td className="py-3 px-4">{p.owner}</td>
                  <td className="py-3 px-4">{p.contact}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                      {p.purpose}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => viewPetDetails(p)} 
                        className="p-2 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition cursor-pointer"
                        title="View Details"
                      >
                        <FiEye className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => confirmDelete(p)} 
                        className="p-2 rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition cursor-pointer"
                        title="Delete"
                      >
                        <FiTrash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pet Details Dialog */}
      {showPetDetails && selectedPet && (() => {
        // Prefer unified record when available
        const petPrescriptions = fullRecord?.prescriptions?.length ? fullRecord.prescriptions : (
          prescriptions.filter(p => 
            p.patient?.id === selectedPet.id || 
            (p.patient?.petName?.toLowerCase() === selectedPet.name?.toLowerCase() && 
             p.patient?.ownerName?.toLowerCase() === selectedPet.owner?.toLowerCase())
          ).sort((a, b) => new Date(b.when) - new Date(a.when))
        )

        const petLabReports = fullRecord?.labReports?.length ? fullRecord.labReports : (
          labReports.filter(report => 
            report.petId === selectedPet.id ||
            (report.petName?.toLowerCase() === selectedPet.name?.toLowerCase() && 
             report.ownerName?.toLowerCase() === selectedPet.owner?.toLowerCase())
          ).sort((a, b) => new Date(b.createdAt || b.reportDate) - new Date(a.createdAt || a.reportDate))
        )

        const petPharmacySales = fullRecord?.pharmacySales?.length ? fullRecord.pharmacySales : (
          pharmacySales.filter(sale => 
            sale.petId === selectedPet.id ||
            (sale.petName?.toLowerCase() === selectedPet.name?.toLowerCase() && 
             sale.customerName?.toLowerCase() === selectedPet.owner?.toLowerCase())
          ).sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))
        )

        const petShopSales = shopSales.filter(sale => 
          sale.petId === selectedPet.id ||
          (sale.petName?.toLowerCase() === selectedPet.name?.toLowerCase() && 
           sale.customerName?.toLowerCase() === selectedPet.owner?.toLowerCase())
        ).sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))

        const latestPharmacySale = petPharmacySales.length ? petPharmacySales[0] : null
        const latestPaymentMethod = latestPharmacySale?.paymentMethod || ''
        const latestPaymentDetails = latestPharmacySale?.paymentDetails || {}
        const latestPaymentCharge = Number(latestPharmacySale?.paymentCharge || 0)
        const latestDiscountBreakdown = latestPharmacySale?.discountBreakdown || {}
        const latestReceived = Number((latestPharmacySale?.receivedAmount ?? latestPharmacySale?.totalAmount ?? 0) || 0)
        const latestPending = Math.max(0, Number(latestPharmacySale?.totalAmount || 0) - latestReceived)
        const latestStatus = latestPharmacySale?.status || (latestPending > 0 ? 'Pending' : 'Completed')

        const totalLabCosts = fullRecord?.totals ? fullRecord.totals.labTotal : petLabReports.reduce((sum, report) => sum + (report.amount || 0), 0)
        const totalPharmacyCosts = fullRecord?.totals ? fullRecord.totals.pharmacyTotal : petPharmacySales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0)
        const totalShopCosts = petShopSales.reduce((sum, sale) => sum + (sale.totalAmount || sale.total || 0), 0)
        const totalConsultantFees = Number((petFin?.modules?.consultant?.amount) 
          || (fullRecord?.totals?.consultationFees) 
          || (selectedPet.consultantFees) 
          || 0)
        const grandTotal = totalLabCosts + totalPharmacyCosts + totalShopCosts + totalConsultantFees

        const hasAnyPurchases = totalLabCosts > 0 || totalPharmacyCosts > 0 || totalShopCosts > 0 || totalConsultantFees > 0
        const paymentStatus = (petFin?.modules?.consultant?.paid)
          ? 'Paid'
          : (hasAnyPurchases ? 'Pending' : 'No Charges')

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-6xl w-full p-6 animate-fade-in max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <FaPaw className="h-7 w-7 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                      <span>{selectedPet.name}</span>
                      {(selectedPet.status==='Expired'||selectedPet.status==='Deceased') && (
                        <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                          Expired{selectedPet.dateOfDeath ? ` • ${new Date(selectedPet.dateOfDeath).toLocaleDateString()}` : ''}
                        </span>
                      )}
                    </h2>
                    <p className="text-slate-500">{selectedPet.breed} {selectedPet.type}, {selectedPet.ageText || '—'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowPetDetails(false)} 
                  className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition cursor-pointer"
                >
                  <FiX className="h-6 w-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Basic Information */}
                <div className="bg-slate-50 rounded-xl p-5">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <FiFileText className="text-indigo-500" />
                    Basic Information
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Pet ID</span>
                      <span className="font-medium text-slate-800 font-mono text-sm">{selectedPet.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Owner</span>
                      <span className="font-medium text-slate-800">{selectedPet.owner}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Contact</span>
                      <span className="font-medium text-slate-800">{selectedPet.contact || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Type</span>
                      <span className="font-medium text-slate-800">{selectedPet.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Breed</span>
                      <span className="font-medium text-slate-800">{selectedPet.breed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Age</span>
                      <span className="font-medium text-slate-800">{selectedPet.ageText || '—'}</span>
                    </div>
                  </div>
                </div>

                {petFin && (
                  <div className="rounded-2xl p-5 border border-indigo-200 bg-indigo-50">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">All Portals Financials (Per-pet)</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div className="bg-white/60 rounded-lg p-3 border border-indigo-200">
                        <div className="text-slate-600 font-medium">Pharmacy Pending</div>
                        <div className="font-bold text-slate-800">Rs. {Number(petFin?.modules?.pharmacy?.pending||0).toLocaleString()}</div>
                      </div>
                      <div className="bg-white/60 rounded-lg p-3 border border-indigo-200">
                        <div className="text-slate-600 font-medium">Lab Pending</div>
                        <div className="font-bold text-slate-800">Rs. {Number(petFin?.modules?.lab?.pending||0).toLocaleString()}</div>
                      </div>
                      <div className="bg-white/60 rounded-lg p-3 border border-indigo-200">
                        <div className="text-slate-600 font-medium">Procedures Pending</div>
                        <div className="font-bold text-slate-800">Rs. {Number(petFin?.modules?.procedures?.pending||0).toLocaleString()}</div>
                      </div>
                      <div className="bg-white/60 rounded-lg p-3 border border-indigo-200">
                        <div className="text-slate-600 font-medium">Pet Shop Pending</div>
                        <div className="font-bold text-slate-800">Rs. {Number(petFin?.modules?.petShop?.pending||0).toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mt-4">
                      <div className="bg-white/60 rounded-lg p-3 border border-indigo-200">
                        <div className="text-slate-600 font-medium">Consultant</div>
                        <div className={petFin?.modules?.consultant?.paid ? 'font-bold text-green-700' : 'font-bold text-red-700'}>
                          {petFin?.modules?.consultant?.paid 
                            ? `Paid Rs. ${Number(petFin?.modules?.consultant?.amount||0).toLocaleString()}`
                            : 'Pending'}
                        </div>
                      </div>
                      <div className="bg-white/60 rounded-lg p-3 border border-indigo-200">
                        <div className="text-slate-600 font-medium">Total Received</div>
                        <div className="font-bold text-green-700">Rs. {(() => { try { const rc = Number(petFin?.totals?.received||0); const cons = petFin?.modules?.consultant?.paid ? Number(petFin?.modules?.consultant?.amount||0) : 0; return Math.max(rc, cons).toLocaleString() } catch { return '0' } })()}</div>
                      </div>
                      <div className="bg-white/60 rounded-lg p-3 border border-indigo-200">
                        <div className="text-slate-600 font-medium">Total Pending</div>
                        <div className="font-bold text-amber-700">Rs. {(() => { try { const pd = Number(petFin?.totals?.pending||0); const consPend = !petFin?.modules?.consultant?.paid ? Number(petFin?.modules?.consultant?.amount||0) : 0; return Math.max(pd, consPend).toLocaleString() } catch { return '0' } })()}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Visit Information */}
                <div className="bg-slate-50 rounded-xl p-5">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <FiClock className="text-indigo-500" />
                    Visit Information
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Arrival Time</span>
                      <span className="font-medium text-slate-800 text-sm">{selectedPet.arrivalTime || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Purpose</span>
                      <span className="font-medium text-slate-800 px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs">
                        {selectedPet.purpose}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Next Appointment</span>
                      <span className="font-medium text-slate-800 flex items-center gap-1 text-sm">
                        <FiCalendar className="text-indigo-500 h-3 w-3" />
                        {selectedPet.nextAppointment || 'Not scheduled'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Comprehensive Financial Information */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border border-green-200">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <FiDollarSign className="text-green-600" />
                    Complete Financial Summary
                  </h3>
                  <div className="space-y-4">
                    {/* Portal-wise spending */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-white/60 rounded-lg p-3 border border-green-200">
                        <div className="flex items-center gap-2 mb-1">
                          <TbMicroscope className="text-cyan-600 w-4 h-4" />
                          <span className="text-slate-600 font-medium">Lab Tests</span>
                        </div>
                        <div className="font-bold text-slate-800">Rs. {totalLabCosts.toLocaleString()}</div>
                        <div className="text-xs text-slate-500">{petLabReports.length} test{petLabReports.length !== 1 ? 's' : ''}</div>
                      </div>
                      
                      <div className="bg-white/60 rounded-lg p-3 border border-green-200">
                        <div className="flex items-center gap-2 mb-1">
                          <MdLocalPharmacy className="text-violet-600 w-4 h-4" />
                          <span className="text-slate-600 font-medium">Medicines</span>
                        </div>
                        <div className="font-bold text-slate-800">Rs. {totalPharmacyCosts.toLocaleString()}</div>
                        <div className="text-xs text-slate-500">
                          {petPharmacySales.length > 0 
                            ? `${petPharmacySales.length} purchase${petPharmacySales.length !== 1 ? 's' : ''}` 
                            : 'No purchases'
                          }
                        </div>
                      </div>
                      
                      <div className="bg-white/60 rounded-lg p-3 border border-green-200">
                        <div className="flex items-center gap-2 mb-1">
                          <FiShoppingCart className="text-emerald-600 w-4 h-4" />
                          <span className="text-slate-600 font-medium">Shop Items</span>
                        </div>
                        <div className="font-bold text-slate-800">Rs. {totalShopCosts.toLocaleString()}</div>
                        <div className="text-xs text-slate-500">
                          {petShopSales.length > 0 
                            ? `${petShopSales.length} purchase${petShopSales.length !== 1 ? 's' : ''}` 
                            : 'No purchases'
                          }
                        </div>
                      </div>
                      
                      <div className="bg-white/60 rounded-lg p-3 border border-green-200">
                        <div className="flex items-center gap-2 mb-1">
                          <FiActivity className="text-indigo-600 w-4 h-4" />
                          <span className="text-slate-600 font-medium">Consultation</span>
                        </div>
                        <div className="font-bold text-slate-800">Rs. {totalConsultantFees.toLocaleString()}</div>
                        <div className="text-xs text-slate-500">{petFin?.modules?.consultant?.paid ? 'Paid' : 'Pending'}</div>
                      </div>
                    </div>

                    {/* Grand Total */}
                    <div className="border-t border-green-300 pt-3 mt-3">
                      <div className="flex justify-between items-center bg-gradient-to-r from-green-100 to-emerald-100 rounded-lg p-3">
                        <span className="text-slate-700 font-bold text-lg">Total Spending</span>
                        <span className="font-bold text-green-700 text-2xl">Rs. {grandTotal.toLocaleString()}</span>
                      </div>
                      <div className="mt-2 text-xs text-green-700 bg-green-100 rounded px-2 py-1 text-center">
                        ✓ All portal activities included
                      </div>
                    </div>

                    {/* Payment Status */}
                    <div className="flex justify-between items-center pt-2 border-t border-green-200">
                      <span className="text-slate-600 font-medium">Payment Status</span>
                      <span className={`font-medium px-3 py-1 rounded-full text-xs ${
                        paymentStatus === 'Paid' 
                          ? 'bg-green-100 text-green-700' 
                          : paymentStatus === 'No Charges'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {paymentStatus}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Prescription Summary */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-200">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <FiPackage className="text-blue-600" />
                    Prescription Summary
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Total Prescriptions</span>
                      <span className="font-bold text-blue-700 text-2xl">{petPrescriptions.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Total Medicines</span>
                      <span className="font-semibold text-slate-800 text-lg">
                        {petPrescriptions.reduce((sum, p) => sum + (p.items?.length || 0), 0)}
                      </span>
                    </div>
                    {petPrescriptions.length > 0 && (
                      <div className="border-t border-blue-200 pt-3 mt-3">
                        <div className="text-xs text-slate-600">Last Prescription</div>
                        <div className="font-medium text-slate-800">
                          {new Date(petPrescriptions[0].when).toLocaleDateString()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Detailed Prescription History */}
              {petPrescriptions.length > 0 && (
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-200 mb-6">
                  <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <FiFileText className="text-indigo-600" />
                    Complete Prescription History ({petPrescriptions.length})
                  </h3>
                  <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                    {petPrescriptions.map((prescription, idx) => (
                      <div key={idx} className="bg-white rounded-lg p-4 shadow-md border border-indigo-200">
                        <div className="flex justify-between items-start mb-3 pb-3 border-b border-slate-200">
                          <div>
                            <div className="font-bold text-slate-800 text-lg">
                              Prescription #{petPrescriptions.length - idx}
                            </div>
                            <div className="text-sm text-slate-600">
                              {new Date(prescription.when).toLocaleDateString()} at {new Date(prescription.when).toLocaleTimeString()}
                            </div>
                          </div>
                          <div className="text-right">
                            {prescription.doctor?.name && (
                              <div className="text-sm font-medium text-indigo-700">
                                Dr. {prescription.doctor.name}
                              </div>
                            )}
                            <div className="text-xs text-slate-500 mt-1">
                              {(prescription.items || []).length} medicine{(prescription.items || []).length !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>

                        {/* Patient Vitals */}
                        {(prescription.patient?.weightKg || prescription.patient?.tempF || prescription.patient?.dehydration) && (
                          <div className="bg-blue-50 rounded-lg p-3 mb-3">
                            <div className="font-semibold text-blue-800 text-sm mb-2">Patient Vitals</div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              {prescription.patient.weightKg && (
                                <div>
                                  <span className="text-slate-600">Weight:</span>
                                  <span className="font-medium text-slate-800 ml-1">{prescription.patient.weightKg} kg</span>
                                </div>
                              )}
                              {prescription.patient.tempF && (
                                <div>
                                  <span className="text-slate-600">Temp:</span>
                                  <span className="font-medium text-slate-800 ml-1">{prescription.patient.tempF}°F</span>
                                </div>
                              )}
                              {prescription.patient.dehydration && (
                                <div>
                                  <span className="text-slate-600">Dehydration:</span>
                                  <span className="font-medium text-slate-800 ml-1">{prescription.patient.dehydration}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Medicines List */}
                        <div className="space-y-3">
                          <div className="font-semibold text-slate-800 flex items-center gap-2">
                            <FiPackage className="text-indigo-500" />
                            Prescribed Medicines
                          </div>
                          {(prescription.items || []).map((item, itemIdx) => (
                            <div key={itemIdx} className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg p-3 border-l-4 border-indigo-400">
                              <div className="flex justify-between items-start mb-2">
                                <div className="font-bold text-indigo-800 text-base">{itemIdx + 1}. {item.name}</div>
                                {item.composition && (
                                  <div className="text-xs text-slate-600 bg-white px-2 py-1 rounded">
                                    {item.composition}
                                  </div>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                {item.dose && (
                                  <div className="bg-white/60 rounded px-2 py-1">
                                    <span className="font-semibold text-slate-700">Dose:</span>
                                    <span className="text-slate-800 ml-1">{item.dose} {item.unit || ''}</span>
                                  </div>
                                )}
                                {item.route && (
                                  <div className="bg-white/60 rounded px-2 py-1">
                                    <span className="font-semibold text-slate-700">Route:</span>
                                    <span className="text-slate-800 ml-1">{item.route}</span>
                                  </div>
                                )}
                                {item.doseRate && (
                                  <div className="bg-white/60 rounded px-2 py-1 col-span-2">
                                    <span className="font-semibold text-slate-700">Dose Rate:</span>
                                    <span className="text-slate-800 ml-1">{item.doseRate}</span>
                                  </div>
                                )}
                                {item.perMl && (
                                  <div className="bg-white/60 rounded px-2 py-1">
                                    <span className="font-semibold text-slate-700">Per ML:</span>
                                    <span className="text-slate-800 ml-1">{item.perMl}</span>
                                  </div>
                                )}
                              </div>
                              {item.instructions && (
                                <div className="mt-2 bg-amber-50 rounded px-2 py-1 text-sm">
                                  <span className="font-semibold text-amber-800">Instructions:</span>
                                  <span className="text-slate-700 ml-1">{item.instructions}</span>
                                </div>
                              )}
                              {item.condition && (
                                <div className="mt-1 bg-green-50 rounded px-2 py-1 text-sm">
                                  <span className="font-semibold text-green-800">Condition:</span>
                                  <span className="text-slate-700 ml-1">{item.condition}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Clinical Notes */}
                        {(prescription.notes?.hx?.length > 0 || prescription.notes?.oe?.length > 0 || prescription.notes?.dx?.length > 0) && (
                          <div className="mt-3 bg-slate-50 rounded-lg p-3">
                            <div className="font-semibold text-slate-800 mb-2 text-sm">Clinical Notes</div>
                            <div className="space-y-2 text-xs">
                              {prescription.notes.hx?.length > 0 && (
                                <div>
                                  <span className="font-semibold text-slate-700">History:</span>
                                  <div className="text-slate-600 ml-2">{prescription.notes.hx.join(', ')}</div>
                                </div>
                              )}
                              {prescription.notes.oe?.length > 0 && (
                                <div>
                                  <span className="font-semibold text-slate-700">Examination:</span>
                                  <div className="text-slate-600 ml-2">{prescription.notes.oe.join(', ')}</div>
                                </div>
                              )}
                              {prescription.notes.dx?.length > 0 && (
                                <div>
                                  <span className="font-semibold text-slate-700">Diagnosis:</span>
                                  <div className="text-slate-600 ml-2">{prescription.notes.dx.join(', ')}</div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* General Note */}
                        {prescription.note && (
                          <div className="mt-3 bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                            <div className="font-semibold text-yellow-800 text-sm mb-1">Doctor's Note</div>
                            <div className="text-slate-700 text-sm">{prescription.note}</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {petPrescriptions.length === 0 && (
                <div className="bg-slate-50 rounded-xl p-8 text-center mb-6">
                  <FiFileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">No prescription history available for this pet.</p>
                </div>
              )}

              {/* Lab Reports History */}
              {petLabReports.length > 0 && (
                <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl p-6 border border-cyan-200 mb-6">
                  <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <TbMicroscope className="text-cyan-600" />
                    Laboratory Test Reports ({petLabReports.length})
                  </h3>
                  <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                    {petLabReports.map((report, idx) => (
                      <div key={idx} className="bg-white rounded-lg p-4 shadow-md border border-cyan-200">
                        <div className="flex justify-between items-start mb-3 pb-3 border-b border-slate-200">
                          <div>
                            <div className="font-bold text-slate-800 text-lg">
                              {report.testType || 'Lab Test'} - Report #{report.reportNumber || report.id}
                            </div>
                            <div className="text-sm text-slate-600">
                              {new Date(report.createdAt || report.reportDate).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-cyan-700">Rs. {(report.amount || 0).toLocaleString()}</div>
                            <div className="text-xs text-slate-500 bg-cyan-100 px-2 py-1 rounded">
                              {report.status || 'Completed'}
                            </div>
                          </div>
                        </div>
                        
                        {report.tests && report.tests.length > 0 && (
                          <div className="space-y-2">
                            <div className="font-semibold text-slate-800 text-sm">Test Results:</div>
                            {report.tests.map((test, testIdx) => (
                              <div key={testIdx} className="bg-cyan-50 rounded p-2 text-sm">
                                <div className="font-medium text-cyan-800">{test.testName}</div>
                                <div className="text-slate-600">
                                  Result: <span className="font-medium">{test.result}</span>
                                  {test.unit && <span className="ml-1">({test.unit})</span>}
                                  {test.normalRange && <span className="ml-2 text-xs text-slate-500">Normal: {test.normalRange}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {report.overallNotes && (
                          <div className="mt-3 bg-slate-50 rounded p-2 text-sm">
                            <span className="font-semibold text-slate-700">Notes:</span>
                            <div className="text-slate-600 mt-1">{report.overallNotes}</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pharmacy Purchases History */}
              {petPharmacySales.length > 0 && (
                <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl p-6 border border-violet-200 mb-6">
                  <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <MdLocalPharmacy className="text-violet-600" />
                    Pharmacy Purchases ({petPharmacySales.length})
                  </h3>

                  {latestPharmacySale && (
                    <div className="bg-white/70 rounded-xl p-4 border border-violet-200 mb-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="font-semibold text-slate-800">
                          Latest Payment
                        </div>
                        <div className="text-sm text-slate-700">
                          <span className="font-semibold">Method:</span> {latestPaymentMethod || '—'}
                          {latestPaymentCharge > 0 && (
                            <span className="ml-2 text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
                              Charge: Rs. {latestPaymentCharge.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3 text-sm">
                        <div className="bg-white rounded-lg p-3 border border-slate-200">
                          <div className="text-xs text-slate-500 font-semibold">Received</div>
                          <div className="font-medium text-slate-800 break-words">Rs. {latestReceived.toLocaleString()}</div>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-slate-200">
                          <div className="text-xs text-slate-500 font-semibold">Pending</div>
                          <div className="font-medium text-slate-800 break-words">Rs. {latestPending.toLocaleString()}</div>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-slate-200">
                          <div className="text-xs text-slate-500 font-semibold">Status</div>
                          <div className="font-medium text-slate-800 break-words">{latestStatus}</div>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-slate-200">
                          <div className="text-xs text-slate-500 font-semibold">Discount (M/S/P)</div>
                          <div className="font-medium text-slate-800 break-words">
                            Rs. {Number(latestDiscountBreakdown?.medicine||0).toLocaleString()} / {Number(latestDiscountBreakdown?.surgical||0).toLocaleString()} / {Number(latestDiscountBreakdown?.procedures||0).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3 text-sm">
                        {latestPaymentDetails?.bankName && (
                          <div className="bg-white rounded-lg p-3 border border-slate-200">
                            <div className="text-xs text-slate-500 font-semibold">Bank Name</div>
                            <div className="font-medium text-slate-800 break-words">{latestPaymentDetails.bankName}</div>
                          </div>
                        )}
                        {latestPaymentDetails?.accountNumber && (
                          <div className="bg-white rounded-lg p-3 border border-slate-200">
                            <div className="text-xs text-slate-500 font-semibold">Account / IBAN</div>
                            <div className="font-medium text-slate-800 break-words">{latestPaymentDetails.accountNumber}</div>
                          </div>
                        )}
                        {latestPaymentDetails?.walletNumber && (
                          <div className="bg-white rounded-lg p-3 border border-slate-200">
                            <div className="text-xs text-slate-500 font-semibold">Wallet Number</div>
                            <div className="font-medium text-slate-800 break-words">{latestPaymentDetails.walletNumber}</div>
                          </div>
                        )}
                        {latestPaymentDetails?.transactionId && (
                          <div className="bg-white rounded-lg p-3 border border-slate-200">
                            <div className="text-xs text-slate-500 font-semibold">Transaction ID</div>
                            <div className="font-medium text-slate-800 break-words">{latestPaymentDetails.transactionId}</div>
                          </div>
                        )}
                        {latestPaymentDetails?.cardHolderName && (
                          <div className="bg-white rounded-lg p-3 border border-slate-200">
                            <div className="text-xs text-slate-500 font-semibold">Card Holder</div>
                            <div className="font-medium text-slate-800 break-words">{latestPaymentDetails.cardHolderName}</div>
                          </div>
                        )}
                        {latestPaymentDetails?.cardLast4 && (
                          <div className="bg-white rounded-lg p-3 border border-slate-200">
                            <div className="text-xs text-slate-500 font-semibold">Card Last 4</div>
                            <div className="font-medium text-slate-800 break-words">{latestPaymentDetails.cardLast4}</div>
                          </div>
                        )}
                        {latestPaymentDetails?.cardAuthCode && (
                          <div className="bg-white rounded-lg p-3 border border-slate-200">
                            <div className="text-xs text-slate-500 font-semibold">Auth Code</div>
                            <div className="font-medium text-slate-800 break-words">{latestPaymentDetails.cardAuthCode}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                    {petPharmacySales.map((sale, idx) => (
                      <div key={idx} className="bg-white rounded-lg p-4 shadow-md border border-violet-200">
                        <div className="flex justify-between items-start mb-3 pb-3 border-b border-slate-200">
                          <div>
                            <div className="font-bold text-slate-800 text-lg">
                              Invoice #{sale.invoiceNumber || sale.id}
                            </div>
                            <div className="text-sm text-slate-600">
                              {new Date(sale.createdAt || sale.date).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-violet-700">Rs. {(sale.totalAmount || 0).toLocaleString()}</div>
                            <div className="text-xs text-slate-500 bg-violet-100 px-2 py-1 rounded">
                              {sale.status || 'Paid'}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                          <div className="bg-violet-50 rounded p-2 text-sm">
                            <div className="text-xs text-slate-500 font-semibold">Discount (Total)</div>
                            <div className="font-medium text-slate-800">Rs. {Number(sale.discount||0).toLocaleString()}</div>
                          </div>
                          <div className="bg-violet-50 rounded p-2 text-sm">
                            <div className="text-xs text-slate-500 font-semibold">Discount (M/S/P)</div>
                            <div className="font-medium text-slate-800">
                              {Number(sale.discountBreakdown?.medicine||0).toLocaleString()} / {Number(sale.discountBreakdown?.surgical||0).toLocaleString()} / {Number(sale.discountBreakdown?.procedures||0).toLocaleString()}
                            </div>
                          </div>
                          <div className="bg-violet-50 rounded p-2 text-sm">
                            <div className="text-xs text-slate-500 font-semibold">Received</div>
                            <div className="font-medium text-slate-800">Rs. {Number((sale.receivedAmount ?? sale.totalAmount ?? 0)).toLocaleString()}</div>
                          </div>
                          <div className="bg-violet-50 rounded p-2 text-sm">
                            <div className="text-xs text-slate-500 font-semibold">Pending</div>
                            <div className="font-medium text-slate-800">Rs. {Math.max(0, Number(sale.totalAmount||0) - Number((sale.receivedAmount ?? sale.totalAmount ?? 0))).toLocaleString()}</div>
                          </div>
                        </div>
                        
                        {sale.items && sale.items.length > 0 && (
                          <div className="space-y-2">
                            <div className="font-semibold text-slate-800 text-sm">Medicines Purchased:</div>
                            {sale.items.map((item, itemIdx) => (
                              <div key={itemIdx} className="bg-violet-50 rounded p-2 text-sm">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <div className="font-medium text-violet-800">{item.medicineName || item.name}</div>
                                    <div className="text-slate-600">
                                      Qty: <span className="font-medium">{item.quantity}</span>
                                      {item.unit && <span className="ml-1">({item.unit})</span>}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-medium text-slate-800">Rs. {(item.totalPrice || item.price || 0).toLocaleString()}</div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Shop Purchases History */}
              {petShopSales.length > 0 && (
                <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-6 border border-emerald-200 mb-6">
                  <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <FiShoppingCart className="text-emerald-600" />
                    Shop Purchases ({petShopSales.length})
                  </h3>
                  <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                    {petShopSales.map((sale, idx) => (
                      <div key={idx} className="bg-white rounded-lg p-4 shadow-md border border-emerald-200">
                        <div className="flex justify-between items-start mb-3 pb-3 border-b border-slate-200">
                          <div>
                            <div className="font-bold text-slate-800 text-lg">
                              Invoice #{sale.invoiceNumber || sale.id}
                            </div>
                            <div className="text-sm text-slate-600">
                              {new Date(sale.createdAt || sale.date).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-emerald-700">Rs. {(sale.totalAmount || sale.total || 0).toLocaleString()}</div>
                            <div className="text-xs text-slate-500 bg-emerald-100 px-2 py-1 rounded">
                              {sale.status || 'Paid'}
                            </div>
                          </div>
                        </div>
                        
                        {sale.items && sale.items.length > 0 && (
                          <div className="space-y-2">
                            <div className="font-semibold text-slate-800 text-sm">Items Purchased:</div>
                            {sale.items.map((item, itemIdx) => (
                              <div key={itemIdx} className="bg-emerald-50 rounded p-2 text-sm">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <div className="font-medium text-emerald-800">{item.itemName || item.name}</div>
                                    <div className="text-slate-600">
                                      Qty: <span className="font-medium">{item.quantity}</span>
                                      {item.category && <span className="ml-2 text-xs bg-white px-1 rounded">{item.category}</span>}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-medium text-slate-800">Rs. {(item.totalPrice || item.salePrice || 0).toLocaleString()}</div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setShowPetDetails(false)} 
                  className="px-6 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition cursor-pointer font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && petToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-fade-in">
            <div className="flex items-center gap-4 mb-4">
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <FiAlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Confirm Delete</h3>
                <p className="text-slate-500 text-sm">Are you sure you want to delete this pet record?</p>
              </div>
            </div>
            
            <div className="bg-slate-50 rounded-lg p-4 mb-5">
              <p className="text-sm text-slate-700">
                <span className="font-medium">Pet Name:</span> {petToDelete.name}
              </p>
              <p className="text-sm text-slate-700">
                <span className="font-medium">Owner:</span> {petToDelete.owner}
              </p>
            </div>
            
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowDeleteConfirm(false)} 
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={() => del(petToDelete.id)} 
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition flex items-center gap-2 cursor-pointer"
              >
                <FiTrash2 className="h-4 w-4" />
                Delete Pet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
