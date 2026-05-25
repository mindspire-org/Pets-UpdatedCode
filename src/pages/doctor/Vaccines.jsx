import React, { useEffect, useMemo, useState } from 'react'
import { vaccinesAPI, settingsAPI } from '../../services/api'

export default function DoctorVaccines(){
  const emptyShot = { dateGiven: '', nextDue: '', vet: '', shotStage: '', daysUntilNext: '' }
  const emptyRow = { name: '', route: 'Intramuscular (IM)', instructions: '', shots: [{ ...emptyShot }] }
  const [form, setForm] = useState({ id:null, condition:'', rows:[{...emptyRow}] })
  const [items, setItems] = useState([])
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [toDelete, setToDelete] = useState(null)
  const DEFAULT_ROUTES = ['Oral','Sublingual','Topical','Tablet','Capsule','Syrup/Suspension','Infusion','Intramuscular (IM)','Intravenous (IV)','Subcutaneous (SC)','Intraocular','Intraperitoneal','Inhalation','Rectal','Other']
  const [routeOptions, setRouteOptions] = useState(DEFAULT_ROUTES)
  const [showAddRoute, setShowAddRoute] = useState(false)
  const [showManageRoutes, setShowManageRoutes] = useState(false)
  const [routeEdit, setRouteEdit] = useState({ oldValue:'', value:'' })
  const [newRoute, setNewRoute] = useState('')
  const [routeRowIndex, setRouteRowIndex] = useState(null)
  const [settingsDoc, setSettingsDoc] = useState(null)

  // Load existing from MongoDB
  const [loaded, setLoaded] = useState(false)
  useEffect(()=>{
    const fetchVaccines = async () => {
      try {
        const response = await vaccinesAPI.getAll()
        const raw = response?.data || []
        setItems(raw)
      } catch (error) {
        console.error('Error fetching vaccines:', error)
        setItems([])
      }
      setLoaded(true)
    }
    fetchVaccines()
  },[])

  // Load existing route options
  useEffect(()=>{
    (async()=>{
      try {
        const user = JSON.parse(localStorage.getItem('user')||'{}')
        const userId = user.username || 'admin'
        const res = await settingsAPI.get(userId)
        const data = res?.data || res
        setSettingsDoc(data)
        const routes = data?.customSettings?.vaccineRoutes || data?.vaccineRoutes || []
        if (Array.isArray(routes) && routes.length) {
          setRouteOptions(Array.from(new Set([...DEFAULT_ROUTES, ...routes])))
        }
      } catch (e) {}
    })()
  },[])

  const persistRoutes = async (routes) => {
    const user = JSON.parse(localStorage.getItem('user')||'{}')
    const userId = user.username || 'admin'
    const nextDoc = {
      ...(settingsDoc || { userId, role: 'doctor' }),
      customSettings: { ...((settingsDoc&&settingsDoc.customSettings)||{}), vaccineRoutes: routes }
    }
    try {
      await settingsAPI.update(userId, nextDoc)
      setSettingsDoc(nextDoc)
    } catch (e) {}
  }

  const handleAddRouteSave = async () => {
    const name = String(newRoute||'').trim()
    if (!name) return
    const uniq = Array.from(new Set([...routeOptions, name]))
    setRouteOptions(uniq)
    await persistRoutes(uniq)
    if (routeRowIndex!=null) {
      setForm(f=>({ ...f, rows: f.rows.map((r,i)=> i===routeRowIndex ? { ...r, route: name } : r) }))
    }
    setShowAddRoute(false)
    setNewRoute('')
    setRouteRowIndex(null)
  }

  const removeRoute = async (name) => {
    const val = String(name || '').trim()
    if (!val) return
    if (!window.confirm(`Remove route "${val}"?`)) return
    const next = (routeOptions || []).filter(r => String(r || '').trim() !== val)
    setRouteOptions(next)
    await persistRoutes(next)
  }

  const renameRoute = async (oldValue, nextValue) => {
    const oldName = String(oldValue || '').trim()
    const newName = String(nextValue || '').trim()
    if (!oldName || !newName || oldName === newName) return
    const next = (routeOptions || []).map(r => (String(r || '').trim() === oldName ? newName : r))
    setRouteOptions(next)
    await persistRoutes(next)
    setRouteEdit({ oldValue:'', value:'' })
  }

  const filtered = useMemo(()=>{
    const s=q.trim().toLowerCase()
    if(!s) return items
    return items.filter(m=> [m.condition, ...(m.rows||[]).map(r=>r.name), ...(m.rows||[]).map(r=>r.instructions)].some(v=>String(v||'').toLowerCase().includes(s)))
  },[items,q])

  const totalPages = Math.max(1, Math.ceil((filtered?.length || 0) / pageSize))
  const paged = useMemo(()=>{
    const list = Array.isArray(filtered) ? filtered : []
    const start = (page - 1) * pageSize
    return list.slice(start, start + pageSize)
  },[filtered,page,pageSize])

  // Helper to compute next due date based on shot stage or explicit days
  const calcNextDue = (dateStr, stage, daysOverride) => {
    if(!dateStr) return ''
    const dt = new Date(dateStr)
    let days = daysOverride ? parseInt(daysOverride) : NaN
    if (!Number.isFinite(days) || days <= 0) {
      days = ['1st','2nd','3rd','4th'].includes(stage) ? 21 : 365
    }
    dt.setDate(dt.getDate() + days)
    return dt.toISOString().slice(0,10)
  }

  // ARV post-exposure schedule: shots at day 0, 2, 6, 13, 27
  const ARV_INTERVALS = [0, 2, 6, 13, 27]
  const ARV_STAGES = ['1st', '2nd', '3rd', '4th', 'Annual booster']
  const applyARVPreset = () => {
    const today = new Date()
    const fmt = (d) => d.toISOString().slice(0,10)
    const arvShots = ARV_INTERVALS.map((offset, i) => {
      const shotDate = new Date(today)
      shotDate.setDate(today.getDate() + offset)
      const nextOffset = ARV_INTERVALS[i + 1]
      const days = nextOffset !== undefined ? (nextOffset - offset) : ''
      const nextDue = nextOffset !== undefined
        ? fmt(new Date(today.getFullYear(), today.getMonth(), today.getDate() + nextOffset))
        : ''
      return { dateGiven: fmt(shotDate), nextDue, vet: '', shotStage: ARV_STAGES[i], daysUntilNext: String(days) }
    })
    setForm(f => ({
      ...f,
      condition: f.condition || 'Post Exposure (Rabies ARV)',
      rows: [{ name: 'Nobivac', route: 'Intramuscular (IM)', instructions: '1ml per dose', shots: arvShots }]
    }))
  }

  const addRow = () => setForm(f=>({ ...f, rows:[...f.rows, { ...emptyRow, shots: [{ ...emptyShot }] }] }))

  const addShot = (rowIdx) => setForm(f => {
    const newRows = f.rows.map((r, i) => {
      if (i !== rowIdx) return r
      const shots = Array.isArray(r.shots) ? r.shots : []
      return { ...r, shots: [...shots, { ...emptyShot }] }
    })
    return { ...f, rows: newRows }
  })

  const removeShot = (rowIdx, shotIdx) => setForm(f => {
    const newRows = f.rows.map((r, i) => {
      if (i !== rowIdx) return r
      const shots = Array.isArray(r.shots) ? r.shots : []
      if (shots.length <= 1) return r
      return { ...r, shots: shots.filter((_, si) => si !== shotIdx) }
    })
    return { ...f, rows: newRows }
  })

  const updateRow = (idx, field, value) => setForm(f=> {
    const newRows = f.rows.map((r, i) => {
      if (i !== idx) return r;
      return { ...r, [field]: value };
    });
    return { ...f, rows: newRows };
  })

  const updateShot = (rowIdx, shotIdx, field, value) => setForm(f => {
    const newRows = f.rows.map((r, i) => {
      if (i !== rowIdx) return r
      const shots = Array.isArray(r.shots) ? r.shots : []
      const newShots = shots.map((s, si) => {
        if (si !== shotIdx) return s
        const updated = { ...s, [field]: value }
        if (field === 'dateGiven' || field === 'shotStage' || field === 'daysUntilNext') {
          if (updated.dateGiven && (updated.daysUntilNext || updated.shotStage)) {
            updated.nextDue = calcNextDue(updated.dateGiven, updated.shotStage, updated.daysUntilNext)
          }
        }
        return updated
      })
      return { ...r, shots: newShots }
    })
    return { ...f, rows: newRows }
  })

  const removeRow = (idx) => setForm(f=>({ ...f, rows: f.rows.filter((_,i)=>i!==idx) }))

  const resetForm = () => setForm({ id:null, condition:'', rows:[{...emptyRow}] })

  const save = async (e) => {
    e.preventDefault()
    if(!form.condition || !(form.rows||[]).some(r=>r.name)) return
    const cleaned = {
      ...form,
      rows: (form.rows || [])
        .filter(r => r?.name)
        .map(r => ({
          ...r,
          shots: Array.isArray(r.shots) && r.shots.length ? r.shots : [{ ...emptyShot }]
        }))
    }
    
    try {
      if(form.id){
        await vaccinesAPI.update(form.id, cleaned)
        setItems(prev=>prev.map(x=>x.id===form.id? { ...cleaned, id: form.id } : x))
      } else {
        const newId = String(Date.now())
        const newVaccine = {...cleaned, id: newId}
        const res = await vaccinesAPI.create(newVaccine)
        setItems(prev=>[res.data || newVaccine, ...prev])
      }
      resetForm()
    } catch (error) {
      console.error('Error saving vaccine:', error)
      alert('Failed to save vaccine regimen')
    }
  }

  const edit = m => {
    const rows = (m.rows && m.rows.length ? m.rows : [{ ...emptyRow }]).map(r => {
      if (Array.isArray(r?.shots) && r.shots.length) return r
      // Backward compatibility: migrate legacy single-shot fields into shots[]
      const legacy = {
        dateGiven: r?.dateGiven || '',
        nextDue: r?.nextDue || '',
        vet: r?.vet || '',
        shotStage: r?.shotStage || '',
      }
      return { ...r, shots: [{ ...emptyShot, ...legacy }] }
    })
    setForm({ id:m.id, condition:m.condition, rows })
  }
  
  const del = async (m) => {
    try {
      await vaccinesAPI.delete(m.id)
      setItems(prev=>prev.filter(x=>x.id!==m.id))
    } catch (error) {
      console.error('Error deleting vaccine:', error)
      alert('Failed to delete vaccine regimen')
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">Vaccine Management</h1>
        <p className="text-slate-500 mt-1">Create and manage vaccine regimens by condition</p>
      </div>

      {showAddRoute && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={()=>setShowAddRoute(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md ring-1 ring-slate-200 overflow-hidden" onClick={e=>e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200 font-semibold text-slate-800">Add New Route</div>
            <div className="px-6 py-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Route Name</label>
              <input value={newRoute} onChange={e=>setNewRoute(e.target.value)} placeholder="e.g., Subcutaneous (SC)" className="h-11 px-3 rounded-lg border-2 border-slate-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 w-full transition-all duration-200" />
            </div>
            <div className="px-6 py-4 bg-slate-50 flex justify-end gap-2">
              <button onClick={()=>setShowAddRoute(false)} className="h-9 px-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100">Cancel</button>
              <button onClick={handleAddRouteSave} className="h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white">Save</button>
            </div>
          </div>
        </div>
      )}

      {showManageRoutes && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={()=>{ setShowManageRoutes(false); setRouteEdit({ oldValue:'', value:'' }) }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg ring-1 ring-slate-200 overflow-hidden" onClick={e=>e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200 font-semibold text-slate-800 flex items-center justify-between">
              <div>Manage Routes</div>
              <button onClick={()=>{ setShowManageRoutes(false); setRouteEdit({ oldValue:'', value:'' }) }} className="h-9 px-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100">Close</button>
            </div>
            <div className="px-6 py-4 max-h-[70vh] overflow-auto">
              <div className="space-y-2">
                {(routeOptions || []).map((r) => (
                  <div key={r} className="flex items-center gap-2">
                    {routeEdit.oldValue === r ? (
                      <input value={routeEdit.value} onChange={e=>setRouteEdit(v=>({ ...v, value: e.target.value }))} className="flex-1 h-10 px-3 rounded-lg border border-slate-300" />
                    ) : (
                      <div className="flex-1 text-sm text-slate-800">{r}</div>
                    )}
                    {routeEdit.oldValue === r ? (
                      <>
                        <button type="button" onClick={()=>renameRoute(routeEdit.oldValue, routeEdit.value)} className="h-10 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm">Save</button>
                        <button type="button" onClick={()=>setRouteEdit({ oldValue:'', value:'' })} className="h-10 px-3 rounded-lg border border-slate-300 text-sm text-slate-700">Cancel</button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={()=>setRouteEdit({ oldValue: r, value: r })} className="h-10 px-3 rounded-lg border border-slate-300 text-sm text-slate-700">Edit</button>
                        <button type="button" onClick={()=>removeRoute(r)} className="h-10 px-3 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-sm">Delete</button>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <button type="button" onClick={()=>{ setRouteRowIndex(null); setNewRoute(''); setShowManageRoutes(false); setShowAddRoute(true) }} className="h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm">+ Add New Route</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-gradient-to-br from-white to-slate-50 shadow-xl ring-1 ring-slate-200/50 p-6 border border-slate-100">
        <form onSubmit={save} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                Medical Condition / Vaccine Type
              </label>
              <input className="h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 w-full transition-all duration-200 bg-white shadow-sm" placeholder="e.g., Rabies, DHPPiL" value={form.condition} onChange={e=>setForm(s=>({...s,condition:e.target.value}))} required />
            </div>
            <div className="md:col-span-1">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                Search Regimens
              </label>
              <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search..." className="h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-teal-400 focus:ring-4 focus:ring-teal-100 w-full transition-all duration-200 bg-white shadow-sm" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-slate-800">Vaccine Regimen</h3>
              <button
                type="button"
                onClick={applyARVPreset}
                className="h-9 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white text-xs font-bold shadow transition-all flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd"/></svg>
                Post Exposure (ARV) Preset
              </button>
            </div>
            {form.rows.map((r, idx)=> (
              <div key={idx} className="group rounded-xl border-2 border-slate-200 hover:border-emerald-300 p-4 bg-gradient-to-br from-white to-emerald-50/30 shadow-sm hover:shadow-md transition-all duration-200 relative">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Vaccine Name</label>
                    <input value={r.name} onChange={e=>updateRow(idx,'name',e.target.value)} placeholder="Enter vaccine name" className="h-11 px-4 rounded-xl border-2 border-slate-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 w-full transition-all duration-200" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Route</label>
                    <select value={r.route} onChange={e=>updateRow(idx,'route',e.target.value)} className="h-11 px-3 rounded-lg border-2 border-slate-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 w-full bg-white transition-all duration-200">
                      <option>Intramuscular (IM)</option>
                      <option>Subcutaneous (SC)</option>
                      <option>Intravenous (IV)</option>
                      <option>Oral</option>
                      <option>Intranasal</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4 mt-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-emerald-700 uppercase tracking-wider">Vaccination Shots</label>
                    <button type="button" onClick={() => addShot(idx)} className="text-xs bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg border border-emerald-200 hover:bg-emerald-100 font-bold transition-all">+ Add Shot</button>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3">
                    {(r.shots || []).map((shot, sIdx) => (
                      <div key={sIdx} className="bg-slate-50 rounded-xl p-4 border border-slate-200 relative group/shot">
                        {r.shots.length > 1 && (
                          <button type="button" onClick={() => removeShot(idx, sIdx)} className="absolute -top-2 -right-2 w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center opacity-0 group-hover/shot:opacity-100 transition-all border border-red-200 hover:bg-red-600 hover:text-white">×</button>
                        )}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Date Given</label>
                            <input type="date" value={shot.dateGiven} onChange={e=>updateShot(idx, sIdx, 'dateGiven', e.target.value)} className="h-10 px-3 rounded-lg border-2 border-slate-200 focus:border-emerald-400 w-full text-sm" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Shot Stage</label>
                            <select value={shot.shotStage} onChange={e=>updateShot(idx, sIdx, 'shotStage', e.target.value)} className="h-10 px-3 rounded-lg border-2 border-slate-200 focus:border-emerald-400 w-full bg-white text-sm">
                              <option value="">Select Stage</option>
                              <option>1st</option>
                              <option>2nd</option>
                              <option>3rd</option>
                              <option>4th</option>
                              <option>Annual booster</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Days Until Next</label>
                            <input type="number" min="0" value={shot.daysUntilNext} onChange={e=>updateShot(idx, sIdx, 'daysUntilNext', e.target.value)} placeholder="e.g. 2" className="h-10 px-3 rounded-lg border-2 border-slate-200 focus:border-emerald-400 w-full text-sm" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Next Due</label>
                            <input type="date" value={shot.nextDue} onChange={e=>updateShot(idx, sIdx, 'nextDue', e.target.value)} placeholder="Next Due" className="h-10 px-3 rounded-lg border-2 border-slate-200 focus:border-emerald-400 w-full text-sm" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Vet Name</label>
                            <input value={shot.vet} onChange={e=>updateShot(idx, sIdx, 'vet', e.target.value)} placeholder="Vet's Name" className="h-10 px-4 rounded-lg border-2 border-slate-200 focus:border-emerald-400 w-full text-sm" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Instructions</label>
                  <textarea value={r.instructions} onChange={e=>updateRow(idx,'instructions',e.target.value)} placeholder="e.g., Annual booster" className="h-20 px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 w-full transition-all duration-200 resize-none" />
                </div>
                
                <div className="mt-3 flex justify-end">
                  {form.rows.length>1 && <button type="button" onClick={()=>removeRow(idx)} className="h-9 px-4 rounded-lg bg-red-50 border-2 border-red-200 text-red-600 hover:bg-red-100 hover:border-red-300 text-sm font-medium transition-all duration-200 flex items-center gap-2">
                    Remove
                  </button>}
                </div>
              </div>
            ))}
            <button type="button" onClick={addRow} className="h-12 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2">
              + Add Vaccine Row
            </button>
          </div>

          <div className="flex gap-3">
            <button className="px-6 h-12 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2">
              {form.id? 'Update Regimen':'Save Regimen'}
            </button>
            {form.id && <button type="button" onClick={resetForm} className="px-6 h-12 rounded-xl border-2 border-slate-300 text-slate-700 hover:bg-slate-50 transition-all duration-200 flex items-center gap-2">
              Cancel
            </button>}
          </div>
        </form>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="text-sm text-slate-600 font-medium">
          Showing {filtered.length===0 ? 0 : ((page - 1) * pageSize + 1)}-{Math.min(page * pageSize, filtered.length)} of {filtered.length}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={()=>setPage(p=>Math.max(1, p-1))} disabled={page<=1} className="h-9 px-3 rounded-lg border border-slate-300 text-sm disabled:opacity-50">Prev</button>
          <div className="text-sm text-slate-700 font-semibold min-w-[84px] text-center">{page} / {totalPages}</div>
          <button type="button" onClick={()=>setPage(p=>Math.min(totalPages, p+1))} disabled={page>=totalPages} className="h-9 px-3 rounded-lg border border-slate-300 text-sm disabled:opacity-50">Next</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {paged.map(m=> (
          <div key={m.id} className="group rounded-2xl bg-gradient-to-br from-white to-slate-50 border-2 border-slate-200 hover:border-emerald-300 shadow-lg hover:shadow-xl p-6 transition-all duration-300">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div className="flex-1">
                <div className="font-bold text-slate-800 text-lg">{m.condition}</div>
                <div className="text-sm text-slate-600">{(m.rows||[]).length} vaccines</div>
              </div>
              <div className="flex gap-2">
                <button onClick={()=>edit(m)} className="p-2 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200">Edit</button>
                <button onClick={()=>setToDelete(m)} className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200">Delete</button>
              </div>
            </div>
            <div className="space-y-3">
              {(m.rows||[]).map((r,i)=> (
                <div key={i} className="bg-white rounded-lg p-3 border border-slate-200">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-semibold">{r.route}</span>
                    <span className="font-semibold text-slate-800">{r.name}</span>
                  </div>
                  <div className="text-xs text-slate-600 space-y-2 mt-2">
                    {(r.shots || []).map((s, si) => (
                      <div key={si} className="bg-emerald-50/50 p-2 rounded border border-emerald-100">
                        <div className="font-bold text-emerald-800 text-[10px] uppercase mb-1">Shot {si + 1}: {s.shotStage}</div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          {s.dateGiven && <div>Given: {s.dateGiven}</div>}
                          {s.nextDue && <div className="font-semibold text-emerald-700">Next Due: {s.nextDue}</div>}
                          {s.vet && <div>Vet: {s.vet}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {toDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={()=>setToDelete(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e=>e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 mb-4">Delete Regimen</h3>
            <p className="text-slate-600 mb-6">Are you sure you want to delete the vaccine regimen for "{toDelete.condition}"?</p>
            <div className="flex justify-end gap-3">
              <button onClick={()=>setToDelete(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">Cancel</button>
              <button onClick={()=>{ del(toDelete); setToDelete(null) }} className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
