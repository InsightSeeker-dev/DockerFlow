import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { ContainerFormData, CreateContainerResponse, DockerImage, Volume, VolumeConfig } from '../types';

interface UseContainerCreationProps {
  onSuccess?: () => void;
  onClose?: () => void;
}

type VolumeConfigKey = keyof VolumeConfig;

interface UseContainerCreationReturn {
  isLoading: boolean;
  images: DockerImage[];
  volumes: Volume[];
  fetchImages: () => Promise<void>;
  fetchVolumes: () => Promise<void>;
  handleSubmit: (formValues: ContainerFormData) => Promise<void>;
}

export const useContainerCreation = ({ onSuccess, onClose }: UseContainerCreationProps): UseContainerCreationReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [images, setImages] = useState<DockerImage[]>([]);
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const { toast } = useToast();

  const fetchImages = async () => {
    try {
      const response = await fetch('/api/admin/images/list', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch images');
      }
      const data = await response.json();
      console.log('Images reçues:', data);
      setImages(data);
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Impossible de charger les images Docker',
        variant: 'destructive',
      });
    }
  };

  const fetchVolumes = async () => {
    try {
      const response = await fetch('/api/volumes', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      let data;
      try {
        data = await response.json();
      } catch (e) {
        toast({
          title: 'Erreur',
          description: 'Réponse non valide de l’API volumes',
          variant: 'destructive',
        });
        setVolumes([]);
        return;
      }
      if (data && data.error) {
        console.error('[Volumes API] Erreur:', data);
        toast({
          title: 'Erreur API Volumes',
          description: data.error + (data.details ? `: ${data.details}` : ''),
          variant: 'destructive',
        });
        setVolumes([]);
        return;
      }
      if (Array.isArray(data)) {
        setVolumes(data);
      } else if (Array.isArray(data.volumes)) {
        setVolumes(data.volumes);
      } else if (Array.isArray(data.Volumes)) {
        setVolumes(data.Volumes);
      } else {
        setVolumes([]); // fallback
      }
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Impossible de charger les volumes',
        variant: 'destructive',
      });
      setVolumes([]); // Toujours garantir un tableau en cas d'erreur
    }
  };


  const handleSubmit = async (formValues: ContainerFormData) => {
    if (isLoading) return;
    
    setIsLoading(true);
    console.log('Début de la création du conteneur avec:', formValues);
    
    try {
      // Vérifier si le volume sélectionné existe dans Docker (si on utilise un volume existant)
      if (!formValues.volumeConfig.createNew && formValues.volumeConfig.volumeId) {
        const selectedVolume = volumes.find(v => v.id === formValues.volumeConfig.volumeId);
        
        if (selectedVolume && selectedVolume.existsInDocker === false) {
          throw new Error(`Le volume sélectionné "${selectedVolume.name}" n'existe pas dans Docker. Veuillez sélectionner un autre volume ou créer un nouveau.`);
        }
      }

      // Prepare volume configuration
      let volumeConfig;
      if (formValues.volumeConfig) {
        console.log('Configuration du volume:', formValues.volumeConfig);
        if (formValues.volumeConfig.createNew && formValues.volumeConfig.newVolumeName) {
          console.log('Création d\'un nouveau volume:', formValues.volumeConfig.newVolumeName);
          try {
            console.log(`Tentative de création d'un nouveau volume: ${formValues.volumeConfig.newVolumeName}`);
            
            // Vérifier d'abord si le volume existe déjà dans la liste des volumes
            const existingVolume = volumes.find(v => v.name === formValues.volumeConfig.newVolumeName);
            if (existingVolume) {
              console.log(`Volume ${formValues.volumeConfig.newVolumeName} existe déjà dans la liste des volumes`);
              
              // Si le volume existe déjà et est valide dans Docker, on peut l'utiliser
              if (existingVolume.existsInDocker !== false) {
                console.log(`Utilisation du volume existant: ${existingVolume.name}`);
                volumeConfig = [{
                  volumeId: existingVolume.id,
                  mountPath: formValues.volumeConfig.mountPath || '/data'
                }];
                return; // Sortir de la fonction try car nous avons déjà configuré le volume
              } else {
                throw new Error(`Le volume ${formValues.volumeConfig.newVolumeName} existe dans la base de données mais pas dans Docker. Veuillez utiliser un autre nom.`);
              }
            }
            
            // Si le volume n'existe pas, on le crée
            const volumeResponse = await fetch('/api/volumes', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include',
              body: JSON.stringify({
                name: formValues.volumeConfig.newVolumeName,
                driver: 'local'
              }),
            });

            // Récupérer le texte brut de la réponse pour le débogage
            const responseText = await volumeResponse.text();
            console.log('Réponse brute de création de volume:', responseText);
            
            // Essayer de parser la réponse en JSON
            let volumeData;
            try {
              volumeData = JSON.parse(responseText);
            } catch (parseError) {
              console.error('Erreur lors du parsing de la réponse JSON:', parseError);
              throw new Error(`Réponse invalide du serveur: ${responseText}`);
            }

            if (!volumeResponse.ok) {
              // Gérer spécifiquement les erreurs de contrainte d'unicité
              if (volumeData.error && (
                volumeData.error.includes('existe déjà') ||
                volumeData.error.includes('already exists') ||
                volumeData.error.includes('constraint')
              )) {
                throw new Error(`Un volume avec le nom '${formValues.volumeConfig.newVolumeName}' existe déjà. Veuillez utiliser un autre nom.`);
              }
              
              throw new Error(volumeData.error || volumeData.message || `Erreur lors de la création du volume: ${volumeResponse.status}`);
            }

            console.log('Volume créé avec succès:', volumeData);
            volumeConfig = [{
              volumeId: volumeData.id,
              mountPath: formValues.volumeConfig.mountPath || '/data'
            }];
          } catch (volumeError: any) {
            console.error('Erreur détaillée lors de la création du volume:', volumeError);
            throw new Error(`Impossible de créer le volume: ${volumeError.message || 'Erreur inconnue'}`);
          }
        } else if (formValues.volumeConfig.volumeId) {
          volumeConfig = [{
            volumeId: formValues.volumeConfig.volumeId,
            mountPath: formValues.volumeConfig.mountPath || '/data'
          }];
        }
      }

      const containerData = {
        name: formValues.name,
        image: formValues.image,
        subdomain: formValues.subdomain,
        volumes: volumeConfig
      };
      console.log('Envoi de la requête de création du conteneur:', containerData);
      
      console.log('Envoi de la requête de création avec les données:', containerData);
      
      console.log('Envoi de la requête de création avec les données:', JSON.stringify(containerData, null, 2));
      
      const response = await fetch('/api/containers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(containerData),
      });
      
      console.log('Réponse du serveur:', response.status);
      console.log('Headers:', Object.fromEntries(response.headers.entries()));

      const textResponse = await response.text();
      console.log('Réponse brute:', textResponse);
      
      // Log plus détaillé en cas d'erreur
      if (!response.ok) {
        console.error('Détails de l\'erreur:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: textResponse
        });
      }
      
      let responseData;
      try {
        responseData = JSON.parse(textResponse);
      } catch (e) {
        console.error('Erreur de parsing JSON:', e);
        throw new Error('Réponse invalide du serveur');
      }

      if (!response.ok) {
        throw new Error(responseData.error || responseData.message || 'Erreur lors de la création du conteneur');
      }

      console.log('Réponse de création du conteneur:', responseData);

      toast({
        title: 'Succès',
        description: `Le conteneur ${formValues.name} a été créé avec succès`,
        variant: 'default'
      });

      // Rafraîchir les données
      await Promise.all([
        fetchVolumes(),
        fetchImages()
      ]);

      // Appeler les callbacks
      onSuccess?.();
      onClose?.();
    } catch (error) {
      console.error('Erreur complète:', error);
      console.error('Type d\'erreur:', error instanceof Error ? 'Error' : typeof error);
      console.error('Stack trace:', error instanceof Error ? error.stack : 'Non disponible');
      
      let errorMessage = 'Impossible de créer le conteneur';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        // @ts-ignore
        errorMessage = error.error || error.message || errorMessage;
      }
      
      // Afficher les détails de l'erreur dans la console
      console.error('Message d\'erreur final:', errorMessage);
      
      toast({
        title: 'Erreur',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    images,
    volumes,
    fetchImages,
    fetchVolumes,
    handleSubmit
  };
};
