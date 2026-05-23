import React, { useRef, useState, useEffect, useMemo } from "react";
import {
  FiPlus, FiEdit2, FiTrash2, FiSearch, FiX, FiUser,
  FiPhone, FiMail, FiMapPin, FiDownload, FiUpload,
  FiPackage, FiEye, FiCheckCircle, FiXCircle, FiUsers,
} from "react-icons/fi";
import * as XLSX from "xlsx";
import {
  petShopSuppliersAPI,
  petshopPharmacyMedicinesAPI,
  petShopCompaniesAPI,
} from "../../../services/api";

export default function ShopPharmacySuppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [supplierToDelete, setSupplierToDelete] = useState(null);
  const [toast, setToast] = useState("");
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: "", companyId: "", phone: "", email: "", address: "", status: "active",
  });

  useEffect(() => {
    fetchSuppliers();
    fetchCompanies();
  }, []);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const res = await petShopSuppliersAPI.getAll();
      setSuppliers(res.data || []);
    } catch (err) {
      showToast("Failed to load suppliers");
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await petShopCompaniesAPI.getAll();
      setCompanies(res.data || []);
    } catch (err) {
      console.error("Failed to load companies:", err);
    }
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return q ? suppliers.filter((s) =>
      (s.name || s.supplierName || "").toLowerCase().includes(q) ||
      (s.phone || "").includes(q) ||
      (s.email || "").toLowerCase().includes(q)
    ) : suppliers;
  }, [suppliers, searchQuery]);

  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  const openAdd = () => {
    setEditingSupplier(null);
    setFormData({ name: "", companyId: "", phone: "", email: "", address: "", status: "active" });
    setShowModal(true);
  };

  const openEdit = (s) => {
    setEditingSupplier(s);
    setFormData({
      name: s.name || s.supplierName || "",
      companyId: s.companyId || s.companyIds?.[0] || "",
      phone: s.phone || "",
      email: s.email || "",
      address: s.address || "",
      status: s.status || "active",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) { showToast("Supplier name is required"); return; }
    try {
      const payload = { ...formData, portal: "shop" };
      if (editingSupplier) {
        await petShopSuppliersAPI.update(editingSupplier._id, payload);
        showToast("Supplier updated");
      } else {
        await petShopSuppliersAPI.create(payload);
        showToast("Supplier added");
      }
      setShowModal(false);
      fetchSuppliers();
    } catch (err) {
      showToast(err.message || "Failed to save supplier");
    }
  };

  const handleDelete = async () => {
    try {
      await petShopSuppliersAPI.delete(supplierToDelete._id);
      showToast("Supplier deleted");
      setShowDeleteModal(false);
      fetchSuppliers();
    } catch (err) {
      showToast(err.message || "Failed to delete");
    }
  };

  const handleExport = () => {
    const data = filtered.map((s) => ({
      "Supplier Name": s.name || s.supplierName || "",
      "Phone": s.phone || "",
      "Email": s.email || "",
      "Address": s.address || "",
      "Status": s.status || "active",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Suppliers");
    XLSX.writeFile(wb, "petshop_suppliers.xlsx");
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImporting(true);
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);
      const items = rows.map((r) => ({
        supplierName: r["Supplier Name"] || r["supplierName"] || r["name"] || "",
        phone: r["Phone"] || r["phone"] || "",
        email: r["Email"] || r["email"] || "",
        address: r["Address"] || r["address"] || "",
        status: r["Status"] || r["status"] || "active",
        portal: "shop",
      })).filter((i) => i.supplierName);
      if (items.length === 0) { showToast("No valid rows found"); return; }
      const res = await petShopSuppliersAPI.bulkUpsert(items);
      showToast(`Imported: ${res.stats?.created || 0} created, ${res.stats?.updated || 0} updated`);
      fetchSuppliers();
    } catch (err) {
      showToast(err.message || "Import failed");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Suppliers</h1>
          <p className="text-slate-500 text-sm mt-1">Manage petshop pharmacy suppliers</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">
            <FiDownload className="w-4 h-4" /> Export
          </button>
          <button onClick={() => fileInputRef.current?.click()} disabled={importing} className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-50">
            <FiUpload className="w-4 h-4" /> {importing ? "Importing..." : "Import"}
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm">
            <FiPlus className="w-4 h-4" /> Add Supplier
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Total Suppliers</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{suppliers.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Active</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{suppliers.filter((s) => s.status === "active").length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Inactive</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{suppliers.filter((s) => s.status !== "active").length}</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm"
            placeholder="Search suppliers..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
          </div>
        ) : paginated.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <FiUsers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p>No suppliers found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Name", "Phone", "Email", "Address", "Status", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.map((s) => (
                  <tr key={s._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{s.name || s.supplierName}</td>
                    <td className="px-4 py-3 text-slate-600">{s.phone || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{s.email || "—"}</td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{s.address || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {s.status || "active"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(s)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><FiEdit2 className="w-4 h-4" /></button>
                        <button onClick={() => { setSupplierToDelete(s); setShowDeleteModal(true); }} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"><FiTrash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
            <p className="text-sm text-slate-500">Page {currentPage} of {totalPages} ({filtered.length} total)</p>
            <div className="flex gap-2">
              <button disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Prev</button>
              <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">{editingSupplier ? "Edit Supplier" : "Add Supplier"}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {[
                { label: "Supplier Name *", key: "name", placeholder: "Supplier name" },
                { label: "Phone", key: "phone", placeholder: "Phone number" },
                { label: "Email", key: "email", placeholder: "Email address" },
                { label: "Address", key: "address", placeholder: "Address" },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                  <input
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    placeholder={placeholder}
                    value={formData[key]}
                    onChange={(e) => setFormData((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Company</label>
                <select
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  value={formData.companyId}
                  onChange={(e) => setFormData((f) => ({ ...f, companyId: e.target.value }))}
                >
                  <option value="">Select company...</option>
                  {companies.map((c) => <option key={c._id} value={c._id}>{c.companyName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  value={formData.status}
                  onChange={(e) => setFormData((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
                <button onClick={handleSave} className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && supplierToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-2">Delete Supplier</h2>
            <p className="text-slate-600 text-sm mb-4">Are you sure you want to delete <strong>{supplierToDelete.name || supplierToDelete.supplierName}</strong>?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
              <button onClick={handleDelete} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
