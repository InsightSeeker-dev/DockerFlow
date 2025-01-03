import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/utils/auth-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!isAdmin(session)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const subdomain = searchParams.get('subdomain');

    if (!subdomain) {
      return NextResponse.json(
        { error: 'Subdomain parameter is required' },
        { status: 400 }
      );
    }

    // Vérifier le format du sous-domaine
    const subdomainRegex = /^[a-zA-Z0-9-]+$/;
    if (!subdomainRegex.test(subdomain)) {
      return NextResponse.json(
        { error: 'Invalid subdomain format' },
        { status: 400 }
      );
    }

    // Vérifier la longueur du sous-domaine
    if (subdomain.length < 3 || subdomain.length > 63) {
      return NextResponse.json(
        { error: 'Subdomain must be between 3 and 63 characters' },
        { status: 400 }
      );
    }

    // Vérifier si le sous-domaine est déjà utilisé
    const existingContainer = await prisma.container.findFirst({
      where: {
        env: {
          equals: { VIRTUAL_HOST: `${subdomain}.dockersphere.ovh` }
        }
      }
    });

    if (existingContainer) {
      return NextResponse.json(
        { error: 'Subdomain is already in use' },
        { status: 409 }
      );
    }

    // Liste des sous-domaines réservés
    const reservedSubdomains = ['www', 'mail', 'ftp', 'admin', 'api', 'traefik'];
    if (reservedSubdomains.includes(subdomain.toLowerCase())) {
      return NextResponse.json(
        { error: 'This subdomain is reserved' },
        { status: 409 }
      );
    }

    return NextResponse.json({
      available: true,
      message: 'Subdomain is available'
    });
  } catch (error) {
    console.error('[CHECK_SUBDOMAIN]', error);
    return NextResponse.json(
      { error: 'Failed to check subdomain availability' },
      { status: 500 }
    );
  }
}
