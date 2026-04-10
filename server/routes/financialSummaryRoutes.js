import express from 'express'
import Pet from '../models/Pet.js'
import PharmacySale from '../models/PharmacySale.js'
import ProcedureRecord from '../models/ProcedureRecord.js'
import LabReport from '../models/LabReport.js'
import RadiologyReport from '../models/RadiologyReport.js'
import Sale from '../models/Sale.js'
import PharmacyDue from '../models/PharmacyDue.js'
import Financial from '../models/Financial.js'

const router = express.Router()

const norm = (v) => String(v || '').trim()
const toNum = (v) => {
  if (v == null) return 0
  const n = typeof v === 'string' ? Number(v.replace(/,/g, '')) : Number(v)
  return Number.isNaN(n) ? 0 : n
}

async function aggregateForClient(clientIdRaw) {
  const clientId = norm(clientIdRaw)
  const pets = await Pet.find({ $or: [{ clientId }, { 'details.owner.clientId': clientId }] }).sort({ createdAt: -1 })
  const petById = new Map()
  const petByName = new Map()
  pets.forEach(p => {
    const pid = norm(p.id || p._id)
    petById.set(pid, p)
    const key = `${norm(p.petName)}|${norm(p.ownerName || p.details?.owner?.fullName || '')}`
    if (key.trim()) petByName.set(key, p)
  })
  const petIds = Array.from(petById.keys())

  const [sales, procs, labs, radios, shop, dueRow, fin] = await Promise.all([
    PharmacySale.find({ clientId }).sort({ createdAt: -1 }),
    ProcedureRecord.find({ clientId }).sort({ createdAt: -1 }),
    petIds.length ? LabReport.find({ petId: { $in: petIds } }).sort({ createdAt: -1 }) : [],
    petIds.length ? RadiologyReport.find({ petId: { $in: petIds } }).sort({ createdAt: -1 }) : [],
    Sale.find({ customerId: clientId }).sort({ createdAt: -1 }),
    PharmacyDue.findOne({ clientId }),
    Financial.find({ type: 'Income', category: /consult/i, petId: { $in: petIds } }).sort({ date: -1 })
  ])

  const modules = {
    pharmacy: { billed: 0, received: 0, pending: 0, invoices: 0 },
    procedures: { billed: 0, received: 0, pending: 0, invoices: 0 },
    lab: { billed: 0, received: 0, pending: 0, invoices: 0 },
    radiology: { billed: 0, received: 0, pending: 0, invoices: 0 },
    petShop: { billed: 0, received: 0, pending: 0, invoices: 0 },
    consultant: { amount: 0, paidCount: 0 }
  }

  // Totals imported via Excel as opening balances should NOT be attributed to any module.
  // Accumulate them separately and merge only into overall totals at the end.
  const imported = { billed: 0, received: 0, pending: 0 }

  const perPet = {}
  const ensurePet = (p) => {
    const id = norm(p?.id || p?._id)
    if (!id) return null
    if (!perPet[id]) {
      perPet[id] = {
        petId: id,
        petName: p.petName,
        ownerName: p.ownerName || p.details?.owner?.fullName || '',
        modules: {
          pharmacy: { billed: 0, received: 0, pending: 0, invoices: 0 },
          procedures: { billed: 0, received: 0, pending: 0, invoices: 0 },
          lab: { billed: 0, received: 0, pending: 0, invoices: 0 },
          radiology: { billed: 0, received: 0, pending: 0, invoices: 0 },
          petShop: { billed: 0, received: 0, pending: 0, invoices: 0 },
          consultant: { amount: 0, paid: false, date: '' }
        },
        totals: { billed: 0, received: 0, pending: 0 }
      }
    }
    return perPet[id]
  }

  const entries = []
  const consultPaidByPet = new Set()
  let lastPayment = null
  const updateLast = (d, amt, source, refId, petId) => {
    try {
      if (!d) return
      const date = new Date(d)
      if (isNaN(date.getTime())) return
      const ts = date.getTime()
      const cur = lastPayment ? new Date(lastPayment.date).getTime() : 0
      if (!lastPayment || ts > cur) lastPayment = { date, amount: toNum(amt), source, refId, petId }
    } catch {}
  }

  // Pharmacy
  sales.forEach(s => {
    const billed = toNum(s.totalAmount ?? (toNum(s.subtotal) - toNum(s.discount)))
    const received = toNum(s.receivedAmount != null ? s.receivedAmount : billed)
    const pending = Math.max(0, billed - received)
    modules.pharmacy.billed += billed
    modules.pharmacy.received += received
    modules.pharmacy.pending += pending
    modules.pharmacy.invoices += 1

    const p = s.patientId ? petById.get(norm(s.patientId)) : petByName.get(`${norm(s.petName)}|${norm(s.customerName)}`)
    if (p) {
      const slot = ensurePet(p)
      slot.modules.pharmacy.billed += billed
      slot.modules.pharmacy.received += received
      slot.modules.pharmacy.pending += pending
      slot.modules.pharmacy.invoices += 1
      slot.totals.billed += billed
      slot.totals.received += received
      slot.totals.pending += pending
    }

    if (received > 0) updateLast(s.createdAt, received, 'Pharmacy', s._id || s.id, p ? norm(p.id || p._id) : undefined)
    entries.push({ type: 'Pharmacy', id: s._id || s.id, date: s.createdAt, amount: billed, received, pending, petId: p ? norm(p.id || p._id) : '', petName: p?.petName || s.petName || '' , mode: s.paymentMethod || '—' })
  })

  // Helper: detect imported opening balances (Excel backfill) that should not map to any module
  const isImportedOpening = (rec) => {
    try {
      if (String(rec?.createdBy || '').toLowerCase() === 'import') return true
      const note = String(rec?.notes || '').toLowerCase()
      if (note.includes('import')) return true
      if (Array.isArray(rec?.procedures)) {
        for (const it of rec.procedures) {
          const mc = String(it?.mainCategory || '').toLowerCase()
          const sc = String(it?.subCategory || '').toLowerCase()
          if (mc === 'imported' || sc === 'opening') return true
        }
      }
    } catch {}
    return false
  }

  // Procedures
  procs.forEach(p => {
    const gt = toNum(p.grandTotal ?? (toNum(p.subtotal) + toNum(p.previousDues)))
    const recv = (p.receivedAmount != null) ? toNum(p.receivedAmount) : (p.receivable != null ? Math.max(0, gt - toNum(p.receivable)) : 0)
    const due = (p.receivable != null) ? toNum(p.receivable) : Math.max(0, gt - recv)

    // If this is an imported opening balance, contribute to overall totals only
    if (isImportedOpening(p)) {
      imported.billed += gt
      imported.received += recv
      imported.pending += due
      return
    }

    modules.procedures.billed += gt
    modules.procedures.received += recv
    modules.procedures.pending += due
    modules.procedures.invoices += 1

    const pet = petById.get(norm(p.petId)) || petByName.get(`${norm(p.petName)}|${norm(p.ownerName)}`)
    if (pet) {
      const slot = ensurePet(pet)
      slot.modules.procedures.billed += gt
      slot.modules.procedures.received += recv
      slot.modules.procedures.pending += due
      slot.modules.procedures.invoices += 1
      slot.totals.billed += gt
      slot.totals.received += recv
      slot.totals.pending += due
    }

    if (recv > 0) updateLast(p.createdAt, recv, 'Procedure', p._id || p.id, pet ? norm(pet.id || pet._id) : undefined)
    entries.push({ type: 'Procedure', id: p._id || p.id, date: p.createdAt, amount: gt, received: recv, pending: due, petId: pet ? norm(pet.id || pet._id) : '', petName: pet?.petName || p.petName || '', mode: p.paymentMethod || '—' })
  })

  // Lab
  labs.forEach(r => {
    const amt = toNum(r.amount)
    const paid = (r.paymentStatus === 'Paid') ? amt : 0
    const pending = (r.paymentStatus === 'Paid') ? 0 : amt
    modules.lab.billed += amt
    modules.lab.received += paid
    modules.lab.pending += pending
    modules.lab.invoices += 1

    const pet = petById.get(norm(r.petId)) || petByName.get(`${norm(r.petName)}|${norm(r.ownerName)}`)
    if (pet) {
      const slot = ensurePet(pet)
      slot.modules.lab.billed += amt
      slot.modules.lab.received += paid
      slot.modules.lab.pending += pending
      slot.modules.lab.invoices += 1
      slot.totals.billed += amt
      slot.totals.received += paid
      slot.totals.pending += pending
    }

    if (paid > 0) updateLast(r.reportDate || r.createdAt, paid, 'Lab', r._id || r.id, pet ? norm(pet.id || pet._id) : undefined)
    entries.push({ type: 'Lab', id: r._id || r.id, date: r.reportDate || r.createdAt, amount: amt, received: paid, pending, petId: pet ? norm(pet.id || pet._id) : '', petName: pet?.petName || r.petName || '', mode: r.paymentMethod || '—' })
  })

  // Radiology
  radios.forEach(r => {
    const amt = toNum(r.amount)
    const paid = (r.paymentStatus === 'Paid') ? amt : 0
    const pending = (r.paymentStatus === 'Paid') ? 0 : amt
    modules.radiology.billed += amt
    modules.radiology.received += paid
    modules.radiology.pending += pending
    modules.radiology.invoices += 1

    const pet = petById.get(norm(r.petId)) || petByName.get(`${norm(r.petName)}|${norm(r.ownerName)}`)
    if (pet) {
      const slot = ensurePet(pet)
      slot.modules.radiology.billed += amt
      slot.modules.radiology.received += paid
      slot.modules.radiology.pending += pending
      slot.modules.radiology.invoices += 1
      slot.totals.billed += amt
      slot.totals.received += paid
      slot.totals.pending += pending
    }

    if (paid > 0) updateLast(r.reportDate || r.createdAt, paid, 'Radiology', r._id || r.id, pet ? norm(pet.id || pet._id) : undefined)
    entries.push({ type: 'Radiology', id: r._id || r.id, date: r.reportDate || r.createdAt, amount: amt, received: paid, pending, petId: pet ? norm(pet.id || pet._id) : '', petName: pet?.petName || r.petName || '', mode: r.paymentMethod || '—' })
  })

  // Pet Shop
  shop.forEach(s => {
    const billed = toNum(s.totalAmount)
    const received = toNum(s.receivedAmount != null ? s.receivedAmount : billed)
    const pending = Math.max(0, billed - received)
    modules.petShop.billed += billed
    modules.petShop.received += received
    modules.petShop.pending += pending
    modules.petShop.invoices += 1

    if (received > 0) updateLast(s.createdAt, received, 'Pet Shop', s._id || s.id)
    entries.push({ type: 'Pet Shop', id: s._id || s.id, date: s.createdAt, amount: billed, received, pending, petId: '', petName: '', mode: s.paymentMethod || '—' })
  })

  // Consultant (from Financial records and Pet registrations)
  let consultantTotal = 0
  fin.forEach(f => {
    consultantTotal += toNum(f.amount)
    const pet = petById.get(norm(f.petId))
    if (pet) {
      const slot = ensurePet(pet)
      slot.modules.consultant.amount += toNum(f.amount)
      slot.modules.consultant.paid = true
      slot.modules.consultant.date = f.date || f.createdAt
      updateLast(f.date || f.createdAt, toNum(f.amount), 'Consultation', f._id || f.id, norm(pet.id || pet._id))
      // Also surface consultation as a ledger entry for UI consistency
      const pid = norm(pet.id || pet._id)
      entries.push({ type: 'Consultation', id: f._id || f.id, date: f.date || f.createdAt, amount: toNum(f.amount), received: toNum(f.amount), pending: 0, petId: pid, petName: pet.petName || '', mode: f.paymentMethod || '—' })
      consultPaidByPet.add(pid)
    }
  })

  // Fallback via pet registration fees
  pets.forEach(p => {
    const fee = toNum(p.details?.clinic?.consultantFees)
    if (fee > 0) {
      const pid = norm(p.id || p._id)
      if (!consultPaidByPet.has(pid)) {
        consultantTotal += fee
        const slot = ensurePet(p)
        slot.modules.consultant.amount += fee
        slot.modules.consultant.paid = true
        slot.modules.consultant.date = p.details?.clinic?.dateOfRegistration || p.createdAt
        updateLast(slot.modules.consultant.date, fee, 'Consultation', p._id || p.id, pid)
        // Add a best-effort entry so UIs can reflect Paid immediately
        entries.push({ type: 'Consultation', id: p._id || p.id, date: slot.modules.consultant.date, amount: fee, received: fee, pending: 0, petId: pid, petName: p.petName || '', mode: '—' })
        consultPaidByPet.add(pid)
      }
    }
  })
  modules.consultant.amount = consultantTotal
  modules.consultant.paidCount = Object.values(perPet).filter(s => s.modules.consultant.paid).length

  const currentDue = toNum(dueRow?.previousDue)

  const totals = {
    totalBilled: modules.pharmacy.billed + modules.procedures.billed + modules.lab.billed + modules.radiology.billed + modules.petShop.billed + modules.consultant.amount + imported.billed,
    totalReceived: modules.pharmacy.received + modules.procedures.received + modules.lab.received + modules.radiology.received + modules.petShop.received + modules.consultant.amount + imported.received,
    totalPending: modules.pharmacy.pending + modules.procedures.pending + modules.lab.pending + modules.radiology.pending + modules.petShop.pending + imported.pending,
    totalInvoices: modules.pharmacy.invoices + modules.procedures.invoices + modules.lab.invoices + modules.radiology.invoices + modules.petShop.invoices,
    lastPayment: lastPayment,
    currentDue
  }

  return {
    clientId,
    pets: Object.values(perPet),
    modules,
    totals,
    entries: entries.sort((a,b)=> new Date(b.date||0) - new Date(a.date||0))
  }
}

router.get('/client/:clientId', async (req, res) => {
  try {
    const data = await aggregateForClient(req.params.clientId)
    res.json({ success: true, data })
  } catch (e) {
    console.error('financial-summary error', e)
    res.status(500).json({ success: false, message: e?.message || 'Failed to build financial summary' })
  }
})

export default router
