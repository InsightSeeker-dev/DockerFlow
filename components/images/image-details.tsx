'use client';

import { DockerImage } from '@/lib/docker/types';
import { formatBytes } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ImageDetailsProps {
  image: DockerImage;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImageDetails({ image, open, onOpenChange }: ImageDetailsProps) {
  // Format the creation date
  const createdDate = new Date(image.Created * 1000).toLocaleString();
  
  // Get the repository tags
  const tags = image.RepoTags?.filter(tag => tag !== '<none>:<none>') || [];
  
  // Get the shortened image ID without the "sha256:" prefix (only first 12 characters)
  const imageId = image.Id.replace('sha256:', '').substring(0, 12);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Image Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">Repository Tags</h3>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag, index) => (
                <span
                  key={index}
                  className="bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium mb-2">ID</h3>
            <p className="font-mono text-sm bg-muted p-2 rounded-md select-all">
              {imageId}
            </p>
          </div>
          
          <div>
            <h3 className="text-sm font-medium mb-2">Size</h3>
            <p className="text-sm">{formatBytes(image.Size)}</p>
          </div>
          
          <div>
            <h3 className="text-sm font-medium mb-2">Created</h3>
            <p className="text-sm">{createdDate}</p>
          </div>
          
          {image.Labels && Object.keys(image.Labels).length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">Labels</h3>
              <div className="space-y-2">
                {Object.entries(image.Labels).map(([key, value]) => (
                  <div key={key} className="flex flex-col text-sm">
                    <span className="font-medium">{key}:</span>
                    <span className="text-muted-foreground">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
