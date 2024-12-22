import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return new NextResponse('Token manquant', { status: 400 });
    }

    // Rechercher le token de vérification avec l'utilisateur associé
    const verificationToken = await prisma.verificationToken.findUnique({
      where: {
        token: token,
      },
      include: {
        user: true
      }
    });

    if (!verificationToken) {
      return new NextResponse('Token invalide', { status: 400 });
    }

    // Vérifier si le token n'est pas expiré
    if (verificationToken.expires < new Date()) {
      await prisma.verificationToken.delete({
        where: { id: verificationToken.id },
      });
      return new NextResponse('Token expiré', { status: 400 });
    }

    // Mettre à jour l'utilisateur
    await prisma.user.update({
      where: {
        id: verificationToken.userId,
      },
      data: {
        emailVerified: new Date(),
        status: 'ACTIVE',
      },
    });

    // Supprimer le token utilisé
    await prisma.verificationToken.delete({
      where: { id: verificationToken.id },
    });

    // Rediriger vers la page de succès
    return NextResponse.redirect(new URL('/auth/verify-success', request.url));
  } catch (error) {
    console.error('Error verifying email:', error);
    return new NextResponse('Erreur lors de la vérification de l\'email', { status: 500 });
  }
}
