import React, { useState, useEffect } from 'react'

export default function PrintPrescription({
  doc,
  settings,
  signature,
  fallbackNotes,
  fallbackPatient,
  onClose,
  onAfterPrint,
  autoPrint = false,
}){
  const [isPrinting, setIsPrinting] = useState(false)

  useEffect(() => {
    if (autoPrint && !isPrinting) {
      const t = setTimeout(() => handlePrint(), 400)
      return () => clearTimeout(t)
    }
  }, [autoPrint])
  const normalizeKey = (v) => String(v || '').toLowerCase().replace(/\s+/g, '').replace(/_/g, '')
  const isVaccineItem = (it) => {
    if (!it) return false
    if (it.isVaccine === true) return true
    // Legacy fallback: if it has a non-empty shots array with actual data, treat as vaccine
    if (Array.isArray(it.shots) && it.shots.length && it.shots.some(s => s?.dateGiven || s?.shotStage)) return true
    return false
  }
  const formatVaccineStage = (stage) => {
    const s = String(stage || '').trim().toLowerCase()
    if (!s) return ''
    if (s === '1st') return 'Shot 1'
    if (s === '2nd') return 'Shot 2'
    if (s === '3rd') return 'Shot 3'
    if (s === '4th') return 'Shot 4'
    if (s === 'annual booster') return 'Annual booster'
    return stage
  }
  const extractNum = (val) => {
    const m = String(val ?? '').match(/[-+]?[0-9]*\.?[0-9]+/)
    return m ? parseFloat(m[0]) : NaN
  }
  const dehyPct = (txt) => {
    const s = String(txt||'').toLowerCase()
    if (s.includes('>')) return 8
    const m = s.match(/([0-9]+(\.[0-9]+)?)\s*%?/)
    if (m) return parseFloat(m[1])
    if (s.includes('mild')) return 5
    if (s.includes('moderate')) return 7
    if (s.includes('normal')) return 0
    return NaN
  }
  const computeFluid = (pat) => {
    const w = extractNum(pat?.weightKg ?? pat?.weight ?? pat?.details?.weightKg)
    const p = dehyPct(pat?.dehydration ?? pat?.details?.dehydration)
    if (!Number.isFinite(w) || w<=0) return NaN
    if (!Number.isFinite(p)) return NaN
    return p * w * 10
  }

  const handlePrint = () => {
    if (isPrinting) return
    setIsPrinting(true)
    // Build deterministic HTML from props instead of cloning DOM
    const p0 = doc || {}
    const patient0 = { ...(fallbackPatient||{}), ...(p0.patient||{}) }
    const n0 = (()=>{
      const defN = { hx: [], oe: [], dx: [], advice: [], tests: [] }
      const fb = fallbackNotes || {}
      const dn = p0.notes || {}
      return {
        hx: Array.isArray(dn.hx)? dn.hx : Array.isArray(fb.hx)? fb.hx : defN.hx,
        oe: Array.isArray(dn.oe)? dn.oe : Array.isArray(fb.oe)? fb.oe : defN.oe,
        dx: Array.isArray(dn.dx)? dn.dx : Array.isArray(fb.dx)? fb.dx : defN.dx,
        advice: Array.isArray(dn.advice)? dn.advice : Array.isArray(fb.advice)? fb.advice : defN.advice,
        tests: Array.isArray(dn.tests)? dn.tests : Array.isArray(fb.tests)? fb.tests : defN.tests,
      }
    })()
    const esc = (v) => String(v==null?'':v)
      .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')
    const groupMapMed = {}
    const groupMapVac = {}
    ;(p0.items||[]).forEach(it=>{
      const key = it.condition || 'General'
      const target = isVaccineItem(it) ? groupMapVac : groupMapMed
      if(!target[key]) target[key]=[]
      target[key].push(it)
    })
    const groupKeysMed = Object.keys(groupMapMed)
    const groupKeysVac = Object.keys(groupMapVac)

    const renderGroupsHTML = (groupMap, groupKeys) => {
      return groupKeys.length ? groupKeys.map((k)=>{
        const rows = groupMap[k].map(x=>{
        let displayDose = x.dose || x.dosage || x.composition || ''
        try {
          // Fixed Dose: use the dose field directly without calculation
          if (x.doseType === 'Fixed Dose') {
            const doseNum = extractNum(x.dose)
            if (Number.isFinite(doseNum) && doseNum > 0) {
              displayDose = doseNum.toFixed(2)
            }
          } else {
            // Weight Based or legacy: calculate dose
            const fluid = computeFluid(patient0)
            const hasPos = (v) => { const n = extractNum(v); return Number.isFinite(n) && n>0 }
            const doseRateNum = extractNum(x.doseRate)
            const perMlNum = extractNum(x.perMl)
            const weightNum = extractNum(patient0?.weightKg ?? patient0?.weight ?? patient0?.details?.weightKg)
            if (x.useDehydration && Number.isFinite(fluid) && fluid > 0) {
              displayDose = fluid.toFixed(2)
            } else if (doseRateNum > 0 && perMlNum > 0 && weightNum > 0) {
              const calculated = (doseRateNum * weightNum) / perMlNum
              if (!isNaN(calculated) && calculated > 0) displayDose = calculated.toFixed(2)
            } else if (!hasPos(displayDose) && Number.isFinite(fluid) && fluid > 0) {
              displayDose = fluid.toFixed(2)
            }
          }
        } catch{}
        const amt = displayDose ? `${displayDose} ${esc(x.unit||'ml')}` : (x.unit ? `${esc(x.unit)}` : '—')
        return `
          <div class="print-medicine">
            <div style="display:grid;grid-template-columns:25% 1fr 12%;column-gap:8px;align-items:baseline;">
              <div class="text-slate-700">${esc(x.route||'')}</div>
              <div class="font-bold">${esc(x.name||'')}</div>
              <div class="text-right font-bold">${esc(x.perMl||'')}</div>
            </div>
            <div style="display:grid;grid-template-columns:25% 1fr 12%;column-gap:8px;font-size:11px;color:#000;">
              <div style="font-style:italic;">${esc(amt)}</div>
              <div style="font-style:italic;">${esc(x.instructions||'')}</div>
              <div></div>
            </div>
          </div>`
        }).join('')
        return `
          <div style="margin-bottom:10px;">
            ${k!=='General' ? `<div class="font-semibold" style="color:#000;margin-bottom:4px;">Condition: ${esc(k)}</div>`:''}
            <div style="padding-left:12px;">${rows}</div>
          </div>`
      }).join('') : ''
    }

    const medicinesHTML = renderGroupsHTML(groupMapMed, groupKeysMed)
    const renderVaccinesHTML = (groupMap, groupKeys) => {
      return groupKeys.length ? groupKeys.map((k)=>{
        const byName = {}
        ;(groupMap[k]||[]).forEach(it=>{
          const nk = normalizeKey(it?.name) || 'vaccine'
          if(!byName[nk]) byName[nk] = []
          byName[nk].push(it)
        })
        const nameKeys = Object.keys(byName)
        const blocks = nameKeys.map((nk)=>{
          const rows = byName[nk]
          const head = rows[0] || {}
          const route = esc(head.route || '')
          const name = esc(head.name || '')
          const instr = esc(head.instructions || '')

          const collectShots = () => {
            const shots = []
            rows.forEach((r)=>{
              if (Array.isArray(r?.shots) && r.shots.length) {
                r.shots.forEach(s => shots.push(s))
              } else if (r?.shotStage || r?.dateGiven || r?.nextDue || r?.vet) {
                shots.push({
                  shotStage: r.shotStage,
                  dateGiven: r.dateGiven,
                  nextDue: r.nextDue,
                  vet: r.vet,
                })
              }
            })
            return shots
          }

          const shots = collectShots().map((s, idx)=>{
            const stage = esc(formatVaccineStage(s?.shotStage || `Shot ${idx+1}`))
            const dt = esc(s?.dateGiven || '')
            return `
              <div style="display:grid;grid-template-columns: 1fr 120px;column-gap:8px;">
                <div style="font-weight:700;">${stage}</div>
                <div style="text-align:right;">${dt}</div>
              </div>`
          }).join('')

          return `
            <div style="margin-bottom:10px;">
              <div style="display:grid;grid-template-columns:25% 1fr;column-gap:8px;align-items:baseline;">
                <div class="text-slate-700">${route}</div>
                <div class="font-bold">${name}</div>
              </div>
              <div style="display:grid;grid-template-columns:25% 1fr;column-gap:8px;font-size:11px;color:#000;margin-top:2px;">
                <div></div>
                <div style="font-style:italic;">${instr}</div>
              </div>
              <div style="padding-left:25%;margin-top:4px;">${shots}</div>
            </div>`
        }).join('')

        return `
          <div style="margin-bottom:10px;">
            ${k!=='General' ? `<div class="font-semibold" style="color:#000;margin-bottom:4px;">Condition: ${esc(k)}</div>`:''}
            <div style="padding-left:12px;">${blocks}</div>
          </div>`
      }).join('') : ''
    }

    const vaccinesHTML = renderVaccinesHTML(groupMapVac, groupKeysVac)
    const itemsHTML = (medicinesHTML || vaccinesHTML) ? (`
      ${medicinesHTML || ''}
      ${vaccinesHTML ? `<div style="margin-top:10px;"></div>${vaccinesHTML}` : ''}
    `) : '<div style="color:#64748b;">No medicines.</div>'

    const content = `
      <div id="rx-print">
        <div class="print-header">
          <div class="print-header-layout">
            ${settings?.companyLogo ? `<img src="${esc(settings.companyLogo)}" alt="logo" class="print-logo-left"/>` : '<div style="width:80px"></div>'}
            <div class="print-header-center">
              <div class="hospital-name">${esc(settings?.companyName || 'Abbottabad Pet Hospital')}</div>
              <div style="font-size:11px;color:#b91c1c;font-weight:700;margin-top:2px;">Note: Not Valid For Court</div>
              ${settings?.address ? `<div style="font-size:11px;color:#000;margin-top:4px;">${esc(settings.address)}</div>`:''}
              ${settings?.phone ? `<div style="font-size:11px;color:#000;">${esc(settings.phone)}</div>`:''}
            </div>
            <div style="width:80px"></div>
          </div>
        </div>
        <div class="print-section">
          <div class="print-title">Patient Information</div>
          <div class="print-content print-patient">
            <div class="grid">
              <div><b>Pet ID:</b> ${esc(p0.patient?.id||'')}</div>
              <div><b>Pet:</b> ${esc(p0.patient?.petName||'')}</div>
              <div><b>Owner:</b> ${esc(p0.patient?.ownerName||'')}</div>
              <div><b>Age:</b> ${esc(p0.patient?.age||'')}</div>
              <div><b>Gender:</b> ${esc(p0.patient?.gender||'')}</div>
              <div><b>Breed:</b> ${esc(p0.patient?.breed||'')}</div>
            </div>
          </div>
        </div>
        <div class="print-section">
          <div class="print-title">Prescription</div>
          <div class="print-content print-rx">
            <div class="rx-columns">
              <div class="print-hx">
                <div style="margin-bottom:10px;padding-bottom:10px;border-bottom:2px solid #cbd5e1;">
                  <div class="font-semibold" style="margin-bottom:2px;">Weight (kg)</div>
                  <div style="color:#334155">${esc(patient0?.weightKg || patient0?.weight || patient0?.details?.weightKg || '—')}</div>
                  <div class="font-semibold" style="margin-top:6px; margin-bottom:2px;">Temp</div>
                  <div style="color:#334155">${(function(){ const t = (patient0?.tempF ?? patient0?.temp); return t!=null && t!=='' ? `${esc(t)} ${esc(patient0?.tempUnit || '°F')}` : '—' })()}</div>
                  <div class="font-semibold" style="margin-top:6px; margin-bottom:2px;">Dehydration</div>
                  <div style="color:#334155">${esc(patient0?.dehydration || patient0?.details?.dehydration || '—')}</div>
                </div>
                ${n0.hx?.length? (`<div class="font-semibold">Hx</div>` + n0.hx.map((t)=>`<div style=\"color:#334155\">- ${esc(t)}</div>`).join('')):''}
                ${n0.oe?.length? (`<div class="font-semibold" style=\"margin-top:6px\">O/E</div>` + n0.oe.map((t)=>`<div style=\"color:#334155\">- ${esc(t)}</div>`).join('')):''}
                ${n0.dx?.length? (`<div class="font-semibold" style=\"margin-top:6px\">Dx</div>` + n0.dx.map((t)=>`<div style=\"color:#334155\">- ${esc(t)}</div>`).join('')):''}
                ${n0.advice?.length? (`<div class=\"font-semibold\" style=\"margin-top:6px\">Advice</div>` + n0.advice.map((t)=>`<div style=\"color:#334155\">- ${esc(t)}</div>`).join('')):''}
                ${n0.tests?.length? (`<div class=\"font-semibold\" style=\"margin-top:6px\">Tests</div>` + n0.tests.map((t)=>`<div style=\"color:#334155\">- ${esc(t)}</div>`).join('')):''}
              </div>
              <div style="flex:1">
                <div class="font-bold" style="font-size:16px;margin-bottom:8px;">Rx</div>
                ${itemsHTML}
              </div>
            </div>
            <div class="print-signature" style="display:flex;justify-content:flex-end;">
              <div class="text-center">
                ${signature ? `<img src="${esc(signature)}" style="height:96px;object-fit:contain;display:block;margin:0 auto;"/>` : ''}
                <div class="font-semibold" style="margin-top:4px;">${(function(){ try{ const profile = JSON.parse(localStorage.getItem('doctor_profile')||'{}'); return esc(profile?.name || (p0.doctor?.name || p0.doctor?.username || 'Doctor')) }catch(e){return esc(p0.doctor?.name || p0.doctor?.username || 'Doctor')} })()}</div>
                <div style="font-size:11px;color:#000">Companion Animal Veterinarian</div>
                <div style="font-size:11px;color:#000">${esc(settings?.companyName || 'Pets Hospital')}</div>
                ${settings?.address ? `<div style="font-size:10px;color:#000;margin-top:2px;">${esc(settings.address)}</div>` : ''}
                ${settings?.phone ? `<div style="font-size:10px;color:#000;">${esc(settings.phone)}</div>` : ''}
              </div>
            </div>
          </div>
        </div>
      </div>`

    const css = `
      @page { size: A4; margin: 0; }
      html, body { width:210mm; height:297mm; margin:0; padding:0; }
      body { font-family: ui-sans-serif, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Noto Sans", "Liberation Sans", sans-serif; color:#000; }
      /* Root printable area */
      #rx-print { display:block !important; position: relative; margin: 0 auto; width:210mm; height:297mm; min-height:297mm; padding: 12mm; padding-bottom: 36mm; background:#ffffff; color:#0f172a; box-sizing: border-box; overflow: visible !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      #rx-print, #rx-print * { page-break-inside: avoid; break-inside: avoid; visibility: visible !important; }

      /* Header */
      #rx-print .print-header{ border-bottom:none; padding-bottom:4px; margin-bottom:8px; }
      #rx-print .print-header-layout{ display:grid; grid-template-columns: 80px 1fr 80px; align-items:center; gap:16px; min-height:64px; }
      #rx-print .print-header-center{ text-align:center; justify-self:center; width:max-content; margin:0; }
      #rx-print .hospital-name{ font-size:17px; font-weight:800; color:#000; white-space:nowrap; }
      #rx-print .print-logo-left{ max-height:64px; width:80px; object-fit:contain; justify-self:start; }
      #rx-print .print-header-spacer{ width:80px; }

      /* Card/sections */
      #rx-print .print-section{ border:none; border-radius:0; overflow:visible; margin-bottom:8px; }
      #rx-print .print-title{ padding:0 0 4px 0; font-weight:700; font-size:12px; color:#0f172a; }
      #rx-print .print-content{ padding:4px 0 6px 0; font-size:12px; }
      #rx-print .print-patient .grid{ display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); column-gap:16px; row-gap:8px; }

      /* Prescription area */
      #rx-print .print-rx{ font-size:12px; position:relative; padding-bottom:38mm; min-height:180mm; }
      #rx-print .rx-columns{ display:flex; gap:24px; position:relative; }
      #rx-print .print-hx{ width:140px; padding-right:12px; }
      /* Full-height divider between Hx and Rx columns */
      #rx-print .print-rx::after{ content:""; position:absolute; top:0; bottom:0; left:calc(140px + 24px); border-left:2px solid #000; }
      #rx-print .print-hx .font-semibold{ font-weight:600; }

      #rx-print .print-medicine{ border-bottom:none; padding-bottom:4px; margin-bottom:6px; }
      #rx-print .underline{ text-decoration: none; }
      #rx-print .text-right{ text-align:right; }
      #rx-print .text-center{ text-align:center; }
      #rx-print .font-semibold{ font-weight:700; }
      #rx-print .font-bold{ font-weight:800; }

      /* Signature/footer pinned to bottom */
      #rx-print .print-signature{ position:absolute; left:12mm; right:12mm; bottom:12mm; margin-top:0; }
      #rx-print .print-signature img{ max-height:38px; }
    `
    // Use origin-based base URL to avoid hash-router side effects
    const baseHref = (location.origin || '') + '/'
    // Only include our component CSS to prevent collisions with global print rules
    const html = `<!doctype html><html><head><meta charset="utf-8"/><base href="${baseHref}"><title>Prescription</title><style>${css}</style><style>@media print { html,body{margin:0!important;padding:0!important} }</style></head><body>${content}</body></html>`

    const finish = () => {
      try { onAfterPrint && onAfterPrint() } catch {}
      setIsPrinting(false)
    }

    try {
      if (window?.electronAPI?.printHTML) {
        window.electronAPI.printHTML(html, { printBackground: true, silent: false })
          .then(() => finish())
          .catch(() => finish())
        return
      }
    } catch (_) {}

    // Browser path: hidden iframe (no popup window)
    const iframe = document.createElement('iframe')
    iframe.setAttribute('style','position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;')
    document.body.appendChild(iframe)
    const iw = iframe.contentWindow
    const idoc = iw.document
    let wrote = false
    try { idoc.open(); idoc.write(html); idoc.close(); wrote = true } catch (e) { wrote = false }
    if (!wrote) {
      try {
        const url = 'data:text/html;charset=utf-8,' + encodeURIComponent(html)
        iw.location.replace(url)
      } catch (e) {
        try { document.body.removeChild(iframe) } catch {}
        setIsPrinting(false)
        return
      }
    }
    const finalize = () => { try { document.body.removeChild(iframe) } catch{}; finish() }
    if (iw) {
      iw.onafterprint = finalize
      const trigger = async () => {
        try {
          // Wait for fonts
          if (idoc.fonts && idoc.fonts.ready) { try { await idoc.fonts.ready } catch(_){} }
          // Wait for images
          const imgs = Array.from(idoc.images || [])
          await Promise.all(imgs.map(img => (img.complete? Promise.resolve() : new Promise(res=>{ img.onload=res; img.onerror=res })) ))
          const el = idoc.getElementById('rx-print');
          const tryPrint = (attempt=0) => {
            const ready = el && el.offsetHeight > 0 && el.getBoundingClientRect().height > 0;
            if (!ready && attempt < 20) return setTimeout(()=>tryPrint(attempt+1), 100);
            try { iw.focus(); } catch(e) {}
            setTimeout(() => { try { iw.print() } catch(e) {} }, 50)
          }
          tryPrint();
        } catch(e) {}
        setTimeout(finalize, 1500)
      }
      if (idoc && idoc.readyState === 'complete') trigger(); else iframe.onload = trigger
    } else {
      finalize()
    }
  }

  const p = doc || {}
  const patientMerge = { ...(fallbackPatient||{}), ...(p.patient||{}) }
  const notes = (()=>{
    const defN = { hx: [], oe: [], dx: [], advice: [], tests: [] }
    const fb = fallbackNotes || {}
    const dn = p.notes || {}
    return {
      hx: Array.isArray(dn.hx)? dn.hx : Array.isArray(fb.hx)? fb.hx : defN.hx,
      oe: Array.isArray(dn.oe)? dn.oe : Array.isArray(fb.oe)? fb.oe : defN.oe,
      dx: Array.isArray(dn.dx)? dn.dx : Array.isArray(fb.dx)? fb.dx : defN.dx,
      advice: Array.isArray(dn.advice)? dn.advice : Array.isArray(fb.advice)? fb.advice : defN.advice,
      tests: Array.isArray(dn.tests)? dn.tests : Array.isArray(fb.tests)? fb.tests : defN.tests,
    }
  })()

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3" onClick={()=> onClose && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl ring-1 ring-slate-200 max-h-[85vh] flex flex-col" onClick={(e)=>e.stopPropagation()}>
        {/* Preview-only: no print CSS here to avoid hiding content when printing top window */}
        <div id="rx-print" className="p-6 overflow-y-auto">
          <div className="pb-3 mb-3 print-header">
            <div className="print-header-layout" style={{display:'grid', gridTemplateColumns:'80px 1fr 80px', alignItems:'center', gap:'16px', minHeight:'64px'}}>
              {settings?.companyLogo ? (
                <img src={settings.companyLogo} alt="logo" className="h-16 print-logo-left" />
              ) : (
                <div className="print-header-spacer" />
              )}
              <div className="text-center print-header-center" style={{justifySelf:'center', width:'max-content'}}>
                <div className="text-xl font-bold text-sky-600 hospital-name">{settings?.companyName || 'Abbottabad Pet Hospital'}</div>
                <div className="text-xs font-semibold text-red-700 mt-1">Note: Not Valid For Court</div>
                {settings?.address && <div className="text-xs text-slate-600 mt-1">{settings.address}</div>}
                {settings?.phone && <div className="text-xs text-slate-600">{settings.phone}</div>}
              </div>
              <div className="print-header-spacer" />
            </div>
          </div>

          <div className="mb-3 print-section">
            <div className="px-0 py-0 font-semibold print-title">Patient Information</div>
            <div className="pt-1 text-sm print-content print-patient">
              <div className="grid grid-cols-3 gap-x-4 gap-y-2">
                <div><b>Pet ID:</b> {p.patient?.id||''}</div>
                <div><b>Pet:</b> {p.patient?.petName||''}</div>
                <div><b>Owner:</b> {p.patient?.ownerName||''}</div>
                <div><b>Age:</b> {p.patient?.age||''}</div>
                <div><b>Gender:</b> {p.patient?.gender||''}</div>
                <div><b>Breed:</b> {p.patient?.breed||''}</div>
              </div>
            </div>
          </div>

          <div className="print-section">
            <div className="px-0 py-0 font-semibold print-title">Prescription</div>
            <div className="pt-2 text-sm print-rx">
              <div className="flex gap-6 rx-columns">
                <div className="w-36 pr-4 print-hx">
                  <div className="mb-3 pb-2">
                    <div className="font-semibold mb-1">Weight (kg)</div>
                    <div className="text-slate-700">{patientMerge?.weightKg || patientMerge?.weight || patientMerge?.details?.weightKg || '—'}</div>
                    <div className="font-semibold mt-2 mb-1">Temp</div>
                    <div className="text-slate-700">{(patientMerge?.tempF ?? patientMerge?.temp) != null && (patientMerge?.tempF ?? patientMerge?.temp) !== '' ? `${patientMerge?.tempF ?? patientMerge?.temp} ${patientMerge?.tempUnit || '°F'}` : '—'}</div>
                    <div className="font-semibold mt-2 mb-1">Dehydration</div>
                    <div className="text-slate-700">{patientMerge?.dehydration || patientMerge?.details?.dehydration || '—'}</div>
                  </div>
                  {(notes.hx?.length>0) && (<>
                    <div className="font-semibold">Hx</div>
                    {notes.hx.map((t,i)=> (<div key={`hx${i}`} className="text-slate-700">- {t}</div>))}
                  </>)}
                  {(notes.oe?.length>0) && (<>
                    <div className="mt-2 font-semibold">O/E</div>
                    {notes.oe.map((t,i)=> (<div key={`oe${i}`} className="text-slate-700">- {t}</div>))}
                  </>)}
                  {(notes.dx?.length>0) && (<>
                    <div className="mt-2 font-semibold">Dx</div>
                    {notes.dx.map((t,i)=> (<div key={`dx${i}`} className="text-slate-700">- {t}</div>))}
                  </>)}
                  {(notes.advice?.length>0) && (<>
                    <div className="mt-2 font-semibold">Advice</div>
                    {notes.advice.map((t,i)=> (<div key={`ad${i}`} className="text-slate-700">- {t}</div>))}
                  </>)}
                  {(notes.tests?.length>0) && (<>
                    <div className="mt-2 font-semibold">Tests</div>
                    {notes.tests.map((t,i)=> (<div key={`ts${i}`} className="text-slate-700">- {t}</div>))}
                  </>)}
                </div>
                <div className="flex-1">
                  <div className="text-lg font-bold mb-2">Rx</div>
                  {(()=>{
                    const groupsMed = {}
                    const groupsVac = {}
                    ;(p.items||[]).forEach(it=>{
                      const key = it.condition || 'General'
                      const target = isVaccineItem(it) ? groupsVac : groupsMed
                      if(!target[key]) target[key]=[]
                      target[key].push(it)
                    })
                    const keysMed = Object.keys(groupsMed)
                    const keysVac = Object.keys(groupsVac)

                    const renderGroups = (groups, keys, keyPrefix) => {
                      return keys.length ? keys.map((k,gi)=> (
                      <div key={`${keyPrefix}-${gi}-${k}`} className="mb-3">
                        {k!=='General' && <div className="font-semibold text-rose-700 mb-1">Condition: {k}</div>}
                        <div className="pl-3 border-l-2 border-slate-300 space-y-2">
                          {groups[k].map((x,i)=> {
                            let displayDose = x.dose || x.dosage || x.composition || ''
                            const hasPos = (v) => { const n = extractNum(v); return Number.isFinite(n) && n>0 }
                            const fluid = computeFluid(patientMerge)
                            const wsrc = (patientMerge?.weightKg ?? patientMerge?.weight ?? patientMerge?.details?.weightKg)
                            
                            // Fixed Dose: use the dose field directly
                            if (x.doseType === 'Fixed Dose') {
                              const doseNum = extractNum(x.dose)
                              if (Number.isFinite(doseNum) && doseNum > 0) {
                                displayDose = doseNum.toFixed(2)
                              }
                            } else {
                              // Weight Based or legacy: calculate dose
                              const doseRateNum = extractNum(x.doseRate)
                              const perMlNum = extractNum(x.perMl)
                              const weightNum = extractNum(wsrc)
                              if (x.useDehydration && Number.isFinite(fluid) && fluid > 0) {
                                displayDose = fluid.toFixed(2)
                              } else if (doseRateNum > 0 && perMlNum > 0 && weightNum > 0) {
                                const calculated = (doseRateNum * weightNum) / perMlNum
                                if (!isNaN(calculated) && calculated > 0) displayDose = calculated.toFixed(2)
                              } else if (!hasPos(displayDose) && Number.isFinite(fluid) && fluid > 0) {
                                displayDose = fluid.toFixed(2)
                              }
                            }
                            const amt = displayDose ? `${displayDose} ${x.unit||'ml'}` : (x.unit ? `${x.unit}` : '—')
                            return (
                              <div key={`${keyPrefix}-${gi}-${k}-${x?.id || x?.name || ''}-${i}`} className="pb-1 print-medicine">
                                <div className="grid grid-cols-12 gap-x-2 items-baseline">
                                  <div className="col-span-3 text-slate-700">{x.route||''}</div>
                                  <div className="col-span-7 font-bold text-slate-900">{x.name}</div>
                                  <div className="col-span-2 text-right text-slate-900 font-bold">{x.perMl||''}</div>
                                </div>
                                <div className="grid grid-cols-12 gap-x-2 text-xs text-slate-600">
                                  <div className="col-span-3 italic">{amt}</div>
                                  <div className="col-span-7 italic">{x.instructions||''}</div>
                                  <div className="col-span-2"></div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                      )) : null
                    }

                    const medsBlock = renderGroups(groupsMed, keysMed, 'm')
                    const renderVaccineGroups = (groups, keys) => {
                      return keys.length ? keys.map((k,gi)=>{
                        const byName = {}
                        ;(groups[k]||[]).forEach(it=>{
                          const nk = normalizeKey(it?.name) || 'vaccine'
                          if(!byName[nk]) byName[nk] = []
                          byName[nk].push(it)
                        })
                        const nameKeys = Object.keys(byName)
                        return (
                          <div key={`v-${gi}-${k}`} className="mb-3">
                            {k!=='General' && <div className="font-semibold text-rose-700 mb-1">Condition: {k}</div>}
                            <div className="pl-3 border-l-2 border-slate-300 space-y-2">
                              {nameKeys.map((nk,ni)=>{
                                const rows = byName[nk]
                                const head = rows[0] || {}
                                // Collect all shots from nested shots array or legacy fields
                                const allShots = []
                                rows.forEach((r)=>{
                                  if (Array.isArray(r?.shots) && r.shots.length) {
                                    r.shots.forEach(s => allShots.push(s))
                                  } else if (r?.shotStage || r?.dateGiven || r?.nextDue || r?.vet) {
                                    allShots.push({
                                      shotStage: r.shotStage,
                                      dateGiven: r.dateGiven,
                                      nextDue: r.nextDue,
                                      vet: r.vet,
                                    })
                                  }
                                })
                                return (
                                  <div key={`v-${gi}-${k}-${ni}-${nk}`} className="pb-1">
                                    <div className="grid grid-cols-12 gap-x-2 items-baseline">
                                      <div className="col-span-3 text-slate-700">{head.route||''}</div>
                                      <div className="col-span-9 font-bold text-slate-900">{head.name}</div>
                                    </div>
                                    <div className="grid grid-cols-12 gap-x-2 text-xs text-slate-600">
                                      <div className="col-span-3"></div>
                                      <div className="col-span-9 italic">{head.instructions||''}</div>
                                    </div>
                                    <div className="pl-[25%] mt-1 space-y-1 text-xs">
                                      {allShots.map((s,si)=> (
                                        <div key={`vshot-${gi}-${k}-${ni}-${si}`} className="flex items-baseline justify-between pr-4">
                                          <div className="font-semibold text-slate-800">{formatVaccineStage(s?.shotStage || `Shot ${si+1}`)}</div>
                                          <div className="text-slate-700">{s?.dateGiven || ''}</div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      }) : null
                    }

                    const vacsBlock = renderVaccineGroups(groupsVac, keysVac)
                    return (medsBlock || vacsBlock) ? (<>
                      {medsBlock}
                      {vacsBlock}
                    </>) : <div className="text-slate-500">No medicines.</div>
                  })()}
                </div>
              </div>
              <div className="mt-10 flex justify-end print-signature">
                <div className="text-center">
                  {signature && <img src={signature} className="h-24 mx-auto object-contain" />}
                  <div className="mt-1 text-slate-800 font-semibold">{(function(){ try{ const profile = JSON.parse(localStorage.getItem('doctor_profile')||'{}'); return profile?.name || (p.doctor?.name || p.doctor?.username || 'Doctor') }catch(e){return (p.doctor?.name || p.doctor?.username || 'Doctor')} })()}</div>
                  <div className="text-xs text-slate-600">Companion Animal Veterinarian</div>
                  <div className="text-xs text-slate-500">{settings?.companyName || 'Pets Hospital'}</div>
                  {settings?.address && <div className="text-xs text-slate-500 mt-1">{settings.address}</div>}
                  {settings?.phone && <div className="text-xs text-slate-500">{settings.phone}</div>}
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 bg-slate-50 flex justify-end gap-2 shrink-0">
            <button onClick={()=>{ onClose && onClose() }} className="h-10 px-4 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer">OK</button>
            <button onClick={handlePrint} className="h-10 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 text-white cursor-pointer">Print</button>
          </div>
        </div>
      </div>
    </div>
  )
}
