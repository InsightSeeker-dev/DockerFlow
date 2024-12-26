'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DockerfileBuilderProps {
  onImageBuilt: () => void;
}

export default function DockerfileBuilder({ onImageBuilt }: DockerfileBuilderProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    tag: 'latest',
    baseImage: 'node:18',
    dockerfile: `FROM node:18

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]`,
  });

  const baseImageOptions = [
    { value: 'node:18', label: 'Node.js 18' },
    { value: 'node:20', label: 'Node.js 20' },
    { value: 'python:3.9', label: 'Python 3.9' },
    { value: 'python:3.11', label: 'Python 3.11' },
    { value: 'golang:1.21', label: 'Go 1.21' },
    { value: 'ubuntu:22.04', label: 'Ubuntu 22.04' },
    { value: 'alpine:3.18', label: 'Alpine 3.18' },
  ];

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleBaseImageChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      baseImage: value,
      dockerfile: `FROM ${value}\n\nWORKDIR /app\n\n# Add your commands here\n`,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.tag || !formData.dockerfile) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please fill in all required fields',
      });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/admin/images/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          tag: formData.tag,
          dockerfile: formData.dockerfile,
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
      setFormData((prev) => ({
        ...prev,
        name: '',
        tag: 'latest',
        dockerfile: `FROM ${prev.baseImage}\n\nWORKDIR /app\n\n# Add your commands here\n`,
      }));
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
        <CardTitle>Build Docker Image</CardTitle>
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
            <Label>Base Image</Label>
            <Select
              value={formData.baseImage}
              onValueChange={handleBaseImageChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select base image" />
              </SelectTrigger>
              <SelectContent>
                {baseImageOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dockerfile">Dockerfile Content</Label>
            <Textarea
              id="dockerfile"
              name="dockerfile"
              value={formData.dockerfile}
              onChange={handleInputChange}
              className="font-mono h-[300px]"
              required
            />
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
