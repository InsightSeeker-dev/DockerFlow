import { NextAuthOptions } from "next-auth";
import { Adapter } from "next-auth/adapters";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { UserRole, UserStatus } from "@prisma/client";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { User } from "next-auth";
import { JWT } from "next-auth/jwt";

// Types de base pour l'utilisateur
interface BaseUser {
  id: string;
  name: string | null;
  username: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  image: string | null;
}

// Extension des types Next-Auth
declare module "next-auth" {
  interface User extends BaseUser {}
  interface Session {
    user: BaseUser;
    expires: string;
  }
}

// Extension du token JWT
declare module "next-auth/jwt" {
  interface JWT extends Omit<BaseUser, 'username'> {
    lastChecked?: number;
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  session: {
    strategy: "jwt",
    maxAge: 4 * 60 * 60, // 4 heures
  },
  pages: {
    signIn: '/auth',
    error: '/auth',
    signOut: '/auth',
  },
  callbacks: {
    async signIn({ user }) {
      // Vérifier si l'utilisateur existe et est actif
      if (!user || !user.email) {
        return false;
      }

      const dbUser = await prisma.user.findUnique({
        where: { email: user.email },
        select: { status: true }
      });

      if (!dbUser || dbUser.status !== UserStatus.ACTIVE) {
        return false;
      }

      return true;
    },
    async jwt({ token, user, trigger, session }) {
      try {
        // Mise à jour du token si l'utilisateur vient de se connecter
        if (user) {
          return {
            ...token,
            id: user.id,
            name: user.name ?? null,
            email: user.email,
            role: user.role,
            status: user.status,
            image: user.image ?? null,
            lastChecked: Date.now(),
          };
        }

        // Mise à jour du token si la session est mise à jour
        if (trigger === 'update' && session) {
          const updatedUser = await prisma.user.findUnique({
            where: { id: token.id },
            select: {
              role: true,
              status: true,
              name: true,
              image: true,
            },
          });

          if (!updatedUser || updatedUser.status !== UserStatus.ACTIVE) {
            throw new Error('Invalid user state');
          }

          return {
            ...token,
            name: updatedUser.name,
            role: updatedUser.role,
            status: updatedUser.status,
            image: updatedUser.image,
            lastChecked: Date.now(),
          };
        }

        // Vérification périodique du statut utilisateur
        const lastChecked = token.lastChecked || 0;
        if (Date.now() > lastChecked + 5 * 60 * 1000) { // Vérifier toutes les 5 minutes
          const user = await prisma.user.findUnique({
            where: { id: token.id },
            select: { status: true },
          });

          if (!user || user.status !== UserStatus.ACTIVE) {
            throw new Error('Invalid user state');
          }

          return {
            ...token,
            lastChecked: Date.now(),
          };
        }

        return token;
      } catch (error) {
        // En cas d'erreur, retourner un token minimal qui forcera une déconnexion
        return {
          ...token,
          status: UserStatus.INACTIVE,
          lastChecked: Date.now(),
        };
      }
    },
    async session({ session, token }) {
      try {
        // Vérification complète du token
        if (!token || !token.email || !token.role || !token.status || token.status !== UserStatus.ACTIVE) {
          return {
            ...session,
            user: {
              ...session.user,
              status: UserStatus.INACTIVE,
            },
          };
        }

        return {
          ...session,
          user: {
            ...session.user,
            id: token.id,
            name: token.name,
            email: token.email,
            role: token.role,
            status: token.status,
            image: token.image,
            username: session.user?.username || token.email.split('@')[0],
          },
        };
      } catch (error) {
        console.error('Session error:', error);
        // En cas d'erreur, retourner une session invalide mais bien typée
        return {
          ...session,
          user: {
            ...session.user,
            status: UserStatus.INACTIVE,
          },
        };
      }
    },
    async redirect({ url, baseUrl }) {
      // Si l'URL est déjà absolue et commence par le baseUrl
      if (url.startsWith(baseUrl)) {
        return url;
      }

      // Si c'est une URL relative
      if (url.startsWith('/')) {
        // Ne pas rediriger vers verify-request
        if (url.includes('verify-request')) {
          return `${baseUrl}/auth?error=AccountInactive`;
        }
        return `${baseUrl}${url}`;
      }

      // Par défaut, rediriger vers la page d'accueil
      return baseUrl;
    },
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials): Promise<User | null> {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
          select: {
            id: true,
            email: true,
            name: true,
            username: true,
            password: true,
            role: true,
            status: true,
            image: true
          }
        });

        if (!user || !user.password) {
          return null;
        }

        const isValidPassword = await compare(credentials.password, user.password);
        if (!isValidPassword) {
          return null;
        }

        if (user.status !== UserStatus.ACTIVE) {
          return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() }
        });

        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword as User;
      }
    })
  ]
};

export function validateAdmin(session: { user?: { role?: UserRole; status?: UserStatus } } | null): boolean {
  return session?.user?.role === UserRole.ADMIN && session?.user?.status === UserStatus.ACTIVE;
}