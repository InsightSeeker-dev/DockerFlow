import React, { useState } from 'react';
import { Search, Filter, Tag, Upload, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DockerImageInfo } from '@/types/admin';

interface DockerImageManagerProps {
  images: DockerImageInfo[];
  onDeleteImage: (imageId: string) => Promise<void>;
  onPullImage: (imageName: string, tag: string) => Promise<void>;
}

const formatSize = (size: number): string => {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let unitIndex = 0;
  
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  
  return `${value.toFixed(2)} ${units[unitIndex]}`;
};

export const DockerImageManager: React.FC<DockerImageManagerProps> = ({
  images,
  onDeleteImage,
  onPullImage,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showPullDialog, setShowPullDialog] = useState(false);
  const [newImageName, setNewImageName] = useState('');
  const [newImageTag, setNewImageTag] = useState('latest');

  const filteredImages = images.filter(image => 
    image.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    image.tag.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handlePullImage = async () => {
    await onPullImage(newImageName, newImageTag);
    setShowPullDialog(false);
    setNewImageName('');
    setNewImageTag('latest');
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              className="pl-10"
              placeholder="Search images..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Button onClick={() => setShowPullDialog(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Pull Image
          </Button>
        </div>
      </div>

      {showPullDialog && (
        <Card>
          <CardHeader>
            <CardTitle>Pull Docker Image</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Image Name</label>
                <Input
                  placeholder="e.g., nginx"
                  value={newImageName}
                  onChange={(e) => setNewImageName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tag</label>
                <Input
                  placeholder="e.g., latest"
                  value={newImageTag}
                  onChange={(e) => setNewImageTag(e.target.value)}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowPullDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handlePullImage}>
                  Pull Image
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4">
        {filteredImages.map((image) => (
          <Card key={image.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Tag className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
                <div>
                  <h3 className="font-medium">{image.name}</h3>
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <span>Tag: {image.tag}</span>
                    <span>•</span>
                    <span>Size: {formatSize(image.size)}</span>
                    <span>•</span>
                    <span>Source: {image.source}</span>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-red-500 hover:text-red-600"
                onClick={() => onDeleteImage(image.id)}
              >
                <Trash2 className="w-5 h-5" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default DockerImageManager;
