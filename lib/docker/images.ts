import { getDockerClient } from './client';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ImageInfo } from 'dockerode';

interface DockerImageInspectInfo {
  Id: string;
  RepoTags: string[];
  Config: {
    ExposedPorts?: { [key: string]: {} };
    Volumes?: { [key: string]: {} };
  };
}

interface DockerImage {
  Id: string;
  RepoTags: string[];
  RepoDigests: string[];
}

function transformImageInfo(image: ImageInfo): DockerImage {
  return {
    ...image,
    RepoTags: image.RepoTags || [],
    RepoDigests: image.RepoDigests || []
  };
}

export async function listImages(): Promise<DockerImage[]> {
  const docker = getDockerClient();
  try {
    const images = await docker.listImages();
    return images.map(transformImageInfo);
  } catch (error) {
    console.error('Error listing images:', error);
    throw new Error('Failed to list images');
  }
}

export async function listUserImages(userId: string): Promise<DockerImage[]> {
  const docker = getDockerClient();
  const userContainers = await prisma.container.findMany({
    where: { userId },
    select: { imageId: true }
  });

  const images = await docker.listImages();
  const userImageIds = new Set(userContainers.map(c => c.imageId));

  return images
    .filter(image => 
      image.RepoTags?.some(tag => userImageIds.has(tag)) ||
      userImageIds.has(image.Id)
    )
    .map(transformImageInfo);
}

export async function pullImage(imageName: string, userId: string): Promise<void> {
  const docker = getDockerClient();
  try {
    await docker.pull(imageName);
    // Tag image with user ID for tracking
    const image = docker.getImage(imageName);
    await image.tag({
      repo: `user_${userId}/${imageName.split('/').pop()}`,
      tag: 'latest'
    });
  } catch (error) {
    console.error('Error pulling image:', error);
    throw new Error('Failed to pull image');
  }
}

export async function removeImage(userId: string, imageId: string): Promise<void> {
  const docker = getDockerClient();
  try {
    // Vérifier si l'image est utilisée
    const containers = await prisma.container.findMany({
      where: { 
        userId,
        imageId
      }
    });

    if (containers.length > 0) {
      throw new Error('Cannot remove image: it is being used by containers');
    }

    // Supprimer l'image
    const image = docker.getImage(imageId);
    await image.remove();
  } catch (error) {
    console.error('Error removing image:', error);
    throw new Error('Failed to remove image');
  }
}

export async function getImageExposedPorts(imageName: string): Promise<number[]> {
  try {
    const docker = getDockerClient();
    
    // Pull l'image si elle n'existe pas
    try {
      await docker.pull(imageName);
    } catch (error) {
      console.error(`Failed to pull image ${imageName}:`, error);
    }

    // Inspecter l'image
    const image = await docker.getImage(imageName).inspect() as DockerImageInspectInfo;
    
    // Extraire les ports exposés du Config
    const exposedPorts = image.Config.ExposedPorts || {};
    const ports = Object.keys(exposedPorts).map(port => {
      // Convertir "80/tcp" en 80
      const portNumber = parseInt(port.split('/')[0]);
      return isNaN(portNumber) ? null : portNumber;
    }).filter((port): port is number => port !== null);

    // Si aucun port n'est exposé, retourner une liste vide
    return ports.length > 0 ? ports : [];
  } catch (error) {
    console.error(`Failed to get exposed ports for image ${imageName}:`, error);
    return [];
  }
}

export async function getImageVolumes(imageName: string): Promise<string[]> {
  try {
    const docker = getDockerClient();
    
    // Inspecter l'image
    const image = await docker.getImage(imageName).inspect() as DockerImageInspectInfo;
    
    // Extraire les volumes du Config
    const volumes = image.Config.Volumes || {};
    return Object.keys(volumes);
  } catch (error) {
    console.error(`Failed to get volumes for image ${imageName}:`, error);
    return [];
  }
}