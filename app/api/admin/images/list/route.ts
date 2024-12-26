import { NextRequest, NextResponse } from 'next/server';
import Docker from 'dockerode';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
    const images = await docker.listImages();

    // Trier les images par date de création (plus récentes en premier)
    const sortedImages = images.sort((a, b) => b.Created - a.Created);

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
