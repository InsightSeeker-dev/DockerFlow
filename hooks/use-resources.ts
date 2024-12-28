import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

export interface ResourceUsage {
  id: string;
  name: string;
  email: string;
  cpuLimit: number;
  memoryLimit: number;
  storageLimit: number;
  cpuThreshold: number;
  memoryThreshold: number;
  storageThreshold: number;
  cpuUsage: number;
  memoryUsage: number;
  storageUsage: number;
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  storageUsagePercent: number;
}

interface UseResourcesOptions {
  userId?: string;
  refreshInterval?: number;
}

export function useResources(options: UseResourcesOptions = {}): {
  resources: ResourceUsage | ResourceUsage[] | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateResources: (data: Partial<ResourceUsage>) => Promise<boolean>;
} {
  const { data: session } = useSession();
  const [resources, setResources] = useState<ResourceUsage | ResourceUsage[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResources = async () => {
    try {
      const url = new URL('/api/admin/resources', window.location.origin);
      if (options.userId) {
        url.searchParams.append('userId', options.userId);
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error('Failed to fetch resources');
      }

      const data = await response.json();
      // Si userId est fourni, on s'attend à recevoir un seul ResourceUsage
      setResources(options.userId ? (Array.isArray(data) ? data[0] : data) : data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchResources();

      if (options.refreshInterval) {
        const interval = setInterval(fetchResources, options.refreshInterval);
        return () => clearInterval(interval);
      }
    }
  }, [session, options.userId, options.refreshInterval]);

  const updateResources = async (data: Partial<ResourceUsage>): Promise<boolean> => {
    if (!session) {
      setError('No active session');
      return false;
    }

    try {
      const response = await fetch('/api/admin/resources', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: options.userId,
          ...data,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update resources');
      }

      await fetchResources();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return false;
    }
  };

  return {
    resources,
    isLoading,
    error,
    refresh: fetchResources,
    updateResources,
  };
}
