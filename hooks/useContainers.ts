import { useState, useEffect } from 'react';
import type { Container } from '@/lib/docker/types';

export function useContainers() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContainers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Fetching containers from API...');
      const response = await fetch('/api/containers');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API Error:', response.status, errorData);
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('API Response:', data);
      
      if (!Array.isArray(data)) {
        console.error('Invalid API response format:', data);
        throw new Error('Invalid API response format: expected an array');
      }

      // Valider et transformer les données
      const validContainers = data.map(container => {
        if (!container || typeof container !== 'object') {
          console.error('Invalid container object:', container);
          return null;
        }

        // Vérifier les propriétés requises
        if (!container.Id || !container.Names || !Array.isArray(container.Names)) {
          console.error('Container missing required properties:', container);
          return null;
        }

        console.log('Processing container:', container.Names[0]);

        // S'assurer que toutes les propriétés nécessaires sont présentes
        return {
          ...container,
          State: container.State || 'unknown',
          Status: container.Status || 'unknown',
          Ports: Array.isArray(container.Ports) ? container.Ports : [],
          customConfig: {
            subdomain: container.customConfig?.subdomain || container.Names[0].replace(/^\//, ''),
            ports: container.customConfig?.ports || [],
            volumes: container.customConfig?.volumes || {},
            env: container.customConfig?.env || {},
            cpuLimit: container.customConfig?.cpuLimit || 4000,
            memoryLimit: container.customConfig?.memoryLimit || 8589934592,
          },
          user: container.user || null,
          traefik: container.traefik || {
            enabled: false,
            rule: '',
            tls: false,
            certresolver: ''
          }
        };
      }).filter(Boolean);

      console.log('Final processed containers:', validContainers);
      setContainers(validContainers);
    } catch (error) {
      console.error('Error in fetchContainers:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch containers');
    } finally {
      setIsLoading(false);
    }
  };

  // Rafraîchir les conteneurs toutes les 5 secondes
  useEffect(() => {
    fetchContainers();
    
    const interval = setInterval(fetchContainers, 5000);
    
    return () => clearInterval(interval);
  }, []);

  return {
    containers,
    isLoading,
    error,
    refetch: fetchContainers
  };
}
