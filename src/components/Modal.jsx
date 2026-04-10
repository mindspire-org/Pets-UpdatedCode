import React from "react";
import { FiX, FiAlertCircle, FiCheckCircle, FiInfo } from "react-icons/fi";

export default function Modal({
  isOpen,
  onClose,
  title,
  message,
  type = "info", // 'info', 'success', 'error', 'confirm'
  onConfirm,
  confirmText = "OK",
  cancelText = "Cancel",
  showCancel = false,
}) {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case "success":
        return <FiCheckCircle className="w-12 h-12 text-green-500" />;
      case "error":
        return <FiAlertCircle className="w-12 h-12 text-red-500" />;
      case "confirm":
        return <FiAlertCircle className="w-12 h-12 text-yellow-500" />;
      default:
        return <FiInfo className="w-12 h-12 text-blue-500" />;
    }
  };

  const getButtonColor = () => {
    switch (type) {
      case "success":
        return "bg-green-600 hover:bg-green-700";
      case "error":
        return "bg-red-600 hover:bg-red-700";
      case "confirm":
        return "bg-yellow-600 hover:bg-yellow-700";
      default:
        return "bg-blue-600 hover:bg-blue-700";
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <FiX size={24} />
            </button>
          </div>

          <div className="flex flex-col items-center text-center mb-6">
            <div className="mb-4">{getIcon()}</div>
            <p className="text-gray-700 whitespace-pre-line">{message}</p>
          </div>

          <div className="flex gap-3 justify-end">
            {showCancel && (
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                {cancelText}
              </button>
            )}
            <button
              onClick={() => {
                if (onConfirm) onConfirm();
                onClose();
              }}
              className={`px-4 py-2 text-white rounded-lg ${getButtonColor()}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
