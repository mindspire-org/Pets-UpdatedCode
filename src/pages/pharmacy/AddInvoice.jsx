import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiX,
  FiPackage,
  FiArrowLeft,
  FiAlertTriangle,
  FiPause,
  FiPlay,
  FiClock,
} from "react-icons/fi";
import {
  pharmacyMedicinesAPI,
  suppliersAPI,
  companiesAPI,
  pharmacyPurchaseDraftsAPI,
  holdInvoicesAPI,
} from "../../services/api";
import {
  medicineCatalog,
  formatCatalogLabel,
} from "../../data/medicineCatalog";

// ─── Catalog helpers ────────────────────────────────────────────────────────
const catalogMainCategories = Object.keys(medicineCatalog);

const getSubCategories = (main) =>
  main && medicineCatalog[main] ? Object.keys(medicineCatalog[main]) : [];

const getCatalogMedicines = (main, sub) =>
  medicineCatalog[main]?.[sub] || [];

const getCategoryUnit = (main, sub) => {
  const lower = (sub || main || "").toLowerCase();
  if (lower.includes("injection")) return "ml";
  if (lower.includes("syrup") || lower.includes("liquid")) return "ml";
  return "pieces";
};

const getDefaultContainerType = () => "";

// ─── localStorage helpers ────────────────────────────────────────────────────
const ls = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { return fallback; }
};
const lsSet = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };

const getHiddenMainCategories = () => ls("pharmacy_hidden_main_categories", []);
const getCustomMainCategories = () => ls("pharmacy_custom_main_categories", []);
const getHiddenSubCategories = (main) => (ls("pharmacy_hidden_subcategories", {}))[main] || [];
const getCustomSubCategories = (main) => (ls("pharmacy_custom_subcategories", {}))[main] || [];
const getHiddenMedicines = (main, sub) => (ls("pharmacy_hidden_medicines", {}))[`${main}::${sub}`] || [];
const getCustomMedicines = (main, sub) => (ls("pharmacy_custom_medicines", {}))[`${main}::${sub}`] || [];

// ─── Empty item factory ──────────────────────────────────────────────────────
const createEmptyItem = () => {
  const main = catalogMainCategories[0] || "";
  const sub = main ? getSubCategories(main)[0] || "" : "";
  const med = main && sub ? getCatalogMedicines(main, sub)[0] || "" : "";
  return {
    id: Date.now() + Math.random(),
    collapsed: false,
    mainCategory: main,
    subCategory: sub,
    category: sub || main,
    medicineName: med,
    batchNo: "",
    genericName: "",
    barcode: "",
    expiryDate: "",
    qtyPacks: 0,
    unitsPerPack: 1,
    buyPerPack: 0,
    salePerPack: 0,
    totalItems: 0,
    minStock: 0,
    defaultDiscount: 0,
    lineTaxType: "%",
    lineTaxValue: 0,
    unit: getCategoryUnit(main, sub),
    containerType: "",
  };
};

export default function AddInvoice() {
  const navigate = useNavigate();
  const location = useLocation();

  // ── Draft-level state (for editing) ──────────────────────────────────────
  const [editingDraftId, setEditingDraftId] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [supplierSelection, setSupplierSelection] = useState("");
  const [invoiceItems, setInvoiceItems] = useState([createEmptyItem()]);
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const [formData, setFormData] = useState({
    supplierName: "",
    companyId: "",
    invoiceNo: "INV-1",
    invoiceDate: new Date().toISOString().split("T")[0],
  });

  // ── Add Supplier modal ───────────────────────────────────────────────────
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [newSupplierData, setNewSupplierData] = useState({
    name: "", companyId: "", phone: "", address: "", taxId: "", status: "active",
  });
  const [savingSupplier, setSavingSupplier] = useState(false);

  // ── Add Company modal ────────────────────────────────────────────────────
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [newCompanyData, setNewCompanyData] = useState({ companyName: "", status: "active" });
  const [savingCompany, setSavingCompany] = useState(false);

  // ── Invoice-level taxes ──────────────────────────────────────────────────
  const [invoiceTaxes, setInvoiceTaxes] = useState([]);
  const [taxesCollapsed, setTaxesCollapsed] = useState(false);

  const [optionsVersion, setOptionsVersion] = useState(0);
  const [manageDialog, setManageDialog] = useState(null);
  const [addOptionDialog, setAddOptionDialog] = useState(null);

  // ── Held invoices state ──────────────────────────────────────────────────
  const [showHeldInvoicesModal, setShowHeldInvoicesModal] = useState(false);
  const [heldInvoices, setHeldInvoices] = useState([]);
  const [isLoadingHeldInvoices, setIsLoadingHeldInvoices] = useState(false);
  const [resumedInvoiceId, setResumedInvoiceId] = useState(null);

  // ── Fetch on mount ───────────────────────────────────────────────────────
  useEffect(() => {
    fetchSuppliers();
    fetchCompanies();
  }, []);

  // ── Load draft for editing if draftId is in location state ────────────────
  useEffect(() => {
    if (location.state?.draftId) {
      loadDraftForEditing(location.state.draftId);
    }
  }, [location.state?.draftId]);

  const loadDraftForEditing = async (draftId) => {
    try {
      setEditingDraftId(draftId);
      const res = await pharmacyPurchaseDraftsAPI.getById(draftId);
      const draft = res.data;
      if (!draft) return;

      // Restore form data
      setFormData({
        supplierName: draft.supplierName || "",
        companyId: draft.companyId || "",
        invoiceNo: draft.invoiceNo || "",
        invoiceDate: draft.invoiceDate ? new Date(draft.invoiceDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      });
      if (draft.supplierName) setSupplierSelection(draft.supplierName);

      // Restore items
      const restoredItems = (draft.items || []).map((item, idx) => ({
        ...createEmptyItem(),
        id: Date.now() + idx + Math.random(),
        mainCategory: item.mainCategory || "",
        subCategory: item.subCategory || "",
        category: item.category || "",
        medicineName: item.medicineName || "",
        genericName: item.genericName || "",
        batchNo: item.batchNo || "",
        barcode: item.barcode || "",
        expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString().split("T")[0] : "",
        qtyPacks: item.qtyPacks || 0,
        unitsPerPack: item.unitsPerPack || 1,
        buyPerPack: item.buyPerPack || 0,
        salePerPack: item.salePerPack || 0,
        totalItems: item.totalItems != null ? item.totalItems : undefined,
        minStock: item.minStock || 0,
        defaultDiscount: item.defaultDiscount || 0,
        lineTaxType: item.lineTaxType || "%",
        lineTaxValue: item.lineTaxValue || 0,
        unit: item.unit || getCategoryUnit(item.mainCategory, item.subCategory),
        containerType: item.containerType || "",
      }));
      setInvoiceItems(restoredItems);

      // Restore invoice taxes
      const restoredTaxes = (draft.invoiceTaxes || []).map((t, idx) => ({
        id: Date.now() + idx,
        name: t.name || "",
        type: t.type || "%",
        value: t.value || 0,
        applyOn: t.applyOn || "gross",
      }));
      setInvoiceTaxes(restoredTaxes);

      showToast("Draft loaded for editing");
    } catch (err) {
      console.error("Error loading draft:", err);
      showToast("Error loading draft for editing");
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await suppliersAPI.getAll("pharmacy", "active");
      setSuppliers(
        (res.data || []).map((s) => {
          const rawCompanyIds = Array.isArray(s.companyIds) ? s.companyIds : [];
          const merged = [
            ...(rawCompanyIds || []),
            ...(s.companyId ? [s.companyId] : []),
          ].filter(Boolean);

          return {
            _id: s._id,
            name: s.supplierName || s.name || "",
            companyIds: [...new Set(merged.map((id) => String(id)))],
          };
        }),
      );
    } catch {}
  };

  const fetchCompanies = async () => {
    try {
      const res = await companiesAPI.getAll("pharmacy", "active");
      setCompanies(res.data || []);
    } catch {}
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  // ── Hold Invoice handlers ────────────────────────────────────────────────
  const handleHoldInvoice = async () => {
    // ── Validation: Invoice Details ─────────────────────────────────────────
    const resolvedSupplier = (supplierSelection || formData.supplierName || "").trim();
    if (!resolvedSupplier) {
      showToast("Please select a Supplier to hold invoice");
      return;
    }

    if (!formData.invoiceNo?.trim()) {
      showToast("Please enter Invoice Number to hold invoice");
      return;
    }

    if (!formData.invoiceDate) {
      showToast("Please select Invoice Date to hold invoice");
      return;
    }

    // ── Validation: Items ───────────────────────────────────────────────────
    // Check if at least one item has required fields: category AND medicine
    const hasValidItem = invoiceItems.some(item => {
      return item.mainCategory?.trim() && item.medicineName?.trim();
    });

    if (!hasValidItem) {
      showToast("Please enter at least one item with Category and Medicine Name to hold");
      return;
    }

    try {
      // Calculate totals
      let grossTotal = 0, totalLineTaxes = 0;
      const computedItems = invoiceItems.map((item) => {
        const uPack = item.unitsPerPack || 1;
        const subtotal = (item.qtyPacks || 0) * (item.buyPerPack || 0);
        const discountAmt = subtotal * ((item.defaultDiscount || 0) / 100);
        const taxAmt = item.lineTaxType === "%"
          ? subtotal * ((item.lineTaxValue || 0) / 100)
          : (item.lineTaxValue || 0);
        const lineTotal = subtotal + taxAmt;
        grossTotal += subtotal;
        totalLineTaxes += taxAmt;
        return {
          mainCategory: item.mainCategory,
          subCategory: item.subCategory,
          category: item.subCategory || item.mainCategory,
          medicineName: item.medicineName,
          genericName: item.genericName || "",
          batchNo: item.batchNo || "",
          barcode: item.barcode || "",
          expiryDate: item.expiryDate || undefined,
          qtyPacks: item.qtyPacks || 0,
          unitsPerPack: uPack,
          buyPerPack: item.buyPerPack || 0,
          salePerPack: item.salePerPack || 0,
          minStock: item.minStock || 0,
          defaultDiscount: item.defaultDiscount || 0,
          lineTaxType: item.lineTaxType || "%",
          lineTaxValue: item.lineTaxValue || 0,
          unit: item.unit || getCategoryUnit(item.mainCategory, item.subCategory),
          containerType: item.containerType || "",
          subtotal,
          discountAmt,
          taxAmt,
          lineTotal,
        };
      });

      const netBeforeInvTax = grossTotal + totalLineTaxes;
      const computedInvTaxes = invoiceTaxes.map((t) => {
        const base = t.applyOn === "net" ? netBeforeInvTax : grossTotal;
        const amount = t.type === "%" ? base * ((Number(t.value) || 0) / 100) : (Number(t.value) || 0);
        return { name: t.name, type: t.type, value: Number(t.value) || 0, applyOn: t.applyOn, amount };
      });
      const totalInvoiceTaxes = computedInvTaxes.reduce((s, t) => s + t.amount, 0);
      const netTotal = netBeforeInvTax + totalInvoiceTaxes;

      const sup = suppliers.find((s) => s.name === resolvedSupplier);

      const holdData = {
        invoiceNo: formData.invoiceNo || "INV-1",
        invoiceDate: new Date(formData.invoiceDate).toISOString(),
        supplierName: resolvedSupplier,
        supplierId: sup?._id || undefined,
        companyId: formData.companyId || undefined,
        items: computedItems,
        invoiceTaxes: computedInvTaxes,
        grossTotal,
        totalLineTaxes,
        totalInvoiceTaxes,
        netTotal,
        heldBy: JSON.parse(localStorage.getItem("user") || "{}").username || "admin",
        portal: "pharmacy",
      };

      await holdInvoicesAPI.create(holdData);
      showToast("Invoice held successfully!");
      clearInvoice();
    } catch (error) {
      console.error("Error holding invoice:", error);
      showToast("Error holding invoice. Please try again.");
    }
  };

  const fetchHeldInvoices = async () => {
    setIsLoadingHeldInvoices(true);
    try {
      const response = await holdInvoicesAPI.getAll();
      setHeldInvoices(response.data || []);
    } catch (error) {
      console.error("Error fetching held invoices:", error);
    } finally {
      setIsLoadingHeldInvoices(false);
    }
  };

  const resumeHeldInvoice = (invoice) => {
    // Restore items
    const restoredItems = (invoice.items || []).map((item, idx) => ({
      ...createEmptyItem(),
      id: Date.now() + idx + Math.random(),
      mainCategory: item.mainCategory || "",
      subCategory: item.subCategory || "",
      category: item.category || "",
      medicineName: item.medicineName || "",
      genericName: item.genericName || "",
      batchNo: item.batchNo || "",
      barcode: item.barcode || "",
      expiryDate: item.expiryDate || "",
      qtyPacks: item.qtyPacks || 0,
      unitsPerPack: item.unitsPerPack || 1,
      buyPerPack: item.buyPerPack || 0,
      salePerPack: item.salePerPack || 0,
      totalItems: item.totalItems != null ? item.totalItems : undefined,
      minStock: item.minStock || 0,
      defaultDiscount: item.defaultDiscount || 0,
      lineTaxType: item.lineTaxType || "%",
      lineTaxValue: item.lineTaxValue || 0,
      unit: item.unit || getCategoryUnit(item.mainCategory, item.subCategory),
      containerType: item.containerType || "",
    }));

    setInvoiceItems(restoredItems);
    setFormData({
      supplierName: invoice.supplierName || "",
      companyId: invoice.companyId || "",
      invoiceNo: invoice.invoiceNo || "INV-1",
      invoiceDate: invoice.invoiceDate ? new Date(invoice.invoiceDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
    });
    if (invoice.supplierName) {
      setSupplierSelection(invoice.supplierName);
    }
    setInvoiceTaxes((invoice.invoiceTaxes || []).map((t, idx) => ({
      id: Date.now() + idx,
      name: t.name || "",
      type: t.type || "%",
      value: t.value || 0,
      applyOn: t.applyOn || "gross",
    })));

    // Store the ID of the resumed invoice
    setResumedInvoiceId(invoice._id);

    // Close modal
    setShowHeldInvoicesModal(false);
    showToast("Invoice resumed. It will remain in Held list until submitted.");
  };

  const clearInvoice = () => {
    setInvoiceItems([createEmptyItem()]);
    setSupplierSelection("");
    setFormData({
      supplierName: "",
      companyId: "",
      invoiceNo: "INV-1",
      invoiceDate: new Date().toISOString().split("T")[0],
    });
    setInvoiceTaxes([]);
    setResumedInvoiceId(null);
  };

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      // F6 - Hold Invoice
      if (e.key === 'F6') {
        e.preventDefault();
        if (invoiceItems.length > 0 && invoiceItems.some(i => i.medicineName?.trim())) {
          handleHoldInvoice();
        }
      }
      // F7 - Show Held Invoices
      if (e.key === 'F7') {
        e.preventDefault();
        fetchHeldInvoices();
        setShowHeldInvoicesModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [invoiceItems]);

  const hideMainCategory = (value) => {
    const val = String(value || "").trim();
    if (!val) return;
    const current = getHiddenMainCategories();
    if (!current.includes(val)) {
      lsSet("pharmacy_hidden_main_categories", [...current, val]);
      setOptionsVersion((v) => v + 1);
    }
  };

  const unhideMainCategory = (value) => {
    const val = String(value || "").trim();
    if (!val) return;
    const current = getHiddenMainCategories();
    if (current.includes(val)) {
      lsSet(
        "pharmacy_hidden_main_categories",
        current.filter((x) => x !== val),
      );
      setOptionsVersion((v) => v + 1);
    }
  };

  const removeCustomMainCategory = (value) => {
    const val = String(value || "").trim();
    if (!val) return;
    const custom = getCustomMainCategories();
    if (!custom.includes(val)) return;
    lsSet(
      "pharmacy_custom_main_categories",
      custom.filter((x) => x !== val),
    );

    const subMap = ls("pharmacy_custom_subcategories", {});
    delete subMap[val];
    lsSet("pharmacy_custom_subcategories", subMap);

    const hiddenSubMap = ls("pharmacy_hidden_subcategories", {});
    delete hiddenSubMap[val];
    lsSet("pharmacy_hidden_subcategories", hiddenSubMap);

    const medMap = ls("pharmacy_custom_medicines", {});
    Object.keys(medMap).forEach((k) => {
      if (String(k).startsWith(`${val}::`)) delete medMap[k];
    });
    lsSet("pharmacy_custom_medicines", medMap);

    const hiddenMedMap = ls("pharmacy_hidden_medicines", {});
    Object.keys(hiddenMedMap).forEach((k) => {
      if (String(k).startsWith(`${val}::`)) delete hiddenMedMap[k];
    });
    lsSet("pharmacy_hidden_medicines", hiddenMedMap);

    setOptionsVersion((v) => v + 1);
  };

  const hideSubCategory = (mainCategory, value) => {
    const main = String(mainCategory || "").trim();
    const val = String(value || "").trim();
    if (!main || !val) return;
    const map = ls("pharmacy_hidden_subcategories", {});
    const list = Array.isArray(map[main]) ? map[main] : [];
    if (!list.includes(val)) {
      map[main] = [...list, val];
      lsSet("pharmacy_hidden_subcategories", map);
      setOptionsVersion((v) => v + 1);
    }
  };

  const unhideSubCategory = (mainCategory, value) => {
    const main = String(mainCategory || "").trim();
    const val = String(value || "").trim();
    if (!main || !val) return;
    const map = ls("pharmacy_hidden_subcategories", {});
    const list = Array.isArray(map[main]) ? map[main] : [];
    if (list.includes(val)) {
      map[main] = list.filter((x) => x !== val);
      lsSet("pharmacy_hidden_subcategories", map);
      setOptionsVersion((v) => v + 1);
    }
  };

  const removeCustomSubCategory = (mainCategory, value) => {
    const main = String(mainCategory || "").trim();
    const val = String(value || "").trim();
    if (!main || !val) return;
    const custom = getCustomSubCategories(main);
    if (!custom.includes(val)) return;

    const map = ls("pharmacy_custom_subcategories", {});
    const list = Array.isArray(map[main]) ? map[main] : [];
    map[main] = list.filter((x) => x !== val);
    lsSet("pharmacy_custom_subcategories", map);

    const hiddenMap = ls("pharmacy_hidden_subcategories", {});
    const hiddenList = Array.isArray(hiddenMap[main]) ? hiddenMap[main] : [];
    hiddenMap[main] = hiddenList.filter((x) => x !== val);
    lsSet("pharmacy_hidden_subcategories", hiddenMap);

    const medKey = `${main}::${val}`;
    const medMap = ls("pharmacy_custom_medicines", {});
    delete medMap[medKey];
    lsSet("pharmacy_custom_medicines", medMap);

    const hiddenMedMap = ls("pharmacy_hidden_medicines", {});
    delete hiddenMedMap[medKey];
    lsSet("pharmacy_hidden_medicines", hiddenMedMap);

    setOptionsVersion((v) => v + 1);
  };

  const hideMedicineName = (mainCategory, subCategory, value) => {
    const main = String(mainCategory || "").trim();
    const sub = String(subCategory || "").trim();
    const val = String(value || "").trim();
    if (!main || !sub || !val) return;
    const key = `${main}::${sub}`;
    const map = ls("pharmacy_hidden_medicines", {});
    const list = Array.isArray(map[key]) ? map[key] : [];
    if (!list.includes(val)) {
      map[key] = [...list, val];
      lsSet("pharmacy_hidden_medicines", map);
      setOptionsVersion((v) => v + 1);
    }
  };

  const unhideMedicineName = (mainCategory, subCategory, value) => {
    const main = String(mainCategory || "").trim();
    const sub = String(subCategory || "").trim();
    const val = String(value || "").trim();
    if (!main || !sub || !val) return;
    const key = `${main}::${sub}`;
    const map = ls("pharmacy_hidden_medicines", {});
    const list = Array.isArray(map[key]) ? map[key] : [];
    if (list.includes(val)) {
      map[key] = list.filter((x) => x !== val);
      lsSet("pharmacy_hidden_medicines", map);
      setOptionsVersion((v) => v + 1);
    }
  };

  const removeCustomMedicine = (mainCategory, subCategory, value) => {
    const main = String(mainCategory || "").trim();
    const sub = String(subCategory || "").trim();
    const val = String(value || "").trim();
    if (!main || !sub || !val) return;
    const key = `${main}::${sub}`;

    const custom = getCustomMedicines(main, sub);
    if (!custom.includes(val)) return;

    const map = ls("pharmacy_custom_medicines", {});
    const list = Array.isArray(map[key]) ? map[key] : [];
    map[key] = list.filter((x) => x !== val);
    lsSet("pharmacy_custom_medicines", map);

    const hiddenMap = ls("pharmacy_hidden_medicines", {});
    const hiddenList = Array.isArray(hiddenMap[key]) ? hiddenMap[key] : [];
    hiddenMap[key] = hiddenList.filter((x) => x !== val);
    lsSet("pharmacy_hidden_medicines", hiddenMap);

    setOptionsVersion((v) => v + 1);
  };

  const addCustomMainCategory = (value) => {
    const next = String(value || "").trim();
    if (!next) return;
    const existing = getCustomMainCategories();
    if (!existing.includes(next)) {
      lsSet("pharmacy_custom_main_categories", [...existing, next]);
      setOptionsVersion((v) => v + 1);
      showToast("Main category added");
    }
  };

  const addCustomSubCategory = (mainCategory, value) => {
    const main = String(mainCategory || "").trim();
    const next = String(value || "").trim();
    if (!main || !next) return;
    const map = ls("pharmacy_custom_subcategories", {});
    const list = Array.isArray(map[main]) ? map[main] : [];
    if (!list.includes(next)) {
      map[main] = [...list, next];
      lsSet("pharmacy_custom_subcategories", map);
      setOptionsVersion((v) => v + 1);
      showToast("Subcategory added");
    }
  };

  const addCustomMedicine = (mainCategory, subCategory, value) => {
    const main = String(mainCategory || "").trim();
    const sub = String(subCategory || "").trim();
    const next = String(value || "").trim();
    if (!main || !sub || !next) return;
    const key = `${main}::${sub}`;
    const map = ls("pharmacy_custom_medicines", {});
    const list = Array.isArray(map[key]) ? map[key] : [];
    if (!list.includes(next)) {
      map[key] = [...list, next];
      lsSet("pharmacy_custom_medicines", map);
      setOptionsVersion((v) => v + 1);
      showToast("Medicine added");
    }
  };

  // ── Add Supplier handler ─────────────────────────────────────────────────
  const handleAddSupplier = async (e) => {
    e.preventDefault();
    if (!newSupplierData.name.trim()) return;
    try {
      setSavingSupplier(true);
      await suppliersAPI.create({
        supplierName: newSupplierData.name.trim(),
        phone: newSupplierData.phone || "",
        address: newSupplierData.address || "",
        taxId: newSupplierData.taxId || "",
        status: newSupplierData.status || "active",
        companyId: newSupplierData.companyId || null,
        portal: "pharmacy",
        contactPerson: "", email: "", city: "", notes: "",
      });
      await fetchSuppliers();
      const name = newSupplierData.name.trim();
      setSupplierSelection(name);
      setFormData((p) => ({ ...p, supplierName: name }));
      setShowAddSupplierModal(false);
      setNewSupplierData({ name: "", companyId: "", phone: "", address: "", taxId: "", status: "active" });
      showToast("Supplier added");
    } catch (err) {
      showToast(err.message || "Error adding supplier");
    } finally {
      setSavingSupplier(false);
    }
  };

  // ── Add Company handler ──────────────────────────────────────────────────
  const handleAddCompany = async (e) => {
    e.preventDefault();
    if (!newCompanyData.companyName.trim()) return;
    try {
      setSavingCompany(true);
      await companiesAPI.create({
        companyName: newCompanyData.companyName.trim(),
        status: newCompanyData.status || "active",
        portal: "pharmacy",
      });
      await fetchCompanies();
      setShowAddCompanyModal(false);
      setNewCompanyData({ companyName: "", status: "active" });
      showToast("Company added");
    } catch (err) {
      showToast(err.message || "Error adding company");
    } finally {
      setSavingCompany(false);
    }
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const resolvedSupplier = (supplierSelection || formData.supplierName || "").trim();

      // Compute all totals
      let grossTotal = 0, totalLineTaxes = 0;
      const computedItems = invoiceItems.map((item) => {
        const uPack = item.unitsPerPack || 1;
        const subtotal = (item.qtyPacks || 0) * (item.buyPerPack || 0);
        const discountAmt = subtotal * ((item.defaultDiscount || 0) / 100);
        // Only calculate line tax on subtotal, not after discount
        const taxAmt = item.lineTaxType === "%"
          ? subtotal * ((item.lineTaxValue || 0) / 100)
          : (item.lineTaxValue || 0);
        const lineTotal = subtotal + taxAmt;
        grossTotal += subtotal;
        totalLineTaxes += taxAmt;
        const totalItems = item.totalItems != null ? Number(item.totalItems) : (item.qtyPacks || 0) * uPack;
        return {
          mainCategory:    item.mainCategory,
          subCategory:     item.subCategory,
          category:        item.subCategory || item.mainCategory,
          medicineName:    item.medicineName,
          genericName:     item.genericName || "",
          batchNo:         item.batchNo || "",
          barcode:         item.barcode || "",
          expiryDate:      item.expiryDate || undefined,
          qtyPacks:        item.qtyPacks || 0,
          unitsPerPack:    uPack,
          buyPerPack:      item.buyPerPack || 0,
          salePerPack:     item.salePerPack || 0,
          totalItems,
          buyPerUnit:      uPack > 0 ? +((item.buyPerPack || 0) / uPack).toFixed(4) : 0,
          salePerUnit:     uPack > 0 ? +((item.salePerPack || 0) / uPack).toFixed(4) : 0,
          minStock:        item.minStock || 0,
          defaultDiscount: item.defaultDiscount || 0,
          lineTaxType:     item.lineTaxType || "%",
          lineTaxValue:    item.lineTaxValue || 0,
          subtotal,
          discountAmt,
          taxAmt,
          lineTotal,
          unit:            item.unit || getCategoryUnit(item.mainCategory, item.subCategory),
          containerType:   item.containerType || "",
        };
      });

      const netBeforeInvTax = grossTotal + totalLineTaxes;
      const computedInvTaxes = invoiceTaxes.map((t) => {
        const base = t.applyOn === "net" ? netBeforeInvTax : grossTotal;
        const amount = t.type === "%" ? base * ((Number(t.value) || 0) / 100) : (Number(t.value) || 0);
        return { name: t.name, type: t.type, value: Number(t.value) || 0, applyOn: t.applyOn, amount };
      });
      const totalInvoiceTaxes = computedInvTaxes.reduce((s, t) => s + t.amount, 0);
      const netTotal = netBeforeInvTax + totalInvoiceTaxes;

      // Find supplierId
      const sup = suppliers.find((s) => s.name === resolvedSupplier);

      // Update or Create purchase draft for admin review
      const payload = {
        invoiceNo:         formData.invoiceNo || "INV-1",
        invoiceDate:       new Date(formData.invoiceDate).toISOString(),
        portal:            "pharmacy",
        supplierName:      resolvedSupplier,
        supplierId:        sup?._id || undefined,
        companyId:         formData.companyId || undefined,
        items:             computedItems,
        invoiceTaxes:      computedInvTaxes,
        grossTotal,
        totalLineTaxes,
        totalInvoiceTaxes,
        netTotal,
        submittedBy:       "Pharmacy User", // TODO: Get from user context
        notes:             "", // TODO: Add notes field if needed
      };

      if (editingDraftId) {
        await pharmacyPurchaseDraftsAPI.update(editingDraftId, payload);
        showToast(`Purchase draft updated — ${invoiceItems.length} item(s)`);
      } else {
        await pharmacyPurchaseDraftsAPI.create(payload);
        showToast(`Purchase draft submitted for review — ${invoiceItems.length} item(s)`);
      }

      // If this was resumed from a held invoice, delete the held invoice
      if (resumedInvoiceId) {
        try {
          await holdInvoicesAPI.delete(resumedInvoiceId);
          console.log("Held invoice deleted after submission:", resumedInvoiceId);
        } catch (deleteErr) {
          console.error("Error deleting held invoice after submission:", deleteErr);
        }
      }

      setTimeout(() => navigate("/pharmacy/medicines"), 1000);
    } catch (err) {
      showToast(err.message || "Error submitting purchase draft");
    } finally {
      setSaving(false);
    }
  };

  const filteredCompanies = useMemo(() => {
    if (!supplierSelection) return companies;
    const selectedSup = suppliers.find(s => s.name === supplierSelection);
    if (!selectedSup?.companyIds?.length) return companies;
    
    return companies.filter(c => selectedSup.companyIds.includes(c._id));
  }, [supplierSelection, suppliers, companies]);

  // Auto-select supplier's associated company when supplier changes
  useEffect(() => {
    if (supplierSelection) {
      const selectedSup = suppliers.find(s => s.name === supplierSelection);
      if (selectedSup?.companyIds?.length > 0) {
        // Find the first associated company that exists in our companies list
        const targetCompany = companies.find(c => selectedSup.companyIds.includes(c._id));
        
        if (targetCompany) {
          setFormData(prev => ({ ...prev, companyId: targetCompany._id }));
        }
      }
    } else {
      // Clear company when no supplier selected
      setFormData(prev => ({ ...prev, companyId: "" }));
    }
  }, [supplierSelection, suppliers, companies]);

  // ── Invoice summary aggregates ───────────────────────────────────────────
  const summaryAgg = invoiceItems.reduce(
    (acc, item) => {
      const subtotal = (item.qtyPacks || 0) * (item.buyPerPack || 0);
      // Only calculate line tax, no default discount
      const tax = item.lineTaxType === "%"
        ? subtotal * ((item.lineTaxValue || 0) / 100)
        : (item.lineTaxValue || 0);
      acc.grossTotal += subtotal;
      acc.totalLineTaxes += tax;
      return acc;
    },
    { grossTotal: 0, totalLineTaxes: 0 }
  );
  const netBeforeInvTax = summaryAgg.grossTotal + summaryAgg.totalLineTaxes;
  const totalInvoiceTaxes = invoiceTaxes.reduce((sum, t) => {
    const base = t.applyOn === "net" ? netBeforeInvTax : summaryAgg.grossTotal;
    const amt = t.type === "%" ? base * ((Number(t.value) || 0) / 100) : (Number(t.value) || 0);
    return sum + amt;
  }, 0);
  const grandTotal = netBeforeInvTax + totalInvoiceTaxes;

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}

      {/* Add New Category/Sub-Category/Medicine Modal */}
      {addOptionDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-bold text-white">{addOptionDialog.title}</h3>
                {addOptionDialog.kind === "sub" && (
                  <p className="text-xs text-white/80 mt-0.5">
                    Main Category: {formatCatalogLabel(addOptionDialog.mainCategory)}
                  </p>
                )}
                {addOptionDialog.kind === "med" && (
                  <p className="text-xs text-white/80 mt-0.5">
                    {formatCatalogLabel(addOptionDialog.mainCategory)} / {formatCatalogLabel(addOptionDialog.subCategory)}
                  </p>
                )}
              </div>
              <button onClick={() => setAddOptionDialog(null)} className="text-white hover:bg-white/20 p-2 rounded-lg">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const val = String(addOptionDialog.value || "").trim();
                if (!val) return;

                if (addOptionDialog.kind === "main") {
                  addCustomMainCategory(val);
                } else if (addOptionDialog.kind === "sub") {
                  addCustomSubCategory(addOptionDialog.mainCategory, val);
                } else if (addOptionDialog.kind === "med") {
                  addCustomMedicine(addOptionDialog.mainCategory, addOptionDialog.subCategory, val);
                }

                setAddOptionDialog(null);
              }}
              className="p-5 space-y-4 overflow-y-auto flex-1"
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {addOptionDialog.kind === "main" && "Category Name"}
                  {addOptionDialog.kind === "sub" && "Sub-Category Name"}
                  {addOptionDialog.kind === "med" && "Medicine Name"}
                </label>
                <input
                  type="text"
                  value={addOptionDialog.value}
                  onChange={(e) =>
                    setAddOptionDialog((p) => ({ ...p, value: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter name"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAddOptionDialog(null)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!String(addOptionDialog.value || "").trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 font-semibold"
                >
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/pharmacy/medicines")}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
          >
            <FiArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              {editingDraftId ? "Edit Purchase Draft" : "Add New Invoice"}
            </h1>
            <p className="text-slate-500 mt-1">
              {editingDraftId ? `Editing draft: ${formData.invoiceNo}` : "Record a new purchase invoice"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Hold Invoice Buttons */}
          <button
            type="button"
            onClick={handleHoldInvoice}
            disabled={invoiceItems.length === 0 || !invoiceItems.some(i => i.medicineName?.trim())}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold disabled:opacity-50 flex items-center gap-2 text-sm"
            title="Hold current invoice (F6)"
          >
            <FiPause className="w-4 h-4" />
            Hold Invoice
          </button>
          <button
            type="button"
            onClick={() => {
              fetchHeldInvoices();
              setShowHeldInvoicesModal(true);
            }}
            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-semibold flex items-center gap-2 text-sm"
            title="View held invoices (F7)"
          >
            <FiClock className="w-4 h-4" />
            Held Invoices
          </button>

          {grandTotal > 0 && (
            <>
              <div className="w-px h-8 bg-slate-300 mx-1" />
              <button
                type="submit"
                form="invoice-form"
                disabled={saving}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold disabled:opacity-50 flex items-center gap-2 text-sm"
              >
                {saving && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {editingDraftId ? "Update Draft" : "Submit for Review"}
              </button>
              <div className="text-right">
                <p className="text-xs text-slate-500">Net Total</p>
                <p className="text-2xl font-bold text-purple-700">
                  PKR {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left: form */}
        <form onSubmit={handleSubmit} id="invoice-form" className="flex-1 min-w-0 space-y-4">
        {/* Invoice Details */}
        <div className="bg-white rounded-xl border border-blue-200 bg-blue-50/40 p-5">
          <h4 className="text-sm font-semibold text-blue-700 mb-4 flex items-center gap-2">
            <FiPackage className="w-4 h-4" /> Invoice Details
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Supplier */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Supplier</label>
              <div className="flex gap-2">
                <select
                  value={supplierSelection}
                  onChange={(e) => {
                    const selectedName = e.target.value;
                    setSupplierSelection(selectedName);
                    setFormData((p) => ({ ...p, supplierName: selectedName }));
                  }}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white text-sm"
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((s) => (
                    <option key={s._id} value={s.name}>{s.name}</option>
                  ))}
                </select>
                <button type="button" onClick={() => setShowAddSupplierModal(true)}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs whitespace-nowrap flex items-center gap-1">
                  <FiPlus className="w-3 h-3" /> Add
                </button>
              </div>
            </div>

            {/* Company */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Company</label>
              <div className="flex gap-2">
                <select
                  value={formData.companyId}
                  onChange={(e) => setFormData((p) => ({ ...p, companyId: e.target.value }))}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white text-sm"
                >
                  <option value="">None</option>
                  {filteredCompanies.map((c) => (
                    <option key={c._id} value={c._id}>{c.companyName}</option>
                  ))}
                </select>
                <button type="button" onClick={() => setShowAddCompanyModal(true)}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs whitespace-nowrap flex items-center gap-1">
                  <FiPlus className="w-3 h-3" /> Add
                </button>
              </div>
            </div>

            {/* Invoice No */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Invoice No</label>
              <input type="text" value={formData.invoiceNo}
                onChange={(e) => setFormData((p) => ({ ...p, invoiceNo: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white text-sm"
                placeholder="INV-1" />
            </div>

            {/* Invoice Date */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Date *</label>
              <input type="date" required value={formData.invoiceDate}
                onChange={(e) => setFormData((p) => ({ ...p, invoiceDate: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white text-sm" />
            </div>
          </div>
        </div>

        {/* Invoice Items */}
        {invoiceItems.map((item, idx) => (
          <InvoiceItemCard
            key={item.id}
            item={item}
            idx={idx}
            canRemove={invoiceItems.length > 1}
            onUpdate={(patch) =>
              setInvoiceItems((prev) =>
                prev.map((it) => (it.id === item.id ? { ...it, ...patch } : it))
              )
            }
            onAddMainCategory={() =>
              setAddOptionDialog({ kind: "main", title: "Add New Category", value: "" })
            }
            onAddSubCategory={() => {
              if (!item.mainCategory) {
                showToast("Select a main category first");
                return;
              }
              setAddOptionDialog({
                kind: "sub",
                title: "Add New Sub-Category",
                value: "",
                mainCategory: item.mainCategory,
              });
            }}
            onAddMedicine={() => {
              if (!item.mainCategory || !item.subCategory) {
                showToast("Select a main category and sub-category first");
                return;
              }
              setAddOptionDialog({
                kind: "med",
                title: "Add New Medicine",
                value: "",
                mainCategory: item.mainCategory,
                subCategory: item.subCategory,
              });
            }}
            onManageMainCategory={() => setManageDialog({ kind: "main" })}
            onManageSubCategory={() => setManageDialog({ kind: "sub", mainCategory: item.mainCategory })}
            onManageMedicine={() =>
              setManageDialog({ kind: "med", mainCategory: item.mainCategory, subCategory: item.subCategory })
            }
            onRemove={() =>
              setInvoiceItems((prev) => prev.filter((it) => it.id !== item.id))
            }
            onConfirm={(cfg) => setConfirmDialog(cfg)}
          />
        ))}

        {/* Add Item */}
        <button type="button"
          onClick={() => setInvoiceItems((prev) => [...prev, createEmptyItem()])}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-purple-300 text-purple-600 rounded-xl hover:bg-purple-50 text-sm font-medium transition-colors bg-white">
          <FiPlus className="w-4 h-4" /> Add Another Item
        </button>

        {/* Grand Total bar — removed, replaced by summary card */}

        </form>

        {/* Right: Invoice-Level Taxes + Summary Card */}
        <div className="w-full lg:w-72 shrink-0 sticky top-4 space-y-3">

          {/* Invoice-Level Taxes card */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setTaxesCollapsed((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-3.5 text-left"
            >
              <span className="text-sm font-bold text-slate-800">
                Invoice-Level Taxes
                {invoiceTaxes.length > 0 && (
                  <span className="ml-2 text-purple-600">({invoiceTaxes.length})</span>
                )}
              </span>
              <span className="text-slate-400 text-xs">{taxesCollapsed ? "▼" : "▲"}</span>
            </button>

            {!taxesCollapsed && (
              <div className="px-4 pb-4 space-y-3 border-t border-slate-100">
                {invoiceTaxes.length === 0 && (
                  <p className="text-xs text-slate-400 pt-3 text-center">No invoice taxes added</p>
                )}
                {invoiceTaxes.map((tax) => (
                  <div key={tax.id} className="pt-3 space-y-2">
                    {/* Tax name */}
                    <input
                      type="text"
                      value={tax.name}
                      onChange={(e) =>
                        setInvoiceTaxes((prev) =>
                          prev.map((t) => t.id === tax.id ? { ...t, name: e.target.value } : t)
                        )
                      }
                      placeholder="Tax name (e.g., GST)"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    {/* Controls row — wraps on small screens */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Type */}
                      <select
                        value={tax.type}
                        onChange={(e) =>
                          setInvoiceTaxes((prev) =>
                            prev.map((t) => t.id === tax.id ? { ...t, type: e.target.value } : t)
                          )
                        }
                        className="w-20 px-2 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="%">%</option>
                        <option value="PKR">PKR</option>
                      </select>
                      {/* Value */}
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={tax.value}
                        onChange={(e) =>
                          setInvoiceTaxes((prev) =>
                            prev.map((t) => t.id === tax.id ? { ...t, value: e.target.value } : t)
                          )
                        }
                        placeholder="Value"
                        className="flex-1 min-w-[70px] px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      {/* Apply On */}
                      <select
                        value={tax.applyOn}
                        onChange={(e) =>
                          setInvoiceTaxes((prev) =>
                            prev.map((t) => t.id === tax.id ? { ...t, applyOn: e.target.value } : t)
                          )
                        }
                        className="flex-1 min-w-[90px] px-2 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="gross">On Gross</option>
                        <option value="net">On Net</option>
                      </select>
                      {/* Delete icon */}
                      <button
                        type="button"
                        onClick={() =>
                          setInvoiceTaxes((prev) => prev.filter((t) => t.id !== tax.id))
                        }
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                        title="Remove tax"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() =>
                    setInvoiceTaxes((prev) => [
                      ...prev,
                      { id: Date.now(), name: "", type: "%", value: "", applyOn: "gross" },
                    ])
                  }
                  className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-dashed border-purple-300 text-purple-600 rounded-lg text-xs font-medium hover:bg-purple-50 transition-colors"
                >
                  <FiPlus className="w-3.5 h-3.5" /> Add Invoice Tax
                </button>
              </div>
            )}
          </div>

          {/* Invoice Summary card */}
          <div className="rounded-2xl border border-green-200 bg-green-50/70 p-5 space-y-3">
            <h4 className="text-sm font-bold text-green-800 mb-1">Invoice Summary</h4>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Gross Total</span>
                <span className="font-medium text-slate-800">
                  PKR {summaryAgg.grossTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Line Taxes</span>
                <span className="font-medium text-slate-800">
                  + PKR {summaryAgg.totalLineTaxes.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Invoice Taxes</span>
                <span className="font-medium text-slate-800">
                  + PKR {totalInvoiceTaxes.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="border-t border-green-300 pt-3 flex justify-between items-center">
              <span className="text-base font-bold text-green-900">Net Total</span>
              <span className="text-xl font-bold text-green-700">
                PKR {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Add Supplier Modal */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-bold text-white">Add New Supplier</h3>
              <button onClick={() => setShowAddSupplierModal(false)} className="text-white hover:bg-white/20 p-2 rounded-lg">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddSupplier} className="p-5 space-y-4 overflow-y-auto flex-1">
              {[
                { label: "Supplier Name *", key: "name", required: true, placeholder: "Enter supplier name" },
                { label: "Phone Number", key: "phone", placeholder: "Enter phone number" },
                { label: "Tax ID", key: "taxId", placeholder: "Enter tax ID" },
                { label: "Address", key: "address", placeholder: "Enter address" },
              ].map(({ label, key, required, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                  <input type="text" required={required} value={newSupplierData[key]}
                    onChange={(e) => setNewSupplierData((p) => ({ ...p, [key]: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={placeholder} />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Select Company</label>
                <select value={newSupplierData.companyId}
                  onChange={(e) => setNewSupplierData((p) => ({ ...p, companyId: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">None</option>
                  {companies.map((c) => <option key={c._id} value={c._id}>{c.companyName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <div className="flex gap-3">
                  {["active", "inactive"].map((s) => (
                    <button key={s} type="button"
                      onClick={() => setNewSupplierData((p) => ({ ...p, status: s }))}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium capitalize transition-colors ${
                        newSupplierData.status === s
                          ? s === "active" ? "bg-green-600 border-green-600 text-white" : "bg-red-500 border-red-500 text-white"
                          : "border-slate-300 text-slate-600 hover:bg-slate-50"
                      }`}>{s}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddSupplierModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={savingSupplier || !newSupplierData.name.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">
                  {savingSupplier && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                  Add Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Company Modal */}
      {showAddCompanyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Add New Company</h3>
              <button onClick={() => setShowAddCompanyModal(false)} className="text-white hover:bg-white/20 p-2 rounded-lg">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddCompany} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Company Name *</label>
                <input type="text" required autoFocus value={newCompanyData.companyName}
                  onChange={(e) => setNewCompanyData((p) => ({ ...p, companyName: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Enter company name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <div className="flex gap-3">
                  {["active", "inactive"].map((s) => (
                    <button key={s} type="button"
                      onClick={() => setNewCompanyData((p) => ({ ...p, status: s }))}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium capitalize transition-colors ${
                        newCompanyData.status === s
                          ? s === "active" ? "bg-green-600 border-green-600 text-white" : "bg-red-500 border-red-500 text-white"
                          : "border-slate-300 text-slate-600 hover:bg-slate-50"
                      }`}>{s}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddCompanyModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={savingCompany || !newCompanyData.companyName.trim()}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">
                  {savingCompany && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                  Add Company
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className={`px-6 py-4 ${confirmDialog.variant === "danger" ? "bg-gradient-to-r from-red-500 to-red-600" : "bg-gradient-to-r from-emerald-500 to-emerald-600"}`}>
              <div className="flex items-center gap-3 text-white">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <FiAlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">{confirmDialog.title}</h3>
                  {confirmDialog.message && <p className="text-sm text-white/80">{confirmDialog.message}</p>}
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="flex gap-3">
                <button type="button" onClick={() => setConfirmDialog(null)}
                  className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold">
                  {confirmDialog.cancelLabel || "Cancel"}
                </button>
                <button type="button"
                  onClick={() => { confirmDialog.onConfirm?.(); setConfirmDialog(null); }}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-semibold">
                  {confirmDialog.confirmLabel || "Confirm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage Categories/Subcategories/Medicines */}
      {manageDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-bold text-white">
                {manageDialog.kind === "main" && "Manage Categories"}
                {manageDialog.kind === "sub" && "Manage Sub-Categories"}
                {manageDialog.kind === "med" && "Manage Medicines"}
              </h3>
              <button onClick={() => setManageDialog(null)} className="text-white hover:bg-white/20 p-2 rounded-lg">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {manageDialog.kind === "main" && (() => {
                const hidden = getHiddenMainCategories();
                const custom = getCustomMainCategories();
                const all = [...new Set([...catalogMainCategories, ...custom])];
                const visible = all.filter((x) => !hidden.includes(x));
                return (
                  <div className="space-y-4">
                    <div>
                      <div className="text-sm font-semibold text-slate-800 mb-2">Visible</div>
                      <div className="space-y-2">
                        {visible.map((x) => (
                          <div key={x} className="flex items-center justify-between gap-3 border border-slate-200 rounded-lg px-3 py-2">
                            <div className="text-sm text-slate-800">{formatCatalogLabel(x)}</div>
                            <div className="flex items-center gap-2">
                              <button type="button" onClick={() => hideMainCategory(x)} className="px-3 py-1 text-xs border border-slate-300 rounded-lg hover:bg-slate-100">Hide</button>
                              {custom.includes(x) && (
                                <button type="button" onClick={() => removeCustomMainCategory(x)} className="px-3 py-1 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50">Remove</button>
                              )}
                            </div>
                          </div>
                        ))}
                        {visible.length === 0 && <div className="text-xs text-slate-500">No visible categories</div>}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-800 mb-2">Hidden</div>
                      <div className="space-y-2">
                        {hidden.map((x) => (
                          <div key={x} className="flex items-center justify-between gap-3 border border-slate-200 rounded-lg px-3 py-2">
                            <div className="text-sm text-slate-800">{formatCatalogLabel(x)}</div>
                            <button type="button" onClick={() => unhideMainCategory(x)} className="px-3 py-1 text-xs border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-50">Unhide</button>
                          </div>
                        ))}
                        {hidden.length === 0 && <div className="text-xs text-slate-500">No hidden categories</div>}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {manageDialog.kind === "sub" && (() => {
                const main = manageDialog.mainCategory;
                if (!main) return <div className="text-sm text-slate-600">Select a main category first.</div>;
                const hidden = getHiddenSubCategories(main);
                const custom = getCustomSubCategories(main);
                const catalog = getSubCategories(main);
                const all = [...new Set([...catalog, ...custom])];
                const visible = all.filter((x) => !hidden.includes(x));
                return (
                  <div className="space-y-4">
                    <div className="text-xs text-slate-500">Main Category: <span className="font-medium text-slate-700">{formatCatalogLabel(main)}</span></div>
                    <div>
                      <div className="text-sm font-semibold text-slate-800 mb-2">Visible</div>
                      <div className="space-y-2">
                        {visible.map((x) => (
                          <div key={x} className="flex items-center justify-between gap-3 border border-slate-200 rounded-lg px-3 py-2">
                            <div className="text-sm text-slate-800">{formatCatalogLabel(x)}</div>
                            <div className="flex items-center gap-2">
                              <button type="button" onClick={() => hideSubCategory(main, x)} className="px-3 py-1 text-xs border border-slate-300 rounded-lg hover:bg-slate-100">Hide</button>
                              {custom.includes(x) && (
                                <button type="button" onClick={() => removeCustomSubCategory(main, x)} className="px-3 py-1 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50">Remove</button>
                              )}
                            </div>
                          </div>
                        ))}
                        {visible.length === 0 && <div className="text-xs text-slate-500">No visible sub-categories</div>}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-800 mb-2">Hidden</div>
                      <div className="space-y-2">
                        {hidden.map((x) => (
                          <div key={x} className="flex items-center justify-between gap-3 border border-slate-200 rounded-lg px-3 py-2">
                            <div className="text-sm text-slate-800">{formatCatalogLabel(x)}</div>
                            <button type="button" onClick={() => unhideSubCategory(main, x)} className="px-3 py-1 text-xs border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-50">Unhide</button>
                          </div>
                        ))}
                        {hidden.length === 0 && <div className="text-xs text-slate-500">No hidden sub-categories</div>}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {manageDialog.kind === "med" && (() => {
                const main = manageDialog.mainCategory;
                const sub = manageDialog.subCategory;
                if (!main || !sub) return <div className="text-sm text-slate-600">Select a main category and sub-category first.</div>;
                const hidden = getHiddenMedicines(main, sub);
                const custom = getCustomMedicines(main, sub);
                const catalog = getCatalogMedicines(main, sub);
                const all = [...new Set([...catalog, ...custom])];
                const visible = all.filter((x) => !hidden.includes(x));
                return (
                  <div className="space-y-4">
                    <div className="text-xs text-slate-500">
                      Main Category: <span className="font-medium text-slate-700">{formatCatalogLabel(main)}</span>
                      <span className="mx-2">/</span>
                      Subcategory: <span className="font-medium text-slate-700">{formatCatalogLabel(sub)}</span>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-800 mb-2">Visible</div>
                      <div className="space-y-2">
                        {visible.map((x) => (
                          <div key={x} className="flex items-center justify-between gap-3 border border-slate-200 rounded-lg px-3 py-2">
                            <div className="text-sm text-slate-800">{x}</div>
                            <div className="flex items-center gap-2">
                              <button type="button" onClick={() => hideMedicineName(main, sub, x)} className="px-3 py-1 text-xs border border-slate-300 rounded-lg hover:bg-slate-100">Hide</button>
                              {custom.includes(x) && (
                                <button type="button" onClick={() => removeCustomMedicine(main, sub, x)} className="px-3 py-1 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50">Remove</button>
                              )}
                            </div>
                          </div>
                        ))}
                        {visible.length === 0 && <div className="text-xs text-slate-500">No visible medicines</div>}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-800 mb-2">Hidden</div>
                      <div className="space-y-2">
                        {hidden.map((x) => (
                          <div key={x} className="flex items-center justify-between gap-3 border border-slate-200 rounded-lg px-3 py-2">
                            <div className="text-sm text-slate-800">{x}</div>
                            <button type="button" onClick={() => unhideMedicineName(main, sub, x)} className="px-3 py-1 text-xs border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-50">Unhide</button>
                          </div>
                        ))}
                        {hidden.length === 0 && <div className="text-xs text-slate-500">No hidden medicines</div>}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="p-5 pt-0">
              <button type="button" onClick={() => setManageDialog(null)} className="w-full px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Held Invoices Modal */}
      {showHeldInvoicesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FiClock className="w-5 h-5" />
                  Held Invoices
                </h3>
                <p className="text-sm text-white/80 mt-0.5">
                  {heldInvoices.length} invoice(s) on hold
                </p>
              </div>
              <button onClick={() => setShowHeldInvoicesModal(false)} className="text-white hover:bg-white/20 p-2 rounded-lg">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {isLoadingHeldInvoices ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                </div>
              ) : heldInvoices.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FiClock className="w-8 h-8 text-slate-400" />
                  </div>
                  <h4 className="text-lg font-semibold text-slate-700 mb-1">No Held Invoices</h4>
                  <p className="text-sm text-slate-500">There are no invoices currently on hold.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {heldInvoices.map((invoice) => (
                    <div
                      key={invoice._id}
                      className={`border rounded-xl p-4 transition-colors ${
                        resumedInvoiceId === invoice._id
                          ? 'border-amber-400 bg-amber-50'
                          : 'border-slate-200 hover:border-indigo-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-bold text-slate-800">
                              {invoice.holdId}
                            </span>
                            {resumedInvoiceId === invoice._id && (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 space-y-0.5">
                            <p>Invoice #: {invoice.invoiceNo}</p>
                            <p>Supplier: {invoice.supplierName || 'N/A'}</p>
                            <p>Items: {invoice.items?.length || 0} · Total: PKR {(invoice.netTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            <p>Held by: {invoice.heldBy || 'Unknown'} · {new Date(invoice.createdAt).toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => resumeHeldInvoice(invoice)}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg flex items-center gap-1.5"
                          >
                            <FiPlay className="w-3.5 h-3.5" />
                            Resume
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (window.confirm('Are you sure you want to delete this held invoice?')) {
                                try {
                                  await holdInvoicesAPI.delete(invoice._id);
                                  showToast('Held invoice deleted');
                                  fetchHeldInvoices();
                                  if (resumedInvoiceId === invoice._id) {
                                    setResumedInvoiceId(null);
                                  }
                                } catch (error) {
                                  showToast('Error deleting held invoice');
                                }
                              }
                            }}
                            className="px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium rounded-lg flex items-center gap-1.5"
                          >
                            <FiTrash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setShowHeldInvoicesModal(false)}
                className="w-full px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── InvoiceItemCard ─────────────────────────────────────────────────────────
function InvoiceItemCard({ item, idx, canRemove, onUpdate, onRemove, onAddMainCategory, onAddSubCategory, onAddMedicine, onManageMainCategory, onManageSubCategory, onManageMedicine }) {
  const uPack = item.unitsPerPack || 1;
  const subtotal = (item.qtyPacks || 0) * (item.buyPerPack || 0);
  const discount = subtotal * ((item.defaultDiscount || 0) / 100);
  // Only calculate line tax on subtotal, not after discount
  const tax = item.lineTaxType === "%" ? subtotal * ((item.lineTaxValue || 0) / 100) : (item.lineTaxValue || 0);
  const lineTotal = subtotal + tax;
  const computedTotalItems = (item.qtyPacks || 0) * uPack;
  const totalItems = item.totalItems != null ? Number(item.totalItems) : computedTotalItems;

  const mainCatOptions = (() => {
    const hidden = getHiddenMainCategories();
    const custom = getCustomMainCategories();
    return [...new Set([...catalogMainCategories, ...custom])].filter((mc) => !hidden.includes(mc));
  })();

  const subCatOptions = (() => {
    if (!item.mainCategory) return [];
    const hidden = getHiddenSubCategories(item.mainCategory);
    const catalog = getSubCategories(item.mainCategory);
    const custom = getCustomSubCategories(item.mainCategory);
    return [...new Set([...catalog, ...custom])].filter((sc) => !hidden.includes(sc));
  })();

  const medOptions = (() => {
    if (!item.mainCategory || !item.subCategory) return [];
    const hidden = getHiddenMedicines(item.mainCategory, item.subCategory);
    const catalog = getCatalogMedicines(item.mainCategory, item.subCategory);
    const custom = getCustomMedicines(item.mainCategory, item.subCategory);
    return [...new Set([...catalog, ...custom])].filter((m) => !hidden.includes(m));
  })();

  const fmt = (n) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-bold text-purple-700 shrink-0">Item #{idx + 1}</span>
          {item.medicineName && (
            <span className="text-xs text-slate-500 truncate">
              {item.medicineName}
              {totalItems > 0 && <> · {totalItems} units</>}
            </span>
          )}
          {lineTotal > 0 && (
            <span className="text-xs font-semibold text-purple-700 shrink-0">
              PKR {fmt(lineTotal)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={() => onUpdate({ collapsed: !item.collapsed })}
            className="px-3 py-1 text-xs border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
            {item.collapsed ? "Expand" : "Collapse"}
          </button>
          {canRemove && (
            <button type="button" onClick={onRemove}
              className="px-3 py-1 text-xs border border-red-200 rounded-lg hover:bg-red-50 text-red-600 transition-colors">
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {!item.collapsed && (
        <div className="p-4">
          {/* 2-col: Category + Medicine */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Main Category *</label>
              <select value={item.mainCategory}
                  onChange={(e) => {
                  const main = e.target.value;
                  const subs = (() => {
                    if (!main) return [];
                    const hidden = getHiddenSubCategories(main);
                    const catalog = getSubCategories(main);
                    const custom = getCustomSubCategories(main);
                    return [...new Set([...catalog, ...custom])].filter((sc) => !hidden.includes(sc));
                  })();
                  const sub = subs[0] || "";
                  const meds = sub ? (() => {
                    const hidden = getHiddenMedicines(main, sub);
                    const catalog = getCatalogMedicines(main, sub);
                    const custom = getCustomMedicines(main, sub);
                    return [...new Set([...catalog, ...custom])].filter((m) => !hidden.includes(m));
                  })() : [];
                  onUpdate({ mainCategory: main, subCategory: sub, category: sub || main, medicineName: meds[0] || "", unit: getCategoryUnit(main, sub), containerType: "" });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm bg-white">
                  <option value="">Select</option>
                  {mainCatOptions.map((mc) => <option key={mc} value={mc}>{formatCatalogLabel(mc)}</option>)}
              </select>
              <div className="mt-1 flex items-center justify-between text-xs">
                <button type="button" onClick={onAddMainCategory} className="text-emerald-700 hover:underline">+ Add New Category</button>
                <button type="button" onClick={onManageMainCategory} className="text-purple-700 hover:underline">Manage Categories</button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Subcategory *</label>
              <select value={item.subCategory} disabled={!item.mainCategory}
                  onChange={(e) => {
                  const sub = e.target.value;
                  const main = item.mainCategory;
                  const meds = sub ? (() => {
                    const hidden = getHiddenMedicines(main, sub);
                    const catalog = getCatalogMedicines(main, sub);
                    const custom = getCustomMedicines(main, sub);
                    return [...new Set([...catalog, ...custom])].filter((m) => !hidden.includes(m));
                  })() : [];
                  onUpdate({ subCategory: sub, category: sub || main, medicineName: meds[0] || "", unit: getCategoryUnit(main, sub) });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm bg-white disabled:bg-slate-100">
                  <option value="">Select</option>
                  {subCatOptions.map((sc) => <option key={sc} value={sc}>{formatCatalogLabel(sc)}</option>)}
              </select>
              <div className="mt-1 flex items-center justify-between text-xs">
                <button type="button" onClick={onAddSubCategory} disabled={!item.mainCategory} className="text-emerald-700 hover:underline disabled:opacity-50">+ Add New Sub-Category</button>
                <button type="button" onClick={onManageSubCategory} disabled={!item.mainCategory} className="text-purple-700 hover:underline disabled:opacity-50">Manage Sub-Categories</button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Medicine *</label>
              <select value={item.medicineName} disabled={!item.subCategory}
                  onChange={(e) => onUpdate({ medicineName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm bg-white disabled:bg-slate-100">
                  <option value="">Select</option>
                  {medOptions.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <div className="mt-1 flex items-center justify-between text-xs">
                <button type="button" onClick={onAddMedicine} disabled={!item.subCategory} className="text-emerald-700 hover:underline disabled:opacity-50">+ Add New Medicine</button>
                <button type="button" onClick={onManageMedicine} disabled={!item.subCategory} className="text-purple-700 hover:underline disabled:opacity-50">Manage Medicines</button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Batch Number <span className="text-slate-400 text-xs">(Optional)</span>
              </label>
              <input type="text" value={item.batchNo}
                onChange={(e) => onUpdate({ batchNo: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                placeholder="Auto or manual batch reference" />
            </div>
          </div>

          <div className="border-t border-slate-100 my-3" />

          {/* 4-col fields */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Generic Name</label>
              <input type="text" value={item.genericName}
                onChange={(e) => onUpdate({ genericName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                placeholder="e.g. Paracetamol" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Barcode</label>
              <input type="text" value={item.barcode}
                onChange={(e) => onUpdate({ barcode: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                placeholder="Scan or type" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Expiry Date</label>
              <input type="date" value={item.expiryDate}
                onChange={(e) => onUpdate({ expiryDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
            </div>
            {[
              { label: "Qty (Packs) *", key: "qtyPacks", required: true },
              { label: "Units/Pack *", key: "unitsPerPack", required: true, min: 1 },
              { label: "Buy/Pack *", key: "buyPerPack", required: true, step: "0.01" },
              { label: "Sale/Pack *", key: "salePerPack", required: true, step: "0.01" },
            ].map(({ label, key, required, min = 0, step }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                <input type="number" required={required} min={min} step={step} value={item[key]}
                  onChange={(e) => onUpdate({ [key]: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
              </div>
            ))}
            {[
              { label: "Buy/Unit", value: uPack > 0 ? ((item.buyPerPack || 0) / uPack).toFixed(2) : "0.00", readOnly: true },
              { label: "Sale/Unit", value: uPack > 0 ? ((item.salePerPack || 0) / uPack).toFixed(2) : "0.00", readOnly: true },
            ].map(({ label, value, readOnly }) => (
              <div key={label}>
                <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                <input type="text" readOnly={readOnly} value={value}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-100 text-sm text-slate-600 cursor-not-allowed" />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Total Items</label>
              <input type="number" min="0" value={totalItems}
                onChange={(e) => onUpdate({ totalItems: Number(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Min Stock</label>
              <input type="number" min="0" value={item.minStock}
                onChange={(e) => onUpdate({ minStock: Number(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Default Discount (%)</label>
              <input type="number" min="0" max="100" step="0.01" value={item.defaultDiscount}
                onChange={(e) => onUpdate({ defaultDiscount: Number(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                placeholder="0" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Line Tax <span className="text-slate-400">(Optional)</span>
              </label>
              <div className="flex gap-2">
                <div className="flex rounded-lg border border-slate-300 overflow-hidden shrink-0">
                  {["%", "PKR"].map((t) => (
                    <button key={t} type="button" onClick={() => onUpdate({ lineTaxType: t })}
                      className={`px-3 py-2 text-xs font-semibold transition-colors ${
                        item.lineTaxType === t ? "bg-purple-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                      }`}>{t}</button>
                  ))}
                </div>
                <input type="number" min="0" step="0.01" value={item.lineTaxValue}
                  onChange={(e) => onUpdate({ lineTaxValue: Number(e.target.value) || 0 })}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                  placeholder={item.lineTaxType === "%" ? "e.g. 17" : "e.g. 50"} />
              </div>
            </div>

            {/* Line Total */}
            <div className="col-span-4 mt-1">
              <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-xl px-5 py-3">
                <div className="flex items-center gap-4 flex-wrap text-xs text-slate-500">
                  <span>Subtotal: <span className="font-medium text-slate-700">PKR {fmt(subtotal)}</span></span>
                  {tax > 0 && <span>Tax: <span className="font-medium text-slate-700">+ PKR {fmt(tax)}</span></span>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold text-slate-700">Line Total:</span>
                  <span className="text-lg font-bold text-purple-700">PKR {fmt(lineTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
