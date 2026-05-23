# Pet Shop Connectivity Analysis & Fix Plan

## Executive Summary

The pet shop section has **critical connectivity issues** where the sidebar navigation shows 15+ routes but only 2 are registered in the router. Additionally, most pharmacy pages are hardcoded to use pharmacy APIs instead of accepting props for petshop APIs.

---

## Issues Found

### 1. **Missing Routes in `main.jsx`**

**ShopPharmacyLayout Sidebar** has these routes:
- `/shop/pharmacy` ✅ (registered)
- `/shop/pharmacy/medicines` ✅ (registered)
- `/shop/pharmacy/pos` ❌ (NOT registered)
- `/shop/pharmacy/credit-customers` ❌ (NOT registered)
- `/shop/pharmacy/suppliers` ❌ (NOT registered)
- `/shop/pharmacy/companies` ❌ (NOT registered)
- `/shop/pharmacy/purchase-orders` ❌ (NOT registered)
- `/shop/pharmacy/sales-history` ❌ (NOT registered)
- `/shop/pharmacy/purchase-history` ❌ (NOT registered)
- `/shop/pharmacy/return-history` ❌ (NOT registered)
- `/shop/pharmacy/sales-return` ❌ (NOT registered)
- `/shop/pharmacy/supplier-returns` ❌ (NOT registered)
- `/shop/pharmacy/referrals` ❌ (NOT registered)
- `/shop/pharmacy/prescriptions` ❌ (NOT registered)
- `/shop/pharmacy/add-invoice` ❌ (NOT registered)
- `/shop/pharmacy/reports` ❌ (NOT registered)
- `/shop/pharmacy/notifications` ❌ (NOT registered)
- `/shop/pharmacy/audit-logs` ❌ (NOT registered)
- `/shop/pharmacy/expenses` ❌ (NOT registered)
- `/shop/pharmacy/settings` ❌ (NOT registered)

### 2. **Hardcoded API Usage**

Most pharmacy pages use hardcoded pharmacy APIs:
- `SalesHistory.jsx` → uses `pharmacyHistoryAPI` (should accept `apis` prop)
- `PurchaseHistory.jsx` → uses `pharmacyHistoryAPI` (should accept `apis` prop)
- `SalesReturn.jsx` → uses `pharmacyHistoryAPI`, `pharmacyMedicinesAPI` (should accept `apis` prop)
- `SupplierReturns.jsx` → uses `pharmacyHistoryAPI` (should accept `apis` prop)
- `ReturnHistory.jsx` → uses `pharmacyHistoryAPI` (should accept `apis` prop)
- `CreditCustomers.jsx` → uses `pharmacyCreditCustomersAPI` (should accept `apis` prop)
- `Suppliers.jsx` → uses `suppliersAPI`, `companiesAPI` (should accept `apis` prop)
- `Companies.jsx` → uses `companiesAPI` (should accept `apis` prop)
- `AddInvoice.jsx` → uses `pharmacyMedicinesAPI`, `suppliersAPI`, `companiesAPI`, `pharmacyPurchaseDraftsAPI` (should accept `apis` prop)
- `Reports.jsx` → uses `pharmacySalesAPI`, `pharmacyReportsAPI`, `pharmacyMedicinesAPI` (should accept `apis` prop)
- `Notifications.jsx` → uses `pharmacyMedicinesAPI`, `prescriptionsAPI` (should accept `apis` prop)
- `AuditLogs.jsx` → uses `activityLogsAPI` (should accept `apis` prop)
- `Expenses.jsx` → uses `expensesAPI` (should accept `apis` prop)
- `PurchaseOrders.jsx` → uses `purchaseOrdersAPI`, `suppliersAPI`, `pharmacyMedicinesAPI`, `companiesAPI` (should accept `apis` prop)
- `Referrals.jsx` → uses `pharmacySalesAPI`, `pharmacyMedicinesAPI` (should accept `apis` prop)
- `Prescriptions.jsx` → uses `prescriptionsAPI`, `petsAPI` (should accept `apis` prop)

### 3. **Existing Working Pages**

These pages already work correctly:
- `src/pages/shop/pharmacy/Dashboard.jsx` ✅ (uses adapter pattern)
- `src/pages/shop/pharmacy/Medicines.jsx` ✅ (uses adapter pattern)
- `src/pages/shop/pharmacy/POS.jsx` ✅ (uses adapter pattern)

---

## Solution Strategy

### Option 1: Create Wrapper Pages (RECOMMENDED)

Create wrapper pages in `src/pages/shop/pharmacy/` that import the base pharmacy pages and pass petshop APIs as props.

**Advantages:**
- No changes to existing pharmacy pages
- Clean separation of concerns
- Easy to maintain

**Example:**
```jsx
// src/pages/shop/pharmacy/SalesHistory.jsx
import React from "react";
import PharmacySalesHistory from "../../pharmacy/SalesHistory";
import { petshopPharmacyHistoryAPI } from "../../../services/api";

export default function ShopPharmacySalesHistory() {
  return (
    <PharmacySalesHistory
      historyAPI={petshopPharmacyHistoryAPI}
      portal="shop"
    />
  );
}
```

### Option 2: Modify Base Pages to Accept Props

Modify all pharmacy pages to accept `apis` props with defaults.

**Advantages:**
- Single source of truth
- Less code duplication

**Disadvantages:**
- Requires modifying 15+ existing pharmacy pages
- Risk of breaking existing pharmacy functionality

---

## Implementation Plan

### Phase 1: Create Missing Wrapper Pages ✅ STARTED

Created wrapper pages:
1. ✅ `src/pages/shop/pharmacy/SalesHistory.jsx`
2. ✅ `src/pages/shop/pharmacy/PurchaseHistory.jsx`
3. ✅ `src/pages/shop/pharmacy/SalesReturn.jsx`
4. ✅ `src/pages/shop/pharmacy/SupplierReturns.jsx`

Still need to create:
5. `src/pages/shop/pharmacy/ReturnHistory.jsx`
6. `src/pages/shop/pharmacy/CreditCustomers.jsx`
7. `src/pages/shop/pharmacy/Suppliers.jsx`
8. `src/pages/shop/pharmacy/Companies.jsx`
9. `src/pages/shop/pharmacy/AddInvoice.jsx`
10. `src/pages/shop/pharmacy/Reports.jsx`
11. `src/pages/shop/pharmacy/Notifications.jsx`
12. `src/pages/shop/pharmacy/AuditLogs.jsx`
13. `src/pages/shop/pharmacy/Expenses.jsx`
14. `src/pages/shop/pharmacy/PurchaseOrders.jsx`
15. `src/pages/shop/pharmacy/Referrals.jsx`
16. `src/pages/shop/pharmacy/Prescriptions.jsx`
17. `src/pages/shop/pharmacy/Settings.jsx`

### Phase 2: Register Routes in `main.jsx`

Add all missing routes to the `shop/pharmacy` section:

```jsx
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
    { path: "purchase-orders", element: <ShopPharmacyPurchaseOrders /> },
    { path: "sales-history", element: <ShopPharmacySalesHistory /> },
    { path: "purchase-history", element: <ShopPharmacyPurchaseHistory /> },
    { path: "return-history", element: <ShopPharmacyReturnHistory /> },
    { path: "sales-return", element: <ShopPharmacySalesReturn /> },
    { path: "supplier-returns", element: <ShopPharmacySupplierReturns /> },
    { path: "referrals", element: <ShopPharmacyReferrals /> },
    { path: "prescriptions", element: <ShopPharmacyPrescriptions /> },
    { path: "add-invoice", element: <ShopPharmacyAddInvoice /> },
    { path: "reports", element: <ShopPharmacyReports /> },
    { path: "notifications", element: <ShopPharmacyNotifications /> },
    { path: "audit-logs", element: <ShopPharmacyAuditLogs /> },
    { path: "expenses", element: <ShopPharmacyExpenses /> },
    { path: "settings", element: <ShopPharmacySettings /> },
  ],
},
```

### Phase 3: Test All Routes

Test each route to ensure:
1. Page loads without errors
2. Data is fetched from petshop APIs
3. CRUD operations work correctly
4. Navigation between pages works

---

## API Mapping

### Petshop Pharmacy APIs Available

```javascript
// Medicines
petshopPharmacyMedicinesAPI.getAll()
petshopPharmacyMedicinesAPI.search(query)
petshopPharmacyMedicinesAPI.findByBarcode(barcode)
petshopPharmacyMedicinesAPI.getLowStock()
petshopPharmacyMedicinesAPI.getExpiring()
petshopPharmacyMedicinesAPI.getExpired()
petshopPharmacyMedicinesAPI.create(data)
petshopPharmacyMedicinesAPI.update(id, data)
petshopPharmacyMedicinesAPI.delete(id)

// Sales
petshopPharmacySalesAPI.getAll()
petshopPharmacySalesAPI.getById(id)
petshopPharmacySalesAPI.getByDateRange(startDate, endDate)
petshopPharmacySalesAPI.create(data)
petshopPharmacySalesAPI.updatePayment(id, payload)
petshopPharmacySalesAPI.update(id, data)
petshopPharmacySalesAPI.recover(id, payload)
petshopPharmacySalesAPI.delete(id)

// Purchases
petshopPharmacyPurchasesAPI.getAll()
petshopPharmacyPurchasesAPI.getById(id)
petshopPharmacyPurchasesAPI.create(data)
petshopPharmacyPurchasesAPI.update(id, data)
petshopPharmacyPurchasesAPI.delete(id)

// Dues
petshopPharmacyDuesAPI.getAll()
petshopPharmacyDuesAPI.getByClient(clientId)
petshopPharmacyDuesAPI.upsert(clientId, data)

// Credit Customers
petshopPharmacyCreditCustomersAPI.getAll()
petshopPharmacyCreditCustomersAPI.getById(id)
petshopPharmacyCreditCustomersAPI.create(data)
petshopPharmacyCreditCustomersAPI.update(id, data)
petshopPharmacyCreditCustomersAPI.pay(id, amount, notes, invoiceNumber, receiptPayAmounts)
petshopPharmacyCreditCustomersAPI.getSales(id)
petshopPharmacyCreditCustomersAPI.getPaymentHistory(id)
petshopPharmacyCreditCustomersAPI.delete(id)

// Reports
petshopPharmacyReportsAPI.getDailySales(date)
petshopPharmacyReportsAPI.getMonthlySales(year, month)
petshopPharmacyReportsAPI.getInventorySummary()

// History
petshopPharmacyHistoryAPI.getSalesHistory(params)
petshopPharmacyHistoryAPI.getSaleDetails(id)
petshopPharmacyHistoryAPI.deleteSale(id)
petshopPharmacyHistoryAPI.updateSale(id, data)
petshopPharmacyHistoryAPI.getPurchaseHistory(params)
petshopPharmacyHistoryAPI.getPurchaseDetails(id)
petshopPharmacyHistoryAPI.deletePurchase(id)
petshopPharmacyHistoryAPI.updatePurchase(id, data)
petshopPharmacyHistoryAPI.getReturns(params)
petshopPharmacyHistoryAPI.createCustomerReturn(data)
petshopPharmacyHistoryAPI.createSupplierReturn(data)
petshopPharmacyHistoryAPI.updateReturnStatus(id, data)

// Invoices
petshopPharmacyInvoicesAPI.getAll(params)
petshopPharmacyInvoicesAPI.getById(id)
petshopPharmacyInvoicesAPI.create(data)
petshopPharmacyInvoicesAPI.update(id, data)
petshopPharmacyInvoicesAPI.delete(id)

// Purchase Drafts
petshopPharmacyPurchaseDraftsAPI.getAll(params)
petshopPharmacyPurchaseDraftsAPI.getById(id)
petshopPharmacyPurchaseDraftsAPI.create(data)
petshopPharmacyPurchaseDraftsAPI.update(id, data)
petshopPharmacyPurchaseDraftsAPI.approve(id, reviewData)
petshopPharmacyPurchaseDraftsAPI.reject(id, reviewData)
petshopPharmacyPurchaseDraftsAPI.approveItem(draftId, itemId, reviewData)
petshopPharmacyPurchaseDraftsAPI.rejectItem(draftId, itemId, reviewData)
petshopPharmacyPurchaseDraftsAPI.delete(id)
petshopPharmacyPurchaseDraftsAPI.getStats(portal)

// Settings
petshopPharmacySettingsAPI.get()
petshopPharmacySettingsAPI.getDefaults()
petshopPharmacySettingsAPI.save(data)
petshopPharmacySettingsAPI.update(data)

// Notifications
petshopNotificationsAPI.getAll(params)
petshopNotificationsAPI.create(data)
petshopNotificationsAPI.markRead(id)
petshopNotificationsAPI.markAllRead(portal)
petshopNotificationsAPI.delete(id)
petshopNotificationsAPI.clearAll(portal)

// Suppliers (Petshop-specific)
petShopSuppliersAPI.getAll(status)
petShopSuppliersAPI.getById(id)
petShopSuppliersAPI.create(data)
petShopSuppliersAPI.bulkUpsert(items)
petShopSuppliersAPI.update(id, data)
petShopSuppliersAPI.delete(id)
petShopSuppliersAPI.addPurchase(id, data)
petShopSuppliersAPI.updatePurchase(id, purchaseId, data)
petShopSuppliersAPI.deletePurchase(id, purchaseId)
petShopSuppliersAPI.addPayment(id, data)
petShopSuppliersAPI.getInvoices(id)
petShopSuppliersAPI.getItems(id)

// Companies (Petshop-specific)
petShopCompaniesAPI.getAll(status, businessType, specialization)
petShopCompaniesAPI.getById(id)
petShopCompaniesAPI.search(query, status, businessType)
petShopCompaniesAPI.create(data)
petShopCompaniesAPI.update(id, data)
petShopCompaniesAPI.delete(id)
petShopCompaniesAPI.getBusinessTypes()
petShopCompaniesAPI.getSpecializations()

// Hold Bills
petShopHoldBillsAPI.getAll()
petShopHoldBillsAPI.getById(id)
petShopHoldBillsAPI.create(data)
petShopHoldBillsAPI.delete(id)
```

---

## Backend Routes Status

All backend routes are properly registered in `server/server.js`:

✅ `/api/petshop/medicines` → `petshopPharmacyRoutes.js`
✅ `/api/petshop/sales` → `petshopPharmacyRoutes.js`
✅ `/api/petshop/purchases` → `petshopPharmacyRoutes.js`
✅ `/api/petshop/dues` → `petshopPharmacyRoutes.js`
✅ `/api/petshop/credit-customers` → `petshopPharmacyRoutes.js`
✅ `/api/petshop-history/sales-history` → `petshopPharmacyHistoryRoutes.js`
✅ `/api/petshop-history/purchase-history` → `petshopPharmacyHistoryRoutes.js`
✅ `/api/petshop-history/returns` → `petshopPharmacyHistoryRoutes.js`
✅ `/api/petshop-invoices` → `petshopPharmacyInvoiceRoutes.js`
✅ `/api/petshop-purchase-drafts` → `petshopPharmacyPurchaseDraftRoutes.js`
✅ `/api/petshop-settings` → `petshopPharmacySettingsRoutes.js`
✅ `/api/petshop-notifications` → `petshopNotificationRoutes.js`
✅ `/api/petshop-suppliers` → `petShopSupplierRoutes.js`
✅ `/api/petshop-companies` → `petShopCompanyRoutes.js`
✅ `/api/petshop-hold-bills` → `petShopHoldBillRoutes.js`

**All backend routes are functional and ready to use!**

---

## Testing Checklist

### For Each Page:
- [ ] Page loads without errors
- [ ] Data fetches from correct petshop API
- [ ] Create operation works
- [ ] Read operation works
- [ ] Update operation works
- [ ] Delete operation works
- [ ] Search/filter works
- [ ] Pagination works
- [ ] Navigation to/from page works
- [ ] Modals open/close correctly
- [ ] Forms validate correctly
- [ ] Toast notifications appear
- [ ] Print/export features work (if applicable)

---

## Next Steps

1. **Complete Phase 1**: Create remaining 13 wrapper pages
2. **Complete Phase 2**: Register all routes in `main.jsx`
3. **Complete Phase 3**: Test all routes systematically
4. **Document**: Update user documentation with new features
5. **Deploy**: Push changes to production

---

## Notes

- The petshop pharmacy system is a **complete duplicate** of the main pharmacy system
- All backend APIs are already implemented and functional
- The only missing piece is the frontend routing and page wrappers
- Once completed, the petshop pharmacy will have full feature parity with the main pharmacy

---

## Estimated Completion Time

- Phase 1 (Create pages): 2-3 hours
- Phase 2 (Register routes): 15 minutes
- Phase 3 (Testing): 2-3 hours
- **Total**: 4-6 hours

---

## Risk Assessment

**Low Risk** - All backend infrastructure exists, only frontend wiring needed.

**Potential Issues:**
1. API response format differences between pharmacy and petshop
2. Missing fields in petshop models vs pharmacy models
3. Permission/authentication differences

**Mitigation:**
- Test each page thoroughly
- Add error handling for missing fields
- Use adapter pattern where needed
