import React from "react";
import PharmacyDashboard from "../../pharmacy/Dashboard";
import {
  petshopPharmacyMedicinesAPI,
  petshopPharmacySalesAPI,
  petshopPharmacyReportsAPI,
} from "../../../services/api";

export default function ShopPharmacyDashboard() {
  return (
    <PharmacyDashboard
      basePath="/shop/pharmacy"
      apis={{
        medicines: petshopPharmacyMedicinesAPI,
        sales: petshopPharmacySalesAPI,
        reports: petshopPharmacyReportsAPI,
      }}
    />
  );
}
