import React, { useState } from 'react';
import { Button, TextField, Paper, Typography, Box, IconButton, List, ListItem, ListItemText, Tooltip } from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Build as BuildIcon } from '@mui/icons-material';
import { toast } from 'react-hot-toast';

interface DockerCommand {
  type: 'FROM' | 'RUN' | 'COPY' | 'WORKDIR' | 'ENV' | 'EXPOSE' | 'CMD' | 'ENTRYPOINT';
  value: string;
}

interface DockerfileBuilderProps {
  onImageBuilt?: () => void;
}

export default function DockerfileBuilder({ onImageBuilt }: DockerfileBuilderProps) {
  const [commands, setCommands] = useState<DockerCommand[]>([
    { type: 'FROM', value: 'node:18-alpine' }
  ]);
  const [imageName, setImageName] = useState('');
  const [imageTag, setImageTag] = useState('latest');
  const [isBuilding, setIsBuilding] = useState(false);

  const commandTypes: DockerCommand['type'][] = [
    'FROM', 'RUN', 'COPY', 'WORKDIR', 'ENV', 'EXPOSE', 'CMD', 'ENTRYPOINT'
  ];

  const addCommand = (type: DockerCommand['type']) => {
    setCommands([...commands, { type, value: '' }]);
  };

  const removeCommand = (index: number) => {
    const newCommands = [...commands];
    newCommands.splice(index, 1);
    setCommands(newCommands);
  };

  const updateCommand = (index: number, value: string) => {
    const newCommands = [...commands];
    newCommands[index].value = value;
    setCommands(newCommands);
  };

  const generateDockerfile = () => {
    return commands
      .filter(cmd => cmd.value.trim() !== '')
      .map(cmd => `${cmd.type} ${cmd.value}`)
      .join('\n');
  };

  const handleBuild = async () => {
    if (!imageName) {
      toast.error('Please enter an image name');
      return;
    }

    const dockerfile = generateDockerfile();
    setIsBuilding(true);

    try {
      const response = await fetch('/api/admin/images/build', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dockerfile,
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
              console.log(data.stream);
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
        Create Docker Image
      </Typography>

      <Box className="flex gap-4 mb-6">
        <TextField
          label="Image Name"
          value={imageName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImageName(e.target.value)}
          placeholder="my-app"
          className="flex-1"
        />
        <TextField
          label="Tag"
          value={imageTag}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImageTag(e.target.value)}
          placeholder="latest"
          className="w-32"
        />
      </Box>

      <List className="space-y-2">
        {commands.map((cmd, index) => (
          <ListItem
            key={index}
            className="flex items-center gap-2 bg-gray-50 rounded"
            secondaryAction={
              <IconButton
                edge="end"
                onClick={() => removeCommand(index)}
                disabled={index === 0}
              >
                <DeleteIcon />
              </IconButton>
            }
          >
            <ListItemText
              primary={
                <Box className="flex items-center gap-2">
                  <Typography
                    variant="body2"
                    className="font-mono bg-blue-100 px-2 py-1 rounded"
                  >
                    {cmd.type}
                  </Typography>
                  <TextField
                    value={cmd.value}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateCommand(index, e.target.value)}
                    placeholder={`Enter ${cmd.type} command`}
                    fullWidth
                    size="small"
                  />
                </Box>
              }
            />
          </ListItem>
        ))}
      </List>

      <Box className="flex justify-between mt-4">
        <Box className="flex gap-2">
          {commandTypes.map((type) => (
            <Tooltip key={type} title={`Add ${type} command`}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => addCommand(type)}
                startIcon={<AddIcon />}
              >
                {type}
              </Button>
            </Tooltip>
          ))}
        </Box>
        
        <Button
          variant="contained"
          color="primary"
          onClick={handleBuild}
          disabled={isBuilding}
          startIcon={<BuildIcon />}
        >
          {isBuilding ? 'Building...' : 'Build Image'}
        </Button>
      </Box>
    </Paper>
  );
}
