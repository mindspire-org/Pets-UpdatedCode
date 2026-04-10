import React from 'react'
import { useAlert } from '../context/AlertContext'

/**
 * Demo component showing all alert types
 * Use this as a reference for implementing alerts in your components
 */
export default function AlertDemo() {
  const { success, error, warning, info, confirm } = useAlert()

  const handleSuccess = () => {
    success('Operation completed successfully!')
  }

  const handleError = () => {
    error('An error occurred while processing your request')
  }

  const handleWarning = () => {
    warning('This action requires admin approval')
  }

  const handleInfo = () => {
    info('Your request is being processed')
  }

  const handleLongMessage = () => {
    success('This is a longer message to demonstrate how the alert handles multiple lines of text gracefully', 5000)
  }

  const handleConfirm = async () => {
    const confirmed = await confirm(
      'Are you sure you want to proceed with this action?',
      {
        title: 'Confirm Action',
        confirmText: 'Yes, Proceed',
        cancelText: 'Cancel',
        type: 'warning'
      }
    )

    if (confirmed) {
      success('Action confirmed!')
    } else {
      info('Action cancelled')
    }
  }

  const handleDangerConfirm = async () => {
    const confirmed = await confirm(
      'This will permanently delete all data. This action cannot be undone.',
      {
        title: 'Delete All Data',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        type: 'danger'
      }
    )

    if (confirmed) {
      error('Data deleted (demo only)')
    }
  }

  const handleMultipleAlerts = () => {
    info('Processing step 1...')
    setTimeout(() => info('Processing step 2...'), 500)
    setTimeout(() => info('Processing step 3...'), 1000)
    setTimeout(() => success('All steps completed!'), 1500)
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Alert System Demo</h1>
        <p className="text-slate-600">Click the buttons below to see different alert types</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Success Alert */}
        <button
          onClick={handleSuccess}
          className="h-24 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold hover:shadow-lg transition-all"
        >
          Success Alert
        </button>

        {/* Error Alert */}
        <button
          onClick={handleError}
          className="h-24 px-6 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white font-semibold hover:shadow-lg transition-all"
        >
          Error Alert
        </button>

        {/* Warning Alert */}
        <button
          onClick={handleWarning}
          className="h-24 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold hover:shadow-lg transition-all"
        >
          Warning Alert
        </button>

        {/* Info Alert */}
        <button
          onClick={handleInfo}
          className="h-24 px-6 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold hover:shadow-lg transition-all"
        >
          Info Alert
        </button>

        {/* Long Message */}
        <button
          onClick={handleLongMessage}
          className="h-24 px-6 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 text-white font-semibold hover:shadow-lg transition-all"
        >
          Long Message (5s)
        </button>

        {/* Multiple Alerts */}
        <button
          onClick={handleMultipleAlerts}
          className="h-24 px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-semibold hover:shadow-lg transition-all"
        >
          Multiple Alerts
        </button>

        {/* Confirm Dialog */}
        <button
          onClick={handleConfirm}
          className="h-24 px-6 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold hover:shadow-lg transition-all"
        >
          Confirm Dialog
        </button>

        {/* Danger Confirm */}
        <button
          onClick={handleDangerConfirm}
          className="h-24 px-6 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 text-white font-semibold hover:shadow-lg transition-all"
        >
          Danger Confirm
        </button>
      </div>

      {/* Code Examples */}
      <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Usage Examples</h3>
        <div className="space-y-4 text-sm">
          <div>
            <div className="font-semibold text-slate-700 mb-1">Success Alert:</div>
            <code className="block bg-white p-3 rounded-lg border border-slate-200">
              success('Operation completed successfully!')
            </code>
          </div>
          <div>
            <div className="font-semibold text-slate-700 mb-1">Confirmation Dialog:</div>
            <code className="block bg-white p-3 rounded-lg border border-slate-200">
              {`const confirmed = await confirm('Are you sure?', {
  title: 'Confirm Action',
  type: 'danger'
})
if (confirmed) { /* do something */ }`}
            </code>
          </div>
        </div>
      </div>
    </div>
  )
}
