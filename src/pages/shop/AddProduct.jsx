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
  productsAPI,
  petShopSuppliersAPI,
  petShopCompaniesAPI,
  holdInvoicesAPI,
  petshopPharmacyPurchaseDraftsAPI,
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
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
};
const lsSet = (key, val) => {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
};

const getHiddenMainCategories = () => ls("shop_hidden_main_categories", []);
const getCustomMainCategories = () => ls("shop_custom_main_categories", []);
const getHiddenSubCategories = (main) =>
  (ls("shop_hidden_subcategories", {}))[main] || [];
const getCustomSubCategories = (main) =>
  (ls("shop_custom_subcategories", {}))[main] || [];
const getHiddenMedicines = (main, sub) =>
  (ls("shop_hidden_medicines", {}))[`${main}::${sub}`] || [];
const getCustomMedicines = (main, sub) =>
  (ls("shop_custom_medicines", {}))[`${main}::${sub}`] || [];

// ─── Empty item factory ──────────────────────────────────────────────────────
const createEmptyItem = () => {
  return {
    id: Date.now() + Math.random(),
    collapsed: false,
    mainCategory: "",
    subCategory: "",
    category: "",
    medicineName: "",
    batchNo: "",
    genericName: "",
    barcode: "",
    expiryDate: "",
    qtyPacks: 0,
    unitsPerPack: 1,
    buyPerPack: 0,
    salePerPack: 0,
    minStock: 0,
    defaultDiscount: 0,
    lineTaxType: "%",
    lineTaxValue: 0,
    unit: "pieces",
    containerType: "",
  };
};

export default function AddProduct() {
  const navigate = useNavigate();
  const location = useLocation();

  const [suppliers, setSuppliers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [supplierSelection, setSupplierSelection] = useState("");
  const [invoiceItems, setInvoiceItems] = useState([createEmptyItem()]);
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [editingDraftId, setEditingDraftId] = useState(null);

  const [formData, setFormData] = useState({
    supplierName: "",
    companyId: "",
    invoiceNo: "INV-1",
    invoiceDate: new Date().toISOString().split("T")[0],
  });

  // ── Add Supplier modal ───────────────────────────────────────────────────
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [newSupplierData, setNewSupplierData] = useState({
    name: "",
    companyId: "",
    phone: "",
    address: "",
    taxId: "",
    status: "active",
  });
  const [savingSupplier, setSavingSupplier] = useState(false);

  // ── Add Company modal ────────────────────────────────────────────────────
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [newCompanyData, setNewCompanyData] = useState({
    companyName: "",
    status: "active",
  });
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

  // ── Load draft for editing if navigated with draftId ─────────────────────
  useEffect(() => {
    const draftId = location.state?.draftId;
    if (!draftId) return;
    setEditingDraftId(draftId);
    petshopPharmacyPurchaseDraftsAPI.getById(draftId).then((res) => {
      const draft = res?.data;
      if (!draft) return;
      setFormData({
        supplierName: draft.supplierName || "",
        companyId: draft.companyId || "",
        invoiceNo: draft.invoiceNo || "INV-1",
        invoiceDate: draft.invoiceDate
          ? new Date(draft.invoiceDate).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
      });
      if (draft.supplierName) setSupplierSelection(draft.supplierName);
      setInvoiceItems(
        (draft.items || []).map((item, idx) => ({
          ...createEmptyItem(),
          id: Date.now() + idx + Math.random(),
          mainCategory: item.mainCategory || "",
          subCategory: item.subCategory || "",
          category: item.category || "",
          medicineName: item.medicineName || "",
          genericName: item.genericName || "",
          batchNo: item.batchNo || "",
          barcode: item.barcode || "",
          expiryDate: item.expiryDate
            ? new Date(item.expiryDate).toISOString().split("T")[0]
            : "",
          qtyPacks: item.qtyPacks || 0,
          unitsPerPack: item.unitsPerPack || 1,
          buyPerPack: item.buyPerPack || 0,
          salePerPack: item.salePerPack || 0,
          totalItems: item.totalItems != null ? item.totalItems : undefined,
          minStock: item.minStock || 0,
          defaultDiscount: item.defaultDiscount || 0,
          lineTaxType: item.lineTaxType || "%",
          lineTaxValue: item.lineTaxValue || 0,
          unit: item.unit || "pieces",
          containerType: item.containerType || "",
        }))
      );
      setInvoiceTaxes(
        (draft.invoiceTaxes || []).map((t, idx) => ({
          id: Date.now() + idx,
          name: t.name || "",
          type: t.type || "%",
          value: t.value || 0,
          applyOn: t.applyOn || "gross",
        }))
      );
      showToast("Draft loaded for editing");
    }).catch(() => showToast("Could not load draft"));
  }, [location.state?.draftId]);

  const fetchSuppliers = async () => {
    try {
      const res = await petShopSuppliersAPI.getAll("active");
      setSuppliers(
        (res.data || []).map((s) => {
          const rawCompanyIds = Array.isArray(s.companyIds) ? s.companyIds : [];
          const merged = [
            ...(rawCompanyIds || []),
            ...(s.companyId ? [s.companyId] : []),
          ].filter(Boolean);

          return {
            _id: s._id,
            name: s.name || s.supplierName || "",
            companyIds: [...new Set(merged.map((id) => String(id)))],
          };
        }),
      );
    } catch {}
  };

  const fetchCompanies = async () => {
    try {
      const res = await petShopCompaniesAPI.getAll("active");
      setCompanies(
        (res.data || []).map((c) => ({
          _id: c._id,
          companyName: c.companyName || c.name || "",
        })),
      );
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

    const hasValidItem = invoiceItems.some((i) => {
      return (i.medicineName || "").trim();
    });

    if (!hasValidItem) {
      showToast(
        "Please enter at least one item with Category and Medicine Name to hold",
      );
      return;
    }

    try {
      const sup = suppliers.find((s) => s.name === resolvedSupplier);

      const holdData = {
        invoiceNo: formData.invoiceNo || "INV-1",
        invoiceDate: new Date(formData.invoiceDate).toISOString(),
        supplierName: resolvedSupplier,
        companyId: formData.companyId || "",
        supplierId: sup?._id || "",
        items: invoiceItems,
        invoiceTaxes,
        portal: "shop",
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
      const all = response.data || [];
      setHeldInvoices(all.filter((inv) => inv.portal === "shop"));
    } catch (error) {
      console.error("Error fetching held invoices:", error);
    } finally {
      setIsLoadingHeldInvoices(false);
    }
  };

  const resumeHeldInvoice = async (invoice) => {
    try {
      setResumedInvoiceId(invoice._id);
      setFormData({
        supplierName: invoice.supplierName || "",
        companyId: invoice.companyId || "",
        invoiceNo: invoice.invoiceNo || "",
        invoiceDate: invoice.invoiceDate
          ? new Date(invoice.invoiceDate).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
      });
      if (invoice.supplierName) setSupplierSelection(invoice.supplierName);
      setInvoiceItems(
        (invoice.items || []).map((item, idx) => ({
          ...createEmptyItem(),
          ...item,
          id: Date.now() + idx + Math.random(),
        })),
      );
      setInvoiceTaxes(
        (invoice.invoiceTaxes || []).map((t, idx) => ({
          id: Date.now() + idx,
          ...t,
        })),
      );
      setShowHeldInvoicesModal(false);
      showToast("Held invoice resumed");
    } catch (err) {
      console.error("Error resuming held invoice:", err);
      showToast("Error resuming held invoice");
    }
  };

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      // F6 - Hold Invoice
      if (e.key === "F6") {
        e.preventDefault();
        if (invoiceItems.length > 0 && invoiceItems.some((i) => i.medicineName?.trim())) {
          handleHoldInvoice();
        }
      }
      // F7 - Show Held Invoices
      if (e.key === "F7") {
        e.preventDefault();
        fetchHeldInvoices();
        setShowHeldInvoicesModal(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [invoiceItems, supplierSelection, formData, suppliers]);

  const hideMainCategory = (value) => {
    const val = String(value || "").trim();
    if (!val) return;
    const current = getHiddenMainCategories();
    if (!current.includes(val)) {
      saveHiddenMainCategories([...current, val]);
    }
  };

  const unhideMainCategory = (value) => {
    const val = String(value || "").trim();
    if (!val) return;
    const current = getHiddenMainCategories();
    if (current.includes(val)) {
      saveHiddenMainCategories(current.filter((x) => x !== val));
    }
  };

  const removeCustomMainCategory = (value) => {
    const val = String(value || "").trim();
    if (!val) return;
    const custom = getCustomMainCategories();
    if (custom.includes(val)) {
      saveCustomMainCategories(custom.filter((x) => x !== val));
    }
  };

  const hideSubCategory = (mainCategory, value) => {
    const main = String(mainCategory || "").trim();
    const val = String(value || "").trim();
    if (!main || !val) return;
    const current = getHiddenSubCategories(main);
    if (!current.includes(val)) {
      saveHiddenSubCategories(main, [...current, val]);
    }
  };

  const unhideSubCategory = (mainCategory, value) => {
    const main = String(mainCategory || "").trim();
    const val = String(value || "").trim();
    if (!main || !val) return;
    const current = getHiddenSubCategories(main);
    if (current.includes(val)) {
      saveHiddenSubCategories(main, current.filter((x) => x !== val));
    }
  };

  const removeCustomSubCategory = (mainCategory, value) => {
    const main = String(mainCategory || "").trim();
    const val = String(value || "").trim();
    if (!main || !val) return;
    const custom = getCustomSubCategories(main);
    if (custom.includes(val)) {
      saveCustomSubCategories(main, custom.filter((x) => x !== val));
    }
  };

  const hideMedicineName = (mainCategory, subCategory, value) => {
    const main = String(mainCategory || "").trim();
    const sub = String(subCategory || "").trim();
    const val = String(value || "").trim();
    if (!main || !sub || !val) return;
    const current = getHiddenMedicines(main, sub);
    if (!current.includes(val)) {
      saveHiddenMedicines(main, sub, [...current, val]);
    }
  };

  const unhideMedicineName = (mainCategory, subCategory, value) => {
    const main = String(mainCategory || "").trim();
    const sub = String(subCategory || "").trim();
    const val = String(value || "").trim();
    if (!main || !sub || !val) return;
    const current = getHiddenMedicines(main, sub);
    if (current.includes(val)) {
      saveHiddenMedicines(main, sub, current.filter((x) => x !== val));
    }
  };

  const removeCustomMedicine = (mainCategory, subCategory, value) => {
    const main = String(mainCategory || "").trim();
    const sub = String(subCategory || "").trim();
    const val = String(value || "").trim();
    if (!main || !sub || !val) return;
    const custom = getCustomMedicines(main, sub);
    if (custom.includes(val)) {
      saveCustomMedicines(main, sub, custom.filter((x) => x !== val));
    }
  };

  const clearInvoice = () => {
    setSupplierSelection("");
    setInvoiceItems([createEmptyItem()]);
    setInvoiceTaxes([]);
    setFormData((p) => ({
      ...p,
      supplierName: "",
      companyId: "",
      invoiceNo: "INV-1",
      invoiceDate: new Date().toISOString().split("T")[0],
    }));
    setResumedInvoiceId(null);
  };

  const addItem = () => {
    setInvoiceItems((prev) => [...prev, createEmptyItem()]);
  };
  const removeItem = (id) => {
    setInvoiceItems((prev) => (prev.length <= 1 ? prev : prev.filter((x) => x.id !== id)));
  };

  const updateItem = (id, patch) => {
    setInvoiceItems((prev) =>
      prev.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    );
  };

  const addInvoiceTax = () => {
    setInvoiceTaxes((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), name: "", type: "%", value: 0, applyOn: "gross" },
    ]);
  };
  const deleteInvoiceTax = (id) => setInvoiceTaxes((prev) => prev.filter((t) => t.id !== id));

  const allMainCategories = useMemo(() => {
    const hidden = new Set(getHiddenMainCategories());
    const custom = getCustomMainCategories();
    const merged = [...new Set([...catalogMainCategories, ...custom])];
    return merged.filter((m) => !hidden.has(m));
  }, [optionsVersion]);

  const getVisibleSubCategories = (main) => {
    const subs = getSubCategories(main);
    const hidden = new Set(getHiddenSubCategories(main));
    const custom = getCustomSubCategories(main);
    const merged = [...new Set([...(subs || []), ...(custom || [])])];
    return merged.filter((s) => !hidden.has(s));
  };

  const getVisibleMedicines = (main, sub) => {
    const meds = getCatalogMedicines(main, sub);
    const hidden = new Set(getHiddenMedicines(main, sub));
    const custom = getCustomMedicines(main, sub);
    const merged = [...new Set([...(meds || []), ...(custom || [])])];
    return merged.filter((m) => !hidden.has(m));
  };

  const saveHiddenMainCategories = (vals) => {
    lsSet("shop_hidden_main_categories", vals);
    setOptionsVersion((v) => v + 1);
  };
  const saveCustomMainCategories = (vals) => {
    lsSet("shop_custom_main_categories", vals);
    setOptionsVersion((v) => v + 1);
  };
  const saveHiddenSubCategories = (main, vals) => {
    const all = ls("shop_hidden_subcategories", {});
    all[main] = vals;
    lsSet("shop_hidden_subcategories", all);
    setOptionsVersion((v) => v + 1);
  };
  const saveCustomSubCategories = (main, vals) => {
    const all = ls("shop_custom_subcategories", {});
    all[main] = vals;
    lsSet("shop_custom_subcategories", all);
    setOptionsVersion((v) => v + 1);
  };
  const saveHiddenMedicines = (main, sub, vals) => {
    const all = ls("shop_hidden_medicines", {});
    all[`${main}::${sub}`] = vals;
    lsSet("shop_hidden_medicines", all);
    setOptionsVersion((v) => v + 1);
  };
  const saveCustomMedicines = (main, sub, vals) => {
    const all = ls("shop_custom_medicines", {});
    all[`${main}::${sub}`] = vals;
    lsSet("shop_custom_medicines", all);
    setOptionsVersion((v) => v + 1);
  };

  const addCustomMainCategory = (val) => {
    const cur = getCustomMainCategories();
    if (cur.includes(val)) return;
    saveCustomMainCategories([...cur, val]);
  };

  const addCustomSubCategory = (main, val) => {
    const cur = getCustomSubCategories(main);
    if (cur.includes(val)) return;
    saveCustomSubCategories(main, [...cur, val]);
  };

  const addCustomMedicine = (main, sub, val) => {
    const cur = getCustomMedicines(main, sub);
    if (cur.includes(val)) return;
    saveCustomMedicines(main, sub, [...cur, val]);
  };

  const filteredCompanies = useMemo(() => {
    if (!supplierSelection) return companies;
    const selectedSup = suppliers.find((s) => s.name === supplierSelection);
    if (!selectedSup?.companyIds?.length) return companies;

    return companies.filter((c) => selectedSup.companyIds.includes(c._id));
  }, [supplierSelection, suppliers, companies]);

  // Auto-select supplier's associated company when supplier changes
  useEffect(() => {
    if (supplierSelection) {
      const selectedSup = suppliers.find((s) => s.name === supplierSelection);
      if (selectedSup?.companyIds?.length > 0) {
        const targetCompany = companies.find((c) => selectedSup.companyIds.includes(c._id));

        if (targetCompany) {
          setFormData((prev) => ({ ...prev, companyId: targetCompany._id }));
        }
      }
    } else {
      setFormData((prev) => ({ ...prev, companyId: "" }));
    }
  }, [supplierSelection, suppliers, companies]);

  const handleAddSupplier = async (e) => {
    e.preventDefault();
    try {
      setSavingSupplier(true);
      await petShopSuppliersAPI.create(newSupplierData);
      showToast("Supplier added successfully");
      setShowAddSupplierModal(false);
      setNewSupplierData({
        name: "",
        companyId: "",
        phone: "",
        address: "",
        taxId: "",
        status: "active",
      });
      await fetchSuppliers();
    } catch (err) {
      showToast(err.message || "Error adding supplier");
    } finally {
      setSavingSupplier(false);
    }
  };

  const handleAddCompany = async (e) => {
    e.preventDefault();
    try {
      setSavingCompany(true);
      await petShopCompaniesAPI.create(newCompanyData);
      showToast("Company added successfully");
      setShowAddCompanyModal(false);
      setNewCompanyData({ companyName: "", status: "active" });
      await fetchCompanies();
    } catch (err) {
      showToast(err.message || "Error adding company");
    } finally {
      setSavingCompany(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    const resolvedSupplier = (supplierSelection || formData.supplierName || "").trim();
    if (!resolvedSupplier) {
      showToast("Please select a Supplier");
      return;
    }

    const validItems = invoiceItems.filter((i) => (i.medicineName || "").trim());
    if (!validItems.length) {
      showToast("Please add at least one item");
      return;
    }

    setSaving(true);
    try {
      const shopUser = JSON.parse(localStorage.getItem("shop_auth") || "{}");
      const submittedBy = shopUser.username || shopUser.name || "Shop User";

      // Build draft items with computed totals
      const draftItems = validItems.map((item) => {
        const uPack = item.unitsPerPack || 1;
        // Use manually entered totalItems if set, otherwise compute from packs
        const computedTotal = (item.qtyPacks || 0) * uPack;
        const totalItems = item.totalItems != null ? Number(item.totalItems) : computedTotal;
        const subtotal = (item.qtyPacks || 0) * (item.buyPerPack || 0);
        const taxAmt =
          item.lineTaxType === "%"
            ? subtotal * ((item.lineTaxValue || 0) / 100)
            : item.lineTaxValue || 0;
        const lineTotal = subtotal + taxAmt;
        return {
          mainCategory: item.mainCategory || "",
          subCategory: item.subCategory || "",
          category: item.subCategory || item.mainCategory || item.category || "",
          medicineName: item.medicineName || "",
          genericName: item.genericName || "",
          batchNo: item.batchNo || "",
          barcode: item.barcode || "",
          expiryDate: item.expiryDate ? new Date(item.expiryDate) : undefined,
          qtyPacks: Number(item.qtyPacks || 0),
          unitsPerPack: uPack,
          buyPerPack: Number(item.buyPerPack || 0),
          salePerPack: Number(item.salePerPack || 0),
          totalItems,
          buyPerUnit: uPack > 0 ? +((item.buyPerPack || 0) / uPack).toFixed(4) : 0,
          salePerUnit: uPack > 0 ? +((item.salePerPack || 0) / uPack).toFixed(4) : 0,
          minStock: Number(item.minStock || 0),
          defaultDiscount: Number(item.defaultDiscount || 0),
          lineTaxType: item.lineTaxType || "%",
          lineTaxValue: Number(item.lineTaxValue || 0),
          subtotal,
          discountAmt: 0,
          taxAmt,
          lineTotal,
          unit: item.unit || "pieces",
          containerType: item.containerType || "",
          itemStatus: "pending",
        };
      });

      const grossTotal = draftItems.reduce((s, i) => s + i.subtotal, 0);
      const totalLineTaxes = draftItems.reduce((s, i) => s + i.taxAmt, 0);
      const netBeforeInvTax = grossTotal + totalLineTaxes;
      const totalInvoiceTaxes = invoiceTaxes.reduce((sum, t) => {
        const base = t.applyOn === "net" ? netBeforeInvTax : grossTotal;
        const amt = t.type === "%" ? base * ((Number(t.value) || 0) / 100) : Number(t.value) || 0;
        return sum + amt;
      }, 0);

      const sup = suppliers.find((s) => s.name === resolvedSupplier);

      const draftPayload = {
        invoiceNo: formData.invoiceNo || "INV-1",
        invoiceDate: new Date(formData.invoiceDate || Date.now()),
        portal: "shop",
        supplierName: resolvedSupplier,
        supplierId: sup?._id || undefined,
        companyId: formData.companyId || undefined,
        items: draftItems,
        invoiceTaxes: invoiceTaxes.map(({ id: _id, ...t }) => t),
        grossTotal,
        totalLineTaxes,
        totalInvoiceTaxes,
        netTotal: netBeforeInvTax + totalInvoiceTaxes,
        submittedBy,
        submittedAt: new Date(),
        status: "pending",
      };

      // Update existing draft or create new one
      if (editingDraftId) {
        await petshopPharmacyPurchaseDraftsAPI.update(editingDraftId, draftPayload);
      } else {
        await petshopPharmacyPurchaseDraftsAPI.create(draftPayload);
      }

      // Delete held invoice if this was resumed from one
      if (resumedInvoiceId) {
        try {
          await holdInvoicesAPI.delete(resumedInvoiceId);
        } catch {}
      }

      showToast(`${validItems.length} product(s) submitted for review`);
      setTimeout(() => navigate("/shop/inventory?tab=pending"), 800);
    } catch (err) {
      showToast(err.message || "Error submitting products");
    } finally {
      setSaving(false);
    }
  };

  // ── Invoice summary aggregates ───────────────────────────────────────────
  const summaryAgg = invoiceItems.reduce(
    (acc, item) => {
      const subtotal = (item.qtyPacks || 0) * (item.buyPerPack || 0);
      const tax =
        item.lineTaxType === "%"
          ? subtotal * ((item.lineTaxValue || 0) / 100)
          : item.lineTaxValue || 0;
      acc.grossTotal += subtotal;
      acc.totalLineTaxes += tax;
      return acc;
    },
    { grossTotal: 0, totalLineTaxes: 0 },
  );
  const netBeforeInvTax = summaryAgg.grossTotal + summaryAgg.totalLineTaxes;
  const totalInvoiceTaxes = invoiceTaxes.reduce((sum, t) => {
    const base = t.applyOn === "net" ? netBeforeInvTax : summaryAgg.grossTotal;
    const amt =
      t.type === "%"
        ? base * ((Number(t.value) || 0) / 100)
        : Number(t.value) || 0;
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
                    {formatCatalogLabel(addOptionDialog.mainCategory)} /{" "}
                    {formatCatalogLabel(addOptionDialog.subCategory)}
                  </p>
                )}
              </div>
              <button
                onClick={() => setAddOptionDialog(null)}
                className="text-white hover:bg-white/20 p-2 rounded-lg"
              >
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
                  addCustomMedicine(
                    addOptionDialog.mainCategory,
                    addOptionDialog.subCategory,
                    val,
                  );
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
            onClick={() => navigate("/shop/inventory")}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
          >
            <FiArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {editingDraftId ? "Edit Product Draft" : "Add New Product"}
            </h1>
            <p className="text-sm text-slate-500">
              {editingDraftId ? "Update the pending draft" : "Record a new purchase invoice"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Hold Invoice Buttons */}
          <button
            type="button"
            onClick={handleHoldInvoice}
            disabled={
              invoiceItems.length === 0 ||
              !invoiceItems.some((i) => i.medicineName?.trim())
            }
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
            <div className="px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="text-xs text-emerald-700 font-medium">Total</div>
              <div className="text-lg font-bold text-emerald-800">
                PKR {grandTotal.toFixed(2)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column */}
        <div className="lg:col-span-8 space-y-6">
          {/* Invoice Details */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <FiPackage className="text-blue-600" />
              <h2 className="text-lg font-semibold text-slate-800">
                Invoice Details
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Supplier */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Supplier
                </label>
                <div className="flex gap-2">
                  <select
                    value={supplierSelection}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSupplierSelection(value);
                      setFormData((p) => ({ ...p, supplierName: value }));
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white text-sm"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => (
                      <option key={s._id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowAddSupplierModal(true)}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold"
                    title="Add Supplier"
                  >
                    + Add
                  </button>
                </div>
              </div>

              {/* Company */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Company
                </label>
                <div className="flex gap-2">
                  <select
                    value={formData.companyId}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, companyId: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white text-sm"
                  >
                    <option value="">None</option>
                    {filteredCompanies.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.companyName}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowAddCompanyModal(true)}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold"
                    title="Add Company"
                  >
                    + Add
                  </button>
                </div>
              </div>

              {/* Invoice No */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Invoice No
                </label>
                <input
                  type="text"
                  value={formData.invoiceNo}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, invoiceNo: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white text-sm"
                  placeholder="INV-1"
                />
              </div>

              {/* Invoice Date */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Invoice Date *
                </label>
                <input
                  type="date"
                  value={formData.invoiceDate}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, invoiceDate: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white text-sm"
                />
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-4">
            {invoiceItems.map((item, idx) => {
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-purple-600">
                        Item #{idx + 1}
                      </span>
                      <span className="text-sm text-slate-500">
                        {item.medicineName || ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateItem(item.id, { collapsed: !item.collapsed })
                        }
                        className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 hover:bg-slate-50"
                      >
                        {item.collapsed ? "Expand" : "Collapse"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmDialog({
                            title: "Remove item",
                            message: "Are you sure you want to remove this item?",
                            onConfirm: () => {
                              removeItem(item.id);
                              setConfirmDialog(null);
                            },
                          })
                        }
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        title="Remove Item"
                        disabled={invoiceItems.length <= 1}
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {!item.collapsed && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Product Name */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Product Name *
                          </label>
                          <input
                            type="text"
                            value={item.medicineName}
                            onChange={(e) =>
                              updateItem(item.id, { medicineName: e.target.value })
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="Enter product name"
                            required
                          />
                        </div>

                        {/* Category */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Category
                          </label>
                          <input
                            type="text"
                            value={item.category}
                            onChange={(e) =>
                              updateItem(item.id, { category: e.target.value })
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="e.g. Food, Accessories, Medicine"
                          />
                        </div>

                        {/* Generic */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Generic Name
                          </label>
                          <input
                            type="text"
                            value={item.genericName}
                            onChange={(e) =>
                              updateItem(item.id, { genericName: e.target.value })
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="e.g. Paracetamol"
                          />
                        </div>

                        {/* Barcode */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Barcode
                          </label>
                          <input
                            type="text"
                            value={item.barcode}
                            onChange={(e) =>
                              updateItem(item.id, { barcode: e.target.value })
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="Scan or type"
                          />
                        </div>

                        {/* Batch No */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Batch No
                          </label>
                          <input
                            type="text"
                            value={item.batchNo}
                            onChange={(e) =>
                              updateItem(item.id, { batchNo: e.target.value })
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="Enter batch number"
                          />
                        </div>

                        {/* Expiry */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Expiry Date
                          </label>
                          <input
                            type="date"
                            value={item.expiryDate}
                            onChange={(e) =>
                              updateItem(item.id, { expiryDate: e.target.value })
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>

                        {/* Qty */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Qty Packs
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={item.qtyPacks}
                            onChange={(e) =>
                              updateItem(item.id, {
                                qtyPacks: Number(e.target.value),
                              })
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>

                        {/* Units per pack */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Units Per Pack
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={item.unitsPerPack}
                            onChange={(e) =>
                              updateItem(item.id, {
                                unitsPerPack: Number(e.target.value),
                              })
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>

                        {/* Buy */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Buy Per Pack
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={item.buyPerPack}
                            onChange={(e) =>
                              updateItem(item.id, {
                                buyPerPack: Number(e.target.value),
                              })
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>

                        {/* Sale */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Sale Per Pack
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={item.salePerPack}
                            onChange={(e) =>
                              updateItem(item.id, {
                                salePerPack: Number(e.target.value),
                              })
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>

                        {/* Buy/Unit — read-only computed */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Buy/Unit
                          </label>
                          <input
                            type="text"
                            readOnly
                            value={
                              (item.unitsPerPack || 1) > 0
                                ? ((item.buyPerPack || 0) / (item.unitsPerPack || 1)).toFixed(2)
                                : "0.00"
                            }
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-100 text-sm text-slate-600 cursor-not-allowed"
                          />
                        </div>

                        {/* Sale/Unit — read-only computed */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Sale/Unit
                          </label>
                          <input
                            type="text"
                            readOnly
                            value={
                              (item.unitsPerPack || 1) > 0
                                ? ((item.salePerPack || 0) / (item.unitsPerPack || 1)).toFixed(2)
                                : "0.00"
                            }
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-100 text-sm text-slate-600 cursor-not-allowed"
                          />
                        </div>

                        {/* Total Items — independent editable field */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Total Items
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={item.totalItems ?? (item.qtyPacks || 0) * (item.unitsPerPack || 1)}
                            onChange={(e) =>
                              updateItem(item.id, { totalItems: Number(e.target.value) || 0 })
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>

                        {/* Min stock */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Min Stock
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={item.minStock}
                            onChange={(e) =>
                              updateItem(item.id, {
                                minStock: Number(e.target.value),
                              })
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>

                        {/* Default Discount */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Default Discount (%)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={item.defaultDiscount}
                            onChange={(e) =>
                              updateItem(item.id, {
                                defaultDiscount: Number(e.target.value),
                              })
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="0"
                          />
                        </div>

                        {/* Line Tax */}
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Line Tax <span className="text-slate-400 font-normal">(Optional)</span>
                          </label>
                          <div className="flex gap-2">
                            <div className="flex rounded-lg border border-slate-300 overflow-hidden shrink-0">
                              {["%", "PKR"].map((t) => (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() => updateItem(item.id, { lineTaxType: t })}
                                  className={`px-3 py-2 text-xs font-semibold transition-colors ${
                                    item.lineTaxType === t
                                      ? "bg-purple-600 text-white"
                                      : "bg-white text-slate-600 hover:bg-slate-50"
                                  }`}
                                >
                                  {t}
                                </button>
                              ))}
                            </div>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.lineTaxValue}
                              onChange={(e) =>
                                updateItem(item.id, {
                                  lineTaxValue: Number(e.target.value),
                                })
                              }
                              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                              placeholder={item.lineTaxType === "%" ? "e.g. 17" : "e.g. 50"}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Subtotal / Line Total bar */}
                      {(() => {
                        const subtotal = (item.qtyPacks || 0) * (item.buyPerPack || 0);
                        const tax =
                          item.lineTaxType === "%"
                            ? subtotal * ((item.lineTaxValue || 0) / 100)
                            : item.lineTaxValue || 0;
                        const lineTotal = subtotal + tax;
                        return (
                          <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-xl px-5 py-3 mt-1">
                            <div className="flex items-center gap-4 flex-wrap text-xs text-slate-500">
                              <span>Subtotal: <span className="font-medium text-slate-700">PKR {subtotal.toFixed(2)}</span></span>
                              {tax > 0 && <span>Tax: <span className="font-medium text-slate-700">+ PKR {tax.toFixed(2)}</span></span>}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-sm font-semibold text-slate-700">Line Total:</span>
                              <span className="text-lg font-bold text-purple-700">PKR {lineTotal.toFixed(2)}</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={addItem}
              className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2 font-semibold"
            >
              <FiPlus /> Add Item
            </button>
          </div>

          {/* Submit */}
          <form onSubmit={handleSubmit} className="flex gap-3">
            <button
              type="button"
              onClick={() =>
                setConfirmDialog({
                  title: "Clear",
                  message: "Clear the current invoice?",
                  onConfirm: () => {
                    clearInvoice();
                    setConfirmDialog(null);
                  },
                })
              }
              className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-semibold"
            >
              Clear
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <FiPlay className="w-4 h-4" /> Saving...
                </>
              ) : (
                <>
                  <FiPlus className="w-4 h-4" /> Submit for Preview
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right column */}
        <div className="lg:col-span-4 space-y-6">
          {/* Invoice taxes */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-slate-800">Invoice-Level Taxes</div>
              <button
                type="button"
                onClick={() => setTaxesCollapsed((c) => !c)}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                {taxesCollapsed ? "Expand" : "Collapse"}
              </button>
            </div>

            {!taxesCollapsed && (
              <div className="space-y-3">
                {invoiceTaxes.length === 0 ? (
                  <div className="text-sm text-slate-500">No invoice taxes added</div>
                ) : (
                  invoiceTaxes.map((tax) => (
                    <div key={tax.id} className="border border-slate-200 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-semibold text-slate-700">Tax</div>
                        <button
                          type="button"
                          onClick={() => deleteInvoiceTax(tax.id)}
                          className="text-red-600 hover:bg-red-50 p-1 rounded"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={tax.name}
                        onChange={(e) =>
                          setInvoiceTaxes((prev) =>
                            prev.map((t) =>
                              t.id === tax.id ? { ...t, name: e.target.value } : t,
                            ),
                          )
                        }
                        placeholder="Tax name (e.g., GST)"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />

                      <div className="flex flex-wrap gap-2 mt-2">
                        <select
                          value={tax.type}
                          onChange={(e) =>
                            setInvoiceTaxes((prev) =>
                              prev.map((t) =>
                                t.id === tax.id
                                  ? { ...t, type: e.target.value }
                                  : t,
                              ),
                            )
                          }
                          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                        >
                          <option value="%">%</option>
                          <option value="flat">Flat</option>
                        </select>
                        <input
                          type="number"
                          min="0"
                          value={tax.value}
                          onChange={(e) =>
                            setInvoiceTaxes((prev) =>
                              prev.map((t) =>
                                t.id === tax.id
                                  ? { ...t, value: e.target.value }
                                  : t,
                              ),
                            )
                          }
                          placeholder="Value"
                          className="flex-1 min-w-[70px] px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <select
                          value={tax.applyOn}
                          onChange={(e) =>
                            setInvoiceTaxes((prev) =>
                              prev.map((t) =>
                                t.id === tax.id
                                  ? { ...t, applyOn: e.target.value }
                                  : t,
                              ),
                            )
                          }
                          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                        >
                          <option value="gross">Apply on Gross</option>
                          <option value="net">Apply on Net</option>
                        </select>
                      </div>
                    </div>
                  ))
                )}

                <button
                  type="button"
                  onClick={addInvoiceTax}
                  className="w-full py-2 border border-dashed border-slate-300 rounded-xl text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2"
                >
                  <FiPlus /> Add Invoice Tax
                </button>
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="bg-emerald-50 rounded-xl shadow-sm border border-emerald-200 p-5">
            <div className="font-semibold text-slate-800 mb-3">Invoice Summary</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Gross Total</span>
                <span className="font-semibold">PKR {summaryAgg.grossTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Line Taxes</span>
                <span className="font-semibold">+ PKR {summaryAgg.totalLineTaxes.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Invoice Taxes</span>
                <span className="font-semibold">+ PKR {totalInvoiceTaxes.toFixed(2)}</span>
              </div>
              <div className="border-t border-emerald-200 pt-2 mt-2 flex justify-between">
                <span className="font-bold text-slate-800">Net Total</span>
                <span className="font-bold text-emerald-800">PKR {grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-5 border-b">
              <div className="text-lg font-bold text-slate-800">
                {confirmDialog.title}
              </div>
              <div className="text-sm text-slate-600 mt-1">
                {confirmDialog.message}
              </div>
            </div>
            <div className="p-5 flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 border rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 bg-red-600 text-white rounded-lg"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Supplier Modal */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-bold text-white">Add Supplier</h3>
                <p className="text-xs text-white/80 mt-0.5">
                  Create a new supplier
                </p>
              </div>
              <button
                onClick={() => setShowAddSupplierModal(false)}
                className="text-white hover:bg-white/20 p-2 rounded-lg"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={handleAddSupplier}
              className="p-5 space-y-4 overflow-y-auto flex-1"
            >
              {[
                {
                  label: "Supplier Name *",
                  key: "name",
                  required: true,
                  placeholder: "Enter supplier name",
                },
                {
                  label: "Phone Number",
                  key: "phone",
                  placeholder: "Enter phone number",
                },
                { label: "Tax ID", key: "taxId", placeholder: "Enter tax ID" },
                { label: "Address", key: "address", placeholder: "Enter address" },
              ].map(({ label, key, required, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {label}
                  </label>
                  <input
                    type="text"
                    required={required}
                    value={newSupplierData[key]}
                    onChange={(e) =>
                      setNewSupplierData((p) => ({
                        ...p,
                        [key]: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={placeholder}
                  />
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Status
                </label>
                <select
                  value={newSupplierData.status}
                  onChange={(e) =>
                    setNewSupplierData((p) => ({ ...p, status: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSupplier}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 font-semibold"
                >
                  {savingSupplier ? "Saving..." : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Company Modal */}
      {showAddCompanyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-bold text-white">Add Company</h3>
                <p className="text-xs text-white/80 mt-0.5">Create a new company</p>
              </div>
              <button
                onClick={() => setShowAddCompanyModal(false)}
                className="text-white hover:bg-white/20 p-2 rounded-lg"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={handleAddCompany}
              className="p-5 space-y-4 overflow-y-auto flex-1"
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  required
                  value={newCompanyData.companyName}
                  onChange={(e) =>
                    setNewCompanyData((p) => ({
                      ...p,
                      companyName: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter company name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Status
                </label>
                <select
                  value={newCompanyData.status}
                  onChange={(e) =>
                    setNewCompanyData((p) => ({ ...p, status: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCompanyModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCompany}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 font-semibold"
                >
                  {savingCompany ? "Saving..." : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Held Invoices Modal */}
      {showHeldInvoicesModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <div className="text-lg font-bold text-slate-800">Held Invoices</div>
                <div className="text-xs text-slate-500">Resume or delete held invoices</div>
              </div>
              <button
                onClick={() => setShowHeldInvoicesModal(false)}
                className="p-2 rounded-lg hover:bg-slate-100"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5">
              {isLoadingHeldInvoices ? (
                <div className="text-sm text-slate-600">Loading...</div>
              ) : heldInvoices.length === 0 ? (
                <div className="text-sm text-slate-600">No held invoices</div>
              ) : (
                <div className="space-y-3">
                  {heldInvoices.map((inv) => (
                    <div
                      key={inv._id}
                      className="border border-slate-200 rounded-xl p-4 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-slate-800">
                          {inv.invoiceNo}
                        </div>
                        <div className="text-xs text-slate-500">
                          {inv.supplierName} •{" "}
                          {inv.invoiceDate
                            ? new Date(inv.invoiceDate).toLocaleDateString()
                            : ""}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => resumeHeldInvoice(inv)}
                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold"
                        >
                          Resume
                        </button>
                        <button
                          onClick={() =>
                            setConfirmDialog({
                              title: "Delete held invoice",
                              message: `Delete held invoice ${inv.invoiceNo}?`,
                              onConfirm: async () => {
                                try {
                                  await holdInvoicesAPI.delete(inv._id);
                                  showToast("Held invoice deleted");
                                  await fetchHeldInvoices();
                                } catch (err) {
                                  showToast("Error deleting held invoice");
                                } finally {
                                  setConfirmDialog(null);
                                }
                              },
                            })
                          }
                          className="px-3 py-2 border border-red-300 text-red-700 hover:bg-red-50 rounded-lg text-sm font-semibold"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
    </div>
  );
}
