import React from "react";
import PharmacyMedicines from "../../pharmacy/Medicines";
import {
  petshopPharmacyMedicinesAPI,
  petshopPharmacySalesAPI,
  petshopPharmacyPurchaseDraftsAPI,
  petShopSuppliersAPI,
  petShopCompaniesAPI,
} from "../../../services/api";

// Adapter: suppliersAPI.getAll(portal, status) → petShopSuppliersAPI.getAll(status)
const shopSuppliersAdapter = {
  ...petShopSuppliersAPI,
  getAll: (_portal, status = "") => petShopSuppliersAPI.getAll(status),
  create: (data) => {
    // Strip portal field — petshop suppliers don't use it
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

export default function ShopMedicines() {
  return (
    <PharmacyMedicines
      basePath="/shop/pharmacy"
      portalName="shop"
      storageNamespace="shop_pharmacy"
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
