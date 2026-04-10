import express from 'express'
const router = express.Router()

// Models
import Pet from '../models/Pet.js'
import Appointment from '../models/Appointment.js'
import Prescription from '../models/Prescription.js'
import LabReport from '../models/LabReport.js'
import ProcedureRecord from '../models/ProcedureRecord.js'
import PharmacyMedicine from '../models/PharmacyMedicine.js'
import PharmacyPurchase from '../models/PharmacyPurchase.js'
import LabRequest from '../models/LabRequest.js'
import LabTest from '../models/LabTest.js'
import DoctorProfile from '../models/DoctorProfile.js'
let RadiologyReport
try { RadiologyReport = (await import('../models/RadiologyReport.js')).default } catch { RadiologyReport = null }
import PharmacySale from '../models/PharmacySale.js'
let PharmacyDue
try { PharmacyDue = (await import('../models/PharmacyDue.js')).default } catch { PharmacyDue = null }
import Financial from '../models/Financial.js'

// Optional shop/inventory models (best-effort)
let Product, Sale, Supplier
try { Product = (await import('../models/Product.js')).default } catch {}
try { Sale = (await import('../models/Sale.js')).default } catch {}
try { Supplier = (await import('../models/Supplier.js')).default } catch {}

// Expenses (if present)
let Expense
try { Expense = (await import('../models/Expense.js')).default } catch {}

// Utilities
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

// GET /api/backup/export-all
router.get('/export-all', asyncHandler(async (req, res) => {
  const [pets, appointments, prescriptions, labReports, labRequests, labTests, procedureRecords, pharmacyMedicines, pharmacyPurchases, radiologyReports, pharmacySales, financials, expenses, products, sales, suppliers, pharmacyDues, doctorProfiles] = await Promise.all([
    Pet.find({}).lean(),
    Appointment.find({}).lean(),
    Prescription.find({}).lean(),
    LabReport.find({}).lean(),
    LabRequest.find({}).lean(),
    LabTest.find({}).lean(),
    ProcedureRecord.find({}).lean(),
    PharmacyMedicine.find({}).lean(),
    PharmacyPurchase.find({}).lean(),
    RadiologyReport ? RadiologyReport.find({}).lean() : Promise.resolve([]),
    PharmacySale.find({}).lean(),
    Financial.find({}).lean(),
    Expense ? Expense.find({}).lean() : Promise.resolve([]),
    Product ? Product.find({}).lean() : Promise.resolve([]),
    Sale ? Sale.find({}).lean() : Promise.resolve([]),
    Supplier ? Supplier.find({}).lean() : Promise.resolve([]),
    PharmacyDue ? PharmacyDue.find({}).lean() : Promise.resolve([]),
    DoctorProfile.find({}).lean(),
  ])

  res.json({
    success: true,
    data: {
      pets,
      appointments,
      prescriptions,
      labReports,
      labRequests,
      labTests,
      radiologyReports,
      procedureRecords,
      pharmacyMedicines,
      pharmacyPurchases,
      pharmacySales,
      pharmacyDues,
      financials,
      expenses,
      products,
      sales,
      suppliers,
      doctorProfiles,
      exportedAt: new Date().toISOString(),
    }
  })
}))

// POST /api/backup/import-all
// Body shape: { pets: [...], appointments: [...], ... }
router.post('/import-all', asyncHandler(async (req, res) => {
  const payload = req.body || {}
  const results = {}

  const importCollection = async (Model, key) => {
    if (!Model || !Array.isArray(payload[key])) { results[key] = { skipped: true }; return }
    const ops = payload[key].map(doc => ({
      replaceOne: {
        filter: { _id: doc._id },
        replacement: doc,
        upsert: true,
      }
    }))
    if (ops.length === 0) { results[key] = { upserts: 0 }; return }
    const outcome = await Model.bulkWrite(ops, { ordered: false })
    results[key] = {
      upserts: outcome?.upsertedCount || 0,
      modified: outcome?.modifiedCount || 0,
      matched: outcome?.matchedCount || 0,
    }
  }

  await importCollection(Pet, 'pets')
  await importCollection(Appointment, 'appointments')
  await importCollection(Prescription, 'prescriptions')
  await importCollection(LabReport, 'labReports')
  await importCollection(LabRequest, 'labRequests')
  await importCollection(LabTest, 'labTests')
  await importCollection(ProcedureRecord, 'procedureRecords')
  await importCollection(PharmacyMedicine, 'pharmacyMedicines')
  await importCollection(PharmacyPurchase, 'pharmacyPurchases')
  await importCollection(RadiologyReport, 'radiologyReports')
  await importCollection(PharmacySale, 'pharmacySales')
  await importCollection(PharmacyDue, 'pharmacyDues')
  await importCollection(Financial, 'financials')
  await importCollection(Expense, 'expenses')
  await importCollection(Product, 'products')
  await importCollection(Sale, 'sales')
  await importCollection(Supplier, 'suppliers')
  await importCollection(DoctorProfile, 'doctorProfiles')

  res.json({ success: true, results })
}))

// DELETE /api/backup/clear-reception
// Danger: wipes reception-related collections (pets, appointments, procedure records)
router.delete('/clear-reception', asyncHandler(async (req, res) => {
  const petsDel = await Pet.deleteMany({})
  const apptDel = await Appointment.deleteMany({})
  const procDel = await ProcedureRecord.deleteMany({})
  res.json({
    success: true,
    deleted: {
      pets: petsDel?.deletedCount ?? 0,
      appointments: apptDel?.deletedCount ?? 0,
      procedureRecords: procDel?.deletedCount ?? 0,
    }
  })
}))

// DELETE /api/backup/clear-pharmacy
// Danger: wipes pharmacy-related collections (medicines, purchases, sales, dues)
router.delete('/clear-pharmacy', asyncHandler(async (req, res) => {
  const medsDel = await PharmacyMedicine.deleteMany({})
  const purchDel = await PharmacyPurchase.deleteMany({})
  const salesDel = await PharmacySale.deleteMany({})
  const duesDel = await PharmacyDue.deleteMany({})
  res.json({
    success: true,
    deleted: {
      medicines: medsDel?.deletedCount ?? 0,
      purchases: purchDel?.deletedCount ?? 0,
      sales: salesDel?.deletedCount ?? 0,
      dues: duesDel?.deletedCount ?? 0,
    }
  })
}))

// DELETE /api/backup/clear-lab
// Danger: wipes lab-related collections (labReports, labRequests, labTests, radiologyReports)
router.delete('/clear-lab', asyncHandler(async (req, res) => {
  const repDel = await LabReport.deleteMany({})
  const reqDel = await LabRequest.deleteMany({})
  const testDel = await LabTest.deleteMany({})
  const radDel = RadiologyReport ? await RadiologyReport.deleteMany({}) : { deletedCount: 0 }
  res.json({
    success: true,
    deleted: {
      labReports: repDel?.deletedCount ?? 0,
      labRequests: reqDel?.deletedCount ?? 0,
      labTests: testDel?.deletedCount ?? 0,
      radiologyReports: radDel?.deletedCount ?? 0,
    }
  })
}))

// DELETE /api/backup/clear-shop
// Danger: wipes shop-related collections (products, sales, suppliers)
router.delete('/clear-shop', asyncHandler(async (req, res) => {
  const prodDel = Product ? await Product.deleteMany({}) : { deletedCount: 0 }
  const saleDel = Sale ? await Sale.deleteMany({}) : { deletedCount: 0 }
  const suppDel = Supplier ? await Supplier.deleteMany({}) : { deletedCount: 0 }
  res.json({
    success: true,
    deleted: {
      products: prodDel?.deletedCount ?? 0,
      sales: saleDel?.deletedCount ?? 0,
      suppliers: suppDel?.deletedCount ?? 0,
    }
  })
}))

// DELETE /api/backup/clear-doctor
// Danger: wipes doctor-related data (doctor profiles, prescriptions)
router.delete('/clear-doctor', asyncHandler(async (req, res) => {
  const profDel = await DoctorProfile.deleteMany({})
  const rxDel = await Prescription.deleteMany({})
  res.json({
    success: true,
    deleted: {
      doctorProfiles: profDel?.deletedCount ?? 0,
      prescriptions: rxDel?.deletedCount ?? 0,
    }
  })
}))

export default router
