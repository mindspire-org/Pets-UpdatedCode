import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useSettings } from '../../context/SettingsContext'
import { useNavigate } from 'react-router-dom'
import DateRangePicker from '../../components/DateRangePicker'
import { labReportsAPI, labTestsAPI, petsAPI, inventoryAPI, labRequestsAPI } from '../../services/api'
import { useLocation } from 'react-router-dom'

export default function AddLabReport(){
  const location = useLocation()
  const [intakeId, setIntakeId] = useState('')
  const [form, setForm] = useState({
    petName: '', ownerName: '', patientId: '', species: '', age: '', gender: '',
    testName: '', testId: `T-${Date.now()}`, sampleType: '', referredBy: '',
    result: '', remarks: '', testDate: new Date().toISOString().slice(0, 10), technician: '', pdf: '',
    fee: '', paymentStatus: 'Paid',
    results: [], // [{ name, unit, refRange, value }]
    inventoryUsed: []
  })
  const [catalog, setCatalog] = useState([])

  const [labInventory, setLabInventory] = useState([])
  useEffect(() => {
    ;(async () => {
      try {
        const inventoryResponse = await inventoryAPI.getAll()
        const list = (inventoryResponse.data || []).filter(item => item.department === 'lab')
        setLabInventory(list)
      } catch (e) {
        setLabInventory([])
      }
    })()
  }, [])

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const [requestsRes, testsRes] = await Promise.all([
          labRequestsAPI.getAll(),
          labTestsAPI.getAll()
        ]);
        
        // Map cancelled status from lab requests to tests if necessary, 
        // or filter the intakes that are used as base for reports
        const cancelledRequestIds = (requestsRes?.data || [])
          .filter(r => (r.status || '').toLowerCase() === 'cancelled')
          .map(r => r.id || r._id);

        const catalogData = (testsRes?.data || []).filter(test => {
          // If the test is linked to a specific intake, check its status
          return !cancelledRequestIds.includes(test.intakeId);
        });

        // Also ensure we handle the case where we're looking at the requests themselves as the catalog source
        const intakesForCatalog = (requestsRes?.data || []).filter(r => (r.status || '').toLowerCase() !== 'cancelled');
        
        setCatalog(catalogData);
      } catch (err) {
        console.error('Error fetching data for AddReport:', err);
      }
    };
    fetchCatalog();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(location.search)
    const intakeId = params.get('intakeId')
    if (!intakeId) return
    setIntakeId(intakeId)
    
    ;(async()=>{
      try {
        const res = await labRequestsAPI.getById(intakeId)
        if (res.data) {
          if (cancelled) return;
          // Check if intake is cancelled
          if ((res.data.status || '').toLowerCase() === 'cancelled') {
            alert('This sample intake has been cancelled. You cannot add a report for it.')
            navigate('/lab/sample-intake')
            return
          }
          
          const testName = res.data.testType === '__custom' ? (res.data.customTestName || '') : (res.data.testType || '')
          const ct = (catalog || []).find(t => (t.testName||t.name) === testName)
          const mappedResults = (ct?.parameters || ct?.params || []).map(p => ({
            name: p.name,
            unit: p.unit,
            refRange: p.normalRange || p.refRange,
            value: ''
          }))

          setForm(prev => ({
            ...prev,
            petId: res.data.petId || '',
            petName: res.data.petName || prev.petName,
            ownerName: res.data.ownerName || prev.ownerName,
            patientId: res.data.patientId || res.data.petId || prev.patientId,
            species: res.data.species || prev.species,
            age: res.data.age || prev.age,
            gender: res.data.gender || prev.gender,
            testName: testName || prev.testName,
            testType: res.data.testType || '',
            testId: res.data.testId || res.data._id || intakeId,
            sampleType: res.data.sampleType || prev.sampleType,
            referredBy: res.data.doctorName || res.data.referredBy || prev.referredBy,
            fee: (ct?.price ?? res.data.fee ?? prev.fee) || '',
            paymentStatus: res.data.paymentStatus || prev.paymentStatus,
            results: mappedResults
          }))

          if (res.data.petId) {
            try {
              const petRes = await petsAPI.getById(res.data.petId)
              if (petRes.data && !cancelled) {
                setForm(prev => ({
                  ...prev,
                  petName: petRes.data.name || prev.petName,
                  species: petRes.data.species || prev.species,
                  breed: petRes.data.breed || '',
                  gender: petRes.data.gender || prev.gender,
                  age: petRes.data.age || prev.age
                }))
              }
            } catch (petErr) {
              console.error('Error fetching pet details:', petErr)
            }
          }
          if (!cancelled) setShowForm(true)
        }
      } catch (err) {
        if (!cancelled) console.error('Error prefilling from intake:', err)
      }
    })()
    return ()=>{ cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, catalog.length])

  const { settings } = useSettings()
  const getLabProfileName = () => {
    try {
      const raw = localStorage.getItem('lab_profile')
      if (!raw) return ''
      const parsed = JSON.parse(raw)
      const n = String(parsed?.name || '').trim()
      return n
    } catch {
      return ''
    }
  }
  const [showForm, setShowForm] = useState(false)
  const [showPrintPreview, setShowPrintPreview] = useState(false)
  const [printData, setPrintData] = useState(null)
  const [printSource, setPrintSource] = useState('saved')
  const [printSaving, setPrintSaving] = useState(false)
  const navigate = useNavigate()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [copyToast, setCopyToast] = useState('')

  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [availableMethods] = useState(['Cash','Bank Account','Credit','Debit','Easypaisa','JazzCash','Other'])
  const [paymentDetails, setPaymentDetails] = useState({
    method: 'Cash',
    bankName: '',
    accountNumber: '',
    walletNumber: '',
    transactionId: '',
    cardHolderName: '',
    cardLast4: '',
    cardAuthCode: ''
  })
  const [paymentCharge, setPaymentCharge] = useState(0)
  const [receivedAmount, setReceivedAmount] = useState(0)
  const [receivedTouched, setReceivedTouched] = useState(false)
  const [pendingSaveData, setPendingSaveData] = useState(null)

  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptData, setReceiptData] = useState(null)
  const receiptRef = useRef(null)

  const [showRecoverModal, setShowRecoverModal] = useState(false)
  const [recoverReport, setRecoverReport] = useState(null)
  const [recoverAmount, setRecoverAmount] = useState('')
  const [recoverMethod, setRecoverMethod] = useState('Cash')
  const [recoverPaymentDetails, setRecoverPaymentDetails] = useState({
    method: 'Cash',
    bankName: '',
    accountNumber: '',
    walletNumber: '',
    transactionId: '',
    cardHolderName: '',
    cardLast4: '',
    cardAuthCode: ''
  })
  const [recoverLoading, setRecoverLoading] = useState(false)

  const toNum = (v) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }

  const lastRecoveredAt = (r) => {
    const list = Array.isArray(r?.recoveryPayments) ? r.recoveryPayments : []
    let best = null
    for (const x of list) {
      const t = x?.recoveredAt ? new Date(x.recoveredAt).getTime() : NaN
      if (!Number.isFinite(t)) continue
      if (!best || t > best.t) best = { t, d: new Date(x.recoveredAt) }
    }
    return best?.d || null
  }

  const isCardMethod = (m) => {
    const s = String(m || '').toLowerCase()
    return s.includes('credit') || s.includes('debit')
  }

  const selectPaymentMethod = (m) => {
    setPaymentMethod(m)
    setPaymentDetails(p => ({
      ...p,
      method: m,
      bankName: '',
      accountNumber: '',
      walletNumber: '',
      transactionId: '',
      cardHolderName: '',
      cardLast4: '',
      cardAuthCode: ''
    }))
  }

  useEffect(() => {
    if (!showPaymentModal) return
    const base = Math.max(0, toNum(pendingSaveData?.fee || form?.fee || 0))
    const ch = isCardMethod(paymentMethod) ? Number((base * 0.02).toFixed(2)) : 0
    setPaymentCharge(ch)
  }, [showPaymentModal, paymentMethod])

  useEffect(() => {
    if (!showPaymentModal) return
    if (receivedTouched) return
    const base = Math.max(0, toNum(pendingSaveData?.fee || form?.fee || 0))
    const total = Math.max(0, base + Math.max(0, toNum(paymentCharge || 0)))
    setReceivedAmount(total)
  }, [showPaymentModal, paymentCharge, receivedTouched])

  const openPaymentForSave = (data) => {
    setPendingSaveData(data)
    setShowPaymentModal(true)
    setPaymentMethod('Cash')
    setPaymentDetails({
      method: 'Cash',
      bankName: '',
      accountNumber: '',
      walletNumber: '',
      transactionId: '',
      cardHolderName: '',
      cardLast4: '',
      cardAuthCode: ''
    })
    setPaymentCharge(0)
    setReceivedTouched(false)
    setReceivedAmount(0)
  }

  const closePaymentModal = () => {
    setShowPaymentModal(false)
    setIsProcessingPayment(false)
    setPendingSaveData(null)
    setReceivedTouched(false)
  }

  const closeReceipt = () => {
    setShowReceipt(false)
    setReceiptData(null)
  }

  const printThermalReceipt = (report, title = 'LAB RECEIPT') => {
    const r = report || receiptData
    if (!r) return

    const base = Math.max(0, toNum(r.amount || r.fee || 0))
    const ch = Math.max(0, toNum(r.paymentCharge || 0))
    const total = Math.max(0, base + ch)
    const received = Math.max(0, toNum(r.receivedAmount != null ? r.receivedAmount : total))
    const due = Math.max(0, toNum(r.dueAmount != null ? r.dueAmount : (total - received)))
    const method = (r.paymentMethod || r.paymentDetails?.method || 'Cash')
    const useRecoveryDate = String(title || '').toLowerCase().includes('recovery')
    const dt = (useRecoveryDate ? lastRecoveredAt(r) : null) || (r.createdAt ? new Date(r.createdAt) : new Date())

    const name = (getLabProfileName() || settings.companyName || 'Pets Hospital')
    const headerHTML = '<div style="text-align:center;margin-bottom:6px">' +
      '<div style="font-size:14px">'+ String(name) +'</div>' +
      '</div>'

    const lines = []
    lines.push(['Report #', (r.reportNumber || r.id || '')])
    lines.push(['Date', dt.toLocaleString()])
    lines.push(['Patient ID', (r.petId || r.patientId || '')])
    lines.push(['Owner', (r.ownerName || '')])
    lines.push(['Pet', (r.petName || '')])
    lines.push(['Test', (r.testType || r.testName || '')])
    lines.push(['Payment', String(method)])

    const details = r.paymentDetails || {}
    const m = String(method || '').toLowerCase()
    if (m.includes('bank')) {
      if (details.bankName) lines.push(['Bank', String(details.bankName)])
      if (details.accountNumber) lines.push(['Account', String(details.accountNumber)])
      if (details.transactionId) lines.push(['Txn', String(details.transactionId)])
    } else if (m.includes('easypaisa') || m.includes('jazzcash')) {
      if (details.walletNumber) lines.push(['Wallet', String(details.walletNumber)])
      if (details.transactionId) lines.push(['Txn', String(details.transactionId)])
    } else if (m.includes('credit') || m.includes('debit')) {
      if (details.cardHolderName) lines.push(['Card Holder', String(details.cardHolderName)])
      if (details.cardLast4) lines.push(['Last4', String(details.cardLast4)])
      if (details.cardAuthCode) lines.push(['Auth', String(details.cardAuthCode)])
      if (details.transactionId) lines.push(['Txn', String(details.transactionId)])
    } else {
      if (details.transactionId) lines.push(['Ref', String(details.transactionId)])
    }

    const rowsHTML = lines.map(([k,v]) => (
      '<tr><td style="border:1px solid #000;padding:3px">'+k+'</td><td style="border:1px solid #000;padding:3px;text-align:right">'+(v||'')+'</td></tr>'
    )).join('')

    const totalsHTML = (
      '<table>'+
        '<tr><td style="border:1px solid #000;padding:3px">Fee</td><td style="border:1px solid #000;padding:3px;text-align:right">'+ base.toLocaleString() +'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Charge</td><td style="border:1px solid #000;padding:3px;text-align:right">'+ ch.toLocaleString() +'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Total</td><td style="border:1px solid #000;padding:3px;text-align:right">'+ total.toLocaleString() +'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Received</td><td style="border:1px solid #000;padding:3px;text-align:right">'+ received.toLocaleString() +'</td></tr>'+
        '<tr><td style="border:1px solid #000;padding:3px">Receivable</td><td style="border:1px solid #000;padding:3px;text-align:right">'+ due.toLocaleString() +'</td></tr>'+
      '</table>'
    )

    const printContent = (
      '<!doctype html><html><head><meta charset="utf-8" />'+
      '<title>Receipt</title>'+
      '<style>'+
      '@page{size:80mm auto;margin:2mm}'+
      'body{font-family:monospace;font-size:12px;margin:0;padding:2mm;color:#000;background:#fff;width:80mm;max-width:80mm;font-weight:bold}'+
      'table{width:100%;border-collapse:collapse;margin:5px 0}'+
      'th,td{border:1px solid #000;padding:3px}'+
      '.title{background:#000;color:#fff;text-align:center;padding:4px 0;margin:6px 0}'+
      '</style></head><body>'+
      headerHTML+
      '<div class="title">'+ String(title) +'</div>'+
      '<table>'+ rowsHTML +'</table>'+
      totalsHTML+
      '<div style="text-align:center;margin-top:10px;border-top:1px dashed #000;padding-top:8px"><div>Thank you!</div><div>Powered by MindSpire</div></div>'+
      '</body></html>'
    )

    let printed = false
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)
    iframe.onload = () => {
      try {
        setTimeout(()=>{
          if (printed) return
          iframe.contentWindow?.focus()
          iframe.contentWindow?.print()
          printed = true
        }, 50)
      } catch (e) {
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) document.body.removeChild(iframe)
        }, 1500)
      }
    }
    const doc = iframe.contentWindow.document
    doc.open()
    doc.write(printContent)
    doc.close()
    setTimeout(() => {
      if (printed) return
      try {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
        printed = true
      } catch {}
    }, 150)
  }

  const openRecoverModal = (r) => {
    setRecoverReport(r)
    setRecoverAmount(String(Math.max(0, toNum(r?.dueAmount || 0))))
    setRecoverMethod('Cash')
    setRecoverPaymentDetails({
      method: 'Cash',
      bankName: '',
      accountNumber: '',
      walletNumber: '',
      transactionId: '',
      cardHolderName: '',
      cardLast4: '',
      cardAuthCode: ''
    })
    setShowRecoverModal(true)
  }

  const closeRecoverModal = () => {
    setShowRecoverModal(false)
    setRecoverReport(null)
    setRecoverAmount('')
    setRecoverMethod('Cash')
    setRecoverLoading(false)
  }
  const todayStr = useMemo(()=> new Date().toISOString().slice(0,10), [])
  const [dateRange, setDateRange] = useState({ fromDate: todayStr, toDate: todayStr })
  const inRange = (dStr) => {
    if (!dateRange?.fromDate && !dateRange?.toDate) return true
    if (!dStr) return false
    const d = String(dStr).slice(0,10)
    const from = dateRange.fromDate || '0000-01-01'
    const to = dateRange.toDate || '9999-12-31'
    return d >= from && d <= to
  }
  const filteredReports = useMemo(()=>{
    return (reports||[]).filter(r => {
      const dateMatch = inRange(r.collectionDate || r.date);
      // Ensure we don't show reports for cancelled intakes if they were somehow created
      const statusMatch = (r.status || '').toLowerCase() !== 'cancelled';
      return dateMatch && statusMatch;
    });
  }, [reports, dateRange.fromDate, dateRange.toDate])
  const stats = useMemo(()=>{
    const list = filteredReports || []
    const total = list.length
    const paid = list.filter(r => (r.paymentStatus || '').toLowerCase() === 'paid').length
    const pending = list.filter(r => (r.paymentStatus || '').toLowerCase() === 'pending').length
    const revenue = list.reduce((s, r) => s + (Number(r.amount)||0) + (Number(r.paymentCharge)||0), 0)
    return { total, paid, pending, revenue }
  }, [filteredReports])
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyToast('Copied: ' + text)
      setTimeout(()=>setCopyToast(''), 1500)
    } catch (e) {
      console.error('Clipboard error:', e)
    }
  }
  
  useEffect(() => {
    fetchReports()
  }, [])
  
  const fetchReports = async () => {
    try {
      setLoading(true)
      const response = await labReportsAPI.getAll()
      console.log('Fetched reports:', response.data) // Debug log
      setReports(response.data || [])
    } catch (err) {
      console.error('Error fetching lab reports:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = e => {
    const { name, value, files } = e.target
    if (name === 'pdf') {
      const file = files?.[0]
      if (!file) return setForm(f=>({ ...f, pdf: '' }))
      const reader = new FileReader()
      reader.onload = () => setForm(f=>({ ...f, pdf: reader.result }))
      reader.readAsDataURL(file)
      return
    }
    
    // Auto-fill test fee and specimen when test is selected
    if (name === 'testName' && value && value !== '__custom') {
      const selectedTest = catalog.find(t => (t.testName || t.name) === value)
      if (selectedTest) {
        setForm(prev => ({
          ...prev,
          testName: value,
          fee: selectedTest.price || prev.fee,
          sampleType: selectedTest.sampleType || selectedTest.specimen || prev.sampleType,
          results: (selectedTest.parameters || selectedTest.params || []).map(p => ({
            name: p.name,
            unit: p.unit,
            refRange: p.normalRange || p.refRange,
            value: ''
          })),
          inventoryUsed: Array.isArray(selectedTest.consumables)
            ? selectedTest.consumables.map(c => ({
                inventoryId: c.inventoryId || c.id || '',
                itemName: c.itemName || c.name || '',
                quantity: Number(c.quantity || 0)
              })).filter(c => (c.inventoryId || c.itemName) && Number.isFinite(c.quantity) && c.quantity > 0)
            : []
        }))
        return
      }
    }

    if (name === 'testName' && value === '__custom') {
      setForm(prev => ({ ...prev, testName: value, inventoryUsed: [] }))
      return
    }
    
    // Auto-fill patient information when Patient ID is entered
    if (name === 'patientId' && value) {
      const fetchPetData = async () => {
        try {
          const response = await petsAPI.getById(value)
          if (response.data) {
            const matchedPet = response.data
            setForm(prev => ({
              ...prev,
              patientId: value,
              petName: matchedPet.petName || prev.petName,
              ownerName: matchedPet.ownerName || prev.ownerName,
              species: matchedPet.species || prev.species,
              age: matchedPet.age || prev.age,
              gender: matchedPet.gender || prev.gender
            }))
          }
        } catch (err) {
          console.error('Error loading pet data:', err)
          // If pet not found, generate new patient ID if fields are filled
        }
      }
      fetchPetData()
    }
    
    // Auto-generate patient ID if manually entering pet details
    if ((name === 'petName' || name === 'ownerName') && value && !form.patientId) {
      setForm(prev => ({
        ...prev,
        [name]: value,
        patientId: `PET-${Date.now()}`
      }))
      return
    }
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const updateConsumable = (idx, key, value) => {
    setForm(prev => {
      const inventoryUsed = [...(prev.inventoryUsed || [])]
      inventoryUsed[idx] = { ...(inventoryUsed[idx] || {}), [key]: value }
      return { ...prev, inventoryUsed }
    })
  }
  const addConsumable = () => {
    setForm(prev => ({
      ...prev,
      inventoryUsed: [ ...(prev.inventoryUsed || []), { inventoryId: '', itemName: '', quantity: 1 } ]
    }))
  }
  const removeConsumable = (idx) => {
    setForm(prev => ({
      ...prev,
      inventoryUsed: (prev.inventoryUsed || []).filter((_, i) => i !== idx)
    }))
  }

  // Print a saved report row
  const printSaved = (r) => {
    const mappedData = {
      ...r,
      patientId: r.petId || r.patientId,
      testId: r.id || r.testId,
      results: r.tests || r.results || [],
      testName: r.testType || r.testName,
      testDate: r.collectionDate || r.testDate || r.date,
      referredBy: r.requestedBy || r.referredBy,
      notes: r.overallNotes || r.result || r.remarks
    }
    setPrintSource('saved')
    setPrintData(mappedData)
    setShowPrintPreview(true)
  }

  // Edit/Delete for inline list
  const [showEdit, setShowEdit] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [showDelete, setShowDelete] = useState(false)
  const startEdit = (r) => { 
    // Map MongoDB fields to edit form
    const editData = {
      ...r,
      results: (r.tests || r.results || []).map(t => ({
        name: t.testName || t.name,
        value: t.result || t.value,
        unit: t.unit,
        refRange: t.normalRange || t.refRange
      }))
    }
    setEditItem(editData)
    setShowEdit(true)
  }
  const saveEdit = async (e) => {
    e.preventDefault()
    try {
      // Map edit form back to MongoDB schema
      const updateData = {
        ...editItem,
        tests: (editItem.results || []).map(r => ({
          testName: r.name,
          result: r.value,
          unit: r.unit,
          normalRange: r.refRange,
          status: 'Completed'
        })),
        amount: Number(editItem.amount || 0)
      }
      await labReportsAPI.update(editItem.id, updateData)
      await fetchReports()
      setShowEdit(false)
    } catch (err) {
      console.error('Error updating report:', err)
      alert('Failed to update report')
    }
  }
  const askDelete = (r) => { setEditItem(r); setShowDelete(true) }
  const confirmDelete = async () => {
    try {
      await labReportsAPI.delete(editItem.id)
      await fetchReports()
      setShowDelete(false)
      setEditItem(null)
    } catch (err) {
      console.error('Error deleting report:', err)
      alert('Failed to delete report')
    }
  }

  const getRequiredItems = (data) => {
    return Array.isArray(data?.inventoryUsed)
      ? data.inventoryUsed
          .map(c => ({
            inventoryId: String(c?.inventoryId || '').trim(),
            itemName: String(c?.itemName || '').trim(),
            quantity: Number(c?.quantity || 0)
          }))
          .filter(c => (c.inventoryId || c.itemName) && Number.isFinite(c.quantity) && c.quantity > 0)
      : []
  }

  const validateInventoryOrAlert = async (requiredItems) => {
    if (!requiredItems || requiredItems.length === 0) return true
    const inventoryResponse = await inventoryAPI.getAll()
    const currentLabInventory = (inventoryResponse.data || []).filter(item => item.department === 'lab')

    if ((currentLabInventory || []).length === 0) {
      alert('⚠️ Inventory is empty. Please add items to Lab Inventory before conducting this test.')
      return false
    }

    const unavailableItems = []
    const insufficientItems = []

    for (const required of requiredItems) {
      const inventoryItem = (currentLabInventory || []).find(item => String(item.id || '') === String(required.inventoryId || ''))
      const fallbackItem = !inventoryItem && required.itemName
        ? (currentLabInventory || []).find(item => String(item.itemName || '').toLowerCase() === String(required.itemName || '').toLowerCase())
        : null
      const found = inventoryItem || fallbackItem

      if (!found) {
        unavailableItems.push(required.itemName || required.inventoryId)
      } else if (Number(found.quantity || 0) < required.quantity) {
        insufficientItems.push(`${found.itemName} (Available: ${found.quantity}, Required: ${required.quantity})`)
      }
    }

    if (unavailableItems.length > 0) {
      alert(`⚠️ Missing Inventory Items:\n${unavailableItems.join('\n')}\n\nPlease add these items to inventory before conducting the test.`)
      return false
    }

    if (insufficientItems.length > 0) {
      alert(`⚠️ Insufficient Inventory:\n${insufficientItems.join('\n')}\n\nPlease restock these items before conducting the test.`)
      return false
    }

    return true
  }

  const buildReportPayload = (data, requiredItems) => {
    const base = Math.max(0, Number(data.fee || 0))
    const ch = Math.max(0, Number(data.paymentCharge || 0))
    const total = Math.max(0, base + ch)
    const method = String(data.paymentMethod || data.paymentDetails?.method || 'Cash').trim() || 'Cash'
    const details = data.paymentDetails && typeof data.paymentDetails === 'object'
      ? { ...data.paymentDetails, method: data.paymentDetails.method || method }
      : { method }

    const initialReceived = data.receivedAmount != null
      ? Math.max(0, Number(data.receivedAmount || 0))
      : (String(data.paymentStatus || '').toLowerCase() === 'paid' ? total : 0)
    const received = Math.max(0, Math.min(initialReceived, total))
    const due = data.dueAmount != null
      ? Math.max(0, Number(data.dueAmount || 0))
      : Math.max(0, total - received)
    const status = due > 0 ? 'Pending' : 'Paid'

    return {
      id: data.testId || `REP-${Date.now()}`,
      reportNumber: data.testId || `REP-${Date.now()}`,
      petId: data.patientId || `PET-${Date.now()}`,
      petName: data.petName,
      ownerName: data.ownerName,
      species: data.species || '',
      age: data.age || '',
      gender: data.gender || '',
      requestedBy: data.referredBy || '',
      testCategory: 'Laboratory',
      testType: data.testName,
      sampleType: data.sampleType || '',
      collectionDate: data.testDate || new Date().toISOString().slice(0, 10),
      reportDate: new Date(),
      tests: (data.results || []).map(r => ({
        testName: r.name,
        result: r.value,
        unit: r.unit,
        normalRange: r.refRange,
        status: 'Completed'
      })),
      overallNotes: data.result || data.remarks || '',
      technician: data.technician || '',
      status: 'Completed',
      priority: 'Normal',
      date: data.testDate || new Date().toISOString().slice(0, 10),
      amount: base,
      paymentStatus: status,
      paymentMethod: method,
      paymentDetails: details,
      paymentCharge: ch,
      receivedAmount: received,
      dueAmount: due,
      inventoryUsed: requiredItems
    }
  }

  const saveReportFromData = async (data) => {
    const requiredItems = getRequiredItems(data)
    const ok = await validateInventoryOrAlert(requiredItems)
    if (!ok) return null

    const report = buildReportPayload(data, requiredItems)
    console.log('Submitting report:', report)
    console.log('Inventory deducted:', requiredItems)

    const createdRes = await labReportsAPI.create(report)
    const created = createdRes?.data || createdRes

    try {
      if (intakeId) {
        await labRequestsAPI.update(intakeId, {
          status: 'Completed',
          paymentStatus: report.paymentStatus,
          fee: data.fee,
        })
      }
    } catch (e) { console.warn('Failed to update intake status', e) }

    await fetchReports()
    return created
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const requiredItems = getRequiredItems(form)
    const ok = await validateInventoryOrAlert(requiredItems)
    if (!ok) return
    openPaymentForSave(form)
  }

  const confirmPaymentAndSave = async () => {
    if (isProcessingPayment) return
    try {
      setIsProcessingPayment(true)
      const base = Math.max(0, toNum(pendingSaveData?.fee || 0))
      const ch = Math.max(0, toNum(paymentCharge || 0))
      const total = Math.max(0, base + ch)
      const received = Math.max(0, Math.min(toNum(receivedAmount || 0), total))
      const due = Math.max(0, total - received)
      const details = {
        ...(paymentDetails || {}),
        method: (paymentDetails && paymentDetails.method) || paymentMethod,
      }

      const saved = await saveReportFromData({
        ...(pendingSaveData || {}),
        paymentMethod,
        paymentDetails: details,
        paymentCharge: ch,
        receivedAmount: received,
        dueAmount: due,
      })
      if (!saved) {
        setIsProcessingPayment(false)
        return
      }

      setReceiptData(saved)
      setShowReceipt(true)

      setForm({
        petName: '', ownerName: '', patientId:'', species:'', age:'', gender:'',
        testName: '', testId:`T-${Date.now()}`, sampleType: '', referredBy:'',
        result: '', remarks: '', testDate: new Date().toISOString().slice(0, 10),
        technician: '', pdf: '', fee:'', paymentStatus:'Paid', results: [], inventoryUsed: []
      })
      setShowForm(false)
      closePaymentModal()
    } catch (err) {
      console.error('Error creating report:', err)
      const errorMsg = err.response?.data?.message || err.message || 'Failed to create report'
      alert(errorMsg)
      setIsProcessingPayment(false)
    }
  }

  const confirmRecover = async () => {
    if (recoverLoading) return
    try {
      setRecoverLoading(true)
      const amt = Math.max(0, toNum(recoverAmount || 0))
      if (!amt) {
        setRecoverLoading(false)
        alert('Amount is required')
        return
      }
      const details = {
        ...(recoverPaymentDetails || {}),
        method: (recoverPaymentDetails && recoverPaymentDetails.method) || recoverMethod,
      }
      const res = await labReportsAPI.recover(recoverReport?.id, {
        amount: amt,
        paymentMethod: recoverMethod,
        paymentDetails: details,
      })
      const updated = res?.data || res
      setReports(prev => (prev || []).map(r => (r.id === updated.id ? updated : r)))
      closeRecoverModal()
      printThermalReceipt(updated, 'LAB RECOVERY RECEIPT')
    } catch (err) {
      console.error('Recover error:', err)
      const errorMsg = err.response?.data?.message || err.message || 'Failed to recover payment'
      alert(errorMsg)
      setRecoverLoading(false)
    }
  }

  const printReport = () => {
    setPrintSource('draft')
    setPrintData(form)
    setShowPrintPreview(true)
  }

  const handlePrintFromPreview = async () => {
    if (printSaving) return
    try {
      if (printSource === 'draft') {
        setPrintSaving(true)
        const ok = await saveReportFromData(printData)
        setPrintSaving(false)
        if (!ok) return
        setPrintSource('saved')
        setForm({ 
          petName: '', ownerName: '', patientId:'', species:'', age:'', gender:'', 
          testName: '', testId:`T-${Date.now()}`, sampleType: '', referredBy:'', 
          result: '', remarks: '', testDate: new Date().toISOString().slice(0, 10), 
          technician: '', pdf: '', fee:'', paymentStatus:'Paid', results: [], inventoryUsed: [] 
        })
      }
      handlePrint()
    } catch (err) {
      setPrintSaving(false)
      const errorMsg = err.response?.data?.message || err.message || 'Failed to save report before printing'
      alert(errorMsg)
    }
  }

  const handleOkFromPreview = async () => {
    if (printSaving) return
    try {
      if (printSource === 'draft') {
        setPrintSaving(true)
        const ok = await saveReportFromData(printData)
        setPrintSaving(false)
        if (!ok) return
        setPrintSource('saved')
        setForm({ 
          petName: '', ownerName: '', patientId:'', species:'', age:'', gender:'', 
          testName: '', testId:`T-${Date.now()}`, sampleType: '', referredBy:'', 
          result: '', remarks: '', testDate: new Date().toISOString().slice(0, 10), 
          technician: '', pdf: '', fee:'', paymentStatus:'Paid', results: [], inventoryUsed: [] 
        })
        setShowPrintPreview(false)
        setShowForm(false)
        return
      }
      setShowPrintPreview(false)
    } catch (err) {
      setPrintSaving(false)
      const errorMsg = err.response?.data?.message || err.message || 'Failed to save report'
      alert(errorMsg)
    }
  }

  const handlePrint = () => {
    try {
      const el = document.getElementById('lab-report-print')
      if (el) el.scrollTop = 0
      window.scrollTo(0, 0)
    } catch (e) {}
    try {
      window.print()
    } finally {
      // After print dialog completes, close all related dialogs
      setShowPrintPreview(false)
      setShowForm(false)
    }
  }

  const parseNum = (v) => {
    const m = String(v ?? '').match(/[-+]?[0-9]*\.?[0-9]+/)
    return m ? Number(m[0]) : NaN
  }

  const parseRefRange = (ref) => {
    const s = String(ref ?? '').trim().toLowerCase()
    if (!s) return { low: NaN, high: NaN, mode: 'range' }
    const between = s.match(/([-+]?[0-9]*\.?[0-9]+)\s*(?:-|to|–|—)\s*([-+]?[0-9]*\.?[0-9]+)/i)
    if (between) return { low: Number(between[1]), high: Number(between[2]), mode: 'range' }
    const ge = s.match(/(?:>=|≥|greater\s*than\s*or\s*equal\s*to)\s*([-+]?[0-9]*\.?[0-9]+)/i)
    if (ge) return { low: Number(ge[1]), high: NaN, mode: 'min' }
    const le = s.match(/(?:<=|≤|less\s*than\s*or\s*equal\s*to)\s*([-+]?[0-9]*\.?[0-9]+)/i)
    if (le) return { low: NaN, high: Number(le[1]), mode: 'max' }
    const gt = s.match(/(?:>|greater\s*than)\s*([-+]?[0-9]*\.?[0-9]+)/i)
    if (gt) return { low: Number(gt[1]), high: NaN, mode: 'min' }
    const lt = s.match(/(?:<|less\s*than)\s*([-+]?[0-9]*\.?[0-9]+)/i)
    if (lt) return { low: NaN, high: Number(lt[1]), mode: 'max' }
    return { low: NaN, high: NaN, mode: 'range' }
  }

  const getFlag = (value, refRange) => {
    const v = parseNum(value)
    if (!Number.isFinite(v)) return ''
    const { low, high, mode } = parseRefRange(refRange)
    if (mode === 'range') {
      if (Number.isFinite(low) && v < low) return 'L'
      if (Number.isFinite(high) && v > high) return 'H'
      return ''
    }
    if (mode === 'min') return (Number.isFinite(low) && v < low) ? 'L' : ''
    if (mode === 'max') return (Number.isFinite(high) && v > high) ? 'H' : ''
    return ''
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">Test Reports</h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
              <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/>
            </svg>
            Manage laboratory test reports
          </p>
        </div>
        <button 
          onClick={()=>setShowForm(true)} 
          className="px-6 h-12 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 inline-flex items-center gap-2 cursor-pointer font-semibold"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/>
          </svg>
          Add Report
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl p-4 bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200">
          <div className="text-xs text-blue-600 font-semibold mb-1">Total Reports</div>
          <div className="text-2xl font-bold text-blue-700">{stats.total}</div>
        </div>
        <div className="rounded-xl p-4 bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200">
          <div className="text-xs text-emerald-600 font-semibold mb-1">Paid</div>
          <div className="text-2xl font-bold text-emerald-700">{stats.paid}</div>
        </div>
        <div className="rounded-xl p-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200">
          <div className="text-xs text-amber-600 font-semibold mb-1">Pending</div>
          <div className="text-2xl font-bold text-amber-700">{stats.pending}</div>
        </div>
        <div className="rounded-xl p-4 bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200">
          <div className="text-xs text-purple-600 font-semibold mb-1">Total Revenue</div>
          <div className="text-2xl font-bold text-purple-700">Rs. {stats.revenue.toLocaleString()}</div>
        </div>
      </div>

      {/* Reports Table */}
      <div className="rounded-2xl bg-white ring-1 ring-slate-200 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/>
              </svg>
            </div>
            <div>
              <div className="font-bold text-slate-800">Reports List</div>
              <div className="text-xs text-slate-500">{filteredReports.length} in range</div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-end gap-3">
            <DateRangePicker onDateChange={setDateRange} defaultFromDate={dateRange.fromDate} defaultToDate={dateRange.toDate} showAllButton className="flex-wrap" />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200">
                <th className="py-4 px-6 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Pet</th>
                <th className="py-4 px-6 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Test</th>
                <th className="py-4 px-6 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Date</th>
                <th className="py-4 px-6 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Recovered Date</th>
                <th className="py-4 px-6 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Amount</th>
                <th className="py-4 px-6 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Status</th>
                <th className="py-4 px-6 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReports.map(r => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-6">
                    <div className="font-semibold text-slate-800">{r.petName}</div>
                    <div className="text-xs text-slate-500">{r.ownerName}</div>
                    {(r.petId || r.patientId) && (
                      <button
                        type="button"
                        onClick={()=>copyToClipboard(r.petId || r.patientId)}
                        className="mt-1 w-fit text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
                        title="Click to copy"
                      >
                        {r.petId || r.patientId}
                      </button>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    <div className="font-medium text-slate-700">{r.testType || r.testName}</div>
                    <div className="text-xs text-slate-500">{r.id || r.reportNumber || r.testId}</div>
                  </td>
                  <td className="py-4 px-6 text-slate-600">
                    {r.collectionDate ? new Date(r.collectionDate).toLocaleDateString() : (r.date || '-')}
                  </td>
                  <td className="py-4 px-6 text-slate-600">
                    {(() => {
                      const d = lastRecoveredAt(r)
                      return d ? d.toLocaleDateString() : '-'
                    })()}
                  </td>
                  <td className="py-4 px-6">
                    <div className="font-bold text-purple-700">Rs. {Number((Number(r.amount||0) + Number(r.paymentCharge||0))||0).toLocaleString()}</div>
                    {Number(r.dueAmount || 0) > 0 && (
                      <div className="text-xs text-amber-700">Due: Rs. {Number(r.dueAmount||0).toLocaleString()}</div>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                      r.paymentStatus === 'Paid' 
                        ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200' 
                        : 'bg-amber-100 text-amber-700 ring-1 ring-amber-200'
                    }`}>
                      {r.paymentStatus || 'Paid'}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      {(Number(r.dueAmount || 0) > 0 || String(r.paymentStatus || '').toLowerCase() === 'pending') && (
                        <button
                          onClick={()=>openRecoverModal(r)}
                          className="px-3 h-9 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md hover:shadow-lg transition-all cursor-pointer inline-flex items-center gap-1 text-sm font-medium"
                        >
                          Recover
                        </button>
                      )}
                      <button 
                        onClick={()=>printSaved(r)} 
                        className="px-3 h-9 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-md hover:shadow-lg transition-all cursor-pointer inline-flex items-center gap-1 text-sm font-medium"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd"/>
                        </svg>
                        Print
                      </button>
                      <button
                        onClick={()=>printThermalReceipt(r)}
                        className="px-3 h-9 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-all cursor-pointer inline-flex items-center gap-1 text-sm font-medium"
                      >
                        Receipt
                      </button>
                      <button 
                        onClick={()=>startEdit(r)} 
                        className="px-3 h-9 rounded-lg border-2 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-all cursor-pointer inline-flex items-center gap-1 text-sm font-medium"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                        </svg>
                        Edit
                      </button>
                      <button 
                        onClick={()=>askDelete(r)} 
                        className="px-3 h-9 rounded-lg bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white shadow-md hover:shadow-lg transition-all cursor-pointer inline-flex items-center gap-1 text-sm font-medium"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/>
                        </svg>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {reports.length===0 && (
                <tr>
                  <td className="py-12 px-6 text-center" colSpan={7}>
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                          <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/>
                        </svg>
                      </div>
                      <div className="text-lg font-semibold text-slate-700 mb-1">No reports yet</div>
                      <div className="text-sm text-slate-500">Click "Add Report" to create your first test report</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="absolute inset-0 bg-black/50" onClick={()=>setShowForm(false)}></div>
          <form onSubmit={handleSubmit} className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 px-8 py-6 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                      <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Add Test Report</h2>
                    <p className="text-emerald-100 text-sm mt-1">Fill in the test details below</p>
                  </div>
                </div>
                <button 
                  type="button" 
                  onClick={()=>setShowForm(false)} 
                  className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white text-2xl transition-all"
                >
                  ×
                </button>
              </div>
            </div>
            
            {/* Modal Body */}
            <div className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Pet Name</label>
                <input name="petName" value={form.petName} onChange={handleChange} placeholder="Enter pet name" className="h-10 px-3 rounded-lg border border-slate-300 w-full" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Owner Name</label>
                <input name="ownerName" value={form.ownerName} onChange={handleChange} placeholder="Enter owner name" className="h-10 px-3 rounded-lg border border-slate-300 w-full" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Patient ID</label>
                <input name="patientId" value={form.patientId} onChange={handleChange} placeholder="e.g., PT-123" className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Test ID</label>
                <input name="testId" value={form.testId} onChange={handleChange} placeholder="e.g., T-2025-001" className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Test</label>
                <select name="testName" value={form.testName} onChange={handleChange} className="h-10 px-3 rounded-lg border border-slate-300 w-full" required>
                  <option value="">Select Test</option>
                  {catalog.map(t => (<option key={t.id || t._id} value={t.testName || t.name}>{t.testName || t.name}</option>))}
                  <option value="__custom">Other (type manually)</option>
                </select>
              </div>
              {form.testName==='__custom' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Custom Test Name</label>
                  <input name="testName" value={form.testNameInput||''} onChange={e=>setForm(f=>({ ...f, testName:e.target.value, testNameInput:e.target.value }))} placeholder="Enter test name" className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Species</label>
                <input name="species" value={form.species} onChange={handleChange} placeholder="e.g., Dog" className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Age (Months)</label>
                <input name="age" value={form.age} onChange={handleChange} placeholder="e.g., 18" className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
                <select name="gender" value={form.gender} onChange={handleChange} className="h-10 px-3 rounded-lg border border-slate-300 w-full">
                  <option value="">Select</option>
                  <option>Male</option>
                  <option>Female</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Specimen</label>
                <input name="sampleType" value={form.sampleType} onChange={handleChange} placeholder="e.g., Blood" className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Referred By</label>
                <input name="referredBy" value={form.referredBy} onChange={handleChange} placeholder="Doctor / Clinic" className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date of Test</label>
                <input type="date" name="testDate" value={form.testDate} onChange={handleChange} className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Technician</label>
                <input name="technician" value={form.technician} onChange={handleChange} placeholder="Technician Name" className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fee (PKR)</label>
                <input name="fee" type="number" value={form.fee} onChange={handleChange} placeholder="0" className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Status</label>
                <select name="paymentStatus" value={form.paymentStatus} onChange={handleChange} className="h-10 px-3 rounded-lg border border-slate-300 w-full">
                  <option>Paid</option>
                  <option>Pending</option>
                </select>
              </div>
            </div>

            {(form.results||[]).length>0 && (
              <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200 p-3">
                <div className="text-sm font-semibold text-slate-700 mb-2">Results</div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-white">
                        <th className="text-left py-2 px-3">S.#</th>
                        <th className="text-left py-2 px-3">Parameter</th>
                        <th className="text-left py-2 px-3">Result</th>
                        <th className="text-left py-2 px-3">Unit</th>
                        <th className="text-left py-2 px-3">Ref. Range</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.results.map((r, idx) => (
                        <tr key={idx} className="border-t border-slate-200">
                          <td className="py-2 px-3">{idx+1}</td>
                          <td className="py-2 px-3">{r.name}</td>
                          <td className="py-2 px-3"><input value={r.value||''} onChange={e=>setForm(f=>{ const arr=[...f.results]; arr[idx]={...arr[idx], value:e.target.value}; return { ...f, results:arr } })} className="h-9 px-2 rounded-lg border border-slate-300 w-40" /></td>
                          <td className="py-2 px-3"><input value={r.unit||''} readOnly className="h-9 px-2 rounded-lg border border-slate-200 w-32 bg-slate-50 text-slate-600" /></td>
                          <td className="py-2 px-3"><input value={r.refRange||''} readOnly className="h-9 px-2 rounded-lg border border-slate-200 w-48 bg-slate-50 text-slate-600" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Result / Observations</label>
              <textarea name="result" value={form.result} onChange={handleChange} placeholder="Free text" rows={4} className="w-full px-3 py-2 rounded-lg border border-slate-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Remarks</label>
              <textarea name="remarks" value={form.remarks} onChange={handleChange} placeholder="Remarks" rows={3} className="w-full px-3 py-2 rounded-lg border border-slate-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Upload PDF (optional)</label>
              <input type="file" name="pdf" accept="application/pdf" onChange={handleChange} className="block" />
            </div>
            <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-200">
              <button 
                type="button" 
                onClick={printReport} 
                className="px-6 h-12 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg hover:shadow-xl font-semibold transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd"/>
                </svg>
                Print Preview
              </button>
              <button 
                type="submit"
                className="px-6 h-12 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg hover:shadow-xl font-semibold transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
                Save Report
              </button>
            </div>
            </div>
          </form>
        </div>
      )}

      {showEdit && editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setShowEdit(false)}></div>
          <form onSubmit={saveEdit} className="relative w-[95%] max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white ring-1 ring-slate-200 shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-lg font-semibold text-slate-800">Edit Report</div>
              <button type="button" onClick={()=>setShowEdit(false)} className="h-8 w-8 grid place-items-center rounded-md border border-slate-300">×</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fee (PKR)</label>
                <input type="number" value={editItem.amount||0} onChange={e=>setEditItem(it=>({...it, amount:Number(e.target.value||0)}))} className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Status</label>
                <select value={editItem.paymentStatus||'Paid'} onChange={e=>setEditItem(it=>({...it, paymentStatus:e.target.value}))} className="h-10 px-3 rounded-lg border border-slate-300 w-full">
                  <option>Paid</option>
                  <option>Pending</option>
                </select>
              </div>
            </div>
            {(editItem.results||[]).length>0 && (
              <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200 p-3">
                <div className="text-sm font-semibold text-slate-700 mb-2">Results</div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-white">
                        <th className="text-left py-2 px-3">S.#</th>
                        <th className="text-left py-2 px-3">Parameter</th>
                        <th className="text-left py-2 px-3">Result</th>
                        <th className="text-left py-2 px-3">Unit</th>
                        <th className="text-left py-2 px-3">Ref. Range</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editItem.results.map((r, idx) => (
                        <tr key={idx} className="border-t border-slate-200">
                          <td className="py-2 px-3">{idx+1}</td>
                          <td className="py-2 px-3">{r.name}</td>
                          <td className="py-2 px-3"><input value={r.value||''} onChange={e=>setEditItem(it=>{ const arr=[...(it.results||[])]; arr[idx]={...arr[idx], value:e.target.value}; return { ...it, results:arr } })} className="h-9 px-2 rounded-lg border border-slate-300 w-40" /></td>
                          <td className="py-2 px-3"><input value={r.unit||''} onChange={e=>setEditItem(it=>{ const arr=[...(it.results||[])]; arr[idx]={...arr[idx], unit:e.target.value}; return { ...it, results:arr } })} className="h-9 px-2 rounded-lg border border-slate-300 w-32" /></td>
                          <td className="py-2 px-3"><input value={r.refRange||''} onChange={e=>setEditItem(it=>{ const arr=[...(it.results||[])]; arr[idx]={...arr[idx], refRange:e.target.value}; return { ...it, results:arr } })} className="h-9 px-2 rounded-lg border border-slate-300 w-48" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={()=>setShowEdit(false)} className="px-4 h-10 rounded-lg border border-slate-300">Cancel</button>
              <button className="px-4 h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white">Save Changes</button>
            </div>
          </form>
        </div>
      )}

      {showDelete && editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setShowDelete(false)}></div>
          <div className="relative w-[95%] max-w-md rounded-2xl bg-white ring-1 ring-slate-200 shadow-xl p-6">
            <div className="text-lg font-bold text-slate-900 mb-2">Delete Report</div>
            <div className="text-sm text-slate-600 mb-4">Are you sure you want to delete report for <span className="font-medium">{editItem.petName}</span> ({editItem.testName})?</div>
            <div className="flex justify-end gap-3">
              <button onClick={()=>setShowDelete(false)} className="px-4 h-10 rounded-lg border border-slate-300">Cancel</button>
              <button onClick={confirmDelete} className="px-4 h-10 rounded-lg bg-red-600 hover:bg-red-700 text-white">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview Modal */}
      {showPrintPreview && printData && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <style>{`
              @page { size: A4; margin: 12mm; }
              @media print {
                html, body { width: 210mm; }
                body * { visibility: hidden; }
                #lab-report-print, #lab-report-print * { visibility: visible; }
                #lab-report-print {
                  position: static;
                  width: 190mm;
                  margin: 0 auto;
                  padding: 0;
                  box-shadow: none !important;
                }
                .print-page-break { page-break-before: always; }
                table { page-break-inside: auto; }
                tr, td, th { page-break-inside: avoid; }
              }
            `}</style>
            
            <div id="lab-report-print" className="p-8 overflow-y-auto flex-1">
              {/* Header */}
              <div className="flex items-center border-b-4 border-blue-600 pb-3 mb-6">
                <div className="w-16 shrink-0">
                  {settings.companyLogo ? (
                    <img src={settings.companyLogo} alt="Logo" className="h-12 w-12 object-contain" />
                  ) : null}
                </div>
                <div className="flex-1 text-center">
                  <div className="text-3xl font-bold text-blue-600" style={{fontFamily: 'Georgia, serif'}}>{getLabProfileName() || settings.companyName || 'Abbottabad Pet Hospital'}</div>
                </div>
                <div className="w-16 shrink-0" />
              </div>

              {/* Test Information Grid */}
              <div className="mb-6">
                <div className="grid grid-cols-2 gap-x-16 gap-y-2 text-sm">
                  <div className="flex border-b border-slate-300 py-1">
                    <span className="font-semibold w-32">Test Date:</span>
                    <span className="flex-1">{printData.testDate || printData.date || 'Auto'}</span>
                  </div>
                  <div className="flex border-b border-slate-300 py-1">
                    <span className="font-semibold w-32">Test ID:</span>
                    <span className="flex-1">{printData.testId || printData.id || 'Auto'}</span>
                  </div>
                  
                  <div className="flex border-b border-slate-300 py-1">
                    <span className="font-semibold w-32">Patient ID:</span>
                    <span className="flex-1">{printData.patientId || 'Auto'}</span>
                  </div>
                  <div className="flex border-b border-slate-300 py-1">
                    <span className="font-semibold w-32">Owner Name:</span>
                    <span className="flex-1">{printData.ownerName || 'Auto'}</span>
                  </div>
                  
                  <div className="flex border-b border-slate-300 py-1">
                    <span className="font-semibold w-32">Animal Name:</span>
                    <span className="flex-1">{printData.petName || 'Auto'}</span>
                  </div>
                  <div className="flex border-b border-slate-300 py-1">
                    <span className="font-semibold w-32">Gender:</span>
                    <span className="flex-1">{printData.gender || 'Auto'}</span>
                  </div>
                  
                  <div className="flex border-b border-slate-300 py-1">
                    <span className="font-semibold w-32">Species:</span>
                    <span className="flex-1">{printData.species || 'Auto'}</span>
                  </div>
                  <div className="flex border-b border-slate-300 py-1">
                    <span className="font-semibold w-32">Date:</span>
                    <span className="flex-1">{new Date(printData.testDate || printData.date).toLocaleDateString() || 'Auto'}</span>
                  </div>
                  
                  <div className="flex border-b border-slate-300 py-1">
                    <span className="font-semibold w-32">Age (M):</span>
                    <span className="flex-1">{printData.age || 'Auto'}</span>
                  </div>
                  <div className="flex border-b border-slate-300 py-1">
                    <span className="font-semibold w-32">Referred By:</span>
                    <span className="flex-1 text-red-600 font-semibold">{printData.referredBy || 'Manual'}</span>
                  </div>
                </div>
              </div>

              {/* Test Name */}
              <div className="mb-4">
                <div className="text-xl font-bold">{printData.testName || 'Laboratory Test'}</div>
              </div>

              {/* Test Results Table */}
              {(printData.results || []).length > 0 && (
                <table className="w-full border-collapse text-sm mb-6">
                  <thead>
                    <tr className="border-b-2 border-slate-800">
                      <th className="text-left py-2 px-2 font-bold">S.#</th>
                      <th className="text-left py-2 px-2 font-bold">Parameter</th>
                      <th className="text-left py-2 px-2 font-bold">Result</th>
                      <th className="text-left py-2 px-2 font-bold"> </th>
                      <th className="text-left py-2 px-2 font-bold">Unit</th>
                      <th className="text-left py-2 px-2 font-bold">Ref. Range</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(printData.results || []).map((r, i) => {
                      const value = (r.result || r.value || '')
                      const ref = (r.normalRange || r.refRange || '')
                      const flag = getFlag(value, ref)
                      const isHigh = flag === 'H'
                      const isLow = flag === 'L'
                      return (
                        <tr key={i} className="border-b border-slate-200">
                          <td className="py-2 px-2">{i + 1}</td>
                          <td className="py-2 px-2">{r.testName || r.name || ''}</td>
                          <td className={`py-2 px-2 font-semibold ${isHigh ? 'text-orange-600' : isLow ? 'text-sky-600' : ''}`}>{value}</td>
                          <td className="py-2 px-2">
                            {flag ? (
                              <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded text-xs font-bold border ${isHigh ? 'border-orange-300 bg-orange-100 text-orange-700' : 'border-sky-300 bg-sky-100 text-sky-700'}`}>{flag}</span>
                            ) : null}
                          </td>
                          <td className="py-2 px-2">{r.unit || ''}</td>
                          <td className="py-2 px-2">{ref}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}

              {/* Notes / Result Text */}
              {(printData.notes || printData.result || printData.remarks) && (
                <div className="mt-4 pt-4 border-t border-slate-300 space-y-2">
                  {printData.notes && (
                    <div>
                      <div className="font-semibold mb-1">Notes:</div>
                      <div className="text-sm">{printData.notes}</div>
                    </div>
                  )}
                  {(printData.result || printData.remarks) && (
                    <div>
                      {printData.result && (
                        <div className="mb-1">
                          <div className="font-semibold">Result</div>
                          <div className="text-sm">{printData.result}</div>
                        </div>
                      )}
                      {printData.remarks && (
                        <div>
                          <div className="font-semibold">Remarks</div>
                          <div className="text-sm">{printData.remarks}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-slate-300 text-xs text-slate-700 space-y-1">
                <div className="font-semibold">Note:</div>
                <div>Not Valid for Court.</div>
                <div>The analysis results only answers to the corresponding sample.</div>
                <div>This is a computer generated report, therefore signatures are not required.</div>
                <div className="mt-1"><span className="font-semibold">L</span> = Low (below reference range), <span className="font-semibold">H</span> = High (above reference range).</div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="border-t border-slate-200 p-4 flex justify-end gap-3">
              <button 
                onClick={handleOkFromPreview}
                disabled={printSaving}
                className={`px-6 h-11 rounded-lg border-2 font-semibold ${printSaving ? 'border-slate-200 text-slate-400 cursor-not-allowed' : 'border-slate-300 hover:bg-slate-50 text-slate-700'}`}
              >
                {printSaving ? 'Saving…' : 'OK'}
              </button>
              <button 
                onClick={handlePrintFromPreview} 
                disabled={printSaving}
                className={`px-6 h-11 rounded-lg text-white font-semibold ${printSaving ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {printSaving ? 'Saving…' : 'Print'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPaymentModal && pendingSaveData && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between">
              <div className="font-bold">Payment Method</div>
              <button type="button" onClick={closePaymentModal} className="h-8 w-8 grid place-items-center rounded-md bg-white/20">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Method</label>
                  <select value={paymentMethod} onChange={e=>selectPaymentMethod(e.target.value)} className="h-10 px-3 rounded-lg border border-slate-300 w-full">
                    {availableMethods.map(m => (<option key={m} value={m}>{m}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Received</label>
                  <input
                    type="number"
                    value={receivedAmount}
                    onChange={e=>{ setReceivedTouched(true); setReceivedAmount(e.target.value) }}
                    className="h-10 px-3 rounded-lg border border-slate-300 w-full"
                  />
                </div>
              </div>

              {paymentMethod === 'Bank Account' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Bank Name</label>
                    <input value={paymentDetails.bankName||''} onChange={e=>setPaymentDetails(p=>({ ...p, bankName:e.target.value }))} className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Account #</label>
                    <input value={paymentDetails.accountNumber||''} onChange={e=>setPaymentDetails(p=>({ ...p, accountNumber:e.target.value }))} className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Transaction ID</label>
                    <input value={paymentDetails.transactionId||''} onChange={e=>setPaymentDetails(p=>({ ...p, transactionId:e.target.value }))} className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
                  </div>
                </div>
              )}

              {(paymentMethod === 'Easypaisa' || paymentMethod === 'JazzCash') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Wallet #</label>
                    <input value={paymentDetails.walletNumber||''} onChange={e=>setPaymentDetails(p=>({ ...p, walletNumber:e.target.value }))} className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Transaction ID</label>
                    <input value={paymentDetails.transactionId||''} onChange={e=>setPaymentDetails(p=>({ ...p, transactionId:e.target.value }))} className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
                  </div>
                </div>
              )}

              {(paymentMethod === 'Credit' || paymentMethod === 'Debit') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Card Holder</label>
                    <input value={paymentDetails.cardHolderName||''} onChange={e=>setPaymentDetails(p=>({ ...p, cardHolderName:e.target.value }))} className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Last 4 Digits</label>
                    <input value={paymentDetails.cardLast4||''} onChange={e=>setPaymentDetails(p=>({ ...p, cardLast4:e.target.value }))} className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Auth Code</label>
                    <input value={paymentDetails.cardAuthCode||''} onChange={e=>setPaymentDetails(p=>({ ...p, cardAuthCode:e.target.value }))} className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Transaction ID</label>
                    <input value={paymentDetails.transactionId||''} onChange={e=>setPaymentDetails(p=>({ ...p, transactionId:e.target.value }))} className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
                  </div>
                  <div className="md:col-span-2 text-xs text-slate-600">Card payments include 2% charge.</div>
                </div>
              )}

              <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200 p-4">
                <div className="flex items-center justify-between text-sm"><span>Fee</span><span className="font-semibold">Rs. {Number(pendingSaveData.fee||0).toLocaleString()}</span></div>
                <div className="flex items-center justify-between text-sm"><span>Charge</span><span className="font-semibold">Rs. {Number(paymentCharge||0).toLocaleString()}</span></div>
                <div className="flex items-center justify-between text-sm"><span>Total</span><span className="font-bold">Rs. {Number(Math.max(0, toNum(pendingSaveData.fee||0) + toNum(paymentCharge||0))).toLocaleString()}</span></div>
                <div className="flex items-center justify-between text-sm"><span>Receivable</span><span className="font-bold text-amber-700">Rs. {Number(Math.max(0, (toNum(pendingSaveData.fee||0) + toNum(paymentCharge||0)) - Math.min(toNum(receivedAmount||0), (toNum(pendingSaveData.fee||0) + toNum(paymentCharge||0))))).toLocaleString()}</span></div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closePaymentModal} className="px-4 h-10 rounded-lg border border-slate-300">Cancel</button>
                <button type="button" onClick={confirmPaymentAndSave} className="px-4 h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isProcessingPayment}>
                  {isProcessingPayment ? 'Saving...' : 'Confirm & Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReceipt && receiptData && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-slate-800 to-slate-900 text-white flex items-center justify-between">
              <div className="font-bold">Receipt</div>
              <button type="button" onClick={closeReceipt} className="h-8 w-8 grid place-items-center rounded-md bg-white/20">×</button>
            </div>
            <div className="p-6 space-y-3" ref={receiptRef}>
              <div className="text-sm text-slate-700">
                <div className="font-semibold">Report: {receiptData.reportNumber || receiptData.id}</div>
                <div>Pet: {receiptData.petName}</div>
                <div>Owner: {receiptData.ownerName}</div>
                <div>Payment: {receiptData.paymentMethod || receiptData.paymentDetails?.method || 'Cash'}</div>
              </div>
              <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200 p-4 text-sm">
                <div className="flex justify-between"><span>Fee</span><span className="font-semibold">Rs. {Number(receiptData.amount||0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Charge</span><span className="font-semibold">Rs. {Number(receiptData.paymentCharge||0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Total</span><span className="font-bold">Rs. {Number((Number(receiptData.amount||0)+Number(receiptData.paymentCharge||0))||0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Received</span><span className="font-bold">Rs. {Number(receiptData.receivedAmount||0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Receivable</span><span className="font-bold text-amber-700">Rs. {Number(receiptData.dueAmount||0).toLocaleString()}</span></div>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={closeReceipt} className="px-4 h-10 rounded-lg border border-slate-300">Close</button>
                <button type="button" onClick={()=>printThermalReceipt(receiptData)} className="px-4 h-10 rounded-lg bg-slate-900 hover:bg-black text-white">Print 80mm</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRecoverModal && recoverReport && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-amber-600 to-orange-600 text-white flex items-center justify-between">
              <div className="font-bold">Recover Payment</div>
              <button type="button" onClick={closeRecoverModal} className="h-8 w-8 grid place-items-center rounded-md bg-white/20">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-sm text-slate-700">
                <div className="font-semibold">Report: {recoverReport.reportNumber || recoverReport.id}</div>
                <div>Due: Rs. {Number(recoverReport.dueAmount||0).toLocaleString()}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Method</label>
                  <select value={recoverMethod} onChange={e=>{ setRecoverMethod(e.target.value); setRecoverPaymentDetails(p=>({ ...p, method:e.target.value })) }} className="h-10 px-3 rounded-lg border border-slate-300 w-full">
                    {availableMethods.map(m => (<option key={m} value={m}>{m}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
                  <input type="number" value={recoverAmount} onChange={e=>setRecoverAmount(e.target.value)} className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
                </div>
              </div>

              {recoverMethod === 'Bank Account' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Bank Name</label>
                    <input value={recoverPaymentDetails.bankName||''} onChange={e=>setRecoverPaymentDetails(p=>({ ...p, bankName:e.target.value }))} className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Account #</label>
                    <input value={recoverPaymentDetails.accountNumber||''} onChange={e=>setRecoverPaymentDetails(p=>({ ...p, accountNumber:e.target.value }))} className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Transaction ID</label>
                    <input value={recoverPaymentDetails.transactionId||''} onChange={e=>setRecoverPaymentDetails(p=>({ ...p, transactionId:e.target.value }))} className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
                  </div>
                </div>
              )}

              {(recoverMethod === 'Easypaisa' || recoverMethod === 'JazzCash') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Wallet #</label>
                    <input value={recoverPaymentDetails.walletNumber||''} onChange={e=>setRecoverPaymentDetails(p=>({ ...p, walletNumber:e.target.value }))} className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Transaction ID</label>
                    <input value={recoverPaymentDetails.transactionId||''} onChange={e=>setRecoverPaymentDetails(p=>({ ...p, transactionId:e.target.value }))} className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
                  </div>
                </div>
              )}

              {(recoverMethod === 'Credit' || recoverMethod === 'Debit') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Card Holder</label>
                    <input value={recoverPaymentDetails.cardHolderName||''} onChange={e=>setRecoverPaymentDetails(p=>({ ...p, cardHolderName:e.target.value }))} className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Last 4 Digits</label>
                    <input value={recoverPaymentDetails.cardLast4||''} onChange={e=>setRecoverPaymentDetails(p=>({ ...p, cardLast4:e.target.value }))} className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Auth Code</label>
                    <input value={recoverPaymentDetails.cardAuthCode||''} onChange={e=>setRecoverPaymentDetails(p=>({ ...p, cardAuthCode:e.target.value }))} className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Transaction ID</label>
                    <input value={recoverPaymentDetails.transactionId||''} onChange={e=>setRecoverPaymentDetails(p=>({ ...p, transactionId:e.target.value }))} className="h-10 px-3 rounded-lg border border-slate-300 w-full" />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button type="button" onClick={closeRecoverModal} className="px-4 h-10 rounded-lg border border-slate-300">Cancel</button>
                <button type="button" onClick={confirmRecover} className="px-4 h-10 rounded-lg bg-amber-600 hover:bg-amber-700 text-white" disabled={recoverLoading}>
                  {recoverLoading ? 'Saving...' : 'Recover & Print'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {copyToast && (
        <div className="fixed bottom-4 right-4 z-[100] rounded-lg bg-black/80 text-white text-sm px-3 py-2">{copyToast}</div>
      )}
    </div>
  )
}
