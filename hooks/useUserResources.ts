import { useState, useEffect } from 'react';
import { UserResource } from '@/types/admin';

export const useUserResources = (userId: string) => {
  const [resources, setResources] = useState<UserResource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResources = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/users/${userId}/resources`);
      if (!response.ok) throw new Error('Failed to fetch resources');
      const data = await response.json();
      setResources(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const updateResources = async (updates: Partial<UserResource>) => {
    try {
      const response = await fetch(`/api/users/${userId}/resources`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update resources');
      const updatedData = await response.json();
      setResources(updatedData);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update resources');
      return false;
    }
  };

  useEffect(() => {
    if (userId) {
      fetchResources();
    }
  }, [userId]);

  return {
    resources,
    loading,
    error,
    updateResources,
    refreshResources: fetchResources,
  };
};

export default useUserResources;
