import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function ShopDashboard() {
  const navigate = useNavigate()
  
  useEffect(() => {
    // Redirect to new shop portal
    navigate('/shop', { replace: true })
  }, [navigate])
  
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-slate-600">Redirecting to Shop Portal...</p>
      </div>
    </div>
  )
}
