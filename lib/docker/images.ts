import { getDockerClient } from './client';
import { DockerImage } from './types';
import { prisma } from '@/lib/prisma';
import { ImageInfo } from 'dockerode';

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