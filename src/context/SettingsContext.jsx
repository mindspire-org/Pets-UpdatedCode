import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { settingsAPI, pharmacySettingsAPI } from '../services/api'

const KEY = 'phms_settings_v1'
const SettingsContext = createContext(null)

const normalizeCompanyName = (name) => {
  if (!name) return name
  const lower = String(name).trim().toLowerCase()
  if (lower === 'abbottabad pet hospital management system') {
    return 'Abbottabad Pet Hospital'
  }
  return name
}

const DEFAULTS = {
  companyName: 'Abbottabad Pet Hospital',
  phone: '',
  address: '',
  companyLogo: '', // data URL saved from Settings page
}

export function SettingsProvider({ children }){
  const [settings, setSettings] = useState(DEFAULTS)
  const [loading, setLoading] = useState(true)

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true)
      
      // Check for pharmacy user first to load shared pharmacy settings
      const pharmacyAuth = JSON.parse(localStorage.getItem('pharmacy_auth') || '{}')
      const isPharmacy = !!pharmacyAuth.username
      
      let response;
      if (isPharmacy) {
        // Fetch from the NEW shared pharmacy settings collection
        response = await pharmacySettingsAPI.get()
      } else {
        // Fallback for admin/other portals
        const user = JSON.parse(localStorage.getItem('user') || '{}')
        response = await settingsAPI.get(user.username || 'admin')
      }

      if (response && response.data) {
        const data = response.data
        const migrated = { ...data }
        
        // Map pharmacy fields to global context fields
        if (data.pharmacyName) migrated.companyName = data.pharmacyName
        if (data.companyLogo) migrated.companyLogo = data.companyLogo
        
        if (migrated.companyName) {
          migrated.companyName = normalizeCompanyName(migrated.companyName)
        }
        setSettings({ ...DEFAULTS, ...migrated })
      }
    } catch (err) {
      console.warn('Failed to load settings from MongoDB, using defaults:', err)
      // Try localStorage as fallback
      try {
        const raw = localStorage.getItem(KEY)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (parsed.companyName) {
            parsed.companyName = normalizeCompanyName(parsed.companyName)
          }
          setSettings({ ...DEFAULTS, ...parsed })
        }
      } catch {}
    } finally {
      setLoading(false)
    }
  }, [])

  // Load settings from MongoDB on mount
  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // Save settings to MongoDB whenever they change
  const saveToMongoDB = async (newSettings) => {
    try {
      await settingsAPI.save({
        userId: 'admin',
        ...newSettings
      })
      // Also save to localStorage as backup
      localStorage.setItem(KEY, JSON.stringify(newSettings))
    } catch (err) {
      console.error('Failed to save settings to MongoDB:', err)
      // Fallback to localStorage only
      try {
        localStorage.setItem(KEY, JSON.stringify(newSettings))
      } catch (localErr) {
        console.warn('Failed to persist settings:', localErr)
      }
    }
  }

  const value = useMemo(() => ({
    settings,
    loading,
    setSettings,
    refresh: loadSettings,
    save: async (partial) => {
      const newSettings = { ...settings, ...partial }
      setSettings(newSettings)
      await saveToMongoDB(newSettings)
    },
    reset: async () => {
      setSettings(DEFAULTS)
      await saveToMongoDB(DEFAULTS)
    },
    exportJSON: () => {
      const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'settings.json'
      a.click()
      URL.revokeObjectURL(url)
    },
    importJSON: async (obj) => {
      if (!obj || typeof obj !== 'object') return
      const newSettings = { ...settings, ...obj }
      setSettings(newSettings)
      await saveToMongoDB(newSettings)
    },
    clearStorage: async () => {
      try { localStorage.removeItem(KEY) } catch {}
      setSettings(DEFAULTS)
      await saveToMongoDB(DEFAULTS)
    }
  }), [settings, loading])

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  )
}

export function useSettings(){
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
