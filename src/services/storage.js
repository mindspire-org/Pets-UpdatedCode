// Storage Service - Unified interface for localStorage and MongoDB API
// This allows gradual migration and fallback support

import api from './api.js';

const USE_API = import.meta.env.VITE_USE_API === 'true' || true; // Set to true to use MongoDB

// Cache for API data to improve performance
const cache = new Map();
const CACHE_DURATION = 5000; // 5 seconds

const getCacheKey = (key) => key;
const isCacheValid = (timestamp) => Date.now() - timestamp < CACHE_DURATION;

// Storage service that abstracts localStorage and API calls
const storage = {
  // Generic get method
  async get(key) {
    if (!USE_API) {
      try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
      } catch (error) {
        console.error(`localStorage get error [${key}]:`, error);
        return null;
      }
    }

    // Check cache first
    const cacheKey = getCacheKey(key);
    const cached = cache.get(cacheKey);
    if (cached && isCacheValid(cached.timestamp)) {
      return cached.data;
    }

    // Map localStorage keys to API endpoints
    try {
      let result;
      switch (key) {
        case 'reception_pets':
          result = await api.pets.getAll();
          break;
        case 'reception_appointments':
          result = await api.appointments.getAll();
          break;
        case 'doctor_prescriptions':
          result = await api.prescriptions.getAll();
          break;
        case 'doctor_medicines':
          result = await api.medicines.getAll();
          break;
        case 'lab_reports':
          result = await api.labReports.getAll();
          break;
        case 'lab_tests':
        case 'lab_catalog':
          result = await api.labTests.getAll();
          break;
        case 'admin_inventory':
        case 'lab_inventory':
          result = await api.inventory.getAll();
          break;
        case 'admin_financials':
          result = await api.financials.getAll();
          break;
        case 'admin_users':
          result = await api.users.getAll();
          break;
        default:
          // For other keys, try localStorage as fallback
          const data = localStorage.getItem(key);
          return data ? JSON.parse(data) : null;
      }

      const data = result?.data || [];
      // Update cache
      cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      console.error(`API get error [${key}]:`, error);
      // Fallback to localStorage
      try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
      } catch (e) {
        return null;
      }
    }
  },

  // Generic set method
  async set(key, value) {
    // Always update localStorage for backward compatibility
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`localStorage set error [${key}]:`, error);
    }

    if (!USE_API) return;

    // Clear cache for this key
    cache.delete(getCacheKey(key));

    // Map localStorage keys to API endpoints
    try {
      switch (key) {
        case 'reception_pets':
          // Bulk update not implemented, handle individually
          break;
        case 'reception_appointments':
          // Bulk update not implemented, handle individually
          break;
        case 'doctor_prescriptions':
          // Bulk update not implemented, handle individually
          break;
        case 'doctor_medicines':
          // Bulk update not implemented, handle individually
          break;
        case 'lab_reports':
          // Bulk update not implemented, handle individually
          break;
        case 'lab_tests':
        case 'lab_catalog':
          // Bulk update not implemented, handle individually
          break;
        case 'admin_inventory':
        case 'lab_inventory':
          // Bulk update not implemented, handle individually
          break;
        case 'admin_financials':
          // Bulk update not implemented, handle individually
          break;
        default:
          // For other keys, only use localStorage
          break;
      }
    } catch (error) {
      console.error(`API set error [${key}]:`, error);
    }
  },

  // Remove item
  async remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`localStorage remove error [${key}]:`, error);
    }
    cache.delete(getCacheKey(key));
  },

  // Clear all
  async clear() {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('localStorage clear error:', error);
    }
    cache.clear();
  },

  // Clear cache
  clearCache() {
    cache.clear();
  },

  // Force refresh from API
  async refresh(key) {
    cache.delete(getCacheKey(key));
    return this.get(key);
  },
};

// Specific entity methods for better API integration
export const petsStorage = {
  async getAll() {
    if (!USE_API) {
      return storage.get('reception_pets');
    }
    try {
      const result = await api.pets.getAll();
      return result?.data || [];
    } catch (error) {
      return storage.get('reception_pets');
    }
  },

  async create(petData) {
    if (!USE_API) {
      const pets = await storage.get('reception_pets') || [];
      pets.push(petData);
      await storage.set('reception_pets', pets);
      return petData;
    }
    try {
      const result = await api.pets.create(petData);
      storage.clearCache();
      return result?.data;
    } catch (error) {
      console.error('Create pet error:', error);
      throw error;
    }
  },

  async update(id, petData) {
    if (!USE_API) {
      const pets = await storage.get('reception_pets') || [];
      const index = pets.findIndex(p => p.id === id);
      if (index !== -1) {
        pets[index] = { ...pets[index], ...petData };
        await storage.set('reception_pets', pets);
      }
      return petData;
    }
    try {
      const result = await api.pets.update(id, petData);
      storage.clearCache();
      return result?.data;
    } catch (error) {
      console.error('Update pet error:', error);
      throw error;
    }
  },

  async delete(id) {
    if (!USE_API) {
      const pets = await storage.get('reception_pets') || [];
      const filtered = pets.filter(p => p.id !== id);
      await storage.set('reception_pets', filtered);
      return;
    }
    try {
      await api.pets.delete(id);
      storage.clearCache();
    } catch (error) {
      console.error('Delete pet error:', error);
      throw error;
    }
  },
};

export const appointmentsStorage = {
  async getAll() {
    if (!USE_API) {
      return storage.get('reception_appointments');
    }
    try {
      const result = await api.appointments.getAll();
      return result?.data || [];
    } catch (error) {
      return storage.get('reception_appointments');
    }
  },

  async create(appointmentData) {
    if (!USE_API) {
      const appointments = await storage.get('reception_appointments') || [];
      appointments.push(appointmentData);
      await storage.set('reception_appointments', appointments);
      return appointmentData;
    }
    try {
      const result = await api.appointments.create(appointmentData);
      storage.clearCache();
      return result?.data;
    } catch (error) {
      console.error('Create appointment error:', error);
      throw error;
    }
  },

  async update(id, appointmentData) {
    if (!USE_API) {
      const appointments = await storage.get('reception_appointments') || [];
      const index = appointments.findIndex(a => a.id === id);
      if (index !== -1) {
        appointments[index] = { ...appointments[index], ...appointmentData };
        await storage.set('reception_appointments', appointments);
      }
      return appointmentData;
    }
    try {
      const result = await api.appointments.update(id, appointmentData);
      storage.clearCache();
      return result?.data;
    } catch (error) {
      console.error('Update appointment error:', error);
      throw error;
    }
  },

  async delete(id) {
    if (!USE_API) {
      const appointments = await storage.get('reception_appointments') || [];
      const filtered = appointments.filter(a => a.id !== id);
      await storage.set('reception_appointments', filtered);
      return;
    }
    try {
      await api.appointments.delete(id);
      storage.clearCache();
    } catch (error) {
      console.error('Delete appointment error:', error);
      throw error;
    }
  },
};

export const prescriptionsStorage = {
  async getAll() {
    if (!USE_API) {
      return storage.get('doctor_prescriptions');
    }
    try {
      const result = await api.prescriptions.getAll();
      return result?.data || [];
    } catch (error) {
      return storage.get('doctor_prescriptions');
    }
  },

  async create(prescriptionData) {
    if (!USE_API) {
      const prescriptions = await storage.get('doctor_prescriptions') || [];
      prescriptions.unshift(prescriptionData);
      await storage.set('doctor_prescriptions', prescriptions);
      return prescriptionData;
    }
    try {
      const result = await api.prescriptions.create(prescriptionData);
      storage.clearCache();
      return result?.data;
    } catch (error) {
      console.error('Create prescription error:', error);
      throw error;
    }
  },

  async update(id, prescriptionData) {
    if (!USE_API) {
      const prescriptions = await storage.get('doctor_prescriptions') || [];
      const index = prescriptions.findIndex(p => p.id === id);
      if (index !== -1) {
        prescriptions[index] = { ...prescriptions[index], ...prescriptionData };
        await storage.set('doctor_prescriptions', prescriptions);
      }
      return prescriptionData;
    }
    try {
      const result = await api.prescriptions.update(id, prescriptionData);
      storage.clearCache();
      return result?.data;
    } catch (error) {
      console.error('Update prescription error:', error);
      throw error;
    }
  },
};

export default storage;
