// Custom Hook for MongoDB Data Management
// Replaces localStorage with MongoDB API calls

import { useState, useEffect, useCallback } from 'react';
import * as api from '../services/api';

/**
 * Custom hook to manage data with MongoDB
 * @param {string} dataType - Type of data (pets, appointments, prescriptions, etc.)
 * @param {object} options - Configuration options
 * @returns {object} - Data, loading state, error, and CRUD functions
 */
export const useMongoData = (dataType, options = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { autoLoad = true, localStorageKey = null } = options;

  // Map dataType to API
  const getAPI = () => {
    const apiMap = {
      pets: api.petsAPI,
      appointments: api.appointmentsAPI,
      prescriptions: api.prescriptionsAPI,
      medicines: api.medicinesAPI,
      labReports: api.labReportsAPI,
      labTests: api.labTestsAPI,
      inventory: api.inventoryAPI,
      financials: api.financialsAPI,
      users: api.usersAPI,
    };
    return apiMap[dataType];
  };

  // Load data from MongoDB
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const apiClient = getAPI();
      if (!apiClient) {
        throw new Error(`Unknown data type: ${dataType}`);
      }

      const response = await apiClient.getAll();
      const items = response?.data || [];
      setData(items);

      // Sync to localStorage as backup
      if (localStorageKey) {
        localStorage.setItem(localStorageKey, JSON.stringify(items));
      }

      return items;
    } catch (err) {
      console.error(`Error loading ${dataType}:`, err);
      setError(err.message);

      // Fallback to localStorage
      if (localStorageKey) {
        try {
          const stored = localStorage.getItem(localStorageKey);
          if (stored) {
            const items = JSON.parse(stored);
            setData(items);
            return items;
          }
        } catch (e) {
          console.error('localStorage fallback failed:', e);
        }
      }

      return [];
    } finally {
      setLoading(false);
    }
  }, [dataType, localStorageKey]);

  // Create new item
  const create = useCallback(async (itemData) => {
    try {
      setLoading(true);
      setError(null);

      const apiClient = getAPI();
      const response = await apiClient.create(itemData);
      const newItem = response?.data;

      if (newItem) {
        setData(prev => [newItem, ...prev]);

        // Sync to localStorage
        if (localStorageKey) {
          const updated = [newItem, ...data];
          localStorage.setItem(localStorageKey, JSON.stringify(updated));
        }
      }

      return newItem;
    } catch (err) {
      console.error(`Error creating ${dataType}:`, err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [dataType, data, localStorageKey]);

  // Update existing item
  const update = useCallback(async (id, itemData) => {
    try {
      setLoading(true);
      setError(null);

      const apiClient = getAPI();
      const response = await apiClient.update(id, itemData);
      const updatedItem = response?.data;

      if (updatedItem) {
        setData(prev => prev.map(item => 
          (item._id === id || item.id === id) ? updatedItem : item
        ));

        // Sync to localStorage
        if (localStorageKey) {
          const updated = data.map(item => 
            (item._id === id || item.id === id) ? updatedItem : item
          );
          localStorage.setItem(localStorageKey, JSON.stringify(updated));
        }
      }

      return updatedItem;
    } catch (err) {
      console.error(`Error updating ${dataType}:`, err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [dataType, data, localStorageKey]);

  // Delete item
  const remove = useCallback(async (id) => {
    try {
      setLoading(true);
      setError(null);

      const apiClient = getAPI();
      await apiClient.delete(id);

      setData(prev => prev.filter(item => 
        item._id !== id && item.id !== id
      ));

      // Sync to localStorage
      if (localStorageKey) {
        const updated = data.filter(item => 
          item._id !== id && item.id !== id
        );
        localStorage.setItem(localStorageKey, JSON.stringify(updated));
      }

      return true;
    } catch (err) {
      console.error(`Error deleting ${dataType}:`, err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [dataType, data, localStorageKey]);

  // Search items
  const search = useCallback(async (query) => {
    try {
      setLoading(true);
      setError(null);

      const apiClient = getAPI();
      if (apiClient.search) {
        const response = await apiClient.search(query);
        return response?.data || [];
      }

      // Fallback to local filtering
      return data.filter(item => 
        JSON.stringify(item).toLowerCase().includes(query.toLowerCase())
      );
    } catch (err) {
      console.error(`Error searching ${dataType}:`, err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [dataType, data]);

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad) {
      loadData();
    }
  }, [autoLoad, loadData]);

  return {
    data,
    loading,
    error,
    loadData,
    create,
    update,
    remove,
    search,
    setData, // For manual updates
    setError,
  };
};

export default useMongoData;
