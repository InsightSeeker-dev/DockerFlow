import React, { useState, useRef } from 'react';
import { Button, TextField, Paper, Typography, Box, IconButton, LinearProgress } from '@mui/material';
import { Upload as UploadIcon, Build as BuildIcon, Clear as ClearIcon } from '@mui/icons-material';
import { toast } from 'react-hot-toast';

interface DockerfileBuildFromFileProps {
  onImageBuilt?: () => void;
}

export default function DockerfileBuildFromFile({ onImageBuilt }: DockerfileBuildFromFileProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dockerfileContent, setDockerfileContent] = useState('');
  const [imageName, setImageName] = useState('');
  const [imageTag, setImageTag] = useState('latest');
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildProgress, setBuildProgress] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        const content = await file.text();
        setSelectedFile(file);
        setDockerfileContent(content);
      } catch (error) {
        console.error('Error reading file:', error);
        toast.error('Failed to read Dockerfile');
      }
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setDockerfileContent('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleBuild = async () => {
    if (!dockerfileContent) {
      toast.error('Please select a Dockerfile');
      return;
    }

    if (!imageName) {
      toast.error('Please enter an image name');
      return;
    }

    setIsBuilding(true);
    setBuildProgress([]);

    try {
      const response = await fetch('/api/admin/images/build', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dockerfile: dockerfileContent,
          imageName: `${imageName}:${imageTag}`,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to build image');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response stream');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = new TextDecoder().decode(value);
        const lines = text.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.error) {
              toast.error(data.message || 'Build failed');
            } else if (data.stream) {
              setBuildProgress(prev => [...prev, data.stream.trim()]);
            }
          } catch (e) {
            console.error('Failed to parse build progress:', e);
          }
        }
      }

      toast.success('Image built successfully');
      onImageBuilt?.();
    } catch (error) {
      console.error('Build error:', error);
      toast.error('Failed to build image');
    } finally {
      setIsBuilding(false);
    }
  };

  return (
    <Paper className="p-6 space-y-6">
      <Typography variant="h6" className="mb-4">
        Build from Dockerfile
      </Typography>

      <Box className="space-y-4">
        <Box className="flex items-center gap-4">
          <input
            type="file"
            accept=".dockerfile,Dockerfile"
            onChange={handleFileSelect}
            className="hidden"
            ref={fileInputRef}
          />
          <Button
            variant="outlined"
            onClick={() => fileInputRef.current?.click()}
            startIcon={<UploadIcon />}
            disabled={isBuilding}
          >
            Select Dockerfile
          </Button>
          {selectedFile && (
            <>
              <Typography variant="body2" className="flex-1">
                {selectedFile.name}
              </Typography>
              <IconButton onClick={handleClearFile} size="small">
                <ClearIcon />
              </IconButton>
            </>
          )}
        </Box>

        {dockerfileContent && (
          <Box className="bg-gray-50 p-4 rounded font-mono text-sm overflow-auto max-h-96">
            <pre>{dockerfileContent}</pre>
          </Box>
        )}

        <Box className="flex gap-4">
          <TextField
            label="Image Name"
            value={imageName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImageName(e.target.value)}
            placeholder="my-app"
            className="flex-1"
            disabled={isBuilding}
          />
          <TextField
            label="Tag"
            value={imageTag}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImageTag(e.target.value)}
            placeholder="latest"
            className="w-32"
            disabled={isBuilding}
          />
        </Box>

        {isBuilding && (
          <Box className="space-y-2">
            <LinearProgress />
            <Box className="bg-gray-50 p-4 rounded max-h-48 overflow-auto">
              {buildProgress.map((line, index) => (
                <div key={index} className="font-mono text-sm">
                  {line}
                </div>
              ))}
            </Box>
          </Box>
        )}

        <Box className="flex justify-end">
          <Button
            variant="contained"
            color="primary"
            onClick={handleBuild}
            disabled={!dockerfileContent || !imageName || isBuilding}
            startIcon={<BuildIcon />}
          >
            {isBuilding ? 'Building...' : 'Build Image'}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}
