import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiUser, FiPhone, FiPackage, FiDollarSign, FiCheck, FiX } from 'react-icons/fi'
import { pharmacySalesAPI, pharmacyMedicinesAPI } from '../../services/api'

export default function PharmacyReferrals() {
  const navigate = useNavigate()
  const [referrals, setReferrals] = useState([])
  const [medicines, setMedicines] = useState([])
  const [selectedReferral, setSelectedReferral] = useState(null)
  const [showBillModal, setShowBillModal] = useState(false)
  const [billItems, setBillItems] = useState([])
  const [amountPaid, setAmountPaid] = useState(0)
  const [loading, setLoading] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)

  useEffect(() => {
    loadReferrals()
    loadMedicines()
  }, [])

  const loadReferrals = () => {
    try {
      const stored = JSON.parse(localStorage.getItem('pharmacy_referrals') || '[]')
      setReferrals(Array.isArray(stored) ? stored : [])
    } catch (e) {
      console.error('Error loading referrals:', e)
    }
  }

  const updateReferralStatus = (referralId, status) => {
    try {
      const allReferrals = JSON.parse(localStorage.getItem('pharmacy_referrals') || '[]')
      const updated = (Array.isArray(allReferrals) ? allReferrals : []).map(r =>
        r.id === referralId ? { ...r, status, ...(status === 'Cancelled' ? { cancelledAt: new Date().toISOString() } : {}) } : r
      )
      localStorage.setItem('pharmacy_referrals', JSON.stringify(updated))
      setReferrals(updated)
    } catch (e) {
      console.error('Error updating referral status:', e)
    }
  }

  const startGenerateInPOS = (referral) => {
    try {
      const payload = {
        timestamp: Date.now(),
        customerName: referral?.ownerName || '',
        customerContact: referral?.contact || '',
        petName: referral?.petName || '',
        patientId: referral?.patientId || '',
        clientId: referral?.clientId || '',
        address: '',
        referralId: referral?.id || '',
        referralItems: Array.isArray(referral?.medicines) ? referral.medicines : [],
      }
      localStorage.setItem('pharmacy_pos_data', JSON.stringify(payload))
    } catch (e) {
      console.error('Error preparing POS payload from referral:', e)
    }
    navigate('/pharmacy/pos')
  }

  const loadMedicines = async () => {
    try {
      const response = await pharmacyMedicinesAPI.getAll()
      setMedicines(response.data || [])
    } catch (e) {
      console.error('Error loading medicines:', e)
    }
  }

  const handleViewReferral = (referral) => {
    setSelectedReferral(referral)
    // Map medicines to bill items with prices from pharmacy inventory
    const items = referral.medicines.map(med => {
      // Vaccine items are not part of pharmacy inventory; keep them as non-billable by default.
      if (med?.isVaccine) {
        return {
          ...med,
          price: 0,
          stock: 0,
          medicineId: null,
          quantity: 1,
          nonInventory: true,
        }
      }

      // Try to find exact match first
      let pharmacyMed = medicines.find(m => 
        m.name?.toLowerCase().trim() === med.name?.toLowerCase().trim()
      )
      
      // If no exact match, try partial match
      if (!pharmacyMed) {
        pharmacyMed = medicines.find(m => 
          m.name?.toLowerCase().includes(med.name?.toLowerCase()) ||
          med.name?.toLowerCase().includes(m.name?.toLowerCase())
        )
      }
      
      return {
        ...med,
        price: pharmacyMed?.price || pharmacyMed?.salePrice || 0,
        stock: pharmacyMed?.stock || pharmacyMed?.quantity || 0,
        medicineId: pharmacyMed?._id || pharmacyMed?.id,
        quantity: 1
      }
    })
    setBillItems(items)
    setAmountPaid(0)
    setShowBillModal(true)
  }

  const calculateTotal = () => {
    return billItems.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0)
  }

  const printReceipt = (saleData) => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Please allow popups to print receipt')
      return
    }

    const receiptHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Pharmacy Bill - ${saleData.id}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Courier New', monospace;
            width: 80mm;
            padding: 10mm;
            font-size: 12px;
          }
          .header {
            text-align: center;
            margin-bottom: 10px;
            border-bottom: 2px dashed #000;
            padding-bottom: 10px;
          }
          .header h1 {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .header p {
            font-size: 10px;
            margin: 2px 0;
          }
          .section {
            margin: 10px 0;
            padding: 5px 0;
          }
          .section-title {
            font-weight: bold;
            font-size: 11px;
            margin-bottom: 5px;
            text-transform: uppercase;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin: 3px 0;
            font-size: 11px;
          }
          .items-table {
            width: 100%;
            margin: 10px 0;
            border-top: 1px dashed #000;
            border-bottom: 1px dashed #000;
            padding: 5px 0;
          }
          .items-header {
            display: flex;
            justify-content: space-between;
            font-weight: bold;
            margin-bottom: 5px;
            font-size: 10px;
          }
          .item-row {
            display: flex;
            justify-content: space-between;
            margin: 3px 0;
            font-size: 11px;
          }
          .item-name {
            flex: 2;
          }
          .item-qty {
            flex: 1;
            text-align: center;
          }
          .item-price {
            flex: 1;
            text-align: right;
          }
          .totals {
            margin-top: 10px;
            border-top: 2px dashed #000;
            padding-top: 10px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
            font-size: 12px;
          }
          .total-row.grand {
            font-weight: bold;
            font-size: 14px;
            margin-top: 5px;
            padding-top: 5px;
            border-top: 1px solid #000;
          }
          .footer {
            text-align: center;
            margin-top: 15px;
            padding-top: 10px;
            border-top: 2px dashed #000;
            font-size: 10px;
          }
          @media print {
            body { width: 80mm; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>PHARMACY BILL</h1>
          <p>Abbottabad Pet Hospital</p>
          <p>Pharmacy Department</p>
        </div>

        <div class="section">
          <div class="info-row">
            <span>Bill No:</span>
            <span><strong>${saleData.id}</strong></span>
          </div>
          <div class="info-row">
            <span>Date:</span>
            <span>${new Date(saleData.createdAt).toLocaleDateString()}</span>
          </div>
          <div class="info-row">
            <span>Time:</span>
            <span>${new Date(saleData.createdAt).toLocaleTimeString()}</span>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Customer Details</div>
          <div class="info-row">
            <span>Pet Name:</span>
            <span>${saleData.petName || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span>Owner:</span>
            <span>${saleData.customerName || 'N/A'}</span>
          </div>
          ${saleData.customerContact ? `
          <div class="info-row">
            <span>Contact:</span>
            <span>${saleData.customerContact}</span>
          </div>
          ` : ''}
          ${saleData.doctor ? `
          <div class="info-row">
            <span>Doctor:</span>
            <span>Dr. ${saleData.doctor}</span>
          </div>
          ` : ''}
        </div>

        <div class="items-table">
          <div class="items-header">
            <div class="item-name">Item</div>
            <div class="item-qty">Qty</div>
            <div class="item-price">Price</div>
          </div>
          ${saleData.items.map(item => `
            <div class="item-row">
              <div class="item-name">${item.name}</div>
              <div class="item-qty">${item.quantity}</div>
              <div class="item-price">Rs. ${item.total.toFixed(2)}</div>
            </div>
          `).join('')}
        </div>

        <div class="totals">
          <div class="total-row">
            <span>Subtotal:</span>
            <span>Rs. ${saleData.subtotal.toFixed(2)}</span>
          </div>
          ${saleData.discount > 0 ? `
          <div class="total-row">
            <span>Discount:</span>
            <span>- Rs. ${saleData.discount.toFixed(2)}</span>
          </div>
          ` : ''}
          <div class="total-row grand">
            <span>TOTAL:</span>
            <span>Rs. ${saleData.totalAmount.toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span>Paid:</span>
            <span>Rs. ${saleData.receivedAmount.toFixed(2)}</span>
          </div>
          ${saleData.newTotalDue > 0 ? `
          <div class="total-row" style="color: #d00;">
            <span>Balance Due:</span>
            <span>Rs. ${saleData.newTotalDue.toFixed(2)}</span>
          </div>
          ` : ''}
        </div>

        <div class="footer">
          <p>Thank you for your business!</p>
          <p>Get well soon!</p>
          <p style="margin-top: 10px; font-size: 9px;">
            This is a computer generated receipt
          </p>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              setTimeout(function() {
                window.close();
              }, 100);
            }, 250);
          };
        </script>
      </body>
      </html>
    `

    printWindow.document.write(receiptHTML)
    printWindow.document.close()
  }

  const handleGenerateBill = async () => {
    if (!selectedReferral) return
    
    const total = calculateTotal()
    const paid = Number(amountPaid) || 0
    const remaining = Math.max(0, total - paid)

    // Get clientId - try multiple sources
    let clientId = selectedReferral.clientId || ''
    
    // If no clientId, try to get it from pet records
    if (!clientId && selectedReferral.patientId) {
      try {
        const pets = JSON.parse(localStorage.getItem('reception_pets') || '[]')
        const pet = pets.find(p => 
          (p.id === selectedReferral.patientId) ||
          (p._id === selectedReferral.patientId) ||
          (p.petId === selectedReferral.patientId)
        )
        if (pet) {
          clientId = pet.clientId || pet.details?.owner?.clientId || pet.details?.owner?.ownerId || ''
        }
      } catch (e) {
        console.error('Error looking up clientId from pet:', e)
      }
    }

    console.log('Referral data:', selectedReferral)
    console.log('Resolved clientId:', clientId)

    setLoading(true)
    try {
      // Create pharmacy sale
      const saleData = {
        id: `SALE-${Date.now()}`,
        clientId: clientId,
        customerName: selectedReferral.ownerName,
        customerContact: selectedReferral.contact || '',
        petName: selectedReferral.petName,
        items: billItems.map(item => ({
          medicineId: item?.nonInventory ? undefined : item.medicineId,
          name: item.name,
          quantity: Number(item.quantity) || 1,
          price: Number(item.price) || 0,
          total: (Number(item.price) || 0) * (Number(item.quantity) || 1)
        })),
        subtotal: total,
        discount: 0,
        totalAmount: total,
        receivedAmount: paid,
        previousDue: 0,
        newTotalDue: remaining,
        paymentMethod: paid > 0 ? 'Cash' : 'Credit',
        referralId: selectedReferral.id,
        prescriptionId: selectedReferral.prescriptionId,
        doctor: selectedReferral.doctor?.name || selectedReferral.doctor?.username || '',
        createdAt: new Date().toISOString()
      }

      console.log('Creating pharmacy sale with clientId:', saleData.clientId, 'Full data:', saleData)

      // Try to save to API, fallback to localStorage
      try {
        await pharmacySalesAPI.create(saleData)
        console.log('Sale saved to API successfully')
      } catch (apiError) {
        console.warn('API save failed, saving to localStorage:', apiError)
        // Fallback: Save to localStorage
        const sales = JSON.parse(localStorage.getItem('pharmacy_sales') || '[]')
        localStorage.setItem('pharmacy_sales', JSON.stringify([saleData, ...sales]))
      }

      // Trigger financial update event
      try {
        localStorage.setItem('financial_updated_at', Date.now().toString())
        window.dispatchEvent(new Event('financial-updated'))
      } catch {}

      // Print receipt
      printReceipt(saleData)

      // Show success modal instead of alert
      setShowBillModal(false)
      setSelectedReferral(null)
      setBillItems([])
      setAmountPaid(0)
      setShowSuccessModal(true)
      
      // Auto-close success modal after 3 seconds
      setTimeout(() => {
        setShowSuccessModal(false)
        loadReferrals()
      }, 3000)
    } catch (e) {
      console.error('Error generating bill:', e)
      // Keep modal open and show error
      setLoading(false)
      alert(`Failed to generate bill: ${e.message || 'Unknown error'}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 bg-clip-text text-transparent mb-2">
          Doctor Referrals
        </h1>
        <p className="text-slate-600 text-lg">Process prescription referrals from doctors</p>
      </div>

      {/* Referrals List */}
      <div className="rounded-3xl bg-gradient-to-br from-white via-purple-50 to-pink-50 shadow-2xl ring-1 ring-purple-200 border border-purple-100 p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
            <FiPackage className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-800">Pending Referrals</div>
            <div className="text-sm text-slate-600">{referrals.length} referrals waiting</div>
          </div>
        </div>

        {referrals.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiPackage className="w-8 h-8 text-slate-400" />
            </div>
            <div className="text-slate-500 text-lg font-medium">No pending referrals</div>
            <div className="text-slate-400 text-sm mt-1">Referrals from doctoPKR will appear here</div>
          </div>
        ) : (
          <div className="space-y-4">
            {referrals.map((referral) => (
              <div key={referral.id} className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100 hover:shadow-xl transition-all duration-300">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg flex items-center justify-center">
                        <FiUser className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 text-lg">{referral.petName}</div>
                        <div className="text-sm text-slate-600">Owner: {referral.ownerName}</div>
                      </div>
                      <div className="ml-auto">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          (referral.status || 'Pending') === 'Pending' ? 'bg-amber-100 text-amber-700' :
                          (referral.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700')
                        }`}>
                          {referral.status || 'Pending'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <FiPhone className="w-4 h-4" />
                        <span>{referral.contact || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <FiUser className="w-4 h-4" />
                        <span>Dr. {referral.doctor?.name || referral.doctor?.username || 'Unknown'}</span>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-xs font-semibold text-slate-500 mb-2">MEDICINES ({referral.medicines?.length || 0})</div>
                      <div className="space-y-1">
                        {referral.medicines?.slice(0, 3).map((med, idx) => (
                          <div key={idx} className="text-sm text-slate-700">
                            • {med.name} {med.dosage && `- ${med.dosage}`}
                          </div>
                        ))}
                        {referral.medicines?.length > 3 && (
                          <div className="text-xs text-slate-500">+ {referral.medicines.length - 3} more...</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 ml-4">
                    {(referral.status || 'Pending') === 'Pending' ? (
                      <>
                        <button
                          onClick={() => startGenerateInPOS(referral)}
                          className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-green-600 text-white font-semibold hover:from-emerald-700 hover:to-green-700 transition-all duration-200 flex items-center gap-2"
                        >
                          <FiCheck className="w-4 h-4" />
                          Generate Bill
                        </button>
                        <button
                          onClick={() => updateReferralStatus(referral.id, 'Cancelled')}
                          className="px-4 py-2 rounded-lg bg-gradient-to-r from-slate-500 to-slate-600 text-white font-semibold hover:from-slate-600 hover:to-slate-700 transition-all duration-200 flex items-center gap-2"
                        >
                          <FiX className="w-4 h-4" />
                          Cancel
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bill Modal */}
      {showBillModal && selectedReferral && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Generate Bill</h2>
                  <p className="text-purple-100 text-sm mt-1">{selectedReferral.petName} - {selectedReferral.ownerName}</p>
                </div>
                <button
                  onClick={() => {
                    setShowBillModal(false)
                    setSelectedReferral(null)
                    setBillItems([])
                    setAmountPaid(0)
                  }}
                  className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all duration-200"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Bill Items */}
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-4">Medicines</h3>
                <div className="space-y-3">
                  {billItems.map((item, idx) => (
                    <div key={idx} className="bg-slate-50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold text-slate-800">{item.name}</div>
                        <div className="text-sm text-slate-600">Stock: {item.stock}</div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs text-slate-600 mb-1 block">Quantity</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => {
                              const newItems = [...billItems]
                              newItems[idx].quantity = Number(e.target.value) || 1
                              setBillItems(newItems)
                            }}
                            className="w-full px-3 py-2 rounded-lg border-2 border-slate-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-600 mb-1 block">Price (Rs.)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.price}
                            onChange={(e) => {
                              const newItems = [...billItems]
                              newItems[idx].price = Number(e.target.value) || 0
                              setBillItems(newItems)
                            }}
                            className="w-full px-3 py-2 rounded-lg border-2 border-slate-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-600 mb-1 block">Total (Rs.)</label>
                          <div className="px-3 py-2 rounded-lg bg-slate-100 font-semibold text-slate-800">
                            {((Number(item.price) || 0) * (Number(item.quantity) || 1)).toFixed(2)}
                          </div>
                        </div>
                      </div>
                      {item.instructions && (
                        <div className="mt-2 text-xs text-slate-600 bg-blue-50 rounded-lg p-2">
                          <span className="font-semibold">Instructions:</span> {item.instructions}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Section */}
              <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-6 border-2 border-emerald-200">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Payment Details</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Total Amount:</span>
                    <span className="text-2xl font-bold text-slate-800">Rs. {calculateTotal().toFixed(2)}</span>
                  </div>
                  <div>
                    <label className="text-sm text-slate-600 mb-2 block">Amount Paid (Rs.)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(Number(e.target.value) || 0)}
                      className="w-full px-4 py-3 rounded-xl border-2 border-emerald-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 text-lg font-semibold"
                      placeholder="Enter amount paid"
                    />
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t-2 border-emerald-200">
                    <span className="text-slate-600">Remaining (Current Dues):</span>
                    <span className={`text-xl font-bold ${Math.max(0, calculateTotal() - amountPaid) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      Rs. {Math.max(0, calculateTotal() - amountPaid).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleGenerateBill}
                  disabled={loading}
                  className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 text-white font-bold hover:from-emerald-700 hover:to-green-700 disabled:opacity-50 transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <FiCheck className="w-5 h-5" />
                  {loading ? 'Generating...' : 'Generate Bill'}
                </button>
                <button
                  onClick={() => {
                    setShowBillModal(false)
                    setSelectedReferral(null)
                    setBillItems([])
                    setAmountPaid(0)
                  }}
                  className="px-6 py-3 rounded-xl bg-slate-200 text-slate-700 font-bold hover:bg-slate-300 transition-all duration-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full transform animate-slideUp">
            <div className="bg-gradient-to-r from-emerald-500 to-green-600 text-white p-8 rounded-t-3xl text-center">
              <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                <FiCheck className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold mb-2">Bill Generated!</h2>
              <p className="text-emerald-100">Receipt has been printed successfully</p>
            </div>
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiDollarSign className="w-8 h-8 text-emerald-600" />
              </div>
              <p className="text-slate-600 mb-6">
                The bill has been saved and the receipt is being printed. The referral has been marked as completed.
              </p>
              <div className="text-sm text-slate-500">
                This window will close automatically...
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
