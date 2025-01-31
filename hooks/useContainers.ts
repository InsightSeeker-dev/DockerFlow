import { useState, useEffect } from 'react';
import type { Container as DockerContainer } from '@/lib/docker/types';

export function useContainers() {
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContainers = async () => {
    try {
      setIsLoading(true);
      setError(null); // Reset error state before fetching
      
      console.log('Fetching containers...');
      const response = await fetch('/api/containers');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('HTTP Error:', response.status, errorData);
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Received containers data:', data);
      
      if (!Array.isArray(data)) {
        console.error('Invalid response format:', data);
        throw new Error('Invalid response format: expected an array');
      }
      
      setContainers(data);
    } catch (err) {
      console.error('Error fetching containers:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch containers');
      setContainers([]); // Reset containers on error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContainers();
    
    // Rafraîchir toutes les 10 secondes
    const interval = setInterval(fetchContainers, 10000);
    
    return () => clearInterval(interval);
  }, []);

  return {
    containers,
    isLoading,
    error,
    refresh: fetchContainers
  };
}
