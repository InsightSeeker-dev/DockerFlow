'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Download, RefreshCcw, Plus, Settings2, Check, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
interface Registry {
  id: string;
  name: string;
  url: string;
  username?: string;
  password?: string;
  enabled: boolean;
  official?: boolean;
  description?: string;
  needsAuth?: boolean;
}

interface ImagePullerProps {
  onImagePulled?: () => void;
}

export default function ImagePuller({ onImagePulled }: ImagePullerProps) {
  const [imageUrl, setImageUrl] = useState('');
  const [selectedRegistry, setSelectedRegistry] = useState('docker.io');
  const [isPulling, setIsPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState<{[key: string]: string}>({});
  const [pullStatus, setPullStatus] = useState<'idle' | 'pulling' | 'completed' | 'error'>('idle');
  const [registries, setRegistries] = useState<Registry[]>([]);
  const [newRegistry, setNewRegistry] = useState<Registry>({
    id: '',
    name: '',
    url: '',
    username: '',
    password: '',
    enabled: true
  });
  const [isAddingRegistry, setIsAddingRegistry] = useState(false);

  const defaultRegistries = [
    {
      name: 'Docker Hub',
      url: 'docker.io',
      official: true,
      description: 'Official Docker registry',
      needsAuth: false
    },
    {
      name: 'GitHub Container Registry',
      url: 'ghcr.io',
      official: true,
      description: 'GitHub packages and container registry',
      needsAuth: true
    },
    {
      name: 'Google Container Registry',
      url: 'gcr.io',
      official: true,
      description: 'Google Cloud container registry',
      needsAuth: true
    },
    {
      name: 'Quay.io',
      url: 'quay.io',
      official: true,
      description: 'Red Hat container registry',
      needsAuth: true
    }
  ];

  // Charger les registres depuis le stockage local
  useEffect(() => {
    const savedRegistries = localStorage.getItem('registries');
    if (!savedRegistries) {
      // Si aucun registre n'est sauvegardé, utiliser les registres par défaut
      setRegistries(defaultRegistries.map(reg => ({
        id: `reg-${reg.url.replace(/\./g, '-')}`,
        ...reg,
        enabled: reg.url === 'docker.io', // Activer Docker Hub par défaut
        username: '',
        password: ''
      })));
    } else {
      // Fusionner les registres sauvegardés avec les registres par défaut
      const parsed = JSON.parse(savedRegistries);
      const merged = defaultRegistries.map(defaultReg => {
        const savedReg = parsed.find((r: Registry) => r.url === defaultReg.url);
        return {
          id: savedReg?.id || `reg-${defaultReg.url.replace(/\./g, '-')}`,
          ...defaultReg,
          ...savedReg,
          enabled: savedReg ? savedReg.enabled : defaultReg.url === 'docker.io'
        };
      });
      setRegistries(merged);
    }
  }, []);

  // Sauvegarder les registres dans le stockage local
  const saveRegistries = (updatedRegistries: Registry[]) => {
    localStorage.setItem('registries', JSON.stringify(updatedRegistries));
    setRegistries(updatedRegistries);
  };

  const handleAddRegistry = () => {
    if (!newRegistry.name || !newRegistry.url) {
      toast.error('Please fill in all required fields');
      return;
    }

    const updatedRegistries = [...registries, {
      ...newRegistry,
      id: newRegistry.url.replace(/[^a-zA-Z0-9]/g, '_')
    }];
    
    saveRegistries(updatedRegistries);
    setIsAddingRegistry(false);
    setNewRegistry({
      id: '',
      name: '',
      url: '',
      username: '',
      password: '',
      enabled: true
    });
    toast.success('Registry added successfully');
  };

  const toggleRegistry = (registryId: string) => {
    const updatedRegistries = registries.map(registry => 
      registry.id === registryId 
        ? { ...registry, enabled: !registry.enabled }
        : registry
    );
    saveRegistries(updatedRegistries);
  };

  const handlePull = async () => {
    if (!imageUrl) {
      toast.error('Please enter an image URL');
      return;
    }

    setIsPulling(true);
    setPullStatus('pulling');
    setPullProgress({});
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

    try {
      const selectedRegistryConfig = registries.find(r => r.url === selectedRegistry);
      const auth = selectedRegistryConfig?.username ? {
        username: selectedRegistryConfig.username,
        password: selectedRegistryConfig.password
      } : undefined;

      const response = await fetch('/api/admin/images/pull', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl,
          registry: selectedRegistry,
          auth
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to pull image');
      }

      reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response stream');
      }

      let isComplete = false;
      while (!isComplete) {
        const { done, value } = await reader.read();
        
        if (done) {
          isComplete = true;
          // Si on arrive à la fin du stream sans erreur, c'est un succès
          setPullStatus('completed');
          setIsPulling(false);
          break;
        }

        const text = new TextDecoder().decode(value);
        const lines = text.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            
            if (data.error) {
              isComplete = true;
              setPullStatus('error');
              setIsPulling(false);
              toast.error(data.message || 'Failed to pull image');
              break;
            } else if (data.status === 'Image pulled successfully' || data.success) {
              isComplete = true;
              setPullStatus('completed');
              setIsPulling(false);
              toast.success('Image pulled successfully');
              onImagePulled?.();
              break;
            } else {
              setPullProgress(prev => {
                const newProgress = {
                  ...prev,
                  [data.id || 'status']: data.status + (data.progress ? `: ${data.progress}` : ''),
                };
                
                // Vérifie si toutes les étapes sont complètes
                const allComplete = Object.values(newProgress).every(
                  (status): boolean => {
                    const statusStr = String(status);
                    return statusStr.includes('complete');
                  }
                );
                
                if (allComplete && data.status.includes('complete')) {
                  isComplete = true;
                  setPullStatus('completed');
                  setIsPulling(false);
                  toast.success('Image pulled successfully');
                  onImagePulled?.();
                }
                
                return newProgress;
              });
            }
          } catch (e) {
            console.error('Failed to parse pull progress:', e);
          }
        }
      }
    } catch (error: any) {
      console.error('Failed to pull image:', error);
      setPullStatus('error');
      toast.error(error.message || 'Failed to pull image');
    } finally {
      if (reader) {
        reader.cancel();
      }
      setIsPulling(false);
    }
  };

  const renderProgressIcon = (status: { toString(): string }) => {
    const statusText = status.toString();
    if (statusText.includes('complete') || pullStatus === 'completed') {
      return <Check className="h-4 w-4 text-green-500" />;
    }
    if (pullStatus === 'error') {
      return <X className="h-4 w-4 text-red-500" />;
    }
    return <RefreshCcw className="h-4 w-4 animate-spin" />;
  };

  const resetForm = () => {
    setImageUrl('');
    setSelectedRegistry('docker.io');
    setPullProgress({});
    setPullStatus('idle');
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Pull Image</CardTitle>
          <Button
            variant="outline"
            size="icon"
            onClick={resetForm}
            disabled={isPulling}
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="registry">Registry</Label>
            <Select
              value={selectedRegistry}
              onValueChange={setSelectedRegistry}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select registry" />
              </SelectTrigger>
              <SelectContent>
                {registries
                  .filter(registry => registry.enabled)
                  .map((registry) => (
                    <SelectItem key={registry.id} value={registry.url}>
                      {registry.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="imageUrl">Image URL</Label>
            <div className="flex gap-2">
              <Input
                id="imageUrl"
                placeholder="e.g., nginx:latest"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                disabled={isPulling}
              />
              <Button
                onClick={handlePull}
                disabled={isPulling || !imageUrl}
                className="w-32"
                variant={pullStatus === 'completed' ? 'secondary' : pullStatus === 'error' ? 'destructive' : 'default'}
              >
                {isPulling ? (
                  <>
                    <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                    Pulling...
                  </>
                ) : pullStatus === 'completed' ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Done
                  </>
                ) : pullStatus === 'error' ? (
                  <>
                    <X className="mr-2 h-4 w-4" />
                    Failed
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Pull
                  </>
                )}
              </Button>
            </div>
          </div>

          {Object.keys(pullProgress).length > 0 && (
            <div className="mt-4 space-y-2">
              <Label>Pull Progress</Label>
              <div className="rounded-lg border p-4 space-y-2 max-h-48 overflow-y-auto">
                {Object.entries(pullProgress).map(([id, status]) => (
                  <div key={id} className="text-sm flex items-center space-x-2">
                    {renderProgressIcon(status)}
                    <span className="font-medium">{id}:</span>
                    <span className="text-muted-foreground">{status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
      <CardHeader className="flex flex-row items-center justify-between">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon">
              <Settings2 className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registry Settings</DialogTitle>
              <DialogDescription>
                Configure and manage your Docker registries
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Liste des registres existants */}
              <div className="space-y-2">
                {registries.map((registry) => (
                  <div key={registry.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <p className="font-medium">{registry.name}</p>
                      <p className="text-sm text-muted-foreground">{registry.url}</p>
                    </div>
                    <Switch
                      checked={registry.enabled}
                      onCheckedChange={() => toggleRegistry(registry.id)}
                    />
                  </div>
                ))}
              </div>

              {/* Formulaire d'ajout de registre */}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setIsAddingRegistry(!isAddingRegistry)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Registry
              </Button>

              {isAddingRegistry && (
                <div className="space-y-2">
                  <Input
                    placeholder="Registry Name"
                    value={newRegistry.name}
                    onChange={(e) => setNewRegistry(prev => ({ ...prev, name: e.target.value }))}
                  />
                  <Input
                    placeholder="Registry URL"
                    value={newRegistry.url}
                    onChange={(e) => setNewRegistry(prev => ({ ...prev, url: e.target.value }))}
                  />
                  <Input
                    placeholder="Username (optional)"
                    value={newRegistry.username || ''}
                    onChange={(e) => setNewRegistry(prev => ({ ...prev, username: e.target.value }))}
                  />
                  <Input
                    type="password"
                    placeholder="Password (optional)"
                    value={newRegistry.password || ''}
                    onChange={(e) => setNewRegistry(prev => ({ ...prev, password: e.target.value }))}
                  />
                  <Button onClick={handleAddRegistry}>Add Registry</Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
    </Card>
  );
}
