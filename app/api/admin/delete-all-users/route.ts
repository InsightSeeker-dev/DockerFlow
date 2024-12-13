import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    // Vérifier que l'utilisateur est connecté et est admin
    if (!session?.user?.role || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Vérifier le secret d'administration pour plus de sécurité
    const { searchParams } = new URL(request.url);
    const adminSecret = searchParams.get('adminSecret');

    if (adminSecret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Invalid admin secret' }, { status: 401 });
    }

    // Supprimer tous les utilisateurs
    await prisma.user.deleteMany({});

    return NextResponse.json({
      success: true,
      message: 'All users have been deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting users:', error);
    return NextResponse.json(
      { error: 'An error occurred while deleting users' },
      { status: 500 }
    );
  }
}
