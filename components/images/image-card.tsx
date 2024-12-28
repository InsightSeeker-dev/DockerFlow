'use client';

import { useState } from 'react';
import { DockerImage } from '@/lib/docker/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { formatBytes } from '@/lib/utils';
import { TrashIcon, Loader2 } from 'lucide-react';
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
  const [isLoading, setIsLoading] = useState(false);

  const handleRemove = async () => {
    try {
      setIsLoading(true);
      const imageId = image.Id.replace('sha256:', '');
      console.log('Deleting image with ID:', imageId); // Debug log

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
  const shortId = image.Id.substring(7, 19);

  return (
    <Card className="group hover:shadow-md transition-all duration-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">
          {tags[0] || shortId}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">ID:</span>
              <span className="font-mono text-xs bg-secondary px-2 py-1 rounded">{shortId}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Size:</span>
              <span className="font-medium">{formatBytes(image.Size)}</span>
            </div>
            {tags.length > 1 && (
              <div className="flex flex-col gap-2">
                <span className="text-muted-foreground">Tags:</span>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs bg-secondary px-2 py-1 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                disabled={isLoading}
                className="w-full opacity-80 group-hover:opacity-100 transition-opacity"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <TrashIcon className="mr-2 h-4 w-4" />
                )}
                {isLoading ? 'Removing...' : 'Remove'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove Docker Image</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>Are you sure you want to remove this Docker image?</p>
                  <div className="mt-2 p-2 bg-secondary/50 rounded-md">
                    <p className="font-medium">{tags[0] || shortId}</p>
                    <p className="text-sm text-muted-foreground">Size: {formatBytes(image.Size)}</p>
                  </div>
                  <p className="text-sm text-destructive">This action cannot be undone.</p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleRemove}
                  disabled={isLoading}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Removing...
                    </>
                  ) : (
                    'Remove'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}