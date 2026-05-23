import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiPlus, FiEdit2, FiTrash2, FiX, FiPackage, FiArrowLeft,
  FiAlertTriangle, FiSave, FiCheck,
} from "react-icons/fi";
import {
  petshopPharmacyMedicinesAPI,
  petShopSuppliersAPI,
  petShopCompaniesAPI,
  petshopPharmacyPurchaseDraftsAPI,
  petshopPharmacyInvoicesAPI,
} from "../../../services/api";
import { medicineCatalog, formatCatalogLabel } from "../../../data/medicineCatalog";

const catalogMainCategories = Object.keys(medicineCatalog);
const getSubCategories = (main) => main && medicineCatalog[main] ? Object.keys(medicineCatalog[main]) : [];

const emptyItem = {
  medicineName: "", genericName: "", batchNo: "", barcode: "",
  mainCategory: "", subCategory: "", expiryDate: "", unit: "pieces",
  qtyPacks: 1, unitsPerPack: 1, buyPerPack: 0, salePerPack: 0,
  defaultDiscount: 0, totalItems: 1, lineTotal: 0,
};

export default function ShopPharmacyAddInvoice() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");

  const [invoiceData, setInvoiceData] = useState({
    supplierId: "", supplierName: "", companyId: "", companyName: "",
    invoiceNo: "", invoiceDate: new Date().toISOString().split("T")[0],
    dueDate: "", notes: "",
  });
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSuppliers();
    fetchCompanies();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const res = await petShopSuppliersAPI.getAll();
      setSuppliers(res.data || []);
    } catch (err) {
      console.error("Failed to load suppliers:", err);
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

  const addItem = () => setItems((prev) => [...prev, { ...emptyItem }]);

  const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const updateItem = (idx, key, value) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [key]: value };
      // Auto-calculate totals
      const item = updated[idx];
      const qty = Number(item.qtyPacks || 0) * Number(item.unitsPerPack || 1);
      updated[idx].totalItems = qty;
      updated[idx].lineTotal = qty * Number(item.buyPerPack || 0) / Math.max(Number(item.unitsPerPack || 1), 1);
      return updated;
    });
  };

  const totalAmount = items.reduce((sum, i) => sum + (Number(i.lineTotal) || 0), 0);

  const handleSaveAsDraft = async () => {
    if (!invoiceData.invoiceNo.trim()) { showToast("Invoice number is required"); return; }
    if (items.every((i) => !i.medicineName.trim())) { showToast("Add at least one medicine"); return; }
    try {
      setSaving(true);
      const validItems = items.filter((i) => i.medicineName.trim());
      await petshopPharmacyPurchaseDraftsAPI.create({
        ...invoiceData,
        items: validItems,
        totalAmount,
        portal: "shop",
        status: "pending",
      });
      showToast("Draft saved successfully");
      setTimeout(() => navigate("/shop/pharmacy/purchase-orders"), 1500);
    } catch (err) {
      showToast(err.message || "Failed to save draft");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndApprove = async () => {
    if (!invoiceData.invoiceNo.trim()) { showToast("Invoice number is required"); return; }
    const validItems = items.filter((i) => i.medicineName.trim());
    if (validItems.length === 0) { showToast("Add at least one medicine"); return; }
    try {
      setSaving(true);
      // Create invoice and directly add medicines to inventory
      await petshopPharmacyInvoicesAPI.create({
        ...invoiceData,
        items: validItems,
        totalAmount,
        portal: "shop",
        status: "approved",
      });
      showToast("Invoice saved and inventory updated");
      setTimeout(() => navigate("/shop/pharmacy/medicines"), 1500);
    } catch (err) {
      showToast(err.message || "Failed to save invoice");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>
      )}

      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600">
          <FiArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Add Invoice</h1>
          <p className="text-slate-500 text-sm mt-0.5">Add supplier invoice to petshop pharmacy inventory</p>
        </div>
      </div>

      {/* Invoice Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-800 mb-4">Invoice Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Number *</label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              placeholder="INV-001"
              value={invoiceData.invoiceNo}
              onChange={(e) => setInvoiceData((d) => ({ ...d, invoiceNo: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Date</label>
            <input
              type="date"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              value={invoiceData.invoiceDate}
              onChange={(e) => setInvoiceData((d) => ({ ...d, invoiceDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
            <input
              type="date"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              value={invoiceData.dueDate}
              onChange={(e) => setInvoiceData((d) => ({ ...d, dueDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Supplier</label>
            <select
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              value={invoiceData.supplierId}
              onChange={(e) => {
                const s = suppliers.find((s) => s._id === e.target.value);
                setInvoiceData((d) => ({ ...d, supplierId: e.target.value, supplierName: s?.name || s?.supplierName || "" }));
              }}
            >
              <option value="">Select supplier...</option>
              {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name || s.supplierName}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Company</label>
            <select
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              value={invoiceData.companyId}
              onChange={(e) => {
                const c = companies.find((c) => c._id === e.target.value);
                setInvoiceData((d) => ({ ...d, companyId: e.target.value, companyName: c?.companyName || "" }));
              }}
            >
              <option value="">Select company...</option>
              {companies.map((c) => <option key={c._id} value={c._id}>{c.companyName}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              placeholder="Optional notes..."
              value={invoiceData.notes}
              onChange={(e) => setInvoiceData((d) => ({ ...d, notes: e.target.value }))}
            />
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-800">Invoice Items</h2>
          <button onClick={addItem} className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
            <FiPlus className="w-4 h-4" /> Add Item
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["Medicine Name", "Batch No", "Expiry", "Qty Packs", "Units/Pack", "Buy/Pack", "Sale/Pack", "Total", ""].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td className="px-3 py-2">
                    <input
                      className="w-40 border border-slate-200 rounded px-2 py-1 text-xs"
                      placeholder="Medicine name"
                      value={item.medicineName}
                      onChange={(e) => updateItem(idx, "medicineName", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-24 border border-slate-200 rounded px-2 py-1 text-xs"
                      placeholder="Batch"
                      value={item.batchNo}
                      onChange={(e) => updateItem(idx, "batchNo", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="date"
                      className="w-32 border border-slate-200 rounded px-2 py-1 text-xs"
                      value={item.expiryDate}
                      onChange={(e) => updateItem(idx, "expiryDate", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      className="w-16 border border-slate-200 rounded px-2 py-1 text-xs text-center"
                      value={item.qtyPacks}
                      onChange={(e) => updateItem(idx, "qtyPacks", Number(e.target.value))}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      className="w-16 border border-slate-200 rounded px-2 py-1 text-xs text-center"
                      value={item.unitsPerPack}
                      onChange={(e) => updateItem(idx, "unitsPerPack", Number(e.target.value))}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      className="w-20 border border-slate-200 rounded px-2 py-1 text-xs text-right"
                      value={item.buyPerPack}
                      onChange={(e) => updateItem(idx, "buyPerPack", Number(e.target.value))}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      className="w-20 border border-slate-200 rounded px-2 py-1 text-xs text-right"
                      value={item.salePerPack}
                      onChange={(e) => updateItem(idx, "salePerPack", Number(e.target.value))}
                    />
                  </td>
                  <td className="px-3 py-2 font-medium text-purple-600 whitespace-nowrap">
                    PKR {(Number(item.lineTotal) || 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    {items.length > 1 && (
                      <button onClick={() => removeItem(idx)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                        <FiTrash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Total */}
        <div className="flex items-center justify-end p-4 border-t border-slate-200 bg-slate-50">
          <div className="text-right">
            <p className="text-sm text-slate-500">Total Amount</p>
            <p className="text-2xl font-bold text-purple-600">PKR {totalAmount.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button onClick={() => navigate(-1)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
        <button
          onClick={handleSaveAsDraft}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 border border-purple-300 text-purple-700 rounded-lg text-sm hover:bg-purple-50 disabled:opacity-50"
        >
          <FiSave className="w-4 h-4" /> {saving ? "Saving..." : "Save as Draft"}
        </button>
        <button
          onClick={handleSaveAndApprove}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50"
        >
          <FiCheck className="w-4 h-4" /> {saving ? "Saving..." : "Save & Add to Inventory"}
        </button>
      </div>
    </div>
  );
}
