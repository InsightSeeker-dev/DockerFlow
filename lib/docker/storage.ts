import { getDockerClient } from './client';
import { prisma } from '@/lib/prisma';

/**
 * Calcule la taille totale des images Docker utilisées par un utilisateur
 */
export async function getUserStorageUsage(userId: string): Promise<number> {
  const docker = getDockerClient();
  const images = await docker.listImages();

  // Récupérer les conteneurs de l'utilisateur
  const userContainers = await prisma.container.findMany({
    where: { userId },
    select: { imageId: true }
  });

  // Calculer la taille totale des images utilisées
  const userImages = images.filter(image =>
    userContainers.some(container =>
      container.imageId === (image.RepoTags && image.RepoTags[0]) ||
      container.imageId === image.Id
    )
  );

  return userImages.reduce((total, image) => total + image.Size, 0);
}

/**
 * Récupère la taille d'une image Docker
 */
export async function getImageSize(imageName: string): Promise<number> {
  const docker = getDockerClient();
  try {
    const images = await docker.listImages();
    const image = images.find(img => 
      img.RepoTags && img.RepoTags.includes(imageName)
    );
    return image ? image.Size : 0;
  } catch (error) {
    console.error('Error getting image size:', error);
    return 0;
  }
}

/**
 * Vérifie si l'utilisateur a assez d'espace pour une nouvelle image
 */
export async function checkStorageLimit(userId: string, additionalSize: number): Promise<boolean> {
  // Récupérer la limite de stockage de l'utilisateur
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { storageLimit: true }
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Calculer l'utilisation actuelle
  const currentUsage = await getUserStorageUsage(userId);

  // Vérifier si l'ajout de la nouvelle image dépasserait la limite
  return (currentUsage + additionalSize) <= user.storageLimit;
}