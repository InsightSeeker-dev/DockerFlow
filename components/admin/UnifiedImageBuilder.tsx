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
  Pencil,
  Terminal,
  ArrowUpDown,
  RotateCcw,
  Hammer
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import Editor from "@monaco-editor/react";

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

interface BuildOptions {
  cache: boolean;
  platform: string;
  compress: boolean;
  pull: boolean;
}

interface BuildConfig {
  imageName: string;
  tag: string;
  projectFiles: {
    dockerfile: FileEntry | null;
    additionalFiles: FileEntry[];
  };
  buildArgs: Record<string, string>;
  options: BuildOptions;
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

const defaultBuildConfig: BuildConfig = {
  imageName: '',
  tag: 'latest',
  projectFiles: {
    dockerfile: null,
    additionalFiles: []
  },
  buildArgs: {},
  options: {
    cache: true,
    platform: 'linux/amd64',
    compress: true,
    pull: true
  }
};

const UnifiedImageBuilder: React.FC<UnifiedImageBuilderProps> = ({ onImageBuilt }) => {
  const [buildConfig, setBuildConfig] = useState<BuildConfig>(defaultBuildConfig);
  const [activeFile, setActiveFile] = useState<FileEntry | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [buildProgress, setBuildProgress] = useState<BuildProgress | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildLogs, setBuildLogs] = useState<string[]>([]);
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

    // Afficher les recommandations si disponibles
    if (template.recommendations) {
      toast({
        title: "Recommandations pour ce template",
        description: (
          <div className="space-y-2">
            {template.recommendations.memory && (
              <p>Mémoire recommandée: {template.recommendations.memory}</p>
            )}
            {template.recommendations.cpu && (
              <p>CPU recommandé: {template.recommendations.cpu}</p>
            )}
            {template.recommendations.storage && (
              <p>Stockage recommandé: {template.recommendations.storage}</p>
            )}
          </div>
        ),
      });
    }

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

  const handleFileContentSave = (content: string) => {
    if (!selectedFile) return;

    if (selectedFile.type === 'dockerfile') {
      const updatedFile: FileEntry = {
        id: buildConfig.projectFiles.dockerfile?.id || Math.random().toString(36).substring(2),
        name: 'Dockerfile',
        content: content,
        type: 'dockerfile',
        lastModified: new Date()
      };

      setBuildConfig(prev => ({
        ...prev,
        projectFiles: {
          ...prev.projectFiles,
          dockerfile: updatedFile
        }
      }));

      toast({
        title: "Fichier modifié",
        description: "Le Dockerfile a été mis à jour avec succès",
      });
    } else if (selectedFile.type === 'additional' && typeof selectedFile.index === 'number') {
      const updatedFiles = [...buildConfig.projectFiles.additionalFiles];
      const updatedFile: FileEntry = {
        id: updatedFiles[selectedFile.index]?.id || Math.random().toString(36).substring(2),
        name: selectedFile.name,
        content: content,
        type: 'file',
        lastModified: new Date()
      };
      updatedFiles[selectedFile.index] = updatedFile;

      setBuildConfig(prev => ({
        ...prev,
        projectFiles: {
          ...prev.projectFiles,
          additionalFiles: updatedFiles
        }
      }));

      toast({
        title: "Fichier modifié",
        description: `Le fichier ${selectedFile.name} a été mis à jour avec succès`,
      });
    }
  };

  const handleFileRename = async (fileIndex: number, currentName: string) => {
    const newName = await new Promise<string | null>((resolve) => {
      const result = window.prompt('Entrez le nouveau nom du fichier:', currentName);
      resolve(result);
    });

    if (!newName || newName === currentName) return;

    // Vérifier si le nom est déjà utilisé
    const isNameTaken = buildConfig.projectFiles.additionalFiles.some(
      (file, idx) => idx !== fileIndex && file.name === newName
    );

    if (isNameTaken) {
      toast({
        title: "Erreur",
        description: "Ce nom de fichier est déjà utilisé",
        variant: "destructive",
      });
      return;
    }

    setBuildConfig(prev => ({
      ...prev,
      projectFiles: {
        ...prev.projectFiles,
        additionalFiles: prev.projectFiles.additionalFiles.map((file, idx) =>
          idx === fileIndex
            ? { ...file, name: newName, lastModified: new Date() }
            : file
        )
      }
    }));

    toast({
      title: "Fichier renommé",
      description: `${currentName} a été renommé en ${newName}`,
    });
  };

  const handleFileEdit = (type: 'dockerfile' | 'additional', index?: number) => {
    if (type === 'dockerfile') {
      const dockerfile = buildConfig.projectFiles.dockerfile;
      if (dockerfile) {
        setSelectedFile({
          type,
          name: 'Dockerfile',
          content: dockerfile.content
        });
      }
    } else if (type === 'additional' && typeof index === 'number') {
      const file = buildConfig.projectFiles.additionalFiles[index];
      if (file) {
        setSelectedFile({
          type,
          index,
          name: file.name,
          content: file.content
        });
      }
    }
  };

  const handleBuild = async () => {
    setIsBuilding(true);
    setBuildProgress({
      status: 'Démarrage...',
      logs: ['🚀 Démarrage du processus de build...']
    });
    setBuildLogs(['🚀 Démarrage du processus de build...']);

    try {
      const formData = new FormData();
      formData.append('dockerfile', new Blob([buildConfig.projectFiles.dockerfile!.content], { type: 'text/plain' }));
      formData.append('imageName', buildConfig.imageName);
      formData.append('tag', buildConfig.tag || 'latest');

      // Ajouter les fichiers supplémentaires
      buildConfig.projectFiles.additionalFiles.forEach(file => {
        formData.append('files', new Blob([file.content], { type: 'text/plain' }), file.name);
      });

      const response = await fetch('/api/admin/images/build', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.text();
        let errorMessage: string;
        try {
          const jsonError = JSON.parse(errorData);
          errorMessage = jsonError.message || 'Une erreur est survenue pendant le build';
        } catch {
          errorMessage = errorData || 'Une erreur est survenue pendant le build';
        }
        toast({
          title: "Erreur",
          description: errorMessage,
          variant: "destructive",
        });
        setBuildProgress(prev => ({
          ...prev!,
          status: 'Erreur',
          error: errorMessage,
          logs: [...(prev?.logs || []), `❌ ${errorMessage}`]
        }));
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Impossible de lire la réponse');
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
              toast({
                title: "Erreur",
                description: data.message,
                variant: "destructive",
              });
              setBuildProgress(prev => ({
                status: 'Erreur',
                error: data.message,
                logs: [...(prev?.logs || []), `❌ ${data.message}`]
              }));
              setBuildLogs(prev => [...prev, `❌ ${data.message}`]);
            } else if (data.success) {
              toast({
                title: "Succès",
                description: "L'image a été construite avec succès",
                variant: "default",
              });
              setBuildProgress(prev => ({
                status: 'Build terminé',
                logs: [...(prev?.logs || []), '✅ Build terminé avec succès']
              }));
              setBuildLogs(prev => [...prev, '✅ Build terminé avec succès']);
              onImageBuilt();
            } else if (data.stream) {
              const logLine = data.stream.trim();
              if (logLine) {
                setBuildProgress(prev => ({
                  status: 'Construction...',
                  logs: [...(prev?.logs || []), logLine]
                }));
                setBuildLogs(prev => [...prev, logLine]);
              }
            }
          } catch {
            // Si la ligne n'est pas du JSON, c'est probablement un log direct
            if (line.trim()) {
              setBuildProgress(prev => ({
                status: 'Construction...',
                logs: [...(prev?.logs || []), line.trim()]
              }));
              setBuildLogs(prev => [...prev, line.trim()]);
            }
          }
        }
      }
    } catch (error) {
      console.error('Build error:', error);
      const errorMessage = error instanceof Error ? error.message : "Une erreur inattendue est survenue";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
      setBuildProgress(prev => ({
        status: 'Erreur',
        error: errorMessage,
        logs: [...(prev?.logs || []), `❌ ${errorMessage}`]
      }));
      setBuildLogs(prev => [...prev, `❌ ${errorMessage}`]);
    } finally {
      setIsBuilding(false);
    }
  };

  const handleReset = () => {
    setBuildConfig(defaultBuildConfig);
    setSelectedTemplate(null);
    setBuildProgress(null);
    setBuildLogs([]);
    setShowBuildLogs(false);
    setActiveFile(null);
    toast({
      title: "Réinitialisation",
      description: "Le formulaire a été réinitialisé",
      variant: "default",
    });
  };

  const renderRecommendations = (template: DockerTemplate) => {
    if (!template.recommendations) return null;

    return (
      <div className="space-y-1">
        <span className="text-sm font-medium">Recommandations :</span>
        <ul className="text-sm text-muted-foreground space-y-1">
          {template.recommendations.cpu && (
            <li className="flex items-center">
              <Cpu className="w-3 h-3 mr-1" />
              CPU: {template.recommendations.cpu}
            </li>
          )}
          {template.recommendations.memory && (
            <li className="flex items-center">
              <HardDrive className="w-3 h-3 mr-1" />
              RAM: {template.recommendations.memory}
            </li>
          )}
          {template.recommendations.storage && (
            <li className="flex items-center">
              <Database className="w-3 h-3 mr-1" />
              Stockage: {template.recommendations.storage}
            </li>
          )}
        </ul>
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Construction d'Image Docker</CardTitle>
        <CardDescription>
          Créez une nouvelle image Docker à partir d'un Dockerfile et de fichiers additionnels
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Configuration de base */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="imageName">Nom de l'image</Label>
              <Input
                id="imageName"
                value={buildConfig.imageName}
                onChange={(e) => {
                  const value = e.target.value.toLowerCase().replace(/[^a-z0-9-_.]/g, '-');
                  setBuildConfig(prev => ({
                    ...prev,
                    imageName: value
                  }));
                }}
                onBlur={(e) => {
                  // Nettoyage final du nom
                  const value = e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9-_.]/g, '-')
                    .replace(/^[._-]+|[._-]+$/g, ''); // Supprime les caractères spéciaux au début et à la fin
                  setBuildConfig(prev => ({
                    ...prev,
                    imageName: value
                  }));
                }}
                placeholder="mon-image"
              />
              <p className="text-xs text-muted-foreground">
                Utilisez uniquement des lettres minuscules, des chiffres, des tirets (-), des points (.) et des underscores (_)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tag">Tag</Label>
              <Input
                id="tag"
                value={buildConfig.tag}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^a-zA-Z0-9-_.]/g, '-');
                  setBuildConfig(prev => ({
                    ...prev,
                    tag: value
                  }));
                }}
                onBlur={(e) => {
                  // Nettoyage final du tag
                  const value = e.target.value
                    .replace(/[^a-zA-Z0-9-_.]/g, '-')
                    .replace(/^[._-]+|[._-]+$/g, ''); // Supprime les caractères spéciaux au début et à la fin
                  setBuildConfig(prev => ({
                    ...prev,
                    tag: value || 'latest'
                  }));
                }}
                placeholder="latest"
              />
              <p className="text-xs text-muted-foreground">
                Le tag peut contenir des lettres, des chiffres, des tirets (-), des points (.) et des underscores (_)
              </p>
            </div>
          </div>

          {/* Gestion des fichiers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Fichiers du projet</Label>
              <div className="space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTemplateDialog(true)}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Templates
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Importer
                </Button>
              </div>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileImport}
              multiple
            />

            <div className="border rounded-lg p-4 space-y-2">
              {/* Dockerfile */}
              {buildConfig.projectFiles.dockerfile ? (
                <div className="flex items-center justify-between p-2 bg-secondary rounded">
                  <div className="flex items-center">
                    <FileText className="w-4 h-4 mr-2" />
                    <span>Dockerfile</span>
                  </div>
                  <div className="space-x-2">
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
                      onClick={() => handleFileDelete(buildConfig.projectFiles.dockerfile!)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center p-4 border-2 border-dashed rounded">
                  <p className="text-muted-foreground">
                    Aucun Dockerfile sélectionné
                  </p>
                </div>
              )}

              {/* Fichiers additionnels */}
              {buildConfig.projectFiles.additionalFiles.map((file, index) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-2 bg-secondary rounded"
                >
                  <div className="flex items-center">
                    <File className="w-4 h-4 mr-2" />
                    <span>{file.name}</span>
                  </div>
                  <div className="space-x-2">
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
                      onClick={() => handleFileRename(index, file.name)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFileDelete(file)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Options de build */}
          <div className="space-y-2">
            <Label>Options de build</Label>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="pull"
                  checked={buildConfig.options.pull}
                  onCheckedChange={(checked) => setBuildConfig(prev => ({
                    ...prev,
                    options: { ...prev.options, pull: checked as boolean }
                  }))}
                />
                <Label htmlFor="pull">Toujours télécharger les dernières images de base</Label>
              </div>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex justify-end space-x-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowBuildLogs(!showBuildLogs)}
              disabled={!buildProgress}
            >
              {showBuildLogs ? <X className="w-4 h-4 mr-2" /> : <Terminal className="w-4 h-4 mr-2" />}
              {showBuildLogs ? "Masquer les logs" : "Voir les logs"}
            </Button>
            <Button
              onClick={handleBuild}
              disabled={isBuilding || !selectedTemplate || !buildConfig.imageName}
            >
              {isBuilding ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Construction...
                </>
              ) : (
                <>
                  <Hammer className="w-4 h-4 mr-2" />
                  Construire
                </>
              )}
            </Button>
          </div>

          {/* Logs de build */}
          {showBuildLogs && buildProgress && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Logs de build</h3>
              </div>
              <ScrollArea className="h-[200px] border rounded-md p-4">
                <div className="space-y-1">
                  {buildLogs.map((log: string, index: number) => (
                    <div key={index} className="text-sm font-mono whitespace-pre-wrap">
                      {log}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </CardContent>

      {/* Dialog d'édition de fichier */}
      <Dialog open={selectedFile !== null} onOpenChange={(open) => !open && setSelectedFile(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              Modifier {selectedFile?.type === 'dockerfile' ? 'Dockerfile' : selectedFile?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border rounded-md overflow-hidden">
              <Editor
                height="400px"
                defaultLanguage={selectedFile?.type === 'dockerfile' ? 'dockerfile' : 'plaintext'}
                value={selectedFile?.content || ''}
                onChange={(value) => setSelectedFile(prev => prev ? {
                  ...prev,
                  content: value || ''
                } : null)}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  wordWrap: 'on',
                  tabSize: 2,
                  renderWhitespace: 'selection',
                }}
                loading={
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                }
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setSelectedFile(null)}
              >
                Annuler
              </Button>
              <Button
                onClick={() => {
                  if (selectedFile) {
                    handleFileContentSave(selectedFile.content);
                    setSelectedFile(null);
                  }
                }}
              >
                <Save className="w-4 h-4 mr-2" />
                Enregistrer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de sélection de template */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Sélectionner un template</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[500px] pr-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dockerTemplates.map((template) => (
                <div
                  key={template.name}
                  className="flex flex-col space-y-2 p-4 border rounded-lg cursor-pointer hover:bg-secondary transition-colors"
                  onClick={() => handleTemplateSelect(template)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{template.name}</span>
                    <Badge variant="outline">{template.category}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {template.description}
                  </p>
                  {renderRecommendations(template)}
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default UnifiedImageBuilder;
