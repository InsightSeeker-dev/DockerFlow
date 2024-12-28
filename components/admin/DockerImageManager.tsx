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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <Input
            type="text"
            placeholder="Search images by name or tag..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 h-12 bg-white/5 backdrop-blur-sm border-2 border-gray-700 hover:border-gray-600 focus:border-blue-500 rounded-lg shadow-lg text-lg"
          />
        </div>
        <Button
          onClick={() => setShowPullDialog(true)}
          className="whitespace-nowrap h-12 px-6 bg-blue-600 hover:bg-blue-700"
        >
          <Upload className="mr-2 h-5 w-5" />
          Pull Image
        </Button>
      </div>

      {showPullDialog && (
        <Card className="border-slate-700 bg-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-200">Pull Docker Image</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-200">Image Name</label>
                <Input
                  placeholder="e.g., nginx"
                  value={newImageName}
                  onChange={(e) => setNewImageName(e.target.value)}
                  className="bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-200">Tag</label>
                <Input
                  placeholder="e.g., latest"
                  value={newImageTag}
                  onChange={(e) => setNewImageTag(e.target.value)}
                  className="bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-400"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setShowPullDialog(false)}
                  className="border-slate-700 hover:bg-slate-800 text-slate-200"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handlePullImage}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={!newImageName.trim()}
                >
                  Pull Image
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4">
        {filteredImages.map((image) => (
          <Card key={image.id} className="border-slate-700 bg-slate-800/50 hover:bg-slate-800 transition-colors">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center">
                    <Tag className="w-6 h-6 text-blue-400" />
                  </div>
                </div>
                <div>
                  <h3 className="font-medium text-slate-200">{image.name}</h3>
                  <div className="flex items-center space-x-2 text-sm text-slate-400">
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
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
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
