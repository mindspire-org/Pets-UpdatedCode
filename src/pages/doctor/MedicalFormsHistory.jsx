import React, { useEffect, useState } from 'react'
import { medicalFormsAPI } from '../../services/api'
import { useAlert } from '../../context/AlertContext'

export default function MedicalFormsHistory() {
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all, treatment, blood
  const { success, error } = useAlert()

  useEffect(() => {
    loadForms()
  }, [])

  const loadForms = async () => {
    try {
      setLoading(true)
      const response = await medicalFormsAPI.getAll()
      if (response.success) {
        setForms(response.data || [])
      }
    } catch (err) {
      console.error('Error loading forms:', err)
      error('Failed to load medical forms')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this form?')) return
    
    try {
      await medicalFormsAPI.delete(id)
      success('Form deleted successfully')
      loadForms()
    } catch (err) {
      error('Failed to delete form')
    }
  }

  const filteredForms = forms.filter(form => {
    if (filter === 'all') return true
    if (filter === 'treatment') return form.formType === 'Treatment Chart'
    if (filter === 'blood') return form.formType === 'Blood Transfusion'
    return true
  })

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Medical Forms History</h1>
        <p className="text-slate-600">View all saved medical forms</p>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
          }`}
        >
          All Forms ({forms.length})
        </button>
        <button
          onClick={() => setFilter('treatment')}
          className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
            filter === 'treatment'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
          }`}
        >
          Treatment Charts ({forms.filter(f => f.formType === 'Treatment Chart').length})
        </button>
        <button
          onClick={() => setFilter('blood')}
          className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
            filter === 'blood'
              ? 'bg-red-600 text-white'
              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
          }`}
        >
          Blood Transfusions ({forms.filter(f => f.formType === 'Blood Transfusion').length})
        </button>
      </div>

      {/* Forms List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-4 text-slate-600">Loading forms...</p>
        </div>
      ) : filteredForms.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl">
          <svg className="w-16 h-16 mx-auto text-slate-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-slate-600 text-lg">No forms found</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredForms.map((form) => (
            <div key={form._id} className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      form.formType === 'Treatment Chart'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {form.formType}
                    </span>
                    <span className="text-sm text-slate-500">
                      {formatDate(form.createdAt)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Patient ID</p>
                      <p className="font-semibold text-slate-800">{form.patientId}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Animal Name</p>
                      <p className="font-semibold text-slate-800">{form.animalName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Owner Name</p>
                      <p className="font-semibold text-slate-800">{form.ownerName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Species</p>
                      <p className="font-semibold text-slate-800">{form.species || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-slate-600">
                    {form.bodyWeight && (
                      <span>Weight: {form.bodyWeight} kg</span>
                    )}
                    {form.age && (
                      <span>Age: {form.age}</span>
                    )}
                    {form.createdBy && (
                      <span>By: {form.createdBy}</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleDelete(form._id)}
                    className="px-3 py-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 font-semibold text-sm transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
