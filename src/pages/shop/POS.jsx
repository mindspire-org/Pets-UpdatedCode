import React from 'react';
import PharmacyPOS from '../pharmacy/POS';
import {
  petshopPharmacyMedicinesAPI,
  petshopPharmacySalesAPI,
  petshopPharmacyDuesAPI,
  petshopPharmacyCreditCustomersAPI,
  petshopPharmacySettingsAPI,
  petShopHoldBillsAPI,
} from '../../services/api';

export default function POS() {
  return (
    <PharmacyPOS
      apis={{
        medicines: petshopPharmacyMedicinesAPI,
        sales: petshopPharmacySalesAPI,
        dues: petshopPharmacyDuesAPI,
        creditCustomers: petshopPharmacyCreditCustomersAPI,
        pharmacySettings: petshopPharmacySettingsAPI,
        holdBills: petShopHoldBillsAPI,
      }}
    />
  );
}
