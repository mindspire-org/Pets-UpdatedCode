import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LoginForm from '../components/LoginForm'
import { useActivity } from '../context/ActivityContext'
import { usersAPI } from '../services/api'

export default function ShopLogin() {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { addActivity } = useActivity()

  const normalizeSidebarPermissions = (sp) => {
    if (!sp) return {}
    if (typeof sp?.entries === 'function') {
      try {
        return Object.fromEntries(sp.entries())
      } catch {}
    }
    if (typeof sp === 'object' && !Array.isArray(sp)) return sp
    return {}
  }
  
  const handleSubmit = async ({ username, password }) => {
    try {
      setLoading(true)
      setError('')
      
      const response = await usersAPI.login({ username, password })
      
      if (response && response.data) {
        const user = response.data
        const userRole = user.role?.toLowerCase()
        
        if (userRole === 'shop' || userRole === 'admin') {
          // Check if user has shop portal access
          const hasPortalAccess = user.portalAccess?.map(p => p.toLowerCase()).includes('shop')
          if (userRole !== 'admin' && !hasPortalAccess) {
            setError('Access denied. You do not have permission to access the Shop Portal. Contact your administrator.')
            return
          }
          
          localStorage.setItem('portal', 'shop')
          localStorage.setItem('shop_auth', JSON.stringify({ 
            username: user.username,
            name: user.name,
            role: user.role, // Keep original casing for display
            sidebarPermissions: normalizeSidebarPermissions(user.sidebarPermissions),
            portalAccess: user.portalAccess || []
          }))
          try { addActivity({ user: 'Shop', text: `Login successful: ${user.username}` }) } catch {}
          navigate('/shop')
        } else {
          setError('Access denied. Shop or Admin role required.')
        }
      } else {
        setError('Invalid username or password')
      }
    } catch (err) {
      console.error('Login error:', err)
      setError('Invalid username or password')
    } finally {
      setLoading(false)
    }
  }
  
  return <LoginForm title="Pets Shop Portal" onSubmit={handleSubmit} error={error} loading={loading} />
}
