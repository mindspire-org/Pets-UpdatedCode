import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/database.js";
import User from "./models/User.js";
import Pet from "./models/Pet.js";
import PharmacyMedicine from "./models/PharmacyMedicine.js";
import SidebarConfig from "./models/SidebarConfig.js";

// Import routes
import userRoutes from "./routes/userRoutes.js";
import petRoutes from "./routes/petRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import prescriptionRoutes from "./routes/prescriptionRoutes.js";
import medicineRoutes from "./routes/medicineRoutes.js";
import vaccineRoutes from "./routes/vaccineRoutes.js";
import labReportRoutes from "./routes/labReportRoutes.js";
import labTestRoutes from "./routes/labTestRoutes.js";
import labRequestRoutes from "./routes/labRequestRoutes.js";
import radiologyReportRoutes from "./routes/radiologyReportRoutes.js";
import inventoryRoutes from "./routes/inventoryRoutes.js";
import financialRoutes from "./routes/financialRoutes.js";
import expensesRoutes from "./routes/expensesRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import activityLogRoutes from "./routes/activityLogRoutes.js";
import doctorProfileRoutes from "./routes/doctorProfileRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import saleRoutes from "./routes/saleRoutes.js";
import supplierRoutes from "./routes/supplierRoutes.js";
import shopCustomerRoutes from "./routes/shopCustomerRoutes.js";
import pharmacyRoutes from "./routes/enhancedPharmacyRoutes.js";
import pharmacyHistoryRoutes from "./routes/pharmacyHistoryRoutes.js";
import taxonomyRoutes from "./routes/taxonomyRoutes.js";
import procedureRoutes from "./routes/procedureRoutes.js";
import procedureCatalogRoutes from "./routes/procedureCatalogRoutes.js";
import procedurePatientRoutes from "./routes/procedurePatientRoutes.js";
import procedurePlanRoutes from "./routes/procedurePlanRoutes.js";
import fullRecordRoutes from "./routes/fullRecordRoutes.js";
import financialSummaryRoutes from "./routes/financialSummaryRoutes.js";
import backupRoutes from "./routes/backupRoutes.js";
import accountingRoutes from "./routes/accountingRoutes.js";
import daySessionRoutes from "./routes/daySessionRoutes.js";
import receivablesRoutes from "./routes/receivablesRoutes.js";
import payablesRoutes from "./routes/payablesRoutes.js";
import vendorPaymentRoutes from "./routes/vendorPaymentRoutes.js";
import staffAdvanceRoutes from "./routes/staffAdvanceRoutes.js";
import voucherRoutes from "./routes/voucherRoutes.js";
import budgetRoutes from "./routes/budgetRoutes.js";
import medicalFormRoutes from "./routes/medicalFormRoutes.js";
import companyRoutes from "./routes/companyRoutes.js";
import petShopCompanyRoutes from "./routes/petShopCompanyRoutes.js";
import petShopSupplierRoutes from "./routes/petShopSupplierRoutes.js";
import purchaseOrderRoutes from "./routes/purchaseOrderRoutes.js";
import pharmacyInvoiceRoutes from "./routes/pharmacyInvoiceRoutes.js";
import pharmacyPurchaseDraftRoutes from "./routes/pharmacyPurchaseDraftRoutes.js";
import holdBillRoutes from "./routes/holdBillRoutes.js";
import holdInvoiceRoutes from "./routes/holdInvoiceRoutes.js";
import pharmacySettingsRoutes from "./routes/pharmacySettingsRoutes.js";
import sidebarConfigRoutes from "./routes/sidebarConfigRoutes.js";
import shotReminderRoutes from "./routes/shotReminderRoutes.js";
import petShopHoldBillRoutes from "./routes/petShopHoldBillRoutes.js";
import petshopPharmacyRoutes from "./routes/petshopPharmacyRoutes.js";
import petshopPharmacyHistoryRoutes from "./routes/petshopPharmacyHistoryRoutes.js";
import petshopPharmacyInvoiceRoutes from "./routes/petshopPharmacyInvoiceRoutes.js";
import petshopPharmacyPurchaseDraftRoutes from "./routes/petshopPharmacyPurchaseDraftRoutes.js";
import petshopPharmacySettingsRoutes from "./routes/petshopPharmacySettingsRoutes.js";
import petshopNotificationRoutes from "./routes/petshopNotificationRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Connect to MongoDB
connectDB();

// Ensure default admin exists (dev-friendly)
(async () => {
  try {
    const username = (process.env.ADMIN_USERNAME || "admin").trim();
    const password = (process.env.ADMIN_PASSWORD || "admin123").trim();
    let admin = await User.findOne({ username });
    const allPortals = ["admin", "reception", "doctor", "lab", "pharmacy", "shop"];
    if (!admin) {
      admin = new User({
        username,
        password,
        role: "admin",
        name: "Admin User",
        email: "admin@petshospital.com",
        isActive: true,
        portalAccess: allPortals,
      });
      await admin.save();
      console.log(`✅ Default admin created: ${username}`);
    } else {
      let updated = false;
      if (admin.password !== password) {
        admin.password = password;
        updated = true;
      }
      if (!admin.isActive) {
        admin.isActive = true;
        updated = true;
      }
      if (admin.role !== "admin") {
        admin.role = "admin";
        updated = true;
      }
      if (!admin.portalAccess || admin.portalAccess.length === 0) {
        admin.portalAccess = allPortals;
        updated = true;
      }
      if (updated) {
        await admin.save();
        console.log(`✅ Admin ensured/updated: ${username}`);
      }
    }
  } catch (e) {
    console.warn("⚠️  Failed to ensure default admin:", e?.message || e);
  }
})();

// Ensure sidebar configs exist (backend-driven sidebars)
(async () => {
  try {
    const defaults = [
      {
        portalId: "admin",
        name: "Admin Portal",
        version: 1,
        groups: [
          {
            id: "dashboard",
            title: null,
            order: 0,
            items: [
              { id: "dashboard", label: "Dashboard", path: "/admin", iconKey: "FiGrid", order: 0, end: true },
            ],
          },
          {
            id: "pets-clients",
            title: "Pets & Clients",
            order: 1,
            items: [
              { id: "pets", label: "Pets Records", path: "/admin/pets", iconKey: "FiBookOpen", order: 0 },
              { id: "clients", label: "Clients Directory", path: "/admin/clients", iconKey: "FiUserCheck", order: 1 },
            ],
          },
          {
            id: "inventory",
            title: "Inventory",
            order: 2,
            items: [
              { id: "inventory", label: "Inventory", path: "/admin/inventory", iconKey: "FiBox", order: 0 },
              { id: "hospital-inventory", label: "Hospital Inventory", path: "/admin/hospital-inventory", iconKey: "FiHome", order: 1 },
            ],
          },
          {
            id: "accounts-finance",
            title: "Accounts & Finance",
            order: 3,
            items: [
              { id: "financials", label: "Financial Reports", path: "/admin/financials", iconKey: "FiDollarSign", order: 0 },
              { id: "finance-center", label: "Finance and Center", path: "/admin/finance-center", iconKey: "FiDollarSign", order: 1 },
              { id: "accounting-overview", label: "Accounting Overview", path: "/admin/accounting-overview", iconKey: "FiDollarSign", order: 2 },
              { id: "chart-of-accounts", label: "Chart of Accounts", path: "/admin/chart-of-accounts", iconKey: "FiBookOpen", order: 3 },
              { id: "vouchers", label: "Vouchers", path: "/admin/vouchers", iconKey: "FiDollarSign", order: 4 },
              { id: "petty-cash", label: "Petty Cash", path: "/admin/petty-cash", iconKey: "FiDollarSign", order: 5 },
              { id: "suppliers", label: "Suppliers", path: "/admin/suppliers", iconKey: "FiUsers", order: 6 },
              { id: "receivables", label: "Receivables", path: "/admin/receivables", iconKey: "FiDollarSign", order: 7 },
              { id: "payables", label: "Payables", path: "/admin/payables", iconKey: "FiDollarSign", order: 8 },
              { id: "vendor-payments", label: "Vendor Payments", path: "/admin/vendor-payments", iconKey: "FiDollarSign", order: 9 },
              { id: "budget-planner", label: "Budget Planner", path: "/admin/budget-planner", iconKey: "FiDollarSign", order: 10 },
              { id: "staff-advances", label: "Staff Advances", path: "/admin/staff-advances", iconKey: "FiDollarSign", order: 11 },
              { id: "day-sessions", label: "Day Sessions", path: "/admin/day-sessions", iconKey: "FiClock", order: 12 },
              { id: "expenses", label: "Expenses", path: "/admin/expenses", iconKey: "FiTrendingDown", order: 13 },
            ],
          },
          {
            id: "staff-management",
            title: "Staff Management",
            order: 4,
            items: [
              { id: "doctors", label: "Doctors", path: "/admin/doctors", iconKey: "FiUserCheck", order: 0 },
              { id: "staff", label: "Staff", path: "/admin/staff", iconKey: "FiUserPlus", order: 1 },
            ],
          },
          {
            id: "user-management",
            title: "User Management",
            order: 5,
            items: [
              { id: "users", label: "Users", path: "/admin/users", iconKey: "FiUsers", order: 0 },
              { id: "sidebar-permissions", label: "Sidebar Permissions", path: "/admin/sidebar-permissions", iconKey: "FiShield", order: 1 },
            ],
          },
          {
            id: "other",
            title: "Other",
            order: 6,
            items: [
              { id: "logs", label: "System Logs", path: "/admin/logs", iconKey: "FiActivity", order: 0 },
              { id: "settings", label: "Settings", path: "/admin/settings", iconKey: "FiSettings", order: 1 },
            ],
          },
        ],
      },
      {
        portalId: "reception",
        name: "Reception Portal",
        version: 1,
        groups: [
          {
            id: "main",
            title: "",
            order: 0,
            items: [
              { id: "dashboard", label: "Dashboard", path: "/reception", iconKey: "FiGrid", order: 0, end: true },
              { id: "pets", label: "Pets Registration", path: "/reception/pets", iconKey: "FiUserPlus", order: 1 },
              { id: "clients", label: "Clients Directory", path: "/reception/clients", iconKey: "FiUsers", order: 2 },
              { id: "appointments", label: "Appointments", path: "/reception/appointments", iconKey: "FiCalendar", order: 3 },
              { id: "visits", label: "Visit Records", path: "/reception/visits", iconKey: "FiFileText", order: 4 },
              { id: "billing", label: "Billing", path: "/reception/billing", iconKey: "FiDollarSign", order: 5 },
              { id: "reports", label: "Reports", path: "/reception/reports", iconKey: "FiBarChart2", order: 6 },
              { id: "forms", label: "Medical Forms", path: "/reception/forms", iconKey: "FiClipboard", order: 7 },
              { id: "procedures", label: "Procedures", path: "/reception/procedures", iconKey: "FiClipboard", order: 8 },
              { id: "settings", label: "Settings", path: "/reception/settings", iconKey: "FiSettings", order: 9 },
            ],
          },
        ],
      },
      {
        portalId: "lab",
        name: "Lab Portal",
        version: 1,
        groups: [
          {
            id: "main",
            title: "",
            order: 0,
            items: [
              { id: "dashboard", label: "Dashboard", path: "/lab", iconKey: "FiGrid", order: 0, end: true },
              { id: "catalog", label: "Test Catalog", path: "/lab/catalog", iconKey: "FiActivity", order: 1 },
              { id: "requests", label: "Requests", path: "/lab/requests", iconKey: "FiList", order: 2 },
              { id: "add-report", label: "Test Reports", path: "/lab/add-report", iconKey: "FiFilePlus", order: 3 },
              { id: "reports", label: "Reports", path: "/lab/reports", iconKey: "FiActivity", order: 4 },
              { id: "inventory", label: "Inventory", path: "/lab/inventory", iconKey: "FiPackage", order: 5 },
              { id: "sample-intake", label: "Sample Intake", path: "/lab/sample-intake", iconKey: "FiClipboard", order: 6 },
              { id: "radiology", label: "Radiology", path: "/lab/radiology", iconKey: "FiImage", order: 7 },
              { id: "suppliers", label: "Suppliers", path: "/lab/suppliers", iconKey: "FiList", order: 8 },
              { id: "settings", label: "Settings", path: "/lab/settings", iconKey: "FiSettings", order: 9 },
            ],
          },
        ],
      },
      {
        portalId: "doctor",
        name: "Doctor Portal",
        version: 1,
        groups: [
          {
            id: "main",
            title: "",
            order: 0,
            items: [
              { id: "dashboard", label: "Dashboard", path: "/doctor", iconKey: "FiGrid", order: 0, end: true },
              { id: "medicines", label: "Medicines", path: "/doctor/medicines", iconKey: "FiLayers", order: 1 },
              { id: "vaccines", label: "Vaccines", path: "/doctor/vaccines", iconKey: "FiActivity", order: 1.5 },
              { id: "prescription", label: "Prescription", path: "/doctor/prescription", iconKey: "FiFileText", order: 2 },
              { id: "prescription-history", label: "Prescription History", path: "/doctor/prescription-history", iconKey: "FiFileText", order: 2.5 },
              { id: "medical-forms", label: "Medical Forms", path: "/doctor/medical-forms", iconKey: "FiClipboard", order: 3 },
              { id: "medical-forms-history", label: "Medical Forms History", path: "/doctor/medical-forms-history", iconKey: "FiClipboard", order: 4 },
              { id: "details", label: "Doctor Details", path: "/doctor/details", iconKey: "FiUser", order: 5 },
              { id: "patients", label: "Patients", path: "/doctor/patients", iconKey: "FiClipboard", order: 6 },
              { id: "settings", label: "Settings", path: "/doctor/settings", iconKey: "FiSettings", order: 7 },
            ],
          },
        ],
      },
      {
        portalId: "shop",
        name: "Shop Portal",
        version: 1,
        groups: [
          {
            id: "main",
            title: "",
            order: 0,
            items: [
              { id: "dashboard", label: "Dashboard", path: "/shop", iconKey: "FiHome", order: 0, end: true },
              { id: "products", label: "Products", path: "/shop/products", iconKey: "FiPackage", order: 1 },
              { id: "pos", label: "Point of Sale", path: "/shop/pos", iconKey: "FiShoppingCart", order: 2 },
              { id: "suppliers", label: "Suppliers", path: "/shop/suppliers", iconKey: "FiTruck", order: 3 },
              { id: "companies", label: "Companies", path: "/shop/companies", iconKey: "FiUsers", order: 3.5 },
              { id: "reports", label: "Sales Reports", path: "/shop/reports", iconKey: "FiBarChart2", order: 4 },
              { id: "settings", label: "Settings", path: "/shop/settings", iconKey: "FiSettings", order: 5 },
            ],
          },
        ],
      },
      {
        portalId: "pharmacy",
        name: "Pharmacy Portal",
        version: 1,
        groups: [
          {
            id: "dashboard",
            title: "Dashboard",
            order: 0,
            items: [{ id: "dashboard", label: "Dashboard", path: "/pharmacy", iconKey: "FiHome", order: 0, end: true }],
          },
          {
            id: "pos",
            title: "POS",
            order: 1,
            items: [
              { id: "pos", label: "Point of Sale", path: "/pharmacy/pos", iconKey: "FiShoppingCart", order: 0 },
              { id: "credit-customers", label: "Credit Customers", path: "/pharmacy/credit-customers", iconKey: "FiCreditCard", order: 1 },
            ],
          },
          {
            id: "inventory",
            title: "Inventory",
            order: 2,
            items: [
              { id: "medicines", label: "Inventory", path: "/pharmacy/medicines", iconKey: "FiPackage", order: 0 },
              { id: "suppliers", label: "Suppliers", path: "/pharmacy/suppliers", iconKey: "FiUsers", order: 1 },
              { id: "companies", label: "Companies", path: "/pharmacy/companies", iconKey: "FiGrid", order: 2 },
              { id: "purchase-orders", label: "Purchase Orders", path: "/pharmacy/purchase-orders", iconKey: "FiFileText", order: 3 },
            ],
          },
          {
            id: "history",
            title: "History",
            order: 3,
            items: [
              { id: "sales-history", label: "Sales History", path: "/pharmacy/sales-history", iconKey: "FiFileText", order: 0 },
              { id: "purchase-history", label: "Purchase History", path: "/pharmacy/purchase-history", iconKey: "FiFileText", order: 1 },
              { id: "return-history", label: "Return History", path: "/pharmacy/return-history", iconKey: "FiFileText", order: 2 },
            ],
          },
          {
            id: "return",
            title: "Return",
            order: 4,
            items: [
              { id: "sales-return", label: "Sales Return", path: "/pharmacy/sales-return", iconKey: "FiCornerUpLeft", order: 0 },
              { id: "supplier-returns", label: "Supplier Returns", path: "/pharmacy/supplier-returns", iconKey: "FiFileText", order: 1 },
            ],
          },
          {
            id: "referral",
            title: "Referral",
            order: 5,
            items: [
              { id: "referrals", label: "Referrals", path: "/pharmacy/referrals", iconKey: "FiFileText", order: 0 },
              { id: "prescriptions", label: "Prescriptions", path: "/pharmacy/prescriptions", iconKey: "FiFileText", order: 1 },
            ],
          },
          {
            id: "other",
            title: "Other",
            order: 6,
            items: [
              { id: "reports", label: "Reports", path: "/pharmacy/reports", iconKey: "FiFileText", order: 0 },
              { id: "notifications", label: "Notifications", path: "/pharmacy/notifications", iconKey: "FiBell", order: 1 },
              { id: "audit-logs", label: "Audit Logs", path: "/pharmacy/audit-logs", iconKey: "FiActivity", order: 2 },
              { id: "expenses", label: "Expenses", path: "/pharmacy/expenses", iconKey: "FiTrendingDown", order: 3 },
              { id: "settings", label: "Settings", path: "/pharmacy/settings", iconKey: "FiSettings", order: 4 },
            ],
          },
        ],
      },
    ];

    for (const cfg of defaults) {
      const existing = await SidebarConfig.findOne({ portalId: cfg.portalId });
      if (!existing) {
        await SidebarConfig.create(cfg);
        console.log(`✅ SidebarConfig seeded: ${cfg.portalId}`);
      }
    }
  } catch (e) {
    console.warn("⚠️  Failed to ensure sidebar configs:", e?.message || e);
  }
})();

// Ensure indexes: allow multiple pets per client by dropping old unique index on clientId if it exists
(async () => {
  try {
    const idxs = await Pet.collection.indexes();
    const hasUniqueClient = idxs.find(
      (ix) => ix.name === "clientId_1" && ix.unique,
    );
    if (hasUniqueClient) {
      await Pet.collection.dropIndex("clientId_1");
      console.log(
        "✅ Dropped unique index clientId_1 to allow multiple pets per client",
      );
    }
  } catch (e) {
    if (e?.codeName !== "IndexNotFound") {
      console.warn("⚠️  Index check/drop failed:", e?.message || e);
    }
  }
})();

// Ensure PharmacyMedicine barcode index is unique (drop non-unique if exists)
(async () => {
  try {
    const idxs = await PharmacyMedicine.collection.indexes();
    const barcodeIdx = idxs.find((ix) => ix.name === "barcode_1");
    if (barcodeIdx && !barcodeIdx.unique) {
      await PharmacyMedicine.collection.dropIndex("barcode_1");
      console.log("✅ Dropped non-unique barcode index");
    }
    // Mongoose will (re)create indexes as per schema definition
  } catch (e) {
    if (e?.codeName !== "IndexNotFound") {
      console.warn("⚠️  PharmacyMedicine index check failed:", e?.message || e);
    }
  }
})();

// Middleware
// Relax CORS to accept requests from any frontend origin (helps during local/dev usage)
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.options("*", cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Pet Hospital API Server is running",
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use("/api/users", userRoutes);
app.use("/api/pets", petRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/medicines", medicineRoutes);
app.use("/api/vaccines", vaccineRoutes);
app.use("/api/lab-reports", labReportRoutes);
app.use("/api/lab-tests", labTestRoutes);
app.use("/api/lab-requests", labRequestRoutes);
app.use("/api/radiology-reports", radiologyReportRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/financials", financialRoutes);
app.use("/api/full-record", fullRecordRoutes);
app.use("/api/financial-summary", financialSummaryRoutes);
app.use("/api/backup", backupRoutes); // Mounted under /api/backup
app.use("/api/expenses", expensesRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/activity-logs", activityLogRoutes);
app.use("/api/doctor-profiles", doctorProfileRoutes);
app.use("/api/products", productRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/shop-customers", shopCustomerRoutes);
app.use("/api/pharmacy", pharmacyRoutes);
app.use("/api/pharmacy-history", pharmacyHistoryRoutes);
app.use("/api/taxonomy", taxonomyRoutes);
app.use("/api/procedures", procedureRoutes);
app.use("/api/procedure-catalog", procedureCatalogRoutes);
app.use("/api/procedure-patients", procedurePatientRoutes);
app.use("/api/procedure-plans", procedurePlanRoutes);
app.use("/api/accounting", accountingRoutes);
app.use("/api/vouchers", voucherRoutes);
app.use("/api/day", daySessionRoutes);
app.use("/api/receivables", receivablesRoutes);
app.use("/api/payables", payablesRoutes);
app.use("/api/vendor-payments", vendorPaymentRoutes);
app.use("/api/staff-advances", staffAdvanceRoutes);
app.use("/api/budgets", budgetRoutes);
app.use("/api/medical-forms", medicalFormRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/petshop-companies", petShopCompanyRoutes);
app.use("/api/petshop-suppliers", petShopSupplierRoutes);
app.use("/api/purchase-orders", purchaseOrderRoutes);
app.use("/api/pharmacy-invoices", pharmacyInvoiceRoutes);
app.use("/api/pharmacy-purchase-drafts", pharmacyPurchaseDraftRoutes);
app.use("/api/hold-invoices", holdInvoiceRoutes);
app.use("/api/hold-bills", holdBillRoutes);
app.use("/api/petshop-hold-bills", petShopHoldBillRoutes);
app.use("/api/pharmacy-settings", pharmacySettingsRoutes);
app.use("/api/petshop", petshopPharmacyRoutes);
app.use("/api/petshop-history", petshopPharmacyHistoryRoutes);
app.use("/api/petshop-invoices", petshopPharmacyInvoiceRoutes);
app.use("/api/petshop-purchase-drafts", petshopPharmacyPurchaseDraftRoutes);
app.use("/api/petshop-settings", petshopPharmacySettingsRoutes);
app.use("/api/petshop-notifications", petshopNotificationRoutes);
app.use("/api/sidebar-config", sidebarConfigRoutes);
app.use("/api/shot-reminders", shotReminderRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    error: process.env.NODE_ENV === "development" ? err : {},
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📍 API URL: http://localhost:${PORT}/api`);
  console.log(`🏥 Pet Hospital Management System Backend`);
  console.log(`⏰ Started at: ${new Date().toLocaleString()}\n`);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Promise Rejection:", err);
});
