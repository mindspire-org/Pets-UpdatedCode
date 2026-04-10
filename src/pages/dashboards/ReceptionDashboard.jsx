import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../../components/Navbar'

export default function ReceptionDashboard() {
  const navigate = useNavigate()
  
  useEffect(() => {
    // Check if user is authenticated
    const auth = localStorage.getItem('reception_auth')
    if (!auth) {
      navigate('/reception/login')
    }
  }, [navigate])
  
  return (
    <div className="min-h-screen bg-hospital-blue">
      <Navbar title="Reception Dashboard" />
      <div className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-semibold text-slate-800">Welcome to Reception Dashboard</h1>
      </div>
    </div>
  )
}
