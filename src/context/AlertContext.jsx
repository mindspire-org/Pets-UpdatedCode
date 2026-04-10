import React, { createContext, useContext, useState } from 'react'
import { FiCheckCircle, FiAlertCircle, FiInfo, FiAlertTriangle, FiX } from 'react-icons/fi'

const AlertContext = createContext()

export const useAlert = () => {
  const context = useContext(AlertContext)
  if (!context) {
    throw new Error('useAlert must be used within AlertProvider')
  }
  return context
}

export const AlertProvider = ({ children }) => {
  const [alerts, setAlerts] = useState([])
  const [confirmDialog, setConfirmDialog] = useState(null)

  // Show alert (auto-dismiss after duration)
  const showAlert = (message, type = 'info', duration = 3000) => {
    const id = Date.now()
    const alert = { id, message, type }
    
    setAlerts(prev => [...prev, alert])
    
    if (duration > 0) {
      setTimeout(() => {
        removeAlert(id)
      }, duration)
    }
    
    return id
  }

  // Remove specific alert
  const removeAlert = (id) => {
    setAlerts(prev => prev.filter(a => a.id !== id))
  }

  // Convenience methods
  const success = (message, duration) => showAlert(message, 'success', duration)
  const error = (message, duration) => showAlert(message, 'error', duration)
  const warning = (message, duration) => showAlert(message, 'warning', duration)
  const info = (message, duration) => showAlert(message, 'info', duration)

  // Show confirmation dialog
  const confirm = (message, options = {}) => {
    return new Promise((resolve) => {
      setConfirmDialog({
        message,
        title: options.title || 'Confirm',
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        type: options.type || 'warning',
        onConfirm: () => {
          setConfirmDialog(null)
          resolve(true)
        },
        onCancel: () => {
          setConfirmDialog(null)
          resolve(false)
        }
      })
    })
  }

  const value = {
    showAlert,
    success,
    error,
    warning,
    info,
    confirm,
    removeAlert
  }

  return (
    <AlertContext.Provider value={value}>
      {children}
      <AlertContainer alerts={alerts} onRemove={removeAlert} />
      {confirmDialog && <ConfirmDialog {...confirmDialog} />}
    </AlertContext.Provider>
  )
}

// Alert Container Component
const AlertContainer = ({ alerts, onRemove }) => {
  if (alerts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-2 max-w-md">
      {alerts.map(alert => (
        <Alert key={alert.id} {...alert} onClose={() => onRemove(alert.id)} />
      ))}
    </div>
  )
}

// Individual Alert Component
const Alert = ({ id, message, type, onClose }) => {
  const config = {
    success: {
      icon: FiCheckCircle,
      bgColor: 'bg-gradient-to-r from-emerald-500 to-green-600',
      textColor: 'text-white'
    },
    error: {
      icon: FiAlertCircle,
      bgColor: 'bg-gradient-to-r from-red-500 to-rose-600',
      textColor: 'text-white'
    },
    warning: {
      icon: FiAlertTriangle,
      bgColor: 'bg-gradient-to-r from-amber-500 to-orange-600',
      textColor: 'text-white'
    },
    info: {
      icon: FiInfo,
      bgColor: 'bg-gradient-to-r from-blue-500 to-indigo-600',
      textColor: 'text-white'
    }
  }

  const { icon: Icon, bgColor, textColor } = config[type] || config.info

  return (
    <div
      className={`${bgColor} ${textColor} rounded-xl shadow-2xl p-4 flex items-center gap-3 min-w-[320px] animate-slideIn`}
      style={{
        animation: 'slideIn 0.3s ease-out'
      }}
    >
      <div className="flex-shrink-0">
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1 text-sm font-medium">{message}</div>
      <button
        onClick={onClose}
        className="flex-shrink-0 hover:bg-white/20 rounded-lg p-1 transition-colors"
      >
        <FiX className="w-5 h-5" />
      </button>
    </div>
  )
}

// Confirm Dialog Component
const ConfirmDialog = ({ message, title, confirmText, cancelText, type, onConfirm, onCancel }) => {
  const config = {
    warning: {
      icon: FiAlertTriangle,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      confirmBg: 'bg-amber-600 hover:bg-amber-700'
    },
    danger: {
      icon: FiAlertCircle,
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      confirmBg: 'bg-red-600 hover:bg-red-700'
    },
    info: {
      icon: FiInfo,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      confirmBg: 'bg-blue-600 hover:bg-blue-700'
    },
    success: {
      icon: FiCheckCircle,
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      confirmBg: 'bg-green-600 hover:bg-green-700'
    }
  }

  const { icon: Icon, iconBg, iconColor, confirmBg } = config[type] || config.warning

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 animate-fadeIn"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-scaleIn"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 ${iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-6 h-6 ${iconColor}`} />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-slate-800 mb-2">{title}</h3>
            <p className="text-slate-600">{message}</p>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onCancel}
            className="px-5 h-11 rounded-xl border-2 border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-5 h-11 rounded-xl ${confirmBg} text-white font-semibold transition-colors shadow-lg`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

// Add animations to global CSS
const style = document.createElement('style')
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes scaleIn {
    from {
      transform: scale(0.9);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  .animate-slideIn {
    animation: slideIn 0.3s ease-out;
  }

  .animate-fadeIn {
    animation: fadeIn 0.2s ease-out;
  }

  .animate-scaleIn {
    animation: scaleIn 0.2s ease-out;
  }
`
document.head.appendChild(style)
