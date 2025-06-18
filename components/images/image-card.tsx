'use client';

import { useState } from 'react';
import { DockerImage } from '@/components/containers/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { formatBytes } from '@/lib/utils';
import { TrashIcon, Info } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { ImageDetails } from './image-details';
import { useSession } from 'next-auth/react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ImageCardProps {
  image: DockerImage;
  onRemove: () => void;
}

export function ImageCard({ image, onRemove }: ImageCardProps) {
  const { toast } = useToast();
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const handleRemove = async () => {
    try {
      setIsLoading(true);
      const imageId = image.Id; // Use the full ID, including 'sha256:'
      console.log('Deleting image with ID:', imageId);

      // Supprimer l'image
      const response = await fetch(`/api/admin/images/${imageId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 409) {
          toast({
            title: 'Cannot Delete Image',
            description: 'This image is being used by one or more containers. Please remove the containers first.',
            variant: 'destructive',
          });
          return;
        }
        throw new Error(error.message || 'Failed to remove image');
      }

      // Enregistrer l'activité
      const activityResponse = await fetch('/api/admin/activities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'IMAGE_DELETE',
          description: `Deleted image: ${image.RepoTags?.[0] || imageId}`,
          metadata: {
            imageId,
            tags: image.RepoTags,
            size: image.Size
          }
        }),
      });

      if (!activityResponse.ok) {
        console.error('Failed to log image deletion activity');
      }

      toast({
        title: 'Success',
        description: 'Image removed successfully',
      });

      onRemove();
    } catch (error) {
      console.error('Error removing image:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred while removing the image',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const tags = image.RepoTags?.filter(tag => tag !== '<none>:<none>') || [];
  const imageId = image.Id.replace('sha256:', '').substring(0, 12);

  return (
    <>
      <Card className="group hover:shadow-md transition-all duration-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-medium">
            {tags[0] || imageId}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowDetails(true)}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Info className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isLoading}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                >
                  {isLoading ? (
                    <LoadingSpinner size={16} color="#ef4444" />
                  ) : (
                    <TrashIcon className="h-4 w-4" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the image
                    and all its associated data.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRemove}>Continue</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">ID:</span>
                <span className="font-mono text-xs bg-secondary px-2 py-1 rounded">{imageId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Size:</span>
                <span className="font-medium">{formatBytes(image.Size)}</span>
              </div>
              {tags.length > 1 && (
                <div className="flex flex-col gap-2">
                  <span className="text-muted-foreground">Tags:</span>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag: string) => (
                      <span
                        key={tag}
                        className="bg-secondary text-secondary-foreground text-xs px-2 py-1 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <ImageDetails
        image={image}
        open={showDetails}
        onOpenChange={setShowDetails}
      />
    </>
  );
}