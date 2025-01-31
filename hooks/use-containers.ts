'use client';

import { useState, useEffect } from 'react';
import { Container } from '@/lib/docker/types';

export function useContainers() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchContainers() {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch('/api/containers');
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch containers');
      }
      
      const data = await response.json();
      // L'API renvoie directement le tableau de conteneurs
      setContainers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching containers:', err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchContainers();
  }, []);

  return {
    containers,
    isLoading,
    error,
    refresh: fetchContainers
  };
}