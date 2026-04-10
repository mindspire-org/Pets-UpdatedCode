import React, { useState } from 'react';
import { FiSearch, FiSend, FiUser, FiCalendar, FiFileText, FiPackage } from 'react-icons/fi';
import { MdPets } from 'react-icons/md';
import { prescriptionsAPI, petsAPI } from '../../services/api';
import { useNavigate } from 'react-router-dom';

export default function PharmacyPrescriptions() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('petId'); // 'petId' or 'ownerName'
  const [prescriptions, setPrescriptions] = useState([]);
  const [petDetails, setPetDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const navigate = useNavigate();

  // Helpers: numeric parse and dose computation
  const num = (v) => {
    if (v === 0) return 0;
    const m = String(v || '').match(/[-+]?[0-9]*\.?[0-9]+/);
    return m ? parseFloat(m[0]) : NaN;
  };
  const calcDose = (item, wKg) => {
    const dr = num(item?.doseRate);
    const per = num(item?.perMl);
    const w = num(wKg);
    if (!Number.isFinite(dr) || !Number.isFinite(per) || !Number.isFinite(w) || per <= 0) return null;
    return (dr * w) / per;
  };

  const extractDoseAndUnit = (item, weightKg) => {
    const weight = num(weightKg);
    const textDose = String(item?.dose || '').toLowerCase();
    const instr = String(item?.instructions || '').toLowerCase();
    const unit = String(item?.unit || '').toLowerCase();

    // 1) Primary source: same numeric dose used for display on the prescription card
    const nDose = num(item?.dose);
    const computed = calcDose(item, weight);
    const show = Number.isFinite(nDose) ? nDose : (computed != null ? computed : NaN);
    if (Number.isFinite(show) && show > 0) {
      if (unit.includes('ml')) return { quantity: show, unitHint: 'ml' };
      if (unit.includes('g')) return { quantity: show, unitHint: 'g' };
      if (unit.includes('mg')) return { quantity: show, unitHint: 'mg' };
      if (unit.includes('tab')) return { quantity: show, unitHint: 'tablet' };
      if (unit.includes('cap')) return { quantity: show, unitHint: 'capsule' };
      if (unit.includes('drop')) return { quantity: show, unitHint: 'drop' };
      if (unit.includes('vial') || unit.includes('amp') || unit.includes('bottle')) return { quantity: show, unitHint: 'container' };
      return { quantity: show, unitHint: 'unit' };
    }

    // 2) Fallback: parse explicit unit keywords from free text
    const pick = (re, u) => {
      const m = (textDose.match(re) || instr.match(re));
      if (m) return { quantity: parseFloat(m[1]), unitHint: u };
      return null;
    };

    // Priority: tablet -> capsule -> drop -> ml -> grams -> mg -> vial/ampule counts
    const byTablet = pick(/(\d+\.?\d*)\s*(tablet|tab|tabs)/i, 'tablet');
    if (byTablet) return byTablet;
    const byCaps = pick(/(\d+\.?\d*)\s*(capsule|cap|caps)/i, 'capsule');
    if (byCaps) return byCaps;
    const byDrops = pick(/(\d+\.?\d*)\s*(drop|drops)/i, 'drop');
    if (byDrops) return byDrops;
    const byMl = pick(/(\d+\.?\d*)\s*ml/i, 'ml');
    if (byMl) return byMl;
    const byG = pick(/(\d+\.?\d*)\s*(g|gm|gram|grams)\b/i, 'g');
    if (byG) return byG;
    const byMg = pick(/(\d+\.?\d*)\s*(mg|milligram|milligrams)\b/i, 'mg');
    if (byMg) return byMg;
    const byVial = pick(/(\d+\.?\d*)\s*(vial|vials|ampule|ampoule|bottle|bottles)/i, 'container');
    if (byVial) return byVial;

    // 3) If unit field explicitly says ml/tablet/g/mg/etc., try to parse a bare number
    const bare = (() => {
      const m = (textDose.match(/(\d+\.?\d*)/) || instr.match(/(\d+\.?\d*)/));
      if (!m) return null;
      const q = parseFloat(m[1]);
      if (!Number.isFinite(q)) return null;
      if (unit.includes('ml')) return { quantity: q, unitHint: 'ml' };
      if (unit.includes('tab')) return { quantity: q, unitHint: 'tablet' };
      if (unit.includes('cap')) return { quantity: q, unitHint: 'capsule' };
      if (unit.includes('drop')) return { quantity: q, unitHint: 'drop' };
      if (unit.includes('g')) return { quantity: q, unitHint: 'g' };
      if (unit.includes('mg')) return { quantity: q, unitHint: 'mg' };
      return { quantity: q, unitHint: 'unit' };
    })();
    if (bare) return bare;

    // 4) Default: one unit
    return { quantity: 1, unitHint: 'unit' };
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      showToast('Please enter search query');
      return;
    }

    try {
      setLoading(true);
      
      if (searchType === 'petId') {
        // Search by Pet ID - try both direct lookup and search in all pets
        let pet = null;
        try {
          const petResponse = await petsAPI.getById(searchQuery);
          pet = petResponse.data;
        } catch (error) {
          // If direct lookup fails, search in all pets
          const allPetsResponse = await petsAPI.getAll();
          pet = allPetsResponse.data.find(p => p.id === searchQuery || p._id === searchQuery);
        }
        
        if (!pet) {
          showToast('Pet not found');
          setPrescriptions([]);
          setPetDetails(null);
          return;
        }
        
        setPetDetails(pet);
        
        // Fetch prescriptions for this pet - check patient.id field
        const prescResponse = await prescriptionsAPI.getAll();
        const petPrescriptions = prescResponse.data.filter(p => 
          p.patient?.id === searchQuery || 
          p.patient?.id === pet.id || 
          p.patient?.id === pet._id ||
          p.petId === searchQuery || 
          p.petId === pet.id || 
          p.petId === pet._id
        );
        setPrescriptions(petPrescriptions);
        
        if (petPrescriptions.length === 0) {
          showToast('No prescriptions found for this pet');
        } else {
          showToast(`Found ${petPrescriptions.length} prescription(s)`);
        }
      } else {
        // Search by owner name
        const petsResponse = await petsAPI.getAll();
        const matchingPets = petsResponse.data.filter(pet => 
          pet.ownerName?.toLowerCase().includes(searchQuery.toLowerCase())
        );
        
        if (matchingPets.length === 0) {
          showToast('No pets found for this owner');
          setPrescriptions([]);
          setPetDetails(null);
          return;
        }
        
        // Get prescriptions for all matching pets
        const prescResponse = await prescriptionsAPI.getAll();
        const ownerPrescriptions = prescResponse.data.filter(p => 
          matchingPets.some(pet => 
            pet.id === p.petId || 
            pet.id === p.patient?.id ||
            pet._id === p.petId ||
            pet._id === p.patient?.id
          )
        );
        
        setPrescriptions(ownerPrescriptions);
        setPetDetails(matchingPets[0]); // Show first pet details
        
        if (ownerPrescriptions.length === 0) {
          showToast('No prescriptions found');
        }
      }
    } catch (error) {
      console.error('Search error:', error);
      showToast('Error searching prescriptions');
      setPrescriptions([]);
      setPetDetails(null);
    } finally {
      setLoading(false);
    }
  };

  const sendToPOS = (prescription) => {
    // Prepare cart items from prescription medicines
    const cartItems = [];
    
    // Handle new prescription structure with items array
    if (prescription.items && prescription.items.length > 0) {
      prescription.items.forEach(item => {
        if (item.name) {
          const w = prescription?.patient?.weightKg ?? prescription?.patient?.weight;
          const { quantity, unitHint } = extractDoseAndUnit(item, w);

          cartItems.push({
            medicineName: item.name,
            composition: item.ingredients || '',
            dosage: item.instructions || item.description || item.dose || '',
            quantity: Math.max(0.1, quantity), // keep minimal positive for liquids
            unitHint: unitHint,
            searchTerm: item.name
          });
        }
      });
    }
    
    // Fallback: Handle old structure with medicines.rows
    else if (prescription.medicines && prescription.medicines.rows) {
      prescription.medicines.rows.forEach(med => {
        if (med.name && med.dosage) {
          const d = med.dosage.toString().toLowerCase();
          let quantity = 1; let unitHint = 'unit';
          const mTab = d.match(/(\d+\.?\d*)\s*(tablet|tab|tabs)/i);
          const mCap = d.match(/(\d+\.?\d*)\s*(capsule|cap|caps)/i);
          const mDrop = d.match(/(\d+\.?\d*)\s*(drop|drops)/i);
          const mMl = d.match(/(\d+\.?\d*)\s*ml/i);
          if (mTab) { quantity = parseFloat(mTab[1]); unitHint = 'tablet'; }
          else if (mCap) { quantity = parseFloat(mCap[1]); unitHint = 'capsule'; }
          else if (mDrop) { quantity = parseFloat(mDrop[1]); unitHint = 'drop'; }
          else if (mMl) { quantity = parseFloat(mMl[1]); unitHint = 'ml'; }
          else {
            const any = d.match(/(\d+\.?\d*)/); quantity = any ? parseFloat(any[1]) : 1; unitHint = 'unit';
          }
          
          cartItems.push({
            medicineName: med.name,
            composition: med.composition || '',
            dosage: med.dosage,
            quantity: quantity,
            unitHint: unitHint,
            searchTerm: med.name
          });
        }
      });
    }

    // Store prescription data and cart items in localStorage for POS to pick up
    const p = prescription?.patient || {}
    const genClientId = () => `CL-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random()*1e6).toString(36).toUpperCase()}`
    const posData = {
      prescriptionId: prescription._id,
      // Owner/client
      customerName: petDetails?.ownerName || p.ownerName || prescription.patientName || 'Walk-in',
      customerContact: petDetails?.contact || petDetails?.ownerContact || p.contact || prescription.ownerContact || '',
      address: petDetails?.address || p.address || prescription.address || '',
      clientId: petDetails?.clientId || p.clientId || prescription.clientId || genClientId(),
      // Pet identifiePKR       petName: petDetails?.petName || petDetails?.name || p.petName || prescription.petName || '',
      patientId: petDetails?.id || p.id || prescription.petId || prescription.patientId || '',
      petId: prescription.petId || p.id || petDetails?.id || '',
      // Pet attributes
      species: petDetails?.species || p.species || prescription.species || '',
      breed: petDetails?.breed || p.breed || prescription.breed || '',
      sex: petDetails?.gender || petDetails?.sex || p.gender || p.sex || prescription.sex || '',
      age: petDetails?.age || petDetails?.computedAge || p.age || prescription.age || '',
      weight: petDetails?.weightKg || petDetails?.weight || p.weightKg || p.weight || prescription.weight || '',
      // Items
      cartItems: cartItems,
      timestamp: Date.now()
    };

    localStorage.setItem('pharmacy_pos_data', JSON.stringify(posData));
    showToast('Prescription sent to POS');
    
    // Navigate to POS page
    setTimeout(() => {
      navigate('/pharmacy/pos');
    }, 500);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 bg-purple-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl shadow-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">Prescriptions</h1>
        <p className="text-purple-100">Search and send prescriptions to POS</p>
      </div>

      {/* Search Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="space-y-4">
          {/* Search Type Toggle */}
          <div className="flex gap-4">
            <button
              onClick={() => setSearchType('petId')}
              className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                searchType === 'petId'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <MdPets className="inline-block w-5 h-5 mr-2" />
              Search by Pet ID
            </button>
            <button
              onClick={() => setSearchType('ownerName')}
              className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                searchType === 'ownerName'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <FiUser className="inline-block w-5 h-5 mr-2" />
              Search by Owner Name
            </button>
          </div>

          {/* Search Input */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder={searchType === 'petId' ? 'Enter Pet ID...' : 'Enter Owner Name...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>
      </div>

      {/* Pet Details Card */}
      {petDetails && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <MdPets className="w-6 h-6 text-purple-600" />
            Pet Details
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-slate-500 mb-1">Pet Name</p>
              <p className="font-semibold text-slate-800">{petDetails.name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Pet ID</p>
              <p className="font-semibold text-slate-800">{petDetails.id}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Owner Name</p>
              <p className="font-semibold text-slate-800">{petDetails.ownerName}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Contact</p>
              <p className="font-semibold text-slate-800">{petDetails.ownerContact}</p>
            </div>
          </div>
        </div>
      )}

      {/* Prescriptions List */}
      {petDetails && prescriptions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <FiFileText className="w-6 h-6 text-purple-600" />
            Prescriptions ({prescriptions.length})
          </h3>

          <div className="space-y-4">
            {prescriptions.map((prescription) => (
              <div
                key={prescription._id}
                className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-bold text-slate-800">
                        {prescription.notes?.dx?.[0] || prescription.medicines?.condition || 'General Prescription'}
                      </h4>
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                        {prescription.id || prescription._id}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        prescription.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {prescription.status || 'Active'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-600">
                      <span className="flex items-center gap-1">
                        <FiCalendar className="w-4 h-4" />
                        {new Date(prescription.when || prescription.createdAt).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <FiUser className="w-4 h-4" />
                        Dr. {prescription.doctor?.name || prescription.doctorName || 'Unknown'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => sendToPOS(prescription)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <FiSend className="w-4 h-4" />
                    Send to POS
                  </button>
                </div>

                {/* Medicines List */}
                {prescription.items && prescription.items.length > 0 && (
                  <div className="bg-slate-50 rounded-lg p-3 mt-3">
                    <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
                      <FiPackage className="w-4 h-4" />
                      Medicines ({prescription.items.length})
                    </p>
                    <div className="space-y-2">
                      {prescription.items.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-3 text-sm">
                          <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-bold">
                            {idx + 1}
                          </span>
                          <div className="flex-1">
                            <p className="font-semibold text-slate-800">{item.name}</p>
                            {item.condition && (
                              <p className="text-xs text-slate-500">For: {item.condition}</p>
                            )}
                            {item.ingredients && (
                              <p className="text-xs text-slate-500">{item.ingredients}</p>
                            )}
                            {(() => {
                              const w = prescription?.patient?.weightKg ?? prescription?.patient?.weight ?? petDetails?.weightKg ?? petDetails?.weight;
                              const nDose = num(item.dose);
                              const computed = calcDose(item, w);
                              const show = Number.isFinite(nDose) ? nDose : (computed != null ? computed : null);
                              const unit = item.unit || 'ml';
                              return (
                                <p className="text-xs text-slate-600 mt-1">
                                  <span className="font-medium">Route:</span> {item.route} | 
                                  <span className="font-medium"> Dose:</span> {show != null ? `${show.toFixed(2)} ${unit}` : '—'}
                                </p>
                              );
                            })()}
                            {item.instructions && (
                              <p className="text-xs text-slate-600">
                                <span className="font-medium">Instructions:</span> {item.instructions}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Fallback for old structure */}
                {prescription.medicines?.rows && prescription.medicines.rows.length > 0 && !prescription.items && (
                  <div className="bg-slate-50 rounded-lg p-3 mt-3">
                    <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
                      <FiPackage className="w-4 h-4" />
                      Medicines ({prescription.medicines.rows.length})
                    </p>
                    <div className="space-y-2">
                      {prescription.medicines.rows.map((med, idx) => (
                        <div key={idx} className="flex items-start gap-3 text-sm">
                          <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-bold">
                            {idx + 1}
                          </span>
                          <div className="flex-1">
                            <p className="font-semibold text-slate-800">{med.name}</p>
                            {med.composition && (
                              <p className="text-xs text-slate-500">{med.composition}</p>
                            )}
                            <p className="text-xs text-slate-600 mt-1">
                              <span className="font-medium">Dosage:</span> {med.dosage}
                            </p>
                            {med.duration && (
                              <p className="text-xs text-slate-600">
                                <span className="font-medium">Duration:</span> {med.duration}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Prescriptions for Found Pet */}
      {petDetails && prescriptions.length === 0 && !loading && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <FiFileText className="w-16 h-16 text-amber-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-800 mb-2">No Prescriptions Found</h3>
          <p className="text-slate-600">This pet doesn't have any prescriptions yet.</p>
          <p className="text-sm text-slate-500 mt-2">Pet ID: {petDetails.id}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && prescriptions.length === 0 && !petDetails && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <FiFileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-800 mb-2">No Prescriptions</h3>
          <p className="text-slate-600">Search by Pet ID or Owner Name to view prescriptions</p>
        </div>
      )}
    </div>
  );
}
