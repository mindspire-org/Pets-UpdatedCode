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
} from "react-icons/fi";
import * as XLSX from "xlsx";
import {
  suppliersAPI,
  payablesAPI,
  pharmacyMedicinesAPI,
} from "../../services/api";

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [medicines, setMedicines] = useState([]);
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
  const [showMedDropdown, setShowMedDropdown] = useState(false);
  const [purchaseData, setPurchaseData] = useState({
    productName: "",
    quantity: 0,
    unitPrice: 0,
    invoiceNumber: "",
  });

  const [formData, setFormData] = useState({
    name: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    description: "",
  });

  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchSuppliers();
    fetchMedicines();
  }, []);

  const fetchMedicines = async () => {
    try {
      const response = await pharmacyMedicinesAPI.getAll();
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
  }, [suppliers, searchQuery]);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const response = await suppliersAPI.getAll("pharmacy");
      const list = (response.data || []).map((s) => ({
        id: s._id,
        _id: s._id,
        name: s.supplierName || s.name || "",
        contactPerson: s.contactPerson || "",
        phone: s.phone || "",
        email: s.email || "",
        address: s.address || "",
        city:
          s.city ||
          s.supplierCity ||
          (s.location && s.location.city) ||
          s.addressCity ||
          (s.address && s.address.city) ||
          "",
        description: s.notes || s.description || "",
        totalPurchases: s.totalPurchases || 0,
        totalPaid: s.totalPaid || 0,
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
        Portal: "pharmacy",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Suppliers");
      XLSX.writeFile(
        wb,
        `pharmacy-suppliers-${new Date().toISOString().slice(0, 10)}.xlsx`,
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
            portal: "pharmacy",
          };
        })
        .filter((x) => x.supplierName);

      if (!items.length) {
        showToast("No valid rows found");
        return;
      }

      const res = await suppliersAPI.bulkUpsert(items);
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
        name: supplier.name,
        contactPerson: supplier.contactPerson,
        phone: supplier.phone,
        email: supplier.email,
        address: supplier.address,
        city: supplier.city,
        description: supplier.description || "",
      });
    } else {
      setEditingSupplier(null);
      setFormData({
        name: "",
        contactPerson: "",
        phone: "",
        email: "",
        address: "",
        city: "",
        description: "",
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
        portal: "pharmacy",
        status: "open",
        description: `Purchase of ${purchaseData.productName}`,
      });

      // 2. Add to Supplier Purchase History
      await suppliersAPI.addPurchase(
        selectedSupplier._id || selectedSupplier.id,
        {
          productId: purchaseData.medicineId,
          productName: purchaseData.productName,
          quantity: purchaseData.quantity,
          unitPrice: purchaseData.unitPrice,
          invoiceNumber: purchaseData.invoiceNumber,
          totalPrice: totalAmount,
          portal: "pharmacy",
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
        contactPerson: formData.contactPerson,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        city: formData.city,
        supplierCity: formData.city,
        category: "",
        notes: formData.description || "",
        portal: "pharmacy",
      };
      if (editingSupplier && (editingSupplier._id || editingSupplier.id)) {
        await suppliersAPI.update(
          editingSupplier._id || editingSupplier.id,
          payload,
        );
        showToast("Supplier updated successfully");
      } else {
        await suppliersAPI.create(payload);
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
      await suppliersAPI.delete(supplierToDelete._id || supplierToDelete.id);
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
            Manage pharmacy suppliers and vendors           </p>
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

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-4">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
            {filteredSuppliers.map((supplier) => (
              <div
                key={supplier.id}
                className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-800 text-lg">
                      {supplier.name}
                    </h3>
                    <p className="text-sm text-slate-600">
                      {supplier.contactPerson}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openModal(supplier)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      <FiEdit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openDeleteModal(supplier)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-600">
                    <FiPhone className="w-4 h-4" />
                    <span>{supplier.phone}</span>
                  </div>
                  {supplier.email && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <FiMail className="w-4 h-4" />
                      <span>{supplier.email}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-slate-600">
                    <FiMapPin className="w-4 h-4" />
                    <span>{supplier.city}</span>
                  </div>
                </div>

                {supplier.description && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <p className="text-xs text-slate-500">
                      {supplier.description}
                    </p>
                  </div>
                )}
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-slate-600">Total Purchases:</span>
                  <span className="font-bold text-slate-800">
                    PKR {(supplier.totalPurchases || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-slate-600">Total Paid:</span>
                  <span className="font-semibold text-emerald-600">
                    PKR {(supplier.totalPaid || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-1 pt-1 border-t border-slate-100">
                  <span className="text-slate-600 font-medium">
                    Balance Payable:
                  </span>
                  <span className="font-bold text-red-600">
                    PKR                     {Math.max(
                      0,
                      (supplier.totalPurchases || 0) -
                        (supplier.totalPaid || 0),
                    ).toLocaleString()}
                  </span>
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => openPurchaseModal(supplier)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 transition-colors"
                  >
                    <FiPackage className="w-4 h-4" /> Record Purchase
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Contact Person *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.contactPerson}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        contactPerson: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

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
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows="3"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
