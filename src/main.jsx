import React from "react";
import { createRoot } from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router-dom";
import App from "./App";
import "./style.css";
import "react-datepicker/dist/react-datepicker.css";
import { SettingsProvider } from "./context/SettingsContext";
import { ActivityProvider } from "./context/ActivityContext";
import { AlertProvider } from "./context/AlertContext";

import Home from "./pages/Home";
import AdminLogin from "./pages/AdminLogin";
import ReceptionLogin from "./pages/ReceptionLogin";
import PharmacyLogin from "./pages/PharmacyLogin";
import LabLogin from "./pages/LabLogin";
import ShopLogin from "./pages/ShopLogin";
import DoctorLogin from "./pages/DoctorLogin";

import AdminDashboard from "./pages/dashboards/AdminDashboard";
import ReceptionDashboard from "./pages/dashboards/ReceptionDashboard";
import PharmacyDashboard from "./pages/dashboards/PharmacyDashboard";
import LabDashboard from "./pages/dashboards/LabDashboard";
import ShopDashboard from "./pages/dashboards/ShopDashboard";
import DoctorDashboard from "./pages/doctor/Dashboard";
import DoctorMedicines from "./pages/doctor/Medicines";
import DoctorVaccines from "./pages/doctor/Vaccines";
import DoctorPrescription from "./pages/doctor/Prescription";
import DoctorPrescriptionHistory from "./pages/doctor/PrescriptionHistory";
import DoctorDetails from "./pages/doctor/Details";
import PatientHistory from "./pages/doctor/PatientHistory";
import DoctorPatients from "./pages/doctor/Patients";
import DoctorMedicalForms from "./pages/doctor/MedicalForms";
import DoctorMedicalFormsHistory from "./pages/doctor/MedicalFormsHistory";
import DoctorSettings from "./pages/doctor/Settings";
import AdminLayout from "./layouts/AdminLayout";
import ReceptionLayout from "./layouts/ReceptionLayout";
import LabLayout from "./layouts/LabLayout";
import DoctorLayout from "./layouts/DoctorLayout";
import ReceptionPortalDashboard from "./pages/reception/Dashboard.jsx";
import ReceptionPets from "./pages/reception/Pets";
import ReceptionClients from "./pages/reception/Clients";
import ReceptionAppointments from "./pages/reception/Appointments";
import ReceptionVisits from "./pages/reception/Visits";
import ReceptionBilling from "./pages/reception/Billing";
import ReceptionReports from "./pages/reception/Reports.jsx";
import ReceptionForms from "./pages/reception/Forms.jsx";
import ReceptionProcedures from "./pages/reception/Procedures.jsx";
import ReceptionProcedureCatalog from "./pages/reception/ProcedureCatalog.jsx";
import ReceptionProcedurePatients from "./pages/reception/ProcedurePatients.jsx";
import ReceptionProcedurePatientDetails from "./pages/reception/ProcedurePatientDetails.jsx";
import ReceptionSettings from "./pages/reception/Settings.jsx";
import ReceptionShotsReminder from "./pages/reception/ShotsReminder.jsx";
import Dashboard from "./pages/admin/Dashboard";
import Users from "./pages/admin/Users";
import Doctors from "./pages/admin/Doctors";
import Pets from "./pages/admin/Pets";
import Clients from "./pages/admin/Clients";
import Financials from "./pages/admin/Financials";
import ERPExpenses from "./pages/admin/ERPExpenses";
import Inventory from "./pages/admin/Inventory";
import HospitalInventory from "./pages/admin/HospitalInventory";
import Logs from "./pages/admin/Logs";
import Settings from "./pages/admin/Settings";
import SidebarPermissions from "./pages/admin/SidebarPermissions";
import FinanceAndCenter from "./pages/admin/FinanceAndCenter";
import DaySessions from "./pages/admin/DaySessions";
import Receivables from "./pages/admin/Receivables";
import Payables from "./pages/admin/Payables";
import VendorPayments from "./pages/admin/VendorPayments";
import StaffAdvances from "./pages/admin/StaffAdvances";
import AdminSuppliers from "./pages/admin/Suppliers";
import ChartOfAccounts from "./pages/admin/ChartOfAccounts";
import Vouchers from "./pages/admin/Vouchers";
import AccountingOverview from "./pages/admin/AccountingOverview";
import PettyCash from "./pages/admin/PettyCash";
import BudgetPlanner from "./pages/admin/BudgetPlanner";
import StaffDashboard from "./pages/admin/staff/StaffDashboard";
import StaffManagement from "./pages/admin/staff/StaffManagement";
import Attendance from "./pages/admin/staff/Attendance";
import MonthlyReports from "./pages/admin/staff/MonthlyReports";
import StaffSettings from "./pages/admin/staff/StaffSettings";
import LabHome from "./pages/lab/Dashboard";
import LabRequests from "./pages/lab/Requests";
import LabAddReport from "./pages/lab/AddReport";
import LabReports from "./pages/lab/Reports";
import LabInventory from "./pages/lab/Inventory";
import Radiology from "./pages/lab/Radiology";
import LabCatalog from "./pages/lab/Catalog";
import LabSettings from "./pages/lab/Settings";
import LabSuppliers from "./pages/lab/Suppliers";
import LabSampleIntake from "./pages/lab/SampleIntake";
import ShopLayout from "./layouts/ShopLayout";
import ShopDashboardPage from "./pages/shop/ShopDashboard";
import ShopAddProduct from "./pages/shop/AddProduct";
import POS from "./pages/shop/POS";
import ShopSuppliers from "./pages/shop/Suppliers";
import ShopCompanies from "./pages/shop/Companies";
import SalesReports from "./pages/shop/SalesReports";
import ShopSettings from "./pages/shop/Settings";
import ShopCreditCustomers from "./pages/shop/CreditCustomers";
import ShopSalesHistory from "./pages/shop/SalesHistory";
import ShopPurchaseHistory from "./pages/shop/PurchaseHistory";
import ShopSalesReturn from "./pages/shop/SalesReturn";
import ShopReturnHistory from "./pages/shop/ReturnHistory";
import ShopSupplierReturns from "./pages/shop/SupplierReturns";
import ShopNotifications from "./pages/shop/Notifications";
import PharmacyLayout from "./layouts/PharmacyLayout";
import PharmacyDashboardNew from "./pages/pharmacy/Dashboard";
import Medicines from "./pages/pharmacy/Medicines";
import PharmacyPrescriptions from "./pages/pharmacy/Prescriptions";
import PharmacyPOS from "./pages/pharmacy/POS";
import PharmacyReports from "./pages/pharmacy/Reports";
import PharmacySuppliers from "./pages/pharmacy/Suppliers";
import PharmacySettings from "./pages/pharmacy/Settings";
import PharmacyReferrals from "./pages/pharmacy/Referrals";
import SalesHistory from "./pages/pharmacy/SalesHistory";
import PurchaseHistory from "./pages/pharmacy/PurchaseHistory";
import SupplierReturns from "./pages/pharmacy/SupplierReturns";
import PharmacyCompanies from "./pages/pharmacy/Companies";
import AddInvoice from "./pages/pharmacy/AddInvoice";
import CreditCustomers from "./pages/pharmacy/CreditCustomers";
import SalesReturn from "./pages/pharmacy/SalesReturn";
import ReturnHistory from "./pages/pharmacy/ReturnHistory";
import PharmacyNotifications from "./pages/pharmacy/Notifications";
import PharmacyAuditLogs from "./pages/pharmacy/AuditLogs";
import PharmacyExpenses from "./pages/pharmacy/Expenses";
import PharmacyPurchaseOrders from "./pages/pharmacy/PurchaseOrders";

import ShopPharmacyLayout from "./layouts/ShopPharmacyLayout";
import ShopPharmacyDashboardPage from "./pages/shop/pharmacy/Dashboard";
import ShopPharmacyMedicines from "./pages/shop/pharmacy/Medicines";
import ShopPharmacyPOS from "./pages/shop/pharmacy/POS";
import ShopPharmacyCreditCustomers from "./pages/shop/pharmacy/CreditCustomers";
import ShopPharmacySuppliers from "./pages/shop/pharmacy/Suppliers";
import ShopPharmacyCompanies from "./pages/shop/pharmacy/Companies";
import ShopPharmacyAddInvoice from "./pages/shop/pharmacy/AddInvoice";
import ShopPharmacyPurchaseOrders from "./pages/shop/pharmacy/PurchaseOrders";
import ShopPharmacySalesHistory from "./pages/shop/pharmacy/SalesHistory";
import ShopPharmacyPurchaseHistory from "./pages/shop/pharmacy/PurchaseHistory";
import ShopPharmacyReturnHistory from "./pages/shop/pharmacy/ReturnHistory";
import ShopPharmacySalesReturn from "./pages/shop/pharmacy/SalesReturn";
import ShopPharmacySupplierReturns from "./pages/shop/pharmacy/SupplierReturns";
import ShopPharmacyReferrals from "./pages/shop/pharmacy/Referrals";
import ShopPharmacyPrescriptions from "./pages/shop/pharmacy/Prescriptions";
import ShopPharmacyReports from "./pages/shop/pharmacy/Reports";
import ShopPharmacyNotifications from "./pages/shop/pharmacy/Notifications";
import ShopPharmacyAuditLogs from "./pages/shop/pharmacy/AuditLogs";
import ShopPharmacyExpenses from "./pages/shop/pharmacy/Expenses";
import ShopPharmacySettings from "./pages/shop/pharmacy/Settings";
import ShopInventory from "./pages/shop/Inventory";

const router = createHashRouter(
  [
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      { path: "admin-login", element: <AdminLogin /> },
      { path: "admin/login", element: <AdminLogin /> },
      { path: "reception-login", element: <ReceptionLogin /> },
      { path: "reception/login", element: <ReceptionLogin /> },
      { path: "pharmacy-login", element: <PharmacyLogin /> },
      { path: "pharmacy/login", element: <PharmacyLogin /> },
      { path: "lab-login", element: <LabLogin /> },
      { path: "lab/login", element: <LabLogin /> },
      { path: "shop-login", element: <ShopLogin /> },
      { path: "shop/login", element: <ShopLogin /> },
      { path: "doctor-login", element: <DoctorLogin /> },
      { path: "doctor/login", element: <DoctorLogin /> },
      { path: "admin/dashboard", element: <AdminDashboard /> },
      { path: "reception/dashboard", element: <ReceptionPortalDashboard /> },
      { path: "pharmacy/dashboard", element: <PharmacyDashboardNew /> },
      { path: "lab/dashboard", element: <LabDashboard /> },
      { path: "shop/dashboard", element: <ShopDashboard /> },
      { path: "doctor/dashboard", element: <DoctorDashboard /> },

      {
        path: "admin",
        element: <AdminLayout />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: "users", element: <Users /> },
          { path: "sidebar-permissions", element: <SidebarPermissions /> },
          { path: "doctors", element: <Doctors /> },
          { path: "pets", element: <Pets /> },
          { path: "clients", element: <Clients /> },
          { path: "financials", element: <Financials /> },
          { path: "accounting-overview", element: <AccountingOverview /> },
          { path: "chart-of-accounts", element: <ChartOfAccounts /> },
          { path: "vouchers", element: <Vouchers /> },
          { path: "petty-cash", element: <PettyCash /> },
          { path: "finance-center", element: <FinanceAndCenter /> },
          { path: "suppliers", element: <AdminSuppliers /> },
          { path: "day-sessions", element: <DaySessions /> },
          { path: "receivables", element: <Receivables /> },
          { path: "payables", element: <Payables /> },
          { path: "vendor-payments", element: <VendorPayments /> },
          { path: "staff-advances", element: <StaffAdvances /> },
          { path: "expenses", element: <ERPExpenses /> },
          { path: "budget-planner", element: <BudgetPlanner /> },
          { path: "inventory", element: <Inventory /> },
          { path: "hospital-inventory", element: <HospitalInventory /> },
          { path: "logs", element: <Logs /> },
          { path: "settings", element: <Settings /> },
          { path: "staff", element: <StaffDashboard /> },
          { path: "staff/management", element: <StaffManagement /> },
          { path: "staff/attendance", element: <Attendance /> },
          { path: "staff/monthly", element: <MonthlyReports /> },
          { path: "staff/settings", element: <StaffSettings /> },
        ],
      },
      {
        path: "reception",
        element: <ReceptionLayout />,
        children: [
          { index: true, element: <ReceptionPortalDashboard /> },
          { path: "pets", element: <ReceptionPets /> },
          { path: "clients", element: <ReceptionClients /> },
          { path: "appointments", element: <ReceptionAppointments /> },
          { path: "visits", element: <ReceptionVisits /> },
          { path: "billing", element: <ReceptionBilling /> },
          { path: "reports", element: <ReceptionReports /> },
          { path: "forms", element: <ReceptionForms /> },
          { path: "procedures", element: <ReceptionProcedures /> },
          { path: "procedure-catalog", element: <ReceptionProcedureCatalog /> },
          { path: "procedure-patients", element: <ReceptionProcedurePatients /> },
          { path: "procedure-patients/:petId", element: <ReceptionProcedurePatientDetails /> },
          { path: "shots-reminder", element: <ReceptionShotsReminder /> },
          { path: "settings", element: <ReceptionSettings /> },
        ],
      },
      {
        path: "lab",
        element: <LabLayout />,
        children: [
          { index: true, element: <LabHome /> },
          { path: "catalog", element: <LabCatalog /> },
          { path: "requests", element: <LabRequests /> },
          { path: "add-report", element: <LabAddReport /> },
          { path: "reports", element: <LabReports /> },
          { path: "inventory", element: <LabInventory /> },
          { path: "suppliers", element: <LabSuppliers /> },
          { path: "sample-intake", element: <LabSampleIntake /> },
          { path: "radiology", element: <Radiology /> },
          { path: "settings", element: <LabSettings /> },
        ],
      },
      {
        path: "doctor",
        element: <DoctorLayout />,
        children: [
          { index: true, element: <DoctorDashboard /> },
          { path: "medicines", element: <DoctorMedicines /> },
          { path: "vaccines", element: <DoctorVaccines /> },
          { path: "prescription", element: <DoctorPrescription /> },
          { path: "prescription-history", element: <DoctorPrescriptionHistory /> },
          { path: "details", element: <DoctorDetails /> },
          { path: "patients", element: <DoctorPatients /> },
          { path: "medical-forms", element: <DoctorMedicalForms /> },
          {
            path: "medical-forms-history",
            element: <DoctorMedicalFormsHistory />,
          },
          { path: "patient/:id", element: <PatientHistory /> },
          { path: "settings", element: <DoctorSettings /> },
        ],
      },
      {
        path: "shop",
        element: <ShopLayout />,
        children: [
          { index: true, element: <ShopDashboardPage /> },
          { path: "inventory", element: <ShopInventory /> },
          { path: "add-product", element: <ShopAddProduct /> },
          { path: "pos", element: <POS /> },
          { path: "sales-history", element: <ShopSalesHistory /> },
          { path: "purchase-history", element: <ShopPurchaseHistory /> },
          { path: "sales-return", element: <ShopSalesReturn /> },
          { path: "supplier-returns", element: <ShopSupplierReturns /> },
          { path: "return-history", element: <ShopReturnHistory /> },
          { path: "notifications", element: <ShopNotifications /> },
          { path: "suppliers", element: <ShopSuppliers /> },
          { path: "companies", element: <ShopCompanies /> },
          { path: "reports", element: <SalesReports /> },
          { path: "credit-customers", element: <ShopCreditCustomers /> },
          { path: "settings", element: <ShopSettings /> },
        ],
      },
      {
        path: "shop/pharmacy",
        element: <ShopPharmacyLayout />,
        children: [
          { index: true, element: <ShopPharmacyDashboardPage /> },
          { path: "medicines", element: <ShopPharmacyMedicines /> },
          { path: "pos", element: <ShopPharmacyPOS /> },
          { path: "credit-customers", element: <ShopPharmacyCreditCustomers /> },
          { path: "suppliers", element: <ShopPharmacySuppliers /> },
          { path: "companies", element: <ShopPharmacyCompanies /> },
          { path: "add-invoice", element: <ShopPharmacyAddInvoice /> },
          { path: "purchase-orders", element: <ShopPharmacyPurchaseOrders /> },
          { path: "sales-history", element: <ShopPharmacySalesHistory /> },
          { path: "purchase-history", element: <ShopPharmacyPurchaseHistory /> },
          { path: "return-history", element: <ShopPharmacyReturnHistory /> },
          { path: "sales-return", element: <ShopPharmacySalesReturn /> },
          { path: "supplier-returns", element: <ShopPharmacySupplierReturns /> },
          { path: "referrals", element: <ShopPharmacyReferrals /> },
          { path: "prescriptions", element: <ShopPharmacyPrescriptions /> },
          { path: "reports", element: <ShopPharmacyReports /> },
          { path: "notifications", element: <ShopPharmacyNotifications /> },
          { path: "audit-logs", element: <ShopPharmacyAuditLogs /> },
          { path: "expenses", element: <ShopPharmacyExpenses /> },
          { path: "settings", element: <ShopPharmacySettings /> },
        ],
      },
      {
        path: "pharmacy",
        element: <PharmacyLayout />,
        children: [
          { index: true, element: <PharmacyDashboardNew /> },
          { path: "medicines", element: <Medicines /> },
          { path: "suppliers", element: <PharmacySuppliers /> },
          { path: "prescriptions", element: <PharmacyPrescriptions /> },
          { path: "referrals", element: <PharmacyReferrals /> },
          { path: "pos", element: <PharmacyPOS /> },
          { path: "sales-history", element: <SalesHistory /> },
          { path: "purchase-history", element: <PurchaseHistory /> },
          { path: "supplier-returns", element: <SupplierReturns /> },
          { path: "companies", element: <PharmacyCompanies /> },
          { path: "add-invoice", element: <AddInvoice /> },
          { path: "credit-customers", element: <CreditCustomers /> },
          { path: "sales-return", element: <SalesReturn /> },
          { path: "return-history", element: <ReturnHistory /> },
          { path: "reports", element: <PharmacyReports /> },
          { path: "notifications", element: <PharmacyNotifications /> },
          { path: "audit-logs", element: <PharmacyAuditLogs /> },
          { path: "expenses", element: <PharmacyExpenses /> },
          { path: "purchase-orders", element: <PharmacyPurchaseOrders /> },
          { path: "settings", element: <PharmacySettings /> },
        ],
      },
    ],
  },
],
{
  future: {
    v7_startTransition: true,
  },
});

createRoot(document.getElementById("app")).render(
  <React.StrictMode>
    <SettingsProvider>
      <ActivityProvider>
        <AlertProvider>
          <RouterProvider router={router} />
        </AlertProvider>
      </ActivityProvider>
    </SettingsProvider>
  </React.StrictMode>,
);
