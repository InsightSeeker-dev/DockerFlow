'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { DockerTemplate, dockerTemplates } from "@/lib/dockerTemplates";
import {
  AlertCircle,
  FileText,
  FolderOpen,
  Save,
  Settings,
  Upload,
  Download,
  File,
  RefreshCw,
  HardDrive,
  Database,
  Lightbulb,
  Shield,
  Undo2,
  Plus,
  Trash2,
  Clock,
  Cpu,
  Loader2,
} from "lucide-react";

// Utility function to determine file type
const getFileType = (fileName: string): 'dockerfile' | 'file' => {
  return fileName.toLowerCase() === 'dockerfile' ? 'dockerfile' : 'file';
};

interface FileEntry {
  id: string;
  name: string;
  content: string;
  type: 'dockerfile' | 'file';
  lastModified: Date;
}

interface BuildConfig {
  imageName: string;
  tag: string;
  platform: string;
  projectFiles: {
    dockerfile: FileEntry | null;
    additionalFiles: FileEntry[];
  };
  buildArgs: Record<string, string>;
  healthcheck: boolean;
  optimizations: {
    compress: boolean;
    cache: boolean;
    multiStage: boolean;
  };
  resources: {
    memory: string;
    cpu: string;
  };
}

interface BuildProgress {
  status: string;
  details?: string;
  error?: string;
  logs: string[];
  percentage?: number;
  missingFiles?: string[];
}

interface UnifiedImageBuilderProps {
  onImageBuilt: () => void;
}

// Utility function to import file
const importFile = async (file: File): Promise<{ success: boolean; file?: FileEntry; error?: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      const fileEntry: FileEntry = {
        id: Math.random().toString(36).substring(2),
        name: file.name,
        content,
        type: getFileType(file.name),
        lastModified: new Date()
      };
      resolve({ success: true, file: fileEntry });
    };
    reader.onerror = () => reject({ success: false, error: reader.error?.message });
    reader.readAsText(file);
  });
};

export default function UnifiedImageBuilder({ onImageBuilt }: UnifiedImageBuilderProps) {
  const [buildConfig, setBuildConfig] = useState<BuildConfig>({
    imageName: '',
    tag: 'latest',
    platform: 'linux/amd64',
    projectFiles: {
      dockerfile: null,
      additionalFiles: []
    },
    buildArgs: {},
    healthcheck: true,
    optimizations: {
      compress: true,
      cache: true,
      multiStage: false
    },
    resources: {
      memory: '2g',
      cpu: '2'
    }
  });

  const [activeFile, setActiveFile] = useState<FileEntry | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [buildProgress, setBuildProgress] = useState<BuildProgress | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [showBuildLogs, setShowBuildLogs] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<DockerTemplate | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const result = await importFile(file);

      if (result.success && result.file) {
        const newFile: FileEntry = result.file;
        
        if (newFile.type === 'dockerfile') {
          setBuildConfig((prev) => ({
            ...prev,
            projectFiles: {
              ...prev.projectFiles,
              dockerfile: newFile
            }
          }));
          setActiveFile(newFile);
        } else {
          setBuildConfig((prev) => ({
            ...prev,
            projectFiles: {
              ...prev.projectFiles,
              additionalFiles: [...prev.projectFiles.additionalFiles, newFile]
            }
          }));
        }

        toast({
          title: 'File Imported',
          description: `Successfully imported ${file.name}`,
        });
      } else {
        toast({
          title: 'Import Failed',
          description: result.error || 'Failed to import file',
          variant: 'destructive',
        });
      }
    }
  };

  const handleTemplateSelect = async (template: DockerTemplate) => {
    setSelectedTemplate(template);

    // Mettre à jour les ressources recommandées
    if (template.recommendations) {
      setBuildConfig(prev => ({
        ...prev,
        resources: {
          memory: template.recommendations?.memory.toLowerCase().replace('mb', 'm').replace('gb', 'g') || prev.resources.memory,
          cpu: template.recommendations?.cpu.split(' ')[0] || prev.resources.cpu
        }
      }));
    }

    // Configurer le multi-stage build si nécessaire
    const isMultiStage = template.dockerfile.includes('AS ') || template.dockerfile.includes('FROM ') && template.dockerfile.split('FROM ').length > 2;
    setBuildConfig(prev => ({
      ...prev,
      optimizations: {
        ...prev.optimizations,
        multiStage: isMultiStage
      }
    }));

    // Créer le Dockerfile avec les propriétés requises
    const dockerfile: FileEntry = {
      id: Math.random().toString(36).substring(2),
      name: 'Dockerfile',
      content: template.dockerfile,
      type: 'dockerfile',
      lastModified: new Date()
    };

    // Créer tous les fichiers par défaut avec les propriétés requises
    const additionalFiles: FileEntry[] = template.defaultFiles.map(file => ({
      id: Math.random().toString(36).substring(2),
      name: file.name,
      content: file.content,
      type: getFileType(file.name),
      lastModified: new Date()
    }));

    // Mettre à jour la configuration
    setBuildConfig(prev => ({
      ...prev,
      projectFiles: {
        dockerfile,
        additionalFiles
      }
    }));

    // Configurer les variables d'environnement requises
    const requiredEnvVars = template.environmentVariables
      .filter(env => env.required)
      .reduce((acc, env) => ({
        ...acc,
        [env.name]: env.defaultValue || ''
      }), {});

    if (Object.keys(requiredEnvVars).length > 0) {
      setBuildConfig(prev => ({
        ...prev,
        buildArgs: {
          ...prev.buildArgs,
          ...requiredEnvVars
        }
      }));
    }

    // Fermer le dialog
    setShowTemplateDialog(false);

    // Notification de succès
    toast({
      title: 'Template appliqué',
      description: `Le template ${template.name} a été appliqué avec succès.`,
    });
  };

  const handleFileDelete = (file: FileEntry) => {
    if (file.type === 'dockerfile') {
      setBuildConfig((prev) => ({
        ...prev,
        projectFiles: {
          ...prev.projectFiles,
          dockerfile: null
        }
      }));
      if (activeFile?.id === file.id) {
        setActiveFile(null);
      }
    } else {
      setBuildConfig((prev) => ({
        ...prev,
        projectFiles: {
          ...prev.projectFiles,
          additionalFiles: prev.projectFiles.additionalFiles.filter(f => f.id !== file.id)
        }
      }));
      if (activeFile?.id === file.id) {
        setActiveFile(null);
      }
    }
  };

  const handleFileContentChange = (content: string) => {
    if (!activeFile) return;

    if (activeFile.type === 'dockerfile') {
      const updatedFile: FileEntry = {
        ...activeFile,
        content,
        lastModified: new Date()
      };
      setBuildConfig((prev) => ({
        ...prev,
        projectFiles: {
          ...prev.projectFiles,
          dockerfile: updatedFile
        }
      }));
      setActiveFile(updatedFile);
    } else {
      const updatedFile: FileEntry = {
        ...activeFile,
        content,
        lastModified: new Date()
      };
      setBuildConfig((prev) => ({
        ...prev,
        projectFiles: {
          ...prev.projectFiles,
          additionalFiles: prev.projectFiles.additionalFiles.map(f =>
            f.id === activeFile.id ? updatedFile : f
          )
        }
      }));
      setActiveFile(updatedFile);
    }
  };

  const handleBuild = async () => {
    if (!buildConfig.projectFiles.dockerfile) {
      toast({
        title: 'Error',
        description: 'No Dockerfile selected',
        variant: 'destructive',
      });
      return;
    }

    if (!buildConfig.imageName || !buildConfig.tag) {
      toast({
        title: 'Error',
        description: 'Image name and tag are required',
        variant: 'destructive',
      });
      return;
    }

    setIsBuilding(true);
    setBuildProgress({ 
      status: 'Preparing build context...',
      logs: [],
      percentage: 0
    });

    try {
      // Vérifier les fichiers manquants
      const missingFiles = findMissingFiles(buildConfig.projectFiles.dockerfile.content, buildConfig.projectFiles.additionalFiles);
      if (missingFiles.length > 0) {
        setBuildProgress(prev => ({
          ...prev!,
          status: 'Missing files detected',
          error: `Missing files referenced in Dockerfile: ${missingFiles.join(', ')}`,
          missingFiles,
          percentage: 0
        }));
        throw new Error(`Missing files referenced in Dockerfile: ${missingFiles.join(', ')}`);
      }

      // Préparation du build context
      setBuildProgress(prev => ({
        ...prev!,
        status: 'Preparing files...',
        logs: [...prev!.logs, 'Preparing files for build...'],
        percentage: 10
      }));

      const formData = new FormData();
      formData.append('imageName', buildConfig.imageName);
      formData.append('tag', buildConfig.tag);
      formData.append('platform', buildConfig.platform);

      // Ajouter le Dockerfile
      const dockerfileBlob = new Blob([buildConfig.projectFiles.dockerfile.content], { type: 'text/plain' });
      formData.append('dockerfile', dockerfileBlob, 'Dockerfile');

      // Ajouter les fichiers additionnels
      buildConfig.projectFiles.additionalFiles.forEach(file => {
        const blob = new Blob([file.content], { type: 'text/plain' });
        formData.append('context', blob, file.name);
      });

      setBuildProgress(prev => ({
        ...prev!,
        status: 'Sending build request...',
        logs: [...prev!.logs, 'Sending files to server...'],
        percentage: 20
      }));

      const response = await fetch('/api/admin/images/build', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setBuildProgress(prev => ({
        ...prev!,
        status: 'Build in progress...',
        logs: [...prev!.logs, 'Starting build...'],
        percentage: 30
      }));

      // Suivre le progrès avec SSE
      const eventSource = new EventSource(`/api/admin/images/build/${buildConfig.imageName}/status`);
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.error) {
            throw new Error(data.error);
          }

          // Calculer le pourcentage approximatif basé sur les étapes
          let percentage = 30;
          if (data.status.includes('Downloading')) percentage = 40;
          if (data.status.includes('Extracting')) percentage = 60;
          if (data.status.includes('Building')) percentage = 80;
          if (data.status.includes('completed')) percentage = 100;

          setBuildProgress(prev => ({
            ...prev!,
            status: data.status,
            details: data.details,
            logs: [...prev!.logs, ` ${data.status}`],
            percentage
          }));
          
          if (data.status === 'completed') {
            eventSource.close();
            setIsBuilding(false);
            toast({
              title: 'Build Successful',
              description: `Image ${buildConfig.imageName}:${buildConfig.tag} built successfully`,
              variant: 'default',
            });
            onImageBuilt();
          }
        } catch (error) {
          eventSource.close();
          setIsBuilding(false);
          setBuildProgress(prev => ({
            ...prev!,
            status: 'Error',
            error: error instanceof Error ? error.message : 'An unknown error occurred',
            logs: [...prev!.logs, ` Error: ${error instanceof Error ? error.message : 'An unknown error occurred'}`],
            percentage: 0
          }));
          toast({
            title: 'Build Failed',
            description: error instanceof Error ? error.message : 'An unknown error occurred',
            variant: 'destructive',
          });
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        setIsBuilding(false);
        setBuildProgress(prev => ({
          ...prev!,
          status: 'Error',
          error: 'Connection to build process lost',
          logs: [...prev!.logs, ' Error: Connection to build process lost'],
          percentage: 0
        }));
        toast({
          title: 'Build Failed',
          description: 'Connection to build process lost',
          variant: 'destructive',
        });
      };

    } catch (error) {
      setIsBuilding(false);
      setBuildProgress(prev => ({
        ...prev!,
        status: 'Error',
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        logs: [...prev!.logs, ` Error: ${error instanceof Error ? error.message : 'An unknown error occurred'}`],
        percentage: 0
      }));
      toast({
        title: 'Build Failed',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (buildProgress?.logs.length) {
      logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [buildProgress?.logs]);

  // Fonction utilitaire pour trouver les fichiers manquants référencés dans le Dockerfile
  const findMissingFiles = (dockerfileContent: string, additionalFiles: FileEntry[]): string[] => {
    const missingFiles: string[] = [];
    const copyCommands = dockerfileContent.match(/COPY\s+([^\n]+)/g) || [];
    
    copyCommands.forEach(command => {
      const parts = command.split(/\s+/).slice(1); // Ignorer le mot-clé COPY
      const sources = parts.slice(0, -1); // Le dernier élément est la destination
      
      sources.forEach(source => {
        // Ignorer les wildcards et les chemins de destination
        if (!source.includes('*') && !source.startsWith('/')) {
          const fileExists = additionalFiles.some(file => file.name === source);
          if (!fileExists) {
            missingFiles.push(source);
          }
        }
      });
    });
    
    return missingFiles;
  };

  return (
    <Card className="w-full h-full min-h-[600px] max-h-screen flex flex-col overflow-hidden">
      <CardHeader className="flex-none">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle>Build Image</CardTitle>
            <CardDescription>
              Develop and manage your Docker image build environment
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              Import Files
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTemplateDialog(true)}
            >
              <FileText className="w-4 h-4 mr-2" />
              Templates
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
        {/* Left Panel - File Explorer */}
        <div className="w-full lg:w-64 flex-none border rounded-lg overflow-hidden flex flex-col">
          <div className="p-4 space-y-4 flex-none">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="imageName">Image Name</Label>
                <Input
                  id="imageName"
                  value={buildConfig.imageName}
                  onChange={(e) => setBuildConfig(prev => ({ ...prev, imageName: e.target.value }))}
                  placeholder="e.g., myapp"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tag">Tag</Label>
                <Input
                  id="tag"
                  value={buildConfig.tag}
                  onChange={(e) => setBuildConfig(prev => ({ ...prev, tag: e.target.value }))}
                  placeholder="e.g., latest"
                />
              </div>
            </div>

            <Separator />

            <div className="font-semibold flex items-center justify-between">
              <span>Files</span>
              <Button variant="ghost" size="sm" onClick={() => setShowTemplateDialog(true)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4 space-y-2">
              {buildConfig.projectFiles.dockerfile && (
                <div
                  className={`flex items-center justify-between p-2 rounded-md cursor-pointer ${
                    activeFile?.id === buildConfig.projectFiles.dockerfile.id
                      ? 'bg-secondary'
                      : 'hover:bg-secondary/50'
                  }`}
                  onClick={() => setActiveFile(buildConfig.projectFiles.dockerfile)}
                >
                  <div className="flex items-center">
                    <FileText className="w-4 h-4 mr-2" />
                    <span className="truncate">Dockerfile</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteDialog(true);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
              
              {buildConfig.projectFiles.additionalFiles.map((file) => (
                <div
                  key={file.id}
                  className={`flex items-center justify-between p-2 rounded-md cursor-pointer ${
                    activeFile?.id === file.id
                      ? 'bg-secondary'
                      : 'hover:bg-secondary/50'
                  }`}
                  onClick={() => setActiveFile(file)}
                >
                  <div className="flex items-center min-w-0">
                    <File className="w-4 h-4 mr-2 flex-none" />
                    <span className="truncate">{file.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-none"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFileDelete(file);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="p-4 flex-none space-y-2">
            <Button 
              className="w-full"
              onClick={handleBuild}
              disabled={!buildConfig.projectFiles.dockerfile || !buildConfig.imageName || !buildConfig.tag || isBuilding}
            >
              {isBuilding ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Build en cours...
                </>
              ) : (
                <>
                  <HardDrive className="w-4 h-4 mr-2" />
                  Build Image
                </>
              )}
            </Button>

            {buildProgress && (
              <div className="space-y-2">
                {/* Barre de progression */}
                {buildProgress.percentage !== undefined && (
                  <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full transition-all duration-300",
                        buildProgress.error 
                          ? "bg-destructive" 
                          : buildProgress.percentage === 100 
                            ? "bg-green-500"
                            : "bg-primary"
                      )}
                      style={{ width: `${buildProgress.percentage}%` }}
                    />
                  </div>
                )}

                {/* Status et détails */}
                <div className={cn(
                  "text-sm p-3 rounded-lg",
                  buildProgress.error 
                    ? "bg-destructive/10 text-destructive"
                    : "bg-muted text-muted-foreground"
                )}>
                  <div className="font-medium flex items-center justify-between">
                    <span>{buildProgress.status}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      onClick={() => setShowBuildLogs(!showBuildLogs)}
                    >
                      {showBuildLogs ? 'Masquer' : 'Voir les logs'}
                    </Button>
                  </div>

                  {buildProgress.details && (
                    <div className="text-xs mt-1">{buildProgress.details}</div>
                  )}

                  {buildProgress.error && (
                    <div className="text-xs mt-1 text-destructive font-medium">
                      {buildProgress.error}
                    </div>
                  )}

                  {/* Fichiers manquants */}
                  {buildProgress.missingFiles && buildProgress.missingFiles.length > 0 && (
                    <div className="mt-2 text-xs">
                      <div className="font-medium text-destructive">Fichiers manquants :</div>
                      <ul className="list-disc list-inside mt-1">
                        {buildProgress.missingFiles.map((file, index) => (
                          <li key={index}>{file}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Logs du build */}
                  {showBuildLogs && buildProgress.logs.length > 0 && (
                    <div className="mt-2 bg-background/50 rounded p-2 max-h-48 overflow-y-auto text-xs font-mono">
                      {buildProgress.logs.map((log, index) => (
                        <div key={index} className="py-0.5">{log}</div>
                      ))}
                      <div ref={logsEndRef} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Editor */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {activeFile ? (
            <>
              <div className="flex items-center justify-between mb-4 flex-none">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold">{activeFile.name}</span>
                  <span className="text-sm text-muted-foreground">
                    Last modified: {activeFile.lastModified.toLocaleString()}
                  </span>
                </div>
              </div>
              <Textarea
                value={activeFile.content}
                onChange={(e) => handleFileContentChange(e.target.value)}
                className="flex-1 min-h-0 font-mono resize-none"
              />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <FileText className="w-12 h-12 mb-4" />
              <p>Select a file to edit or create a new one</p>
              <div className="flex flex-wrap justify-center gap-4 mt-4">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Import Files
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowTemplateDialog(true)}
                >
                  Use Template
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Configuration du build */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Configuration du Build</h3>
          
          {/* Options d'optimisation */}
          <div className="bg-muted/50 p-3 rounded-lg space-y-2">
            <h4 className="text-sm font-medium">Optimisations</h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="compress"
                  checked={buildConfig.optimizations.compress}
                  onCheckedChange={(checked) => 
                    setBuildConfig(prev => ({
                      ...prev,
                      optimizations: {
                        ...prev.optimizations,
                        compress: checked as boolean
                      }
                    }))
                  }
                />
                <label htmlFor="compress" className="text-sm">
                  Compression
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="cache"
                  checked={buildConfig.optimizations.cache}
                  onCheckedChange={(checked) => 
                    setBuildConfig(prev => ({
                      ...prev,
                      optimizations: {
                        ...prev.optimizations,
                        cache: checked as boolean
                      }
                    }))
                  }
                />
                <label htmlFor="cache" className="text-sm">
                  Cache Build
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="multiStage"
                  checked={buildConfig.optimizations.multiStage}
                  onCheckedChange={(checked) => 
                    setBuildConfig(prev => ({
                      ...prev,
                      optimizations: {
                        ...prev.optimizations,
                        multiStage: checked as boolean
                      }
                    }))
                  }
                />
                <label htmlFor="multiStage" className="text-sm">
                  Multi-stage Build
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="healthcheck"
                  checked={buildConfig.healthcheck}
                  onCheckedChange={(checked) => 
                    setBuildConfig(prev => ({
                      ...prev,
                      healthcheck: checked as boolean
                    }))
                  }
                />
                <label htmlFor="healthcheck" className="text-sm">
                  Healthcheck
                </label>
              </div>
            </div>
          </div>

          {/* Ressources */}
          <div className="bg-muted/50 p-3 rounded-lg space-y-2">
            <h4 className="text-sm font-medium">Ressources</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="memory">Mémoire</Label>
                <Select
                  value={buildConfig.resources.memory}
                  onValueChange={(value) =>
                    setBuildConfig(prev => ({
                      ...prev,
                      resources: {
                        ...prev.resources,
                        memory: value
                      }
                    }))
                  }
                >
                  <SelectTrigger id="memory">
                    <SelectValue placeholder="Sélectionner la mémoire" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="512m">512 MB</SelectItem>
                    <SelectItem value="1g">1 GB</SelectItem>
                    <SelectItem value="2g">2 GB</SelectItem>
                    <SelectItem value="4g">4 GB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="cpu">CPU</Label>
                <Select
                  value={buildConfig.resources.cpu}
                  onValueChange={(value) =>
                    setBuildConfig(prev => ({
                      ...prev,
                      resources: {
                        ...prev.resources,
                        cpu: value
                      }
                    }))
                  }
                >
                  <SelectTrigger id="cpu">
                    <SelectValue placeholder="Sélectionner les CPU" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.5">0.5 CPU</SelectItem>
                    <SelectItem value="1">1 CPU</SelectItem>
                    <SelectItem value="2">2 CPU</SelectItem>
                    <SelectItem value="4">4 CPU</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Build Arguments */}
          <div className="bg-muted/50 p-3 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Arguments de Build</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const key = prompt('Nom de l\'argument');
                  const value = prompt('Valeur de l\'argument');
                  if (key && value) {
                    setBuildConfig(prev => ({
                      ...prev,
                      buildArgs: {
                        ...prev.buildArgs,
                        [key]: value
                      }
                    }));
                  }
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {Object.entries(buildConfig.buildArgs).map(([key, value]) => (
              <div key={key} className="flex items-center space-x-2">
                <Input
                  value={key}
                  readOnly
                  className="flex-1"
                />
                <Input
                  value={value}
                  onChange={(e) =>
                    setBuildConfig(prev => ({
                      ...prev,
                      buildArgs: {
                        ...prev.buildArgs,
                        [key]: e.target.value
                      }
                    }))
                  }
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setBuildConfig(prev => {
                      const newArgs = { ...prev.buildArgs };
                      delete newArgs[key];
                      return {
                        ...prev,
                        buildArgs: newArgs
                      };
                    })
                  }
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </CardContent>

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        multiple
        onChange={handleFileImport}
      />

      <AlertDialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <AlertDialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <AlertDialogHeader className="flex-none">
            <AlertDialogTitle>Choose a Template</AlertDialogTitle>
            <AlertDialogDescription>
              Select a template to start with or create a new Dockerfile from scratch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ScrollArea className="flex-1 min-h-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {dockerTemplates.map((template) => (
                <Card
                  key={template.id}
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-md",
                    selectedTemplate?.id === template.id && "border-primary"
                  )}
                  onClick={() => handleTemplateSelect(template)}
                >
                  <CardHeader>
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">{template.icon}</span>
                      <div>
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge variant={
                            template.difficulty === 'Beginner' ? 'default' :
                            template.difficulty === 'Intermediate' ? 'secondary' :
                            'destructive'
                          }>
                            {template.difficulty}
                          </Badge>
                          <Badge variant="outline">{template.category}</Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {template.description}
                    </p>
                    
                    <div className="space-y-2">
                      <div className="flex items-center text-sm">
                        <Clock className="w-4 h-4 mr-2" />
                        <span>{template.estimatedBuildTime}</span>
                      </div>

                      {template.recommendations && (
                        <div className="space-y-1">
                          <span className="text-sm font-medium">Recommandations :</span>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            <li className="flex items-center">
                              <Cpu className="w-3 h-3 mr-1" />
                              CPU: {template.recommendations.cpu}
                            </li>
                            <li className="flex items-center">
                              <HardDrive className="w-3 h-3 mr-1" />
                              RAM: {template.recommendations.memory}
                            </li>
                            <li className="flex items-center">
                              <Database className="w-3 h-3 mr-1" />
                              Disque: {template.recommendations.disk}
                            </li>
                          </ul>
                        </div>
                      )}

                      {template.ports.length > 0 && (
                        <div>
                          <span className="text-sm font-medium">Ports exposés :</span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {template.ports.map((port, index) => (
                              <Badge key={index} variant="secondary">
                                {port.container}:{port.host}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {template.environmentVariables.length > 0 && (
                        <div>
                          <span className="text-sm font-medium">Variables d'environnement :</span>
                          <ul className="text-sm text-muted-foreground mt-1">
                            {template.environmentVariables
                              .filter(env => env.required)
                              .map((env, index) => (
                                <li key={index} className="flex items-center">
                                  <span className="font-mono">{env.name}</span>
                                  {env.required && <span className="text-destructive ml-1">*</span>}
                                </li>
                              ))}
                          </ul>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1 mt-2">
                        {template.tags.map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
          <AlertDialogFooter className="flex-none">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this file? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (activeFile) {
                  handleFileDelete(activeFile);
                }
                setShowDeleteDialog(false);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
