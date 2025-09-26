import { useState, useEffect } from 'react';

const API = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";

export const useGasSettings = () => {
  const [gasSettings, setGasSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchGasSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/api/gas/list`);
      const result = await response.json();
      
      if (result.success) {
        setGasSettings(result.data || []);
        setError(null);
      } else {
        setError(result.message || 'Failed to fetch gas settings');
      }
    } catch (err) {
      setError(err.message);
      console.error('Error fetching gas settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGasSettings();
  }, []);

  return {
    gasSettings,
    loading,
    error,
    refetch: fetchGasSettings
  };
};

