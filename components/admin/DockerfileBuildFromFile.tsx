'use client';

import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Upload, File, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DockerfileBuildFromFileProps {
  onImageBuilt: () => void;
}

export default function DockerfileBuildFromFile({ onImageBuilt }: DockerfileBuildFromFileProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: '',
    tag: 'latest',
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file && (file.name === 'Dockerfile' || file.name.endsWith('.dockerfile'))) {
      setSelectedFile(file);
    } else {
      toast({
        variant: 'destructive',
        title: 'Invalid file',
        description: 'Please select a valid Dockerfile',
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.name === 'Dockerfile' || file.name.endsWith('.dockerfile'))) {
      setSelectedFile(file);
    } else {
      toast({
        variant: 'destructive',
        title: 'Invalid file',
        description: 'Please select a valid Dockerfile',
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !formData.name || !formData.tag) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please fill in all required fields and select a Dockerfile',
      });
      return;
    }

    try {
      setLoading(true);
      const fileContent = await selectedFile.text();
      
      const response = await fetch('/api/admin/images/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          tag: formData.tag,
          dockerfile: fileContent,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to build image');
      }

      toast({
        title: 'Success',
        description: 'Image built successfully',
      });
      onImageBuilt();
      
      // Reset form
      setFormData({
        name: '',
        tag: 'latest',
      });
      setSelectedFile(null);
    } catch (error) {
      console.error('Error building image:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to build image. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Build from Dockerfile</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Image Name</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="e.g., my-app"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tag">Tag</Label>
              <Input
                id="tag"
                name="tag"
                value={formData.tag}
                onChange={handleInputChange}
                placeholder="e.g., latest"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Dockerfile</Label>
            <div
              className={cn(
                'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer',
                'hover:border-primary/50 transition-colors',
                dragActive ? 'border-primary' : 'border-muted',
                selectedFile ? 'bg-muted/50' : 'bg-background'
              )}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".dockerfile,Dockerfile"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              {selectedFile ? (
                <div className="flex items-center justify-center space-x-2">
                  <File className="h-6 w-6 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {selectedFile.name}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-center">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">Click to upload</span> or drag and
                    drop a Dockerfile
                  </div>
                </div>
              )}
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Build Image
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
