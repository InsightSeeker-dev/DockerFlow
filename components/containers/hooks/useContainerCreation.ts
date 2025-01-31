import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { ContainerFormData, CreateContainerResponse, DockerImage } from '../types';

interface UseContainerCreationProps {
  onSuccess?: () => void;
  onClose?: () => void;
}

export const useContainerCreation = ({ onSuccess, onClose }: UseContainerCreationProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [images, setImages] = useState<DockerImage[]>([]);
  const { toast } = useToast();
  
  const [formData, setFormData] = useState<ContainerFormData>({
    name: '',
    image: '',
    subdomain: '',
  });

  const fetchImages = async () => {
    try {
      const response = await fetch('/api/containers/images');
      if (!response.ok) throw new Error('Failed to fetch images');
      const data = await response.json();
      const validImages = data.filter((img: DockerImage) => Array.isArray(img.RepoTags) && img.RepoTags.length > 0);
      setImages(validImages);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load Docker images',
        variant: 'destructive',
      });
    }
  };

  const validateFormData = (data: ContainerFormData): string | null => {
    if (!data.name) return 'Container name is required';
    if (!data.image) return 'Image is required';
    if (!data.subdomain) return 'Subdomain is required';
    
    // Validation du format du nom (alphanumeric + tirets)
    if (!/^[a-zA-Z0-9-]+$/.test(data.name)) {
      return 'Container name must contain only letters, numbers, and hyphens';
    }
    
    // Validation du sous-domaine
    if (!/^[a-zA-Z0-9-]+$/.test(data.subdomain)) {
      return 'Subdomain must contain only letters, numbers, and hyphens';
    }

    return null;
  };

  const updateFormData = (field: keyof ContainerFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const createContainer = async (formData: ContainerFormData): Promise<void> => {
    const validationError = validateFormData(formData);
    if (validationError) {
      toast({
        title: 'Validation Error',
        description: validationError,
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/containers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create container');
      }

      const data: CreateContainerResponse = await response.json();

      toast({
        title: 'Success',
        description: `Container created successfully! It will be available at https://${data.subdomain}.dockersphere.ovh`,
      });

      // Attendre un peu pour laisser le temps au conteneur de démarrer
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Appeler onSuccess pour déclencher le rafraîchissement
      onSuccess?.();
      onClose?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create container',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    formData,
    isLoading,
    images,
    fetchImages,
    createContainer,
    updateFormData,
  };
};
