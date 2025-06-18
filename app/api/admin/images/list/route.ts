import { NextRequest, NextResponse } from 'next/server';
import Docker from 'dockerode';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Vérifier l'authentification
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
    });

    if (!user || user.role !== 'ADMIN') {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const docker = new Docker();
    const images = await docker.listImages({ all: true });

    // Traiter les images pour extraire les noms et tags
    const processedImages = images.map(image => {
      const repoTags = image.RepoTags || [];
      const repoDigests = image.RepoDigests || [];
      
      // Si l'image n'a pas de tag mais a un digest, créer un tag à partir du digest
      if (repoTags.length === 0 && repoDigests.length > 0) {
        const digest = repoDigests[0];
        const [name] = digest.split('@');
        if (name && name !== '<none>') {
          repoTags.push(`${name}:latest`);
        }
      }

      // Si toujours pas de tag, utiliser l'ID court
      const tags = repoTags.length > 0 ? repoTags : [];
      const shortId = image.Id.substring(7, 19);

      return {
        ...image,
        // Ne jamais renvoyer un tableau vide de tags
        RepoTags: tags.length > 0 ? tags : [`sha256:${shortId}`],
        // Ajouter des champs pour faciliter l'affichage
        displayName: tags.length > 0 ? tags[0].split(':')[0] : `sha256:${shortId}`,
        displayTag: tags.length > 0 ? tags[0].split(':')[1] || 'latest' : 'latest'
      };
    });

    // Synchronisation base <-> Docker
    const userId = user.id;
    // Upsert chaque image Docker dans la base et collecte les (name, tag) réellement utilisés
    const allNamesTags: { name: string; tag: string }[] = [];
    for (const image of processedImages) {
      const [name, tag = 'latest'] = image.displayName && image.displayTag
        ? [image.displayName, image.displayTag]
        : (image.RepoTags[0] || '').split(':');
      const safeName = name || 'none';
      const safeTag = tag || 'latest';
      allNamesTags.push({ name: safeName, tag: safeTag });
      // Log avant upsert
      console.log('[UPsert] userId:', userId, 'name:', safeName, 'tag:', safeTag, 'size:', image.Size, 'created:', image.Created);
      try {
        await prisma.dockerImage.upsert({
          where: {
            userId_name_tag: {
              userId,
              name: safeName,
              tag: safeTag
            }
          },
          update: {
            size: image.Size,
            created: new Date(image.Created * 1000)
          },
          create: {
            userId,
            name: safeName,
            tag: safeTag,
            size: image.Size,
            created: new Date(image.Created * 1000)
          }
        });
      } catch (err) {
        console.error('[UPSERT ERROR]', err);
        throw new Error('UPSERT ERROR: ' + (err instanceof Error ? err.message : String(err)));
      }
    }
    // Log avant deleteMany
    console.log('[DeleteMany] userId:', userId, 'allNamesTags:', allNamesTags);
    await prisma.dockerImage.deleteMany({
      where: {
        userId,
        NOT: {
          OR: allNamesTags.map(({ name, tag }) => ({ name, tag }))
        }
      }
    });

    // Trier les images : d'abord celles avec des tags, puis par date
    const sortedImages = processedImages.sort((a, b) => {
      // Priorité aux images avec des vrais tags
      const aHasTag = a.RepoTags.length > 0 && !a.RepoTags[0].startsWith('sha256:');
      const bHasTag = b.RepoTags.length > 0 && !b.RepoTags[0].startsWith('sha256:');
      if (aHasTag !== bHasTag) {
        return aHasTag ? -1 : 1;
      }
      // Ensuite par date
      return b.Created - a.Created;
    });

    return new NextResponse(JSON.stringify(sortedImages), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Error listing images:', error);
    return new NextResponse(
      JSON.stringify({
        error: true,
        message: error.message || 'Failed to list images'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
