'use client';

import React, { useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Upload,
  File,
  RefreshCcw,
  Play,
  AlertCircle,
  Check,
  X,
  Download,
  Folder,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Shield, Wand2, Lightbulb, CheckCircle2 } from 'lucide-react';

interface BuildLog {
  status: string;
  stream?: string;
  error?: string;
  progress?: string;
}

interface BuildHistory {
  id: string;
  tag: string;
  status: 'success' | 'error' | 'building';
  startTime: string;
  endTime?: string;
  error?: string;
}

interface ImageBuilderProps {
  onSuccess: () => void;
}

export default function ImageBuilder({ onSuccess }: ImageBuilderProps) {
  const [dockerfile, setDockerfile] = useState('');
  const [buildTag, setBuildTag] = useState('');
  const [buildContext, setBuildContext] = useState<File[]>([]);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildLogs, setBuildLogs] = useState<BuildLog[]>([]);
  const [buildHistory, setBuildHistory] = useState<BuildHistory[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('custom');
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    issues: Array<{
      line: number;
      message: string;
      severity: 'error' | 'warning';
      fix?: string;
    }>;
    suggestions: string[];
    security: {
      score: number;
      recommendations: string[];
    };
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dockerfileTemplates = {
    custom: '',
    node: `FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]`,
    python: `FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["python", "app.py"]`,
    nginx: `FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`,
  };

  const handleTemplateChange = (template: string) => {
    setSelectedTemplate(template);
    setDockerfile(dockerfileTemplates[template as keyof typeof dockerfileTemplates]);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setBuildContext((prev) => [...prev, ...files]);
  };

  const validateDockerfile = async (content: string) => {
    try {
      const response = await fetch('/api/admin/images/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dockerfile: content }),
      });

      if (response.ok) {
        const result = await response.json();
        setValidationResult(result);
        return result.valid;
      }
      return false;
    } catch (error) {
      console.error('Error validating Dockerfile:', error);
      toast.error('Erreur lors de la validation du Dockerfile');
      return false;
    }
  };

  const handleBuild = async () => {
    if (!dockerfile || !buildTag) {
      toast.error('Le Dockerfile et le tag sont requis');
      return;
    }

    // Valider le Dockerfile avant la construction
    const isValid = await validateDockerfile(dockerfile);
    if (!isValid) {
      toast.error('Le Dockerfile contient des erreurs. Veuillez les corriger avant de continuer.');
      return;
    }

    setIsBuilding(true);
    setBuildLogs([]);

    const buildId = Date.now().toString();
    const newBuild: BuildHistory = {
      id: buildId,
      tag: buildTag,
      status: 'building',
      startTime: new Date().toISOString(),
    };

    setBuildHistory((prev) => [newBuild, ...prev]);

    try {
      // Créer un FormData avec le Dockerfile et les fichiers du contexte
      const formData = new FormData();
      formData.append('dockerfile', new Blob([dockerfile], { type: 'text/plain' }));
      formData.append('tag', buildTag);
      buildContext.forEach((file) => {
        formData.append('context', file);
      });

      const response = await fetch('/api/admin/images/build', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la construction');
      }

      const reader = response.body?.getReader();
      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Convertir le buffer en string et parser les logs
        const text = new TextDecoder().decode(value);
        const logs = text.split('\n')
          .filter(Boolean)
          .map(line => {
            try {
              return JSON.parse(line);
            } catch {
              return { stream: line };
            }
          });

        setBuildLogs((prev) => [...prev, ...logs]);

        // Mettre à jour l'historique si une erreur est détectée
        const error = logs.find(log => log.error);
        if (error) {
          setBuildHistory((prev) =>
            prev.map((build) =>
              build.id === buildId
                ? {
                    ...build,
                    status: 'error',
                    endTime: new Date().toISOString(),
                    error: error.error,
                  }
                : build
            )
          );
        }
      }

      // Mettre à jour l'historique avec succès
      setBuildHistory((prev) =>
        prev.map((build) =>
          build.id === buildId
            ? {
                ...build,
                status: 'success',
                endTime: new Date().toISOString(),
              }
            : build
        )
      );

      toast.success('Image construite avec succès');
      setIsBuilding(false);
      setBuildContext([]);
      setBuildTag('');
      onSuccess();
    } catch (error) {
      console.error('Error building image:', error);
      toast.error('Erreur lors de la construction de l\'image');

      setBuildHistory((prev) =>
        prev.map((build) =>
          build.id === buildId
            ? {
                ...build,
                status: 'error',
                endTime: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown error',
              }
            : build
        )
      );
    } finally {
      setIsBuilding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Construction d'Images</h2>
        <Button onClick={() => setIsBuilding(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle Construction
        </Button>
      </div>

      {/* Build History */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des Constructions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tag</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Démarré</TableHead>
                <TableHead>Durée</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {buildHistory.map((build) => (
                <TableRow key={build.id}>
                  <TableCell className="font-medium">{build.tag}</TableCell>
                  <TableCell>
                    {build.status === 'success' && (
                      <span className="flex items-center text-green-500">
                        <Check className="h-4 w-4 mr-1" />
                        Succès
                      </span>
                    )}
                    {build.status === 'error' && (
                      <span className="flex items-center text-red-500">
                        <X className="h-4 w-4 mr-1" />
                        Erreur
                      </span>
                    )}
                    {build.status === 'building' && (
                      <span className="flex items-center text-blue-500">
                        <RefreshCcw className="h-4 w-4 mr-1 animate-spin" />
                        En cours
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {formatDistanceToNow(new Date(build.startTime), {
                      addSuffix: true,
                      locale: fr,
                    })}
                  </TableCell>
                  <TableCell>
                    {build.endTime
                      ? formatDistanceToNow(new Date(build.startTime), {
                          addSuffix: false,
                          locale: fr,
                        })
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {build.error && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toast.error(build.error)}
                        >
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Build Dialog */}
      <Dialog open={isBuilding} onOpenChange={setIsBuilding}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Construction d'une nouvelle image</DialogTitle>
            <DialogDescription>
              Configurez votre Dockerfile et le contexte de construction
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Template</Label>
                <Select
                  value={selectedTemplate}
                  onValueChange={handleTemplateChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Personnalisé</SelectItem>
                    <SelectItem value="node">Node.js</SelectItem>
                    <SelectItem value="python">Python</SelectItem>
                    <SelectItem value="nginx">Nginx</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Dockerfile</Label>
                <Textarea
                  value={dockerfile}
                  onChange={(e) => setDockerfile(e.target.value)}
                  className="font-mono h-[400px]"
                  placeholder="FROM node:18-alpine..."
                />
              </div>

              {/* Résultats de la validation */}
              {validationResult && (
                <div className="space-y-4 border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Validation</h3>
                    <div className="flex items-center gap-2">
                      {validationResult.valid ? (
                        <Badge variant="default" className="bg-green-500 text-white flex items-center">
                          <Check className="h-3 w-3 mr-1" />
                          Valide
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="flex items-center">
                          <X className="h-3 w-3 mr-1" />
                          Non valide
                        </Badge>
                      )}
                      <div className="flex items-center gap-1">
                        <Shield className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          Score de sécurité: {validationResult.security.score}/100
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Problèmes */}
                  {validationResult.issues.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Problèmes détectés</h4>
                      <div className="space-y-1">
                        {validationResult.issues.map((issue, index) => (
                          <div
                            key={index}
                            className={cn(
                              "text-sm p-2 rounded-md",
                              issue.severity === 'error'
                                ? 'bg-red-50 text-red-700'
                                : 'bg-yellow-50 text-yellow-700'
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span>
                                Ligne {issue.line}: {issue.message}
                              </span>
                              {issue.fix && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const lines = dockerfile.split('\n');
                                    lines[issue.line - 1] = issue.fix!;
                                    setDockerfile(lines.join('\n'));
                                    validateDockerfile(lines.join('\n'));
                                  }}
                                >
                                  <Wand2 className="h-3 w-3 mr-1" />
                                  Corriger
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggestions */}
                  {validationResult.suggestions.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Suggestions d'amélioration</h4>
                      <div className="space-y-1">
                        {validationResult.suggestions.map((suggestion, index) => (
                          <div
                            key={index}
                            className="text-sm p-2 rounded-md bg-blue-50 text-blue-700"
                          >
                            <Lightbulb className="h-3 w-3 inline mr-2" />
                            {suggestion}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommandations de sécurité */}
                  {validationResult.security.recommendations.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Recommandations de sécurité</h4>
                      <div className="space-y-1">
                        {validationResult.security.recommendations.map((rec, index) => (
                          <div
                            key={index}
                            className="text-sm p-2 rounded-md bg-purple-50 text-purple-700"
                          >
                            <Shield className="h-3 w-3 inline mr-2" />
                            {rec}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tag de l'image</Label>
                <Input
                  value={buildTag}
                  onChange={(e) => setBuildTag(e.target.value)}
                  placeholder="mon-app:latest"
                />
              </div>

              <div className="space-y-2">
                <Label>Contexte de construction</Label>
                <div className="border rounded-lg p-4 space-y-4">
                  <div className="space-y-2">
                    {buildContext.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-secondary rounded"
                      >
                        <div className="flex items-center">
                          <File className="h-4 w-4 mr-2" />
                          {file.name}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setBuildContext((prev) =>
                              prev.filter((_, i) => i !== index)
                            );
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <input
                    type="file"
                    multiple
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileUpload}
                  />

                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Ajouter des fichiers
                  </Button>
                </div>
              </div>

              {buildLogs.length > 0 && (
                <div className="space-y-2">
                  <Label>Logs de construction</Label>
                  <div className="bg-black text-white p-4 rounded-lg h-[200px] overflow-auto font-mono text-sm">
                    {buildLogs.map((log, index) => (
                      <div key={index} className="whitespace-pre-wrap">
                        {log.stream || log.status || log.error}
                        {log.progress && (
                          <span className="text-blue-400"> {log.progress}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="default"
              onClick={() => validateDockerfile(dockerfile)}
              disabled={!dockerfile || isBuilding}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Valider
            </Button>
            <Button variant="outline" onClick={() => setIsBuilding(false)}>
              Annuler
            </Button>
            <Button
              variant="default"
              onClick={handleBuild}
              disabled={isBuilding || Boolean(validationResult && !validationResult.valid)}
            >
              {isBuilding ? (
                <>
                  <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
                  Construction...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Construire
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
