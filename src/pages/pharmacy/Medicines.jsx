import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiSearch,
  FiAlertTriangle,
  FiClock,
  FiPackage,
  FiX,
  FiDownload,
  FiUpload,
  FiPlay,
} from "react-icons/fi";
import {
  pharmacyMedicinesAPI,
  suppliersAPI,
  pharmacySalesAPI,
  payablesAPI,
  companiesAPI,
  pharmacyPurchaseDraftsAPI,
} from "../../services/api";
import * as XLSX from "xlsx";
import {
  medicineCatalog,
  formatCatalogLabel,
} from "../../data/medicineCatalog";

const UNIT_CUSTOM_OPTION = "__unit_custom__";
const CONTAINER_CUSTOM_OPTION = "__container_custom__";
const catalogMainCategories = Object.keys(medicineCatalog);

const getSubCategories = (mainCategory) => {
  if (!mainCategory || !medicineCatalog[mainCategory]) return [];
  return Object.keys(medicineCatalog[mainCategory]);
};

const getCatalogMedicines = (mainCategory, subCategory) => {
  if (!mainCategory || !subCategory) return [];
  return medicineCatalog[mainCategory]?.[subCategory] || [];
};

const normalizeToken = (value = "") =>
  value.toLowerCase().replace(/\s+/g, "").replace(/_/g, "");

const findCatalogPath = (value = "") => {
  if (!value) return null;
  const needle = normalizeToken(value);
  for (const [mainCategory, subMap] of Object.entries(medicineCatalog)) {
    for (const [subCategory, medicines] of Object.entries(subMap)) {
      if (normalizeToken(subCategory) === needle) {
        return { mainCategory, subCategory };
      }
      if (medicines.some((med) => normalizeToken(med) === needle)) {
        return { mainCategory, subCategory };
      }
    }
  }
  return null;
};

const inferCategories = (medicine = {}) => {
  const fromName = findCatalogPath(medicine.medicineName);
  const fromExisting = findCatalogPath(
    medicine.subCategory || medicine.category,
  );
  return {
    mainCategory:
      medicine.mainCategory ||
      fromName?.mainCategory ||
      fromExisting?.mainCategory ||
      "Medicine",
    subCategory:
      medicine.subCategory ||
      fromName?.subCategory ||
      fromExisting?.subCategory ||
      medicine.category ||
      "General",
  };
};

const CATEGORY_KEYS = {
  injection: ["injection"],
  infusion: ["infusion"],
  capsule: ["capsules", "capsule"],
  tablet: ["tablet", "tablets"],
  drops: ["drops"],
  syrup: ["syrup"],
  cream: ["cream"],
  ointment: ["ointment"],
  gel: ["gel", "oralgel"],
  powder: ["powder", "sachet"],
  spray: ["spray"],
};

const getCategoryKey = (mainCategory, subCategory) => {
  const token = normalizeToken(subCategory || mainCategory || "");
  for (const [key, aliases] of Object.entries(CATEGORY_KEYS)) {
    if (aliases.some((a) => token.includes(a))) return key;
  }
  return token || "general";
};

const UNIT_OPTIONS_BY_KEY = {
  injection: ["mg", "mcg", "g", "kg", "ml", "kL"],
  infusion: ["ml", "L"],
  capsule: ["mg", "mcg", "g", "kg"],
  tablet: ["mg", "mcg", "g", "kg"],
  drops: ["ml"],
  syrup: ["ml"],
  cream: ["g"],
  ointment: ["g"],
  gel: ["g"],
  powder: ["g", "kg"],
  spray: ["ml"],
};

const DEFAULT_UNIT_BY_KEY = {
  injection: "ml",
  infusion: "ml",
  capsule: "mg",
  tablet: "mg",
  drops: "ml",
  syrup: "ml",
  cream: "g",
  ointment: "g",
  gel: "g",
  powder: "g",
  spray: "ml",
};

const CONTAINER_OPTIONS_BY_KEY = {
  injection: ["Vial", "Ampule", "Bottle"],
  infusion: ["Bottle"],
  drops: ["Bottle"],
  syrup: ["Bottle"],
  capsule: ["Pack"],
  tablet: ["Pack"],
};

const DEFAULT_CONTAINER_BY_KEY = {
  injection: "Vial",
  infusion: "Bottle",
  drops: "Bottle",
  syrup: "Bottle",
  capsule: "Pack",
  tablet: "Pack",
};

const getUnitOptionsForCategory = (mainCategory, subCategory) => {
  const key = getCategoryKey(mainCategory, subCategory);
  return UNIT_OPTIONS_BY_KEY[key] || ["pieces"];
};

const getDefaultContainerType = (mainCategory, subCategory) => {
  const key = getCategoryKey(mainCategory, subCategory);
  return DEFAULT_CONTAINER_BY_KEY[key] || "";
};

const getContainerOptions = (mainCategory, subCategory) => {
  const key = getCategoryKey(mainCategory, subCategory);
  return CONTAINER_OPTIONS_BY_KEY[key] || [];
};

const getCustomUnitsForKey = (key, storageNamespace = "pharmacy") => {
  if (!key) return [];
  try {
    const map = JSON.parse(
      localStorage.getItem(`${storageNamespace}_custom_units`) || "{}",
    );
    const arr = Array.isArray(map[key]) ? map[key] : [];
    return arr.filter(Boolean);
  } catch {
    return [];
  }
};

const getCustomContainersForKey = (key, storageNamespace = "pharmacy") => {
  if (!key) return [];
  try {
    const map = JSON.parse(
      localStorage.getItem(`${storageNamespace}_custom_containers`) || "{}",
    );
    const arr = Array.isArray(map[key]) ? map[key] : [];
    return arr.filter(Boolean);
  } catch {
    return [];
  }
};

const formatUnitForDisplay = (unit, fallback = "ml") => {
  const rawUnit = String(unit || "").trim() || fallback;
  return rawUnit.toLowerCase() === "ml" ? "ML" : rawUnit;
};

const getPerContainerLabel = (
  mainCategory,
  subCategory,
  containerType,
  unit,
) => {
  const key = getCategoryKey(mainCategory, subCategory);
  if (key === "tablet") return `Tablets per ${containerType || "Pack"}`;
  if (key === "capsule") return `Capsules per ${containerType || "Pack"}`;
  if (["injection", "infusion", "drops", "syrup"].includes(key)) {
    const c = containerType || DEFAULT_CONTAINER_BY_KEY[key] || "Vial";
    return `${formatUnitForDisplay(unit, "ml")} per ${c}`;
  }
  return "Units per Pack";
};

const shouldShowPerContainerField = (mainCategory, subCategory) => {
  const key = getCategoryKey(mainCategory, subCategory);
  return [
    "injection",
    "infusion",
    "drops",
    "syrup",
    "capsule",
    "tablet",
  ].includes(key);
};

const isLiquidLikeCategory = (mainCategory, subCategory) => {
  const key = getCategoryKey(mainCategory, subCategory);
  return ["injection"].includes(key);
};

const getCategoryUnit = (mainCategory, subCategory) => {
  const key = getCategoryKey(mainCategory, subCategory);
  return DEFAULT_UNIT_BY_KEY[key] || "pieces";
};

const isInjectionLike = (category) =>
  ["injection", "infusion"].includes(normalizeToken(category));

const optionEquals = (a = "", b = "") =>
  normalizeToken(a) === normalizeToken(b);
const hasCatalogValue = (list = [], value = "") =>
  list.some((item) => optionEquals(item, value));
const formatOptionLabel = (value = "") =>
  value === "All" ? "All Categories" : formatCatalogLabel(value);

const hydrateMedicine = (medicine = {}) => {
  const inferred = inferCategories(medicine);
  return {
    ...medicine,
    mainCategory: medicine.mainCategory || inferred.mainCategory,
    subCategory: medicine.subCategory || inferred.subCategory,
    category: medicine.category || inferred.subCategory,
  };
};

const createEmptyForm = () => {
  const today = new Date().toISOString().split("T")[0];
  const mainCategory = catalogMainCategories[0] || "";
  const firstSub = mainCategory ? getSubCategories(mainCategory)[0] || "" : "";
  const firstMed =
    mainCategory && firstSub
      ? getCatalogMedicines(mainCategory, firstSub)[0] || ""
      : "";
  return {
    mainCategory,
    subCategory: firstSub,
    category: firstSub || mainCategory,
    medicineName: firstMed,
    batchNo: "",
    barcode: "",
    expiryDate: "",
    quantity: 0,
    unit: getCategoryUnit(mainCategory, firstSub),
    containerType: getDefaultContainerType(mainCategory, firstSub),
    purchasePrice: 0,
    salePrice: 0,
    minSalePrice: 0,
    supplierName: "",
    purchaseDate: today,
    lowStockThreshold: 10,
    description: "",
    mlPerVial: 0,
    remainingMl: 0,
    invoiceNo: "INV-1",
    invoiceDate: new Date().toISOString().split("T")[0],
    companyId: "",
    // New item fields
    genericName: "",
    qtyPacks: 0,
    unitsPerPack: 1,
    buyPerPack: 0,
    salePerPack: 0,
    minStock: 0,
    defaultDiscount: 0,
    lineTaxType: "%",
    lineTaxValue: 0,
  };
};

const createEmptyItem = () => {
  const mainCategory = catalogMainCategories[0] || "";
  const firstSub = mainCategory ? getSubCategories(mainCategory)[0] || "" : "";
  const firstMed =
    mainCategory && firstSub
      ? getCatalogMedicines(mainCategory, firstSub)[0] || ""
      : "";
  return {
    id: Date.now() + Math.random(),
    collapsed: false,
    mainCategory,
    subCategory: firstSub,
    category: firstSub || mainCategory,
    medicineName: firstMed,
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
    unit: getCategoryUnit(mainCategory, firstSub),
    containerType: getDefaultContainerType(mainCategory, firstSub),
  };
};

export default function Medicines({
  basePath = "/pharmacy",
  portalName = "pharmacy",
  storageNamespace = "pharmacy",
  title = "Medicine Inventory",
  subtitle = "Manage pharmacy medicines and stock",
  addInvoicePath = null,
  initialTab = "all",
  apis,
} = {}) {
  const navigate = useNavigate();
  const medicinesAPI = apis?.medicines || pharmacyMedicinesAPI;
  const salesAPI = apis?.sales || pharmacySalesAPI;
  const purchaseDraftsAPI = apis?.purchaseDrafts || pharmacyPurchaseDraftsAPI;
  const suppliersPortal = apis?.suppliersPortal || portalName;
  const companiesPortal = apis?.companiesPortal || portalName;
  const resolvedSuppliersAPI = apis?.suppliers || suppliersAPI;
  const resolvedCompaniesAPI = apis?.companies || companiesAPI;
  const [medicines, setMedicines] = useState([]);
  const [filteredMedicines, setFilteredMedicines] = useState([]);
  const [purchaseDrafts, setPurchaseDrafts] = useState([]);
  const [filteredDrafts, setFilteredDrafts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMainCategory, setSelectedMainCategory] = useState("All");
  const [selectedSubCategory, setSelectedSubCategory] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState(null);
  const [medicineToDelete, setMedicineToDelete] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [alerts, setAlerts] = useState({
    lowStock: 0,
    expiring: 0,
    expired: 0,
  });
  const [suppliers, setSuppliers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [showOtherSupplier, setShowOtherSupplier] = useState(false);
  const [supplierSelection, setSupplierSelection] = useState("");
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [newCompanyData, setNewCompanyData] = useState({
    supplierName: "",
    contactPerson: "",
    phone: "",
    email: "",
  });

  // Invoice items (multi-item support)
  const [invoiceItems, setInvoiceItems] = useState([createEmptyItem()]);

  // Inline Add Supplier modal (in Invoice Details)
  const [showAddSupplierInvModal, setShowAddSupplierInvModal] = useState(false);
  const [newSupplierInvData, setNewSupplierInvData] = useState({
    name: "", companyId: "", phone: "", address: "", taxId: "", status: "active",
  });
  const [savingSupplier, setSavingSupplier] = useState(false);

  // Inline Add Company modal (in Invoice Details)
  const [showAddCompanyInvModal, setShowAddCompanyInvModal] = useState(false);
  const [newCompanyInvData, setNewCompanyInvData] = useState({
    companyName: "", status: "active",
  });
  const [savingCompany, setSavingCompany] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [activeTab, setActiveTab] = useState(initialTab || "all");
  const importInputRef = useRef();

  const categories = useMemo(() => ["All", ...catalogMainCategories], []);

  const [formData, setFormData] = useState(createEmptyForm());
  const [showCustomUnit, setShowCustomUnit] = useState(false);
  const [customUnitValue, setCustomUnitValue] = useState("");
  const [showCustomContainer, setShowCustomContainer] = useState(false);
  const [customContainerValue, setCustomContainerValue] = useState("");
  const [mlPerVialInput, setMlPerVialInput] = useState("");
  const [mlPerVialOriginal, setMlPerVialOriginal] = useState(null);
  const [showManageUnit, setShowManageUnit] = useState(false);
  const [showManageContainer, setShowManageContainer] = useState(false);
  const [showManageMainCategory, setShowManageMainCategory] = useState(false);
  const [showManageSubCategory, setShowManageSubCategory] = useState(false);
  const [showManageMedicineOptions, setShowManageMedicineOptions] =
    useState(false);
  const [showAddMainCategory, setShowAddMainCategory] = useState(false);
  const [showAddSubCategory, setShowAddSubCategory] = useState(false);
  const [showAddMedicineOption, setShowAddMedicineOption] = useState(false);
  const [newMainCategoryName, setNewMainCategoryName] = useState("");
  const [newSubCategoryName, setNewSubCategoryName] = useState("");
  const [newMedicineName, setNewMedicineName] = useState("");
  const [optionsVersion, setOptionsVersion] = useState(0);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [optionEdit, setOptionEdit] = useState({
    kind: "",
    oldValue: "",
    value: "",
    mainCategory: "",
    subCategory: "",
  });

  const getHiddenMainCategories = () => {
    try {
      const arr = JSON.parse(
        localStorage.getItem(`${storageNamespace}_hidden_main_categories`) || "[]",
      );
      return Array.isArray(arr) ? arr.filter(Boolean) : [];
    } catch {
      return [];
    }
  };

  const getCustomMedicines = (mainCategory, subCategory) => {
    if (!mainCategory || !subCategory) return [];
    try {
      const map = JSON.parse(
        localStorage.getItem(`${storageNamespace}_custom_medicines`) || "{}",
      );
      const key = getMedicineKey(mainCategory, subCategory);
      const arr = Array.isArray(map[key]) ? map[key] : [];
      return arr.filter(Boolean);
    } catch {
      return [];
    }
  };

  const getHiddenSubCategories = (mainCategory) => {
    if (!mainCategory) return [];
    try {
      const map = JSON.parse(
        localStorage.getItem(`${storageNamespace}_hidden_subcategories`) || "{}",
      );
      const arr = Array.isArray(map[mainCategory]) ? map[mainCategory] : [];
      return arr.filter(Boolean);
    } catch {
      return [];
    }
  };

  const getCustomMainCategories = () => {
    try {
      const arr = JSON.parse(
        localStorage.getItem(`${storageNamespace}_custom_main_categories`) || "[]",
      );
      return Array.isArray(arr) ? arr.filter(Boolean) : [];
    } catch {
      return [];
    }
  };

  const getCustomSubCategories = (mainCategory) => {
    if (!mainCategory) return [];
    try {
      const map = JSON.parse(
        localStorage.getItem(`${storageNamespace}_custom_subcategories`) || "{}",
      );
      const arr = Array.isArray(map[mainCategory]) ? map[mainCategory] : [];
      return arr.filter(Boolean);
    } catch {
      return [];
    }
  };

  const getMedicineKey = (mainCategory, subCategory) =>
    `${mainCategory || ""}::${subCategory || ""}`;

  const getHiddenMedicines = (mainCategory, subCategory) => {
    if (!mainCategory || !subCategory) return [];
    try {
      const map = JSON.parse(
        localStorage.getItem(`${storageNamespace}_hidden_medicines`) || "{}",
      );
      const key = getMedicineKey(mainCategory, subCategory);
      const arr = Array.isArray(map[key]) ? map[key] : [];
      return arr.filter(Boolean);
    } catch {
      return [];
    }
  };

  const hideMainCategory = (value) => {
    const val = value || "";
    if (!val) return;
    try {
      const raw =
        localStorage.getItem(`${storageNamespace}_hidden_main_categories`) || "[]";
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : [];
      if (!list.includes(val)) {
        const next = [...list, val];
        localStorage.setItem(
          `${storageNamespace}_hidden_main_categories`,
          JSON.stringify(next),
        );
      }
    } catch {}
    setOptionsVersion((v) => v + 1);
    setFormData((prev) => {
      if (prev.mainCategory !== val) return prev;
      const hidden = getHiddenMainCategories().concat([val]);
      const allMain = [
        ...new Set([...catalogMainCategories, ...getCustomMainCategories()]),
      ];
      const remaining = allMain.filter((mc) => !hidden.includes(mc));
      const nextMain = remaining[0] || "";
      if (!nextMain) {
        return {
          ...prev,
          mainCategory: "",
          subCategory: "",
          category: "",
          medicineName: "",
          unit: getCategoryUnit("", ""),
          containerType: "",
        };
      }
      const hiddenSubs = getHiddenSubCategories(nextMain);
      const catalogSubs = getSubCategories(nextMain);
      const customSubs = getCustomSubCategories(nextMain);
      const allSubs = [...new Set([...catalogSubs, ...customSubs])];
      const visibleSubs = allSubs.filter((sc) => !hiddenSubs.includes(sc));
      const nextSub = visibleSubs[0] || "";
      const hiddenMeds = nextSub ? getHiddenMedicines(nextMain, nextSub) : [];
      const catalogMeds = nextSub ? getCatalogMedicines(nextMain, nextSub) : [];
      const customMeds = nextSub ? getCustomMedicines(nextMain, nextSub) : [];
      const allMeds = [...new Set([...catalogMeds, ...customMeds])];
      const visibleMeds = allMeds.filter((m) => !hiddenMeds.includes(m));
      const nextMed = visibleMeds[0] || "";
      return {
        ...prev,
        mainCategory: nextMain,
        subCategory: nextSub,
        category: nextSub || nextMain,
        medicineName: nextMed,
        unit: getCategoryUnit(nextMain, nextSub),
        containerType: getDefaultContainerType(nextMain, nextSub),
      };
    });
  };

  const renameCustomMainCategory = (oldValue, nextValue) => {
    const oldName = String(oldValue || "").trim();
    const newName = String(nextValue || "").trim();
    if (!oldName || !newName) return;
    if (oldName === newName) return;
    const custom = getCustomMainCategories();
    if (!custom.includes(oldName)) {
      showToast("Only custom categories can be edited");
      return;
    }
    const allMain = [...new Set([...catalogMainCategories, ...custom])];
    if (allMain.includes(newName)) {
      showToast("Category already exists");
      return;
    }

    try {
      const raw =
        localStorage.getItem(`${storageNamespace}_custom_main_categories`) || "[]";
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : [];
      const nextList = list.map((x) => (x === oldName ? newName : x));
      localStorage.setItem(
        `${storageNamespace}_custom_main_categories`,
        JSON.stringify(Array.from(new Set(nextList)).filter(Boolean)),
      );
    } catch {}

    const remapObjectKey = (storageKey) => {
      try {
        const raw = localStorage.getItem(storageKey) || "{}";
        const map = JSON.parse(raw);
        if (!map || typeof map !== "object") return;
        if (!Object.prototype.hasOwnProperty.call(map, oldName)) return;
        const existing = Array.isArray(map[newName]) ? map[newName] : [];
        const moved = Array.isArray(map[oldName]) ? map[oldName] : [];
        map[newName] = Array.from(new Set([...existing, ...moved])).filter(Boolean);
        delete map[oldName];
        localStorage.setItem(storageKey, JSON.stringify(map));
      } catch {}
    };

    remapObjectKey(`${storageNamespace}_custom_sub_categories`);
    remapObjectKey(`${storageNamespace}_custom_medicines`);
    remapObjectKey(`${storageNamespace}_hidden_sub_categories`);
    remapObjectKey(`${storageNamespace}_hidden_medicines`);
    remapObjectKey(`${storageNamespace}_custom_units`);
    remapObjectKey(`${storageNamespace}_custom_containers`);
    showToast(`Category renamed to "${newName}"`);
    setRefreshTick((t) => t + 1);
  };

  const mainCategoryOptions = useMemo(() => {
    const hidden = getHiddenMainCategories(storageNamespace);
    const custom = getCustomMainCategories(storageNamespace);
    const merged = [...new Set([...catalogMainCategories, ...custom])];
    const base = merged.filter((mc) => !hidden.includes(mc));
    const list = [...base];
    if (formData.mainCategory && !list.includes(formData.mainCategory))
      list.push(formData.mainCategory);
    return list.map((mc) => ({ value: mc, label: formatCatalogLabel(mc) }));
  }, [formData.mainCategory, storageNamespace]);

  const subCategoryOptions = useMemo(() => {
    if (!formData.mainCategory) return [];
    const hidden = getHiddenSubCategories(formData.mainCategory, storageNamespace);
    const catalogSubs = getSubCategories(formData.mainCategory);
    const customSubs = getCustomSubCategories(formData.mainCategory, storageNamespace);
    const merged = [...new Set([...catalogSubs, ...customSubs])];
    const base = merged.filter((sc) => !hidden.includes(sc));
    const list = [...base];
    if (formData.subCategory && !list.includes(formData.subCategory))
      list.push(formData.subCategory);
    return list.map((sc) => ({ value: sc, label: formatCatalogLabel(sc) }));
  }, [formData.mainCategory, formData.subCategory, storageNamespace]);

  const medicineOptions = useMemo(() => {
    if (!formData.mainCategory || !formData.subCategory) return [];
    const hidden = getHiddenMedicines(formData.mainCategory, formData.subCategory, storageNamespace);
    const catalogMeds = getCatalogMedicines(formData.mainCategory, formData.subCategory);
    const customMeds = getCustomMedicines(formData.mainCategory, formData.subCategory, storageNamespace);
    const merged = [...new Set([...catalogMeds, ...customMeds])];
    const base = merged.filter((med) => !hidden.includes(med));
    const list = [...base];
    if (formData.medicineName && !list.includes(formData.medicineName))
      list.push(formData.medicineName);
    return list.map((med) => ({ value: med, label: med }));
  }, [
    formData.mainCategory,
    formData.subCategory,
    formData.medicineName,
    storageNamespace,
  ]);

  const unitOptions = useMemo(() => {
    const base = getUnitOptionsForCategory(formData.mainCategory, formData.subCategory);
    const key = getCategoryKey(formData.mainCategory, formData.subCategory);
    const custom = getCustomUnitsForKey(key, storageNamespace);
    const opts = [...new Set([...(base || []), ...(custom || [])])];
    if (formData.unit && !opts.includes(formData.unit))
      return [...opts, formData.unit];
    return opts;
  }, [
    formData.mainCategory,
    formData.subCategory,
    formData.unit,
    storageNamespace,
  ]);

  const containerOptions = useMemo(() => {
    const base = getContainerOptions(formData.mainCategory, formData.subCategory);
    const key = getCategoryKey(formData.mainCategory, formData.subCategory);
    const custom = getCustomContainersForKey(key, storageNamespace);
    const opts = [...new Set([...(base || []), ...(custom || [])])];
    if (formData.containerType && !opts.includes(formData.containerType))
      return [...opts, formData.containerType];
    return opts;
  }, [
    formData.mainCategory,
    formData.subCategory,
    formData.containerType,
    storageNamespace,
  ]);

  useEffect(() => {
    fetchMedicines();
    fetchAlerts();
    fetchSuppliers();
    fetchCompanies();
    fetchPurchaseDrafts();
  }, []);

  useEffect(() => {
    filterMedicines();
    setCurrentPage(1);
  }, [medicines, purchaseDrafts, searchQuery, selectedMainCategory, selectedSubCategory, activeTab]);

  const fetchMedicines = async () => {
    try {
      setLoading(true);
      const response = await medicinesAPI.getAll();
      const normalized = (response.data || []).map(hydrateMedicine);
      setMedicines(normalized);
    } catch (error) {
      showToast("Error fetching medicines");
      console.error("Fetch medicines error:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPurchaseDrafts = async () => {
    try {
      // Fetch both 'pending' and 'partial' drafts so partially-reviewed invoices stay visible
      const [pendingRes, partialRes] = await Promise.all([
        purchaseDraftsAPI.getAll({ status: 'pending' }),
        purchaseDraftsAPI.getAll({ status: 'partial' }),
      ]);
      const combined = [
        ...(pendingRes.data || []),
        ...(partialRes.data || []),
      ];
      // Sort by submittedAt descending
      combined.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
      setPurchaseDrafts(combined);
    } catch (error) {
      showToast("Error fetching purchase drafts");
      console.error("Fetch purchase drafts error:", error);
    }
  };

  const handleApproveDraft = async (draftId) => {
    try {
      setLoading(true);
      await purchaseDraftsAPI.approve(draftId, { reviewedBy: "Admin" });
      showToast("All items approved and added to inventory");

      // Delete the draft after all items are approved
      try {
        await purchaseDraftsAPI.delete(draftId);
        console.log("Purchase draft deleted after full approval:", draftId);
      } catch (deleteErr) {
        console.error("Error deleting draft after approval:", deleteErr);
      }

      fetchPurchaseDrafts();
      fetchMedicines();
    } catch (error) {
      showToast(error.message || "Error approving purchase draft");
    } finally {
      setLoading(false);
    }
  };

  const handleRejectDraft = async (draftId, reason = "") => {
    try {
      setLoading(true);
      await purchaseDraftsAPI.reject(draftId, { reviewedBy: "Admin", reviewComments: reason });
      showToast("All items rejected");

      // Delete the draft after all items are rejected
      try {
        await purchaseDraftsAPI.delete(draftId);
        console.log("Purchase draft deleted after full rejection:", draftId);
      } catch (deleteErr) {
        console.error("Error deleting draft after rejection:", deleteErr);
      }

      fetchPurchaseDrafts();
    } catch (error) {
      showToast(error.message || "Error rejecting purchase draft");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveItem = async (draftId, itemId) => {
    try {
      setLoading(true);
      await purchaseDraftsAPI.approveItem(draftId, itemId, { reviewedBy: "Admin" });
      showToast("Item approved and added to inventory");

      // Check if all items in the draft are now processed (approved or rejected)
      try {
        const draftRes = await purchaseDraftsAPI.getById(draftId);
        const draft = draftRes.data;
        const allItems = draft?.items || [];
        const allProcessed = allItems.length > 0 && allItems.every(
          item => item.itemStatus === "approved" || item.itemStatus === "rejected"
        );

        if (allProcessed) {
          await purchaseDraftsAPI.delete(draftId);
          console.log("Purchase draft deleted after all items processed:", draftId);
          showToast("All items processed - draft deleted");
        }
      } catch (checkErr) {
        console.error("Error checking draft status after item approval:", checkErr);
      }

      fetchPurchaseDrafts();
      fetchMedicines();
    } catch (error) {
      showToast(error.message || "Error approving item");
    } finally {
      setLoading(false);
    }
  };

  const handleRejectItem = async (draftId, itemId, reason = "") => {
    try {
      setLoading(true);
      await purchaseDraftsAPI.rejectItem(draftId, itemId, { reviewedBy: "Admin", reviewComments: reason });
      showToast("Item rejected");

      // Check if all items in the draft are now processed (approved or rejected)
      try {
        const draftRes = await purchaseDraftsAPI.getById(draftId);
        const draft = draftRes.data;
        const allItems = draft?.items || [];
        const allProcessed = allItems.length > 0 && allItems.every(
          item => item.itemStatus === "approved" || item.itemStatus === "rejected"
        );

        if (allProcessed) {
          await purchaseDraftsAPI.delete(draftId);
          console.log("Purchase draft deleted after all items processed:", draftId);
          showToast("All items processed - draft deleted");
        }
      } catch (checkErr) {
        console.error("Error checking draft status after item rejection:", checkErr);
      }

      fetchPurchaseDrafts();
    } catch (error) {
      showToast(error.message || "Error rejecting item");
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      const [lowStockRes, expiringRes, expiredRes] = await Promise.all([
        medicinesAPI.getLowStock(),
        medicinesAPI.getExpiring(),
        medicinesAPI.getExpired(),
      ]);
      setAlerts({
        lowStock: lowStockRes.data?.length || 0,
        expiring: expiringRes.data?.length || 0,
        expired: expiredRes.data?.length || 0,
      });
    } catch (error) {
      console.error("Fetch alerts error:", error);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await resolvedSuppliersAPI.getAll(portalName, "active");
      const list = (response.data || []).map((s) => ({
        id: s._id,
        _id: s._id,
        name: s.supplierName || s.name || "",
      }));
      setSuppliers(list);
      try {
        localStorage.setItem(`${storageNamespace}_suppliers`, JSON.stringify(list));
      } catch {}
    } catch (error) {
      console.error("Fetch suppliers error:", error);
      try {
        const storedSuppliers = localStorage.getItem(`${storageNamespace}_suppliers`);
        if (storedSuppliers) {
          setSuppliers(JSON.parse(storedSuppliers));
        } else {
          setSuppliers([]);
        }
      } catch {}
    }
  };

  const fetchCompanies = async () => {
    try {
      const response = await resolvedCompaniesAPI.getAll(portalName, "active");
      setCompanies(response.data || []);
    } catch (error) {
      console.error("Fetch companies error:", error);
    }
  };

  const filterMedicines = () => {
    if (activeTab === "pending") {
      // For pending review tab, show purchase drafts instead of medicines
      let filtered = purchaseDrafts;
      
      if (searchQuery) {
        filtered = filtered.filter(
          (draft) =>
            draft.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            draft.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
            draft.items.some(item => 
              item.medicineName.toLowerCase().includes(searchQuery.toLowerCase())
            )
        );
      }
      
      setFilteredDrafts(filtered);
      setFilteredMedicines([]); // Clear medicines when showing drafts
      return;
    }

    // Regular medicine filtering for other tabs
    let filtered = medicines;

    if (searchQuery) {
      filtered = filtered.filter(
        (med) =>
          med.medicineName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (med.batchNo || "")
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          (med.barcode || "").toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    if (selectedMainCategory !== "All") {
      filtered = filtered.filter((med) =>
        optionEquals(med.mainCategory, selectedMainCategory),
      );
    }

    if (selectedSubCategory) {
      filtered = filtered.filter((med) =>
        optionEquals(med.subCategory || med.category, selectedSubCategory),
      );
    }

    // Tab filter for medicines
    if (activeTab === "low_stock") {
      filtered = filtered.filter(
        (med) => med.quantity <= med.lowStockThreshold && med.quantity > 0,
      );
    } else if (activeTab === "expiring") {
      filtered = filtered.filter((med) => isExpiringSoon(med.expiryDate));
    } else if (activeTab === "out_of_stock") {
      filtered = filtered.filter((med) => Number(med.quantity || 0) === 0);
    }

    setFilteredMedicines(filtered);
    setFilteredDrafts([]); // Clear drafts when showing medicines
  };

  // Helper function to get total items count for pagination
  const getTotalItemsCount = () => {
    if (activeTab === "pending") {
      return filteredDrafts.reduce((total, draft) => total + (draft.items?.length || 0), 0);
    }
    return filteredMedicines.length;
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(""), 3000);
  };

  const createEditDraftAndNavigate = async (medicine) => {
    try {
      setLoading(true);
      // Create a draft item from the existing medicine
      const draftItem = {
        mainCategory: medicine.mainCategory || "",
        subCategory: medicine.subCategory || "",
        category: medicine.subCategory || medicine.mainCategory || medicine.category || "",
        medicineName: medicine.medicineName || "",
        genericName: medicine.genericName || "",
        batchNo: medicine.batchNo || "",
        barcode: medicine.barcode || "",
        expiryDate: medicine.expiryDate,
        qtyPacks: medicine.qtyPacks || 0,
        unitsPerPack: medicine.unitsPerPack || 1,
        buyPerPack: medicine.buyPerPack || 0,
        salePerPack: medicine.salePerPack || 0,
        totalItems: medicine.totalItems || (medicine.quantity || 0),
        buyPerUnit: medicine.purchasePrice || 0,
        salePerUnit: medicine.salePrice || 0,
        minStock: medicine.minStock || 0,
        defaultDiscount: medicine.defaultDiscount || 0,
        lineTaxType: medicine.lineTaxType || "%",
        lineTaxValue: medicine.lineTaxValue || 0,
        unit: medicine.unit || "pieces",
        containerType: medicine.containerType || "",
        itemStatus: "pending",
        // Store the original medicine ID so we know which to update when approving!
        originalMedicineId: medicine._id || medicine.id,
      };

      // Create the draft payload
      const draftPayload = {
        invoiceNo: medicine.invoiceNo || `EDIT-${Date.now()}`,
        invoiceDate: new Date(),
        portal: portalName,
        supplierName: medicine.supplierName || "Unknown",
        supplierId: medicine.supplierId || undefined,
        companyId: medicine.companyId || undefined,
        items: [draftItem],
        invoiceTaxes: [],
        grossTotal: draftItem.qtyPacks * draftItem.buyPerPack,
        totalLineTaxes: 0,
        totalInvoiceTaxes: 0,
        netTotal: draftItem.qtyPacks * draftItem.buyPerPack,
        status: "pending",
      };

      // Create the draft
      const res = await purchaseDraftsAPI.create(draftPayload);
      const newDraft = res.data;
      
      // Navigate to add invoice page with the new draft ID!
      navigate(addInvoicePath || `${basePath}/add-invoice`, { state: { draftId: newDraft._id || newDraft.id } });
    } catch (err) {
      console.error("Error creating edit draft:", err);
      showToast("Failed to create edit draft!");
    } finally {
      setLoading(false);
    }
  };

  const openModal = async (medicine = null) => {
    fetchSuppliers();
    fetchCompanies();
    setInvoiceItems([createEmptyItem()]);
    if (medicine) {
      let full = medicine;
      try {
        const resp = await medicinesAPI.getById(
          medicine._id || medicine.id,
        );
        if (resp && resp.data) full = resp.data;
      } catch {}
      const hydrated = hydrateMedicine(full);
      setEditingMedicine(medicine);
      const supplierExists = suppliers.some(
        (supplier) => supplier.name === hydrated.supplierName,
      );
      setShowOtherSupplier(!supplierExists && hydrated.supplierName);

      setSupplierSelection(
        supplierExists
          ? hydrated.supplierName || ""
          : hydrated.supplierName
            ? "other"
            : "",
      );

      setFormData({
        ...createEmptyForm(),
        ...hydrated,
        category: hydrated.subCategory || hydrated.category,
        expiryDate: hydrated.expiryDate?.split("T")[0] || "",
        purchaseDate: hydrated.purchaseDate?.split("T")[0] || "",
        unit:
          hydrated.unit ||
          getCategoryUnit(hydrated.mainCategory, hydrated.subCategory),
        containerType:
          hydrated.containerType ||
          getDefaultContainerType(hydrated.mainCategory, hydrated.subCategory),
        batchNo: hydrated.batchNo || "",
        barcode: hydrated.barcode || "",
        purchasePrice: hydrated.purchasePrice || 0,
        salePrice: hydrated.salePrice || 0,
        minSalePrice: hydrated.minSalePrice || 0,
        supplierName: hydrated.supplierName || "",
        lowStockThreshold: hydrated.lowStockThreshold || 10,
        description: hydrated.description || "",
        mlPerVial: hydrated.mlPerVial || 0,
        remainingMl: hydrated.remainingMl || hydrated.mlPerVial || 0,
        invoiceNo: hydrated.invoiceNo || "",
        invoiceDate: hydrated.invoiceDate?.split("T")[0] || new Date().toISOString().split("T")[0],
      });
      setMlPerVialInput(String(hydrated.mlPerVial || 0));
      setMlPerVialOriginal(Number(hydrated.mlPerVial || 0));
    } else {
      setEditingMedicine(null);
      setShowOtherSupplier(false);
      setSupplierSelection("");
      setFormData({
        ...createEmptyForm(),
        mainCategory:
          selectedMainCategory !== "All"
            ? selectedMainCategory
            : createEmptyForm().mainCategory,
        subCategory: selectedSubCategory || createEmptyForm().subCategory,
        category: selectedSubCategory || createEmptyForm().category,
      });
      setMlPerVialInput("0");
      setMlPerVialOriginal(0);
    }
    setShowModal(true);
  };

  const openConfirmDialog = (config) => {
    setConfirmDialog({
      title: config.title || "Are you sure?",
      message: config.message || "",
      confirmLabel: config.confirmLabel || "Confirm",
      cancelLabel: config.cancelLabel || "Cancel",
      variant: config.variant || "danger",
      onConfirm: config.onConfirm || null,
    });
  };

  const handleAddCompany = async () => {
    const name = (newCompanyData.supplierName || "").trim();
    if (!name) return;
    try {
      await resolvedSuppliersAPI.create({
        supplierName: name,
        contactPerson: newCompanyData.contactPerson || "",
        phone: newCompanyData.phone || "",
        email: newCompanyData.email || "",
        address: "",
        city: "",
        category: "",
        notes: "",
        portal: portalName,
      });
      await fetchSuppliers();
      setSupplierSelection(name);
      setFormData((prev) => ({ ...prev, supplierName: name }));
      setShowOtherSupplier(false);
      setShowAddCompanyModal(false);
      setNewCompanyData({ supplierName: "", contactPerson: "", phone: "", email: "" });
      showToast("Company added successfully");
    } catch (err) {
      showToast(err.message || "Error adding company");
    }
  };

  // Add Supplier from Invoice Details
  const handleAddSupplierInv = async (e) => {
    e.preventDefault();
    if (!newSupplierInvData.name.trim()) return;
    try {
      setSavingSupplier(true);
      const created = await resolvedSuppliersAPI.create({
        supplierName: newSupplierInvData.name.trim(),
        phone: newSupplierInvData.phone || "",
        address: newSupplierInvData.address || "",
        taxId: newSupplierInvData.taxId || "",
        status: newSupplierInvData.status || "active",
        companyId: newSupplierInvData.companyId || null,
        portal: portalName,
        contactPerson: "", email: "", city: "", notes: "",
      });
      await fetchSuppliers();
      const newName = newSupplierInvData.name.trim();
      setSupplierSelection(newName);
      setFormData((prev) => ({ ...prev, supplierName: newName }));
      setShowAddSupplierInvModal(false);
      setNewSupplierInvData({ name: "", companyId: "", phone: "", address: "", taxId: "", status: "active" });
      showToast("Supplier added");
    } catch (err) {
      showToast(err.message || "Error adding supplier");
    } finally {
      setSavingSupplier(false);
    }
  };

  // Add Company from Invoice Details
  const handleAddCompanyInv = async (e) => {
    e.preventDefault();
    if (!newCompanyInvData.companyName.trim()) return;
    try {
      setSavingCompany(true);
      await resolvedCompaniesAPI.create({
        companyName: newCompanyInvData.companyName.trim(),
        status: newCompanyInvData.status || "active",
        portal: portalName,
      });
      await fetchCompanies();
      setFormData((prev) => {
        const match = companies.find(c => c.companyName === newCompanyInvData.companyName.trim());
        return { ...prev, companyId: match?._id || prev.companyId };
      });
      setShowAddCompanyInvModal(false);
      setNewCompanyInvData({ companyName: "", status: "active" });
      showToast("Company added");
    } catch (err) {
      showToast(err.message || "Error adding company");
    } finally {
      setSavingCompany(false);
    }
  };

  const handleConfirmDialogConfirm = () => {
    if (confirmDialog && typeof confirmDialog.onConfirm === "function") {
      confirmDialog.onConfirm();
    }
    setConfirmDialog(null);
  };

  const handleConfirmDialogCancel = () => {
    setConfirmDialog(null);
  };
  const handleMainCategorySelect = (value) => {
    const main = value || "";

    if (!main) {
      setFormData((prev) => ({
        ...prev,
        mainCategory: "",
        subCategory: "",
        category: "",
        medicineName: "",
        unit: getCategoryUnit("", ""),
        containerType: "",
      }));
      setMlPerVialInput(String(formData.mlPerVial || 0));
      return;
    }

    const hiddenSubs = getHiddenSubCategories(main, storageNamespace);
    const catalogSubs = getSubCategories(main);
    const customSubs = getCustomSubCategories(main, storageNamespace);
    const mergedSubs = [...new Set([...catalogSubs, ...customSubs])].filter(
      (sc) => !hiddenSubs.includes(sc),
    );
    const sub = mergedSubs[0] || "";

    const hiddenMeds = sub ? getHiddenMedicines(main, sub, storageNamespace) : [];
    const catalogMeds = sub ? getCatalogMedicines(main, sub) : [];
    const customMeds = sub ? getCustomMedicines(main, sub, storageNamespace) : [];
    const mergedMeds = [...new Set([...catalogMeds, ...customMeds])].filter(
      (m) => !hiddenMeds.includes(m),
    );
    const med = mergedMeds[0] || "";

    setFormData((prev) => ({
      ...prev,
      mainCategory: main,
      subCategory: sub,
      category: sub || main,
      medicineName: med,
      unit: getCategoryUnit(main, sub),
      containerType: getDefaultContainerType(main, sub),
    }));
    setMlPerVialInput(String(formData.mlPerVial || 0));
  };

  const handleSubCategorySelect = (value) => {
    const main = formData.mainCategory || "";
    if (!main) return;
    const sub = value || "";

    if (!sub) {
      setFormData((prev) => ({
        ...prev,
        subCategory: "",
        category: main,
        medicineName: "",
        unit: getCategoryUnit(main, ""),
        containerType: getDefaultContainerType(main, ""),
      }));
      setMlPerVialInput(String(formData.mlPerVial || 0));
      return;
    }

    const hiddenMeds = getHiddenMedicines(main, sub, storageNamespace);
    const catalogMeds = getCatalogMedicines(main, sub);
    const customMeds = getCustomMedicines(main, sub, storageNamespace);
    const mergedMeds = [...new Set([...catalogMeds, ...customMeds])].filter(
      (m) => !hiddenMeds.includes(m),
    );
    const med = mergedMeds[0] || "";

    setFormData((prev) => ({
      ...prev,
      subCategory: sub,
      category: sub,
      medicineName: med,
      unit: getCategoryUnit(main, sub),
      containerType: getDefaultContainerType(main, sub),
    }));
    setMlPerVialInput(String(formData.mlPerVial || 0));
  };

  const handleMedicineSelect = (value) => {
    setFormData((prev) => ({ ...prev, medicineName: value || "" }));
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingMedicine(null);
    setSupplierSelection("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let resolvedSupplierName = (formData.supplierName || "").trim();

      if (supplierSelection === "other") {
        if (!resolvedSupplierName) {
          throw new Error("Supplier name is required");
        }

        const existing = suppliers.find((s) =>
          optionEquals(s.name || "", resolvedSupplierName),
        );
        if (!existing) {
          await resolvedSuppliersAPI.create({
            supplierName: resolvedSupplierName,
            contactPerson: "",
            phone: "",
            email: "",
            address: "",
            city: "",
            category: "",
            notes: "",
            portal: portalName,
          });
        }
        await fetchSuppliers();
      } else {
        resolvedSupplierName = (
          supplierSelection || resolvedSupplierName
        ).trim();
      }

      const payload = {
        ...formData,
        supplierName: resolvedSupplierName,
        mlPerVial: Number.isFinite(Number(mlPerVialInput))
          ? Number(mlPerVialInput)
          : formData.mlPerVial,
      };
      if (editingMedicine) {
        await medicinesAPI.update(editingMedicine._id, payload);
        showToast("Medicine updated successfully");
      } else {
        // Create one medicine record per invoice item
        for (const item of invoiceItems) {
          const uPack = item.unitsPerPack || 1;
          const itemPayload = {
            ...formData,
            supplierName: resolvedSupplierName,
            mainCategory: item.mainCategory,
            subCategory: item.subCategory,
            category: item.subCategory || item.mainCategory,
            medicineName: item.medicineName,
            batchNo: item.batchNo,
            barcode: item.barcode,
            expiryDate: item.expiryDate,
            genericName: item.genericName,
            qtyPacks: item.qtyPacks,
            unitsPerPack: uPack,
            buyPerPack: item.buyPerPack,
            salePerPack: item.salePerPack,
            quantity: (item.qtyPacks || 0) * uPack,
            purchasePrice: uPack > 0 ? +((item.buyPerPack || 0) / uPack).toFixed(4) : 0,
            salePrice: uPack > 0 ? +((item.salePerPack || 0) / uPack).toFixed(4) : 0,
            lowStockThreshold: item.minStock || 10,
            minStock: item.minStock || 0,
            defaultDiscount: item.defaultDiscount || 0,
            lineTaxType: item.lineTaxType || "%",
            lineTaxValue: item.lineTaxValue || 0,
            unit: item.unit || getCategoryUnit(item.mainCategory, item.subCategory),
            containerType: item.containerType || getDefaultContainerType(item.mainCategory, item.subCategory),
            mlPerVial: 0,
          };
          const response = await medicinesAPI.create(itemPayload);
          // Update supplier purchase history per item
          if (itemPayload.purchasePrice > 0 && itemPayload.quantity > 0) {
            try {
              const supplier = suppliers.find((s) =>
                optionEquals(s.name || s.supplierName, resolvedSupplierName),
              );
              if (supplier) {
                await resolvedSuppliersAPI.addPurchase(supplier._id || supplier.id, {
                  productName: itemPayload.medicineName,
                  quantity: Number(itemPayload.quantity),
                  unitPrice: Number(itemPayload.purchasePrice),
                  invoiceNumber: formData.invoiceNo || `MED-${Date.now()}`,
                  totalPrice: Number(itemPayload.purchasePrice) * Number(itemPayload.quantity),
                  portal: portalName,
                });
              }
            } catch (supErr) {
              console.error("Error updating supplier purchase history:", supErr);
            }
          }
        }
        showToast(`${invoiceItems.length} medicine(s) added successfully`);
      }
      fetchMedicines();
      fetchAlerts();
      closeModal();
    } catch (error) {
      showToast(error.message || "Error saving medicine");
    }
  };

  const openDeleteModal = (medicine) => {
    setMedicineToDelete(medicine);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!medicineToDelete) return;

    try {
      await medicinesAPI.delete(medicineToDelete._id);
      showToast("Medicine deleted successfully");
      fetchMedicines();
      fetchAlerts();
      setShowDeleteModal(false);
      setMedicineToDelete(null);
    } catch (error) {
      showToast("Error deleting medicine");
      setShowDeleteModal(false);
    }
  };

  const isExpired = (expiryDate) => {
    return new Date(expiryDate) < new Date();
  };

  const isExpiringSoon = (expiryDate) => {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const expiry = new Date(expiryDate);
    return expiry <= thirtyDaysFromNow && expiry >= new Date();
  };

  const exportToCSV = () => {
    const headers = [
      "Medicine Name",
      "Batch No",
      "Category",
      "Quantity",
      "Unit",
      "Purchase Price",
      "Sale Price",
      "Expiry Date",
      "Supplier",
      "Status",
    ];
    const rows = filteredMedicines.map((med) => [
      med.medicineName,
      med.batchNo,
      med.category,
      med.quantity,
      med.unit,
      med.purchasePrice,
      med.salePrice,
      new Date(med.expiryDate).toLocaleDateString(),
      med.supplierName,
      med.quantity <= med.lowStockThreshold
        ? "Low Stock"
        : isExpired(med.expiryDate)
          ? "Expired"
          : isExpiringSoon(med.expiryDate)
            ? "Expiring Soon"
            : "OK",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pharmacy-inventory-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const buildStatus = (med) => {
    if (med.quantity <= med.lowStockThreshold) return "Low Stock";
    if (isExpired(med.expiryDate)) return "Expired";
    if (isExpiringSoon(med.expiryDate)) return "Expiring Soon";
    return "OK";
  };

  const exportToExcelDetailed = async () => {
    try {
      setLoading(true);
      const salesRes = await salesAPI.getAll();
      const sales = Array.isArray(salesRes?.data) ? salesRes.data : [];
      const agg = new Map();
      sales.forEach((sale) => {
        const items = Array.isArray(sale.items) ? sale.items : [];
        items.forEach((it) => {
          const key =
            it.medicineId ||
            it.medicineName ||
            `${it.medicineName}-${it.batchNo}`;
          if (!agg.has(key))
            agg.set(key, {
              soldUnits: 0,
              soldMl: 0,
              billedUnits: 0,
              salesCount: 0,
            });
          const acc = agg.get(key);
          if ((it.category || "").toLowerCase() === "injection") {
            const ml = Number(it.mlUsed || 0);
            const units = Math.max(1, Math.ceil(ml));
            acc.soldMl += ml;
            acc.billedUnits += units;
          } else {
            acc.soldUnits += Number(it.quantity || 0);
          }
          acc.salesCount += 1;
        });
      });

      const rows = filteredMedicines.map((m) => {
        const key = m._id || `${m.medicineName}-${m.batchNo}`;
        const a = agg.get(key) || {
          soldUnits: 0,
          soldMl: 0,
          billedUnits: 0,
          salesCount: 0,
        };
        return {
          ID: m._id,
          Barcode: m.barcode || "",
          MedicineName: m.medicineName,
          BatchNo: m.batchNo || "",
          MainCategory: m.mainCategory || "",
          Category: m.subCategory || m.category || "",
          ContainerType: m.containerType || "",
          Unit: m.unit,
          QuantityInStock: m.quantity,
          MLperContainer: Number(m.mlPerVial || 0),
          RemainingML: Number(m.remainingMl || m.mlPerVial || 0),
          PurchasePrice: Number(m.purchasePrice || 0),
          SalePrice: Number(m.salePrice || 0),
          Supplier: m.supplierName || "",
          PurchaseDate: m.purchaseDate
            ? new Date(m.purchaseDate).toLocaleDateString()
            : "",
          ExpiryDate: m.expiryDate
            ? new Date(m.expiryDate).toLocaleDateString()
            : "",
          Status: buildStatus(m),
          TotalSoldUnits: a.soldUnits,
          TotalSoldML: Number(a.soldMl.toFixed(2)),
          BilledUnitsFromInjections: a.billedUnits,
          SalesEntries: a.salesCount,
          Description: m.description || "",
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Inventory");
      const fileName = `pharmacy-inventory-detailed-${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      showToast("Exported inventory to Excel");
    } catch (e) {
      console.error("Export error:", e);
      showToast("Export failed");
    } finally {
      setLoading(false);
    }
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const parseDate = (val) => {
    try {
      if (!val) return "";
      if (val instanceof Date) return val.toISOString().split("T")[0];
      const d = new Date(val);
      if (!isNaN(d)) return d.toISOString().split("T")[0];
      return "";
    } catch {
      return "";
    }
  };

  const handleImportFile = async (e) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      setLoading(true);
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const existingByBarcode = new Map(
        (medicines || [])
          .filter((m) => m.barcode)
          .map((m) => [String(m.barcode).toLowerCase(), m]),
      );
      const normalizeBc = (v) =>
        String(v || "")
          .trim()
          .toLowerCase();
      const knownByBarcode = new Map(existingByBarcode);
      const tryFindExisting = async (barcode) => {
        const bc = normalizeBc(barcode);
        if (!bc) return null;
        let existing = knownByBarcode.get(bc);
        if (existing && existing._id) return existing;
        try {
          const direct = await medicinesAPI.findByBarcode(barcode);
          const med = direct?.data || (direct && direct.success && direct.data);
          if (med && med._id) return med;
        } catch {}
        try {
          const res = await medicinesAPI.search(barcode);
          const list = Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res)
              ? res
              : [];
          existing = (list || []).find((m) => normalizeBc(m.barcode) === bc);
          if (existing && existing._id) return existing;
        } catch {}
        try {
          const all = await medicinesAPI.getAll();
          const list = Array.isArray(all?.data)
            ? all.data
            : Array.isArray(all)
              ? all
              : [];
          existing = (list || []).find((m) => normalizeBc(m.barcode) === bc);
          return existing || null;
        } catch {
          return null;
        }
      };

      const upsertByBarcode = async (payload) => {
        const bc = normalizeBc(payload.barcode);
        if (bc) {
          let existing = await tryFindExisting(payload.barcode);
          if (existing && existing._id) {
            await medicinesAPI.update(existing._id, payload);
            knownByBarcode.set(bc, existing);
            return "updated";
          }
        }
        try {
          const created = await medicinesAPI.create(payload);
          if (bc) {
            const id = created?.data?._id || created?._id;
            if (id) knownByBarcode.set(bc, { _id: id });
          }
          return "created";
        } catch (err) {
          const msg = (
            err?.response?.message ||
            err?.message ||
            ""
          ).toLowerCase();
          if (msg.includes("barcode") && msg.includes("exists")) {
            try {
              const existing = await tryFindExisting(payload.barcode);
              if (existing && existing._id) {
                await medicinesAPI.update(existing._id, payload);
                knownByBarcode.set(bc, existing);
                return "updated";
              }
            } catch {}
          }
          throw err;
        }
      };
      let created = 0,
        updated = 0,
        erroPKR = 0;
      const toNum = (v, d = 0) => {
        if (typeof v === "number") return isFinite(v) ? v : d;
        if (!v) return d;
        const n = parseFloat(String(v).replace(/,/g, ""));
        return isNaN(n) ? d : n;
      };
      for (const row of json) {
        const payload = {
          medicineName:
            row.MedicineName || row["Medicine Name"] || row.Name || "",
          batchNo: row.BatchNo || row["Batch No"] || row.Batch || "",
          barcode: row.Barcode || row["Bar Code"] || row.Code || "",
          mainCategory:
            row.MainCategory || row["Main Category"] || row.MainCat || "",
          subCategory:
            row.Category ||
            row.SubCategory ||
            row["Sub Category"] ||
            row.SubCat ||
            "",
          category:
            row.Category || row.SubCategory || row["Sub Category"] || "",
          unit: row.Unit || "",
          containerType: row.ContainerType || row["Container Type"] || "",
          quantity: toNum(row.QuantityInStock ?? row.Quantity ?? row.Qty, 0),
          mlPerVial: toNum(
            row.MLperContainer ?? row["ML per Vial"] ?? row.ML,
            0,
          ),
          remainingMl: toNum(row.RemainingML ?? row["Remaining ML"], 0),
          purchasePrice: toNum(row.PurchasePrice ?? row["Purchase Price"], 0),
          salePrice: toNum(row.SalePrice ?? row["Sale Price"], 0),
          supplierName: row.Supplier || row["Supplier Name"] || "",
          purchaseDate: parseDate(
            row.PurchaseDate || row["Purchase Date"] || "",
          ),
          expiryDate: parseDate(row.ExpiryDate || row["Expiry Date"] || ""),
          lowStockThreshold:
            toNum(row.LowStockThreshold ?? row["Low Stock Threshold"], 10) ||
            10,
          description: row.Description || "",
          isActive: true,
        };
        // Auto-calc remainingMl for injections if not provided
        if ((payload.category || "").toLowerCase() === "injection") {
          if (!payload.remainingMl && payload.mlPerVial && payload.quantity) {
            payload.remainingMl = payload.mlPerVial * payload.quantity;
          }
        }
        try {
          const result = await upsertByBarcode(payload);
          if (result === "updated") updated++;
          else if (result === "created") created++;
          else created++;
        } catch (err) {
          console.error("Import row error:", err);
          errors++;
        }
      }
      await fetchMedicines();
      showToast(
        `Import complete: ${created} created, ${updated} updated${erroPKR ? `, ${errors} failed` : ""}`,
      );
    } catch (err) {
      console.error("Import error:", err);
      showToast("Import failed");
    } finally {
      setLoading(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            {title}
          </h1>
          <p className="text-slate-500 mt-1">
            {subtitle}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportToExcelDetailed}
            className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg"
          >
            <FiDownload /> Export
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleImportFile}
          />
          <button
            onClick={handleImportClick}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
          >
            <FiUpload /> Import
          </button>
          <button
            onClick={() => navigate(addInvoicePath || `${basePath}/add-invoice`)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
          >
            <FiPlus /> Add Invoice
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Stock Value</p>
              <p className="text-xl font-bold mt-1">
                PKR {medicines
                  .reduce((sum, m) => sum + (Number(m.purchasePrice || 0) * Number(m.quantity || 0)), 0)
                  .toLocaleString()}
              </p>
            </div>
            <FiPackage className="w-12 h-12 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Low Stock</p>
              <p className="text-3xl font-bold mt-1">{alerts.lowStock}</p>
            </div>
            <FiAlertTriangle className="w-12 h-12 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Expiring Soon</p>
              <p className="text-3xl font-bold mt-1">{alerts.expiring}</p>
            </div>
            <FiClock className="w-12 h-12 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Expired</p>
              <p className="text-3xl font-bold mt-1">{alerts.expired}</p>
            </div>
            <FiPackage className="w-12 h-12 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-600 to-slate-700 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Out of Stock</p>
              <p className="text-3xl font-bold mt-1">
                {medicines.filter(m => Number(m.quantity || 0) === 0).length}
              </p>
            </div>
            <FiPackage className="w-12 h-12 opacity-80" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by medicine name, batch number, or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={selectedMainCategory}
              onChange={(e) => {
                setSelectedMainCategory(e.target.value);
                setSelectedSubCategory("");
              }}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {formatOptionLabel(cat)}
                </option>
              ))}
            </select>
            {selectedMainCategory !== "All" && (
              <select
                value={selectedSubCategory}
                onChange={(e) => setSelectedSubCategory(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">All Subcategories</option>
                {getSubCategories(selectedMainCategory).map((sub) => (
                  <option key={sub} value={sub}>
                    {formatCatalogLabel(sub)}
                  </option>
                ))}
              </select>
            )}
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  Show {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
          {[
            { key: "all", label: "All Items" },
            { key: "pending", label: "Pending Review", count: purchaseDrafts.reduce((n, d) => n + (d.items || []).filter(i => i.itemStatus === "pending").length, 0) },
            { key: "low_stock", label: "Low Stock" },
            { key: "expiring", label: "Expiring Soon" },
            { key: "out_of_stock", label: "Out of Stock" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
                activeTab === tab.key
                  ? "bg-purple-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  activeTab === tab.key 
                    ? "bg-white text-purple-600" 
                    : "bg-red-500 text-white"
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : activeTab === "pending" ? (
          // Purchase Drafts Table for Pending Review Tab - Show Individual Items
          filteredDrafts.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FiPackage className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>No purchase drafts pending review</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Invoice</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Medicine</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Quantity</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Buy / Pack</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Sale / Pack</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Line Total</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(() => {
                    // Flatten all items, then paginate
                    const allFlatItems = filteredDrafts.flatMap((draft) =>
                      (draft.items || []).map((item, idx) => ({
                        ...item,
                        _itemId:      item._id,
                        draftId:      draft._id,
                        invoiceNo:    draft.invoiceNo,
                        invoiceDate:  draft.invoiceDate,
                        supplierName: draft.supplierName,
                        submittedBy:  draft.submittedBy,
                        submittedAt:  draft.submittedAt,
                        netTotal:     draft.netTotal,
                        itemCount:    draft.items.length,
                        isFirstItem:  idx === 0,
                        draftStatus:  draft.status,
                      }))
                    );

                    const start = (currentPage - 1) * itemsPerPage;
                    return allFlatItems
                      .slice(start, start + itemsPerPage)
                      .map((item) => {
                        // Treat missing/undefined itemStatus as "pending" (old records)
                        const resolvedStatus = item.itemStatus || "pending";
                        const isPending  = resolvedStatus === "pending";
                        const isApproved = resolvedStatus === "approved";
                        const isRejected = resolvedStatus === "rejected";

                        // Row background tint based on item status
                        const rowBg = isApproved
                          ? "bg-green-50 hover:bg-green-100"
                          : isRejected
                          ? "bg-red-50 hover:bg-red-100"
                          : "hover:bg-slate-50";

                        return (
                          <tr key={`${item.draftId}-${item._itemId}`} className={rowBg}>
                            {/* Invoice column */}
                            <td className="px-4 py-3">
                              {item.isFirstItem ? (
                                <div>
                                  <p className="font-semibold text-slate-800 text-sm">{item.invoiceNo}</p>
                                  <p className="text-xs text-slate-500">{new Date(item.invoiceDate).toLocaleDateString()}</p>
                                  <p className="text-xs text-blue-600 font-medium">{item.supplierName}</p>
                                  <p className="text-xs text-slate-400 mt-0.5">
                                    {item.itemCount} item{item.itemCount !== 1 ? "s" : ""} · PKR {(item.netTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  </p>
                                </div>
                              ) : (
                                <p className="text-xs text-slate-400 pl-3">↳ {item.invoiceNo}</p>
                              )}
                            </td>

                            {/* Medicine column */}
                            <td className="px-4 py-3">
                              <p className="font-medium text-slate-800 text-sm">{item.medicineName}</p>
                              {item.genericName && <p className="text-xs text-slate-500">Generic: {item.genericName}</p>}
                              {item.batchNo     && <p className="text-xs text-slate-500">Batch: {item.batchNo}</p>}
                              {item.barcode     && <p className="text-xs text-slate-500">Barcode: {item.barcode}</p>}
                              {item.expiryDate  && (
                                <p className="text-xs text-slate-500">
                                  Exp: {new Date(item.expiryDate).toLocaleDateString()}
                                </p>
                              )}
                            </td>

                            {/* Category */}
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                                {item.subCategory || item.category || item.mainCategory}
                              </span>
                              {item.mainCategory && item.mainCategory !== (item.subCategory || item.category) && (
                                <p className="text-xs text-slate-400 mt-1">{item.mainCategory}</p>
                              )}
                            </td>

                            {/* Quantity */}
                            <td className="px-4 py-3">
                              <p className="font-medium text-slate-800 text-sm">{item.qtyPacks || 0} packs</p>
                              <p className="text-xs text-slate-500">{item.unitsPerPack || 1} items/pack</p>
                              <p className="text-xs text-blue-600 font-medium">
                                = {item.totalItems != null ? Number(item.totalItems) : (item.qtyPacks || 0) * (item.unitsPerPack || 1)} items
                              </p>
                            </td>

                            {/* Buy/Pack */}
                            <td className="px-4 py-3">
                              <p className="font-medium text-slate-800 text-sm">
                                PKR {(item.buyPerPack || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </p>
                              {item.buyPerUnit > 0 && (
                                <p className="text-xs text-slate-500">
                                  PKR {(item.buyPerUnit || 0).toFixed(2)}/{item.unit || "unit"}
                                </p>
                              )}
                            </td>

                            {/* Sale/Pack */}
                            <td className="px-4 py-3">
                              <p className="font-medium text-green-700 text-sm">
                                PKR {(item.salePerPack || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </p>
                              {item.salePerUnit > 0 && (
                                <p className="text-xs text-slate-500">
                                  PKR {(item.salePerUnit || 0).toFixed(2)}/{item.unit || "unit"}
                                </p>
                              )}
                            </td>

                            {/* Line Total */}
                            <td className="px-4 py-3">
                              <p className="font-semibold text-slate-800 text-sm">
                                PKR {(item.lineTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </p>
                              {item.taxAmt > 0 && (
                                <p className="text-xs text-slate-500">Tax: PKR {(item.taxAmt || 0).toFixed(2)}</p>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3">
                              {isPending ? (
                                <div className="flex flex-col gap-1.5">
                                  <button
                                    onClick={() => handleApproveItem(item.draftId, item._itemId)}
                                    disabled={loading}
                                    className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium w-full flex items-center justify-center gap-1"
                                  >
                                    ✓ Approve
                                  </button>
                                  <button
                                    onClick={() => navigate(addInvoicePath || `${basePath}/add-invoice`, { state: { draftId: item.draftId } })}
                                    disabled={loading}
                                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium w-full flex items-center justify-center gap-1"
                                  >
                                    <FiPlay className="w-3 h-3" /> Edit
                                  </button>
                                  <button
                                    onClick={() => {
                                      const reason = window.prompt("Reason for rejection (optional):");
                                      if (reason !== null) handleRejectItem(item.draftId, item._itemId, reason);
                                    }}
                                    disabled={loading}
                                    className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium w-full flex items-center justify-center gap-1"
                                  >
                                    ✗ Reject
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      });
                  })()}
                </tbody>
              </table>
            </div>
          )
        ) : (
          // Regular Medicines Table for Other Tabs
          filteredMedicines.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FiPackage className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>No medicines found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Medicine
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Batch No
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Current Stock
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Min Stock
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Purchase Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Sale Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Expiry
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredMedicines
                    .slice(
                      (currentPage - 1) * itemsPerPage,
                      currentPage * itemsPerPage,
                    )
                    .map((medicine) => (
                      <tr key={medicine._id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-slate-800">
                              {medicine.medicineName}
                            </p>
                            {medicine.barcode && (
                              <p className="text-xs text-slate-500">
                                Barcode: {medicine.barcode}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          {medicine.batchNo}
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                              {medicine.category}
                            </span>
                            {medicine.subCategory &&
                              medicine.subCategory !== medicine.category && (
                                <p className="text-xs text-slate-500 mt-1">
                                  {medicine.subCategory}
                                </p>
                              )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-medium ${
                                medicine.quantity <= medicine.lowStockThreshold
                                  ? "text-red-600"
                                  : "text-slate-800"
                              }`}
                            >
                              {medicine.quantity} {medicine.unit}
                            </span>
                            {medicine.category === "Injection" &&
                              medicine.remainingMl && (
                                <span className="text-xs text-slate-500">
                                  ({medicine.remainingMl} ml)
                                </span>
                              )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          <span className="text-sm">
                            {medicine.lowStockThreshold} {medicine.unit}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          <div>
                            <div className="font-medium">
                              PKR {medicine.purchasePrice}
                            </div>
                            {medicine.supplierName && (
                              <div className="text-xs text-slate-500">
                                {medicine.supplierName}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-semibold text-green-600">
                              PKR {medicine.salePrice}
                            </div>
                            {medicine.minSalePrice > 0 && (
                              <div className="text-xs text-slate-500">
                                Min: PKR {medicine.minSalePrice}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`text-sm ${isExpired(medicine.expiryDate) ? "text-red-600 font-semibold" : isExpiringSoon(medicine.expiryDate) ? "text-yellow-600 font-semibold" : "text-slate-600"}`}
                          >
                            {new Date(medicine.expiryDate).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {isExpired(medicine.expiryDate) ? (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                              Expired
                            </span>
                          ) : isExpiringSoon(medicine.expiryDate) ? (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                              Expiring Soon
                            </span>
                          ) : medicine.quantity <= medicine.lowStockThreshold ? (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                              Low Stock
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              OK
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openDeleteModal(medicine)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <FiTrash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Pagination */}
        {!loading && getTotalItemsCount() > itemsPerPage && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200">
            <p className="text-sm text-slate-500">
              Showing{" "}
              <span className="font-medium text-slate-700">
                {(currentPage - 1) * itemsPerPage + 1}
              </span>
              {" "}–{" "}
              <span className="font-medium text-slate-700">
                {Math.min(currentPage * itemsPerPage, getTotalItemsCount())}
              </span>
              {" "}of{" "}
              <span className="font-medium text-slate-700">
                {getTotalItemsCount()}
              </span>
              {activeTab === "pending" && (
                <span className="text-xs text-slate-400 ml-2">
                  (individual items from {filteredDrafts.length} invoice{filteredDrafts.length !== 1 ? 's' : ''})
                </span>
              )}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              {Array.from(
                { length: Math.ceil(getTotalItemsCount() / itemsPerPage) },
                (_, i) => i + 1
              )
                .filter((page) => {
                  const total = Math.ceil(getTotalItemsCount() / itemsPerPage);
                  if (total <= 5) return true;
                  if (page === 1 || page === total) return true;
                  if (page >= currentPage - 1 && page <= currentPage + 1) return true;
                  return false;
                })
                .map((page, idx, arr) => (
                  <React.Fragment key={page}>
                    {idx > 0 && arr[idx - 1] !== page - 1 && (
                      <span className="px-1 text-slate-400 text-sm">…</span>
                    )}
                    <button
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1 rounded-lg text-sm border ${
                        currentPage === page
                          ? "bg-purple-600 text-white border-purple-600"
                          : "border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {page}
                    </button>
                  </React.Fragment>
                ))}
              <button
                onClick={() =>
                  setCurrentPage((p) =>
                    Math.min(Math.ceil(getTotalItemsCount() / itemsPerPage), p + 1)
                  )
                }
                disabled={
                  currentPage >= Math.ceil(getTotalItemsCount() / itemsPerPage)
                }
                className="px-3 py-1 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-5xl max-h-[95vh] sm:max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">
                {editingMedicine ? "Edit Invoice" : "Add New Invoice"}
              </h3>
              <button
                onClick={closeModal}
                className="text-white hover:bg-white/20 p-2 rounded-lg"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              {/* Invoice Details Section */}
              <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50/60 p-4">
                <h4 className="text-sm font-semibold text-blue-700 mb-3 flex items-center gap-2">
                  <FiPackage className="w-4 h-4" /> Invoice Details
                </h4>
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
                          setFormData({ ...formData, supplierName: value });
                        }}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white text-sm"
                      >
                        <option value="">Select Supplier</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowAddSupplierInvModal(true)}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs whitespace-nowrap flex items-center gap-1"
                      >
                        <FiPlus className="w-3 h-3" /> Add
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
                        onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white text-sm"
                      >
                        <option value="">None</option>
                        {companies.map((c) => (
                          <option key={c._id} value={c._id}>{c.companyName}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowAddCompanyInvModal(true)}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs whitespace-nowrap flex items-center gap-1"
                      >
                        <FiPlus className="w-3 h-3" /> Add
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
                      onChange={(e) => setFormData({ ...formData, invoiceNo: e.target.value })}
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
                      required
                      value={formData.invoiceDate}
                      onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Invoice Items */}
              {invoiceItems.map((item, idx) => {
                const updateItem = (patch) =>
                  setInvoiceItems((prev) =>
                    prev.map((it) => (it.id === item.id ? { ...it, ...patch } : it))
                  );
                const uPack = item.unitsPerPack || 1;
                const subtotal = (item.qtyPacks || 0) * (item.buyPerPack || 0);
                const discount = subtotal * ((item.defaultDiscount || 0) / 100);
                const afterDiscount = subtotal - discount;
                const tax = item.lineTaxType === "%"
                  ? afterDiscount * ((item.lineTaxValue || 0) / 100)
                  : (item.lineTaxValue || 0);
                const lineTotal = afterDiscount + tax;
                const totalItems = (item.qtyPacks || 0) * uPack;

                // Per-item category options
                const itemMainCatOptions = (() => {
                  const hidden = getHiddenMainCategories();
                  const custom = getCustomMainCategories();
                  const merged = [...new Set([...catalogMainCategories, ...custom])];
                  return merged.filter((mc) => !hidden.includes(mc));
                })();
                const itemSubCatOptions = (() => {
                  if (!item.mainCategory) return [];
                  const hidden = getHiddenSubCategories(item.mainCategory);
                  const catalog = getSubCategories(item.mainCategory);
                  const custom = getCustomSubCategories(item.mainCategory);
                  return [...new Set([...catalog, ...custom])].filter((sc) => !hidden.includes(sc));
                })();
                const itemMedOptions = (() => {
                  if (!item.mainCategory || !item.subCategory) return [];
                  const hidden = getHiddenMedicines(item.mainCategory, item.subCategory);
                  const catalog = getCatalogMedicines(item.mainCategory, item.subCategory);
                  const custom = getCustomMedicines(item.mainCategory, item.subCategory);
                  return [...new Set([...catalog, ...custom])].filter((m) => !hidden.includes(m));
                })();

                return (
                  <div key={item.id} className="mt-4 rounded-xl border border-slate-200 bg-slate-50/50">
                    {/* Card Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white rounded-t-xl">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-purple-700">Item #{idx + 1}</span>
                        {item.medicineName && (
                          <span className="text-xs text-slate-500">
                            {item.medicineName}
                            {totalItems > 0 && <> {"\u00b7"} {totalItems} units</>}
                          </span>
                        )}
                        {lineTotal > 0 && (
                          <span className="text-xs font-semibold text-purple-700">
                            PKR {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateItem({ collapsed: !item.collapsed })}
                          className="px-3 py-1 text-xs border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                        >
                          {item.collapsed ? "Expand" : "Collapse"}
                        </button>
                        {invoiceItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setInvoiceItems((prev) => prev.filter((it) => it.id !== item.id))
                            }
                            className="px-3 py-1 text-xs border border-red-200 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Card Body */}
                    {!item.collapsed && (
                      <div className="p-4">
                        {/* 2-col: Category + Medicine */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Main Category *</label>
                            <select
                              value={item.mainCategory}
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
                                updateItem({ mainCategory: main, subCategory: sub, category: sub || main, medicineName: meds[0] || "", unit: getCategoryUnit(main, sub), containerType: getDefaultContainerType(main, sub) });
                              }}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm bg-white"
                            >
                              <option value="">Select</option>
                              {itemMainCatOptions.map((mc) => (
                                <option key={mc} value={mc}>{formatCatalogLabel(mc)}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Subcategory *</label>
                            <select
                              value={item.subCategory}
                              disabled={!item.mainCategory}
                              onChange={(e) => {
                                const sub = e.target.value;
                                const main = item.mainCategory;
                                const meds = sub ? (() => {
                                  const hidden = getHiddenMedicines(main, sub);
                                  const catalog = getCatalogMedicines(main, sub);
                                  const custom = getCustomMedicines(main, sub);
                                  return [...new Set([...catalog, ...custom])].filter((m) => !hidden.includes(m));
                                })() : [];
                                updateItem({ subCategory: sub, category: sub || main, medicineName: meds[0] || "", unit: getCategoryUnit(main, sub), containerType: getDefaultContainerType(main, sub) });
                              }}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm bg-white disabled:bg-slate-100"
                            >
                              <option value="">Select</option>
                              {itemSubCatOptions.map((sc) => (
                                <option key={sc} value={sc}>{formatCatalogLabel(sc)}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Medicine *</label>
                            <select
                              value={item.medicineName}
                              disabled={!item.subCategory}
                              onChange={(e) => updateItem({ medicineName: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm bg-white disabled:bg-slate-100"
                            >
                              <option value="">Select</option>
                              {itemMedOptions.map((m) => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                              Batch Number <span className="text-slate-400 text-xs">(Optional)</span>
                            </label>
                            <input
                              type="text"
                              value={item.batchNo}
                              onChange={(e) => updateItem({ batchNo: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm bg-white"
                              placeholder="Auto or manual batch reference"
                            />
                          </div>
                        </div>

                        {/* Divider */}
                        <div className="border-t border-slate-200 my-3" />

                        {/* 4-col item fields */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="col-span-2">
                            <label className="block text-xs font-medium text-slate-600 mb-1">Generic Name</label>
                            <input type="text" value={item.genericName}
                              onChange={(e) => updateItem({ genericName: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm bg-white"
                              placeholder="e.g. Paracetamol" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Barcode</label>
                            <input type="text" value={item.barcode}
                              onChange={(e) => updateItem({ barcode: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm bg-white"
                              placeholder="Scan or type" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Expiry Date</label>
                            <input type="date" value={item.expiryDate}
                              onChange={(e) => updateItem({ expiryDate: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm bg-white" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Qty (Packs) *</label>
                            <input type="number" required min="0" value={item.qtyPacks}
                              onChange={(e) => updateItem({ qtyPacks: Number(e.target.value) || 0 })}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm bg-white" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Units/Pack *</label>
                            <input type="number" required min="1" value={item.unitsPerPack}
                              onChange={(e) => updateItem({ unitsPerPack: Number(e.target.value) || 1 })}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm bg-white" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Buy/Pack *</label>
                            <input type="number" required min="0" step="0.01" value={item.buyPerPack}
                              onChange={(e) => updateItem({ buyPerPack: Number(e.target.value) || 0 })}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm bg-white" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Sale/Pack *</label>
                            <input type="number" required min="0" step="0.01" value={item.salePerPack}
                              onChange={(e) => updateItem({ salePerPack: Number(e.target.value) || 0 })}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm bg-white" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Buy/Unit</label>
                            <input type="text" readOnly
                              value={uPack > 0 ? ((item.buyPerPack || 0) / uPack).toFixed(2) : "0.00"}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-100 text-sm text-slate-600 cursor-not-allowed" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Sale/Unit</label>
                            <input type="text" readOnly
                              value={uPack > 0 ? ((item.salePerPack || 0) / uPack).toFixed(2) : "0.00"}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-100 text-sm text-slate-600 cursor-not-allowed" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Total Items</label>
                            <input type="text" readOnly value={totalItems}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-100 text-sm text-slate-600 cursor-not-allowed" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Min Stock</label>
                            <input type="number" min="0" value={item.minStock}
                              onChange={(e) => updateItem({ minStock: Number(e.target.value) || 0 })}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm bg-white" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Default Discount (%)</label>
                            <input type="number" min="0" max="100" step="0.01" value={item.defaultDiscount}
                              onChange={(e) => updateItem({ defaultDiscount: Number(e.target.value) || 0 })}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm bg-white"
                              placeholder="0" />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs font-medium text-slate-600 mb-1">
                              Line Tax <span className="text-slate-400">(Optional)</span>
                            </label>
                            <div className="flex gap-2">
                              <div className="flex rounded-lg border border-slate-300 overflow-hidden shrink-0">
                                {["%", "PKR"].map((t) => (
                                  <button key={t} type="button"
                                    onClick={() => updateItem({ lineTaxType: t })}
                                    className={`px-3 py-2 text-xs font-semibold transition-colors ${
                                      item.lineTaxType === t
                                        ? "bg-purple-600 text-white"
                                        : "bg-white text-slate-600 hover:bg-slate-50"
                                    }`}>{t}</button>
                                ))}
                              </div>
                              <input type="number" min="0" step="0.01" value={item.lineTaxValue}
                                onChange={(e) => updateItem({ lineTaxValue: Number(e.target.value) || 0 })}
                                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm bg-white"
                                placeholder={item.lineTaxType === "%" ? "e.g. 17" : "e.g. 50"} />
                            </div>
                          </div>

                          {/* Line Total */}
                          <div className="col-span-4 mt-1">
                            <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-xl px-5 py-3">
                              <div className="flex items-center gap-4 flex-wrap text-xs text-slate-500">
                                <span>Subtotal: <span className="font-medium text-slate-700">PKR {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></span>
                                {discount > 0 && <span>Discount: <span className="font-medium text-red-500">- PKR {discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></span>}
                                {tax > 0 && <span>Tax: <span className="font-medium text-slate-700">+ PKR {tax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></span>}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-sm font-semibold text-slate-700">Line Total:</span>
                                <span className="text-lg font-bold text-purple-700">
                                  PKR {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add Item button */}
              <button
                type="button"
                onClick={() => setInvoiceItems((prev) => [...prev, createEmptyItem()])}
                className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-purple-300 text-purple-600 rounded-xl hover:bg-purple-50 text-sm font-medium transition-colors"
              >
                <FiPlus className="w-4 h-4" /> Add Another Item
              </button>
              <div className="flex gap-3 pt-6">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
                >
                  {editingMedicine ? "Update Invoice" : "Add Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div
              className={
                confirmDialog.variant === "danger"
                  ? "bg-gradient-to-r from-red-500 to-red-600 px-6 py-4"
                  : "bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4"
              }
            >
              <div className="flex items-center gap-3 text-white">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <FiAlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">{confirmDialog.title}</h3>
                  {confirmDialog.message && (
                    <p className="text-sm text-white/80">
                      {confirmDialog.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleConfirmDialogCancel}
                  className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
                >
                  {confirmDialog.cancelLabel || "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDialogConfirm}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl font-semibold shadow-lg"
                >
                  {confirmDialog.confirmLabel || "Confirm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Supplier (Invoice Details) Modal */}
      {showAddSupplierInvModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[60] p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 flex items-center justify-between shrink-0">
              <h3 className="text-lg font-bold text-white">Add New Supplier</h3>
              <button onClick={() => setShowAddSupplierInvModal(false)} className="text-white hover:bg-white/20 p-2 rounded-lg">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddSupplierInv} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Supplier Name *</label>
                <input type="text" required autoFocus
                  value={newSupplierInvData.name}
                  onChange={(e) => setNewSupplierInvData({ ...newSupplierInvData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter supplier name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Select Company</label>
                <select value={newSupplierInvData.companyId}
                  onChange={(e) => setNewSupplierInvData({ ...newSupplierInvData, companyId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">None</option>
                  {companies.map((c) => <option key={c._id} value={c._id}>{c.companyName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                <input type="text" value={newSupplierInvData.phone}
                  onChange={(e) => setNewSupplierInvData({ ...newSupplierInvData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter phone number" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tax ID</label>
                <input type="text" value={newSupplierInvData.taxId}
                  onChange={(e) => setNewSupplierInvData({ ...newSupplierInvData, taxId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter tax ID" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <input type="text" value={newSupplierInvData.address}
                  onChange={(e) => setNewSupplierInvData({ ...newSupplierInvData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter address" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <div className="flex gap-3">
                  {["active", "inactive"].map((s) => (
                    <button key={s} type="button"
                      onClick={() => setNewSupplierInvData({ ...newSupplierInvData, status: s })}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium capitalize transition-colors ${
                        newSupplierInvData.status === s
                          ? s === "active" ? "bg-green-600 border-green-600 text-white" : "bg-red-500 border-red-500 text-white"
                          : "border-slate-300 text-slate-600 hover:bg-slate-50"
                      }`}>{s}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddSupplierInvModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={savingSupplier || !newSupplierInvData.name.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">
                  {savingSupplier && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                  Add Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Company (Invoice Details) Modal */}
      {showAddCompanyInvModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[60] p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Add New Company</h3>
              <button onClick={() => setShowAddCompanyInvModal(false)} className="text-white hover:bg-white/20 p-2 rounded-lg">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddCompanyInv} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Company Name *</label>
                <input type="text" required autoFocus
                  value={newCompanyInvData.companyName}
                  onChange={(e) => setNewCompanyInvData({ ...newCompanyInvData, companyName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Enter company name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <div className="flex gap-3">
                  {["active", "inactive"].map((s) => (
                    <button key={s} type="button"
                      onClick={() => setNewCompanyInvData({ ...newCompanyInvData, status: s })}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium capitalize transition-colors ${
                        newCompanyInvData.status === s
                          ? s === "active" ? "bg-green-600 border-green-600 text-white" : "bg-red-500 border-red-500 text-white"
                          : "border-slate-300 text-slate-600 hover:bg-slate-50"
                      }`}>{s}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddCompanyInvModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={savingCompany || !newCompanyInvData.companyName.trim()}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">
                  {savingCompany && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                  Add Company
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Company Modal */}
      {showAddCompanyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Add New Company</h3>
              <button
                onClick={() => {
                  setShowAddCompanyModal(false);
                  setNewCompanyData({ supplierName: "", contactPerson: "", phone: "", email: "" });
                }}
                className="text-white hover:bg-white/20 p-2 rounded-lg"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter company name"
                  value={newCompanyData.supplierName}
                  onChange={(e) =>
                    setNewCompanyData({ ...newCompanyData, supplierName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Contact Person
                </label>
                <input
                  type="text"
                  placeholder="Enter contact person name"
                  value={newCompanyData.contactPerson}
                  onChange={(e) =>
                    setNewCompanyData({ ...newCompanyData, contactPerson: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  placeholder="Enter phone number"
                  value={newCompanyData.phone}
                  onChange={(e) =>
                    setNewCompanyData({ ...newCompanyData, phone: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="Enter email address"
                  value={newCompanyData.email}
                  onChange={(e) =>
                    setNewCompanyData({ ...newCompanyData, email: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCompanyModal(false);
                    setNewCompanyData({ supplierName: "", contactPerson: "", phone: "", email: "" });
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddCompany}
                  disabled={!newCompanyData.supplierName.trim()}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Company
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && medicineToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
              <div className="flex items-center gap-3 text-white">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <FiTrash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Delete Medicine</h3>
                  <p className="text-sm text-red-100">
                    This action cannot be undone
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <p className="text-slate-700 mb-4">
                Are you sure you want to delete{" "}
                <span className="font-bold">
                  {medicineToDelete.medicineName}
                </span>{" "}
                (Batch: {medicineToDelete.batchNo})?
              </p>

              <div className="bg-slate-50 rounded-lg p-4 mb-6">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Category:</span>
                    <span className="font-medium text-slate-800">
                      {medicineToDelete.category}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Current Stock:</span>
                    <span className="font-semibold text-slate-900">
                      {medicineToDelete.quantity} {medicineToDelete.unit}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setMedicineToDelete(null);
                  }}
                  className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl font-semibold shadow-lg"
                >
                  Delete Medicine
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
