import { useState, useEffect } from 'react';

interface UserStats {
  total: number;
  active: number;
  new: number;
  suspended: number;
}

interface ContainerStats {
  total: number;
  running: number;
  stopped: number;
  error: number;
}

interface AdminStats {
  userStats: UserStats | null;
  containerStats: ContainerStats | null;
  loading: boolean;
  error: string | null;
}

export function useAdminStats() {
  const [stats, setStats] = useState<AdminStats>({
    userStats: null,
    containerStats: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [userResponse, containerResponse] = await Promise.all([
          fetch('/api/admin/user-stats'),
          fetch('/api/admin/container-stats')
        ]);

        if (!userResponse.ok || !containerResponse.ok) {
          throw new Error('Failed to fetch statistics');
        }

        const [userStats, containerStats] = await Promise.all([
          userResponse.json(),
          containerResponse.json()
        ]);

        setStats({
          userStats,
          containerStats,
          loading: false,
          error: null
        });
      } catch (err) {
        setStats(prev => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'An error occurred'
        }));
      }
    };

    fetchStats();
    // Mettre à jour toutes les 30 secondes
    const interval = setInterval(fetchStats, 30000);

    return () => clearInterval(interval);
  }, []);

  return stats;
}
