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
  CheckCircle,
  File,
  FileText,
  FolderOpen,
  HardDrive,
  Database,
  Lightbulb,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Shield,
  Trash2,
  Undo2,
  Upload,
  Download,
  Clock,
  Cpu,
  X,
  Pencil
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  projectFiles: {
    dockerfile: FileEntry | null;
    additionalFiles: FileEntry[];
  };
  buildArgs: Record<string, string>;
}

interface BuildProgress {
  status: string;
  error?: string;
  logs: string[];
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

// Fonction de build d'image
const buildImage = async (
  files: { dockerfile: FileEntry; additionalFiles: FileEntry[] },
  config: BuildConfig,
  updateLogs: (log: string) => void
): Promise<{ success: boolean; error?: string }> => {
  try {
    updateLogs("Démarrage du build...");

    const formData = new FormData();
    formData.append('imageName', config.imageName);
    formData.append('tag', config.tag);

    const dockerfileBlob = new Blob([files.dockerfile.content], { type: 'text/plain' });
    formData.append('dockerfile', dockerfileBlob, 'Dockerfile');

    files.additionalFiles.forEach(file => {
      const blob = new Blob([file.content], { type: 'text/plain' });
      formData.append('files', blob, file.name);
    });

    const response = await fetch('/api/admin/images/build', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    updateLogs("Build terminé avec succès");
    return { success: true };
  } catch (error) {
    updateLogs(`Erreur: ${error instanceof Error ? error.message : "Erreur inconnue"}`);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Une erreur inconnue est survenue"
    };
  }
};

export default function UnifiedImageBuilder({ onImageBuilt }: UnifiedImageBuilderProps) {
  const [buildConfig, setBuildConfig] = useState<BuildConfig>({
    imageName: '',
    tag: 'latest',
    projectFiles: {
      dockerfile: null,
      additionalFiles: []
    },
    buildArgs: {}
  });

  const [activeFile, setActiveFile] = useState<FileEntry | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [buildProgress, setBuildProgress] = useState<BuildProgress | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [showBuildLogs, setShowBuildLogs] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<DockerTemplate | null>(null);

  const [selectedFile, setSelectedFile] = useState<{
    type: 'dockerfile' | 'additional';
    index?: number;
    content: string;
    name: string;
  } | null>(null);

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

    const dockerfile: FileEntry = {
      id: Math.random().toString(36).substring(2),
      name: 'Dockerfile',
      content: template.dockerfile,
      type: 'dockerfile',
      lastModified: new Date()
    };

    const additionalFiles: FileEntry[] = template.defaultFiles.map(file => ({
      id: Math.random().toString(36).substring(2),
      name: file.name,
      content: file.content,
      type: getFileType(file.name),
      lastModified: new Date()
    }));

    setBuildConfig(prev => ({
      ...prev,
      projectFiles: {
        dockerfile,
        additionalFiles
      }
    }));

    setShowTemplateDialog(false);

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

  const handleFileEdit = (type: 'dockerfile' | 'additional', index?: number) => {
    if (type === 'dockerfile' && buildConfig.projectFiles.dockerfile) {
      setSelectedFile({
        type,
        content: buildConfig.projectFiles.dockerfile.content,
        name: 'Dockerfile'
      });
    } else if (type === 'additional' && typeof index === 'number') {
      const file = buildConfig.projectFiles.additionalFiles[index];
      setSelectedFile({
        type,
        index,
        content: file.content,
        name: file.name
      });
    }
  };

  const handleFileContentSave = (content: string) => {
    if (!selectedFile) return;

    if (selectedFile.type === 'dockerfile') {
      setBuildConfig(prev => ({
        ...prev,
        projectFiles: {
          ...prev.projectFiles,
          dockerfile: {
            ...prev.projectFiles.dockerfile!,
            content,
            lastModified: new Date()
          }
        }
      }));
    } else {
      setBuildConfig(prev => ({
        ...prev,
        projectFiles: {
          ...prev.projectFiles,
          additionalFiles: prev.projectFiles.additionalFiles.map((file, idx) =>
            idx === selectedFile.index
              ? { ...file, content, lastModified: new Date() }
              : file
          )
        }
      }));
    }
  };

  const handleFileRename = (newName: string) => {
    if (!selectedFile) return;

    if (selectedFile.type === 'additional' && typeof selectedFile.index === 'number') {
      setBuildConfig(prev => ({
        ...prev,
        projectFiles: {
          ...prev.projectFiles,
          additionalFiles: prev.projectFiles.additionalFiles.map((file, idx) =>
            idx === selectedFile.index
              ? { ...file, name: newName }
              : file
          )
        }
      }));
    }
  };

  const handleBuild = async () => {
    if (!buildConfig.projectFiles.dockerfile) {
      toast({
        title: "Erreur",
        description: "Veuillez d'abord sélectionner ou créer un Dockerfile",
        variant: "destructive",
      });
      return;
    }

    if (!buildConfig.imageName) {
      toast({
        title: "Erreur",
        description: "Le nom de l'image est requis",
        variant: "destructive",
      });
      return;
    }

    setIsBuilding(true);
    setBuildProgress({
      status: 'Construction en cours...',
      logs: [
        '🚀 Démarrage du processus de build...',
        '📦 Préparation des fichiers...'
      ]
    });

    try {
      // Préparation des fichiers
      const formData = new FormData();
      
      // Ajout des informations de base
      formData.append('hasDockerfile', 'true');
      formData.append('tag', buildConfig.tag || 'latest');
      formData.append('imageName', buildConfig.imageName);
      
      setBuildProgress(prev => ({
        ...prev!,
        logs: [...prev!.logs, '📝 Configuration du build...']
      }));

      // Ajout du Dockerfile
      const dockerfileBlob = new Blob([buildConfig.projectFiles.dockerfile.content], { type: 'text/plain' });
      formData.append('dockerfile', dockerfileBlob, 'Dockerfile');

      setBuildProgress(prev => ({
        ...prev!,
        logs: [...prev!.logs, '📄 Dockerfile ajouté au contexte']
      }));

      // Ajout des fichiers additionnels
      if (buildConfig.projectFiles.additionalFiles.length > 0) {
        setBuildProgress(prev => ({
          ...prev!,
          logs: [...prev!.logs, '📁 Ajout des fichiers additionnels...']
        }));

        buildConfig.projectFiles.additionalFiles.forEach(file => {
          const blob = new Blob([file.content], { type: 'text/plain' });
          formData.append('files', blob, file.name);
          setBuildProgress(prev => ({
            ...prev!,
            logs: [...prev!.logs, `  ↳ ${file.name} ajouté`]
          }));
        });
      }

      // Ajout du nombre de fichiers
      formData.append('contextFilesCount', buildConfig.projectFiles.additionalFiles.length.toString());

      setBuildProgress(prev => ({
        ...prev!,
        logs: [...prev!.logs, '🔄 Envoi des fichiers au serveur...']
      }));

      // Envoi de la requête
      const response = await fetch('/api/admin/images/build', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      setBuildProgress(prev => ({
        ...prev!,
        logs: [...prev!.logs, '⚙️ Build en cours...']
      }));

      const buildResult = await response.json();

      if (buildResult.success) {
        setBuildProgress({
          status: 'Build terminé',
          logs: [
            ...buildProgress?.logs || [],
            '✨ Build terminé avec succès',
            `🏷️ Image créée : ${buildConfig.imageName}:${buildConfig.tag || 'latest'}`,
            '✅ Processus terminé'
          ]
        });

        toast({
          title: "Succès",
          description: `L'image ${buildConfig.imageName}:${buildConfig.tag || 'latest'} a été construite avec succès`,
        });

        onImageBuilt();
      } else {
        throw new Error(buildResult.error || 'Erreur lors du build');
      }
    } catch (error) {
      console.error('Build error:', error);
      setBuildProgress({
        status: 'Erreur',
        error: error instanceof Error ? error.message : "Une erreur est survenue",
        logs: [
          ...buildProgress?.logs || [],
          '❌ Une erreur est survenue pendant le build',
          `⚠️ ${error instanceof Error ? error.message : "Erreur inconnue"}`
        ]
      });

      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsBuilding(false);
    }
  };

  useEffect(() => {
    if (buildProgress?.logs.length) {
      logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [buildProgress?.logs]);

  return (
    <Card className="w-full h-full min-h-[600px] max-h-screen flex flex-col overflow-hidden">
      <div className="space-y-4 p-4">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold">Build Image</h2>
            <p className="text-sm text-muted-foreground">
              Develop and manage your Docker image build environment
            </p>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" />
              Import Files
            </Button>
            <Button variant="outline" onClick={() => setShowTemplateDialog(true)}>
              <FileText className="w-4 h-4 mr-2" />
              Templates
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4">
          {/* Left Panel - Configuration */}
          <div className="col-span-3 space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Image Name</Label>
                <Input
                  placeholder="ex: my-app"
                  value={buildConfig.imageName}
                  onChange={(e) => setBuildConfig(prev => ({
                    ...prev,
                    imageName: e.target.value
                  }))}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>Tag</Label>
                <Input
                  placeholder="latest"
                  value={buildConfig.tag}
                  onChange={(e) => setBuildConfig(prev => ({
                    ...prev,
                    tag: e.target.value
                  }))}
                  className="bg-background"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center justify-between">
                <span>Files</span>
                <Badge variant="outline" className="bg-background">
                  {buildConfig.projectFiles.additionalFiles.length + (buildConfig.projectFiles.dockerfile ? 1 : 0)} files
                </Badge>
              </Label>
              <ScrollArea className="h-[300px] w-full rounded-md border bg-background p-2">
                <div className="space-y-2">
                  {/* Dockerfile */}
                  {buildConfig.projectFiles.dockerfile && (
                    <div className="flex items-center justify-between p-2 rounded-md hover:bg-accent group">
                      <div 
                        className="flex items-center space-x-2 flex-1 cursor-pointer"
                        onClick={() => handleFileEdit('dockerfile')}
                      >
                        <FileText className="w-4 h-4 text-blue-500" />
                        <span>Dockerfile</span>
                      </div>
                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleFileEdit('dockerfile')}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setBuildConfig(prev => ({
                              ...prev,
                              projectFiles: {
                                ...prev.projectFiles,
                                dockerfile: null
                              }
                            }));
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Additional Files */}
                  {buildConfig.projectFiles.additionalFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 rounded-md hover:bg-accent group">
                      <div 
                        className="flex items-center space-x-2 flex-1 cursor-pointer"
                        onClick={() => handleFileEdit('additional', index)}
                      >
                        <File className="w-4 h-4" />
                        <span>{file.name}</span>
                      </div>
                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleFileEdit('additional', index)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newName = prompt('Nouveau nom du fichier:', file.name);
                            if (newName && newName !== file.name) {
                              handleFileRename(newName);
                            }
                          }}
                        >
                          <FileText className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setBuildConfig(prev => ({
                              ...prev,
                              projectFiles: {
                                ...prev.projectFiles,
                                additionalFiles: prev.projectFiles.additionalFiles.filter((_, i) => i !== index)
                              }
                            }));
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Right Panel - Build Logs */}
          <div className="col-span-9">
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg font-bold">Build Logs</CardTitle>
                <div className="flex items-center space-x-2">
                  {isBuilding ? (
                    <Badge variant="outline" className="bg-blue-50">
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Building
                    </Badge>
                  ) : buildProgress?.status === 'Erreur' ? (
                    <Badge variant="outline" className="bg-red-50 text-red-600">
                      <AlertCircle className="w-4 h-4 mr-2" />
                      Error
                    </Badge>
                  ) : buildProgress?.status === 'Build terminé' ? (
                    <Badge variant="outline" className="bg-green-50 text-green-600">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Complete
                    </Badge>
                  ) : null}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setBuildConfig({
                        imageName: '',
                        tag: 'latest',
                        projectFiles: {
                          dockerfile: null,
                          additionalFiles: []
                        },
                        buildArgs: {}
                      });
                      setBuildProgress(null);
                    }}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reset
                  </Button>
                  <Button
                    onClick={handleBuild}
                    disabled={isBuilding || !buildConfig.projectFiles.dockerfile}
                    className="bg-blue-600 text-white hover:bg-blue-700"
                  >
                    {isBuilding ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Building...
                      </>
                    ) : (
                      <>
                        <Settings className="w-4 h-4 mr-2" />
                        Build Image
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px] w-full rounded-md border bg-background p-4">
                  <div className="space-y-2 font-mono text-sm">
                    {!buildProgress?.logs.length ? (
                      <div className="text-muted-foreground text-center py-4">
                        No logs available. Start a build to see logs here.
                      </div>
                    ) : (
                      buildProgress.logs.map((log, index) => (
                        <div
                          key={index}
                          className={cn(
                            "py-1",
                            log.includes("Erreur") ? "text-red-500" :
                            log.includes("terminé") ? "text-green-500" :
                            log.includes("étape") ? "text-blue-500" :
                            "text-foreground"
                          )}
                        >
                          {log}
                        </div>
                      ))
                    )}
                    {buildProgress?.error && (
                      <div className="mt-4 p-4 rounded-md bg-red-50 text-red-500 border border-red-200">
                        <div className="font-bold mb-2">Error:</div>
                        <div className="whitespace-pre-wrap">{buildProgress.error}</div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

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

      <Dialog open={!!selectedFile} onOpenChange={() => setSelectedFile(null)}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {selectedFile?.type === 'dockerfile' ? (
                  <FileText className="w-5 h-5 text-blue-500" />
                ) : (
                  <File className="w-5 h-5" />
                )}
                <span>{selectedFile?.name}</span>
              </div>
              {selectedFile?.type === 'additional' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newName = prompt('Nouveau nom du fichier:', selectedFile.name);
                    if (newName && newName !== selectedFile.name) {
                      handleFileRename(newName);
                    }
                  }}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Renommer
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 mt-4">
            <Textarea
              value={selectedFile?.content || ''}
              onChange={(e) => handleFileContentSave(e.target.value)}
              className="h-full font-mono resize-none"
              placeholder="Contenu du fichier..."
            />
          </div>
        </DialogContent>
      </Dialog>

    </Card>
  );
};
