import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../../components/Navbar'

export default function LabDashboard() {
  const navigate = useNavigate()
  
  useEffect(() => {
    // Check if user is authenticated
    const auth = localStorage.getItem('lab_auth')
    if (!auth) {
      navigate('/lab/login')
    }
  }, [navigate])
  
  return (
    <div className="min-h-screen bg-hospital-blue">
      <Navbar title="Laboratory Dashboard" />
      <div className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-semibold text-slate-800">Welcome to Laboratory Dashboard</h1>
      </div>
    </div>
  )
}
