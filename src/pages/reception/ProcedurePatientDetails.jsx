import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FiArrowLeft, FiCalendar, FiCheckCircle, FiClock, FiCreditCard, FiDownload, FiEdit2, FiImage, FiPlus, FiPrinter, FiRefreshCw, FiTrash2, FiUpload, FiX } from 'react-icons/fi'
import { appointmentsAPI, procedureCatalogAPI, procedurePlansAPI } from '../../services/api'

const money = (n) => `Rs ${Number(n || 0).toLocaleString()}`

export default function ProcedurePatientDetails() {
  const { petId } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [payload, setPayload] = useState(null)

  const [tab, setTab] = useState('ongoing')

  const [payOpen, setPayOpen] = useState(false)
  const [paySession, setPaySession] = useState(null)
  const [payAmount, setPayAmount] = useState(0)
  const [payMethod, setPayMethod] = useState('Cash')
  const [paySaving, setPaySaving] = useState(false)
  const [payError, setPayError] = useState('')

  const [printReceipt, setPrintReceipt] = useState(null)
  const [showReceiptModal, setShowReceiptModal] = useState(false)

  const [addOpen, setAddOpen] = useState(false)
  const [addMainCategory, setAddMainCategory] = useState('')
  const [addSubCategory, setAddSubCategory] = useState('')
  const [addProcedure, setAddProcedure] = useState('')
  const [addDate, setAddDate] = useState('')
  const [addTime, setAddTime] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState('')

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmKind, setConfirmKind] = useState('')
  const [confirmSession, setConfirmSession] = useState(null)
  const [confirmPlanId, setConfirmPlanId] = useState('')

  const [assignOpen, setAssignOpen] = useState(false)
  const [assignSession, setAssignSession] = useState(null)
  const [assignDate, setAssignDate] = useState('')
  const [assignTime, setAssignTime] = useState('')
  const [assignSaving, setAssignSaving] = useState(false)
  const [assignError, setAssignError] = useState('')

  const [toast, setToast] = useState('')

  const [expandedPayments, setExpandedPayments] = useState({})
  const [expandedPhotos, setExpandedPhotos] = useState({})
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalog, setCatalog] = useState([])

  const [completeSaving, setCompleteSaving] = useState(false)

  const showToast = (message) => {
    setToast(message)
    setTimeout(() => setToast(''), 3500)
  }

  const load = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true)
      setError('')
      const res = await procedurePlansAPI.getByPetId(petId)
      setPayload(res?.data || null)
    } catch (e) {
      setError(e?.message || 'Failed to load patient')
      setPayload(null)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    if (!petId) return
    load()
  }, [petId])

  const togglePayments = (sessionId) => {
    setExpandedPayments((prev) => ({ ...prev, [sessionId]: !prev[sessionId] }))
  }

  const togglePhotos = (sessionId) => {
    setExpandedPhotos((prev) => ({ ...prev, [sessionId]: !prev[sessionId] }))
  }

  const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    try {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('File read failed'))
      reader.readAsDataURL(file)
    } catch (e) {
      reject(e)
    }
  })

  const handlePhotoUpload = async (sessionId, type, file) => {
    if (!sessionId || !file) return
    try {
      setUploadingPhoto(true)
      const dataUrl = await fileToDataUrl(file)
      const comma = dataUrl.indexOf(',')
      const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
      const contentType = String(file.type || 'image/jpeg')
      await procedurePlansAPI.uploadSessionPhoto(sessionId, { type, data: base64, contentType })
      await load({ silent: true })
      showToast('Photo uploaded')
    } catch (e) {
      showToast('Photo upload failed')
    } finally {
      setUploadingPhoto(false)
    }
  }

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        setCatalogLoading(true)
        const res = await procedureCatalogAPI.getAll()
        setCatalog(Array.isArray(res?.data) ? res.data : [])
      } catch {
        setCatalog([])
      } finally {
        setCatalogLoading(false)
      }
    }
    loadCatalog()
  }, [])

  const pet = payload?.pet || {}
  const summary = payload?.summary || {}
  const plans = Array.isArray(payload?.plans) ? payload.plans : []

  const nameLine = useMemo(() => {
    const nm = `${pet.petName || ''}`.trim()
    const owner = `${pet.ownerName || ''}`.trim()
    const phone = `${pet.ownerContact || ''}`.trim()
    return { nm, owner, phone }
  }, [pet])

  const formatTime12 = (timeStr) => {
    const raw = String(timeStr || '').trim()
    if (!raw) return ''
    const m = raw.match(/^(\d{1,2}):(\d{2})/)
    if (!m) return raw
    let hh = Number(m[1])
    const mm = String(m[2])
    if (Number.isNaN(hh)) return raw
    const ampm = hh >= 12 ? 'PM' : 'AM'
    hh = hh % 12
    if (hh === 0) hh = 12
    return `${hh}:${mm} ${ampm}`
  }

  const nextApptLabel = useMemo(() => {
    const allSessions = (plans || []).flatMap(p => (p.sessions || []).map(s => ({ ...s, _planId: p._id })))
    if (!allSessions.length) return '—'
    const latest = allSessions
      .map(s => ({ ...s, _dt: s?.createdAt ? new Date(s.createdAt).getTime() : 0 }))
      .sort((a, b) => (b._dt - a._dt) || (Number(b?.sessionNo || 0) - Number(a?.sessionNo || 0)))[0]

    const a = latest?.nextAppointment
    if (!a?.date || !a?.time) return '—'
    const t = formatTime12(a.time)
    return `${a.date}${t ? ` • ${t}` : ''}`.trim() || '—'
  }, [plans])

  const lastVisitLabel = useMemo(() => {
    if (!summary?.lastVisit) return '—'
    const d = new Date(summary.lastVisit)
    if (!Number.isFinite(d.getTime())) return '—'
    return d.toLocaleDateString()
  }, [summary])

  const overallDue = useMemo(() => {
    const allSessions = (plans || []).flatMap(p => (p.sessions || []))
    const total = allSessions.reduce((sum, s) => sum + Number(s?.totalAmount || 0), 0)
    const paid = allSessions.reduce((sum, s) => sum + Number(s?.paidAmount || 0), 0)
    return Math.max(0, total - paid)
  }, [plans])

  const allPayments = useMemo(() => {
    const list = []
    ;(plans || []).forEach(p => {
      ;(p.sessions || []).forEach(s => {
        ;(Array.isArray(s.payments) ? s.payments : []).forEach(py => {
          list.push({
            ...py,
            sessionId: s._id,
            sessionNo: s.sessionNo,
            planId: p._id,
            procedureName: p.procedureName,
          })
        })
      })
    })
    return list.sort((a, b) => new Date(b.paidAt || 0) - new Date(a.paidAt || 0))
  }, [plans])

  const openAssign = (session) => {
    setAssignSession(session)
    setAssignError('')
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    setAssignDate(`${yyyy}-${mm}-${dd}`)
    setAssignTime('')
    setAssignOpen(true)
  }

  const closeAssign = () => {
    setAssignOpen(false)
    setAssignSession(null)
    setAssignDate('')
    setAssignTime('')
    setAssignSaving(false)
    setAssignError('')
  }

  const submitAssign = async () => {
    try {
      setAssignSaving(true)
      setAssignError('')
      if (!assignSession?._id) throw new Error('Invalid session')
      const dt = String(assignDate || '').trim()
      const tm = String(assignTime || '').trim()
      if (!dt) throw new Error('Date is required')
      if (!tm) throw new Error('Time is required')

      const appt = {
        id: `APT-${Date.now()}`,
        petId: pet.id || petId,
        procedureSessionId: String(assignSession._id),
        clientId: pet.clientId || '',
        petName: pet.petName || '',
        ownerName: pet.ownerName || '',
        ownerContact: pet.ownerContact || '',
        type: pet.type || pet.petType || pet.species || 'Unknown',
        species: pet.species || '',
        date: dt,
        time: tm,
        doctor: '',
        purpose: 'Procedure Next Appointment',
        reason: 'Procedure Next Appointment',
        status: 'Scheduled',
        notes: `Procedure session ${assignSession.sessionNo || ''}`.trim(),
        createdBy: 'Reception',
      }

      await appointmentsAPI.create(appt)
      closeAssign()
      await load({ silent: true })
      showToast('Appointment assigned')
    } catch (e) {
      setAssignError(e?.message || 'Failed to assign')
    } finally {
      setAssignSaving(false)
    }
  }

  const visiblePlans = useMemo(() => {
    const ongoing = plans.filter(p => String(p.status || 'ongoing') !== 'completed')
    const completed = plans.filter(p => String(p.status || '') === 'completed')
    return tab === 'past' ? completed : ongoing
  }, [plans, tab])

  const mainCategoryOptions = useMemo(() => {
    const set = new Set()
    for (const it of catalog) {
      const mc = String(it?.mainCategory || '').trim()
      if (mc) set.add(mc)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [catalog])

  const subCategoryOptions = useMemo(() => {
    const set = new Set()
    for (const it of catalog) {
      const mc = String(it?.mainCategory || '').trim()
      const sc = String(it?.subCategory || '').trim()
      if (!sc) continue
      if (addMainCategory && mc !== addMainCategory) continue
      set.add(sc)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [catalog, addMainCategory])

  const procedureOptions = useMemo(() => {
    const set = new Set()
    for (const it of catalog) {
      const mc = String(it?.mainCategory || '').trim()
      const sc = String(it?.subCategory || '').trim()
      const drug = String(it?.drug || '').trim()
      if (!drug) continue
      if (addMainCategory && mc !== addMainCategory) continue
      if (addSubCategory && sc !== addSubCategory) continue
      set.add(drug)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [catalog, addMainCategory, addSubCategory])

  // Reset sub-category when main category changes and current selection is no longer valid
  useEffect(() => {
    if (addMainCategory && !subCategoryOptions.includes(addSubCategory)) {
      setAddSubCategory('')
    }
  }, [addMainCategory, subCategoryOptions])

  // Reset procedure when category filters change and current selection is no longer valid
  useEffect(() => {
    if ((addMainCategory || addSubCategory) && !procedureOptions.includes(addProcedure)) {
      setAddProcedure('')
    }
  }, [addMainCategory, addSubCategory, procedureOptions])

  const openPay = (session) => {
    setPaySession(session)
    setPayError('')
    setPayMethod('Cash')
    const pid = String(session?.planId || '').trim()
    const plan = plans.find(p => String(p._id) === pid)
    const planTotal = (plan?.sessions || []).reduce((sum, ss) => sum + Number(ss?.totalAmount || 0), 0)
    const planPaid = (plan?.sessions || []).reduce((sum, ss) => sum + Number(ss?.paidAmount || 0), 0)
    const planBalance = Math.max(0, planTotal - planPaid)
    setPayAmount(planBalance)
    setPayOpen(true)
  }

  const downloadDataUrl = (dataUrl, filename) => {
    try {
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch {}
  }

  const handlePhotoDelete = async (sessionId, type) => {
    try {
      if (!sessionId) return
      setUploadingPhoto(true)
      await procedurePlansAPI.deleteSessionPhoto(sessionId, type)
      await load({ silent: true })
      showToast('Photo deleted')
    } catch {
      showToast('Delete failed')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const closePay = () => {
    setPayOpen(false)
    setPaySession(null)
    setPayAmount(0)
    setPayMethod('Cash')
    setPayError('')
    setPaySaving(false)
  }

  const buildSlipHTML = (data) => {
    const hospitalName = 'Abbottabad Pet Hospital'
    const addr = 'Main Boulevard, Gulshan-e-Iqbal, Karachi'
    const phone = '+92-21-1234567'

    return `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Procedure Payment</title>
          <style>
            @page { size: 80mm auto; margin: 2mm; }
            body { font-family: monospace; font-size: 12px; margin: 0; padding: 2mm; color: #000; background: #fff; width: 80mm; max-width: 80mm; font-weight: bold; }
            .center { text-align: center; }
            .title { background: #000; color: #fff; text-align: center; padding: 4px 0; margin: 10px 0; font-size: 14px; }
            .row { display: flex; justify-content: space-between; margin: 2px 0; }
            .border-top { border-top: 1px dashed #000; margin-top: 5px; padding-top: 5px; }
            table { width: 100%; border-collapse: collapse; margin: 5px 0; }
            td { padding: 2px 0; }
          </style>
        </head>
        <body>
          <div class="center">
            <div style="font-size: 16px;">${hospitalName}</div>
            <div style="font-size: 11px;">${addr}</div>
            <div style="font-size: 11px;">Phone: ${phone}</div>
          </div>
          <div class="title">PROCEDURE PAYMENT</div>
          <table>
            <tr><td>Patient:</td><td style="text-align:right">${data.petName || '—'} (${data.petId || '—'})</td></tr>
            <tr><td>Owner:</td><td style="text-align:right">${data.ownerName || '—'}</td></tr>
            <tr><td>Procedure:</td><td style="text-align:right">${data.procedureName || 'Procedure'}</td></tr>
            <tr><td>Session:</td><td style="text-align:right">Session ${Number(data.sessionNo || 1)}</td></tr>
            <tr><td>Date:</td><td style="text-align:right">${data.paidAt ? new Date(data.paidAt).toLocaleString() : new Date().toLocaleString()}</td></tr>
          </table>
          <div class="border-top"></div>
          <div class="row" style="font-size: 14px;">
            <span>PAID AMOUNT:</span>
            <span>Rs ${Number(data.amount || 0).toLocaleString()}</span>
          </div>
          <div class="row">
            <span>Payment Method:</span>
            <span>${data.method || 'Cash'}</span>
          </div>
          <div class="border-top"></div>
          <div class="row">
            <span>Procedure Total:</span>
            <span>Rs ${Number(data.totalAmount || 0).toLocaleString()}</span>
          </div>
          <div class="row">
            <span>Total Paid:</span>
            <span>Rs ${Number(data.paidAmount || 0).toLocaleString()}</span>
          </div>
          <div class="row" style="font-size: 14px;">
            <span>BALANCE DUE:</span>
            <span>Rs ${Number(data.balance || 0).toLocaleString()}</span>
          </div>
          <div class="center border-top" style="margin-top: 15px;">
            <div>Thank you!</div>
            <div>Powered by MindSpire</div>
          </div>
        </body>
      </html>
    `
  }

  const printThermalSlip = (data) => {
    try {
      const html = buildSlipHTML(data)
      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = '0'
      document.body.appendChild(iframe)
      const doc = iframe.contentWindow.document
      doc.open()
      doc.write(html)
      doc.close()
      iframe.onload = () => {
        try {
          iframe.contentWindow.focus()
          iframe.contentWindow.print()
        } catch {}
        setTimeout(() => {
          try {
            document.body.removeChild(iframe)
          } catch {}
        }, 300)
      }
    } catch {}
  }

  const handlePrintPaymentSlip = (session, payment, plan) => {
    const planTotal = (plan?.sessions || []).reduce((sum, s) => sum + Number(s?.totalAmount || 0), 0)
    const planPaid = (plan?.sessions || []).reduce((sum, s) => sum + Number(s?.paidAmount || 0), 0)
    const slipData = {
      petName: pet.petName,
      petId: pet.id || petId,
      ownerName: pet.ownerName,
      clientId: pet.clientId,
      contact: pet.ownerContact,
      procedureName: plan?.procedureName || 'Procedure',
      sessionNo: session?.sessionNo,
      amount: Number(payment?.amount || 0),
      method: payment?.method,
      paidAt: payment?.paidAt,
      totalAmount: planTotal,
      paidAmount: planPaid,
      balance: Math.max(0, planTotal - planPaid),
    }
    setPrintReceipt(slipData)
    setShowReceiptModal(true)
    setTimeout(() => {
      printThermalSlip(slipData)
    }, 200)
  }

  const submitPay = async (printAfter = false) => {
    try {
      setPaySaving(true)
      setPayError('')
      if (!paySession?._id) throw new Error('Invalid session')
      const amt = Math.max(0, Number(payAmount || 0))
      const res = await procedurePlansAPI.paySession(paySession._id, { amount: amt, method: payMethod })
      const session = res?.data
      if (printAfter && session) {
        const payments = Array.isArray(session.payments) ? session.payments : []
        const lastPayment = payments[payments.length - 1]
        const plan = plans.find(p => String(p._id) === String(session?.planId))
        if (lastPayment && plan) {
          const patchedPlan = {
            ...plan,
            sessions: (plan.sessions || []).map(s => (String(s?._id) === String(session?._id) ? { ...s, paidAmount: session.paidAmount, payments: session.payments } : s)),
          }
          handlePrintPaymentSlip(session, lastPayment, patchedPlan)
        }
      }
      closePay()
      await load({ silent: true })
    } catch (e) {
      setPayError(e?.message || 'Payment failed')
    } finally {
      setPaySaving(false)
    }
  }

  const openAddSession = () => {
    const firstOngoing = plans.find(p => String(p.status || 'ongoing') !== 'completed')
    const proc = String(firstOngoing?.procedureName || '').trim()
    const match = catalog.find(c => String(c?.drug || '').trim() === proc)
    setAddMainCategory(String(match?.mainCategory || '').trim())
    setAddSubCategory(String(match?.subCategory || '').trim())
    setAddProcedure(proc)
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const hh = String(now.getHours()).padStart(2, '0')
    const min = String(now.getMinutes()).padStart(2, '0')
    setAddDate(`${yyyy}-${mm}-${dd}`)
    setAddTime(`${hh}:${min}`)
    setAddOpen(true)
  }

  const closeAddSession = () => {
    setAddOpen(false)
    setAddSaving(false)
    setAddError('')
  }

  const submitAddSession = async () => {
    try {
      setAddSaving(true)
      setAddError('')

      const procedureName = String(addProcedure || '').trim()
      if (!procedureName) throw new Error('Procedure required')

      const dt = addDate ? new Date(`${addDate}T${addTime || '00:00'}:00`) : null
      const scheduledAt = dt && Number.isFinite(dt.getTime()) ? dt.toISOString() : undefined

      const existingPlan = plans.find(
        p => String(p.status || 'ongoing') !== 'completed' && String(p.procedureName || '').trim() === procedureName
      )

      if (existingPlan?._id) {
        await procedurePlansAPI.addSession(String(existingPlan._id), { totalAmount: 0, scheduledAt })
      } else {
        await procedurePlansAPI.createPlan(petId, { procedureName, totalAmount: 0, scheduledAt })
      }

      closeAddSession()
      await load({ silent: true })
    } catch (e) {
      setAddError(e?.message || 'Failed to add session')
    } finally {
      setAddSaving(false)
    }
  }

  const askCompleteSession = (session) => {
    if (!session?._id) return
    setConfirmKind('session')
    setConfirmSession(session)
    setConfirmPlanId('')
    setConfirmOpen(true)
  }

  const askCompleteProcedure = (planId) => {
    if (!planId) return
    setConfirmKind('procedure')
    setConfirmSession(null)
    setConfirmPlanId(String(planId))
    setConfirmOpen(true)
  }

  const closeConfirm = () => {
    setConfirmOpen(false)
    setConfirmKind('')
    setConfirmSession(null)
    setConfirmPlanId('')
  }

  const confirmComplete = async () => {
    try {
      if (confirmKind === 'session') {
        if (!confirmSession?._id) return
        await procedurePlansAPI.completeSession(confirmSession._id)
        await load({ silent: true })
        closeConfirm()
        showToast('Session completed')
        return
      }

      if (confirmKind === 'procedure') {
        const pid = String(confirmPlanId || '')
        if (!pid) return

        const plan = plans.find(p => String(p._id) === pid)
        const planSessions = (plan?.sessions || [])
        const planTotal = planSessions.reduce((sum, s) => sum + Number(s?.totalAmount || 0), 0)
        const planPaid = planSessions.reduce((sum, s) => sum + Number(s?.paidAmount || 0), 0)
        const planOutstanding = Math.max(0, planTotal - planPaid)

        if (planOutstanding > 0) {
          closeConfirm()
          showToast('Please clear remaining dues before completing this procedure')
          return
        }

        setCompleteSaving(true)
        await procedurePlansAPI.completeProcedure(pid)
        await load({ silent: true })
        closeConfirm()
        showToast('Procedure completed')
      }
    } catch (e) {
      setError(e?.message || 'Action failed')
    } finally {
      setCompleteSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 inline-flex items-center gap-2 font-semibold"
          >
            <FiArrowLeft />
            Back
          </button>
          <div>
            <div className="text-sm text-slate-500">Procedure Patient Profile</div>
            <div className="text-xl font-bold text-slate-900">
              {nameLine.nm || '—'}
              <span className="ml-2 text-xs font-semibold text-slate-500">Pet ID: {pet.id || petId}</span>
            </div>
            <div className="text-xs text-slate-500">
              Owner: {nameLine.owner || '—'} {pet.clientId ? `• Client: ${pet.clientId}` : ''} {nameLine.phone ? `• ${nameLine.phone}` : ''}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => load()}
            className="h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-bold inline-flex items-center gap-2"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            type="button"
            onClick={openAddSession}
            className="h-10 px-4 rounded-xl bg-emerald-600 text-white text-sm font-bold inline-flex items-center gap-2"
          >
            <FiPlus />
            Add Session
          </button>
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="text-xs text-slate-500 font-semibold">Total Paid</div>
              <div className="text-lg font-extrabold text-slate-900">{money(summary.totalPaid)}</div>
            </div>
            <div className="bg-red-50 rounded-2xl border border-red-200 p-4">
              <div className="text-xs text-red-600 font-semibold">Remaining Dues</div>
              <div className="text-lg font-extrabold text-red-700">{money(overallDue)}</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="text-xs text-slate-500 font-semibold flex items-center gap-2"><FiClock /> Last Visit</div>
              <div className="text-lg font-extrabold text-slate-900">{lastVisitLabel}</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="text-xs text-slate-500 font-semibold flex items-center gap-2"><FiCalendar /> Next Appointment</div>
              <div className="text-lg font-extrabold text-slate-900">{nextApptLabel}</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap">
              <div className="font-bold text-slate-900">Medical / Procedure History</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTab('ongoing')}
                  className={`h-9 px-4 rounded-xl text-sm font-bold border ${tab === 'ongoing' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                >
                  Ongoing
                </button>
                <button
                  type="button"
                  onClick={() => setTab('past')}
                  className={`h-9 px-4 rounded-xl text-sm font-bold border ${tab === 'past' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                >
                  Past
                </button>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {loading ? (
                <div className="text-sm text-slate-500">Loading...</div>
              ) : null}

              {visiblePlans.map((p) => (
                <div key={p._id} className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="p-4 flex items-start justify-between gap-3 flex-wrap border-b border-slate-100">
                    <div>
                      <div className="font-extrabold text-slate-900">{p.procedureName || 'Procedure'}</div>
                      <div className="text-xs text-slate-500">{p.createdAt ? new Date(p.createdAt).toLocaleString() : ''}</div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {String(p.status || 'ongoing') !== 'completed' ? (
                        <button
                          type="button"
                          onClick={() => askCompleteProcedure(String(p._id))}
                          disabled={completeSaving}
                          className="h-9 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold disabled:opacity-50 inline-flex items-center gap-2"
                        >
                          <FiCheckCircle />
                          Complete Procedure
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    {(() => {
                      const planTotal = (p.sessions || []).reduce((sum, ss) => sum + Number(ss?.totalAmount || 0), 0)
                      const planPaid = (p.sessions || []).reduce((sum, ss) => sum + Number(ss?.paidAmount || 0), 0)
                      const planBalance = Math.max(0, planTotal - planPaid)

                      return (p.sessions || []).map((s) => {
                        const paid = Number(s?.paidAmount || 0)
                        const canPay = planBalance > 0
                        const nextLabel = s?.nextAppointment
                          ? `${s.nextAppointment.date || ''}${s.nextAppointment.time ? ` • ${formatTime12(s.nextAppointment.time)}` : ''}`.trim() || '—'
                          : '—'
                      const badge = String(s?.status || 'planned')
                      const items = Array.isArray(s?.procedureItems) ? s.procedureItems : []
                      return (
                        <div key={s._id} className="rounded-2xl border border-slate-200">
                          <div className="p-4 flex items-start justify-between gap-3 flex-wrap">
                            <div>
                              <div className="font-extrabold text-slate-900">
                                {p.procedureName || 'Procedure'}
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold border border-slate-200 text-slate-600 bg-white">Session {Number(s.sessionNo || 0) || 1}</span>
                                <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold border ${badge === 'completed' ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-slate-200 text-slate-600 bg-slate-50'}`}>{badge}</span>
                              </div>
                              <div className="text-xs text-slate-500">{s.createdAt ? new Date(s.createdAt).toLocaleString() : ''}</div>
                            </div>

                            <div className="flex gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => openAssign(s)}
                                className="h-9 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold inline-flex items-center gap-2"
                              >
                                <FiCalendar />
                                Assign
                              </button>
                              {badge !== 'completed' ? (
                                <button
                                  type="button"
                                  onClick={() => askCompleteSession(s)}
                                  className="h-9 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold inline-flex items-center gap-2"
                                >
                                  <FiCheckCircle />
                                  Complete Session
                                </button>
                              ) : null}
                              {canPay ? (
                                <button
                                  type="button"
                                  onClick={() => openPay(s)}
                                  className="h-9 px-4 rounded-xl bg-slate-900 text-white text-xs font-bold"
                                >
                                  Pay
                                </button>
                              ) : null}
                            </div>
                          </div>

                          <div className="px-4 pb-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                              <div className="text-[10px] font-bold text-slate-500">TOTAL</div>
                              <div className="text-sm font-extrabold text-slate-900">{money(planTotal)}</div>
                            </div>
                            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                              <div className="text-[10px] font-bold text-slate-500">PAID</div>
                              <div className="text-sm font-extrabold text-slate-900">{money(paid)}</div>
                            </div>
                            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                              <div className="text-[10px] font-bold text-slate-500">BALANCE</div>
                              <div className={`text-sm font-extrabold ${planBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{money(planBalance)}</div>
                            </div>
                            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                              <div className="text-[10px] font-bold text-slate-500">NEXT</div>
                              <div className="text-sm font-extrabold text-slate-900">{nextLabel}</div>
                            </div>
                          </div>

                          {items.length ? (
                            <div className="px-4 pb-4">
                              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                                <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">Procedure Details</div>
                                <div className="divide-y divide-slate-100">
                                  {items.map((it, idx) => (
                                    <div key={`${it.drug || 'item'}-${idx}`} className="px-3 py-2 flex items-center justify-between gap-3 text-sm">
                                      <div className="font-semibold text-slate-800">{it.drug || '—'}</div>
                                      <div className="text-xs text-slate-500 whitespace-nowrap">
                                        {Number(it.quantity || 0)} {it.unit || ''} × {money(it.amount)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ) : null}

                          <div className="px-4 pb-4 space-y-2">
                            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                              <button
                                type="button"
                                onClick={() => togglePayments(s._id)}
                                className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-50"
                              >
                                <div className="text-xs font-bold text-slate-700 flex items-center gap-2">
                                  <FiCreditCard className="text-slate-400" /> Payments
                                </div>
                                <div className="text-xs text-slate-500">{Array.isArray(s.payments) ? s.payments.length : 0} record(s)</div>
                              </button>
                              {expandedPayments[s._id] ? (
                                <div className="border-t border-slate-100 px-3 py-2">
                                  {Array.isArray(s.payments) && s.payments.length ? (
                                    <div className="divide-y divide-slate-100">
                                      {s.payments.map((py, idx) => (
                                        <div key={idx} className="py-2 flex items-center justify-between gap-2">
                                          <div>
                                            <div className="text-xs font-bold text-slate-800">{money(py.amount)}</div>
                                            <div className="text-[10px] text-slate-500">{py.method || 'Cash'} • {py.paidAt ? new Date(py.paidAt).toLocaleString() : ''}</div>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => handlePrintPaymentSlip(s, py, p)}
                                            className="h-8 w-8 rounded-lg border border-slate-200 inline-flex items-center justify-center text-slate-700 hover:bg-slate-50"
                                            title="Print Slip"
                                          >
                                            <FiPrinter className="w-4 h-4" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-xs text-slate-500">No payments.</div>
                                  )}
                                </div>
                              ) : null}
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                              <button
                                type="button"
                                onClick={() => togglePhotos(s._id)}
                                className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-50"
                              >
                                <div className="text-xs font-bold text-slate-700 flex items-center gap-2">
                                  <FiImage className="text-slate-400" /> Photos (Before / After)
                                </div>
                                <div className="text-xs text-slate-500">{(s?.photos?.before?.data || s?.photos?.after?.data) ? '2' : '0'} image(s)</div>
                              </button>
                              {expandedPhotos[s._id] ? (
                                <div className="border-t border-slate-100 px-3 py-3">
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <div className="text-[10px] font-extrabold text-slate-400 uppercase">Before</div>
                                      <div className="aspect-square rounded-xl border border-slate-200 bg-slate-50 overflow-hidden relative">
                                        {s?.photos?.before?.data ? (
                                          <>
                                            <img
                                              src={`data:${s.photos.before.contentType || 'image/jpeg'};base64,${s.photos.before.data}`}
                                              alt="Before"
                                              className="w-full h-full object-cover"
                                            />
                                            <div className="absolute top-2 right-2 flex gap-2">
                                              <button
                                                type="button"
                                                title="Download"
                                                onClick={() => downloadDataUrl(`data:${s.photos.before.contentType || 'image/jpeg'};base64,${s.photos.before.data}`, `before-${String(s._id).slice(-6)}.jpg`)}
                                                className="h-8 w-8 rounded-lg bg-white/90 border border-slate-200 inline-flex items-center justify-center text-slate-700"
                                              >
                                                <FiDownload className="w-4 h-4" />
                                              </button>
                                              <label
                                                title="Update"
                                                className={`h-8 w-8 rounded-lg bg-white/90 border border-slate-200 inline-flex items-center justify-center text-slate-700 ${uploadingPhoto ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
                                              >
                                                <FiEdit2 className="w-4 h-4" />
                                                <input
                                                  type="file"
                                                  accept="image/*"
                                                  className="hidden"
                                                  disabled={uploadingPhoto}
                                                  onChange={(e) => handlePhotoUpload(s._id, 'before', e.target.files?.[0])}
                                                />
                                              </label>
                                              <button
                                                type="button"
                                                title="Delete"
                                                onClick={() => handlePhotoDelete(s._id, 'before')}
                                                className="h-8 w-8 rounded-lg bg-white/90 border border-slate-200 inline-flex items-center justify-center text-red-600"
                                              >
                                                <FiTrash2 className="w-4 h-4" />
                                              </button>
                                            </div>
                                          </>
                                        ) : (
                                          <label className="absolute inset-0 flex flex-col items-center justify-center gap-2 cursor-pointer">
                                            <FiUpload className="w-5 h-5 text-slate-300" />
                                            <div className="text-[10px] font-bold text-slate-400">Upload</div>
                                            <input
                                              type="file"
                                              accept="image/*"
                                              className="hidden"
                                              disabled={uploadingPhoto}
                                              onChange={(e) => handlePhotoUpload(s._id, 'before', e.target.files?.[0])}
                                            />
                                          </label>
                                        )}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] font-extrabold text-slate-400 uppercase">After</div>
                                      <div className="aspect-square rounded-xl border border-slate-200 bg-slate-50 overflow-hidden relative">
                                        {s?.photos?.after?.data ? (
                                          <>
                                            <img
                                              src={`data:${s.photos.after.contentType || 'image/jpeg'};base64,${s.photos.after.data}`}
                                              alt="After"
                                              className="w-full h-full object-cover"
                                            />
                                            <div className="absolute top-2 right-2 flex gap-2">
                                              <button
                                                type="button"
                                                title="Download"
                                                onClick={() => downloadDataUrl(`data:${s.photos.after.contentType || 'image/jpeg'};base64,${s.photos.after.data}`, `after-${String(s._id).slice(-6)}.jpg`)}
                                                className="h-8 w-8 rounded-lg bg-white/90 border border-slate-200 inline-flex items-center justify-center text-slate-700"
                                              >
                                                <FiDownload className="w-4 h-4" />
                                              </button>
                                              <label
                                                title="Update"
                                                className={`h-8 w-8 rounded-lg bg-white/90 border border-slate-200 inline-flex items-center justify-center text-slate-700 ${uploadingPhoto ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
                                              >
                                                <FiEdit2 className="w-4 h-4" />
                                                <input
                                                  type="file"
                                                  accept="image/*"
                                                  className="hidden"
                                                  disabled={uploadingPhoto}
                                                  onChange={(e) => handlePhotoUpload(s._id, 'after', e.target.files?.[0])}
                                                />
                                              </label>
                                              <button
                                                type="button"
                                                title="Delete"
                                                onClick={() => handlePhotoDelete(s._id, 'after')}
                                                className="h-8 w-8 rounded-lg bg-white/90 border border-slate-200 inline-flex items-center justify-center text-red-600"
                                              >
                                                <FiTrash2 className="w-4 h-4" />
                                              </button>
                                            </div>
                                          </>
                                        ) : (
                                          <label className="absolute inset-0 flex flex-col items-center justify-center gap-2 cursor-pointer">
                                            <FiUpload className="w-5 h-5 text-slate-300" />
                                            <div className="text-[10px] font-bold text-slate-400">Upload</div>
                                            <input
                                              type="file"
                                              accept="image/*"
                                              className="hidden"
                                              disabled={uploadingPhoto}
                                              onChange={(e) => handlePhotoUpload(s._id, 'after', e.target.files?.[0])}
                                            />
                                          </label>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      )
                      })
                    })()}
                  </div>
                </div>
              ))}

              {!loading && visiblePlans.length === 0 ? (
                <div className="text-sm text-slate-500">No records found.</div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="font-bold text-slate-900 mb-3">Patient Details</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-3"><span className="text-slate-500">Pet Name</span><span className="font-semibold text-slate-800">{pet.petName || '—'}</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-500">Pet ID</span><span className="font-semibold text-slate-800">{pet.id || petId}</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-500">Phone</span><span className="font-semibold text-slate-800">{pet.ownerContact || '—'}</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-500">Gender</span><span className="font-semibold text-slate-800">{pet.gender || '—'}</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-500">Age</span><span className="font-semibold text-slate-800">{pet.age || '—'}</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-500">Address</span><span className="font-semibold text-slate-800">{pet.ownerAddress || '—'}</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-500">Owner</span><span className="font-semibold text-slate-800">{pet.ownerName || '—'}</span></div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="font-bold text-slate-900 mb-3">Owner Details</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-3"><span className="text-slate-500">Owner Name</span><span className="font-semibold text-slate-800">{pet.ownerName || '—'}</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-500">Contact</span><span className="font-semibold text-slate-800">{pet.ownerContact || '—'}</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-500">Client ID</span><span className="font-semibold text-slate-800">{pet.clientId || '—'}</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-500">Address</span><span className="font-semibold text-slate-800">{pet.ownerAddress || '—'}</span></div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="font-bold text-slate-900 mb-3">Billing</div>
            <div className="text-sm text-slate-600">Remaining Dues</div>
            <div className="text-xl font-extrabold text-red-600">{money(overallDue)}</div>

            <div className="mt-3">
              <div className="text-xs font-bold text-slate-500 mb-2">Payment History</div>
              {allPayments.length ? (
                <div className="max-h-56 overflow-y-auto space-y-2">
                  {allPayments.map((py, idx) => (
                    <div key={idx} className="rounded-lg border border-slate-100 bg-slate-50 p-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800">Rs {Number(py.amount || 0).toLocaleString()}</div>
                        <div className="text-[10px] text-slate-500">Session: {Number(py.sessionNo || 1)}</div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {py.procedureName || 'Procedure'} • Session {Number(py.sessionNo || 1)} • {py.method || 'Cash'}
                        </div>
                        <div className="text-[10px] text-slate-400">{py.paidAt ? new Date(py.paidAt).toLocaleString() : ''}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const plan = plans.find(p => String(p._id) === String(py.planId))
                          const session = (plan?.sessions || []).find(s => String(s._id) === String(py.sessionId))
                          if (session && plan) handlePrintPaymentSlip(session, py, plan)
                        }}
                        className="h-8 w-8 rounded-lg border border-slate-200 inline-flex items-center justify-center text-slate-700 hover:bg-white"
                        title="Print Slip"
                      >
                        <FiPrinter className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-500">No payments.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-[520px] max-w-full">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="font-bold text-slate-900">Add Session</div>
              <button type="button" onClick={closeAddSession} className="h-9 px-3 rounded-xl border border-slate-200 text-sm font-semibold">Close</button>
            </div>
            <div className="p-5 space-y-3">
              {addError ? (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{addError}</div>
              ) : null}

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Main Category</label>
                <select
                  value={addMainCategory}
                  onChange={(e) => setAddMainCategory(String(e.target.value || ''))}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200"
                  disabled={catalogLoading}
                >
                  <option value="">Select main category</option>
                  {mainCategoryOptions.map((mc) => (
                    <option key={mc} value={mc}>{mc}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Sub-Category</label>
                <select
                  value={addSubCategory}
                  onChange={(e) => setAddSubCategory(String(e.target.value || ''))}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200"
                  disabled={catalogLoading}
                >
                  <option value="">Select sub-category</option>
                  {subCategoryOptions.map((sc) => (
                    <option key={sc} value={sc}>{sc}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Procedure</label>
                <select
                  value={addProcedure}
                  onChange={(e) => setAddProcedure(String(e.target.value || ''))}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200"
                  disabled={catalogLoading}
                >
                  <option value="">Select procedure</option>
                  {procedureOptions.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Date</label>
                  <input
                    type="date"
                    value={addDate}
                    onChange={(e) => setAddDate(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Time</label>
                  <input
                    type="time"
                    value={addTime}
                    onChange={(e) => setAddTime(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={addSaving}
                onClick={submitAddSession}
                className="w-full h-11 rounded-xl bg-emerald-600 text-white font-extrabold disabled:opacity-50"
              >
                {addSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {payOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-[420px] max-w-full">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="font-bold text-slate-900">Pay Bill</div>
              <button type="button" onClick={closePay} className="h-9 px-3 rounded-xl border border-slate-200 text-sm font-semibold">Close</button>
            </div>
            <div className="p-5 space-y-4">
              {payError ? (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{payError}</div>
              ) : null}
              <div className="text-sm text-slate-600">
                Due:{' '}
                <span className="font-bold text-slate-900">
                  {(() => {
                    const pid = String(paySession?.planId || '').trim()
                    const plan = plans.find(p => String(p._id) === pid)
                    const planTotal = (plan?.sessions || []).reduce((sum, ss) => sum + Number(ss?.totalAmount || 0), 0)
                    const planPaid = (plan?.sessions || []).reduce((sum, ss) => sum + Number(ss?.paidAmount || 0), 0)
                    return money(Math.max(0, planTotal - planPaid))
                  })()}
                </span>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Pay Amount</label>
                <input
                  type="number"
                  min={0}
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value || 0))}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Method</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(String(e.target.value || 'Cash'))}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200"
                >
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Online">Online</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={closePay} className="h-10 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700">Cancel</button>
                <button
                  type="button"
                  disabled={paySaving}
                  onClick={() => submitPay(false)}
                  className="h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-bold disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  disabled={paySaving}
                  onClick={() => submitPay(true)}
                  className="h-10 px-4 rounded-xl bg-emerald-600 text-white text-sm font-extrabold disabled:opacity-50 inline-flex items-center gap-2"
                >
                  <FiPrinter />
                  Save & Print
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-[420px] max-w-full">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="font-bold text-slate-900">Slip Preview</div>
              <button type="button" onClick={() => setShowReceiptModal(false)} className="text-slate-500 hover:text-slate-700"><FiX /></button>
            </div>
            <div className="p-4 overflow-auto max-h-[70vh]">
              <iframe title="receipt-preview" className="w-full h-[60vh] border border-slate-200 rounded-lg" srcDoc={buildSlipHTML(printReceipt || {})} />
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  try {
                    if (printReceipt) printThermalSlip(printReceipt)
                  } catch {}
                  setShowReceiptModal(false)
                }}
                className="h-10 px-4 rounded-xl bg-emerald-600 text-white text-sm font-bold inline-flex items-center gap-2"
              >
                <FiPrinter /> Print
              </button>
            </div>
          </div>
        </div>
      )}

      {assignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-[420px] max-w-full">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="font-bold text-slate-900">Assign Appointment</div>
              <button type="button" onClick={closeAssign} className="text-slate-500 hover:text-slate-700"><FiX /></button>
            </div>
            <div className="p-5 space-y-4">
              {assignError ? (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{assignError}</div>
              ) : null}

              <div>
                <div className="text-xs font-bold text-slate-600 mb-1">Date</div>
                <input
                  type="date"
                  value={assignDate}
                  onChange={(e) => setAssignDate(String(e.target.value || ''))}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200"
                />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-600 mb-1">Time</div>
                <input
                  type="time"
                  value={assignTime}
                  onChange={(e) => setAssignTime(String(e.target.value || ''))}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={closeAssign} className="h-10 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700">Cancel</button>
                <button
                  type="button"
                  disabled={assignSaving}
                  onClick={submitAssign}
                  className="h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-extrabold disabled:opacity-50"
                >
                  {assignSaving ? 'Saving...' : 'Assign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-[420px] max-w-full">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="font-bold text-slate-900">Confirm</div>
              <button type="button" onClick={closeConfirm} className="h-9 px-3 rounded-xl border border-slate-200 text-sm font-semibold">Close</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-sm text-slate-700">
                {confirmKind === 'session'
                  ? `Complete Session ${Number(confirmSession?.sessionNo || 0) || ''}?`
                  : 'Complete this procedure?'}
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={closeConfirm} className="h-10 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700">Cancel</button>
                <button type="button" onClick={confirmComplete} className="h-10 px-4 rounded-xl bg-emerald-600 text-white text-sm font-extrabold">Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl z-[9999] text-sm font-extrabold">
          {toast}
        </div>
      )}
    </div>
  )
}
