import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useContainerCreation } from './hooks/useContainerCreation';
import { DockerImage } from './types';
import { Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ContainerCreationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  preSelectedImage?: DockerImage;
}

export function ContainerCreation({ 
  open, 
  onOpenChange, 
  onSuccess,
  preSelectedImage 
}: ContainerCreationProps) {
  const {
    formData,
    isLoading,
    images,
    fetchImages,
    createContainer,
    updateFormData,
  } = useContainerCreation({
    onSuccess,
    onClose: () => onOpenChange(false)
  });

  useEffect(() => {
    if (open) {
      fetchImages();
      if (preSelectedImage?.RepoTags?.[0]) {
        updateFormData('image', preSelectedImage.RepoTags[0]);
      }
    }
  }, [open, preSelectedImage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createContainer(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] bg-[#0B1120] border-gray-800">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-xl">Créer un nouveau conteneur</DialogTitle>
          <DialogDescription className="text-gray-400">
            Les ports et volumes seront configurés automatiquement.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Container Name */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-200">Nom du conteneur</Label>
            <Input
              value={formData.name}
              onChange={(e) => updateFormData('name', e.target.value)}
              placeholder="mon-conteneur"
              className="bg-[#0B1120] border-gray-700"
              required
            />
          </div>

          {/* Subdomain */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-200">Sous-domaine</Label>
            <Input
              value={formData.subdomain}
              onChange={(e) => updateFormData('subdomain', e.target.value)}
              placeholder="mon-app"
              className="bg-[#0B1120] border-gray-700"
              required
            />
            <p className="text-xs text-gray-400">
              Votre conteneur sera accessible à https://[sous-domaine].dockersphere.ovh
            </p>
          </div>

          {/* Image Selection */}
          {!preSelectedImage && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-200">Image Docker</Label>
              <Select
                value={formData.image}
                onValueChange={(value) => updateFormData('image', value)}
                required
              >
                <SelectTrigger className="bg-[#0B1120] border-gray-700">
                  <SelectValue placeholder="Sélectionner une image" />
                </SelectTrigger>
                <SelectContent className="bg-[#0B1120] border-gray-700 max-h-[300px]">
                  {images.map((image) => {
                    const imageTag = image.RepoTags?.[0];
                    if (!imageTag) return null;
                    return (
                      <SelectItem 
                        key={image.Id} 
                        value={imageTag}
                      >
                        {imageTag}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="bg-transparent"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Création...
                </>
              ) : (
                'Créer le conteneur'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
