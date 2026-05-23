import React from "react";
import { petShopCompaniesAPI } from "../../../services/api";
import ShopCompanies from "../Companies";

// The shop Companies page already uses petShopCompaniesAPI, so we can reuse it directly.
export default function ShopPharmacyCompanies() {
  return <ShopCompanies />;
}
