import React, { useState, useEffect, useRef } from "react";
import {
  FiSearch,
  FiPlus,
  FiMinus,
  FiTrash2,
  FiPrinter,
  FiShoppingCart,
  FiX,
  FiGrid,
  FiList,
  FiEyeOff,
  FiMaximize2,
} from "react-icons/fi";
import {
  petshopPharmacyMedicinesAPI,
  petshopPharmacySalesAPI,
  settingsAPI,
  petshopPharmacyDuesAPI,
  petsAPI,
  prescriptionsAPI,
  petshopPharmacyCreditCustomersAPI,
  holdBillsAPI,
  petshopPharmacySettingsAPI,
} from "../../../services/api";

export default function ShopPharmacyPOS() {
  const [medicines, setMedicines] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState([]);
  const [customerInfo, setCustomerInfo] = useState({
    customerName: "",
    customerContact: "",
    address: "",
    cnic: "",
    petName: "",
    patientId: "",
    clientId: "",
    species: "",
    breed: "",
    sex: "",
    age: "",
    weight: "",
    followUpDate: "",
    comments: "",
  });
  const [paymentTab, setPaymentTab] = useState("Cash");
  const [discounts, setDiscounts] = useState({
    medicine: 0,
    surgical: 0,
    procedures: 0,
  });
  const [billDiscountPercent, setBillDiscountPercent] = useState(0);
  const [billDiscountAmount, setBillDiscountAmount] = useState(0);
  const [salesTaxPercent, setSalesTaxPercent] = useState(0);
  const [allCreditCustomers, setAllCreditCustomers] = useState([]);
  const [creditSuggestions, setCreditSuggestions] = useState([]);
  const [selectedCreditCustomer, setSelectedCreditCustomer] = useState(null);
  const [showCreditSuggestions, setShowCreditSuggestions] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomerLoading, setNewCustomerLoading] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({
    name: "",
    phone: "",
    cnic: "",
    address: "",
  });
  const [lastSale, setLastSale] = useState(null);
  const [receivedAmount, setReceivedAmount] = useState("");
  const [previousDue, setPreviousDue] = useState(0);
  const [resumedBillId, setResumedBillId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [toast, setToast] = useState("");
  const [showHeldBillsModal, setShowHeldBillsModal] = useState(false);
  const [heldBills, setHeldBills] = useState([]);
  const [isLoadingHeldBills, setIsLoadingHeldBills] = useState(false);
  const [hospitalSettings, setHospitalSettings] = useState(null);
  const [pharmacySettings, setPharmacySettings] = useState(null);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(-1);
  const receiptRef = useRef();
  const searchInputRef = useRef();
  const qtyInputRefs = useRef({});
  const priceInputRefs = useRef({});
  const discountInputRefs = useRef({});

  useEffect(() => {
    fetchMedicines();
    fetchHospitalSettings();
    fetchPharmacySettings();
    loadPrescriptionData();
  }, []);

  useEffect(() => {
    if (!searchQuery) {
      setSelectedSearchIndex(-1);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (selectedSearchIndex >= 0) {
      const dropdown = document.querySelector(".search-dropdown-pharmacy");
      const selectedItem = dropdown?.children[selectedSearchIndex];
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [selectedSearchIndex]);

  const fetchMedicines = async () => {
    try {
      const res = await petshopPharmacyMedicinesAPI.getAll();
      const meds = res?.data?.data || res?.data || [];
      setMedicines(Array.isArray(meds) ? meds : []);
    } catch (e) {
      console.error("Failed to fetch petshop medicines", e);
      setMedicines([]);
    }
  };

  const fetchHospitalSettings = async () => {
    try {
      const userId = "default";
      const res = await settingsAPI.get(userId);
      setHospitalSettings(res?.data || null);
    } catch (e) {
      console.warn("Failed to load hospital settings", e);
      setHospitalSettings(null);
    }
  };

  const fetchPharmacySettings = async () => {
    try {
      const res = await petshopPharmacySettingsAPI.get();
      setPharmacySettings(res?.data || null);

      const tax = Number(res?.data?.salesTaxPercent ?? res?.data?.salesTax ?? 0);
      setSalesTaxPercent(Number.isFinite(tax) ? tax : 0);
    } catch (e) {
      console.warn("Failed to load petshop pharmacy settings", e);
      setPharmacySettings(null);
      setSalesTaxPercent(0);
    }
  };

  const loadPrescriptionData = async () => {
    try {
      await prescriptionsAPI.getAll();
    } catch (e) {
      // Ignore; POS can run without this.
    }
  };

  // NOTE: This page is intentionally a thin wrapper.
  // The full POS implementation will be migrated efficiently in the next pass
  // (copying the remaining logic from src/pages/pharmacy/POS.jsx and swapping
  // APIs + routes). For now, we render a clear placeholder so routing works.

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <FiShoppingCart className="w-6 h-6 text-purple-600" />
          <div>
            <div className="text-lg font-bold text-slate-900">
              Petshop Pharmacy POS
            </div>
            <div className="text-sm text-slate-600">
              This page is wired to petshop APIs. Next step: migrate full POS
              logic.
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="text-sm text-slate-700 font-semibold mb-2">
          Quick Sanity
        </div>
        <div className="text-sm text-slate-600">
          Loaded medicines: <span className="font-bold">{medicines.length}</span>
        </div>
        {toast ? (
          <div className="mt-2 text-sm text-purple-700">{toast}</div>
        ) : null}
      </div>
    </div>
  );
}
