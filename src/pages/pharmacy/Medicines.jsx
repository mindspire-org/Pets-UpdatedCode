import React, { useState, useEffect, useMemo, useRef } from "react";
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
} from "react-icons/fi";
import {
  pharmacyMedicinesAPI,
  suppliersAPI,
  pharmacySalesAPI,
  payablesAPI,
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
  };
};

export default function Medicines() {
  const [medicines, setMedicines] = useState([]);
  const [filteredMedicines, setFilteredMedicines] = useState([]);
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
  const [showOtherSupplier, setShowOtherSupplier] = useState(false);
  const [supplierSelection, setSupplierSelection] = useState("");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
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
        localStorage.getItem("pharmacy_hidden_main_categories") || "[]",
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
        localStorage.getItem("pharmacy_custom_medicines") || "{}",
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
        localStorage.getItem("pharmacy_hidden_subcategories") || "{}",
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
        localStorage.getItem("pharmacy_custom_main_categories") || "[]",
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
        localStorage.getItem("pharmacy_custom_subcategories") || "{}",
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
        localStorage.getItem("pharmacy_hidden_medicines") || "{}",
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
        localStorage.getItem("pharmacy_hidden_main_categories") || "[]";
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : [];
      if (!list.includes(val)) {
        const next = [...list, val];
        localStorage.setItem(
          "pharmacy_hidden_main_categories",
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
        localStorage.getItem("pharmacy_custom_main_categories") || "[]";
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : [];
      const nextList = list.map((x) => (x === oldName ? newName : x));
      localStorage.setItem(
        "pharmacy_custom_main_categories",
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
        map[newName] = Array.from(new Set([...existing, ...moved])).filter(
          Boolean,
        );
        delete map[oldName];
        localStorage.setItem(storageKey, JSON.stringify(map));
      } catch {}
    };
    remapObjectKey("pharmacy_custom_subcategories");
    remapObjectKey("pharmacy_hidden_subcategories");

    const replaceMainPrefix = (storageKey) => {
      try {
        const raw = localStorage.getItem(storageKey) || "{}";
        const map = JSON.parse(raw);
        const next = {};
        Object.entries(map || {}).forEach(([k, v]) => {
          const keyStr = String(k || "");
          const outKey = keyStr.startsWith(oldName + "::")
            ? newName + keyStr.slice(oldName.length)
            : keyStr;
          next[outKey] = v;
        });
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
    };
    replaceMainPrefix("pharmacy_custom_medicines");
    replaceMainPrefix("pharmacy_hidden_medicines");

    try {
      const raw =
        localStorage.getItem("pharmacy_hidden_main_categories") || "[]";
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : [];
      const next = list.map((x) => (x === oldName ? newName : x));
      localStorage.setItem(
        "pharmacy_hidden_main_categories",
        JSON.stringify(Array.from(new Set(next)).filter(Boolean)),
      );
    } catch {}

    setOptionsVersion((v) => v + 1);
    setSelectedMainCategory((prev) => (prev === oldName ? newName : prev));
    setFormData((prev) => {
      const nextForm = { ...prev };
      if (nextForm.mainCategory === oldName) nextForm.mainCategory = newName;
      if (nextForm.category === oldName) nextForm.category = newName;
      return nextForm;
    });
    showToast("Category updated");
  };

  const renameCustomSubCategory = (mainCategory, oldValue, nextValue) => {
    const main = String(mainCategory || "").trim();
    const oldName = String(oldValue || "").trim();
    const newName = String(nextValue || "").trim();
    if (!main || !oldName || !newName) return;
    if (oldName === newName) return;
    const custom = getCustomSubCategories(main);
    if (!custom.includes(oldName)) {
      showToast("Only custom subcategories can be edited");
      return;
    }
    const allSubs = [...new Set([...getSubCategories(main), ...custom])];
    if (allSubs.includes(newName)) {
      showToast("Subcategory already exists");
      return;
    }

    try {
      const raw = localStorage.getItem("pharmacy_custom_subcategories") || "{}";
      const map = JSON.parse(raw);
      const list = Array.isArray(map[main]) ? map[main] : [];
      map[main] = Array.from(
        new Set(list.map((x) => (x === oldName ? newName : x))),
      ).filter(Boolean);
      localStorage.setItem(
        "pharmacy_custom_subcategories",
        JSON.stringify(map),
      );
    } catch {}

    const replaceSubSuffix = (storageKey) => {
      try {
        const raw = localStorage.getItem(storageKey) || "{}";
        const map = JSON.parse(raw);
        const next = {};
        Object.entries(map || {}).forEach(([k, v]) => {
          const keyStr = String(k || "");
          if (keyStr === `${main}::${oldName}`) next[`${main}::${newName}`] = v;
          else next[keyStr] = v;
        });
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
    };
    replaceSubSuffix("pharmacy_custom_medicines");
    replaceSubSuffix("pharmacy_hidden_medicines");

    try {
      const raw = localStorage.getItem("pharmacy_hidden_subcategories") || "{}";
      const map = JSON.parse(raw);
      const list = Array.isArray(map[main]) ? map[main] : [];
      map[main] = Array.from(
        new Set(list.map((x) => (x === oldName ? newName : x))),
      ).filter(Boolean);
      localStorage.setItem(
        "pharmacy_hidden_subcategories",
        JSON.stringify(map),
      );
    } catch {}

    setOptionsVersion((v) => v + 1);
    setFormData((prev) => {
      const nextForm = { ...prev };
      if (nextForm.mainCategory === main && nextForm.subCategory === oldName) {
        nextForm.subCategory = newName;
        nextForm.category = newName;
      }
      if (nextForm.category === oldName) nextForm.category = newName;
      return nextForm;
    });
    showToast("Subcategory updated");
  };

  const renameCustomMedicineName = (
    mainCategory,
    subCategory,
    oldValue,
    nextValue,
  ) => {
    const main = String(mainCategory || "").trim();
    const sub = String(subCategory || "").trim();
    const oldName = String(oldValue || "").trim();
    const newName = String(nextValue || "").trim();
    if (!main || !sub || !oldName || !newName) return;
    if (oldName === newName) return;
    const custom = getCustomMedicines(main, sub);
    if (!custom.includes(oldName)) {
      showToast("Only custom medicines can be edited");
      return;
    }
    const allMeds = [
      ...new Set([...getCatalogMedicines(main, sub), ...custom]),
    ];
    if (allMeds.includes(newName)) {
      showToast("Medicine already exists");
      return;
    }

    try {
      const raw = localStorage.getItem("pharmacy_custom_medicines") || "{}";
      const map = JSON.parse(raw);
      const key = getMedicineKey(main, sub);
      const list = Array.isArray(map[key]) ? map[key] : [];
      map[key] = Array.from(
        new Set(list.map((x) => (x === oldName ? newName : x))),
      ).filter(Boolean);
      localStorage.setItem("pharmacy_custom_medicines", JSON.stringify(map));
    } catch {}

    try {
      const raw = localStorage.getItem("pharmacy_hidden_medicines") || "{}";
      const map = JSON.parse(raw);
      const key = getMedicineKey(main, sub);
      const list = Array.isArray(map[key]) ? map[key] : [];
      map[key] = Array.from(
        new Set(list.map((x) => (x === oldName ? newName : x))),
      ).filter(Boolean);
      localStorage.setItem("pharmacy_hidden_medicines", JSON.stringify(map));
    } catch {}

    setOptionsVersion((v) => v + 1);
    setFormData((prev) => {
      if (
        prev.mainCategory === main &&
        prev.subCategory === sub &&
        prev.medicineName === oldName
      ) {
        return { ...prev, medicineName: newName };
      }
      return prev;
    });
    showToast("Medicine updated");
  };

  const hideSubCategory = (mainCategory, subCategory) => {
    const main = mainCategory || "";
    const sub = subCategory || "";
    if (!main || !sub) return;
    try {
      const raw = localStorage.getItem("pharmacy_hidden_subcategories") || "{}";
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed[main]) ? parsed[main] : [];
      if (!list.includes(sub)) {
        parsed[main] = [...list, sub];
        localStorage.setItem(
          "pharmacy_hidden_subcategories",
          JSON.stringify(parsed),
        );
      }
    } catch {}
    setOptionsVersion((v) => v + 1);
    setFormData((prev) => {
      if (prev.mainCategory !== main || prev.subCategory !== sub) return prev;
      const catalogSubs = getSubCategories(main);
      const customSubs = getCustomSubCategories(main);
      const allSubs = [...new Set([...catalogSubs, ...customSubs])];
      const hiddenSubs = getHiddenSubCategories(main).concat([sub]);
      const visibleSubs = allSubs.filter((sc) => !hiddenSubs.includes(sc));
      const nextSub = visibleSubs[0] || "";
      if (!nextSub) {
        return {
          ...prev,
          subCategory: "",
          category: main,
          medicineName: "",
          unit: getCategoryUnit(main, ""),
          containerType: getDefaultContainerType(main, ""),
        };
      }
      const hiddenMeds = getHiddenMedicines(main, nextSub);
      const catalogMeds = getCatalogMedicines(main, nextSub);
      const customMeds = getCustomMedicines(main, nextSub);
      const allMeds = [...new Set([...catalogMeds, ...customMeds])];
      const visibleMeds = allMeds.filter((m) => !hiddenMeds.includes(m));
      const nextMed = visibleMeds[0] || "";
      return {
        ...prev,
        subCategory: nextSub,
        category: nextSub,
        medicineName: nextMed,
        unit: getCategoryUnit(main, nextSub),
        containerType: getDefaultContainerType(main, nextSub),
      };
    });
  };

  const hideMedicineName = (mainCategory, subCategory, medicineName) => {
    const main = mainCategory || "";
    const sub = subCategory || "";
    const name = medicineName || "";
    if (!main || !sub || !name) return;
    try {
      const raw = localStorage.getItem("pharmacy_hidden_medicines") || "{}";
      const parsed = JSON.parse(raw);
      const key = getMedicineKey(main, sub);
      const list = Array.isArray(parsed[key]) ? parsed[key] : [];
      if (!list.includes(name)) {
        parsed[key] = [...list, name];
        localStorage.setItem(
          "pharmacy_hidden_medicines",
          JSON.stringify(parsed),
        );
      }
    } catch {}
    setOptionsVersion((v) => v + 1);
    setFormData((prev) => {
      if (
        prev.mainCategory !== main ||
        prev.subCategory !== sub ||
        prev.medicineName !== name
      )
        return prev;
      const catalogMeds = getCatalogMedicines(main, sub);
      const customMeds = getCustomMedicines(main, sub);
      const allMeds = [...new Set([...catalogMeds, ...customMeds])];
      const hiddenMeds = getHiddenMedicines(main, sub).concat([name]);
      const visibleMeds = allMeds.filter((m) => !hiddenMeds.includes(m));
      const nextMed = visibleMeds[0] || "";
      return {
        ...prev,
        medicineName: nextMed,
      };
    });
  };

  const addCustomMainCategory = (name) => {
    const val = (name || "").trim();
    if (!val) return;
    try {
      const raw =
        localStorage.getItem("pharmacy_custom_main_categories") || "[]";
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : [];
      const next = [...new Set([...list, val])];
      localStorage.setItem(
        "pharmacy_custom_main_categories",
        JSON.stringify(next),
      );
    } catch {}

    setFormData((prev) => {
      const main = val;
      const hiddenSubs = getHiddenSubCategories(main);
      const catalogSubs = getSubCategories(main);
      const customSubs = getCustomSubCategories(main);
      const mergedSubs = [...new Set([...catalogSubs, ...customSubs])].filter(
        (sc) => !hiddenSubs.includes(sc),
      );
      const firstSub = mergedSubs[0] || "";

      const hiddenMeds = firstSub ? getHiddenMedicines(main, firstSub) : [];
      const catalogMeds = firstSub ? getCatalogMedicines(main, firstSub) : [];
      const customMeds = firstSub ? getCustomMedicines(main, firstSub) : [];
      const mergedMeds = [...new Set([...catalogMeds, ...customMeds])].filter(
        (m) => !hiddenMeds.includes(m),
      );
      const firstMed = mergedMeds[0] || "";

      return {
        ...prev,
        mainCategory: main,
        subCategory: firstSub,
        category: firstSub || main,
        medicineName: firstMed,
        unit: getCategoryUnit(main, firstSub),
        containerType: getDefaultContainerType(main, firstSub),
      };
    });

    setShowAddMainCategory(false);
    setNewMainCategoryName("");
    setOptionsVersion((v) => v + 1);
  };

  const addCustomSubCategory = (name) => {
    const val = (name || "").trim();
    const main = formData.mainCategory || "";
    if (!val || !main) return;
    try {
      const raw = localStorage.getItem("pharmacy_custom_subcategories") || "{}";
      const map = JSON.parse(raw);
      const list = Array.isArray(map[main]) ? map[main] : [];
      map[main] = [...new Set([...list, val])];
      localStorage.setItem(
        "pharmacy_custom_subcategories",
        JSON.stringify(map),
      );
    } catch {}

    setFormData((prev) => {
      if (prev.mainCategory !== main) return prev;
      const sub = val;
      const hiddenMeds = getHiddenMedicines(main, sub);
      const catalogMeds = getCatalogMedicines(main, sub);
      const customMeds = getCustomMedicines(main, sub);
      const mergedMeds = [...new Set([...catalogMeds, ...customMeds])].filter(
        (m) => !hiddenMeds.includes(m),
      );
      const firstMed = mergedMeds[0] || "";
      return {
        ...prev,
        subCategory: sub,
        category: sub,
        medicineName: firstMed,
        unit: getCategoryUnit(main, sub),
        containerType: getDefaultContainerType(main, sub),
      };
    });

    setShowAddSubCategory(false);
    setNewSubCategoryName("");
    setOptionsVersion((v) => v + 1);
  };

  const addCustomMedicineOption = (name) => {
    const val = (name || "").trim();
    const main = formData.mainCategory || "";
    const sub = formData.subCategory || "";
    if (!val || !main || !sub) return;
    try {
      const raw = localStorage.getItem("pharmacy_custom_medicines") || "{}";
      const map = JSON.parse(raw);
      const key = getMedicineKey(main, sub);
      const list = Array.isArray(map[key]) ? map[key] : [];
      map[key] = [...new Set([...list, val])];
      localStorage.setItem("pharmacy_custom_medicines", JSON.stringify(map));
    } catch {}

    setFormData((prev) => ({
      ...prev,
      medicineName: val,
    }));

    setShowAddMedicineOption(false);
    setNewMedicineName("");
    setOptionsVersion((v) => v + 1);
  };

  const mainCategoryOptions = useMemo(() => {
    const hidden = getHiddenMainCategories();
    const custom = getCustomMainCategories();
    const merged = [...new Set([...catalogMainCategories, ...custom])];
    const base = merged.filter((mc) => !hidden.includes(mc));
    const list = [...base];
    if (formData.mainCategory && !list.includes(formData.mainCategory))
      list.push(formData.mainCategory);
    return list.map((mc) => ({ value: mc, label: formatCatalogLabel(mc) }));
  }, [formData.mainCategory, optionsVersion]);

  const subCategoryOptions = useMemo(() => {
    if (!formData.mainCategory) return [];
    const hidden = getHiddenSubCategories(formData.mainCategory);
    const catalogSubs = getSubCategories(formData.mainCategory);
    const customSubs = getCustomSubCategories(formData.mainCategory);
    const merged = [...new Set([...catalogSubs, ...customSubs])];
    const base = merged.filter((sc) => !hidden.includes(sc));
    const list = [...base];
    if (formData.subCategory && !list.includes(formData.subCategory))
      list.push(formData.subCategory);
    return list.map((sc) => ({ value: sc, label: formatCatalogLabel(sc) }));
  }, [formData.mainCategory, formData.subCategory, optionsVersion]);
  const medicineOptions = useMemo(() => {
    if (!formData.mainCategory || !formData.subCategory) return [];
    const hidden = getHiddenMedicines(
      formData.mainCategory,
      formData.subCategory,
    );
    const catalogMeds = getCatalogMedicines(
      formData.mainCategory,
      formData.subCategory,
    );
    const customMeds = getCustomMedicines(
      formData.mainCategory,
      formData.subCategory,
    );
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
    optionsVersion,
  ]);

  const getCustomUnitsForKey = (key) => {
    try {
      const map = JSON.parse(
        localStorage.getItem("pharmacy_custom_units") || "{}",
      );
      const arr = Array.isArray(map[key]) ? map[key] : [];
      return arr.filter(Boolean);
    } catch {
      return [];
    }
  };
  const unitOptions = useMemo(() => {
    const base = getUnitOptionsForCategory(
      formData.mainCategory,
      formData.subCategory,
    );
    const key = getCategoryKey(formData.mainCategory, formData.subCategory);
    const custom = getCustomUnitsForKey(key);
    const opts = [...new Set([...(base || []), ...(custom || [])])];
    if (formData.unit && !opts.includes(formData.unit))
      return [...opts, formData.unit];
    return opts;
  }, [
    formData.mainCategory,
    formData.subCategory,
    formData.unit,
    optionsVersion,
  ]);

  const addCustomUnit = (unit) => {
    const val = (unit || "").trim();
    if (!val) return;
    const key = getCategoryKey(formData.mainCategory, formData.subCategory);
    try {
      const raw = localStorage.getItem("pharmacy_custom_units") || "{}";
      const map = JSON.parse(raw);
      const list = Array.isArray(map[key]) ? map[key] : [];
      map[key] = [...new Set([...list, val])];
      localStorage.setItem("pharmacy_custom_units", JSON.stringify(map));
    } catch {}
    setFormData((prev) => ({ ...prev, unit: val }));
    setCustomUnitValue("");
    setShowCustomUnit(false);
    setOptionsVersion((v) => v + 1);
  };

  const getCustomContainersForKey = (key) => {
    try {
      const map = JSON.parse(
        localStorage.getItem("pharmacy_custom_containers") || "{}",
      );
      const arr = Array.isArray(map[key]) ? map[key] : [];
      return arr.filter(Boolean);
    } catch {
      return [];
    }
  };
  const addCustomContainer = (value) => {
    const val = (value || "").trim();
    if (!val) return;
    const key = getCategoryKey(formData.mainCategory, formData.subCategory);
    try {
      const raw = localStorage.getItem("pharmacy_custom_containers") || "{}";
      const map = JSON.parse(raw);
      const list = Array.isArray(map[key]) ? map[key] : [];
      map[key] = [...new Set([...list, val])];
      localStorage.setItem("pharmacy_custom_containers", JSON.stringify(map));
    } catch {}
    setFormData((prev) => ({ ...prev, containerType: val }));
    setCustomContainerValue("");
    setShowCustomContainer(false);
    setOptionsVersion((v) => v + 1);
  };

  const removeCustomUnit = (unit) => {
    const key = getCategoryKey(formData.mainCategory, formData.subCategory);
    try {
      const raw = localStorage.getItem("pharmacy_custom_units") || "{}";
      const map = JSON.parse(raw);
      const list = Array.isArray(map[key]) ? map[key] : [];
      map[key] = list.filter((x) => x !== unit);
      localStorage.setItem("pharmacy_custom_units", JSON.stringify(map));
    } catch {}
    setOptionsVersion((v) => v + 1);
    setShowManageUnit(true);
    setFormData((prev) => {
      if (prev.unit === unit) {
        return {
          ...prev,
          unit: getCategoryUnit(prev.mainCategory, prev.subCategory),
        };
      }
      return prev;
    });
  };

  const removeCustomContainer = (value) => {
    const key = getCategoryKey(formData.mainCategory, formData.subCategory);
    try {
      const raw = localStorage.getItem("pharmacy_custom_containers") || "{}";
      const map = JSON.parse(raw);
      const list = Array.isArray(map[key]) ? map[key] : [];
      map[key] = list.filter((x) => x !== value);
      localStorage.setItem("pharmacy_custom_containers", JSON.stringify(map));
    } catch {}
    setOptionsVersion((v) => v + 1);
    setShowManageContainer(true);
    setFormData((prev) => {
      if (prev.containerType === value) {
        return {
          ...prev,
          containerType: getDefaultContainerType(
            prev.mainCategory,
            prev.subCategory,
          ),
        };
      }
      return prev;
    });
  };

  const renameCustomUnit = (oldValue, nextValue) => {
    const oldName = String(oldValue || "").trim();
    const newName = String(nextValue || "").trim();
    if (!oldName || !newName) return;
    if (oldName === newName) return;
    const key = getCategoryKey(formData.mainCategory, formData.subCategory);
    const custom = getCustomUnitsForKey(key);
    if (!custom.includes(oldName)) {
      showToast("Only custom units can be edited");
      return;
    }
    const base = getUnitOptionsForCategory(
      formData.mainCategory,
      formData.subCategory,
    );
    const all = [...new Set([...(base || []), ...custom])];
    if (all.includes(newName)) {
      showToast("Unit already exists");
      return;
    }
    try {
      const raw = localStorage.getItem("pharmacy_custom_units") || "{}";
      const map = JSON.parse(raw);
      const list = Array.isArray(map[key]) ? map[key] : [];
      map[key] = Array.from(
        new Set(list.map((x) => (x === oldName ? newName : x))),
      ).filter(Boolean);
      localStorage.setItem("pharmacy_custom_units", JSON.stringify(map));
    } catch {}
    setOptionsVersion((v) => v + 1);
    setFormData((prev) =>
      prev.unit === oldName ? { ...prev, unit: newName } : prev,
    );
    showToast("Unit updated");
  };

  const renameCustomContainer = (oldValue, nextValue) => {
    const oldName = String(oldValue || "").trim();
    const newName = String(nextValue || "").trim();
    if (!oldName || !newName) return;
    if (oldName === newName) return;
    const key = getCategoryKey(formData.mainCategory, formData.subCategory);
    const custom = getCustomContainersForKey(key);
    if (!custom.includes(oldName)) {
      showToast("Only custom container types can be edited");
      return;
    }
    const base = getContainerOptions(
      formData.mainCategory,
      formData.subCategory,
    );
    const all = [...new Set([...(base || []), ...custom])];
    if (all.includes(newName)) {
      showToast("Container already exists");
      return;
    }
    try {
      const raw = localStorage.getItem("pharmacy_custom_containers") || "{}";
      const map = JSON.parse(raw);
      const list = Array.isArray(map[key]) ? map[key] : [];
      map[key] = Array.from(
        new Set(list.map((x) => (x === oldName ? newName : x))),
      ).filter(Boolean);
      localStorage.setItem("pharmacy_custom_containers", JSON.stringify(map));
    } catch {}
    setOptionsVersion((v) => v + 1);
    setFormData((prev) =>
      prev.containerType === oldName
        ? { ...prev, containerType: newName }
        : prev,
    );
    showToast("Container updated");
  };

  const containerOptions = useMemo(() => {
    const base = getContainerOptions(
      formData.mainCategory,
      formData.subCategory,
    );
    const key = getCategoryKey(formData.mainCategory, formData.subCategory);
    const custom = getCustomContainersForKey(key);
    const opts = [...new Set([...(base || []), ...(custom || [])])];
    if (formData.containerType && !opts.includes(formData.containerType))
      return [...opts, formData.containerType];
    return opts;
  }, [
    formData.mainCategory,
    formData.subCategory,
    formData.containerType,
    optionsVersion,
  ]);

  const currentCategoryKey = getCategoryKey(
    formData.mainCategory,
    formData.subCategory,
  );
  const customUnitsForCurrent = getCustomUnitsForKey(currentCategoryKey);
  const customContainersForCurrent =
    getCustomContainersForKey(currentCategoryKey);

  useEffect(() => {
    fetchMedicines();
    fetchAlerts();
    fetchSuppliers();
  }, []);

  useEffect(() => {
    filterMedicines();
  }, [medicines, searchQuery, selectedMainCategory, selectedSubCategory]);

  const fetchMedicines = async () => {
    try {
      setLoading(true);
      const response = await pharmacyMedicinesAPI.getAll();
      const normalized = (response.data || []).map(hydrateMedicine);
      setMedicines(normalized);
    } catch (error) {
      showToast("Error fetching medicines");
      console.error("Fetch medicines error:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      const [lowStockRes, expiringRes, expiredRes] = await Promise.all([
        pharmacyMedicinesAPI.getLowStock(),
        pharmacyMedicinesAPI.getExpiring(),
        pharmacyMedicinesAPI.getExpired(),
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
      const response = await suppliersAPI.getAll("pharmacy");
      const list = (response.data || []).map((s) => ({
        id: s._id,
        _id: s._id,
        name: s.supplierName || s.name || "",
      }));
      setSuppliers(list);
      try {
        localStorage.setItem("pharmacy_suppliers", JSON.stringify(list));
      } catch {}
    } catch (error) {
      console.error("Fetch suppliers error:", error);
      try {
        const storedSuppliers = localStorage.getItem("pharmacy_suppliers");
        if (storedSuppliers) {
          setSuppliers(JSON.parse(storedSuppliers));
        } else {
          setSuppliers([]);
        }
      } catch {}
    }
  };

  const filterMedicines = () => {
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

    setFilteredMedicines(filtered);
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(""), 3000);
  };

  const openModal = async (medicine = null) => {
    fetchSuppliers();
    if (medicine) {
      let full = medicine;
      try {
        const resp = await pharmacyMedicinesAPI.getById(
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

    const hiddenSubs = getHiddenSubCategories(main);
    const catalogSubs = getSubCategories(main);
    const customSubs = getCustomSubCategories(main);
    const mergedSubs = [...new Set([...catalogSubs, ...customSubs])].filter(
      (sc) => !hiddenSubs.includes(sc),
    );
    const sub = mergedSubs[0] || "";

    const hiddenMeds = sub ? getHiddenMedicines(main, sub) : [];
    const catalogMeds = sub ? getCatalogMedicines(main, sub) : [];
    const customMeds = sub ? getCustomMedicines(main, sub) : [];
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

    const hiddenMeds = getHiddenMedicines(main, sub);
    const catalogMeds = getCatalogMedicines(main, sub);
    const customMeds = getCustomMedicines(main, sub);
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
          await suppliersAPI.create({
            supplierName: resolvedSupplierName,
            contactPerson: "",
            phone: "",
            email: "",
            address: "",
            city: "",
            category: "",
            notes: "",
            portal: "pharmacy",
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
        await pharmacyMedicinesAPI.update(editingMedicine._id, payload);
        showToast("Medicine updated successfully");
      } else {
        const response = await pharmacyMedicinesAPI.create(payload);
        const newMed = response.data || response;

        // Update Supplier Purchase History and Totals
        if (payload.purchasePrice > 0 && payload.quantity > 0) {
          try {
            const supplier = suppliers.find((s) =>
              optionEquals(s.name || s.supplierName, resolvedSupplierName),
            );
            if (supplier) {
              await suppliersAPI.addPurchase(supplier._id || supplier.id, {
                productName: payload.medicineName,
                quantity: Number(payload.quantity),
                unitPrice: Number(payload.purchasePrice),
                invoiceNumber: payload.batchNo || `MED-${Date.now()}`,
                totalPrice:
                  Number(payload.purchasePrice) * Number(payload.quantity),
                portal: "pharmacy",
              });
            }
          } catch (supErr) {
            console.error("Error updating supplier purchase history:", supErr);
          }
        }

        showToast("Medicine added successfully");
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
      await pharmacyMedicinesAPI.delete(medicineToDelete._id);
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
      const salesRes = await pharmacySalesAPI.getAll();
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
          const direct = await pharmacyMedicinesAPI.findByBarcode(barcode);
          const med = direct?.data || (direct && direct.success && direct.data);
          if (med && med._id) return med;
        } catch {}
        try {
          const res = await pharmacyMedicinesAPI.search(barcode);
          const list = Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res)
              ? res
              : [];
          existing = (list || []).find((m) => normalizeBc(m.barcode) === bc);
          if (existing && existing._id) return existing;
        } catch {}
        try {
          const all = await pharmacyMedicinesAPI.getAll();
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
            await pharmacyMedicinesAPI.update(existing._id, payload);
            knownByBarcode.set(bc, existing);
            return "updated";
          }
        }
        try {
          const created = await pharmacyMedicinesAPI.create(payload);
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
                await pharmacyMedicinesAPI.update(existing._id, payload);
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
            Medicine Inventory
          </h1>
          <p className="text-slate-500 mt-1">
            Manage pharmacy medicines and stock
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
            onClick={() => openModal()}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
          >
            <FiPlus /> Add Medicine
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : filteredMedicines.length === 0 ? (
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
                        <span
                          className={`font-semibold ${medicine.quantity <= medicine.lowStockThreshold ? "text-orange-600" : "text-green-600"}`}
                        >
                          {medicine.category === "Injection" ? (
                            <div>
                              <div>
                                {medicine.quantity}{" "}
                                {(medicine.containerType || "Vial") +
                                  (String(
                                    medicine.containerType || "Vial",
                                  ).endsWith("s")
                                    ? ""
                                    : "s")}
                              </div>
                              <div className="text-xs text-slate-500">
                                {medicine.mlPerVial || 0}{" "}
                                {formatUnitForDisplay(medicine.unit, "ml")} per{" "}
                                {medicine.containerType || "Vial"}
                              </div>
                              <div className="text-xs text-blue-600 font-medium">
                                Remaining:{" "}
                                {medicine.remainingMl ||
                                  medicine.mlPerVial ||
                                  0}{" "}
                                {formatUnitForDisplay(medicine.unit, "ml")}
                              </div>
                            </div>
                          ) : (
                            `${medicine.quantity} ${medicine.unit}`
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-slate-600 font-medium">
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
                            onClick={() => openModal(medicine)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                          >
                            <FiEdit2 className="w-4 h-4" />
                          </button>
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
        )}

        {/* Pagination */}
        {!loading && filteredMedicines.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
            <div className="text-sm text-slate-600">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, filteredMedicines.length)}{" "}
              of {filteredMedicines.length} medicines
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from(
                  {
                    length: Math.ceil(filteredMedicines.length / itemsPerPage),
                  },
                  (_, i) => i + 1,
                )
                  .filter((page) => {
                    const totalPages = Math.ceil(
                      filteredMedicines.length / itemsPerPage,
                    );
                    if (totalPages <= 7) return true;
                    if (page === 1 || page === totalPages) return true;
                    if (page >= currentPage - 1 && page <= currentPage + 1)
                      return true;
                    return false;
                  })
                  .map((page, index, array) => (
                    <React.Fragment key={page}>
                      {index > 0 && array[index - 1] !== page - 1 && (
                        <span className="px-2 text-slate-400">...</span>
                      )}
                      <button
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1 rounded-lg ${
                          currentPage === page
                            ? "bg-purple-600 text-white"
                            : "border border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {page}
                      </button>
                    </React.Fragment>
                  ))}
              </div>
              <button
                onClick={() =>
                  setCurrentPage((prev) =>
                    Math.min(
                      Math.ceil(filteredMedicines.length / itemsPerPage),
                      prev + 1,
                    ),
                  )
                }
                disabled={
                  currentPage >=
                  Math.ceil(filteredMedicines.length / itemsPerPage)
                }
                className="px-3 py-1 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">
                {editingMedicine ? "Edit Medicine" : "Add New Medicine"}
              </h3>
              <button
                onClick={closeModal}
                className="text-white hover:bg-white/20 p-2 rounded-lg"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Main Category *
                  </label>
                  <select
                    value={formData.mainCategory}
                    onChange={(e) => handleMainCategorySelect(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select Main Category</option>
                    {mainCategoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddMainCategory((v) => !v)}
                      className="text-xs text-green-600 hover:underline"
                    >
                      + Add New Category
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowManageMainCategory((v) => !v)}
                      className="text-xs text-purple-600 hover:underline"
                    >
                      Manage categories
                    </button>
                  </div>
                  {showAddMainCategory && (
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter new main category"
                        value={newMainCategoryName}
                        onChange={(e) => setNewMainCategoryName(e.target.value)}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          addCustomMainCategory(newMainCategoryName)
                        }
                        className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddMainCategory(false);
                          setNewMainCategoryName("");
                        }}
                        className="px-3 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  {showManageMainCategory && (
                    <div className="mt-2 p-2 border border-slate-200 rounded-lg bg-slate-50">
                      {(() => {
                        const hidden = getHiddenMainCategories();
                        const custom = getCustomMainCategories();
                        const base = [
                          ...new Set([...catalogMainCategories, ...custom]),
                        ];
                        const visible = base.filter(
                          (mc) => !hidden.includes(mc),
                        );
                        if (!visible.length) {
                          return (
                            <p className="text-xs text-slate-500">
                              No categories available.
                            </p>
                          );
                        }
                        return (
                          <ul className="space-y-1">
                            {visible.map((mc) => (
                              <li
                                key={mc}
                                className="flex items-center justify-between text-xs text-slate-700"
                              >
                                {optionEdit.kind === "main" &&
                                optionEdit.oldValue === mc ? (
                                  <div className="flex-1 flex items-center gap-2">
                                    <input
                                      value={optionEdit.value}
                                      onChange={(e) =>
                                        setOptionEdit((prev) => ({
                                          ...prev,
                                          value: e.target.value,
                                        }))
                                      }
                                      className="flex-1 px-2 py-1 border border-slate-300 rounded"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        renameCustomMainCategory(
                                          optionEdit.oldValue,
                                          optionEdit.value,
                                        );
                                        setOptionEdit({
                                          kind: "",
                                          oldValue: "",
                                          value: "",
                                          mainCategory: "",
                                          subCategory: "",
                                        });
                                      }}
                                      className="px-2 py-1 rounded bg-emerald-600 text-white"
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setOptionEdit({
                                          kind: "",
                                          oldValue: "",
                                          value: "",
                                          mainCategory: "",
                                          subCategory: "",
                                        })
                                      }
                                      className="px-2 py-1 rounded border border-slate-300"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <span>{formatCatalogLabel(mc)}</span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    openConfirmDialog({
                                      title: "Remove Category",
                                      message: `Remove category "${formatCatalogLabel(mc)}" from this dropdown?`,
                                      confirmLabel: "Remove",
                                      variant: "danger",
                                      onConfirm: () => hideMainCategory(mc),
                                    });
                                  }}
                                  className="text-red-600 hover:text-red-700 p-1 rounded-full hover:bg-red-50"
                                >
                                  <FiX className="w-3 h-3" />
                                </button>
                                {custom.includes(mc) &&
                                  optionEdit.kind !== "main" && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setOptionEdit({
                                          kind: "main",
                                          oldValue: mc,
                                          value: mc,
                                          mainCategory: "",
                                          subCategory: "",
                                        })
                                      }
                                      className="text-blue-600 hover:text-blue-700 p-1 rounded-full hover:bg-blue-50"
                                    >
                                      <FiEdit2 className="w-3 h-3" />
                                    </button>
                                  )}
                              </li>
                            ))}
                          </ul>
                        );
                      })()}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Subcategory *
                  </label>
                  <select
                    disabled={!formData.mainCategory}
                    value={formData.subCategory}
                    onChange={(e) => handleSubCategorySelect(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    <option value="">Select Subcategory</option>
                    {subCategoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowAddSubCategory((v) => !v)}
                      className="text-xs text-green-600 hover:underline disabled:text-slate-400"
                      disabled={!formData.mainCategory}
                    >
                      + Add New Subcategory
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowManageSubCategory((v) => !v)}
                      className="text-xs text-purple-600 hover:underline disabled:text-slate-400"
                      disabled={!formData.mainCategory}
                    >
                      Manage subcategories
                    </button>
                  </div>
                  {showAddSubCategory && formData.mainCategory && (
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter new subcategory"
                        value={newSubCategoryName}
                        onChange={(e) => setNewSubCategoryName(e.target.value)}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <button
                        type="button"
                        onClick={() => addCustomSubCategory(newSubCategoryName)}
                        className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddSubCategory(false);
                          setNewSubCategoryName("");
                        }}
                        className="px-3 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  {showManageSubCategory && formData.mainCategory && (
                    <div className="mt-2 p-2 border border-slate-200 rounded-lg bg-slate-50">
                      {(() => {
                        const catalogSubs = getSubCategories(
                          formData.mainCategory,
                        );
                        const customSubs = getCustomSubCategories(
                          formData.mainCategory,
                        );
                        const all = [
                          ...new Set([...catalogSubs, ...customSubs]),
                        ];
                        const hidden = getHiddenSubCategories(
                          formData.mainCategory,
                        );
                        const visible = all.filter(
                          (sc) => !hidden.includes(sc),
                        );
                        if (!visible.length) {
                          return (
                            <p className="text-xs text-slate-500">
                              No subcategories for this main category.
                            </p>
                          );
                        }
                        return (
                          <ul className="space-y-1">
                            {visible.map((sc) => (
                              <li
                                key={sc}
                                className="flex items-center justify-between text-xs text-slate-700"
                              >
                                {optionEdit.kind === "sub" &&
                                optionEdit.oldValue === sc &&
                                optionEdit.mainCategory ===
                                  formData.mainCategory ? (
                                  <div className="flex-1 flex items-center gap-2">
                                    <input
                                      value={optionEdit.value}
                                      onChange={(e) =>
                                        setOptionEdit((prev) => ({
                                          ...prev,
                                          value: e.target.value,
                                        }))
                                      }
                                      className="flex-1 px-2 py-1 border border-slate-300 rounded"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        renameCustomSubCategory(
                                          formData.mainCategory,
                                          optionEdit.oldValue,
                                          optionEdit.value,
                                        );
                                        setOptionEdit({
                                          kind: "",
                                          oldValue: "",
                                          value: "",
                                          mainCategory: "",
                                          subCategory: "",
                                        });
                                      }}
                                      className="px-2 py-1 rounded bg-emerald-600 text-white"
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setOptionEdit({
                                          kind: "",
                                          oldValue: "",
                                          value: "",
                                          mainCategory: "",
                                          subCategory: "",
                                        })
                                      }
                                      className="px-2 py-1 rounded border border-slate-300"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <span>{formatCatalogLabel(sc)}</span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    openConfirmDialog({
                                      title: "Remove Subcategory",
                                      message: `Remove subcategory "${formatCatalogLabel(sc)}" from this dropdown?`,
                                      confirmLabel: "Remove",
                                      variant: "danger",
                                      onConfirm: () =>
                                        hideSubCategory(
                                          formData.mainCategory,
                                          sc,
                                        ),
                                    });
                                  }}
                                  className="text-red-600 hover:text-red-700 p-1 rounded-full hover:bg-red-50"
                                >
                                  <FiX className="w-3 h-3" />
                                </button>
                                {customSubs.includes(sc) &&
                                  optionEdit.kind !== "sub" && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setOptionEdit({
                                          kind: "sub",
                                          oldValue: sc,
                                          value: sc,
                                          mainCategory: formData.mainCategory,
                                          subCategory: "",
                                        })
                                      }
                                      className="text-blue-600 hover:text-blue-700 p-1 rounded-full hover:bg-blue-50"
                                    >
                                      <FiEdit2 className="w-3 h-3" />
                                    </button>
                                  )}
                              </li>
                            ))}
                          </ul>
                        );
                      })()}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Medicine *
                  </label>
                  <div className="flex gap-2">
                    <select
                      disabled={!formData.subCategory}
                      value={formData.medicineName}
                      onChange={(e) => handleMedicineSelect(e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100 disabled:text-slate-500"
                    >
                      <option value="">Select Medicine</option>
                      {medicineOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {suppliers.find((s) => s.name === supplierSelection) && (
                      <select
                        disabled={
                          !supplierSelection || supplierSelection === "other"
                        }
                        onChange={(e) => {
                          const medName = e.target.value;
                          if (!medName) return;
                          const existing = medicines.find(
                            (m) =>
                              m.medicineName === medName &&
                              m.supplierName === supplierSelection,
                          );
                          if (existing) {
                            setFormData((prev) => ({
                              ...prev,
                              medicineName: existing.medicineName,
                              barcode: existing.barcode || prev.barcode,
                              unit: existing.unit || prev.unit,
                              containerType:
                                existing.containerType || prev.containerType,
                              purchasePrice:
                                existing.purchasePrice || prev.purchasePrice,
                              salePrice: existing.salePrice || prev.salePrice,
                              mlPerVial: existing.mlPerVial || prev.mlPerVial,
                              lowStockThreshold:
                                existing.lowStockThreshold ||
                                prev.lowStockThreshold,
                            }));
                            setMlPerVialInput(String(existing.mlPerVial || 0));
                          }
                        }}
                        className="w-48 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      >
                        <option value="">From Supplier...</option>
                        {[
                          ...new Set(
                            medicines
                              .filter(
                                (m) => m.supplierName === supplierSelection,
                              )
                              .map((m) => m.medicineName),
                          ),
                        ].map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowAddMedicineOption((v) => !v)}
                      className="text-xs text-green-600 hover:underline disabled:text-slate-400"
                      disabled={!formData.mainCategory || !formData.subCategory}
                    >
                      + Add New Medicine
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowManageMedicineOptions((v) => !v)}
                      className="text-xs text-purple-600 hover:underline disabled:text-slate-400"
                      disabled={!formData.mainCategory || !formData.subCategory}
                    >
                      Manage medicines
                    </button>
                  </div>
                  {showAddMedicineOption &&
                    formData.mainCategory &&
                    formData.subCategory && (
                      <div className="mt-2 flex gap-2">
                        <input
                          type="text"
                          placeholder="Enter new medicine name"
                          value={newMedicineName}
                          onChange={(e) => setNewMedicineName(e.target.value)}
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            addCustomMedicineOption(newMedicineName)
                          }
                          className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddMedicineOption(false);
                            setNewMedicineName("");
                          }}
                          className="px-3 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  {showManageMedicineOptions &&
                    formData.mainCategory &&
                    formData.subCategory && (
                      <div className="mt-2 p-2 border border-slate-200 rounded-lg bg-slate-50">
                        {(() => {
                          const catalogMeds = getCatalogMedicines(
                            formData.mainCategory,
                            formData.subCategory,
                          );
                          const customMeds = getCustomMedicines(
                            formData.mainCategory,
                            formData.subCategory,
                          );
                          const all = [
                            ...new Set([...catalogMeds, ...customMeds]),
                          ];
                          const hidden = getHiddenMedicines(
                            formData.mainCategory,
                            formData.subCategory,
                          );
                          const visible = all.filter(
                            (m) => !hidden.includes(m),
                          );
                          if (!visible.length) {
                            return (
                              <p className="text-xs text-slate-500">
                                No medicines for this category.
                              </p>
                            );
                          }
                          return (
                            <ul className="space-y-1">
                              {visible.map((m) => (
                                <li
                                  key={m}
                                  className="flex items-center justify-between text-xs text-slate-700"
                                >
                                  {optionEdit.kind === "med" &&
                                  optionEdit.oldValue === m &&
                                  optionEdit.mainCategory ===
                                    formData.mainCategory &&
                                  optionEdit.subCategory ===
                                    formData.subCategory ? (
                                    <div className="flex-1 flex items-center gap-2">
                                      <input
                                        value={optionEdit.value}
                                        onChange={(e) =>
                                          setOptionEdit((prev) => ({
                                            ...prev,
                                            value: e.target.value,
                                          }))
                                        }
                                        className="flex-1 px-2 py-1 border border-slate-300 rounded"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          renameCustomMedicineName(
                                            formData.mainCategory,
                                            formData.subCategory,
                                            optionEdit.oldValue,
                                            optionEdit.value,
                                          );
                                          setOptionEdit({
                                            kind: "",
                                            oldValue: "",
                                            value: "",
                                            mainCategory: "",
                                            subCategory: "",
                                          });
                                        }}
                                        className="px-2 py-1 rounded bg-emerald-600 text-white"
                                      >
                                        Save
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setOptionEdit({
                                            kind: "",
                                            oldValue: "",
                                            value: "",
                                            mainCategory: "",
                                            subCategory: "",
                                          })
                                        }
                                        className="px-2 py-1 rounded border border-slate-300"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <span>{m}</span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      openConfirmDialog({
                                        title: "Remove Medicine",
                                        message: `Remove medicine "${m}" from this dropdown?`,
                                        confirmLabel: "Remove",
                                        variant: "danger",
                                        onConfirm: () =>
                                          hideMedicineName(
                                            formData.mainCategory,
                                            formData.subCategory,
                                            m,
                                          ),
                                      });
                                    }}
                                    className="text-red-600 hover:text-red-700 p-1 rounded-full hover:bg-red-50"
                                  >
                                    <FiX className="w-3 h-3" />
                                  </button>
                                  {customMeds.includes(m) &&
                                    optionEdit.kind !== "med" && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setOptionEdit({
                                            kind: "med",
                                            oldValue: m,
                                            value: m,
                                            mainCategory: formData.mainCategory,
                                            subCategory: formData.subCategory,
                                          })
                                        }
                                        className="text-blue-600 hover:text-blue-700 p-1 rounded-full hover:bg-blue-50"
                                      >
                                        <FiEdit2 className="w-3 h-3" />
                                      </button>
                                    )}
                                </li>
                              ))}
                            </ul>
                          );
                        })()}
                      </div>
                    )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Batch Number{" "}
                    <span className="text-slate-500 text-xs">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.batchNo}
                    onChange={(e) =>
                      setFormData({ ...formData, batchNo: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Auto or manual batch reference"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Barcode Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.barcode}
                    onChange={(e) =>
                      setFormData({ ...formData, barcode: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Scan or type barcode"
                    autoComplete="off"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Quantity *
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={formData.quantity}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          quantity: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <select
                      value={
                        showCustomUnit
                          ? UNIT_CUSTOM_OPTION
                          : formData.unit || ""
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === UNIT_CUSTOM_OPTION) {
                          setShowCustomUnit(true);
                        } else {
                          setShowCustomUnit(false);
                          setFormData({ ...formData, unit: v });
                        }
                      }}
                      className="w-44 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {unitOptions.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                      <option value={UNIT_CUSTOM_OPTION}>+ Add New Unit</option>
                    </select>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Unit updates automatically with category selection
                  </p>
                  <div className="mt-1 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowManageUnit((v) => !v)}
                      className="text-xs text-purple-600 hover:underline"
                    >
                      Manage custom units
                    </button>
                  </div>
                  {showManageUnit && (
                    <div className="mt-2 p-2 border border-slate-200 rounded-lg bg-slate-50">
                      {customUnitsForCurrent.length === 0 ? (
                        <p className="text-xs text-slate-500">
                          No custom units for this category.
                        </p>
                      ) : (
                        <ul className="space-y-1">
                          {customUnitsForCurrent.map((u) => (
                            <li
                              key={u}
                              className="flex items-center justify-between text-xs text-slate-700"
                            >
                              {optionEdit.kind === "unit" &&
                              optionEdit.oldValue === u ? (
                                <div className="flex-1 flex items-center gap-2">
                                  <input
                                    value={optionEdit.value}
                                    onChange={(e) =>
                                      setOptionEdit((prev) => ({
                                        ...prev,
                                        value: e.target.value,
                                      }))
                                    }
                                    className="flex-1 px-2 py-1 border border-slate-300 rounded"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      renameCustomUnit(
                                        optionEdit.oldValue,
                                        optionEdit.value,
                                      );
                                      setOptionEdit({
                                        kind: "",
                                        oldValue: "",
                                        value: "",
                                        mainCategory: "",
                                        subCategory: "",
                                      });
                                    }}
                                    className="px-2 py-1 rounded bg-emerald-600 text-white"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOptionEdit({
                                        kind: "",
                                        oldValue: "",
                                        value: "",
                                        mainCategory: "",
                                        subCategory: "",
                                      })
                                    }
                                    className="px-2 py-1 rounded border border-slate-300"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <span>{u}</span>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  openConfirmDialog({
                                    title: "Delete Custom Unit",
                                    message: `Delete unit "${u}" from this category?`,
                                    confirmLabel: "Delete",
                                    variant: "danger",
                                    onConfirm: () => removeCustomUnit(u),
                                  });
                                }}
                                className="text-red-600 hover:text-red-700 p-1 rounded-full hover:bg-red-50"
                              >
                                <FiX className="w-3 h-3" />
                              </button>
                              {optionEdit.kind !== "unit" && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOptionEdit({
                                      kind: "unit",
                                      oldValue: u,
                                      value: u,
                                      mainCategory: "",
                                      subCategory: "",
                                    })
                                  }
                                  className="text-blue-600 hover:text-blue-700 p-1 rounded-full hover:bg-blue-50"
                                >
                                  <FiEdit2 className="w-3 h-3" />
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                {showCustomUnit && (
                  <div className="md:col-span-2 -mt-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter new unit (e.g. IU, strip, sachet)"
                        value={customUnitValue}
                        onChange={(e) => setCustomUnitValue(e.target.value)}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <button
                        type="button"
                        onClick={() => addCustomUnit(customUnitValue)}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
                      >
                        Add Unit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCustomUnit(false);
                          setCustomUnitValue("");
                        }}
                        className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {containerOptions.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Container Type
                    </label>
                    <select
                      value={
                        showCustomContainer
                          ? CONTAINER_CUSTOM_OPTION
                          : formData.containerType || ""
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === CONTAINER_CUSTOM_OPTION) {
                          setShowCustomContainer(true);
                        } else {
                          setShowCustomContainer(false);
                          setFormData({ ...formData, containerType: v });
                        }
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {containerOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                      <option value={CONTAINER_CUSTOM_OPTION}>
                        + Add New Container Type
                      </option>
                    </select>
                    <div className="mt-1 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setShowManageContainer((v) => !v)}
                        className="text-xs text-purple-600 hover:underline"
                      >
                        Manage custom container types
                      </button>
                    </div>
                    {showManageContainer && (
                      <div className="mt-2 p-2 border border-slate-200 rounded-lg bg-slate-50">
                        {customContainersForCurrent.length === 0 ? (
                          <p className="text-xs text-slate-500">
                            No custom container types for this category.
                          </p>
                        ) : (
                          <ul className="space-y-1">
                            {customContainersForCurrent.map((c) => (
                              <li
                                key={c}
                                className="flex items-center justify-between text-xs text-slate-700"
                              >
                                {optionEdit.kind === "container" &&
                                optionEdit.oldValue === c ? (
                                  <div className="flex-1 flex items-center gap-2">
                                    <input
                                      value={optionEdit.value}
                                      onChange={(e) =>
                                        setOptionEdit((prev) => ({
                                          ...prev,
                                          value: e.target.value,
                                        }))
                                      }
                                      className="flex-1 px-2 py-1 border border-slate-300 rounded"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        renameCustomContainer(
                                          optionEdit.oldValue,
                                          optionEdit.value,
                                        );
                                        setOptionEdit({
                                          kind: "",
                                          oldValue: "",
                                          value: "",
                                          mainCategory: "",
                                          subCategory: "",
                                        });
                                      }}
                                      className="px-2 py-1 rounded bg-emerald-600 text-white"
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setOptionEdit({
                                          kind: "",
                                          oldValue: "",
                                          value: "",
                                          mainCategory: "",
                                          subCategory: "",
                                        })
                                      }
                                      className="px-2 py-1 rounded border border-slate-300"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <span>{c}</span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    openConfirmDialog({
                                      title: "Delete Container Type",
                                      message: `Delete container type "${c}" from this category?`,
                                      confirmLabel: "Delete",
                                      variant: "danger",
                                      onConfirm: () => removeCustomContainer(c),
                                    });
                                  }}
                                  className="text-red-600 hover:text-red-700 p-1 rounded-full hover:bg-red-50"
                                >
                                  <FiX className="w-3 h-3" />
                                </button>
                                {optionEdit.kind !== "container" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOptionEdit({
                                        kind: "container",
                                        oldValue: c,
                                        value: c,
                                        mainCategory: "",
                                        subCategory: "",
                                      })
                                    }
                                    className="text-blue-600 hover:text-blue-700 p-1 rounded-full hover:bg-blue-50"
                                  >
                                    <FiEdit2 className="w-3 h-3" />
                                  </button>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {showCustomContainer && (
                  <div className="md:col-span-2 -mt-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter container type (e.g. Jar, Blister, Tube)"
                        value={customContainerValue}
                        onChange={(e) =>
                          setCustomContainerValue(e.target.value)
                        }
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <button
                        type="button"
                        onClick={() => addCustomContainer(customContainerValue)}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
                      >
                        Add Type
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCustomContainer(false);
                          setCustomContainerValue("");
                        }}
                        className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase">
                    Amount (Sale Price) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formData.salePrice}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        salePrice: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                    placeholder="Selling price"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase">
                    Minimum Sale Price
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={formData.minSalePrice}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        minSalePrice: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                    placeholder="Min allowed in POS"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Purchase Price *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.purchasePrice}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        purchasePrice: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Cost price"
                  />
                </div>

                {shouldShowPerContainerField(
                  formData.mainCategory,
                  formData.subCategory,
                ) && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        {getPerContainerLabel(
                          formData.mainCategory,
                          formData.subCategory,
                          formData.containerType,
                          formData.unit,
                        )}
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={mlPerVialInput}
                        onChange={(e) => {
                          const v = e.target.value;
                          setMlPerVialInput(v);
                          const num = Number(v);
                          if (!Number.isNaN(num)) {
                            setFormData({ ...formData, mlPerVial: num });
                          }
                        }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    {isLiquidLikeCategory(
                      formData.mainCategory,
                      formData.subCategory,
                    ) && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Remaining {formatUnitForDisplay(formData.unit, "ml")}{" "}
                          (Current {formData.containerType || "Container"})
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={
                            formData.remainingMl || formData.mlPerVial || 0
                          }
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              remainingMl: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          Track partially used liquid containePKR{" "}
                        </p>
                      </div>
                    )}
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Expiry Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.expiryDate}
                    onChange={(e) =>
                      setFormData({ ...formData, expiryDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Purchase Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.purchaseDate}
                    onChange={(e) =>
                      setFormData({ ...formData, purchaseDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Supplier Name *
                  </label>
                  <select
                    required
                    value={supplierSelection}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "other") {
                        setShowOtherSupplier(true);
                        setSupplierSelection("other");
                        setFormData({ ...formData, supplierName: "" });
                      } else {
                        setShowOtherSupplier(false);
                        setSupplierSelection(value);
                        setFormData({ ...formData, supplierName: value });
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.name}>
                        {supplier.name}
                      </option>
                    ))}
                    <option value="other">Other (Enter manually)</option>
                  </select>
                  {showOtherSupplier && (
                    <input
                      type="text"
                      required
                      placeholder="Enter supplier name"
                      value={formData.supplierName}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          supplierName: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mt-2"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Low Stock Threshold
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.lowStockThreshold}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        lowStockThreshold: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Description / Notes
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows="3"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Any special handling instructions"
                  />
                </div>
              </div>

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
                  {editingMedicine ? "Update Medicine" : "Add Medicine"}
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
