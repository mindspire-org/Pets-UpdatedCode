import React, { useState, useEffect } from "react";
import { FiSave, FiRefreshCw, FiSettings } from "react-icons/fi";
import { petshopPharmacySettingsAPI } from "../../../services/api";

const defaultSettings = {
  taxRate: 0,
  defaultDiscount: 0,
  currency: "PKR",
  lowStockThreshold: 10,
  expiryAlertDays: 30,
  invoicePrefix: "SHOP-INV",
  enableCreditSales: true,
  enableHoldBills: true,
  printReceiptOnSale: true,
};

export default function ShopPharmacySettings() {
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await petshopPharmacySettingsAPI.get();
      if (res.data) {
        setSettings({ ...defaultSettings, ...res.data });
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const handleSave = async () => {
    try {
      setSaving(true);
      await petshopPharmacySettingsAPI.update(settings);
      showToast("Settings saved successfully");
    } catch (err) {
      showToast(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
          <p className="text-slate-500 text-sm mt-1">Configure petshop pharmacy settings</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchSettings} className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">
            <FiRefreshCw className="w-4 h-4" /> Reset
          </button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50">
            <FiSave className="w-4 h-4" /> {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Financial Settings */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <FiSettings className="w-5 h-5 text-purple-600" /> Financial Settings
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
              <select
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                value={settings.currency}
                onChange={(e) => handleChange("currency", e.target.value)}
              >
                {["PKR", "USD", "EUR", "GBP", "AED", "SAR"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tax Rate (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                value={settings.taxRate}
                onChange={(e) => handleChange("taxRate", parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Default Discount (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                value={settings.defaultDiscount}
                onChange={(e) => handleChange("defaultDiscount", parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>

        {/* Inventory Settings */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <FiSettings className="w-5 h-5 text-purple-600" /> Inventory Settings
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Low Stock Threshold (units)</label>
              <input
                type="number"
                min={0}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                value={settings.lowStockThreshold}
                onChange={(e) => handleChange("lowStockThreshold", parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Expiry Alert (days before)</label>
              <input
                type="number"
                min={0}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                value={settings.expiryAlertDays}
                onChange={(e) => handleChange("expiryAlertDays", parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Prefix</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                value={settings.invoicePrefix}
                onChange={(e) => handleChange("invoicePrefix", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Feature Toggles */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 md:col-span-2">
          <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <FiSettings className="w-5 h-5 text-purple-600" /> Feature Toggles
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { key: "enableCreditSales", label: "Enable Credit Sales" },
              { key: "enableHoldBills", label: "Enable Hold Bills" },
              { key: "printReceiptOnSale", label: "Print Receipt on Sale" },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => handleChange(key, !settings[key])}
                  className={`relative w-11 h-6 rounded-full transition-colors ${settings[key] ? "bg-purple-600" : "bg-slate-200"}`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings[key] ? "translate-x-5" : ""}`} />
                </div>
                <span className="text-sm font-medium text-slate-700">{label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
