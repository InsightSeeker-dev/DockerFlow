'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { DockerImage } from '@/lib/docker/types';

interface CreateContainerFormProps {
  image: DockerImage;
  onSuccess?: () => void;
}

export function CreateContainerForm({ image, onSuccess }: CreateContainerFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    subdomain: '',
    env: {} as { [key: string]: string },
    ports: {} as { [key: string]: string },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/containers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          image: image.RepoTags[0],
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create container');
      }

      toast({
        title: 'Success',
        description: `Container created successfully! It will be available at https://${formData.subdomain}.dockersphere.ovh`,
      });

      setIsOpen(false);
      onSuccess?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create container',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="default">Create Container</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Container</DialogTitle>
          <DialogDescription>
            Create a new container from {image.RepoTags[0]}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Container Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="my-container"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subdomain">Subdomain</Label>
            <div className="flex items-center space-x-2">
              <Input
                id="subdomain"
                value={formData.subdomain}
                onChange={(e) => setFormData({ ...formData, subdomain: e.target.value })}
                placeholder="myapp"
                required
              />
              <span className="text-sm text-muted-foreground">.dockersphere.ovh</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Environment Variables</Label>
            <div className="space-y-2">
              {Object.entries(formData.env).map(([key, value], index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Input
                    placeholder="KEY"
                    value={key}
                    onChange={(e) => {
                      const newEnv = { ...formData.env };
                      delete newEnv[key];
                      newEnv[e.target.value] = value;
                      setFormData({ ...formData, env: newEnv });
                    }}
                  />
                  <Input
                    placeholder="VALUE"
                    value={value}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        env: { ...formData.env, [key]: e.target.value },
                      });
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      const newEnv = { ...formData.env };
                      delete newEnv[key];
                      setFormData({ ...formData, env: newEnv });
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFormData({
                    ...formData,
                    env: { ...formData.env, '': '' },
                  });
                }}
              >
                Add Environment Variable
              </Button>
            </div>
          </div>
          <div className="pt-4 space-x-2 flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Container'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
