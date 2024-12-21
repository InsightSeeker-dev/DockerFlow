import { SystemStats } from '@/types/system';

export async function getSystemStats(): Promise<SystemStats> {
  try {
    const response = await fetch('/api/admin/system/stats');
    if (!response.ok) {
      throw new Error('Failed to fetch system stats');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching system stats:', error);
    throw error;
  }
}
