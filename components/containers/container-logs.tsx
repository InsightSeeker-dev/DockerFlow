import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Download, RefreshCw, Copy, Search } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface ContainerLogsProps {
  containerId: string | null;
  onClose: () => void;
}

export function ContainerLogs({ containerId, onClose }: ContainerLogsProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [containerName, setContainerName] = useState<string>('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  // Filtrer les logs en fonction du terme de recherche
  const filteredLogs = searchTerm
    ? logs.filter(log => log.toLowerCase().includes(searchTerm.toLowerCase()))
    : logs;

  // Fonction pour récupérer les logs
  async function fetchLogs() {
    if (!containerId) return;

    setLoading(true);
    setError(null);
    
    console.log(`[UI] Récupération des logs pour le conteneur ${containerId}`);

    try {
      // Utiliser la route PATCH unifiée avec l'action 'logs'
      const response = await fetch(`/api/containers/${containerId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'logs' }),
        // Assurer que les cookies sont envoyés pour l'authentification
        credentials: 'include'
      });
        
      console.log(`[UI] Réponse reçue avec statut: ${response.status}`);
      
      if (response.status === 401) {
        console.error('[UI] Erreur d\'authentification lors de la récupération des logs');
        toast({
          title: "Erreur d'authentification",
          description: "Votre session a expiré. Veuillez vous reconnecter.",
          variant: "destructive"
        });
        // Rediriger vers la page de connexion après un délai
        setTimeout(() => {
          window.location.href = '/auth';
        }, 2000);
        throw new Error('Session expirée');
      }
      
      if (!response.ok) {
        let errorMessage = `Erreur (${response.status})`;
        try {
          const errorData = await response.json();
          console.error(`[UI] Erreur HTTP ${response.status}:`, errorData);
          errorMessage = errorData.error || 'Impossible de récupérer les logs du conteneur';
        } catch (parseError) {
          console.error(`[UI] Impossible de parser la réponse d'erreur:`, parseError);
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log(`[UI] Logs récupérés avec succès, ${data.logs ? data.logs.length : 0} lignes`);
      console.log('[UI] Premier log:', data.logs && data.logs.length > 0 ? data.logs[0] : 'aucun');
      
      if (!data.logs || !Array.isArray(data.logs)) {
        console.warn('[UI] Les logs reçus ne sont pas un tableau:', data);
        setLogs([]);
        toast({
          title: "Avertissement",
          description: "Format de logs incorrect. Veuillez contacter l'administrateur.",
          variant: "destructive"
        });
      } else {
        setLogs(data.logs);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Impossible de récupérer les logs';
      setError(errorMessage);
      console.error('[UI] Erreur lors de la récupération des logs:', err);
    } finally {
      setLoading(false);
    }
  }

  // Effet pour récupérer le nom du conteneur
  useEffect(() => {
    async function fetchContainerInfo() {
      if (!containerId) return;
      
      try {
        const response = await fetch(`/api/containers/${containerId}`, {
          method: 'GET',
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          setContainerName(data.name || 'Conteneur');
        }
      } catch (err) {
        console.error('[UI] Erreur lors de la récupération des infos du conteneur:', err);
      }
    }
    
    fetchContainerInfo();
    fetchLogs(); // Charger les logs au montage du composant
  }, [containerId]);

  // Auto-refresh des logs toutes les 5 secondes
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    if (autoRefresh && containerId) {
      intervalId = setInterval(() => {
        fetchLogs();
      }, 5000);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [autoRefresh, containerId]);

  // Fonction pour télécharger les logs
  const downloadLogs = () => {
    if (logs.length === 0) return;
    
    const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${containerName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_logs_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Logs téléchargés",
      description: `Les logs ont été téléchargés avec succès.`,
      duration: 3000
    });
  };
  
  // Fonction pour copier les logs dans le presse-papier
  const copyLogs = () => {
    if (logs.length === 0) return;
    
    navigator.clipboard.writeText(logs.join('\n'))
      .then(() => {
        toast({
          title: "Logs copiés",
          description: "Les logs ont été copiés dans le presse-papier.",
          duration: 3000
        });
      })
      .catch(err => {
        console.error('[UI] Erreur lors de la copie des logs:', err);
        toast({
          title: "Erreur",
          description: "Impossible de copier les logs dans le presse-papier.",
          variant: "destructive"
        });
      });
  };
  
  // Fonction pour détecter les types de logs (erreur, info, warning)
  const getLogType = (log: string): 'error' | 'warning' | 'info' | 'default' => {
    const lowerLog = log.toLowerCase();
    if (lowerLog.includes('error') || lowerLog.includes('exception') || lowerLog.includes('fail')) {
      return 'error';
    } else if (lowerLog.includes('warn')) {
      return 'warning';
    } else if (lowerLog.includes('info')) {
      return 'info';
    }
    return 'default';
  };
  
  // Fonction pour obtenir la classe CSS en fonction du type de log
  const getLogClass = (log: string): string => {
    const type = getLogType(log);
    switch (type) {
      case 'error':
        return 'text-red-400';
      case 'warning':
        return 'text-amber-400';
      case 'info':
        return 'text-blue-400';
      default:
        return '';
    }
  };

  return (
    <Dialog open={!!containerId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-5xl h-[85vh]">
        <DialogHeader className="flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-xl">
              Logs du conteneur {containerName && <Badge variant="outline" className="ml-2">{containerName}</Badge>}
            </DialogTitle>
            <div className="text-xs text-muted-foreground mt-1">
              {logs.length > 0 && `${logs.length} lignes de logs`}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher dans les logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={autoRefresh ? "bg-blue-900/20" : ""}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${autoRefresh ? "animate-spin" : ""}`} />
              {autoRefresh ? "Arrêter" : "Auto"}
            </Button>
          </div>
        </DialogHeader>
        
        <div className="relative">
          <ScrollArea 
            className="flex-1 h-[calc(85vh-9rem)] p-4 rounded-md bg-gray-950 text-gray-200 font-mono text-sm overflow-auto"
            ref={scrollAreaRef}
          >
            {loading && logs.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : error ? (
              <div className="text-red-400 p-4 border border-red-800 rounded-md bg-red-950/30">
                <p className="font-bold mb-2">Erreur lors de la récupération des logs :</p>
                <p>{error}</p>
                <p className="mt-4 text-sm text-gray-400">
                  Vérifiez que le conteneur est toujours actif et que vous avez les permissions nécessaires.
                </p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-gray-400 p-4 text-center">
                {logs.length === 0 ? "Aucun log disponible" : "Aucun résultat pour votre recherche"}
              </div>
            ) : (
              <div>
                {loading && (
                  <div className="absolute top-2 right-2 bg-blue-500/20 text-blue-300 px-2 py-1 rounded-md text-xs flex items-center">
                    <Loader2 className="h-3 w-3 animate-spin mr-1" /> Actualisation...
                  </div>
                )}
                
                {filteredLogs.map((log, index) => {
                  // Extraction de la date/heure si présente
                  const timestampMatch = log.match(/\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\]/);
                  const timestamp = timestampMatch ? timestampMatch[1] : null;
                  
                  // Extraction du contenu sans la date
                  const content = timestamp 
                    ? log.replace(`[${timestamp}] `, '') 
                    : log;
                  
                  return (
                    <div 
                      key={index} 
                      className={`py-1 ${getLogClass(log)} ${searchTerm && log.toLowerCase().includes(searchTerm.toLowerCase()) ? 'bg-yellow-900/20 px-1 -mx-1 rounded' : ''}`}
                    >
                      {timestamp && (
                        <span className="text-gray-500 mr-2">
                          {new Date(timestamp).toLocaleTimeString()}
                        </span>
                      )}
                      <span>{content}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
        
        <DialogFooter className="flex justify-between items-center">
          <div className="text-xs text-muted-foreground">
            {searchTerm && logs.length > 0 && 
              `${filteredLogs.length} résultats sur ${logs.length} lignes`
            }
          </div>
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchLogs}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Actualiser
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={copyLogs}
              disabled={logs.length === 0}
            >
              <Copy className="h-4 w-4 mr-1" />
              Copier
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              onClick={downloadLogs}
              disabled={logs.length === 0}
            >
              <Download className="h-4 w-4 mr-1" />
              Télécharger
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}