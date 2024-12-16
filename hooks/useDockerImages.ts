import { useState, useEffect } from 'react';
import { DockerImageInfo } from '@/types/admin';

export const useDockerImages = (userId?: string) => {
  const [images, setImages] = useState<DockerImageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchImages = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/docker/images${userId ? `?userId=${userId}` : ''}`);
      if (!response.ok) throw new Error('Failed to fetch images');
      const data = await response.json();
      setImages(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const pullImage = async (imageName: string, tag: string) => {
    try {
      const response = await fetch('/api/docker/images/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageName, tag }),
      });
      if (!response.ok) throw new Error('Failed to pull image');
      await fetchImages();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pull image');
      return false;
    }
  };

  const deleteImage = async (imageId: string) => {
    try {
      const response = await fetch(`/api/docker/images/${imageId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete image');
      await fetchImages();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete image');
      return false;
    }
  };

  useEffect(() => {
    fetchImages();
  }, [userId]);

  return {
    images,
    loading,
    error,
    pullImage,
    deleteImage,
    refreshImages: fetchImages,
  };
};

export default useDockerImages;
