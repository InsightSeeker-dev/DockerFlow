import { prisma } from '@/lib/prisma';
import Docker from 'dockerode';

/**
 * Synchronize containers between Docker and the database for a given user.
 * - Upsert all containers present in Docker.
 * - Remove from DB any containers that no longer exist in Docker.
 * @param userId string | ObjectId
 */
export async function synchronizeContainers(userId: string) {
  const docker = new Docker();
  const containers = await docker.listContainers({ all: true });

  // Build a list of container IDs present in Docker
  const dockerIds = containers.map(c => c.Id);

  // Upsert all containers found in Docker
  for (const container of containers) {
    const name = container.Names[0]?.replace(/^\//, '') || '';
    try {
      // Stocker ports comme un tableau JSON pur (InputJsonValue)
      const portsJson = JSON.parse(JSON.stringify(container.Ports || []));
      await prisma.container.upsert({
        where: { dockerId: container.Id },
        update: {
          name,
          imageId: container.Image,
          image: container.Image, // champ attendu par Prisma
          url: '', // Peut être généré si besoin
          status: container.State,
          ports: portsJson,
          userId,
        },
        create: {
          dockerId: container.Id,
          name,
          imageId: container.Image,
          image: container.Image,
          url: '',
          status: container.State,
          ports: portsJson,
          userId,
        },
      });
    } catch (err) {
      console.error('[CONTAINER SYNC UPSERT ERROR]', err);
    }
  }

  // Delete containers from DB that are no longer present in Docker
  await prisma.container.deleteMany({
    where: {
      userId,
      dockerId: { notIn: dockerIds },
    },
  });
}
