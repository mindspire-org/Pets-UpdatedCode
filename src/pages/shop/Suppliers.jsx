import React, { useRef, useState, useEffect, useMemo } from "react";
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiSearch,
  FiX,
  FiUser,
  FiPhone,
  FiMail,
  FiMapPin,
  FiDownload,
  FiUpload,
  FiPackage,
  FiEye,
  FiCheckCircle,
  FiXCircle,
  FiUsers,
} from "react-icons/fi";
import * as XLSX from "xlsx";
import {
  petShopSuppliersAPI,
  payablesAPI,
  petshopPharmacyMedicinesAPI,
  petShopCompaniesAPI,
} from "../../services/api";

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [supplierToDelete, setSupplierToDelete] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsSupplier, setDetailsSupplier] = useState(null);
  const [detailsTab, setDetailsTab] = useState("summary");
  const [detailsInvoices, setDetailsInvoices] = useState([]);
  const [detailsItems, setDetailsItems] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showMedDropdown, setShowMedDropdown] = useState(false);
  const [purchaseData, setPurchaseData] = useState({
    productName: "",
    quantity: 0,
    unitPrice: 0,
    invoiceNumber: "",
  });

  // Record Payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentSupplier, setPaymentSupplier] = useState(null);
  const [paymentData, setPaymentData] = useState({
    invoiceNumber: "",
    amount: "",
    paymentMethod: "Cash",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const [pharmacyInvoices, setPharmacyInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // Assign Companies modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignSupplier, setAssignSupplier] = useState(null);
  const [assignedCompanyIds, setAssignedCompanyIds] = useState([]);

  const [formData, setFormData] = useState({
    name: "",
    companyId: "",
    phone: "",
    address: "",
    taxId: "",
    status: "active",
  });

  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchSuppliers();
    fetchMedicines();
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const response = await petShopCompaniesAPI.getAll("shop", "active");
      setCompanies(response.data || []);
    } catch (error) {
      console.error("Fetch companies error:", error);
    }
  };

  const fetchMedicines = async () => {
    try {
      const response = await petshopPharmacyMedicinesAPI.getAll();
      const meds = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response)
          ? response
          : [];
      setMedicines(meds);
    } catch (error) {
      console.error("Fetch medicines error:", error);
    }
  };

  useEffect(() => {
    filterSuppliers();
    setCurrentPage(1);
  }, [suppliers, searchQuery]);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const response = await petShopSuppliersAPI.getAll("shop");
      const list = (response.data || []).map((s) => ({
        id: s._id,
        _id: s._id,
        name: s.supplierName || s.name || "",
        phone: s.phone || "",
        address: s.address || "",
        taxId: s.taxId || "",
        status: s.status || "active",
        companyId: s.companyId || "",
        totalPurchases: s.totalPurchases || 0,
        totalPaid: s.totalPaid || 0,
        purchaseHistory: Array.isArray(s.purchaseHistory) ? s.purchaseHistory : [],
        // keep for backward compat display
        contactPerson: s.contactPerson || "",
        email: s.email || "",
        city: s.city || s.supplierCity || "",
        description: s.notes || s.description || "",
        companyIds: Array.isArray(s.companyIds) ? s.companyIds.map(id => String(id)) : [],
      }));
      setSuppliers(list);
    } catch (error) {
      showToast("Error fetching suppliers");
      console.error("Fetch suppliers error:", error);
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  };

  const filterSuppliers = () => {
    let filtered = suppliers;

    if (searchQuery) {
      filtered = filtered.filter(
        (supplier) =>
          supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          supplier.contactPerson
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          supplier.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
          supplier.city.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    setFilteredSuppliers(filtered);
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(""), 3000);
  };

  const normalizeKey = (v) =>
    String(v || "")
      .trim()
      .toLowerCase();

  const getRowValue = (row, keys) => {
    if (!row || typeof row !== "object") return "";
    const map = new Map(Object.keys(row).map((k) => [normalizeKey(k), row[k]]));
    for (const k of keys) {
      const v = map.get(normalizeKey(k));
      if (v !== undefined && v !== null && String(v).trim() !== "") return v;
    }
    return "";
  };

  const exportSuppliersToExcel = () => {
    try {
      const rows = (suppliers || []).map((s) => ({
        "Supplier Name": s.name || "",
        "Contact Person": s.contactPerson || "",
        Phone: s.phone || "",
        Email: s.email || "",
        Address: s.address || "",
        City: s.city || "",
        Notes: s.description || "",
        Portal: "shop",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Suppliers");
      XLSX.writeFile(
        wb,
        `petshop-suppliers-${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
    } catch (e) {
      console.error("Export suppliers failed", e);
      showToast("Export failed");
    }
  };

  const importSuppliersFromExcel = async (file) => {
    if (!file) return;
    try {
      setImporting(true);
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames?.[0];
      const ws = sheetName ? wb.Sheets[sheetName] : null;
      if (!ws) {
        showToast("No sheet found");
        return;
      }

      const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const items = (json || [])
        .map((row) => {
          const supplierName = String(
            getRowValue(row, [
              "supplierName",
              "supplier name",
              "name",
              "supplier",
              "Supplier Name",
            ]) || "",
          ).trim();
          const contactPerson = String(
            getRowValue(row, [
              "contactPerson",
              "contact person",
              "contact",
              "Contact Person",
            ]) || "",
          ).trim();
          const phone = String(
            getRowValue(row, ["phone", "mobile", "Phone"]) || "",
          ).trim();
          const email = String(
            getRowValue(row, ["email", "Email"]) || "",
          ).trim();
          const address = String(
            getRowValue(row, ["address", "Address"]) || "",
          ).trim();
          const city = String(getRowValue(row, ["city", "City"]) || "").trim();
          const notes = String(
            getRowValue(row, ["notes", "note", "description", "Notes"]) || "",
          ).trim();
          return {
            supplierName,
            contactPerson,
            phone,
            email,
            address,
            city,
            notes,
            portal: "shop",
          };
        })
        .filter((x) => x.supplierName);

      if (!items.length) {
        showToast("No valid rows found");
        return;
      }

      const res = await petShopSuppliersAPI.bulkUpsert(items);
      const created = res?.created ?? 0;
      const updated = res?.updated ?? 0;
      const failed = res?.failed ?? 0;
      showToast(
        `Imported: ${created} created, ${updated} updated, ${failed} failed`,
      );
      await fetchSuppliers();
    } catch (e) {
      console.error("Import suppliers failed", e);
      showToast("Import failed");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const openModal = (supplier = null) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        name: supplier.name || "",
        companyId: supplier.companyId || "",
        phone: supplier.phone || "",
        address: supplier.address || "",
        taxId: supplier.taxId || "",
        status: supplier.status || "active",
      });
    } else {
      setEditingSupplier(null);
      setFormData({
        name: "",
        companyId: "",
        phone: "",
        address: "",
        taxId: "",
        status: "active",
      });
    }
    setShowModal(true);
  };

  const openPurchaseModal = (supplier) => {
    setSelectedSupplier(supplier);
    setPurchaseData({
      productName: "",
      quantity: 0,
      unitPrice: 0,
      invoiceNumber: "",
      medicineId: "",
    });
    setShowPurchaseModal(true);
  };

  const openPaymentModal = async (supplier) => {
    setPaymentSupplier(supplier);
    const today = new Date().toISOString().split("T")[0];
    setPaymentData({
      invoiceNumber: "",
      amount: "",
      paymentMethod: "Cash",
      date: today,
      notes: "",
    });
    setPharmacyInvoices([]);
    setShowPaymentModal(true);
    // Fetch real invoices from PharmacyPurchase
    try {
      setLoadingInvoices(true);
      const res = await petShopSuppliersAPI.getPharmacyInvoices(supplier._id || supplier.id);
      setPharmacyInvoices(res.data || []);
    } catch {
      setPharmacyInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    const amount = Number(paymentData.amount);
    if (!amount || amount <= 0) {
      showToast("Enter a valid amount");
      return;
    }
    try {
      await petShopSuppliersAPI.addPayment(
        paymentSupplier._id || paymentSupplier.id,
        {
          amount,
          paymentMethod: paymentData.paymentMethod,
          notes: paymentData.notes || "",
          date: paymentData.date,
          invoiceNumber: paymentData.invoiceNumber || undefined,
        },
      );

      // Re-fetch invoices so the dropdown cards (Total/Paid/Remaining) update immediately
      try {
        const invRes = await petShopSuppliersAPI.getPharmacyInvoices(paymentSupplier._id || paymentSupplier.id);
        const updatedInvoices = invRes.data || [];
        setPharmacyInvoices(updatedInvoices);
        // Update the amount field with the new remaining for the selected invoice
        if (paymentData.invoiceNumber) {
          const updatedInv = updatedInvoices.find(p => p.invoiceNo === paymentData.invoiceNumber);
          const newRemaining = updatedInv ? Math.max(0, Number(updatedInv.remaining ?? (Number(updatedInv.netTotal || 0) - Number(updatedInv.amountPaid || 0)))) : 0;
          setPaymentData(prev => ({ ...prev, amount: newRemaining > 0 ? String(newRemaining) : "" }));
        }
      } catch {
        // non-critical — invoices will refresh on next open
      }

      // Refresh supplier cards (totalPurchases, totalPaid, balance)
      await fetchSuppliers();
      showToast("Payment recorded successfully");
      setShowPaymentModal(false);
    } catch (error) {
      console.error("Payment error:", error);
      showToast("Error recording payment");
    }
  };

  const openAssignModal = (supplier) => {
    setAssignSupplier(supplier);
    // Use companyIds array if available, otherwise fallback to companyId (from create/edit form)
    const existingIds = supplier.companyIds?.length
      ? supplier.companyIds
      : supplier.companyId
        ? [String(supplier.companyId)]
        : [];
    setAssignedCompanyIds(existingIds);
    setShowAssignModal(true);
  };

  const handleAssignSave = async () => {
    if (!assignSupplier) return;
    try {
      await petShopSuppliersAPI.update(assignSupplier._id || assignSupplier.id, {
        companyIds: assignedCompanyIds,
      });
      await fetchSuppliers();
      showToast("Companies assigned successfully");
      setShowAssignModal(false);
    } catch (error) {
      showToast("Error assigning companies");
    }
  };

  const toggleCompanyAssign = (companyId) => {
    setAssignedCompanyIds((prev) =>
      prev.includes(companyId)
        ? prev.filter((id) => id !== companyId)
        : [...prev, companyId]
    );
  };

  const handlePurchaseSubmit = async (e) => {
    e.preventDefault();
    try {
      const totalAmount = purchaseData.quantity * purchaseData.unitPrice;

      // 1. Create Payable in Admin
      await payablesAPI.create({
        supplierId: selectedSupplier._id || selectedSupplier.id,
        supplierName: selectedSupplier.name,
        billRef: purchaseData.invoiceNumber || `PUR-${Date.now()}`,
        totalAmount: totalAmount,
        balance: totalAmount,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        portal: "shop",
        status: "open",
        description: `Purchase of ${purchaseData.productName}`,
      });

      // 2. Add to Supplier Purchase History
      await petShopSuppliersAPI.addPurchase(
        selectedSupplier._id || selectedSupplier.id,
        {
          productId: purchaseData.medicineId,
          productName: purchaseData.productName,
          quantity: purchaseData.quantity,
          unitPrice: purchaseData.unitPrice,
          invoiceNumber: purchaseData.invoiceNumber,
          totalPrice: totalAmount,
          portal: "shop",
        },
      );

      // 3. Update Supplier Totals locally or refetch
      await fetchSuppliers();

      showToast("Purchase recorded and payable created in Admin");
      setShowPurchaseModal(false);
    } catch (error) {
      console.error("Purchase error:", error);
      showToast("Error recording purchase");
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingSupplier(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        supplierName: formData.name,
        phone: formData.phone,
        address: formData.address,
        taxId: formData.taxId || "",
        status: formData.status || "active",
        portal: "shop",
        companyId: formData.companyId || null,
        // clear removed fields
        contactPerson: "",
        email: "",
        city: "",
        notes: "",
      };
      if (editingSupplier && (editingSupplier._id || editingSupplier.id)) {
        await petShopSuppliersAPI.update(
          editingSupplier._id || editingSupplier.id,
          payload,
        );
        showToast("Supplier updated successfully");
      } else {
        await petShopSuppliersAPI.create(payload);
        showToast("Supplier added successfully");
      }
      await fetchSuppliers();
      closeModal();
    } catch (error) {
      showToast("Error saving supplier");
    }
  };

  const openDeleteModal = (supplier) => {
    setSupplierToDelete(supplier);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!supplierToDelete) return;
    try {
      await petShopSuppliersAPI.delete(supplierToDelete._id || supplierToDelete.id);
      showToast("Supplier deleted successfully");
      await fetchSuppliers();
      setShowDeleteModal(false);
      setSupplierToDelete(null);
    } catch (error) {
      showToast("Error deleting supplier");
      setShowDeleteModal(false);
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
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Supplier Management
          </h1>
          <p className="text-slate-500 mt-1">
            Manage petshop suppliers and vendors           </p>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1">
          <button
            onClick={exportSuppliersToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg whitespace-nowrap"
          >
            <FiDownload /> Export Excel
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white rounded-lg whitespace-nowrap"
          >
            <FiUpload /> {importing ? "Importing..." : "Import Excel"}
          </button>
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg whitespace-nowrap"
          >
            <FiPlus /> Add Supplier
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => importSuppliersFromExcel(e.target.files?.[0])}
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-slate-800">{suppliers.length}</p>
          <p className="text-sm text-slate-500 mt-1">Total</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{suppliers.filter(s => s.status !== "inactive").length}</p>
          <p className="text-sm text-slate-500 mt-1">Active</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-red-500">{suppliers.filter(s => s.status === "inactive").length}</p>
          <p className="text-sm text-slate-500 mt-1">Inactive</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, contact person, phone, or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={itemsPerPage}
            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-slate-700"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>Show {n}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <FiUser className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>No suppliers found</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
            {filteredSuppliers
              .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
              .map((supplier) => (
              <div
                key={supplier.id}
                className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                {/* Header: name | status badge + edit + delete */}
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-slate-800 text-lg truncate flex-1 min-w-0 mr-2">
                    {supplier.name}
                  </h3>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Status badge */}
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                      supplier.status === "inactive"
                        ? "bg-red-100 text-red-600"
                        : "bg-green-100 text-green-700"
                    }`}>
                      {supplier.status === "inactive"
                        ? <FiXCircle className="w-3 h-3" />
                        : <FiCheckCircle className="w-3 h-3" />}
                      <span className="capitalize">{supplier.status || "active"}</span>
                    </span>
                    <button onClick={() => openModal(supplier)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg">
                      <FiEdit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => openDeleteModal(supplier)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg">
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Phone + Address in same row */}
                {(supplier.phone || supplier.address) && (
                  <div className="flex items-center gap-4 text-sm text-slate-600 mt-2 flex-wrap">
                    {supplier.phone && (
                      <div className="flex items-center gap-1.5">
                        <FiPhone className="w-3.5 h-3.5 shrink-0" />
                        <span>{supplier.phone}</span>
                      </div>
                    )}
                    {supplier.address && (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <FiMapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{supplier.address}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Financials */}
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Total Purchases:</span>
                    <span className="font-bold text-slate-800">PKR {(supplier.totalPurchases || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Total Paid:</span>
                    <span className="font-semibold text-emerald-600">PKR {(supplier.totalPaid || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-1 border-t border-slate-100">
                    <span className="text-slate-600 font-medium">Balance Payable:</span>
                    <span className="font-bold text-red-600">PKR {Math.max(0, (supplier.totalPurchases || 0) - (supplier.totalPaid || 0)).toLocaleString()}</span>
                  </div>
                </div>

                {/* Buttons — 2×2 grid */}
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <button
                    onClick={() => openPaymentModal(supplier)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700 transition-colors"
                  >
                    <FiPackage className="w-3.5 h-3.5" /> Record Payment
                  </button>
                  <button
                    onClick={async () => {
                      setDetailsSupplier(supplier);
                      setDetailsTab("summary");
                      setDetailsInvoices([]);
                      setDetailsItems([]);
                      setShowDetailsModal(true);
                      try {
                        setLoadingDetails(true);
                        const [invRes, itemRes] = await Promise.all([
                          petShopSuppliersAPI.getPharmacyInvoices(supplier._id || supplier.id),
                          petShopSuppliersAPI.getPurchaseItems(supplier._id || supplier.id),
                        ]);
                        setDetailsInvoices(invRes.data || []);
                        setDetailsItems(itemRes.data || []);
                      } catch {
                        setDetailsInvoices([]);
                        setDetailsItems([]);
                      } finally {
                        setLoadingDetails(false);
                      }
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-700 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors"
                  >
                    <FiEye className="w-3.5 h-3.5" /> View Details
                  </button>
                  <button
                    onClick={() => openAssignModal(supplier)}
                    className="col-span-2 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
                  >
                    <FiUsers className="w-3.5 h-3.5" /> Assign Companies
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {filteredSuppliers.length > itemsPerPage && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200">
              <p className="text-sm text-slate-500">
                Showing{" "}
                <span className="font-medium text-slate-700">{(currentPage - 1) * itemsPerPage + 1}</span>
                {" "}–{" "}
                <span className="font-medium text-slate-700">{Math.min(currentPage * itemsPerPage, filteredSuppliers.length)}</span>
                {" "}of{" "}
                <span className="font-medium text-slate-700">{filteredSuppliers.length}</span>
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {Array.from({ length: Math.ceil(filteredSuppliers.length / itemsPerPage) }, (_, i) => i + 1)
                  .filter((page) => {
                    const total = Math.ceil(filteredSuppliers.length / itemsPerPage);
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
                            ? "bg-blue-600 text-white border-blue-600"
                            : "border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {page}
                      </button>
                    </React.Fragment>
                  ))}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(Math.ceil(filteredSuppliers.length / itemsPerPage), p + 1))}
                  disabled={currentPage >= Math.ceil(filteredSuppliers.length / itemsPerPage)}
                  className="px-3 py-1 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
          </>
        )}
      </div>

      {/* View Details Modal */}
      {showDetailsModal && detailsSupplier && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
              <h3 className="text-xl font-bold text-slate-800">Supplier Details</h3>
              <button
                onClick={() => { setShowDetailsModal(false); setDetailsSupplier(null); }}
                className="px-4 py-1.5 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 text-sm"
              >
                Close
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-6">
              {/* Supplier Info */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200">
                  <h4 className="font-semibold text-slate-700">Supplier Info</h4>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div><span className="text-slate-500">Name: </span><span className="font-medium text-slate-800">{detailsSupplier.name}</span></div>
                  <div>
                    <span className="text-slate-500">Status: </span>
                    <span className={`font-medium capitalize ${detailsSupplier.status === "inactive" ? "text-red-500" : "text-green-600"}`}>
                      {detailsSupplier.status || "active"}
                    </span>
                  </div>
                  {detailsSupplier.phone && (
                    <div><span className="text-slate-500">Phone: </span><span className="font-medium text-slate-800">{detailsSupplier.phone}</span></div>
                  )}
                  {detailsSupplier.address && (
                    <div><span className="text-slate-500">Address: </span><span className="font-medium text-slate-800">{detailsSupplier.address}</span></div>
                  )}
                  {detailsSupplier.taxId && (
                    <div><span className="text-slate-500">Tax ID: </span><span className="font-medium text-slate-800">{detailsSupplier.taxId}</span></div>
                  )}
                  <div><span className="text-slate-500">Total Purchases: </span><span className="font-bold text-slate-800">PKR {(detailsSupplier.totalPurchases || 0).toLocaleString()}</span></div>
                  <div><span className="text-slate-500">Total Paid: </span><span className="font-bold text-emerald-600">PKR {(detailsSupplier.totalPaid || 0).toLocaleString()}</span></div>
                  <div><span className="text-slate-500">Balance: </span><span className="font-bold text-red-600">PKR {Math.max(0, (detailsSupplier.totalPurchases || 0) - (detailsSupplier.totalPaid || 0)).toLocaleString()}</span></div>
                </div>
              </div>

              {/* Tabs */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                {/* Tab Headers */}
                <div className="flex border-b border-slate-200 bg-slate-50">
                  <button
                    onClick={() => setDetailsTab("summary")}
                    className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${
                      detailsTab === "summary"
                        ? "bg-white text-purple-600 border-b-2 border-purple-600"
                        : "text-slate-600 hover:text-slate-800 hover:bg-slate-100"
                    }`}
                  >
                    Purchase Summary
                  </button>
                  <button
                    onClick={() => setDetailsTab("items")}
                    className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${
                      detailsTab === "items"
                        ? "bg-white text-purple-600 border-b-2 border-purple-600"
                        : "text-slate-600 hover:text-slate-800 hover:bg-slate-100"
                    }`}
                  >
                    Supplied Items
                  </button>
                </div>

                {/* Tab Content */}
                <div className="bg-white">
                  {detailsTab === "summary" ? (
                    loadingDetails ? (
                      <p className="text-sm text-slate-400 text-center py-8">Loading invoices...</p>
                    ) : detailsInvoices.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-8">No purchase records</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                              {["Invoice", "Date", "Total", "Paid", "Remaining", "Status"].map((h) => (
                                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {detailsInvoices.map((p, i) => (
                              <tr key={i} className="hover:bg-slate-50">
                                <td className="px-4 py-2.5 font-medium text-slate-700">{p.invoiceNo || "—"}</td>
                                <td className="px-4 py-2.5 text-slate-600">{p.purchaseDate ? new Date(p.purchaseDate).toLocaleDateString("en-CA") : "—"}</td>
                                <td className="px-4 py-2.5 text-slate-800 font-medium">Rs {Number(p.netTotal || 0).toLocaleString()}</td>
                                <td className="px-4 py-2.5 text-emerald-600 font-medium">Rs {Number(p.amountPaid || 0).toLocaleString()}</td>
                                <td className="px-4 py-2.5 text-red-600 font-medium">Rs {Number(p.remaining || 0).toLocaleString()}</td>
                                <td className="px-4 py-2.5">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                    p.paymentStatus === "Paid" ? "bg-green-100 text-green-700" :
                                    p.paymentStatus === "Partial" ? "bg-yellow-100 text-yellow-700" :
                                    "bg-red-100 text-red-700"
                                  }`}>{p.paymentStatus || "Pending"}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                            <tr>
                              <td colSpan={2} className="px-4 py-2.5 text-xs font-bold text-slate-600 uppercase">Totals</td>
                              <td className="px-4 py-2.5 font-bold text-slate-800">Rs {detailsInvoices.reduce((s, p) => s + Number(p.netTotal || 0), 0).toLocaleString()}</td>
                              <td className="px-4 py-2.5 font-bold text-emerald-600">Rs {detailsInvoices.reduce((s, p) => s + Number(p.amountPaid || 0), 0).toLocaleString()}</td>
                              <td className="px-4 py-2.5 font-bold text-red-600">Rs {detailsInvoices.reduce((s, p) => s + Number(p.remaining || 0), 0).toLocaleString()}</td>
                              <td />
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )
                  ) : (
                    loadingDetails ? (
                      <p className="text-sm text-slate-400 text-center py-8">Loading items...</p>
                    ) : detailsItems.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-8">No items recorded</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                              {["Medicine", "Batch", "Category", "Qty Packs", "Units/Pack", "Total Units", "Buy/Pack", "Buy/Unit", "Sale/Pack", "Line Total", "Expiry", "Invoice", "Date"].map((h) => (
                                <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {detailsItems.map((item, i) => (
                              <tr key={i} className="hover:bg-slate-50">
                                <td className="px-3 py-2.5 font-medium text-slate-800 whitespace-nowrap">
                                  {item.medicineName}
                                  {item.genericName && <div className="text-xs text-slate-400">{item.genericName}</div>}
                                </td>
                                <td className="px-3 py-2.5 text-slate-500 font-mono text-xs">{item.batchNo || "—"}</td>
                                <td className="px-3 py-2.5">
                                  <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">{item.category || "—"}</span>
                                </td>
                                <td className="px-3 py-2.5 text-slate-700 text-center">{item.qtyPacks}</td>
                                <td className="px-3 py-2.5 text-slate-700 text-center">{item.unitsPerPack}</td>
                                <td className="px-3 py-2.5 font-medium text-blue-700 text-center">{item.totalItems} {item.unit}</td>
                                <td className="px-3 py-2.5 text-slate-700">Rs {Number(item.buyPerPack || 0).toFixed(2)}</td>
                                <td className="px-3 py-2.5 text-slate-700">Rs {Number(item.buyPerUnit || 0).toFixed(2)}</td>
                                <td className="px-3 py-2.5 text-green-700">Rs {Number(item.salePerPack || 0).toFixed(2)}</td>
                                <td className="px-3 py-2.5 font-bold text-slate-800">Rs {Number(item.lineTotal || 0).toFixed(2)}</td>
                                <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap text-xs">{item.expiryDate ? new Date(item.expiryDate).toLocaleDateString("en-CA") : "—"}</td>
                                <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{item.invoiceNo || "—"}</td>
                                <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap text-xs">{item.purchaseDate ? new Date(item.purchaseDate).toLocaleDateString("en-CA") : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Record Purchase Modal */}
      {showPurchaseModal && selectedSupplier && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 flex items-center justify-between text-white">
              <h3 className="text-xl font-bold text-white">Record Purchase</h3>
              <button
                onClick={() => setShowPurchaseModal(false)}
                className="text-white hover:bg-white/20 p-2 rounded-lg"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePurchaseSubmit} className="p-6 space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl mb-4">
                <p className="text-sm text-slate-500">Supplier:</p>
                <p className="font-bold text-slate-900">
                  {selectedSupplier.name}
                </p>
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Item/Medicine Name *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={purchaseData.productName}
                    onChange={(e) => {
                      setPurchaseData({
                        ...purchaseData,
                        productName: e.target.value,
                      });
                      setShowMedDropdown(true);
                    }}
                    onFocus={() => setShowMedDropdown(true)}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter medicine name"
                  />
                  {medicines.some(
                    (m) =>
                      m.supplierName === selectedSupplier.name ||
                      m.supplierName === selectedSupplier.supplierName,
                  ) && (
                    <select
                      onChange={(e) => {
                        const medName = e.target.value;
                        if (!medName) return;
                        const m = medicines.find(
                          (med) =>
                            med.medicineName === medName &&
                            (med.supplierName === selectedSupplier.name ||
                              med.supplierName ===
                                selectedSupplier.supplierName),
                        );
                        if (m) {
                          setPurchaseData({
                            ...purchaseData,
                            productName: m.medicineName,
                            unitPrice: Number(m.purchasePrice || 0),
                            medicineId: m._id || m.id,
                          });
                          setShowMedDropdown(false);
                        }
                      }}
                      className="w-40 px-2 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">History...</option>
                      {[
                        ...new Set(
                          medicines
                            .filter(
                              (m) =>
                                m.supplierName === selectedSupplier.name ||
                                m.supplierName ===
                                  selectedSupplier.supplierName,
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
                {showMedDropdown && purchaseData.productName && (
                  <div className="absolute z-[60] w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {medicines
                      .filter((m) =>
                        m.medicineName
                          .toLowerCase()
                          .includes(purchaseData.productName.toLowerCase()),
                      )
                      .map((m, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="w-full text-left px-4 py-2 hover:bg-purple-50 text-sm border-b last:border-0"
                          onClick={() => {
                            setPurchaseData({
                              ...purchaseData,
                              productName: m.medicineName,
                              unitPrice: Number(m.purchasePrice || 0),
                              medicineId: m._id || m.id,
                            });
                            setShowMedDropdown(false);
                          }}
                        >
                          <div className="font-bold">{m.medicineName}</div>
                          <div className="text-xs text-slate-500">
                            Stock: {m.quantity} | Purchase Price: PKR{" "}
                            {m.purchasePrice || "N/A"}
                          </div>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={purchaseData.quantity}
                    onChange={(e) =>
                      setPurchaseData({
                        ...purchaseData,
                        quantity: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Unit Cost *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={purchaseData.unitPrice}
                    onChange={(e) =>
                      setPurchaseData({
                        ...purchaseData,
                        unitPrice: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Invoice/Bill Number
                </label>
                <input
                  type="text"
                  value={purchaseData.invoiceNumber}
                  onChange={(e) =>
                    setPurchaseData({
                      ...purchaseData,
                      invoiceNumber: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Optional"
                />
              </div>

              <div className="bg-purple-50 p-4 rounded-xl">
                <div className="flex justify-between items-center text-purple-900 font-bold">
                  <span>Total Amount:</span>
                  <span>
                    PKR {" "}
                    {(
                      purchaseData.quantity * purchaseData.unitPrice
                    ).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPurchaseModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold"
                >
                  Record & Create Payable
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && paymentSupplier && (() => {
        const selectedInv = pharmacyInvoices.find(p => p.invoiceNo === paymentData.invoiceNumber);
        const invTotal     = selectedInv ? Number(selectedInv.netTotal || 0) : 0;
        const invPaid      = selectedInv ? Number(selectedInv.amountPaid || 0) : 0;
        const invRemaining = selectedInv ? Math.max(0, Number(selectedInv.remaining ?? (invTotal - invPaid))) : 0;
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 flex items-center justify-between shrink-0">
                <h3 className="text-xl font-bold text-white">Record Payment</h3>
                <button onClick={() => setShowPaymentModal(false)} className="text-white hover:bg-white/20 p-2 rounded-lg">
                  <FiX className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handlePaymentSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                <div className="bg-slate-50 px-4 py-3 rounded-xl">
                  <p className="text-xs text-slate-500">Supplier</p>
                  <p className="font-bold text-slate-800">{paymentSupplier.name}</p>
                </div>

                {/* Invoice dropdown */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Invoice</label>
                  <select
                    value={paymentData.invoiceNumber}
                    onChange={(e) => {
                      const val = e.target.value;
                      const inv = pharmacyInvoices.find(p => p.invoiceNo === val);
                      const remaining = inv ? Math.max(0, Number(inv.remaining ?? (Number(inv.netTotal || 0) - Number(inv.amountPaid || 0)))) : 0;
                      setPaymentData({
                        ...paymentData,
                        invoiceNumber: val,
                        // Auto-fill amount with remaining balance when an invoice is selected
                        amount: val && inv ? String(remaining) : "",
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">General Payment (No Specific Invoice)</option>
                    {loadingInvoices ? (
                      <option disabled>Loading invoices...</option>
                    ) : pharmacyInvoices.length === 0 ? (
                      <option disabled>No invoices found</option>
                    ) : (
                      pharmacyInvoices.map((p, i) => (
                        <option key={i} value={p.invoiceNo}>
                          {p.invoiceNo} — Total: Rs {Number(p.netTotal || 0).toLocaleString()} | Remaining: Rs {Number(p.remaining || 0).toLocaleString()}
                        </option>
                      ))
                    )}
                  </select>
                  {selectedInv && (
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-slate-50 rounded-lg px-3 py-2">
                        <p className="text-slate-500">Total</p>
                        <p className="font-bold text-slate-800">Rs {invTotal.toLocaleString()}</p>
                      </div>
                      <div className="bg-green-50 rounded-lg px-3 py-2">
                        <p className="text-slate-500">Paid</p>
                        <p className="font-bold text-green-600">Rs {invPaid.toLocaleString()}</p>
                      </div>
                      <div className="bg-red-50 rounded-lg px-3 py-2">
                        <p className="text-slate-500">Remaining</p>
                        <p className="font-bold text-red-600">Rs {invRemaining.toLocaleString()}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={paymentData.amount}
                    onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter payment amount"
                  />
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
                  <div className="flex gap-2">
                    {["Cash", "Card", "Online Transfer"].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPaymentData({ ...paymentData, paymentMethod: m })}
                        className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-colors ${
                          paymentData.paymentMethod === m
                            ? "bg-purple-600 border-purple-600 text-white"
                            : "border-slate-300 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={paymentData.date}
                    onChange={(e) => setPaymentData({ ...paymentData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Note */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Note</label>
                  <textarea
                    rows="2"
                    value={paymentData.notes}
                    onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    placeholder="Optional note"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowPaymentModal(false)} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold">
                    Record Payment
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Assign Companies Modal */}
      {showAssignModal && assignSupplier && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[85vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-bold text-white">Assign Companies</h3>
                <p className="text-xs text-blue-100 mt-0.5">{assignSupplier.name}</p>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-white hover:bg-white/20 p-2 rounded-lg"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Company list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {companies.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">
                  No companies found. Add companies first.
                </p>
              ) : (
                companies.map((company) => {
                  const checked = assignedCompanyIds.includes(String(company._id));
                  return (
                    <label
                      key={company._id}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        checked
                          ? "border-blue-400 bg-blue-50"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCompanyAssign(String(company._id))}
                        className="w-4 h-4 accent-blue-600 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {company.companyName}
                        </p>
                        <span className={`text-xs ${company.status === "inactive" ? "text-red-500" : "text-green-600"}`}>
                          {company.status || "active"}
                        </span>
                      </div>
                      {checked && (
                        <FiCheckCircle className="w-4 h-4 text-blue-600 shrink-0" />
                      )}
                    </label>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-slate-200 shrink-0">
              <p className="text-xs text-slate-500 mb-3">
                {assignedCompanyIds.length} compan{assignedCompanyIds.length === 1 ? "y" : "ies"} selected
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAssignSave}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold"
                >
                  Save Assignment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Supplier Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">
                {editingSupplier ? "Edit Supplier" : "Add New Supplier"}
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
                {/* Supplier Name */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Supplier Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter supplier name"
                  />
                </div>

                {/* Company */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Select Company
                  </label>
                  <select
                    value={formData.companyId}
                    onChange={(e) =>
                      setFormData({ ...formData, companyId: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">None</option>
                    {companies.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.companyName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter phone number"
                  />
                </div>

                {/* Tax ID */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Tax ID
                  </label>
                  <input
                    type="text"
                    value={formData.taxId}
                    onChange={(e) =>
                      setFormData({ ...formData, taxId: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter tax ID"
                  />
                </div>

                {/* Address */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter address"
                  />
                </div>

                {/* Status */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Status
                  </label>
                  <div className="flex gap-3">
                    {["active", "inactive"].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setFormData({ ...formData, status: s })}
                        className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors capitalize ${
                          formData.status === s
                            ? s === "active"
                              ? "bg-green-600 border-green-600 text-white"
                              : "bg-red-500 border-red-500 text-white"
                            : "border-slate-300 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
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
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  {editingSupplier ? "Update Supplier" : "Add Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && supplierToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
              <div className="flex items-center gap-3 text-white">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <FiTrash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Delete Supplier</h3>
                  <p className="text-sm text-red-100">
                    This action cannot be undone
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <p className="text-slate-700 mb-4">
                Are you sure you want to delete{" "}
                <span className="font-bold">{supplierToDelete.name}</span>?
              </p>

              <div className="bg-slate-50 rounded-lg p-4 mb-6">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Contact Person:</span>
                    <span className="font-medium text-slate-800">
                      {supplierToDelete.contactPerson}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Phone:</span>
                    <span className="font-semibold text-slate-900">
                      {supplierToDelete.phone}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSupplierToDelete(null);
                  }}
                  className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl font-semibold shadow-lg"
                >
                  Delete Supplier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
