import React, { useState, useEffect } from "react";
import { FiFileText, FiShoppingCart, FiX } from "react-icons/fi";
import { petshopPharmacySalesAPI, petshopPharmacyMedicinesAPI } from "../../../services/api";
import { useNavigate } from "react-router-dom";

export default function ShopPharmacyReferrals() {
  const navigate = useNavigate();
  const [referrals, setReferrals] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadReferrals();
    loadMedicines();
  }, []);

  const loadReferrals = () => {
    try {
      const stored = JSON.parse(localStorage.getItem("shop_pharmacy_referrals") || "[]");
      setReferrals(Array.isArray(stored) ? stored : []);
    } catch (e) {
      console.error("Error loading referrals:", e);
    }
  };

  const loadMedicines = async () => {
    try {
      const res = await petshopPharmacyMedicinesAPI.getAll();
      setMedicines(res.data || []);
    } catch (e) {
      console.error("Error loading medicines:", e);
    }
  };

  const handleSendToPOS = (referral) => {
    // Store referral in localStorage for POS to pick up
    localStorage.setItem("shop_pharmacy_active_referral", JSON.stringify(referral));
    navigate("/shop/pharmacy/pos");
  };

  const handleDelete = (id) => {
    const updated = referrals.filter((r) => r.id !== id);
    localStorage.setItem("shop_pharmacy_referrals", JSON.stringify(updated));
    setReferrals(updated);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Referrals</h1>
        <p className="text-slate-500 text-sm mt-1">Pending referrals from doctors for petshop pharmacy</p>
      </div>

      {referrals.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <FiFileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No pending referrals</p>
          <p className="text-slate-400 text-sm mt-1">Referrals from doctors will appear here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {referrals.map((referral) => (
            <div key={referral.id} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-slate-800">{referral.patientName || "Patient"}</h3>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Doctor: {referral.doctorName || "—"} | Date: {referral.date ? new Date(referral.date).toLocaleDateString() : "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSendToPOS(referral)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700"
                  >
                    <FiShoppingCart className="w-4 h-4" /> Send to POS
                  </button>
                  <button
                    onClick={() => handleDelete(referral.id)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {(referral.medicines || referral.items || []).length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Prescribed Medicines</p>
                  <div className="space-y-1">
                    {(referral.medicines || referral.items || []).map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-slate-700">{item.medicineName || item.name}</span>
                        <span className="text-slate-500">Qty: {item.quantity || item.qty || 1}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
