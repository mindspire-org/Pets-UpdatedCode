import React, { useEffect, useMemo, useState } from 'react'
import { FiSearch, FiPrinter, FiEdit2, FiTrash2 } from 'react-icons/fi'
import { useSettings } from '../../context/SettingsContext'
import { labReportsAPI } from '../../services/api'

export default function LabReports(){
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
  const [q, setQ] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showEdit, setShowEdit] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [showDelete, setShowDelete] = useState(false)
  const [showPrintPreview, setShowPrintPreview] = useState(false)
  const [printData, setPrintData] = useState(null)
  const [copyToast, setCopyToast] = useState('')
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })
  const [confirmDialog, setConfirmDialog] = useState({ show: false, title: '', message: '', onConfirm: null, type: 'danger' })

  useEffect(() => {
    fetchReports()
  }, [])

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000)
  }

  const fetchReports = async () => {
    try {
      setLoading(true)
      const response = await labReportsAPI.getAll()
      setItems(response.data || [])
    } catch (err) {
      console.error('Error fetching lab reports:', err)
    } finally {
      setLoading(false)
    }
  }

  const printReport = (form) => {
    setPrintData(form)
    setShowPrintPreview(true)
  }

  const handlePrint = () => {
    try {
      const el = document.getElementById('lab-report-print')
      if (el) el.scrollTop = 0
      window.scrollTo(0, 0)
    } catch (e) {}
    window.print()
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

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyToast('Copied: ' + text)
      setTimeout(()=>setCopyToast(''), 1500)
    } catch (e) {
      console.error('Clipboard error:', e)
    }
  }

  const startEdit = (r) => { setEditItem(JSON.parse(JSON.stringify(r))); setShowEdit(true) }
  const saveEdit = async (e) => {
    e.preventDefault()
    try {
      await labReportsAPI.update(editItem.id, editItem)
      await fetchReports()
      setShowEdit(false)
      showToast('Report updated successfully')
    } catch (err) {
      console.error('Error updating report:', err)
      showToast('Failed to update report', 'error')
    }
  }
  const askDelete = (r) => { 
    setConfirmDialog({ 
      show: true, 
      title: 'Delete Report', 
      message: `Are you sure you want to delete report for ${r.petName} (${r.testName})?`, 
      onConfirm: confirmDelete, 
      type: 'danger' 
    }) 
  }
  const confirmDelete = async () => {
    if (!editItem) return
    try {
      await labReportsAPI.delete(editItem.id)
      await fetchReports()
      setConfirmDialog({ show: false, title: '', message: '', onConfirm: null, type: 'danger' })
      setEditItem(null)
      showToast('Report deleted successfully')
    } catch (err) {
      console.error('Error deleting report:', err)
      showToast('Failed to delete report', 'error')
    }
  }

  const filtered = useMemo(()=> items.filter(r => (r.petName+r.testName+r.date+(r.patientId||'')).toLowerCase().includes(q.toLowerCase())), [items, q])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Reports List</h1>
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="h-10 pl-9 pr-4 w-64 rounded-lg border border-slate-300" placeholder="Search reports..." value={q} onChange={e=>setQ(e.target.value)} />
        </div>
      </div>
      <div className="rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-500">
              <th className="py-3 px-4 font-medium">Pet</th>
              <th className="py-3 px-4 font-medium">Test</th>
              <th className="py-3 px-4 font-medium">Date</th>
              <th className="py-3 px-4 font-medium">Amount</th>
              <th className="py-3 px-4 font-medium">Status</th>
              <th className="py-3 px-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="py-3 px-4 font-medium text-slate-800">
                  <div className="flex flex-col">
                    <span>{r.petName}</span>
                    {r.patientId && (
                      <button
                        type="button"
                        onClick={()=>copyToClipboard(r.patientId)}
                        className="mt-1 w-fit text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
                        title="Click to copy"
                      >
                        {r.patientId}
                      </button>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4">{r.testName}</td>
                <td className="py-3 px-4">{r.date}</td>
                <td className="py-3 px-4">Rs {Number(r.amount||0).toLocaleString()}</td>
                <td className="py-3 px-4">{r.paymentStatus || 'Paid'}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <button onClick={()=>printReport(r)} className="px-3 h-9 rounded-lg bg-slate-600 hover:bg-slate-700 text-white shadow-sm cursor-pointer inline-flex items-center gap-2"><FiPrinter /> Print</button>
                    <button onClick={()=>startEdit(r)} className="px-3 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer inline-flex items-center gap-2"><FiEdit2 /> Edit</button>
                    <button onClick={()=>askDelete(r)} className="px-3 h-9 rounded-lg bg-red-600 hover:bg-red-700 text-white cursor-pointer inline-flex items-center gap-2"><FiTrash2 /> Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length===0 && (
              <tr><td className="py-6 px-4 text-center text-slate-500" colSpan={6}>No reports</td></tr>
            )}
          </tbody>
        </table>
      </div>

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
                html, body { width: 210mm; height: auto !important; }
                body { margin: 0 !important; }
                body * { visibility: hidden; }
                #lab-report-print, #lab-report-print * { visibility: visible; }
                #lab-report-print {
                  position: fixed;
                  inset: 0;
                  width: auto !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  overflow: visible !important;
                  height: auto !important;
                  max-height: none !important;
                  box-shadow: none !important;
                }
                #lab-report-print.print-padding { padding: 0 !important; }
                table { page-break-inside: auto; }
                tr, td, th { page-break-inside: avoid; }
              }
            `}</style>
            
            <div id="lab-report-print" className="print-padding p-8 overflow-y-auto flex-1">
              {/* Header */}
              <div className="border-b-4 border-blue-600 pb-3 mb-6">
                <div className="flex items-center">
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
                    const value = (r.value ?? r.result ?? '')
                    const ref = (r.refRange ?? r.normalRange ?? '')
                    const flag = getFlag(value, ref)
                    const isHigh = flag === 'H'
                    const isLow = flag === 'L'
                    return (
                      <tr key={i} className="border-b border-slate-200">
                        <td className="py-2 px-2">{i + 1}</td>
                        <td className="py-2 px-2">{r.name || r.testName || ''}</td>
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
                onClick={() => setShowPrintPreview(false)} 
                className="px-6 h-11 rounded-lg border-2 border-slate-300 hover:bg-slate-50 font-semibold text-slate-700"
              >
                OK
              </button>
              <button 
                onClick={handlePrint} 
                className="px-6 h-11 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                Print
              </button>
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
