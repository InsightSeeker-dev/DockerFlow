import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'react-hot-toast';
import { Plus, X } from 'lucide-react';

interface CreateContainerDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateContainerDialog({ open, onClose, onCreated }: CreateContainerDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    image: '',
    ports: [''] as string[],
  });

  const handleAddPort = () => {
    setFormData(prev => ({
      ...prev,
      ports: [...prev.ports, '']
    }));
  };

  const handleRemovePort = (index: number) => {
    setFormData(prev => ({
      ...prev,
      ports: prev.ports.filter((_, i) => i !== index)
    }));
  };

  const handlePortChange = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      ports: prev.ports.map((port, i) => i === index ? value : port)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/containers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          image: formData.image,
          ports: formData.ports.filter(port => port !== ''),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create container');
      }

      toast.success('Container created successfully');
      onCreated();
      onClose();
      setFormData({ name: '', image: '', ports: [''] });
    } catch (error: any) {
      console.error('Error creating container:', error);
      toast.error(error.message || 'Failed to create container');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-gray-900 text-white">
        <DialogHeader>
          <DialogTitle>Create New Container</DialogTitle>
          <DialogDescription className="text-gray-400">
            Enter the details for your new container.
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
              className="bg-gray-800 border-gray-700"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="image">Docker Image</Label>
            <Input
              id="image"
              value={formData.image}
              onChange={(e) => setFormData({ ...formData, image: e.target.value })}
              placeholder="nginx:latest"
              className="bg-gray-800 border-gray-700"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Port Mappings</Label>
            {formData.ports.map((port, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={port}
                  onChange={(e) => handlePortChange(index, e.target.value)}
                  placeholder="host:container (e.g., 8080:80)"
                  className="bg-gray-800 border-gray-700"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleRemovePort(index)}
                  className="shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={handleAddPort}
              className="w-full mt-2"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Port Mapping
            </Button>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Container'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
