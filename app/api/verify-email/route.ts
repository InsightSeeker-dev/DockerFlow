import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      // Redirige vers la page de login avec erreur
      return NextResponse.redirect('/auth/login?error=token_missing');
    }

    // Rechercher le token de vérification avec l'utilisateur associé
    console.log('[VERIFY EMAIL] Token received:', token);
    const verificationToken = await prisma.verificationToken.findUnique({
      where: {
        token: token,
      },
      include: {
        user: true
      }
    });
    console.log('[VERIFY EMAIL] Token found in DB:', verificationToken);

    if (!verificationToken) {
      // Redirige vers la page de login avec erreur
      return NextResponse.redirect('/auth/login?error=token_invalid');
    }

    // Vérifier si le token n'est pas expiré
    if (verificationToken.expires < new Date()) {
      await prisma.verificationToken.delete({
        where: { id: verificationToken.id },
      });
      // Redirige vers la page de login avec erreur
      return NextResponse.redirect('/auth/login?error=token_expired');
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

    // Rediriger vers la page de succès (URL relative pour compatibilité prod)
    return NextResponse.redirect('/auth/verify-success');
  } catch (error) {
    console.error('Error verifying email:', error);
    // Redirige vers la page de login avec erreur générique
    return NextResponse.redirect('/auth/login?error=verification_failed');
  }
}
