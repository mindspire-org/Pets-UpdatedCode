import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LoginForm from '../components/LoginForm'
import { useActivity } from '../context/ActivityContext'
import { usersAPI } from '../services/api'

export default function ReceptionLogin() {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { addActivity } = useActivity()
  
  const handleSubmit = async ({ username, password }) => {
    try {
      setLoading(true)
      setError('')
      
      const response = await usersAPI.login({ username, password })
      
      if (response && response.data) {
        const user = response.data
        
        if (user.role === 'reception' || user.role === 'Reception') {
          localStorage.setItem('portal', 'reception')
          localStorage.setItem('reception_auth', JSON.stringify({ 
            username: user.username,
            name: user.name,
            role: user.role
          }))
          try { addActivity({ user: 'Reception', text: `Login successful: ${user.username}` }) } catch {}
          navigate('/reception')
        } else {
          setError('Access denied. Reception role required.')
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
  
  return <LoginForm title="Reception Portal" onSubmit={handleSubmit} error={error} loading={loading} />
}
