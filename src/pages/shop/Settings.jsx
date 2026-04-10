import React, { useState, useEffect } from 'react'
import { FiDownload, FiUpload, FiTrash2, FiAlertTriangle, FiDatabase, FiSettings, FiTag } from 'react-icons/fi'
import { backupAPI } from '../../services/api'

export default function ShopSettings() {
  const [importFile, setImportFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [confirmDialog, setConfirmDialog] = useState({ show: false, title: '', message: '', onConfirm: null })
  
  // Sticker settings
  const [stickerSettings, setStickerSettings] = useState({
    companyName: '',
    phone: ''
  })

  useEffect(() => {
    // Load sticker settings from localStorage
    setStickerSettings({
      companyName: localStorage.getItem('companyName') || 'Abbottabad Pet Hospital',
      phone: localStorage.getItem('phone') || '0345-0520451'
    })
  }, [])

  const handleSaveStickerSettings = () => {
    localStorage.setItem('companyName', stickerSettings.companyName)
    localStorage.setItem('phone', stickerSettings.phone)
    setMessage('Sticker settings saved successfully.')
    setTimeout(() => setMessage(''), 3000)
  }

  const pickShopOnly = (data) => {
    if (!data) return { products: [], sales: [], suppliers: [] }
    const { products = [], sales = [], suppliers = [] } = data
    return { products, sales, suppliers }
  }

  const handleExport = async () => {
    try {
      setBusy(true); setMessage('')
      const res = await backupAPI.exportAll()
      const payload = pickShopOnly(res.data || res)
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      a.href = url
      a.download = `shop-backup-${ts}.json`
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

  const handleImport = async () => {
    if (!importFile) { setMessage('Please select a JSON file to import.'); return }
    try {
      setBusy(true); setMessage('')
      const text = await importFile.text()
      let json
      try { json = JSON.parse(text) } catch { throw new Error('Invalid JSON file') }
      const payload = pickShopOnly(json)
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
      title: 'Delete Shop Data',
      message: 'This will DELETE all Shop data (Products, Sales, Suppliers). This action cannot be undone. Continue?',
      onConfirm: async () => {
        try {
          setBusy(true); setMessage('');
          await backupAPI.clearShop();
          setMessage('Shop data cleared successfully.');
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
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-600 bg-clip-text text-transparent mb-2 flex items-center justify-center gap-2">
          <FiSettings /> Shop Settings
        </h1>
        <p className="text-slate-600 text-lg">Backup, restore, and manage Shop portal data</p>
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

      {/* Sticker Settings Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 grid place-items-center">
            <FiTag />
          </div>
          <div>
            <h2 className="font-semibold text-lg">Sticker Settings</h2>
            <p className="text-sm text-slate-600">Configure information displayed on product stickers</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Hospital/Shop Name
            </label>
            <input
              type="text"
              value={stickerSettings.companyName}
              onChange={(e) => setStickerSettings({ ...stickerSettings, companyName: e.target.value })}
              placeholder="e.g., Abbottabad Pet Hospital"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Phone Number
            </label>
            <input
              type="text"
              value={stickerSettings.phone}
              onChange={(e) => setStickerSettings({ ...stickerSettings, phone: e.target.value })}
              placeholder="e.g., 0345-0520451"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        <div className="flex items-start gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-700 mb-4">
          <FiTag className="mt-0.5 flex-shrink-0" />
          <p>This information will appear at the top of all printed product stickers (58mm x 30mm labels).</p>
        </div>

        <button
          onClick={handleSaveStickerSettings}
          className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors"
        >
          Save Sticker Settings
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 grid place-items-center"><FiDownload /></div>
            <div className="font-semibold">Export Shop Data</div>
          </div>
          <p className="text-sm text-slate-600 mb-4">Download products, sales, and suppliers as JSON.</p>
          <button disabled={busy} onClick={handleExport} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-60">
            <FiDownload className="w-4 h-4"/> Export JSON
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 grid place-items-center"><FiUpload /></div>
            <div className="font-semibold">Import Shop Data</div>
          </div>
          <p className="text-sm text-slate-600 mb-3">Select a previously exported JSON file to restore.</p>
          <input type="file" accept="application/json" onChange={(e)=>setImportFile(e.target.files?.[0]||null)} className="block w-full text-sm mb-3" />
          <button disabled={busy || !importFile} onClick={handleImport} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm disabled:opacity-60">
            <FiUpload className="w-4 h-4"/> Import JSON
          </button>
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3 text-red-700">
            <div className="w-10 h-10 rounded-xl bg-red-100 grid place-items-center"><FiTrash2 /></div>
            <div className="font-semibold">Delete Shop Data</div>
          </div>
          <div className="flex items-start gap-2 text-sm text-red-700 mb-4">
            <FiAlertTriangle className="mt-0.5"/>
            <p>Danger action. This will permanently delete products, sales, and suppliers.</p>
          </div>
          <button disabled={busy} onClick={handleDelete} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm disabled:opacity-60">
            <FiTrash2 className="w-4 h-4"/> Delete All
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 flex items-center gap-2">
        <FiDatabase className="text-slate-400"/> Scope: Shop collections only (Products, Sales, Suppliers). Export/Import works with JSON files produced here.
      </div>
    </div>
  )
}
