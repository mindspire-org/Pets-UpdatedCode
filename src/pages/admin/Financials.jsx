import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { FiDollarSign, FiTrendingUp, FiTrendingDown, FiDownload, FiClipboard, FiShoppingCart, FiCalendar, FiPackage, FiAlertCircle, FiRefreshCw } from 'react-icons/fi'
import { MdLocalPharmacy } from 'react-icons/md'
import { TbMicroscope } from 'react-icons/tb'
import { FaStethoscope } from 'react-icons/fa'
import { petsAPI, appointmentsAPI, financialsAPI, prescriptionsAPI, labReportsAPI, salesAPI, pharmacySalesAPI, expensesAPI, hospitalInventoryAPI, proceduresAPI } from '../../services/api'
import DateRangePicker from '../../components/DateRangePicker'

function toCSV(rows){
  if (!rows || rows.length === 0) return ''
  const headers = Object.keys(rows[0] || {})
  const body = rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))
  return [headers.join(','), ...body].join('\n')
}

// Safe number parsing helper
const toNum = (v) => {
  if (v == null) return 0
  const n = typeof v === 'string' ? Number(v.replace(/,/g, '')) : Number(v)
  return Number.isNaN(n) ? 0 : n
}

// Safe date parsing helper
const toDateStr = (d) => {
  if (!d) return null
  try {
    const date = new Date(d)
    if (isNaN(date.getTime())) return null
    return date.toISOString().slice(0, 10)
  } catch {
    return null
  }
}

export default function Financials(){
  const [range, setRange] = useState('Today')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [debugInfo, setDebugInfo] = useState({})
  const [showDebug, setShowDebug] = useState(false)
  const [dateRange, setDateRange] = useState({
    fromDate: new Date().toISOString().slice(0,10),
    toDate: new Date().toISOString().slice(0,10)
  })
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0,10))

  // MongoDB data
  const [pets, setPets] = useState([])
  const [appointments, setAppointments] = useState([])
  const [financials, setFinancials] = useState([])
  const [prescriptions, setPrescriptions] = useState([])
  const [labReports, setLabReports] = useState([])
  const [shopSales, setShopSales] = useState([])
  const [pharmacySales, setPharmacySales] = useState([])
  const [expenses, setExpenses] = useState([])
  const [hospitalInventory, setHospitalInventory] = useState([])
  const [procedures, setProcedures] = useState([])

  useEffect(() => {
    loadAllData()
  }, [dateRange])

  const loadAllData = async () => {
    if (loading) return
    
    try {
      setLoading(true)
      setError(null)
      const debug = {}
      
      const { fromDate, toDate } = dateRange
      
      // Helper to safely call API with individual error handling
      const safeCall = async (apiFn, name, fallback = []) => {
        try {
          console.log(`[Financials] Loading ${name}...`)
          const res = await apiFn()
          const count = res?.data?.length || 0
          console.log(`[Financials] ${name}: ${count} records`)
          debug[name] = { success: true, count, error: null }
          return res?.data || fallback
        } catch (err) {
          console.error(`[Financials] Error loading ${name}:`, err?.message || err)
          debug[name] = { success: false, count: 0, error: err?.message || 'Unknown error' }
          return fallback
        }
      }
      
      // Helper for date-range API calls
      const safeDateRangeCall = async (apiFn, name, start, end, fallback = []) => {
        try {
          console.log(`[Financials] Loading ${name} for ${start} to ${end}...`)
          const res = await apiFn(start, end)
          const count = res?.data?.length || 0
          console.log(`[Financials] ${name}: ${count} records`)
          debug[name] = { success: true, count, dateRange: { start, end }, error: null }
          return res?.data || fallback
        } catch (err) {
          console.error(`[Financials] Error loading ${name}:`, err?.message || err)
          debug[name] = { success: false, count: 0, error: err?.message || 'Unknown error' }
          return fallback
        }
      }
      
      // Load data with server-side date filtering where available
      const [
        petsData,
        appointmentsData,
        financialsData,
        prescriptionsData,
        labReportsData,
        shopSalesData,
        pharmacySalesData,
        expensesData,
        hospitalInventoryData,
        proceduresData
      ] = await Promise.all([
        safeCall(petsAPI.getAll, 'pets'),
        safeCall(appointmentsAPI.getAll, 'appointments'),
        safeCall(financialsAPI.getAll, 'financials'),
        safeCall(prescriptionsAPI.getAll, 'prescriptions'),
        safeCall(labReportsAPI.getAll, 'labReports'),
        // Use date-range endpoints where available
        safeDateRangeCall(salesAPI.getByDateRange, 'shopSales', fromDate, toDate),
        safeDateRangeCall(pharmacySalesAPI.getByDateRange, 'pharmacySales', fromDate, toDate),
        safeDateRangeCall(expensesAPI.getByDateRange, 'expenses', fromDate, toDate),
        safeCall(hospitalInventoryAPI.getAll, 'hospitalInventory'),
        safeCall(() => proceduresAPI.getAll(''), 'procedures')
      ])
      
      setPets(petsData)
      setAppointments(appointmentsData)
      setFinancials(financialsData)
      setPrescriptions(prescriptionsData)
      setLabReports(labReportsData)
      setShopSales(shopSalesData)
      setPharmacySales(pharmacySalesData)
      setExpenses(expensesData)
      setHospitalInventory(hospitalInventoryData)
      setProcedures(proceduresData)
      
      setDebugInfo(debug)
    } catch (err) {
      console.error('Error loading financial data:', err)
      setError(err?.message || 'Failed to load financial data')
    } finally {
      setLoading(false)
    }
  }

  // Date filtering function with safe parsing
  const isDateInRange = (dateStr) => {
    const date = toDateStr(dateStr)
    if (!date) return false
    return date >= dateRange.fromDate && date <= dateRange.toDate
  }

  // Filter all data by date range (with safe date handling)
  const filteredPets = pets.filter(p => isDateInRange(p.createdAt || p.when))
  const filteredAppointments = appointments.filter(a => isDateInRange(a.date || a.appointmentDate || a.createdAt))
  const filteredFinancials = financials.filter(f => isDateInRange(f.date || f.createdAt))
  const filteredPrescriptions = prescriptions.filter(p => isDateInRange(p.createdAt || p.when || p.date))
  const filteredLabReports = labReports.filter(r => isDateInRange(r.createdAt || r.reportDate || r.date))
  // Shop sales, pharmacy sales, and expenses are already server-side filtered
  const filteredShopSales = shopSales
  const filteredPharmacySales = pharmacySales
  const filteredExpenses = expenses
  // Hospital inventory filtered by purchase date
  const filteredHospitalInventory = hospitalInventory.filter(i => isDateInRange(i.purchaseDate || i.createdAt))
  const filteredProcedures = procedures.filter(p => isDateInRange(p.createdAt || p.date))
  
  // Procedures calculations with safe number handling
  const proceduresSubtotal = filteredProcedures.reduce((sum, r) => sum + toNum(r.subtotal), 0)
  const proceduresReceived = filteredProcedures.reduce((sum, r) => sum + Math.max(0, toNum(r.receivedAmount)), 0)
  const proceduresDue = filteredProcedures.reduce((sum, r) => {
    const gt = (r.grandTotal != null) ? toNum(r.grandTotal) : (toNum(r.subtotal) + toNum(r.previousDues))
    const paid = toNum(r.receivedAmount)
    const due = (r.receivable != null) ? toNum(r.receivable) : Math.max(0, gt - paid)
    return sum + Math.max(0, due)
  }, 0)

  // Build transactions for procedures (split into Paid and Pending like other portals)
  const proceduresTx = useMemo(() => {
    return filteredProcedures.flatMap(r => {
      const date = r.createdAt || r.date || ''
      const items = Array.isArray(r.procedures) ? r.procedures : []
      const detail = `Procedures (${items.length}) - ${r.petName || ''}`
      const gt = (r.grandTotal != null) ? toNum(r.grandTotal) : (toNum(r.subtotal) + toNum(r.previousDues))
      const recv = Math.max(0, toNum(r.receivedAmount))
      const due = (r.receivable != null) ? toNum(r.receivable) : Math.max(0, gt - recv)
      const rows = []
      if (recv > 0) rows.push({ portal: 'Procedures', date, detail, amount: recv, status: 'Paid' })
      if (due > 0) rows.push({ portal: 'Procedures', date, detail, amount: due, status: 'Pending' })
      return rows
    })
  }, [filteredProcedures])

  const handleDateRangeChange = useCallback((newDateRange) => {
    setDateRange(newDateRange)
  }, [])

  const receptionTx = useMemo(() => filteredPets.map(p => ({
    portal: 'Reception',
    date: p.arrivalTime || p.createdAt || '',
    detail: p.purpose || 'Visit',
    amount: toNum(p?.payment?.amount),
    status: p?.payment?.status || 'Pending'
  })), [filteredPets])

  // Calculate reception statistics from MongoDB
  const receptionStats = useMemo(() => {
    // Get consultant fees from pets records
    const consultantFees = filteredPets.reduce((sum, pet) => {
      return sum + toNum(pet.details?.clinic?.consultantFees)
    }, 0)
    
    // Count successful/completed appointments
    const successfulPatients = filteredAppointments.filter(a => a.status === 'Completed').length
    
    return {
      registered: filteredPets.length,
      appointments: filteredAppointments.length,
      consultationFees: consultantFees,
      successfulPatients: successfulPatients,
      totalTokens: filteredPets.length
    }
  }, [filteredPets, filteredAppointments])

  // Calculate doctor statistics from filtered MongoDB data
  const doctorStats = useMemo(() => {
    // Filter patients with appointments only
    const patientsWithAppointments = filteredPets.filter(pet => {
      return filteredAppointments.some(apt => 
        (apt.petId && apt.petId === pet.id) ||
        (apt.petName?.toLowerCase().trim() === pet.petName?.toLowerCase().trim() && 
         apt.ownerName?.toLowerCase().trim() === pet.ownerName?.toLowerCase().trim())
      )
    })
    
    const totalPatients = patientsWithAppointments.length
    const completed = filteredAppointments.filter(a => a.status === 'Completed').length
    const pending = filteredAppointments.filter(a => a.status !== 'Completed').length
    const totalPrescriptions = filteredPrescriptions.length
    
    // Calculate completion rate
    const completionRate = filteredAppointments.length > 0 ? Math.round((completed / filteredAppointments.length) * 100) : 0
    
    // Calculate average prescriptions per patient
    const avgPrescriptionsPerPatient = totalPatients > 0 ? (totalPrescriptions / totalPatients).toFixed(1) : '0.0'
    
    // Active treatments (patients with pending appointments)
    const activeTreatments = pending
    
    return { 
      totalPatients, 
      pending, 
      completed, 
      totalPrescriptions,
      completionRate,
      avgPrescriptionsPerPatient,
      activeTreatments
    }
  }, [filteredPets, filteredAppointments, filteredPrescriptions])

  // Simple doctor portal export: key doctor metrics for the selected date range
  const doctorExportRows = useMemo(() => {
    return [
      { Metric: 'Total Patients', Value: doctorStats.totalPatients },
      { Metric: 'Pending Appointments', Value: doctorStats.pending },
      { Metric: 'Completed Appointments', Value: doctorStats.completed },
      { Metric: 'Total Prescriptions', Value: doctorStats.totalPrescriptions },
      { Metric: 'Completion Rate (%)', Value: doctorStats.completionRate },
      { Metric: 'Avg Prescriptions per Patient', Value: doctorStats.avgPrescriptionsPerPatient },
      { Metric: 'Active Treatments', Value: doctorStats.activeTreatments },
    ]
  }, [doctorStats])

  // Calculate shop statistics from filtered sales data
  const shopStats = useMemo(() => {
    const totalSales = filteredShopSales.length
    const totalRevenue = filteredShopSales.reduce((sum, sale) => sum + toNum(sale.totalAmount), 0)
    const totalReceived = filteredShopSales.reduce((sum, sale) => {
      const total = toNum(sale.totalAmount)
      const recv = toNum(sale.receivedAmount)
      return sum + (recv > 0 ? Math.min(recv, total) : total)
    }, 0)
    const totalItems = filteredShopSales.reduce((sum, sale) => sum + (sale.items?.length || 0), 0)
    const averageOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0
    
    return {
      totalSales,
      totalRevenue,
      totalReceived,
      totalItems,
      averageOrderValue
    }
  }, [filteredShopSales])

  // Hospital inventory statistics from filtered inventory data
  const hospitalInventoryStats = useMemo(() => {
    const totalItems = filteredHospitalInventory.length
    const totalQuantity = filteredHospitalInventory.reduce((sum, item) => sum + toNum(item.quantity), 0)
    const totalValue = filteredHospitalInventory.reduce((sum, item) => {
      const price = toNum(item.price ?? item.purchasePrice)
      const qty = toNum(item.quantity)
      return sum + (price * qty)
    }, 0)
    const avgValuePerItem = totalItems > 0 ? totalValue / totalItems : 0

    return {
      totalItems,
      totalQuantity,
      totalValue,
      avgValuePerItem
    }
  }, [filteredHospitalInventory])

  const hospitalInventoryExportRows = useMemo(() => {
    return filteredHospitalInventory.map(item => {
      const price = toNum(item.price ?? item.purchasePrice)
      const quantity = toNum(item.quantity)
      const dateStr = toDateStr(item.purchaseDate || item.createdAt)
      return {
        Date: dateStr || '',
        ItemName: item.itemName || '',
        Category: item.category || '',
        Quantity: quantity,
        Price: price,
        TotalValue: price * quantity,
        Location: item.location || '',
        Department: item.department || 'admin'
      }
    })
  }, [filteredHospitalInventory])

  // Treat total inventory value (within selected date range) as admin capital expense
  const inventoryExpense = hospitalInventoryStats.totalValue

  // Filter transactions by category from filtered MongoDB data
  const shopTx = useMemo(() => {
    // Get shop sales from filtered sales collection
    const salesTx = filteredShopSales.map(sale => ({
      portal: 'Shop',
      date: sale.createdAt || '',
      detail: `Invoice ${sale.invoiceNumber} - ${sale.customerName || 'Walk-in'} (${sale.items?.length || 0} items)`,
      amount: toNum(sale.totalAmount),
      status: 'Paid', // Sales are always paid in POS
      invoiceNumber: sale.invoiceNumber,
      customerName: sale.customerName,
      items: sale.items
    }))
    
    // Also include shop transactions from filtered financials collection (if any)
    const financialShopTx = filteredFinancials.filter(f => f.category === 'Shop' || f.type === 'shop').map(f => ({
      portal: 'Shop',
      date: f.date || f.createdAt || '',
      detail: f.description || f.item || 'Sale',
      amount: toNum(f.amount || f.total),
      status: f.status || 'Pending'
    }))
    
    return [...salesTx, ...financialShopTx]
  }, [filteredShopSales, filteredFinancials])

  // Calculate pharmacy statistics from filtered sales data
  const pharmacyStats = useMemo(() => {
    const totalSales = filteredPharmacySales.length
    let totalRevenue = 0
    let totalPending = 0
    let totalItems = 0
    
    filteredPharmacySales.forEach(sale => {
      const total = toNum(sale.totalAmount)
      const recv = toNum(sale.receivedAmount)
      const actualReceived = recv > 0 ? Math.min(recv, total) : total
      const pending = Math.max(0, total - actualReceived)
      
      totalRevenue += actualReceived
      totalPending += pending
      totalItems += (sale.items?.length || 0)
    })
    
    const averageOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0
    
    return {
      totalSales,
      totalRevenue,
      totalPending,
      totalItems,
      averageOrderValue
    }
  }, [filteredPharmacySales])

  const pharmacyTx = useMemo(() => {
    // Pharmacy sales can be partially paid; split into Paid and Pending rows
    const salesTx = filteredPharmacySales.flatMap(sale => {
      const date = sale.createdAt || ''
      const total = Math.max(0, toNum(sale.totalAmount))
      const recv = Math.max(0, toNum(sale.receivedAmount))
      const actualReceived = recv > 0 ? Math.min(recv, total) : total
      const due = Math.max(0, total - actualReceived)
      const detail = `Invoice ${sale.invoiceNumber} - ${sale.customerName || 'Walk-in'} (${sale.items?.length || 0} medicines)`
      const common = {
        portal: 'Pharmacy',
        date,
        detail,
        invoiceNumber: sale.invoiceNumber,
        customerName: sale.customerName,
        items: sale.items
      }
      const rows = []
      if (actualReceived > 0) rows.push({ ...common, amount: actualReceived, status: 'Paid' })
      if (due > 0) rows.push({ ...common, amount: due, status: 'Pending' })
      return rows
    })
    
    // Also include pharmacy transactions from financials collection (if any)
    const financialPharmacyTx = financials.filter(f => f.category === 'Pharmacy' || f.category === 'Prescription').map(f => ({
      portal: 'Pharmacy',
      date: f.date || f.createdAt || '',
      detail: f.description || f.medicine || 'Medicine',
      amount: toNum(f.amount || f.total),
      status: f.status || 'Pending'
    }))
    
    return [...salesTx, ...financialPharmacyTx]
  }, [filteredPharmacySales, financials])

  const labTx = useMemo(() => {
    // Get lab reports directly from filtered labReports collection
    const labReportTx = filteredLabReports.map(r => ({
      portal: 'Lab',
      date: r.date || r.reportDate || r.createdAt || '',
      detail: `${r.testName || r.testType || 'Test'} - ${r.petName || 'Unknown'}`,
      petName: r.petName,
      ownerName: r.ownerName,
      testName: r.testName || r.testType,
      amount: toNum(r.amount),
      status: r.paymentStatus || 'Pending',
      reportNumber: r.reportNumber || r.id
    }))
    
    // Also include lab tests from filtered financials collection
    const financialLabTx = filteredFinancials.filter(f => f.category === 'Lab Test' || f.category === 'Laboratory').map(f => ({
      portal: 'Lab',
      date: f.date || f.createdAt || '',
      detail: f.description || f.testName || 'Test',
      amount: toNum(f.amount || f.total),
      status: f.status || 'Pending'
    }))
    
    return [...labReportTx, ...financialLabTx]
  }, [filteredLabReports, filteredFinancials])

  // Metrics helpers
  const sumPaid = rows => rows.filter(r => r.status === 'Paid').reduce((s, r) => s + toNum(r.amount), 0)
  const sumPending = rows => rows.filter(r => r.status !== 'Paid').reduce((s, r) => s + toNum(r.amount), 0)

  const receptionPaid = sumPaid(receptionTx)
  const receptionPending = sumPending(receptionTx)
  const receptionTokens = filteredPets.length

  const shopPaid = sumPaid(shopTx)
  const shopPending = sumPending(shopTx)

  const pharmacyPaid = sumPaid(pharmacyTx)
  const pharmacyPending = sumPending(pharmacyTx)

  const labPaid = sumPaid(labTx)
  const labPending = sumPending(labTx)

  const proceduresPaid = sumPaid(proceduresTx)
  const proceduresPending = sumPending(proceduresTx)

  // Calculate total revenue (only from Paid amounts)
  const totalRevenue = receptionPaid + shopPaid + pharmacyPaid + labPaid + proceduresPaid
  const totalPending = receptionPending + shopPending + pharmacyPending + labPending + proceduresPending
  
  // Calculate expenses with safe number handling
  const expensesTotal = filteredExpenses.reduce((sum, exp) => sum + toNum(exp.amount), 0)
  const totalExpense = expensesTotal + inventoryExpense
  const netProfit = totalRevenue - totalExpense
  
  // Calculate expenses by portal using filtered data
  const expensesByPortal = useMemo(() => ({
    reception: filteredExpenses.filter(e => e.portal === 'reception').reduce((sum, e) => sum + toNum(e.amount), 0),
    doctor: filteredExpenses.filter(e => e.portal === 'doctor').reduce((sum, e) => sum + toNum(e.amount), 0),
    pharmacy: filteredExpenses.filter(e => e.portal === 'pharmacy').reduce((sum, e) => sum + toNum(e.amount), 0),
    lab: filteredExpenses.filter(e => e.portal === 'lab').reduce((sum, e) => sum + toNum(e.amount), 0),
    shop: filteredExpenses.filter(e => e.portal === 'shop').reduce((sum, e) => sum + toNum(e.amount), 0),
    // Admin expenses include normal admin expenses plus hospital inventory purchases
    admin: filteredExpenses.filter(e => e.portal === 'admin').reduce((sum, e) => sum + toNum(e.amount), 0) + inventoryExpense,
  }), [filteredExpenses, inventoryExpense])

  const allTx = [...receptionTx, ...shopTx, ...pharmacyTx, ...labTx, ...proceduresTx]

  // Build a rich financial summary CSV for the selected date range
  const buildFinancialSummaryCSV = () => {
    const transactionHeaders = ['Date', 'Portal', 'Type', 'Category', 'Detail', 'Amount', 'Status']
    const lines = []

    const addTxRow = (row) => {
      lines.push(transactionHeaders.map(h => JSON.stringify(row[h] ?? '')).join(','))
    }

    // Transactions section
    lines.push('"Transactions"')
    lines.push(transactionHeaders.join(','))

    const normalizeDate = (d) => toDateStr(d) || ''

    // Income rows by portal
    receptionTx.forEach(tx => addTxRow({
      Date: normalizeDate(tx.date),
      Portal: 'Reception',
      Type: 'Income',
      Category: 'Reception',
      Detail: tx.detail,
      Amount: Number(tx.amount || 0),
      Status: tx.status || 'Paid'
    }))

    shopTx.forEach(tx => addTxRow({
      Date: normalizeDate(tx.date),
      Portal: 'Shop',
      Type: 'Income',
      Category: 'Shop',
      Detail: tx.detail,
      Amount: Number(tx.amount || 0),
      Status: tx.status || 'Paid'
    }))

    pharmacyTx.forEach(tx => addTxRow({
      Date: normalizeDate(tx.date),
      Portal: 'Pharmacy',
      Type: 'Income',
      Category: 'Pharmacy',
      Detail: tx.detail,
      Amount: Number(tx.amount || 0),
      Status: tx.status || 'Paid'
    }))

    labTx.forEach(tx => addTxRow({
      Date: normalizeDate(tx.date),
      Portal: 'Lab',
      Type: 'Income',
      Category: 'Lab',
      Detail: tx.detail,
      Amount: Number(tx.amount || 0),
      Status: tx.status || 'Paid'
    }))

    proceduresTx.forEach(tx => addTxRow({
      Date: normalizeDate(tx.date),
      Portal: 'Procedures',
      Type: 'Income',
      Category: 'Procedures',
      Detail: tx.detail,
      Amount: Number(tx.amount || 0),
      Status: tx.status || 'Paid'
    }))

    // Expense rows (admin, reception, shop, etc.)
    const portalLabel = (p) => {
      if (!p) return 'Admin'
      const map = {
        reception: 'Reception',
        doctor: 'Doctor',
        pharmacy: 'Pharmacy',
        lab: 'Lab',
        shop: 'Shop',
        admin: 'Admin'
      }
      return map[p] || p
    }

    filteredExpenses.forEach(exp => {
      addTxRow({
        Date: normalizeDate(exp.date || exp.createdAt),
        Portal: portalLabel(exp.portal),
        Type: 'Expense',
        Category: exp.category || 'Expense',
        Detail: exp.description || exp.item || 'Expense',
        Amount: -Number(exp.amount || 0),
        Status: exp.status || 'Paid'
      })
    })

    // Hospital inventory treated as capital expenses (one row per item)
    filteredHospitalInventory.forEach(item => {
      const price = Number(item.price ?? item.purchasePrice ?? 0)
      const qty = Number(item.quantity ?? 0)
      const total = price * qty
      if (!total) return

      addTxRow({
        Date: normalizeDate(item.purchaseDate || item.createdAt),
        Portal: 'Admin / Hospital Inventory',
        Type: 'Expense - Inventory',
        Category: item.category || 'Hospital Inventory',
        Detail: item.itemName || 'Inventory Item',
        Amount: -total,
        Status: 'Paid'
      })
    })

    // Blank line between transactions and summary
    lines.push('')
    lines.push('"Summary by Portal"')

    const summaryHeaders = ['Portal', 'TotalRevenue', 'TotalExpense', 'Net']
    lines.push(summaryHeaders.join(','))

    const addSummaryRow = (portal, revenue, expense) => {
      const net = revenue - expense
      lines.push([
        JSON.stringify(portal),
        revenue.toFixed(2),
        expense.toFixed(2),
        net.toFixed(2)
      ].join(','))
    }

    const receptionRevenue = receptionPaid + receptionPending
    const shopRevenue = shopPaid + shopPending
    const pharmacyRevenue = pharmacyPaid + pharmacyPending
    const labRevenue = labPaid + labPending
    const proceduresRevenue = proceduresPaid + proceduresPending

    addSummaryRow('Reception', receptionRevenue, expensesByPortal.reception)
    addSummaryRow('Doctor', 0, expensesByPortal.doctor)
    addSummaryRow('Shop', shopRevenue, expensesByPortal.shop)
    addSummaryRow('Pharmacy', pharmacyRevenue, expensesByPortal.pharmacy)
    addSummaryRow('Lab', labRevenue, expensesByPortal.lab)
    addSummaryRow('Procedures', proceduresRevenue, 0)
    addSummaryRow('Admin / Hospital Inventory', 0, expensesByPortal.admin)

    // Overall totals
    lines.push('')
    lines.push('"Overall Totals"')
    lines.push(['"TotalRevenue"', totalRevenue.toFixed(2), '"TotalExpense"', totalExpense.toFixed(2), '"NetProfit"', netProfit.toFixed(2)].join(','))

    return lines.join('\n')
  }

  const exportCSV = (rows, name='financials') => {
    const csvString = name === 'financials-summary'
      ? buildFinancialSummaryCSV()
      : toCSV(rows)

    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name}-${range.toLowerCase()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const isToday = selectedDate === new Date().toISOString().slice(0,10)
  
  const formatDate = (dateStr) => {
    const date = toDateStr(dateStr)
    if (!date) return 'Invalid Date'
    return new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  }
  
  // Data summary for display
  const dataSummary = useMemo(() => ({
    pets: filteredPets.length,
    appointments: filteredAppointments.length,
    prescriptions: filteredPrescriptions.length,
    labReports: filteredLabReports.length,
    shopSales: filteredShopSales.length,
    pharmacySales: filteredPharmacySales.length,
    expenses: filteredExpenses.length,
    procedures: filteredProcedures.length
  }), [filteredPets, filteredAppointments, filteredPrescriptions, filteredLabReports, filteredShopSales, filteredPharmacySales, filteredExpenses, filteredProcedures])

  return (
    <div className="space-y-8">
      {/* Professional Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">Financial Reports</h1>
        <p className="text-slate-600 text-lg">Comprehensive financial overview across all portals</p>
      </div>

      {/* Professional Date Range Picker */}
      <div className="rounded-2xl bg-gradient-to-br from-white via-indigo-50 to-purple-50 shadow-xl ring-1 ring-indigo-200 border border-indigo-100 p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <FiCalendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-indigo-600">Date Range</div>
              <div className="text-lg font-bold text-slate-800">
                {dateRange.fromDate === dateRange.toDate 
                  ? formatDate(dateRange.fromDate)
                  : `${new Date(dateRange.fromDate).toLocaleDateString()} - ${new Date(dateRange.toDate).toLocaleDateString()}`
                }
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <DateRangePicker 
              onDateChange={handleDateRangeChange}
              defaultFromDate={dateRange.fromDate}
              defaultToDate={dateRange.toDate}
              showAllButton={true}
            />
            
            <button 
              onClick={loadAllData}
              disabled={loading}
              className="px-4 py-3 rounded-xl bg-slate-600 hover:bg-slate-700 text-white shadow-lg font-semibold transition-all duration-200 flex items-center gap-2 disabled:opacity-50"
            >
              <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            
            <button onClick={()=>exportCSV(allTx,'financials-summary')} className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg font-semibold transition-all duration-200 flex items-center gap-2">
              <FiDownload className="w-4 h-4" /> Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 flex items-center gap-3">
          <FiAlertCircle className="w-6 h-6 text-red-600" />
          <div className="flex-1">
            <div className="font-semibold text-red-800">Error loading data</div>
            <div className="text-sm text-red-600">{error}</div>
          </div>
          <button 
            onClick={loadAllData}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2"
          >
            <FiRefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      )}

      {/* Debug Panel Toggle */}
      <div className="flex justify-end">
        <button 
          onClick={() => setShowDebug(!showDebug)}
          className="text-xs text-slate-500 hover:text-slate-700 underline"
        >
          {showDebug ? 'Hide Debug Info' : 'Show Debug Info'}
        </button>
      </div>

      {/* Debug Panel */}
      {showDebug && (
        <div className="rounded-2xl bg-slate-100 border border-slate-200 p-4">
          <div className="text-sm font-semibold text-slate-700 mb-2">Debug Information</div>
          <pre className="text-xs text-slate-600 overflow-auto max-h-48">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
          <div className="mt-2 text-xs text-slate-500">
            Data loaded for: {dateRange.fromDate} to {dateRange.toDate}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <div className="text-slate-500 font-medium">Loading financial data...</div>
          <div className="text-xs text-slate-400 mt-2">Fetching data from all portals</div>
        </div>
      ) : (
      <>
      {/* Summary cards with animations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="rounded-2xl p-6 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 ring-1 ring-emerald-200/70 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 group cursor-pointer">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <FiTrendingUp className="h-6 w-6 text-white" />
            </div>
            <div className="text-xs font-semibold text-green-600 bg-green-100 px-2 py-1 rounded-full">Revenue</div>
          </div>
          <div>
            <div className="text-sm font-medium text-slate-600 mb-1">Total Revenue</div>
            <div className="text-3xl font-bold text-slate-900">Rs. {totalRevenue.toLocaleString()}</div>
          </div>
        </div>
        <div className="rounded-2xl p-6 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 ring-1 ring-amber-200/70 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 group cursor-pointer">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <FiDollarSign className="h-6 w-6 text-white" />
            </div>
            <div className="text-xs font-semibold text-amber-600 bg-amber-100 px-2 py-1 rounded-full">Pending</div>
          </div>
          <div>
            <div className="text-sm font-medium text-slate-600 mb-1">Total Pending</div>
            <div className="text-3xl font-bold text-slate-900">Rs. {totalPending.toLocaleString()}</div>
          </div>
        </div>
        <div className="rounded-2xl p-6 bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50 ring-1 ring-blue-200/70 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 group cursor-pointer">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <FiTrendingDown className="h-6 w-6 text-white" />
            </div>
            <div className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-1 rounded-full">Expense</div>
          </div>
          <div>
            <div className="text-sm font-medium text-slate-600 mb-1">Total Expense</div>
            <div className="text-3xl font-bold text-slate-900">Rs. {totalExpense.toLocaleString()}</div>
          </div>
        </div>
        <div className="rounded-2xl p-6 bg-gradient-to-br from-indigo-50 via-purple-50 to-violet-50 ring-1 ring-indigo-200/70 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 group cursor-pointer">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <FiDollarSign className="h-6 w-6 text-white" />
            </div>
            <div className={`text-xs font-semibold px-2 py-1 rounded-full ${netProfit >= 0 ? 'text-emerald-600 bg-emerald-100' : 'text-red-600 bg-red-100'}`}>
              {netProfit >= 0 ? 'Profit' : 'Loss'}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium text-slate-600 mb-1">Net {netProfit >= 0 ? 'Profit' : 'Loss'}</div>
            <div className={`text-3xl font-bold ${netProfit >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
              Rs. {Math.abs(netProfit).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Data Summary - Record Counts */}
      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
        <div className="text-sm font-semibold text-slate-700 mb-3">Records Loaded for Selected Date Range</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3 text-center">
          <div className="bg-white rounded-lg p-2 shadow-sm">
            <div className="text-lg font-bold text-indigo-600">{dataSummary.pets}</div>
            <div className="text-xs text-slate-500">Pets</div>
          </div>
          <div className="bg-white rounded-lg p-2 shadow-sm">
            <div className="text-lg font-bold text-blue-600">{dataSummary.appointments}</div>
            <div className="text-xs text-slate-500">Appts</div>
          </div>
          <div className="bg-white rounded-lg p-2 shadow-sm">
            <div className="text-lg font-bold text-emerald-600">{dataSummary.shopSales}</div>
            <div className="text-xs text-slate-500">Shop</div>
          </div>
          <div className="bg-white rounded-lg p-2 shadow-sm">
            <div className="text-lg font-bold text-sky-600">{dataSummary.pharmacySales}</div>
            <div className="text-xs text-slate-500">Pharmacy</div>
          </div>
          <div className="bg-white rounded-lg p-2 shadow-sm">
            <div className="text-lg font-bold text-teal-600">{dataSummary.labReports}</div>
            <div className="text-xs text-slate-500">Lab</div>
          </div>
          <div className="bg-white rounded-lg p-2 shadow-sm">
            <div className="text-lg font-bold text-purple-600">{dataSummary.prescriptions}</div>
            <div className="text-xs text-slate-500">Rx</div>
          </div>
          <div className="bg-white rounded-lg p-2 shadow-sm">
            <div className="text-lg font-bold text-orange-600">{dataSummary.procedures}</div>
            <div className="text-xs text-slate-500">Procs</div>
          </div>
          <div className="bg-white rounded-lg p-2 shadow-sm">
            <div className="text-lg font-bold text-red-600">{dataSummary.expenses}</div>
            <div className="text-xs text-slate-500">Exp</div>
          </div>
        </div>
      </div>

      {/* Hospital Inventory (Admin) Section */}
      <div className="rounded-3xl bg-white shadow-xl ring-1 ring-orange-200/70 p-6 border-l-4 border-orange-400 bg-gradient-to-br from-orange-50 to-white hover:shadow-2xl transition-shadow duration-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-slate-800 font-semibold">
            <FiPackage className="text-orange-600" /> Hospital Inventory
          </div>
          <button
            onClick={() => exportCSV(hospitalInventoryExportRows, 'hospital-inventory')}
            className="px-3 h-9 rounded-lg bg-orange-500 hover:bg-orange-600 text-white shadow-sm cursor-pointer text-sm font-medium"
          >
            <FiDownload className="inline-block w-4 h-4 mr-1" /> Export
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <Metric label="Total Items" value={String(hospitalInventoryStats.totalItems)} color="amber" />
          <Metric label="Total Quantity" value={String(hospitalInventoryStats.totalQuantity)} color="blue" />
          <Metric label="Total Value" value={`Rs. ${hospitalInventoryStats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} color="green" />
          <Metric label="Avg Value / Item" value={`Rs. ${hospitalInventoryStats.totalItems ? Math.round(hospitalInventoryStats.avgValuePerItem).toLocaleString() : 0}`} color="purple" />
        </div>
      </div>

      {/* Reception Portal Section */}
      <div className="rounded-3xl bg-white shadow-xl ring-1 ring-indigo-200/70 p-6 border-t-4 border-indigo-400 bg-gradient-to-br from-indigo-50 to-white hover:shadow-2xl transition-shadow duration-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-slate-800 font-semibold">
            <FiClipboard className="text-indigo-600" /> Reception Portal
          </div>
          <div className="text-xs text-slate-500">Patient Registration & Appointments</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
          <Metric label="Registered Pets" value={String(receptionStats.registered)} color="indigo" />
          <Metric label="Appointments" value={String(receptionStats.appointments)} color="blue" />
          <Metric label="Consultation Fees" value={`Rs. ${receptionStats.consultationFees.toLocaleString()}`} color="emerald" />
          <Metric label="Procedure Fees (Received)" value={`Rs. ${proceduresReceived.toLocaleString()}`} color="emerald" />
          <Metric label="Procedure Dues (Pending)" value={`Rs. ${proceduresDue.toLocaleString()}`} color="amber" />
          <Metric label="Successful Patients" value={String(receptionStats.successfulPatients)} color="green" />
          <Metric label="Expenses" value={`Rs. ${expensesByPortal.reception.toLocaleString()}`} color="red" icon={<FiTrendingDown />} />
        </div>
        
        {/* Additional Stats */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-1 gap-3">
          <div className="rounded-xl p-4 bg-gradient-to-br from-emerald-100 to-emerald-50 ring-1 ring-emerald-200/70">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-600">Total Tokens</div>
                <div className="text-2xl font-bold text-emerald-700">{receptionStats.totalTokens}</div>
              </div>
              <div className="w-12 h-12 rounded-full bg-emerald-200 flex items-center justify-center">
                <svg className="w-6 h-6 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                  <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-4">
          <button onClick={()=>exportCSV(receptionTx,'reception')} className="w-full px-4 h-10 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm cursor-pointer flex items-center justify-center gap-2">
            <FiDownload /> Export Reception Data
          </button>
        </div>
      </div>

      {/* Doctor Portal Section */}
      <div className="rounded-3xl bg-white shadow-xl ring-1 ring-purple-200/70 p-6 border-t-4 border-purple-400 bg-gradient-to-br from-purple-50 to-white hover:shadow-2xl transition-shadow duration-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-slate-800 font-semibold">
            <FaStethoscope className="text-purple-600" /> Doctor Portal
          </div>
          <button
            onClick={() => exportCSV(doctorExportRows, 'doctor')}
            className="px-3 h-9 rounded-lg bg-purple-600 hover:bg-purple-700 text-white shadow-sm cursor-pointer text-xs font-medium"
          >
            <FiDownload className="inline-block w-4 h-4 mr-1" /> Export
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Metric label="Total Patients" value={String(doctorStats.totalPatients)} color="purple" />
          <Metric label="Pending" value={String(doctorStats.pending)} color="amber" />
          <Metric label="Completed" value={String(doctorStats.completed)} color="emerald" />
          <Metric label="Prescriptions" value={String(doctorStats.totalPrescriptions)} color="indigo" />
          <Metric label="Procedure Fees (Received)" value={`Rs. ${proceduresReceived.toLocaleString()}`} color="emerald" />
          <Metric label="Expenses" value={`Rs. ${expensesByPortal.doctor.toLocaleString()}`} color="red" icon={<FiTrendingDown />} />
        </div>
        
        {/* Additional Stats */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl p-4 bg-gradient-to-br from-purple-100 to-purple-50 ring-1 ring-purple-200/70">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-600">Completion Rate</div>
                <div className="text-2xl font-bold text-purple-700">
                  {doctorStats.completionRate}%
                </div>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-200 flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
              </div>
            </div>
          </div>
          
          <div className="rounded-xl p-4 bg-gradient-to-br from-blue-100 to-blue-50 ring-1 ring-blue-200/70">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-600">Avg Prescriptions/Patient</div>
                <div className="text-2xl font-bold text-blue-700">
                  {doctorStats.avgPrescriptionsPerPatient}
                </div>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-200 flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                  <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/>
                </svg>
              </div>
            </div>
          </div>
          
          <div className="rounded-xl p-4 bg-gradient-to-br from-emerald-100 to-emerald-50 ring-1 ring-emerald-200/70">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-600">Active Treatments</div>
                <div className="text-2xl font-bold text-emerald-700">{doctorStats.activeTreatments}</div>
              </div>
              <div className="w-12 h-12 rounded-full bg-emerald-200 flex items-center justify-center">
                <svg className="w-6 h-6 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Shop Section */}
      <div className="rounded-3xl bg-white shadow-xl ring-1 ring-emerald-200/70 p-6 border-l-4 border-emerald-400 bg-gradient-to-br from-emerald-50 to-white hover:shadow-2xl transition-shadow duration-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-slate-800 font-semibold">
            <FiShoppingCart className="text-emerald-600" /> Pets Shop
          </div>
          <div className="text-xs text-slate-500">Point of Sale & Inventory</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
          <Metric label="Total Sales" value={String(shopStats.totalSales)} color="emerald" />
          <Metric label="Total Revenue" value={`Rs. ${shopStats.totalRevenue.toLocaleString()}`} color="green" />
          <Metric label="Items Sold" value={String(shopStats.totalItems)} color="blue" />
          <Metric label="Avg Order Value" value={`Rs. ${Math.round(shopStats.averageOrderValue).toLocaleString()}`} color="indigo" />
          <Metric label="Expenses" value={`Rs. ${expensesByPortal.shop.toLocaleString()}`} color="red" icon={<FiTrendingDown />} />
        </div>
        
        {/* Additional Shop Stats */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div className="rounded-xl p-4 bg-gradient-to-br from-emerald-100 to-emerald-50 ring-1 ring-emerald-200/70">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-600">Revenue Collected</div>
                <div className="text-2xl font-bold text-emerald-700">Rs. {shopPaid.toLocaleString()}</div>
              </div>
              <div className="w-12 h-12 rounded-full bg-emerald-200 flex items-center justify-center">
                <FiDollarSign className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </div>
          
          <div className="rounded-xl p-4 bg-gradient-to-br from-blue-100 to-blue-50 ring-1 ring-blue-200/70">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-600">Total Transactions</div>
                <div className="text-2xl font-bold text-blue-700">{shopTx.length}</div>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-200 flex items-center justify-center">
                <FiShoppingCart className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
        </div>
        
        <TransactionsTable rows={shopTx} />
        
        <div className="mt-4">
          <button onClick={()=>exportCSV(shopTx,'shop')} className="w-full px-4 h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm cursor-pointer flex items-center justify-center gap-2">
            <FiDownload /> Export Shop Data
          </button>
        </div>
      </div>

      {/* Pharmacy Section */}
      <div className="rounded-2xl bg-white shadow-xl ring-1 ring-sky-200/70 p-6 border-r-4 border-sky-400 bg-gradient-to-br from-sky-50 to-white hover:shadow-2xl transition-shadow duration-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-slate-800 font-semibold">
            <MdLocalPharmacy className="text-sky-600" /> Pharmacy
          </div>
          <button onClick={()=>exportCSV(pharmacyTx,'pharmacy')} className="px-3 h-9 rounded-lg bg-sky-600 hover:bg-sky-700 text-white shadow-sm cursor-pointer">Export</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
          <Metric label="Paid" value={`Rs. ${pharmacyPaid.toLocaleString()}`} color="emerald" />
          <Metric label="Pending" value={`Rs. ${pharmacyPending.toLocaleString()}`} color="amber" />
          <Metric label="Transactions" value={String(pharmacyTx.length)} color="indigo" />
          <Metric label="Avg/Sale" value={`Rs. ${pharmacyTx.length ? Math.round(pharmacyPaid/pharmacyTx.length).toLocaleString() : 0}`} color="blue" />
          <Metric label="Expenses" value={`Rs. ${expensesByPortal.pharmacy.toLocaleString()}`} color="red" icon={<FiTrendingDown />} />
        </div>
        <TransactionsTable rows={pharmacyTx} />
      </div>

      {/* Lab Section */}
      <div className="rounded-xl bg-white shadow-xl ring-1 ring-teal-200/70 p-6 border-b-4 border-teal-400 bg-gradient-to-br from-teal-50 to-white hover:shadow-2xl transition-shadow duration-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-slate-800 font-semibold">
            <TbMicroscope className="text-teal-600 text-xl" /> Laboratory Tests
          </div>
          <button onClick={()=>exportCSV(labTx,'lab')} className="px-3 h-9 rounded-lg bg-teal-600 hover:bg-teal-700 text-white shadow-sm cursor-pointer">Export</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
          <Metric label="Paid" value={`Rs. ${labPaid.toLocaleString()}`} color="emerald" />
          <Metric label="Pending" value={`Rs. ${labPending.toLocaleString()}`} color="amber" />
          <Metric label="Total Tests" value={String(labTx.length)} color="indigo" />
          <Metric label="Avg/Test" value={`Rs. ${labTx.length ? Math.round(labPaid/labTx.length).toLocaleString() : 0}`} color="blue" />
          <Metric label="Expenses" value={`Rs. ${expensesByPortal.lab.toLocaleString()}`} color="red" icon={<FiTrendingDown />} />
        </div>
        
        {/* Lab Test Cards */}
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {labTx.map((test, idx) => (
            <div key={idx} className="rounded-xl bg-gradient-to-r from-white to-teal-50 border-2 border-teal-200 p-4 hover:shadow-lg transition-all duration-200 hover:border-teal-400">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center flex-shrink-0 shadow-md">
                    <TbMicroscope className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 mb-1">{test.testName || test.detail}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      {test.petName && (
                        <div className="flex items-center gap-1 text-slate-600">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/></svg>
                          <span className="font-medium">Pet:</span> {test.petName}
                        </div>
                      )}
                      {test.ownerName && (
                        <div className="flex items-center gap-1 text-slate-600">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>
                          <span className="font-medium">Owner:</span> {test.ownerName}
                        </div>
                      )}
                      {test.reportNumber && (
                        <div className="flex items-center gap-1 text-slate-600">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"/></svg>
                          <span className="font-medium">Report#:</span> {test.reportNumber}
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-slate-600">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/></svg>
                        <span className="font-medium">Date:</span> {new Date(test.date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-xs text-slate-500 mb-1">Amount</div>
                    <div className="text-xl font-bold text-slate-900">Rs. {Number(test.amount||0).toLocaleString()}</div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${test.status==='Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {test.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {labTx.length===0 && (
            <div className="py-8 text-center text-slate-500">
              <TbMicroscope className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <div>No lab tests found.</div>
            </div>
          )}
        </div>
      </div>
      </>
      )}
    </div>
  )
}

function Metric({ label, value, color='indigo', icon }){
  const map = {
    indigo: 'from-indigo-50 to-indigo-100 ring-indigo-200/70',
    emerald: 'from-emerald-50 to-emerald-100 ring-emerald-200/70',
    green: 'from-green-50 to-green-100 ring-green-200/70',
    amber: 'from-amber-50 to-amber-100 ring-amber-200/70',
    blue: 'from-blue-50 to-blue-100 ring-blue-200/70',
    purple: 'from-purple-50 to-purple-100 ring-purple-200/70',
    red: 'from-red-50 to-red-100 ring-red-200/70',
  }
  return (
    <div className={`rounded-xl p-4 bg-gradient-to-br ${map[color]} ring-1`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="text-xs text-slate-600">{label}</div>
          <div className="text-lg font-semibold text-slate-900 mt-0.5">{value}</div>
        </div>
        {icon && (
          <div className="text-slate-500 ml-2">
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}

function TransactionsTable({ rows=[] }){
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-slate-500">
            <th className="py-2 px-4">Portal</th>
            <th className="py-2 px-4">Date</th>
            <th className="py-2 px-4">Detail</th>
            <th className="py-2 px-4">Amount</th>
            <th className="py-2 px-4">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
              <td className="py-2 px-4 text-slate-700">{r.portal}</td>
              <td className="py-2 px-4 text-slate-700">{r.date}</td>
              <td className="py-2 px-4 text-slate-700">{r.detail}</td>
              <td className="py-2 px-4 font-medium text-slate-900">Rs. {Number(r.amount||0).toLocaleString()}</td>
              <td className="py-2 px-4">
                <span className={`px-2 py-1 rounded-full text-xs ${r.status==='Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{r.status}</span>
              </td>
            </tr>
          ))}
          {rows.length===0 && (
            <tr>
              <td colSpan={5} className="py-3 px-4 text-center text-slate-500">No transactions found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
