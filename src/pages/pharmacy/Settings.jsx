import React, { useState, useEffect } from 'react'
import { FiDownload, FiUpload, FiTrash2, FiAlertTriangle, FiDatabase, FiSettings, FiSave, FiUploadCloud } from 'react-icons/fi'
import { backupAPI, pharmacySettingsAPI } from '../../services/api'
import { useSettings } from '../../context/SettingsContext'

export default function PharmacySettings() {
  const { refresh } = useSettings()
  const [importFile, setImportFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [confirmDialog, setConfirmDialog] = useState({ show: false, title: '', message: '', onConfirm: null })

  // New settings state
  const [pharmacySettings, setPharmacySettings] = useState({
    pharmacyName: '',
    phone: '',
    address: '',
    email: '',
    billingFooter: '',
    companyLogo: '',
    billDiscountPercent: 0,
    salesTaxPercent: 0
  })

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      // Use pharmacySettingsAPI to get shared pharmacy settings
      const res = await pharmacySettingsAPI.get()
      if (res.data) {
        setPharmacySettings({
          pharmacyName: res.data.pharmacyName || '',
          phone: res.data.phone || '',
          address: res.data.address || '',
          email: res.data.email || '',
          billingFooter: res.data.billingFooter || '',
          companyLogo: res.data.companyLogo || '',
          billDiscountPercent: res.data.billDiscountPercent || 0,
          salesTaxPercent: res.data.salesTaxPercent || 0
        })
      }
    } catch (e) {
      console.error('Failed to fetch settings:', e)
    }
  }

  const handleSaveSettings = async (e) => {
    e.preventDefault()
    try {
      setBusy(true)
      const auth = JSON.parse(localStorage.getItem('pharmacy_auth') || '{}')
      const username = auth.username || 'system'
      
      // Use pharmacySettingsAPI to save shared settings
      const payload = {
        ...pharmacySettings,
        updatedBy: username
      }
      
      await pharmacySettingsAPI.save(payload)
      
      // Immediately refresh global settings to update header
      await refresh()
      
      setMessage('Settings saved successfully.')
      setTimeout(() => setMessage(''), 3000)
    } catch (e) {
      setMessage('Error: Failed to save settings')
    } finally {
      setBusy(false)
    }
  }

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPharmacySettings(prev => ({ ...prev, companyLogo: reader.result }))
      }
      reader.readAsDataURL(file)
    }
  }

  const pickPharmacyOnly = (data) => {
    if (!data) return { pharmacyMedicines: [], pharmacyPurchases: [], pharmacySales: [], pharmacyDues: [] }
    const {
      pharmacyMedicines = [],
      pharmacyPurchases = [],
      pharmacySales = [],
      pharmacyDues = [],
    } = data
    return { pharmacyMedicines, pharmacyPurchases, pharmacySales, pharmacyDues }
  }

  const handleExport = async () => {
    try {
      setBusy(true); setMessage('')
      const res = await backupAPI.exportAll()
      const payload = pickPharmacyOnly(res.data || res)
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      a.href = url
      a.download = `pharmacy-backup-${ts}.json`
      a.click()
      URL.revokeObjectURL(url)
      setMessage('Export complete. File downloaded.')
    } catch (e) {
      console.error(e)
      setMessage(e?.message || 'Failed to export')
    } finally {
      setBusy(false)
    }
  }

  const handleImportFileChange = (e) => {
    setImportFile(e.target.files?.[0] || null)
  }

  const handleImport = async () => {
    if (!importFile) { setMessage('Please select a JSON file to import.'); return }
    try {
      setBusy(true); setMessage('')
      const text = await importFile.text()
      let json
      try { json = JSON.parse(text) } catch { throw new Error('Invalid JSON file') }
      const payload = pickPharmacyOnly(json)
      await backupAPI.importAll(payload)
      setMessage('Import completed successfully.')
    } catch (e) {
      console.error(e)
      setMessage(e?.message || 'Failed to import')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    setConfirmDialog({
      show: true,
      title: 'Delete Pharmacy Data',
      message: 'This will DELETE all Pharmacy data (Medicines, Purchases, Sales, Dues). This action cannot be undone. Continue?',
      onConfirm: async () => {
        try {
          setBusy(true); setMessage('');
          await backupAPI.clearPharmacy();
          setMessage('Pharmacy data cleared successfully.');
        } catch (error) {
          setMessage('Error deleting data');
        } finally {
          setBusy(false);
          setConfirmDialog(prev => ({ ...prev, show: false }));
        }
      }
    });
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 bg-clip-text text-transparent mb-2 flex items-center justify-center gap-2">
          <FiSettings /> Pharmacy Settings
        </h1>
        <p className="text-slate-600 text-lg">Backup, restore, and manage Pharmacy portal data</p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg mb-6 flex items-center gap-2 ${message.includes('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          <div className={`w-2 h-2 rounded-full ${message.includes('Error') ? 'bg-red-500' : 'bg-emerald-500'} animate-pulse`} />
          <p className="font-medium">{message}</p>
        </div>
      )}

      {/* Custom Confirmation Dialog */}
      {confirmDialog.show && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 flex items-center gap-3 bg-red-50 text-red-700">
              <div className="p-2 rounded-full bg-red-100 text-red-600">
                <FiTrash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold">{confirmDialog.title}</h3>
            </div>
            <div className="p-6 text-slate-600 leading-relaxed">
              {confirmDialog.message}
            </div>
            <div className="px-6 py-4 bg-slate-50 flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDialog(prev => ({ ...prev, show: false }))}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-lg shadow-red-200 transition-all"
              >
                Delete Everything
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 grid place-items-center"><FiDownload /></div>
            <div className="font-semibold">Export Pharmacy Data</div>
          </div>
          <p className="text-sm text-slate-600 mb-4">Download medicines, purchases, sales and dues as JSON.</p>
          <button disabled={busy} onClick={handleExport} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm disabled:opacity-60">
            <FiDownload className="w-4 h-4"/> Export JSON
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 grid place-items-center"><FiUpload /></div>
            <div className="font-semibold">Import Pharmacy Data</div>
          </div>
          <p className="text-sm text-slate-600 mb-3">Select a previously exported JSON file to restore.</p>
          <input type="file" accept="application/json" onChange={handleImportFileChange} className="block w-full text-sm mb-3" />
          <button disabled={busy || !importFile} onClick={handleImport} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm disabled:opacity-60">
            <FiUpload className="w-4 h-4"/> Import JSON
          </button>
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3 text-red-700">
            <div className="w-10 h-10 rounded-xl bg-red-100 grid place-items-center"><FiTrash2 /></div>
            <div className="font-semibold">Delete Pharmacy Data</div>
          </div>
          <div className="flex items-start gap-2 text-sm text-red-700 mb-4">
            <FiAlertTriangle className="mt-0.5"/>
            <p>Danger action. This will permanently delete medicines, purchases, sales and dues.</p>
          </div>
          <button disabled={busy} onClick={handleDelete} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm disabled:opacity-60">
            <FiTrash2 className="w-4 h-4"/> Delete All
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 flex items-center gap-2">
        <FiDatabase className="text-slate-400"/> Scope: Pharmacy collections only (Medicines, Purchases, Sales, Dues). Export/Import works with JSON files produced here.
      </div>

      {/* Database Driven Settings Form */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-800">Pharmacy Details</h2>
          <p className="text-xs text-slate-500 font-medium">Configure your pharmacy information for invoices and reports</p>
        </div>
        <form onSubmit={handleSaveSettings} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pharmacy Name</label>
              <input 
                type="text" 
                value={pharmacySettings.pharmacyName}
                onChange={(e) => setPharmacySettings({...pharmacySettings, pharmacyName: e.target.value})}
                placeholder="Abbottabad Pet Hospital Pharmacy"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-purple-500 focus:ring-0 outline-none transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Phone Number</label>
              <input 
                type="text" 
                value={pharmacySettings.phone}
                onChange={(e) => setPharmacySettings({...pharmacySettings, phone: e.target.value})}
                placeholder="+92-21-1234567"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-purple-500 focus:ring-0 outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pharmacy Address</label>
            <textarea 
              rows="3"
              value={pharmacySettings.address}
              onChange={(e) => setPharmacySettings({...pharmacySettings, address: e.target.value})}
              placeholder="Enter full pharmacy address..."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-purple-500 focus:ring-0 outline-none transition-all resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
            <input 
              type="email" 
              value={pharmacySettings.email}
              onChange={(e) => setPharmacySettings({...pharmacySettings, email: e.target.value})}
              placeholder="pharmacy@hospital.com"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-purple-500 focus:ring-0 outline-none transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Billing Footer</label>
            <textarea 
              rows="3"
              value={pharmacySettings.billingFooter}
              onChange={(e) => setPharmacySettings({...pharmacySettings, billingFooter: e.target.value})}
              placeholder="Terms and conditions or footer message for invoices..."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-purple-500 focus:ring-0 outline-none transition-all resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pharmacy Logo</label>
            <div className="flex items-center gap-4">
              {pharmacySettings.companyLogo && (
                <div className="w-16 h-16 rounded-xl border-2 border-slate-100 p-1 bg-white shrink-0 shadow-sm">
                  <img src={pharmacySettings.companyLogo} alt="Logo Preview" className="w-full h-full object-contain" />
                </div>
              )}
              <div className="relative flex-1">
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden" 
                  id="logo-upload"
                />
                <label 
                  htmlFor="logo-upload"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 hover:border-purple-400 hover:text-purple-600 cursor-pointer transition-all bg-slate-50 group"
                >
                  <FiUploadCloud className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <span className="font-bold text-sm">Choose Logo File</span>
                </label>
              </div>
            </div>
          </div>

          {/* Default Bill Settings */}
          <div className="pt-4 border-t border-slate-200">
            <h3 className="text-sm font-bold text-slate-700 mb-4">Default Bill Settings (POS)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bill Discount (%)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    min="0"
                    max="100"
                    step="0.01"
                    value={pharmacySettings.billDiscountPercent}
                    onChange={(e) => setPharmacySettings({...pharmacySettings, billDiscountPercent: parseFloat(e.target.value) || 0})}
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-purple-500 focus:ring-0 outline-none transition-all pr-10"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">%</span>
                </div>
                <p className="text-xs text-slate-400">Default discount percentage applied to bills in POS</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sales Tax (%)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    min="0"
                    max="100"
                    step="0.01"
                    value={pharmacySettings.salesTaxPercent}
                    onChange={(e) => setPharmacySettings({...pharmacySettings, salesTaxPercent: parseFloat(e.target.value) || 0})}
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-purple-500 focus:ring-0 outline-none transition-all pr-10"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">%</span>
                </div>
                <p className="text-xs text-slate-400">Default sales tax percentage applied to bills in POS</p>
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button 
              type="submit"
              disabled={busy}
              className="flex items-center gap-2 px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all active:scale-95 shadow-lg shadow-slate-200 disabled:opacity-50"
            >
              <FiSave className={busy ? 'animate-spin' : ''} /> Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
