import { NextAuthOptions } from "next-auth";
import { Adapter } from "next-auth/adapters";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./prisma";
import { UserRole, UserStatus, ActivityType } from "@prisma/client";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { User } from "next-auth";
import { JWT } from "next-auth/jwt";
import { logActivity } from "./activity";

// Types de base pour l'utilisateur
interface BaseUser {
  id: string;
  name: string | null;
  username: string | null;
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
    sessionId?: string;
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  session: {
    strategy: "jwt",
    maxAge: 2 * 60 * 60, // 2 heures
  },
  pages: {
    signIn: '/auth',
    error: '/auth',
    signOut: '/auth',
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!user || !user.email) {
        return false;
      }

      const dbUser = await prisma.user.findUnique({
        where: { email: user.email },
        select: { 
          id: true,
          status: true,
          role: true,
          emailVerified: true
        }
      });

      // Vérifier si l'utilisateur existe et est actif
      if (!dbUser) return false;
      
      // Les administrateurs peuvent se connecter même sans vérification
      if (dbUser.role !== UserRole.ADMIN && !dbUser.emailVerified) {
        return false;
      }
      
      // Vérifier le statut de l'utilisateur
      if (dbUser.status !== UserStatus.ACTIVE) {
        return false;
      }

      // Enregistrer l'activité de connexion
      await logActivity({
        type: ActivityType.USER_LOGIN,
        description: `User ${user.email} logged in`,
        userId: dbUser.id,
      });

      // Si ce n'est pas un admin, vérifier et nettoyer les sessions existantes
      if (dbUser.role !== UserRole.ADMIN) {
        const existingSessions = await prisma.session.findMany({
          where: {
            userId: dbUser.id,
            expires: { gt: new Date() }
          },
        });

        // Si plus de 2 sessions actives, supprimer la plus ancienne
        if (existingSessions.length >= 2) {
          const oldestSession = existingSessions.reduce((prev, current) => 
            prev.expires < current.expires ? prev : current
          );
          
          await prisma.session.delete({
            where: { id: oldestSession.id }
          });
        }
      }

      return true;
    },
    async jwt({ token, user, trigger, session }) {
      try {
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

        // Vérification périodique
        const lastChecked = token.lastChecked || 0;
        if (Date.now() > lastChecked + 5 * 60 * 1000) { // Vérifier toutes les 5 minutes
          const user = await prisma.user.findUnique({
            where: { id: token.id },
            select: { 
              status: true,
              role: true,
              sessions: {
                where: {
                  expires: { gt: new Date() }
                }
              }
            },
          });

          if (!user || user.status !== UserStatus.ACTIVE) {
            throw new Error('Invalid user state');
          }

          // Pour les non-admins, vérifier le nombre de sessions
          if (user.role !== UserRole.ADMIN && user.sessions.length > 2) {
            throw new Error('Too many active sessions');
          }

          return {
            ...token,
            lastChecked: Date.now(),
          };
        }

        return token;
      } catch (error) {
        return {
          ...token,
          status: UserStatus.INACTIVE,
          lastChecked: Date.now(),
        };
      }
    },
    async session({ session, token }) {
      try {
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
        return {
          ...session,
          user: {
            ...session.user,
            status: UserStatus.INACTIVE,
          },
        };
      }
    },
  },
  events: {
    async signOut({ token }) {
      if (token) {
        // Enregistrer l'activité de déconnexion
        await logActivity({
          type: ActivityType.USER_LOGOUT,
          description: `User logged out`,
          userId: token.id,
        });

        // Supprimer toutes les sessions de l'utilisateur
        await prisma.session.deleteMany({
          where: { userId: token.id }
        });
      }
    }
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials): Promise<User | null> {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password required');
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          select: {
            id: true,
            email: true,
            name: true,
            password: true,
            role: true,
            status: true,
            username: true,
            image: true,
            emailVerified: true,
          },
        });

        if (!user) {
          throw new Error('No user found');
        }

        if (user.status !== UserStatus.ACTIVE) {
          throw new Error('User account is not active');
        }

        if (user.role !== UserRole.ADMIN && !user.emailVerified) {
          throw new Error('Please verify your email first');
        }

        const isValid = await compare(credentials.password, user.password);
        if (!isValid) {
          throw new Error('Invalid password');
        }

        // S'assurer que le username est toujours une chaîne
        const username = user.username || user.email.split('@')[0];

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          username: username,
          image: user.image,
        } as User;
      },
    })
  ],
};

export function validateAdmin(session: { user?: { role?: UserRole; status?: UserStatus } } | null): boolean {
  return session?.user?.role === UserRole.ADMIN && session?.user?.status === UserStatus.ACTIVE;
}