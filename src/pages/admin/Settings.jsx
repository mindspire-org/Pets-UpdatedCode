import React, { useState } from 'react'
import { useSettings } from '../../context/SettingsContext'
import { FiSettings, FiMonitor, FiShield, FiSave, FiDownload, FiUpload, FiTrash2, FiCheckCircle } from 'react-icons/fi'
import { backupAPI } from '../../services/api'

export default function Settings() {
  const { settings, save: updateSettings } = useSettings()
  const [activeTab, setActiveTab] = useState('company')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showSaved, setShowSaved] = useState(false)
  const [formData, setFormData] = useState({
    companyName: settings.companyName || 'PharmaCare',
    companyLogo: settings.companyLogo || '',
    phone: settings.phone || '+92-21-1234567',
    address: settings.address || 'Main Boulevard, Gulshan-e-Iqbal, Karachi',
    email: settings.email || 'info@pharmacare.com',
    billingFooter: settings.billingFooter || ''
  })

  // Sync form data with settings when settings change
  React.useEffect(() => {
    setFormData({
      companyName: settings.companyName || 'PharmaCare',
      companyLogo: settings.companyLogo || '',
      phone: settings.phone || '+92-21-1234567',
      address: settings.address || 'Main Boulevard, Gulshan-e-Iqbal, Karachi',
      email: settings.email || 'info@pharmacare.com',
      billingFooter: settings.billingFooter || ''
    })
  }, [settings])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleLogoUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        // Strong compression: fit within 180x180 and convert to JPEG
        const maxDim = 180
        const scale = Math.min(maxDim / img.width, maxDim / img.height, 1)
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        // Fill white background to handle PNG transparency when converting to JPEG
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)

        let quality = 0.7
        let dataUrl = canvas.toDataURL('image/jpeg', quality)
        // Reduce quality until under ~400KB or min quality
        const maxBytes = 400_000
        while (dataUrl.length > maxBytes && quality > 0.4) {
          quality -= 0.1
          dataUrl = canvas.toDataURL('image/jpeg', quality)
        }

        if (dataUrl.length > 1_500_000) {
          alert('Logo bohat bara hai. Meharbani karke chhota file upload karein (max ~400KB).')
          return
        }

        setFormData(prev => ({ ...prev, companyLogo: dataUrl }))
      }
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await updateSettings(formData)
      setShowSaved(true)
    } catch (err) {
      console.error('Error saving settings:', err)
      alert('Failed to save settings. Please try again.')
    }
  }

  const handleBackup = async () => {
    try {
      const res = await backupAPI.exportAll()
      const payload = res?.data || {}
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `phms-full-backup-${new Date().toISOString().slice(0,10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Full backup failed, falling back to settings-only export', err)
      const dataStr = JSON.stringify({ settings }, null, 2)
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
      const linkElement = document.createElement('a')
      linkElement.setAttribute('href', dataUri)
      linkElement.setAttribute('download', 'phms-settings-backup.json')
      linkElement.click()
    }
  }

  const handleRestore = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const imported = JSON.parse(ev.target.result)
        // Prefer full import via API when structure matches
        if (imported && typeof imported === 'object' && (imported.pets || imported.appointments || imported.prescriptions)) {
          await backupAPI.importAll(imported)
          alert('Full system data imported successfully.')
        }
        // Also apply settings if present
        if (imported.settings || imported.companyName || imported.companyLogo) {
          const importedSettings = imported.settings || imported
          await updateSettings(importedSettings)
          setFormData({
            companyName: importedSettings.companyName || 'PharmaCare',
            companyLogo: importedSettings.companyLogo || '',
            phone: importedSettings.phone || '+92-21-1234567',
            address: importedSettings.address || 'Main Boulevard, Gulshan-e-Iqbal, Karachi',
            email: importedSettings.email || 'info@pharmacare.com',
            billingFooter: importedSettings.billingFooter || ''
          })
        }
        if (!(imported && (imported.pets || imported.appointments || imported.prescriptions))) {
          alert('File imported as settings only. For full import, export from this system\'s Backup Now button.')
        }
      } catch (error) {
        console.error('Import failed', error)
        alert('Error restoring backup. Please check the file format.')
      }
    }
    reader.readAsText(file)
  }

  const handleDeleteAll = () => {
    setShowDeleteConfirm(true)
  }

  const confirmDelete = async () => {
    try {
      await updateSettings({})
      setFormData({
        companyName: '',
        companyLogo: '',
        phone: '',
        address: '',
        email: '',
        billingFooter: ''
      })
      setShowDeleteConfirm(false)
      alert('All data has been deleted.')
    } catch (err) {
      console.error('Error deleting data:', err)
      alert('Failed to delete data. Please try again.')
    }
  }

  const cancelDelete = () => {
    setShowDeleteConfirm(false)
  }

  const tabs = [
    { id: 'company', label: 'Company Settings', icon: FiSettings },
    { id: 'backup', label: 'Backup & Security', icon: FiShield }
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-700 grid place-items-center shadow">
            <FiSettings className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-700 to-blue-600 bg-clip-text text-transparent">System Settings</h1>
            <p className="text-xs text-slate-500">Configure company, security and backup preferences</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs text-slate-600">
          <span className="font-semibold text-slate-700">Company:</span>
          <span className="truncate max-w-[220px]">{settings.companyName || 'PharmaCare'}</span>
        </div>
      </div>
      
      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200/70 p-1 inline-flex gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-2xl shadow-md ring-1 ring-slate-200/70">
        {activeTab === 'company' && (
          <div className="p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Company Settings</h2>
            <p className="text-sm text-slate-600 mb-6">Update your organization profile and branding used across invoices and portals.</p>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <div className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2"><FiMonitor className="text-indigo-500" /> Company Info</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Company Name</label>
                  <input
                    type="text"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="PharmaCare"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Phone Number</label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="+92-21-1234567"
                  />
                </div>
              </div>
              
              <div>
                <div className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2"><FiMonitor className="text-indigo-500" /> Contact</div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Company Address</label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Main Boulevard, Gulshan-e-Iqbal, Karachi"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="info@pharmacare.com"
                />
              </div>
              
              <div>
                <div className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2"><FiMonitor className="text-indigo-500" /> Branding</div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Company Logo</label>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  />
                </div>
                {formData.companyLogo && (
                  <div className="mt-3">
                    <img src={formData.companyLogo} alt="Company Logo" className="h-16 w-16 object-cover rounded-lg border border-slate-200" />
                  </div>
                )}
              </div>
              
              <div>
                <div className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2"><FiMonitor className="text-indigo-500" /> Billing</div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Billing Footer</label>
                <textarea
                  name="billingFooter"
                  value={formData.billingFooter}
                  onChange={handleChange}
                  rows={4}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Enter billing footer text..."
                />
              </div>
            </form>
          </div>
      )}

      {/* Saved Success Modal */}
      {showSaved && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-0 max-w-md w-full mx-4 shadow-2xl ring-1 ring-slate-200/70 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white/20 grid place-items-center">
                  <FiCheckCircle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Settings Saved</h3>
                  <p className="text-xs/5 opacity-90">Your changes have been applied successfully.</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-2">
                <div className="text-sm text-slate-600">Company</div>
                <div className="text-base font-semibold text-slate-900">{formData.companyName || 'PharmaCare'}</div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowSaved(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer border border-slate-200"
                >
                  Close
                </button>
                <button
                  onClick={() => setShowSaved(false)}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer shadow"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

        {activeTab === 'backup' && (
          <div className="p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Backup & Security</h2>
            <p className="text-slate-600 mb-6">Manage your application data. It's recommended to create backups regularly.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={handleBackup}
                className="inline-flex items-center gap-2 px-6 py-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium cursor-pointer shadow"
              >
                <FiDownload className="h-4 w-4" />
                Backup Now
              </button>
              
              <label className="inline-flex items-center gap-2 px-6 py-4 bg-slate-600 text-white rounded-xl hover:bg-slate-700 transition-colors font-medium cursor-pointer shadow">
                <FiUpload className="h-4 w-4" />
                Restore from Backup
                <input
                  type="file"
                  accept=".json"
                  onChange={handleRestore}
                  className="hidden"
                />
              </label>
              
              <button
                onClick={handleDeleteAll}
                className="inline-flex items-center gap-2 px-6 py-4 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium cursor-pointer shadow"
              >
                <FiTrash2 className="h-4 w-4" />
                Delete All Data
              </button>
            </div>
          </div>
        )}

        {/* Save Button - Only show on Company Settings */}
        {activeTab === 'company' && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 rounded-b-2xl flex justify-end">
            <button
              onClick={handleSubmit}
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium cursor-pointer"
            >
              <FiSave className="h-4 w-4" />
              Save Settings
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl ring-1 ring-slate-200/70">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <FiTrash2 className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Delete All Data</h3>
              <p className="text-sm text-slate-600 mb-6">
                Are you sure you want to delete all data? This action cannot be undone and will permanently remove all your settings and information.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={cancelDelete}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer shadow"
                >
                  Delete All Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
