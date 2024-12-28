'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { 
  Upload, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  History,
  Shield,
  Eye,
  FileCode2,
  Save,
  Clock,
  HardDrive,
  Pencil,
  Image as ImageIcon,
  Lightbulb,
  Trash2,
  Plus,
  Undo2,
  Redo2,
  GitCompare,
  BarChart2,
  Download,
  Loader2
} from 'lucide-react';
import { validateDockerfile, suggestImprovements, analyzeDockerfileSecurity } from '@/lib/utils/dockerfileValidator';

interface UnifiedImageBuilderProps {
  onImageBuilt: () => void;
}

interface BuildHistoryItem {
  timestamp: number;
  imageName: string;
  tag: string;
  status: 'success' | 'failed';
  logs: string[];
}

interface DockerfileTemplate {
  name: string;
  description: string;
  content: string;
}

interface FilePreview {
  file: File;
  content: string;
  type: 'text' | 'image' | 'other';
}

interface DockerfileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  securityIssues: {
    severity: 'low' | 'medium' | 'high';
    message: string;
    line?: number;
  }[];
}

interface FileChange {
  timestamp: number;
  fileName: string;
  type: 'create' | 'edit' | 'delete';
  content?: string;
  previousContent?: string;
}

interface FileTemplate {
  name: string;
  description: string;
  filename: string;
  content: string;
  category: 'config' | 'docker' | 'env' | 'git' | 'package';
}

interface FileHistory {
  past: FileChange[];
  present: FileChange | null;
  future: FileChange[];
}

interface DiffViewerProps {
  oldContent: string;
  newContent: string;
  oldHeader?: string;
  newHeader?: string;
}

interface FileVersion {
  content: string;
  timestamp: number;
  type: 'create' | 'edit' | 'delete';
  description?: string;
}

interface FileVersions {
  [fileName: string]: FileVersion[];
}

interface VersionStats {
  totalChanges: number;
  changesByType: {
    create: number;
    edit: number;
    delete: number;
  };
  changesByDate: {
    [date: string]: number;
  };
  mostModifiedFiles: {
    fileName: string;
    changes: number;
  }[];
}

interface DockerImage {
  id: string;
  name: string;
  size: number;
  created: string;
}

const dockerfileTemplates: DockerfileTemplate[] = [
  {
    name: 'Node.js Application',
    description: 'Multi-stage build for Node.js applications with optimized production image',
    content: `# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm install --production
EXPOSE 3000
CMD ["npm", "start"]`
  },
  {
    name: 'Python FastAPI',
    description: 'Optimized Python FastAPI application with poetry dependency management',
    content: `FROM python:3.11-slim

WORKDIR /app

RUN pip install poetry
COPY pyproject.toml poetry.lock ./
RUN poetry config virtualenvs.create false && poetry install --no-dev

COPY . .

EXPOSE 8000
CMD ["poetry", "run", "uvicorn", "main:app", "--host", "0.0.0.0"]`
  },
  {
    name: 'Go Application',
    description: 'Multi-stage build for Go applications with minimal final image',
    content: `# Build stage
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o main

# Final stage
FROM alpine:latest
WORKDIR /app
COPY --from=builder /app/main .
EXPOSE 8080
CMD ["./main"]`
  }
];

const fileTemplates: FileTemplate[] = [
  {
    name: 'Node.js Package.json',
    description: 'Basic package.json for Node.js projects',
    filename: 'package.json',
    category: 'package',
    content: `{
  "name": "my-app",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.18.2"
  },
  "devDependencies": {
    "nodemon": "^3.0.2",
    "jest": "^29.7.0"
  }
}`
  },
  {
    name: 'Docker Compose',
    description: 'Basic docker-compose.yml for Node.js with MongoDB',
    filename: 'docker-compose.yml',
    category: 'docker',
    content: `version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - MONGODB_URI=mongodb://mongo:27017/myapp
    depends_on:
      - mongo
  mongo:
    image: mongo:latest
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db

volumes:
  mongodb_data:`
  },
  {
    name: 'Environment Variables',
    description: 'Common environment variables for Node.js apps',
    filename: '.env',
    category: 'env',
    content: `NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/myapp
JWT_SECRET=your-secret-key
API_KEY=your-api-key`
  },
  {
    name: '.gitignore',
    description: 'Common .gitignore for Node.js projects',
    filename: '.gitignore',
    category: 'git',
    content: `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment
.env
.env.local
.env.*.local

# Build
/dist
/build

# Logs
logs
*.log

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db`
  },
  {
    name: 'ESLint Config',
    description: 'ESLint configuration for TypeScript projects',
    filename: '.eslintrc.json',
    category: 'config',
    content: `{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "root": true,
  "rules": {
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "warn"
  }
}`
  }
];

const PreviewDialog = ({ 
  preview, 
  open, 
  onOpenChange,
  onUpdateContent,
}: { 
  preview: FilePreview; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  onUpdateContent: (preview: FilePreview, content: string) => Promise<void>;
}) => {
  const [editMode, setEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const { toast } = useToast();

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setEditMode(false);
      setEditedContent('');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {preview.type === 'image' ? (
                <ImageIcon className="w-4 h-4" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              <span>{preview.file.name}</span>
            </div>
            {preview.type === 'text' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!editMode) {
                    setEditedContent(preview.content);
                  }
                  setEditMode(!editMode);
                }}
              >
                {editMode ? (
                  <>
                    <Eye className="w-4 h-4 mr-2" />
                    View
                  </>
                ) : (
                  <>
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit
                  </>
                )}
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="relative min-h-[200px] max-h-[600px] overflow-auto">
          {preview.type === 'image' ? (
            <div className="flex items-center justify-center">
              <img
                src={preview.content}
                alt={preview.file.name}
                className="max-w-full h-auto"
              />
            </div>
          ) : preview.type === 'text' ? (
            editMode ? (
              <Textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="font-mono text-sm min-h-[400px]"
              />
            ) : (
              <pre className="p-4 rounded bg-muted font-mono text-sm whitespace-pre-wrap">
                {preview.content}
              </pre>
            )
          ) : (
            <div className="flex items-center justify-center h-40">
              <p className="text-muted-foreground">
                Preview not available for this file type
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          {editMode ? (
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditMode(false);
                  setEditedContent('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  await onUpdateContent(preview, editedContent);
                  setEditMode(false);
                  onOpenChange(false);
                  toast({
                    title: 'File Updated',
                    description: `${preview.file.name} has been updated successfully`,
                  });
                }}
              >
                Save Changes
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const CreateFileDialog = ({
  open,
  onOpenChange,
  onFileCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFileCreate: (name: string, content: string) => Promise<void>;
}) => {
  const [fileName, setFileName] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<FileTemplate | null>(null);
  const [activeCategory, setActiveCategory] = useState<FileTemplate['category'] | 'all'>('all');

  useEffect(() => {
    if (selectedTemplate) {
      setFileName(selectedTemplate.filename);
      setFileContent(selectedTemplate.content);
    }
  }, [selectedTemplate]);

  const filteredTemplates = fileTemplates.filter(
    template => activeCategory === 'all' || template.category === activeCategory
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Create New File</DialogTitle>
          <DialogDescription>
            Create a new file from scratch or use a template
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="template" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="mb-4">
            <TabsTrigger value="template">Use Template</TabsTrigger>
            <TabsTrigger value="blank">Blank File</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden flex flex-col">
            <TabsContent value="template" className="flex-1 overflow-hidden flex flex-col m-0">
              <div className="mb-4">
                <Select value={activeCategory} onValueChange={(value: FileTemplate['category'] | 'all') => setActiveCategory(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="config">Configuration</SelectItem>
                    <SelectItem value="docker">Docker</SelectItem>
                    <SelectItem value="env">Environment</SelectItem>
                    <SelectItem value="git">Git</SelectItem>
                    <SelectItem value="package">Package</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <ScrollArea className="flex-1 h-[400px]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-4 pb-4">
                  {filteredTemplates.map((template) => (
                    <Card
                      key={template.name}
                      className={cn(
                        "cursor-pointer hover:border-primary transition-colors",
                        selectedTemplate?.name === template.name && "border-primary"
                      )}
                      onClick={() => setSelectedTemplate(template)}
                    >
                      <CardHeader>
                        <CardTitle className="text-sm">{template.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {template.description}
                        </CardDescription>
                      </CardHeader>
                      <CardFooter>
                        <Badge variant="outline">{template.category}</Badge>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="blank" className="m-0">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>File Name</Label>
                  <Input
                    placeholder="e.g., config.json, .env, README.md"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                  />
                </div>
              </div>
            </TabsContent>

            <div className="space-y-2 mt-4">
              <Label>Content</Label>
              <ScrollArea className="h-[200px] border rounded-md">
                <Textarea
                  placeholder="Enter file content..."
                  value={fileContent}
                  onChange={(e) => setFileContent(e.target.value)}
                  className="min-h-[200px] border-0 focus-visible:ring-0"
                />
              </ScrollArea>
            </div>
          </div>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button
            variant="outline"
            onClick={() => {
              setFileName('');
              setFileContent('');
              setSelectedTemplate(null);
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={async () => {
              if (fileName && fileContent) {
                await onFileCreate(fileName, fileContent);
                setFileName('');
                setFileContent('');
                setSelectedTemplate(null);
                onOpenChange(false);
              }
            }}
            disabled={!fileName || !fileContent}
          >
            Create File
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const DiffViewer = ({ oldContent, newContent, oldHeader = "Previous Version", newHeader = "Current Version" }: DiffViewerProps) => {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <h4 className="font-medium text-sm text-muted-foreground">{oldHeader}</h4>
        <ScrollArea className="h-[300px] w-full border rounded-md">
          <pre className="p-4 text-xs font-mono whitespace-pre-wrap">
            {oldContent.split('\n').map((line, i) => (
              <div
                key={i}
                className={cn(
                  "px-2 -mx-2",
                  !newContent.includes(line) && "bg-red-100 dark:bg-red-900/20"
                )}
              >
                {line}
              </div>
            ))}
          </pre>
        </ScrollArea>
      </div>
      <div className="space-y-2">
        <h4 className="font-medium text-sm text-muted-foreground">{newHeader}</h4>
        <ScrollArea className="h-[300px] w-full border rounded-md">
          <pre className="p-4 text-xs font-mono whitespace-pre-wrap">
            {newContent.split('\n').map((line, i) => (
              <div
                key={i}
                className={cn(
                  "px-2 -mx-2",
                  !oldContent.includes(line) && "bg-green-100 dark:bg-green-900/20"
                )}
              >
                {line}
              </div>
            ))}
          </pre>
        </ScrollArea>
      </div>
    </div>
  );
};

const calculateVersionStats = (versions: FileVersions): VersionStats => {
  const stats: VersionStats = {
    totalChanges: 0,
    changesByType: {
      create: 0,
      edit: 0,
      delete: 0
    },
    changesByDate: {},
    mostModifiedFiles: []
  };

  // Compte par fichier
  const fileChanges: { [fileName: string]: number } = {};

  Object.entries(versions).forEach(([fileName, fileVersions]) => {
    fileVersions.forEach(version => {
      stats.totalChanges++;
      stats.changesByType[version.type]++;

      const date = new Date(version.timestamp).toLocaleDateString();
      stats.changesByDate[date] = (stats.changesByDate[date] || 0) + 1;

      fileChanges[fileName] = (fileChanges[fileName] || 0) + 1;
    });
  });

  // Calcul des fichiers les plus modifiés
  stats.mostModifiedFiles = Object.entries(fileChanges)
    .map(([fileName, changes]) => ({ fileName, changes }))
    .sort((a, b) => b.changes - a.changes)
    .slice(0, 5);

  return stats;
};

export function UnifiedImageBuilder({ onImageBuilt }: UnifiedImageBuilderProps) {
  const [activeTab, setActiveTab] = useState('file');
  const [dockerfile, setDockerfile] = useState('');
  const [imageName, setImageName] = useState('');
  const [buildContext, setBuildContext] = useState<File[]>([]);
  const [showCreateFile, setShowCreateFile] = useState(false);
  const [filePreviews, setFilePreviews] = useState<FilePreview[]>([]);
  const [fileVersions, setFileVersions] = useState<FileVersions>({});
  const [selectedPreview, setSelectedPreview] = useState<FilePreview | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [selectedDiff, setSelectedDiff] = useState<{
    fileName: string;
    oldContent: string;
    newContent: string;
  } | null>(null);
  const [showDiffDialog, setShowDiffDialog] = useState(false);
  const [showVersionsDialog, setShowVersionsDialog] = useState(false);
  const [selectedFileVersions, setSelectedFileVersions] = useState<{
    fileName: string;
    versions: FileVersion[];
  } | null>(null);
  const [versionStats, setVersionStats] = useState<VersionStats | null>(null);
  const [showStatsDialog, setShowStatsDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const stats = calculateVersionStats(fileVersions);
    setVersionStats(stats);
  }, [fileVersions]);

  const validateInput = () => {
    if (!imageName) {
      toast({
        title: 'Error',
        description: 'Please enter an image name',
        variant: 'destructive',
      });
      return false;
    }

    // Validation du format du nom de l'image
    if (!/^[a-z][a-z0-9-_./]*$/.test(imageName)) {
      toast({
        title: 'Error',
        description: 'Image name must be lowercase and can only contain letters, numbers, dashes, underscores, dots, and forward slashes',
        variant: 'destructive',
      });
      return false;
    }

    if (activeTab === 'editor' && !dockerfile.trim()) {
      toast({
        title: 'Error',
        description: 'Dockerfile content cannot be empty',
        variant: 'destructive',
      });
      return false;
    }

    if (activeTab === 'file' && !buildContext.some(f => f.name === 'Dockerfile')) {
      toast({
        title: 'Error',
        description: 'Please select a Dockerfile',
        variant: 'destructive',
      });
      return false;
    }

    return true;
  };

  const generateFilePreview = async (file: File): Promise<FilePreview> => {
    // Liste des extensions de fichiers texte courants
    const textExtensions = [
      'txt', 'json', 'js', 'jsx', 'ts', 'tsx', 'css', 'scss', 'html', 'xml',
      'md', 'yml', 'yaml', 'env', 'conf', 'config', 'sh', 'bash', 'py', 'rb',
      'java', 'kt', 'go', 'rs', 'c', 'cpp', 'h', 'hpp'
    ];
    
    // Liste des extensions d'images courantes
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'];
    
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    
    if (textExtensions.includes(extension)) {
      const content = await file.text();
      return {
        file,
        content: content.slice(0, 5000), // Limite la taille pour les gros fichiers
        type: 'text'
      };
    } else if (imageExtensions.includes(extension)) {
      return {
        file,
        content: URL.createObjectURL(file),
        type: 'image'
      };
    }
    
    return {
      file,
      content: 'Preview not available for this file type',
      type: 'other'
    };
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setBuildContext(prev => [...prev, ...files]);

    // Générer les aperçus pour les nouveaux fichiers
    const newPreviews = await Promise.all(files.map(generateFilePreview));
    setFilePreviews(prev => [...prev, ...newPreviews]);

    // Si un Dockerfile est sélectionné, le lire et mettre à jour l'éditeur
    const dockerFile = files.find(f => f.name === 'Dockerfile');
    if (dockerFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setDockerfile(content);
      };
      reader.readAsText(dockerFile);
    }
  };

  const handleFileDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files);
    setBuildContext(prev => [...prev, ...files]);
    
    // Générer les aperçus pour les fichiers déposés
    const newPreviews = await Promise.all(files.map(generateFilePreview));
    setFilePreviews(prev => [...prev, ...newPreviews]);
  };

  const removeFile = (index: number) => {
    setBuildContext(files => files.filter((_, i) => i !== index));
    setFilePreviews(previews => previews.filter((_, i) => i !== index));
  };

  const showFilePreview = (preview: FilePreview) => {
    setSelectedPreview(preview);
    setShowPreviewDialog(true);
  };

  const validateDockerfileContent = (content: string): DockerfileValidationResult => {
    const result: DockerfileValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      securityIssues: []
    };

    // Vérification de la syntaxe de base
    if (!content.trim().startsWith('FROM')) {
      result.errors.push('Dockerfile must start with a FROM instruction');
    }

    // Vérification des bonnes pratiques
    if (content.includes('sudo')) {
      result.securityIssues.push({
        severity: 'high',
        message: 'Avoid using sudo in Dockerfile as it can lead to security issues'
      });
    }

    if (content.includes('apt-get install') && !content.includes('apt-get update')) {
      result.warnings.push('Consider running apt-get update before apt-get install');
    }

    // Vérification des fichiers COPY
    const copyMatches = content.match(/COPY\s+([^\s]+)\s+([^\s]+)/g);
    if (copyMatches) {
      copyMatches.forEach(match => {
        const [_, src] = match.split(/\s+/);
        if (!buildContext.some(f => f.name === src)) {
          result.errors.push(`File "${src}" referenced in COPY instruction is missing`);
        }
      });
    }

    // Suggestions d'optimisation
    if (content.includes('npm install') && !content.includes('package-lock.json')) {
      result.suggestions.push('Consider copying package-lock.json for more reliable builds');
    }

    if (!content.includes('WORKDIR')) {
      result.suggestions.push('Consider using WORKDIR to set the working directory');
    }

    // Vérifications de sécurité
    if (content.includes('chmod 777')) {
      result.securityIssues.push({
        severity: 'high',
        message: 'Avoid using chmod 777 as it poses security risks'
      });
    }

    if (content.includes('ADD') && !content.includes('.tar')) {
      result.warnings.push('Use COPY instead of ADD for simple file copying');
    }

    result.isValid = result.errors.length === 0;
    return result;
  };

  const addVersion = (fileName: string, version: Omit<FileVersion, 'timestamp'>) => {
    const newVersion: FileVersion = {
      ...version,
      timestamp: Date.now()
    };

    setFileVersions(prev => ({
      ...prev,
      [fileName]: [...(prev[fileName] || []), newVersion]
    }));
  };

  const handleCreateFile = async (name: string, content: string) => {
    const file = new File([content], name, {
      type: 'text/plain',
    });

    setBuildContext(prev => [...prev, file]);
    const preview = await generateFilePreview(file);
    setFilePreviews(prev => [...prev, preview]);

    const change: FileChange = {
      fileName: name,
      type: 'create',
      content,
      timestamp: Date.now()
    };
    
    // setFileChanges(prev => [change, ...prev]);
    // addToHistory(change);

    addVersion(name, {
      content,
      type: 'create',
      description: 'Initial creation'
    });

    if (name === 'Dockerfile') {
      setDockerfile(content);
    }

    toast({
      title: 'File Created',
      description: `${name} has been created successfully`,
    });
  };

  const handleUpdateContent = async (preview: FilePreview, newContent: string) => {
    const newFile = new File([newContent], preview.file.name, {
      type: preview.file.type,
    });

    setBuildContext(files => 
      files.map(f => f.name === preview.file.name ? newFile : f)
    );

    const newPreview = await generateFilePreview(newFile);
    setFilePreviews(previews =>
      previews.map(p => p.file.name === preview.file.name ? newPreview : p)
    );
    setSelectedPreview(newPreview);

    const change: FileChange = {
      fileName: preview.file.name,
      type: 'edit',
      content: newContent,
      previousContent: preview.content,
      timestamp: Date.now()
    };

    // setFileChanges(prev => [change, ...prev]);
    // addToHistory(change);

    addVersion(preview.file.name, {
      content: newContent,
      type: 'edit',
      description: 'Content updated'
    });

    if (preview.file.name === 'Dockerfile') {
      setDockerfile(newContent);
    }
  };

  const renderPreviewDialog = () => {
    if (!selectedPreview) return null;
    
    return (
      <PreviewDialog
        preview={selectedPreview}
        open={showPreviewDialog}
        onOpenChange={setShowPreviewDialog}
        onUpdateContent={handleUpdateContent}
      />
    );
  };

  const handleBuild = async () => {
    if (!dockerfile || !imageName) {
      toast({
        title: 'Validation Error',
        description: 'Please provide both a Dockerfile and an image name',
        variant: 'destructive',
      });
      return;
    }

    const validation = validateDockerfileContent(dockerfile);
    if (!validation.isValid) {
      toast({
        title: 'Validation Error',
        description: 'Please fix the validation errors before building',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Build Started',
      description: 'Building Docker image...',
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    toast({
      title: 'Build Complete',
      description: 'Docker image built successfully',
    });

    if (onImageBuilt) {
      onImageBuilt();
    }
  };

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Build Docker Image</CardTitle>
              <CardDescription>
                Build a Docker image from a Dockerfile and context files
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateFile(true)}
            >
              <FileCode2 className="w-4 h-4 mr-2" />
              New File
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* ... reste du contenu ... */}
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleBuild}
            disabled={!dockerfile || !imageName}
          >
            Build Image
          </Button>
        </CardFooter>
      </Card>

      <CreateFileDialog
        open={showCreateFile}
        onOpenChange={setShowCreateFile}
        onFileCreate={handleCreateFile}
      />
      {renderPreviewDialog()}
    </>
  );
}

function formatFileSize(size: number) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let formattedSize = size;
  let unitIndex = 0;
  while (formattedSize >= 1024 && unitIndex < units.length - 1) {
    formattedSize /= 1024;
    unitIndex++;
  }
  return `${formattedSize.toFixed(2)} ${units[unitIndex]}`;
}
