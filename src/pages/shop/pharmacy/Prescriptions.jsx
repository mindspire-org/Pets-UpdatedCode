import React, { useState } from "react";
import { FiSearch, FiSend, FiUser, FiCalendar, FiFileText, FiPackage } from "react-icons/fi";
import { MdPets } from "react-icons/md";
import { prescriptionsAPI, petsAPI } from "../../../services/api";
import { useNavigate } from "react-router-dom";

export default function ShopPharmacyPrescriptions() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("petId");
  const [prescriptions, setPrescriptions] = useState([]);
  const [petDetails, setPetDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const navigate = useNavigate();

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const handleSearch = async () => {
    if (!searchQuery.trim()) { showToast("Enter a search term"); return; }
    try {
      setLoading(true);
      setPrescriptions([]);
      setPetDetails(null);

      if (searchType === "petId") {
        const [prescRes, petRes] = await Promise.all([
          prescriptionsAPI.getByPatient(searchQuery.trim()),
          petsAPI.getById(searchQuery.trim()).catch(() => null),
        ]);
        setPrescriptions(prescRes.data || []);
        if (petRes?.data) setPetDetails(petRes.data);
      } else {
        const petsRes = await petsAPI.search(searchQuery.trim());
        const pets = petsRes.data || [];
        if (pets.length === 0) { showToast("No pets found"); return; }
        const allPrescriptions = await Promise.all(
          pets.slice(0, 5).map((p) => prescriptionsAPI.getByPatient(p._id).then((r) => r.data || []).catch(() => []))
        );
        setPrescriptions(allPrescriptions.flat());
        if (pets.length === 1) setPetDetails(pets[0]);
      }
    } catch (err) {
      showToast(err.message || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSendToPOS = (prescription) => {
    const referral = {
      id: `rx-${prescription._id}`,
      patientName: petDetails?.name || prescription.patientName || "Patient",
      doctorName: prescription.doctorName || "Doctor",
      date: prescription.createdAt || new Date().toISOString(),
      medicines: (prescription.medicines || prescription.items || []).map((m) => ({
        medicineName: m.medicineName || m.name,
        quantity: m.quantity || 1,
        dosage: m.dosage || "",
      })),
    };
    localStorage.setItem("shop_pharmacy_active_referral", JSON.stringify(referral));
    navigate("/shop/pharmacy/pos");
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-slate-800">Prescriptions</h1>
        <p className="text-slate-500 text-sm mt-1">Search and fulfill prescriptions from petshop pharmacy</p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex gap-3">
          <select
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={searchType}
            onChange={(e) => setSearchType(e.target.value)}
          >
            <option value="petId">Pet ID</option>
            <option value="ownerName">Owner Name</option>
          </select>
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm"
              placeholder={searchType === "petId" ? "Enter Pet ID..." : "Enter owner name..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>
      </div>

      {/* Pet Details */}
      {petDetails && (
        <div className="bg-purple-50 rounded-xl border border-purple-200 p-4">
          <div className="flex items-center gap-3">
            <MdPets className="w-8 h-8 text-purple-600" />
            <div>
              <p className="font-semibold text-slate-800">{petDetails.name}</p>
              <p className="text-sm text-slate-600">{petDetails.species} • {petDetails.breed} • Owner: {petDetails.ownerName || petDetails.clientName || "—"}</p>
            </div>
          </div>
        </div>
      )}

      {/* Prescriptions */}
      {prescriptions.length === 0 && !loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <FiFileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Search for a pet to view prescriptions</p>
        </div>
      ) : (
        <div className="space-y-4">
          {prescriptions.map((rx) => (
            <div key={rx._id} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <FiCalendar className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-600">{rx.createdAt ? new Date(rx.createdAt).toLocaleDateString() : "—"}</span>
                    {rx.doctorName && (
                      <>
                        <span className="text-slate-300">•</span>
                        <FiUser className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-600">{rx.doctorName}</span>
                      </>
                    )}
                  </div>
                  {rx.diagnosis && <p className="text-sm text-slate-700 mt-1">Diagnosis: {rx.diagnosis}</p>}
                </div>
                <button
                  onClick={() => handleSendToPOS(rx)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700"
                >
                  <FiSend className="w-4 h-4" /> Send to POS
                </button>
              </div>
              {(rx.medicines || rx.items || []).length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Medicines</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {(rx.medicines || rx.items || []).map((med, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm bg-slate-50 rounded-lg p-2">
                        <FiPackage className="w-4 h-4 text-purple-500 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-slate-700">{med.medicineName || med.name}</p>
                          {med.dosage && <p className="text-xs text-slate-500">{med.dosage}</p>}
                        </div>
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
