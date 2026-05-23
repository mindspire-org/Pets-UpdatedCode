import React from "react";
import { useSearchParams } from "react-router-dom";
import PharmacyMedicines from "../pharmacy/Medicines";
import {
  petshopPharmacyMedicinesAPI,
  petshopPharmacySalesAPI,
  petshopPharmacyPurchaseDraftsAPI,
  petShopSuppliersAPI,
  petShopCompaniesAPI,
} from "../../services/api";

// Adapter: suppliersAPI.getAll(portal, status) → petShopSuppliersAPI.getAll(status)
const shopSuppliersAdapter = {
  ...petShopSuppliersAPI,
  getAll: (_portal, status = "") => petShopSuppliersAPI.getAll(status),
  create: (data) => {
    const { portal: _p, ...rest } = data;
    return petShopSuppliersAPI.create(rest);
  },
};

// Adapter: companiesAPI.getAll(portal, status) → petShopCompaniesAPI.getAll(status)
const shopCompaniesAdapter = {
  ...petShopCompaniesAPI,
  getAll: (_portal, status = "") => petShopCompaniesAPI.getAll(status),
  create: (data) => {
    const { portal: _p, ...rest } = data;
    return petShopCompaniesAPI.create(rest);
  },
};

export default function ShopInventory() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "all";

  return (
    <PharmacyMedicines
      basePath="/shop"
      portalName="shop"
      storageNamespace="shop_inventory"
      title="Product Inventory"
      subtitle="Manage your shop products and stock"
      addInvoicePath="/shop/add-product"
      initialTab={initialTab}
      apis={{
        medicines: petshopPharmacyMedicinesAPI,
        sales: petshopPharmacySalesAPI,
        purchaseDrafts: petshopPharmacyPurchaseDraftsAPI,
        suppliers: shopSuppliersAdapter,
        companies: shopCompaniesAdapter,
        suppliersPortal: "shop",
        companiesPortal: "shop",
      }}
    />
  );
}
