import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { activityLogsAPI } from '../services/api'

const ActivityContext = createContext(null)

export function ActivityProvider({ children }){
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)

  // Load logs from MongoDB on mount
  useEffect(() => {
    loadLogs()
  }, [])

  const loadLogs = async () => {
    try {
      setLoading(true)
      const response = await activityLogsAPI.getAll()
      if (response && response.data) {
        setLogs(response.data)
      }
    } catch (error) {
      console.error('Error loading activity logs from MongoDB:', error)
      // Fallback to empty array on error
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  const value = useMemo(() => ({
    logs,
    loading,
    addActivity: async ({ user, text }) => {
      try {
        const response = await activityLogsAPI.create({ user, text })
        if (response && response.data) {
          // Add new log to the beginning of the list
          setLogs(prev => [response.data, ...prev].slice(0, 1000))
        }
      } catch (error) {
        console.error('Error adding activity log:', error)
      }
    },
    clear: async () => {
      try {
        await activityLogsAPI.clear()
        setLogs([])
      } catch (error) {
        console.error('Error clearing activity logs:', error)
      }
    },
    refresh: loadLogs,
  }), [logs, loading])

  return <ActivityContext.Provider value={value}>{children}</ActivityContext.Provider>
}

export function useActivity(){
  const ctx = useContext(ActivityContext)
  if (!ctx) throw new Error('useActivity must be used within ActivityProvider')
  return ctx
}
