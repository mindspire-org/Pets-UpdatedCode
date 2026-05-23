export const normalizeDate = (v) => {
  if (!v) return null
  const d = new Date(v)
  return Number.isFinite(d.getTime()) ? d : null
}

export const getShotDueDate = (shot) => {
  if (!shot) return null
  return normalizeDate(shot.dateGiven || shot.date || shot.when)
}

export const buildPetsIndex = (pets) => {
  const idx = new Map()
  ;(Array.isArray(pets) ? pets : []).forEach((p) => {
    const id = p?.id || p?._id || p?.petId
    if (id) idx.set(String(id), p)
  })
  return idx
}

export const extractVaccineShotsFromPrescriptions = (prescriptions, petsIndex) => {
  const out = []
  ;(Array.isArray(prescriptions) ? prescriptions : []).forEach((prx) => {
    const prxId = prx?.id || prx?._id || ''
    const patient = prx?.patient || {}
    const patientId = String(patient?.id || '').trim()
    const pet = patientId ? petsIndex?.get?.(patientId) : null

    const ownerPhone =
      pet?.ownerPhone ||
      pet?.details?.owner?.phone ||
      pet?.details?.owner?.contact ||
      pet?.details?.owner?.mobile ||
      pet?.phone ||
      ''

    const items = Array.isArray(prx?.items) ? prx.items : []
    items
      .filter((x) => !!x?.isVaccine)
      .forEach((v) => {
        const shots = Array.isArray(v?.shots) ? v.shots : []
        shots.forEach((s, idx) => {
          const due = getShotDueDate(s)
          if (!due) return
          out.push({
            key: `prx:${prxId}:vac:${v?.name || 'vaccine'}:shot:${idx}:${due.toISOString()}`,
            prescriptionId: prxId,
            doctorName: prx?.doctor?.name || prx?.doctor?.username || '',
            patientId,
            petName: patient?.petName || pet?.petName || '',
            ownerName: patient?.ownerName || pet?.ownerName || pet?.details?.owner?.fullName || '',
            ownerPhone,
            vaccineName: v?.name || '',
            instructions: v?.instructions || '',
            shotStage: s?.shotStage || `Shot ${idx + 1}`,
            dueDate: due,
            status: s?.status || 'Pending',
            vaccineIndex: v.index || 0, // helpful for finding it again
            shotIndex: idx,
            rawShot: s,
          })
        })
      })
  })

  out.sort((a, b) => a.dueDate - b.dueDate)
  return out
}

export const getReminderWindow = (now = new Date()) => {
  const start = new Date(now)
  const end = new Date(now)
  end.setDate(end.getDate() + 2)
  return { start, end }
}

export const filterShotsNeedingReminder = (shots, now = new Date()) => {
  const { start, end } = getReminderWindow(now)
  return (Array.isArray(shots) ? shots : []).filter((s) => {
    // Only remind for Pending shots
    if (s?.status && s.status !== 'Pending') return false

    const t = s?.dueDate?.getTime?.()
    if (!Number.isFinite(t)) return false
    return t >= start.getTime() && t <= end.getTime()
  })
}

const lastNotifiedKey = 'reception_shot_reminder_last'

export const shouldNotifyShot = (shotKey, now = Date.now()) => {
  try {
    const raw = localStorage.getItem(lastNotifiedKey)
    const map = raw ? JSON.parse(raw) : {}
    const last = map?.[shotKey]
    if (!last) return true
    return now - Number(last) >= 3 * 60 * 60 * 1000
  } catch {
    return true
  }
}

export const markNotifiedShot = (shotKey, now = Date.now()) => {
  try {
    const raw = localStorage.getItem(lastNotifiedKey)
    const map = raw ? JSON.parse(raw) : {}
    map[shotKey] = now
    localStorage.setItem(lastNotifiedKey, JSON.stringify(map))
  } catch {}
}

/**
 * Updates the status of a specific shot within a prescription.
 * @param {Object} prescriptionsAPI - The API object for prescriptions
 * @param {string} prxId - The prescription ID
 * @param {string} vaccineName - The name of the vaccine
 * @param {number} shotIndex - The index of the shot in the vaccine's shots array
 * @param {string} newStatus - The new status (Pending, Completed, Cancelled)
 */
export const updateShotStatus = async (prescriptionsAPI, prxId, vaccineName, shotIndex, newStatus) => {
  try {
    const res = await prescriptionsAPI.getById(prxId)
    const prx = res?.data
    if (!prx) throw new Error('Prescription not found')

    const items = Array.isArray(prx.items) ? prx.items : []
    let updated = false

    items.forEach((item) => {
      if (item.isVaccine && item.name === vaccineName) {
        if (Array.isArray(item.shots) && item.shots[shotIndex]) {
          item.shots[shotIndex].status = newStatus
          updated = true
        }
      }
    })

    if (!updated) throw new Error('Vaccine or shot not found in prescription')

    await prescriptionsAPI.update(prxId, { items })
    return true
  } catch (e) {
    console.error('Failed to update shot status:', e)
    throw e
  }
}
