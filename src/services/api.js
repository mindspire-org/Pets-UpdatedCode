// API Service Layer - Replaces localStorage with MongoDB API calls
// Updated: Added pharmacySettingsAPI for shared pharmacy settings

const DEFAULT_API_BASE_URL = "http://localhost:3001/api";
const envApiBase = (import.meta.env.VITE_API_URL || "")
  .trim()
  .replace(/\/$/, "");
const API_BASE_URL = envApiBase || DEFAULT_API_BASE_URL;

const requestFromBase = async (base, endpoint, method, body) => {
  const options = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body && method !== "GET") {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${base}${endpoint}`, options);
  let data;
  try {
    data = await response.json();
  } catch {
    data = { message: response.statusText };
  }

  if (!response.ok) {
    const error = new Error(data.message || "API request failed");
    error.status = response.status;
    error.response = data;
    throw error;
  }

  return data;
};

// Generic API call handler with localhost fallback
const apiCall = async (endpoint, method = "GET", body = null) => {
  try {
    return await requestFromBase(API_BASE_URL, endpoint, method, body);
  } catch (error) {
    const canFallback = API_BASE_URL !== DEFAULT_API_BASE_URL;
    if (canFallback) {
      try {
        console.warn(
          `API primary failed (${API_BASE_URL}${endpoint}). Retrying default ${DEFAULT_API_BASE_URL}${endpoint}`,
        );
        return await requestFromBase(
          DEFAULT_API_BASE_URL,
          endpoint,
          method,
          body,
        );
      } catch (fallbackError) {
        console.error(`API fallback error [${endpoint}]:`, fallbackError);
        throw fallbackError;
      }
    }
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
};

// Silent variant — same as apiCall but suppresses console noise for 404s (expected "not found" probes)
const silentApiCall = async (endpoint, method = "GET", body = null) => {
  try {
    return await requestFromBase(API_BASE_URL, endpoint, method, body);
  } catch (error) {
    const canFallback = API_BASE_URL !== DEFAULT_API_BASE_URL;
    if (canFallback) {
      try {
        return await requestFromBase(DEFAULT_API_BASE_URL, endpoint, method, body);
      } catch (fallbackError) {
        if (fallbackError?.status !== 404) console.error(`API fallback error [${endpoint}]:`, fallbackError);
        throw fallbackError;
      }
    }
    if (error?.status !== 404) console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
};

// Users API
export const usersAPI = {
  getAll: () => apiCall("/users"),
  getByUsername: (username) => apiCall(`/users/${username}`),
  create: (userData) => apiCall("/users", "POST", userData),
  login: (credentials) => apiCall("/users/login", "POST", credentials),
  update: (username, userData) =>
    apiCall(`/users/${username}`, "PUT", userData),
  updatePermissions: (username, sidebarPermissions) =>
    apiCall(`/users/${username}/permissions`, "PUT", { sidebarPermissions }),
  delete: (username) => apiCall(`/users/${username}`, "DELETE"),
};

export const sidebarConfigAPI = {
  getAll: () => apiCall("/sidebar-config"),
  getByPortal: (portalId) => apiCall(`/sidebar-config/${portalId}`),
  getByPortalId: (portalId) => apiCall(`/sidebar-config/${portalId}`),
  update: (portalId, data) => apiCall(`/sidebar-config/${portalId}`, "PUT", data),
};

// Pets API
export const petsAPI = {
  getAll: () => apiCall("/pets"),
  getById: (id) => apiCall(`/pets/${id}`),
  search: (query) => apiCall(`/pets/search/${query}`),
  create: (petData) => apiCall("/pets", "POST", petData),
  bulkImport: (pets) => apiCall("/pets/bulk", "POST", { pets }),
  update: (id, petData) => apiCall(`/pets/${id}`, "PUT", petData),
  delete: (id) => apiCall(`/pets/${id}`, "DELETE"),
  deleteAll: () => apiCall("/pets/all", "DELETE"),
};

// Appointments API
export const appointmentsAPI = {
  getAll: () => apiCall("/appointments"),
  getById: (id) => apiCall(`/appointments/${id}`),
  create: (appointmentData) =>
    apiCall("/appointments", "POST", appointmentData),
  update: (id, appointmentData) =>
    apiCall(`/appointments/${id}`, "PUT", appointmentData),
  delete: (id) => apiCall(`/appointments/${id}`, "DELETE"),
};

// Prescriptions API
export const prescriptionsAPI = {
  getAll: () => apiCall("/prescriptions"),
  getById: (id) => apiCall(`/prescriptions/${id}`),
  getByPatient: (patientId) => apiCall(`/prescriptions/patient/${patientId}`),
  create: (prescriptionData) =>
    apiCall("/prescriptions", "POST", prescriptionData),
  update: (id, prescriptionData) =>
    apiCall(`/prescriptions/${id}`, "PUT", prescriptionData),
  delete: (id) => apiCall(`/prescriptions/${id}`, "DELETE"),
};

// Medicines API
export const medicinesAPI = {
  getAll: () => apiCall("/medicines"),
  getById: (id) => apiCall(`/medicines/${id}`),
  create: (medicineData) => apiCall("/medicines", "POST", medicineData),
  update: (id, medicineData) =>
    apiCall(`/medicines/${id}`, "PUT", medicineData),
  delete: (id) => apiCall(`/medicines/${id}`, "DELETE"),
  getLowStock: () => apiCall("/medicines/alerts/low-stock"),
};

// Lab Reports API
export const labReportsAPI = {
  getAll: () => apiCall("/lab-reports"),
  getById: (id) => apiCall(`/lab-reports/${id}`),
  create: (reportData) => apiCall("/lab-reports", "POST", reportData),
  update: (id, reportData) => apiCall(`/lab-reports/${id}`, "PUT", reportData),
  delete: (id) => apiCall(`/lab-reports/${id}`, "DELETE"),
  recover: (id, payload) =>
    apiCall(`/lab-reports/${id}/recover`, "POST", payload),
};

// Radiology Reports API
export const radiologyReportsAPI = {
  getAll: () => apiCall("/radiology-reports"),
  getById: (id) => apiCall(`/radiology-reports/${id}`),
  create: (reportData) => apiCall("/radiology-reports", "POST", reportData),
  update: (id, reportData) =>
    apiCall(`/radiology-reports/${id}`, "PUT", reportData),
  delete: (id) => apiCall(`/radiology-reports/${id}`, "DELETE"),
};

// Lab Requests API (Sample Intakes)
export const labRequestsAPI = {
  getAll: () => apiCall("/lab-requests"),
  getById: (id) => apiCall(`/lab-requests/${id}`),
  create: (data) => apiCall("/lab-requests", "POST", data),
  update: (id, data) => apiCall(`/lab-requests/${id}`, "PUT", data),
  delete: (id) => apiCall(`/lab-requests/${id}`, "DELETE"),
};

// Lab Tests API
export const labTestsAPI = {
  getAll: () => apiCall("/lab-tests"),
  getById: (id) => apiCall(`/lab-tests/${id}`),
  create: (testData) => apiCall("/lab-tests", "POST", testData),
  update: (id, testData) => apiCall(`/lab-tests/${id}`, "PUT", testData),
  delete: (id) => apiCall(`/lab-tests/${id}`, "DELETE"),
};

// Inventory API
export const inventoryAPI = {
  getAll: () => apiCall("/inventory"),
  getById: (id) => apiCall(`/inventory/${id}`),
  getCategories: (department) => {
    const qs = department
      ? `?department=${encodeURIComponent(department)}`
      : "";
    return apiCall(`/inventory/categories${qs}`);
  },
  create: (itemData) => apiCall("/inventory", "POST", itemData),
  bulkUpsert: (items) =>
    apiCall(
      "/inventory/bulk",
      "POST",
      Array.isArray(items) ? items : { items },
    ),
  update: (id, itemData) => apiCall(`/inventory/${id}`, "PUT", itemData),
  delete: (id) => apiCall(`/inventory/${id}`, "DELETE"),
};

// Financials API
export const financialsAPI = {
  getAll: () => apiCall("/financials"),
  getById: (id) => apiCall(`/financials/${id}`),
  create: (financialData) => apiCall("/financials", "POST", financialData),
  update: (id, financialData) =>
    apiCall(`/financials/${id}`, "PUT", financialData),
  delete: (id) => apiCall(`/financials/${id}`, "DELETE"),
};

// Settings API
export const settingsAPI = {
  get: (userId) => apiCall(`/settings/${userId}`),
  save: (settingsData) => apiCall("/settings", "POST", settingsData),
  update: (userId, settingsData) =>
    apiCall(`/settings/${userId}`, "PUT", settingsData),
};

// Pharmacy Settings API - Shared settings for all pharmacy users
export const pharmacySettingsAPI = {
  get: () => apiCall("/pharmacy-settings"),
  getDefaults: () => apiCall("/pharmacy-settings/defaults"),
  save: (settingsData) => apiCall("/pharmacy-settings", "POST", settingsData),
  update: (settingsData) => apiCall("/pharmacy-settings", "PUT", settingsData),
};

// Backup API - full system export/import
export const backupAPI = {
  exportAll: () => apiCall("/backup/export-all"),
  importAll: (data) => apiCall("/backup/import-all", "POST", data),
  clearReception: () => apiCall("/backup/clear-reception", "DELETE"),
  clearPharmacy: () => apiCall("/backup/clear-pharmacy", "DELETE"),
  clearLab: () => apiCall("/backup/clear-lab", "DELETE"),
  clearShop: () => apiCall("/backup/clear-shop", "DELETE"),
  clearDoctor: () => apiCall("/backup/clear-doctor", "DELETE"),
};

// Activity Logs API
export const activityLogsAPI = {
  getAll: () => apiCall("/activity-logs"),
  getByUser: (user) => apiCall(`/activity-logs/user/${user}`),
  create: (logData) => apiCall("/activity-logs", "POST", logData),
  clear: () => apiCall("/activity-logs/clear", "DELETE"),
  delete: (id) => apiCall(`/activity-logs/${id}`, "DELETE"),
};

// Doctor Profile API
export const doctorProfileAPI = {
  list: async () => {
    try {
      return await apiCall("/doctor-profiles");
    } catch (err) {
      console.warn(
        "doctorProfileAPI.list falling back to localStorage",
        err?.message,
      );
      const cached = JSON.parse(
        localStorage.getItem("doctor_profiles") || "[]",
      );
      return { success: true, data: cached };
    }
  },
  get: async (username) => {
    try {
      return await apiCall(`/doctor-profiles/${username}`);
    } catch (err) {
      const cached = JSON.parse(
        localStorage.getItem("doctor_profiles") || "[]",
      );
      const profile = cached.find((d) => d.username === username);
      if (profile) return { success: true, data: profile };
      throw err;
    }
  },
  save: async (profileData) => {
    try {
      return await apiCall("/doctor-profiles", "POST", profileData);
    } catch (err) {
      console.warn("doctorProfileAPI.save offline fallback");
      const cached = JSON.parse(
        localStorage.getItem("doctor_profiles") || "[]",
      );
      const filtered = cached.filter(
        (d) => d.username !== profileData.username,
      );
      filtered.push({ ...profileData, _id: profileData.username });
      localStorage.setItem("doctor_profiles", JSON.stringify(filtered));
      return { success: true, data: profileData };
    }
  },
  update: async (username, profileData) => {
    try {
      return await apiCall(`/doctor-profiles/${username}`, "PUT", profileData);
    } catch (err) {
      console.warn("doctorProfileAPI.update offline fallback");
      const cached = JSON.parse(
        localStorage.getItem("doctor_profiles") || "[]",
      );
      const updated = cached.map((d) =>
        d.username === username ? { ...d, ...profileData } : d,
      );
      localStorage.setItem("doctor_profiles", JSON.stringify(updated));
      return { success: true, data: profileData };
    }
  },
  updateSignature: async (username, signature) => {
    try {
      return await apiCall(`/doctor-profiles/${username}/signature`, "PUT", {
        signature,
      });
    } catch (err) {
      const cached = JSON.parse(
        localStorage.getItem("doctor_profiles") || "[]",
      );
      const updated = cached.map((d) =>
        d.username === username ? { ...d, signature } : d,
      );
      localStorage.setItem("doctor_profiles", JSON.stringify(updated));
      return {
        success: true,
        data: updated.find((d) => d.username === username),
      };
    }
  },
  delete: async (username) => {
    try {
      return await apiCall(`/doctor-profiles/${username}`, "DELETE");
    } catch (err) {
      console.warn("doctorProfileAPI.delete offline fallback");
      const cached = JSON.parse(
        localStorage.getItem("doctor_profiles") || "[]",
      );
      const filtered = cached.filter((d) => d.username !== username);
      localStorage.setItem("doctor_profiles", JSON.stringify(filtered));
      return { success: true };
    }
  },
};

// Pharmacy API
export const pharmacyMedicinesAPI = {
  getAll: () => apiCall("/pharmacy/medicines"),
  getById: (id) => apiCall(`/pharmacy/medicines/${id}`),
  search: (query) => apiCall(`/pharmacy/medicines/search/${query}`),
  findByBarcode: (barcode) =>
    silentApiCall(`/pharmacy/medicines/find-by-barcode/${barcode}`),
  getLowStock: () => apiCall("/pharmacy/medicines/alerts/low-stock"),
  getExpiring: () => apiCall("/pharmacy/medicines/alerts/expiring"),
  getExpired: () => apiCall("/pharmacy/medicines/alerts/expired"),
  create: (medicineData) =>
    apiCall("/pharmacy/medicines", "POST", medicineData),
  update: (id, medicineData) =>
    apiCall(`/pharmacy/medicines/${id}`, "PUT", medicineData),
  delete: (id) => apiCall(`/pharmacy/medicines/${id}`, "DELETE"),
  bulkUpsert: (rows) => apiCall("/pharmacy/medicines/bulk-upsert", "POST", rows),
};

export const pharmacySalesAPI = {
  getAll: () => apiCall("/pharmacy/sales"),
  getById: (id) => apiCall(`/pharmacy/sales/${id}`),
  getByDateRange: (startDate, endDate) =>
    apiCall(`/pharmacy/sales/date-range/${startDate}/${endDate}`),
  create: (saleData) => apiCall("/pharmacy/sales", "POST", saleData),
  updatePayment: (id, payload) =>
    apiCall(`/pharmacy/sales/${id}/payment`, "PUT", payload),
  update: (id, saleData) => apiCall(`/pharmacy/sales/${id}`, "PUT", saleData),
  recover: (id, payload) =>
    apiCall(`/pharmacy/sales/${id}/recover`, "POST", payload),
  delete: (id) => apiCall(`/pharmacy/sales/${id}`, "DELETE"),
};

export const pharmacyPurchasesAPI = {
  getAll: () => apiCall("/pharmacy/purchases"),
  getById: (id) => apiCall(`/pharmacy/purchases/${id}`),
  create: (purchaseData) =>
    apiCall("/pharmacy/purchases", "POST", purchaseData),
  update: (id, purchaseData) =>
    apiCall(`/pharmacy/purchases/${id}`, "PUT", purchaseData),
  delete: (id) => apiCall(`/pharmacy/purchases/${id}`, "DELETE"),
};

// Pharmacy Dues API
export const pharmacyDuesAPI = {
  getAll: () => apiCall("/pharmacy/dues"),
  getByClient: (clientId) => apiCall(`/pharmacy/dues/${clientId}`),
  upsert: (clientId, data) =>
    apiCall(`/pharmacy/dues/${clientId}`, "PUT", data),
};

// Pharmacy Credit Customers API
export const pharmacyCreditCustomersAPI = {
  getAll: () => apiCall("/pharmacy/credit-customers"),
  getById: (id) => apiCall(`/pharmacy/credit-customers/${id}`),
  create: (data) => apiCall("/pharmacy/credit-customers", "POST", data),
  update: (id, data) => apiCall(`/pharmacy/credit-customers/${id}`, "PUT", data),
  pay: (id, amount, notes, invoiceNumber, receiptPayAmounts) => apiCall(`/pharmacy/credit-customers/${id}/pay`, "POST", { amount, notes, invoiceNumber, receiptPayAmounts }),
  getSales: (id) => apiCall(`/pharmacy/credit-customers/${id}/sales`),
  getPaymentHistory: (id) => apiCall(`/pharmacy/credit-customers/${id}/payment-history`),
  delete: (id) => apiCall(`/pharmacy/credit-customers/${id}`, "DELETE"),
};

export const pharmacyReportsAPI = {
  getDailySales: (date) => apiCall(`/pharmacy/reports/daily-sales/${date}`),
  getMonthlySales: (year, month) =>
    apiCall(`/pharmacy/reports/monthly-sales/${year}/${month}`),
  getInventorySummary: () => apiCall("/pharmacy/reports/inventory-summary"),
};

export const holdBillsAPI = {
  getAll: () => apiCall("/hold-bills"),
  getById: (id) => apiCall(`/hold-bills/${id}`),
  create: (data) => apiCall("/hold-bills", "POST", data),
  update: (id, data) => apiCall(`/hold-bills/${id}`, "PUT", data),
  delete: (id) => apiCall(`/hold-bills/${id}`, "DELETE"),
};

export const holdInvoicesAPI = {
  getAll: () => apiCall("/hold-invoices"),
  getById: (id) => apiCall(`/hold-invoices/${id}`),
  create: (data) => apiCall("/hold-invoices", "POST", data),
  update: (id, data) => apiCall(`/hold-invoices/${id}`, "PUT", data),
  delete: (id) => apiCall(`/hold-invoices/${id}`, "DELETE"),
};

// Pharmacy History API
export const pharmacyHistoryAPI = {
  getSalesHistory: (params) => {
    const queryString = new URLSearchParams(params).toString();
    return apiCall(`/pharmacy-history/sales-history?${queryString}`);
  },
  getSaleDetails: (id) => apiCall(`/pharmacy-history/sales-history/${id}`),
  deleteSale: (id) =>
    apiCall(`/pharmacy-history/sales-history/${id}`, "DELETE"),
  updateSale: (id, data) =>
    apiCall(`/pharmacy-history/sales-history/${id}`, "PUT", data),
  getPurchaseHistory: (params) => {
    const queryString = new URLSearchParams(params).toString();
    return apiCall(`/pharmacy-history/purchase-history?${queryString}`);
  },
  getPurchaseDetails: (id) =>
    apiCall(`/pharmacy-history/purchase-history/${id}`),
  deletePurchase: (id) =>
    apiCall(`/pharmacy-history/purchase-history/${id}`, "DELETE"),
  updatePurchase: (id, data) =>
    apiCall(`/pharmacy-history/purchase-history/${id}`, "PUT", data),
  getReturns: (params) => {
    const queryString = new URLSearchParams(params).toString();
    return apiCall(`/pharmacy-history/returns?${queryString}`);
  },
  createCustomerReturn: (data) =>
    apiCall("/pharmacy-history/returns/customer", "POST", data),
  createSupplierReturn: (data) =>
    apiCall("/pharmacy-history/returns/supplier", "POST", data),
  updateReturnStatus: (id, data) =>
    apiCall(`/pharmacy-history/returns/${id}/status`, "PUT", data),
};

// Procedures API (Reception)
export const proceduresAPI = {
  getAll: (params = "") => apiCall(`/procedures${params}`),
  getById: (id) => apiCall(`/procedures/${id}`),
  create: (data) => apiCall("/procedures", "POST", data),
  updatePayment: (id, data) =>
    apiCall(`/procedures/${id}/payment`, "PUT", data),
  update: (id, data) => apiCall(`/procedures/${id}`, "PUT", data),
  delete: (id) => apiCall(`/procedures/${id}`, "DELETE"),
  importOpenings: (records) =>
    apiCall("/procedures/import-openings", "POST", { records }),
};

// Procedure Catalog API
export const procedureCatalogAPI = {
  getAll: () => apiCall("/procedure-catalog"),
  bulkUpsert: (items) => apiCall("/procedure-catalog/bulk", "POST", items),
  create: (data) => apiCall("/procedure-catalog", "POST", data),
  update: (id, data) => apiCall(`/procedure-catalog/${id}`, "PUT", data),
  delete: (id) => apiCall(`/procedure-catalog/${id}`, "DELETE"),
};

// Unified Full Record API (pet/client aggregates)
export const fullRecordAPI = {
  getByPet: (id) => apiCall(`/full-record/pet/${id}`),
  getByClient: (clientId) => apiCall(`/full-record/client/${clientId}`),
};

// Unified Financial Summary API
export const financialSummaryAPI = {
  getByClient: (clientId) => apiCall(`/financial-summary/client/${clientId}`),
};

// Health check
export const healthCheck = () => apiCall("/health");

// Shop Products API
export const productsAPI = {
  getAll: () => apiCall("/products"),
  getById: (id) => apiCall(`/products/${id}`),
  search: (query) => apiCall(`/products/search/${query}`),
  getLowStock: () => apiCall("/products/low-stock"),
  getCategories: () => apiCall("/products/categories"),
  create: (data) => apiCall("/products", "POST", data),
  update: (id, data) => apiCall(`/products/${id}`, "PUT", data),
  delete: (id) => apiCall(`/products/${id}`, "DELETE"),
  updateStock: (id, quantity, operation) =>
    apiCall(`/products/${id}/stock`, "PATCH", { quantity, operation }),
  bulkUpsert: (items) =>
    apiCall("/products/bulk", "POST", Array.isArray(items) ? items : { items }),
  clearAll: () => apiCall("/products/clear", "DELETE"),
};

// Shop Sales API
export const salesAPI = {
  getAll: () => apiCall("/sales"),
  getById: (id) => apiCall(`/sales/${id}`),
  getByDateRange: (startDate, endDate) =>
    apiCall(`/sales/date-range?startDate=${startDate}&endDate=${endDate}`),
  getToday: () => apiCall("/sales/today"),
  getStats: () => apiCall("/sales/stats/summary"),
  recover: (id, payload) => apiCall(`/sales/${id}/recover`, "POST", payload),
  create: (data) => apiCall("/sales", "POST", data),
  delete: (id) => apiCall(`/sales/${id}`, "DELETE"),
};

// Suppliers API
export const suppliersAPI = {
  getAll: (portal = "", status = "") => {
    const q = [];
    if (portal && portal !== "all") q.push(`portal=${encodeURIComponent(portal)}`);
    if (status) q.push(`status=${encodeURIComponent(status)}`);
    const qs = q.length ? `?${q.join("&")}` : "";
    return apiCall(`/suppliers${qs}`);
  },
  getById: (id) => apiCall(`/suppliers/${id}`),
  create: (data) => apiCall("/suppliers", "POST", data),
  bulkUpsert: (items) =>
    apiCall(
      "/suppliers/bulk",
      "POST",
      Array.isArray(items) ? items : { items },
    ),
  update: (id, data) => apiCall(`/suppliers/${id}`, "PUT", data),
  delete: (id) => apiCall(`/suppliers/${id}`, "DELETE"),
  addPurchase: (id, data) => apiCall(`/suppliers/${id}/purchase`, "POST", data),
  updatePurchase: (id, purchaseId, data) =>
    apiCall(`/suppliers/${id}/purchase/${purchaseId}`, "PUT", data),
  deletePurchase: (id, purchaseId) =>
    apiCall(`/suppliers/${id}/purchase/${purchaseId}`, "DELETE"),
  addPayment: (id, data) => apiCall(`/suppliers/${id}/payment`, "POST", data),
  getPharmacyInvoices: (id) => apiCall(`/suppliers/${id}/pharmacy-invoices`),
  getPharmacyItems: (id) => apiCall(`/suppliers/${id}/pharmacy-items`),
};

// Shop Customers API
export const shopCustomersAPI = {
  getAll: () => apiCall("/shop-customers"),
  getById: (id) => apiCall(`/shop-customers/${id}`),
  search: (query) => apiCall(`/shop-customers/search/${query}`),
  create: (data) => apiCall("/shop-customers", "POST", data),
  update: (id, data) => apiCall(`/shop-customers/${id}`, "PUT", data),
  delete: (id) => apiCall(`/shop-customers/${id}`, "DELETE"),
};

// Expenses API
export const expensesAPI = {
  getAll: () => apiCall("/expenses"),
  getById: (id) => apiCall(`/expenses/${id}`),
  getByPortal: (portal) => apiCall(`/expenses/portal/${portal}`),
  getByDateRange: (startDate, endDate) =>
    apiCall(`/expenses/date-range?startDate=${startDate}&endDate=${endDate}`),
  getStats: () => apiCall("/expenses/stats"),
  create: (data) => apiCall("/expenses", "POST", data),
  update: (id, data) => apiCall(`/expenses/${id}`, "PUT", data),
  delete: (id) => apiCall(`/expenses/${id}`, "DELETE"),
};

// Hospital Inventory API
export const hospitalInventoryAPI = {
  getAll: () => apiCall("/inventory"),
  getById: (id) => apiCall(`/inventory/${id}`),
  getByCategory: (category) => apiCall(`/inventory/category/${category}`),
  create: (data) => apiCall("/inventory", "POST", data),
  update: (id, data) => apiCall(`/inventory/${id}`, "PUT", data),
  delete: (id) => apiCall(`/inventory/${id}`, "DELETE"),
};

// Taxonomy (Pet Names and Species) API
export const taxonomyAPI = {
  getAll: () => apiCall("/taxonomy"),
  upsert: (commonName, speciesName) =>
    apiCall("/taxonomy", "POST", { commonName, speciesName }),
  delete: (id) => apiCall(`/taxonomy/${id}`, "DELETE"),
};

// Accounting API
export const accountingAPI = {
  getAccounts: () => apiCall("/accounting/accounts"),
  getChartOfAccounts: (from, to, portal) => {
    const q = [];
    if (from) q.push(`from=${encodeURIComponent(from)}`);
    if (to) q.push(`to=${encodeURIComponent(to)}`);
    if (portal && portal !== "all")
      q.push(`portal=${encodeURIComponent(portal)}`);
    const qs = q.length ? `?${q.join("&")}` : "";
    return apiCall(`/accounting/chart-of-accounts${qs}`);
  },
  getSanityChecks: (from, to, portal) => {
    const q = [];
    if (from) q.push(`from=${encodeURIComponent(from)}`);
    if (to) q.push(`to=${encodeURIComponent(to)}`);
    if (portal && portal !== "all")
      q.push(`portal=${encodeURIComponent(portal)}`);
    const qs = q.length ? `?${q.join("&")}` : "";
    return apiCall(`/accounting/sanity-checks${qs}`);
  },
  getAccountBalance: (accountCode, to, portal) => {
    const q = [];
    if (to) q.push(`to=${encodeURIComponent(to)}`);
    if (portal && portal !== "all")
      q.push(`portal=${encodeURIComponent(portal)}`);
    const qs = q.length ? `?${q.join("&")}` : "";
    return apiCall(
      `/accounting/account-balance/${encodeURIComponent(accountCode)}${qs}`,
    );
  },
  createAccount: (data) => apiCall("/accounting/accounts", "POST", data),
  updateAccount: (code, data) =>
    apiCall(`/accounting/accounts/${encodeURIComponent(code)}`, "PUT", data),
  deleteAccount: (code) =>
    apiCall(`/accounting/accounts/${encodeURIComponent(code)}`, "DELETE"),
  getTrialBalance: (from, to, portal) => {
    const q = [];
    if (from) q.push(`from=${encodeURIComponent(from)}`);
    if (to) q.push(`to=${encodeURIComponent(to)}`);
    if (portal && portal !== "all")
      q.push(`portal=${encodeURIComponent(portal)}`);
    const qs = q.length ? `?${q.join("&")}` : "";
    return apiCall(`/accounting/trial-balance${qs}`);
  },
  getIncomeStatement: (from, to, portal) => {
    const q = [];
    if (from) q.push(`from=${encodeURIComponent(from)}`);
    if (to) q.push(`to=${encodeURIComponent(to)}`);
    if (portal && portal !== "all")
      q.push(`portal=${encodeURIComponent(portal)}`);
    const qs = q.length ? `?${q.join("&")}` : "";
    return apiCall(`/accounting/income-statement${qs}`);
  },
  getGeneralLedger: (accountCode, from, to, portal) => {
    const q = [];
    if (from) q.push(`from=${encodeURIComponent(from)}`);
    if (to) q.push(`to=${encodeURIComponent(to)}`);
    if (portal && portal !== "all")
      q.push(`portal=${encodeURIComponent(portal)}`);
    const qs = q.length ? `?${q.join("&")}` : "";
    return apiCall(
      `/accounting/general-ledger/${encodeURIComponent(accountCode)}${qs}`,
    );
  },
  getJournalEntryDetail: (entryId) =>
    apiCall(`/accounting/journal-entry/${encodeURIComponent(entryId)}`),
  getCustomerLedger: (id, from, to, portal) => {
    const q = [];
    if (from) q.push(`from=${encodeURIComponent(from)}`);
    if (to) q.push(`to=${encodeURIComponent(to)}`);
    if (portal && portal !== "all")
      q.push(`portal=${encodeURIComponent(portal)}`);
    const qs = q.length ? `?${q.join("&")}` : "";
    return apiCall(
      `/accounting/customer-ledger/${encodeURIComponent(id)}${qs}`,
    );
  },
  getSupplierLedger: (id, from, to, portal) => {
    const q = [];
    if (from) q.push(`from=${encodeURIComponent(from)}`);
    if (to) q.push(`to=${encodeURIComponent(to)}`);
    if (portal && portal !== "all")
      q.push(`portal=${encodeURIComponent(portal)}`);
    const qs = q.length ? `?${q.join("&")}` : "";
    return apiCall(
      `/accounting/supplier-ledger/${encodeURIComponent(id)}${qs}`,
    );
  },
  getPatientLedger: (id, from, to, portal) => {
    const q = [];
    if (from) q.push(`from=${encodeURIComponent(from)}`);
    if (to) q.push(`to=${encodeURIComponent(to)}`);
    if (portal && portal !== "all")
      q.push(`portal=${encodeURIComponent(portal)}`);
    const qs = q.length ? `?${q.join("&")}` : "";
    return apiCall(`/accounting/patient-ledger/${encodeURIComponent(id)}${qs}`);
  },
  getBalanceSheet: (from, to, portal) => {
    const q = [];
    if (from) q.push(`from=${encodeURIComponent(from)}`);
    if (to) q.push(`to=${encodeURIComponent(to)}`);
    if (portal && portal !== "all")
      q.push(`portal=${encodeURIComponent(portal)}`);
    const qs = q.length ? `?${q.join("&")}` : "";
    return apiCall(`/accounting/balance-sheet${qs}`);
  },
  getCashFlow: (from, to, portal) => {
    const q = [];
    if (from) q.push(`from=${encodeURIComponent(from)}`);
    if (to) q.push(`to=${encodeURIComponent(to)}`);
    if (portal && portal !== "all")
      q.push(`portal=${encodeURIComponent(portal)}`);
    const qs = q.length ? `?${q.join("&")}` : "";
    return apiCall(`/accounting/cash-flow${qs}`);
  },
  sync: (from, to) => {
    const q = [];
    if (from) q.push(`from=${encodeURIComponent(from)}`);
    if (to) q.push(`to=${encodeURIComponent(to)}`);
    const qs = q.length ? `?${q.join("&")}` : "";
    return apiCall(`/accounting/sync${qs}`, "POST");
  },
};

// Day Session API
export const dayAPI = {
  status: (portal) =>
    apiCall(`/day/status?portal=${encodeURIComponent(portal)}`),
  open: (data) => apiCall("/day/open", "POST", data),
  close: (data) => apiCall("/day/close", "POST", data),
  history: (portal, from, to) => {
    const q = [];
    if (portal && portal !== "all")
      q.push(`portal=${encodeURIComponent(portal)}`);
    if (from) q.push(`from=${encodeURIComponent(from)}`);
    if (to) q.push(`to=${encodeURIComponent(to)}`);
    const qs = q.length ? `?${q.join("&")}` : "";
    return apiCall(`/day/history${qs}`);
  },
  reconciliation: (portal, date) =>
    apiCall(
      `/day/reconciliation?portal=${encodeURIComponent(portal)}&date=${encodeURIComponent(date)}`,
    ),
  logs: (portal, date) =>
    apiCall(
      `/day/logs?portal=${encodeURIComponent(portal)}&date=${encodeURIComponent(date)}`,
    ),
};

// Receivables API
export const receivablesAPI = {
  list: (portal = "all", status = "", from = "", to = "") => {
    const q = [];
    if (portal && portal !== "all")
      q.push(`portal=${encodeURIComponent(portal)}`);
    if (status) q.push(`status=${encodeURIComponent(status)}`);
    if (from) q.push(`from=${encodeURIComponent(from)}`);
    if (to) q.push(`to=${encodeURIComponent(to)}`);
    const qs = q.length ? `?${q.join("&")}` : "";
    return apiCall(`/receivables${qs}`);
  },
  create: (data) => apiCall("/receivables", "POST", data),
  allocate: (id, portal, amount, paymentMethod = "Cash", note = "") =>
    apiCall(`/receivables/${encodeURIComponent(id)}/allocate`, "POST", {
      portal,
      amount,
      paymentMethod,
      note,
    }),
};

// Payables API
export const payablesAPI = {
  list: (portal = "all", status = "", supplierId = "", from = "", to = "") => {
    const q = [];
    if (portal && portal !== "all")
      q.push(`portal=${encodeURIComponent(portal)}`);
    if (status) q.push(`status=${encodeURIComponent(status)}`);
    if (supplierId) q.push(`supplierId=${encodeURIComponent(supplierId)}`);
    if (from) q.push(`from=${encodeURIComponent(from)}`);
    if (to) q.push(`to=${encodeURIComponent(to)}`);
    const qs = q.length ? `?${q.join("&")}` : "";
    return apiCall(`/payables${qs}`);
  },
  create: (data) => apiCall("/payables", "POST", data),
  allocate: (id, portal, amount, paymentMethod = "Cash", note = "") =>
    apiCall(`/payables/${encodeURIComponent(id)}/allocate`, "POST", {
      portal,
      amount,
      paymentMethod,
      note,
    }),
};

// Vendor Payments API
export const vendorPaymentsAPI = {
  list: (portal = "all", from = "", to = "") => {
    const q = [];
    if (portal && portal !== "all")
      q.push(`portal=${encodeURIComponent(portal)}`);
    if (from) q.push(`from=${encodeURIComponent(from)}`);
    if (to) q.push(`to=${encodeURIComponent(to)}`);
    const qs = q.length ? `?${q.join("&")}` : "";
    return apiCall(`/vendor-payments${qs}`);
  },
  create: (data) => apiCall("/vendor-payments", "POST", data),
  backfill: (portal = "all", from = "", to = "") => {
    const q = [];
    if (portal && portal !== "all")
      q.push(`portal=${encodeURIComponent(portal)}`);
    if (from) q.push(`from=${encodeURIComponent(from)}`);
    if (to) q.push(`to=${encodeURIComponent(to)}`);
    const qs = q.length ? `?${q.join("&")}` : "";
    return apiCall(`/vendor-payments/backfill${qs}`, "POST");
  },
};

// Staff Advances API
export const staffAdvancesAPI = {
  list: (portal = "all", status = "", staffId = "", from = "", to = "") => {
    const q = [];
    if (portal && portal !== "all")
      q.push(`portal=${encodeURIComponent(portal)}`);
    if (status) q.push(`status=${encodeURIComponent(status)}`);
    if (staffId) q.push(`staffId=${encodeURIComponent(staffId)}`);
    if (from) q.push(`from=${encodeURIComponent(from)}`);
    if (to) q.push(`to=${encodeURIComponent(to)}`);
    const qs = q.length ? `?${q.join("&")}` : "";
    return apiCall(`/staff-advances${qs}`);
  },
  create: (data) => apiCall("/staff-advances", "POST", data),
  adjust: (id, portal, payload) =>
    apiCall(`/staff-advances/${encodeURIComponent(id)}/adjust`, "POST", {
      portal,
      ...payload,
    }),
};

// Vouchers API
export const vouchersAPI = {
  list: ({
    type = "all",
    status = "all",
    portal = "all",
    from = "",
    to = "",
    q = "",
    limit = 0,
    skip = 0,
    accountCode = "",
  } = {}) => {
    const params = [];
    if (type && type !== "all") params.push(`type=${encodeURIComponent(type)}`);
    if (status && status !== "all")
      params.push(`status=${encodeURIComponent(status)}`);
    if (portal && portal !== "all")
      params.push(`portal=${encodeURIComponent(portal)}`);
    if (from) params.push(`from=${encodeURIComponent(from)}`);
    if (to) params.push(`to=${encodeURIComponent(to)}`);
    if (q) params.push(`q=${encodeURIComponent(q)}`);
    if (Number(limit) > 0)
      params.push(`limit=${encodeURIComponent(String(limit))}`);
    if (Number(skip) > 0)
      params.push(`skip=${encodeURIComponent(String(skip))}`);
    if (accountCode)
      params.push(`accountCode=${encodeURIComponent(String(accountCode))}`);
    const qs = params.length ? `?${params.join("&")}` : "";
    return apiCall(`/vouchers${qs}`);
  },
  getById: (id) => apiCall(`/vouchers/${encodeURIComponent(id)}`),
  create: (data) => apiCall("/vouchers", "POST", data),
  update: (id, data) =>
    apiCall(`/vouchers/${encodeURIComponent(id)}`, "PUT", data),
  post: (id) => apiCall(`/vouchers/${encodeURIComponent(id)}/post`, "POST"),
  delete: (id) => apiCall(`/vouchers/${encodeURIComponent(id)}`, "DELETE"),
};

// Purchase Orders API
export const purchaseOrdersAPI = {
  getAll: () => apiCall("/purchase-orders"),
  getById: (id) => apiCall(`/purchase-orders/${id}`),
  create: (data) => apiCall("/purchase-orders", "POST", data),
  update: (id, data) => apiCall(`/purchase-orders/${id}`, "PUT", data),
  delete: (id) => apiCall(`/purchase-orders/${id}`, "DELETE"),
};

// Budget Planner API
export const budgetsAPI = {
  get: ({ fiscalYear, branch = "all", project = "all" } = {}) => {
    const q = [];
    if (fiscalYear)
      q.push(`fiscalYear=${encodeURIComponent(String(fiscalYear))}`);
    if (branch) q.push(`branch=${encodeURIComponent(String(branch))}`);
    if (project) q.push(`project=${encodeURIComponent(String(project))}`);
    const qs = q.length ? `?${q.join("&")}` : "";
    return apiCall(`/budgets${qs}`);
  },
  upsert: (data) => apiCall("/budgets", "POST", data),
};

// Medical Forms API
export const medicalFormsAPI = {
  getAll: () => apiCall("/medical-forms"),
  getById: (id) => apiCall(`/medical-forms/${id}`),
  getByPatient: (patientId) => apiCall(`/medical-forms/patient/${patientId}`),
  create: (formData) => apiCall("/medical-forms", "POST", formData),
  update: (id, formData) => apiCall(`/medical-forms/${id}`, "PUT", formData),
  delete: (id) => apiCall(`/medical-forms/${id}`, "DELETE"),
};

// Pharmacy Invoices API
export const pharmacyInvoicesAPI = {
  getAll: (params = {}) => {
    const q = Object.entries(params)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    return apiCall(`/pharmacy-invoices${q ? `?${q}` : ""}`);
  },
  getById: (id) => apiCall(`/pharmacy-invoices/${id}`),
  create: (data) => apiCall("/pharmacy-invoices", "POST", data),
  update: (id, data) => apiCall(`/pharmacy-invoices/${id}`, "PUT", data),
  delete: (id) => apiCall(`/pharmacy-invoices/${id}`, "DELETE"),
};

// Petshop Pharmacy Invoices API
export const petshopPharmacyInvoicesAPI = {
  getAll: (params = {}) => {
    const q = Object.entries(params)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    return apiCall(`/petshop-invoices${q ? `?${q}` : ""}`);
  },
  getById: (id) => apiCall(`/petshop-invoices/${id}`),
  create: (data) => apiCall("/petshop-invoices", "POST", data),
  update: (id, data) => apiCall(`/petshop-invoices/${id}`, "PUT", data),
  delete: (id) => apiCall(`/petshop-invoices/${id}`, "DELETE"),
};

// Pharmacy Purchase Drafts API
export const pharmacyPurchaseDraftsAPI = {
  getAll: (params = {}) => {
    const q = Object.entries(params)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    return apiCall(`/pharmacy-purchase-drafts${q ? `?${q}` : ""}`);
  },
  getById: (id) => apiCall(`/pharmacy-purchase-drafts/${id}`),
  create: (data) => apiCall("/pharmacy-purchase-drafts", "POST", data),
  update: (id, data) => apiCall(`/pharmacy-purchase-drafts/${id}`, "PUT", data),
  // Whole-invoice actions
  approve: (id, reviewData) => apiCall(`/pharmacy-purchase-drafts/${id}/approve`, "POST", reviewData),
  reject:  (id, reviewData) => apiCall(`/pharmacy-purchase-drafts/${id}/reject`,  "POST", reviewData),
  // Per-item actions
  approveItem: (draftId, itemId, reviewData) =>
    apiCall(`/pharmacy-purchase-drafts/${draftId}/items/${itemId}/approve`, "POST", reviewData),
  rejectItem: (draftId, itemId, reviewData) =>
    apiCall(`/pharmacy-purchase-drafts/${draftId}/items/${itemId}/reject`,  "POST", reviewData),
  delete: (id) => apiCall(`/pharmacy-purchase-drafts/${id}`, "DELETE"),
  getStats: (portal = "pharmacy") =>
    apiCall(`/pharmacy-purchase-drafts/stats/summary?portal=${encodeURIComponent(portal)}`),
};

// Petshop Pharmacy Purchase Drafts API
export const petshopPharmacyPurchaseDraftsAPI = {
  getAll: (params = {}) => {
    const q = Object.entries(params)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    return apiCall(`/petshop-purchase-drafts${q ? `?${q}` : ""}`);
  },
  getById: (id) => apiCall(`/petshop-purchase-drafts/${id}`),
  create: (data) => apiCall("/petshop-purchase-drafts", "POST", data),
  update: (id, data) => apiCall(`/petshop-purchase-drafts/${id}`, "PUT", data),
  approve: (id, reviewData) => apiCall(`/petshop-purchase-drafts/${id}/approve`, "POST", reviewData),
  reject:  (id, reviewData) => apiCall(`/petshop-purchase-drafts/${id}/reject`,  "POST", reviewData),
  approveItem: (draftId, itemId, reviewData) =>
    apiCall(`/petshop-purchase-drafts/${draftId}/items/${itemId}/approve`, "POST", reviewData),
  rejectItem: (draftId, itemId, reviewData) =>
    apiCall(`/petshop-purchase-drafts/${draftId}/items/${itemId}/reject`,  "POST", reviewData),
  delete: (id) => apiCall(`/petshop-purchase-drafts/${id}`, "DELETE"),
  getStats: () => apiCall("/petshop-purchase-drafts/stats/summary"),
};

// Companies API (Pharmacy)
export const companiesAPI = {
  getAll: (portal = "pharmacy", status = "") => {
    const q = [];
    if (portal && portal !== "all") q.push(`portal=${encodeURIComponent(portal)}`);
    if (status && status !== "all") q.push(`status=${encodeURIComponent(status)}`);
    const qs = q.length ? `?${q.join("&")}` : "";
    return apiCall(`/companies${qs}`);
  },
  getById: (id) => apiCall(`/companies/${id}`),
  search: (query, portal = "pharmacy") =>
    apiCall(`/companies/search/${encodeURIComponent(query)}?portal=${portal}`),
  create: (data) => apiCall("/companies", "POST", data),
  update: (id, data) => apiCall(`/companies/${id}`, "PUT", data),
  delete: (id) => apiCall(`/companies/${id}`, "DELETE"),
};

// Vaccines API
export const vaccinesAPI = {
  getAll: () => apiCall("/vaccines"),
  getById: (id) => apiCall(`/vaccines/${id}`),
  create: (data) => apiCall("/vaccines", "POST", data),
  update: (id, data) => apiCall(`/vaccines/${id}`, "PUT", data),
  delete: (id) => apiCall(`/vaccines/${id}`, "DELETE"),
};

// Procedure Patients API
export const procedurePatientsAPI = {
  getAll: (params = {}) => {
    const q = Object.entries(params)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    return apiCall(`/procedure-patients${q ? `?${q}` : ""}`);
  },
  getById: (petId) => apiCall(`/procedure-patients/${petId}`),
};

// Procedure Plans API
export const procedurePlansAPI = {
  getPatient: (petId) => apiCall(`/procedure-plans/patient/${petId}`),
  createPatient: (petId, data) =>
    apiCall(`/procedure-plans/patient/${petId}`, "POST", data),
  addSession: (planId, data) =>
    apiCall(`/procedure-plans/${planId}/sessions`, "POST", data),
  updateSession: (sessionId, data) =>
    apiCall(`/procedure-plans/sessions/${sessionId}`, "PUT", data),
  paySession: (sessionId, data) =>
    apiCall(`/procedure-plans/sessions/${sessionId}/pay`, "PUT", data),
  completeSession: (sessionId) =>
    apiCall(`/procedure-plans/sessions/${sessionId}/complete`, "PUT"),
  completePlan: (planId) =>
    apiCall(`/procedure-plans/${planId}/complete`, "PUT"),
  uploadPhoto: (sessionId, data) =>
    apiCall(`/procedure-plans/sessions/${sessionId}/photos`, "PUT", data),
  deletePhoto: (sessionId, type) =>
    apiCall(`/procedure-plans/sessions/${sessionId}/photos/${type}`, "DELETE"),
};

// Shot Reminders API
export const shotRemindersAPI = {
  getAll: (params = {}) => {
    const q = Object.entries(params)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    return apiCall(`/shot-reminders${q ? `?${q}` : ""}`);
  },
  sync: () => apiCall("/shot-reminders/sync", "POST"),
  updateStatus: (id, status) =>
    apiCall(`/shot-reminders/${id}/status`, "PUT", { status }),
  getUpcoming: () => apiCall("/shot-reminders/upcoming"),
};

// Pet Shop Companies API
export const petShopCompaniesAPI = {
  getAll: (portal = "shop", status = "") => {
    const q = [];
    if (status && status !== "all") q.push(`status=${encodeURIComponent(status)}`);
    const qs = q.length ? `?${q.join("&")}` : "";
    return apiCall(`/petshop-companies${qs}`);
  },
  getById: (id) => apiCall(`/petshop-companies/${id}`),
  search: (query, portal = "shop") =>
    apiCall(`/petshop-companies/search/${encodeURIComponent(query)}?portal=${portal}`),
  create: (data) => apiCall("/petshop-companies", "POST", data),
  update: (id, data) => apiCall(`/petshop-companies/${id}`, "PUT", data),
  delete: (id) => apiCall(`/petshop-companies/${id}`, "DELETE"),
};

// Pet Shop Suppliers API
export const petShopSuppliersAPI = {
  getAll: (portal = "", status = "") => {
    const q = [];
    if (status && status !== "all") q.push(`status=${encodeURIComponent(status)}`);
    const qs = q.length ? `?${q.join("&")}` : "";
    return apiCall(`/petshop-suppliers${qs}`);
  },
  getById: (id) => apiCall(`/petshop-suppliers/${id}`),
  create: (data) => apiCall("/petshop-suppliers", "POST", data),
  bulkUpsert: (items) =>
    apiCall(
      "/petshop-suppliers/bulk",
      "POST",
      Array.isArray(items) ? items : { items },
    ),
  update: (id, data) => apiCall(`/petshop-suppliers/${id}`, "PUT", data),
  delete: (id) => apiCall(`/petshop-suppliers/${id}`, "DELETE"),
  addPurchase: (id, data) => apiCall(`/petshop-suppliers/${id}/purchase`, "POST", data),
  updatePurchase: (id, purchaseId, data) =>
    apiCall(`/petshop-suppliers/${id}/purchase/${purchaseId}`, "PUT", data),
  deletePurchase: (id, purchaseId) =>
    apiCall(`/petshop-suppliers/${id}/purchase/${purchaseId}`, "DELETE"),
  addPayment: (id, data) => apiCall(`/petshop-suppliers/${id}/payment`, "POST", data),
  getPharmacyInvoices: (id) => apiCall(`/petshop-suppliers/${id}/pharmacy-invoices`),
  getPharmacyItems: (id) => apiCall(`/petshop-suppliers/${id}/pharmacy-items`),
  getPurchaseItems: (id) => apiCall(`/petshop-suppliers/${id}/purchase-items`),
  getInvoices: (id) => apiCall(`/petshop-suppliers/${id}/invoices`),
  getItems: (id) => apiCall(`/petshop-suppliers/${id}/items`),
};

// Petshop Pharmacy Settings API
export const petshopPharmacySettingsAPI = {
  get: () => apiCall("/petshop-settings"),
  save: (data) => apiCall("/petshop-settings", "POST", data),
  update: (data) => apiCall("/petshop-settings", "PUT", data),
};

// Petshop Notifications API
export const petshopNotificationsAPI = {
  getAll: () => apiCall("/petshop-notifications"),
  markAsRead: (id) => apiCall(`/petshop-notifications/${id}/read`, "PUT"),
  delete: (id) => apiCall(`/petshop-notifications/${id}`, "DELETE"),
};

// Petshop Pharmacy Medicines API
export const petshopPharmacyMedicinesAPI = {
  getAll: (params = {}) => {
    const q = Object.entries(params)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    return apiCall(`/petshop/medicines${q ? `?${q}` : ""}`);
  },
  getById: (id) => apiCall(`/petshop/medicines/${id}`),
  create: (data) => apiCall("/petshop/medicines", "POST", data),
  update: (id, data) => apiCall(`/petshop/medicines/${id}`, "PUT", data),
  delete: (id) => apiCall(`/petshop/medicines/${id}`, "DELETE"),
  getLowStock: () => apiCall("/petshop/medicines/alerts/low-stock"),
  getExpiring: () => apiCall("/petshop/medicines/alerts/expiring"),
  getExpired: () => apiCall("/petshop/medicines/alerts/expired"),
  search: (query) => apiCall(`/petshop/medicines/search/${encodeURIComponent(query)}`),
  findByBarcode: (barcode) => silentApiCall(`/petshop/medicines/find-by-barcode/${encodeURIComponent(barcode)}`),
};

// Petshop Pharmacy Sales API
export const petshopPharmacySalesAPI = {
  getAll: () => apiCall("/petshop/sales"),
  getById: (id) => apiCall(`/petshop/sales/${id}`),
  create: (data) => apiCall("/petshop/sales", "POST", data),
  update: (id, data) => apiCall(`/petshop/sales/${id}`, "PUT", data),
  delete: (id) => apiCall(`/petshop/sales/${id}`, "DELETE"),
  getByDateRange: (startDate, endDate) => apiCall(`/petshop/sales/date-range/${startDate}/${endDate}`),
};

// Petshop Pharmacy Dues API
export const petshopPharmacyDuesAPI = {
  getAll: () => apiCall("/petshop/dues"),
  getByClientId: (clientId) => apiCall(`/petshop/dues/${clientId}`),
  update: (clientId, data) => apiCall(`/petshop/dues/${clientId}`, "PUT", data),
};

// Petshop Pharmacy Credit Customers API
export const petshopPharmacyCreditCustomersAPI = {
  getAll: () => apiCall("/petshop/credit-customers"),
  getById: (id) => apiCall(`/petshop/credit-customers/${id}`),
  create: (data) => apiCall("/petshop/credit-customers", "POST", data),
  update: (id, data) => apiCall(`/petshop/credit-customers/${id}`, "PUT", data),
  delete: (id) => apiCall(`/petshop/credit-customers/${id}`, "DELETE"),
  getSales: (id) => apiCall(`/petshop/credit-customers/${id}/sales`),
  pay: (id, data) => apiCall(`/petshop/credit-customers/${id}/pay`, "POST", data),
  getPaymentHistory: (id) => apiCall(`/petshop/credit-customers/${id}/payment-history`),
};

// Petshop Pharmacy History API
export const petshopPharmacyHistoryAPI = {
  getSalesHistory: (params = {}) => {
    const q = Object.entries(params)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    return apiCall(`/petshop-history/sales-history${q ? `?${q}` : ""}`);
  },
  getSalesHistoryById: (id) => apiCall(`/petshop-history/sales-history/${id}`),
  updateSalesHistory: (id, data) => apiCall(`/petshop-history/sales-history/${id}`, "PUT", data),
  deleteSalesHistory: (id) => apiCall(`/petshop-history/sales-history/${id}`, "DELETE"),
  getPurchaseHistory: (params = {}) => {
    const q = Object.entries(params)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    return apiCall(`/petshop-history/purchase-history${q ? `?${q}` : ""}`);
  },
  getPurchaseHistoryById: (id) => apiCall(`/petshop-history/purchase-history/${id}`),
  updatePurchaseHistory: (id, data) => apiCall(`/petshop-history/purchase-history/${id}`, "PUT", data),
  deletePurchaseHistory: (id) => apiCall(`/petshop-history/purchase-history/${id}`, "DELETE"),
  getReturns: (params = {}) => {
    const q = Object.entries(params)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    return apiCall(`/petshop-history/returns${q ? `?${q}` : ""}`);
  },
  getReturnHistory: (params = {}) => {
    const q = Object.entries(params)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    return apiCall(`/petshop-history/return-history${q ? `?${q}` : ""}`);
  },
  getInventorySummary: () => apiCall("/petshop-history/inventory-summary"),
  createCustomerReturn: (data) => apiCall("/petshop-history/returns/customer", "POST", data),
  createSupplierReturn: (data) => apiCall("/petshop-history/returns/supplier", "POST", data),
  updateReturnStatus: (id, data) => apiCall(`/petshop-history/returns/${id}/status`, "PUT", data),
};

// Petshop Pharmacy Reports API
export const petshopPharmacyReportsAPI = {
  getSales: () => apiCall("/petshop-reports/sales"),
  getInventory: () => apiCall("/petshop-reports/inventory"),
};

// Petshop Hold Bills API
export const petShopHoldBillsAPI = {
  getAll: () => apiCall("/petshop-hold-bills"),
  getById: (id) => apiCall(`/petshop-hold-bills/${id}`),
  create: (data) => apiCall("/petshop-hold-bills", "POST", data),
  update: (id, data) => apiCall(`/petshop-hold-bills/${id}`, "PUT", data),
  delete: (id) => apiCall(`/petshop-hold-bills/${id}`, "DELETE"),
};

export default {
  users: usersAPI,
  pets: petsAPI,
  appointments: appointmentsAPI,
  prescriptions: prescriptionsAPI,
  medicines: medicinesAPI,
  labReports: labReportsAPI,
  radiologyReports: radiologyReportsAPI,
  labTests: labTestsAPI,
  inventory: inventoryAPI,
  financials: financialsAPI,
  settings: settingsAPI,
  pharmacySettings: pharmacySettingsAPI,
  activityLogs: activityLogsAPI,
  doctorProfile: doctorProfileAPI,
  products: productsAPI,
  sales: salesAPI,
  suppliers: suppliersAPI,
  shopCustomers: shopCustomersAPI,
  expenses: expensesAPI,
  hospitalInventory: hospitalInventoryAPI,
  taxonomy: taxonomyAPI,
  accounting: accountingAPI,
  day: dayAPI,
  receivables: receivablesAPI,
  payables: payablesAPI,
  vendorPayments: vendorPaymentsAPI,
  staffAdvances: staffAdvancesAPI,
  vouchers: vouchersAPI,
  budgets: budgetsAPI,
  medicalForms: medicalFormsAPI,
  companies: companiesAPI,
  pharmacyInvoices: pharmacyInvoicesAPI,
  pharmacyPurchaseDrafts: pharmacyPurchaseDraftsAPI,
  petshopPharmacyInvoices: petshopPharmacyInvoicesAPI,
  petshopPharmacyPurchaseDrafts: petshopPharmacyPurchaseDraftsAPI,
  procedureCatalog: procedureCatalogAPI,
  vaccines: vaccinesAPI,
  procedurePatients: procedurePatientsAPI,
  procedurePlans: procedurePlansAPI,
  shotReminders: shotRemindersAPI,
  petShopCompanies: petShopCompaniesAPI,
  petShopSuppliers: petShopSuppliersAPI,
  petshopPharmacyHistory: petshopPharmacyHistoryAPI,
  petshopPharmacySettings: petshopPharmacySettingsAPI,
  petshopNotifications: petshopNotificationsAPI,
  petshopPharmacyCreditCustomers: petshopPharmacyCreditCustomersAPI,
  petshopPharmacyMedicines: petshopPharmacyMedicinesAPI,
  petshopPharmacySales: petshopPharmacySalesAPI,
  petshopPharmacyDues: petshopPharmacyDuesAPI,
  petshopPharmacyReports: petshopPharmacyReportsAPI,
  sidebarConfig: sidebarConfigAPI,
  holdBills: holdBillsAPI,
  holdInvoices: holdInvoicesAPI,
  petshopHoldBills: petShopHoldBillsAPI,
  pharmacyHistory: pharmacyHistoryAPI,
  pharmacyMedicines: pharmacyMedicinesAPI,
  pharmacySales: pharmacySalesAPI,
  pharmacyReports: pharmacyReportsAPI,
  pharmacyDues: pharmacyDuesAPI,
  pharmacyCreditCustomers: pharmacyCreditCustomersAPI,
  fullRecord: fullRecordAPI,
  financialSummary: financialSummaryAPI,
  backup: backupAPI,
  healthCheck,
};
