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
      console.log('[NextAuth][signIn] user:', user, 'account:', account);

      if (!user || !user.email) {
        return false;
      }

      const dbUser = await prisma.user.findUnique({
        // Debug: log recherche user
        // console.log('[NextAuth][signIn] Recherche dbUser for', user?.email);

        where: { email: user.email },
        select: { 
          id: true,
          status: true,
          role: true,
          emailVerified: true
        }
      });

      // Vérifier si l'utilisateur existe et est actif
      if (!dbUser) {
        console.warn('[NextAuth][signIn] Aucun utilisateur trouvé');
        return false;
      }
      
      // Les administrateurs peuvent se connecter même sans vérification
      if (dbUser.role !== UserRole.ADMIN && !dbUser.emailVerified) {
        console.warn('[NextAuth][signIn] Email non vérifié pour user', dbUser.id);

        return false;
      }
      
      // Vérifier le statut de l'utilisateur
      if (dbUser.status !== UserStatus.ACTIVE) {
        console.warn('[NextAuth][signIn] Compte inactif pour user', dbUser.id);

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
        // Debug: log sessions actives
        // console.log('[NextAuth][signIn] Vérification sessions actives pour', dbUser.id);

        const existingSessions = await prisma.session.findMany({
          where: {
            userId: dbUser.id,
            expires: { gt: new Date() }
          },
        });

        // Si plus de 2 sessions actives, supprimer la plus ancienne
        if (existingSessions.length >= 2) {
          console.warn('[NextAuth][signIn] Trop de sessions actives pour', dbUser.id, '=> suppression de la plus ancienne');
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
      console.log('[NextAuth][jwt] token:', token, 'user:', user, 'trigger:', trigger, 'session:', session);
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

          console.log('[NextAuth][jwt] updatedUser:', updatedUser);

          if (!updatedUser || updatedUser.status !== UserStatus.ACTIVE) {
            console.warn('[NextAuth][jwt] Utilisateur inactif lors de l\'update', token.id);
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

          console.log('[NextAuth][jwt] user:', user);

          if (!user || user.status !== UserStatus.ACTIVE) {
            console.warn('[NextAuth][jwt] Utilisateur inactif lors de la vérification périodique', token.id);
            throw new Error('Invalid user state');
          }

          // Pour les non-admins, vérifier le nombre de sessions
          if (user.role !== UserRole.ADMIN && user.sessions.length > 2) {
            console.warn('[NextAuth][jwt] Trop de sessions actives pour', token.id);
            throw new Error('Too many active sessions');
          }

          return {
            ...token,
            lastChecked: Date.now(),
          };
        }

        return token;
      } catch (error) {
        console.error('[NextAuth][jwt] Erreur callback:', error);
        return {
          ...token,
          status: UserStatus.INACTIVE,
          lastChecked: Date.now(),
        };
      }
    },
    async session({ session, token }) {
      console.log('[NextAuth][session] session:', session, 'token:', token);
      try {
        if (!token || !token.email || !token.role || !token.status || token.status !== UserStatus.ACTIVE) {
          console.warn('[NextAuth][session] Token invalide ou utilisateur inactif');
          return {
            ...session,
            user: {
              ...session.user,
              status: UserStatus.INACTIVE,
            },
          };
        }

        console.log('[NextAuth][session] Session valide pour', token.email);
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
        console.error('[NextAuth][session] Session error:', error);
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
      console.log('[NextAuth][signOut] token:', token);
      if (token) {
        // Enregistrer l'activité de déconnexion
        await logActivity({
          type: ActivityType.USER_LOGOUT,
          description: `User logged out`,
          userId: token.id,
        });

        // Supprimer toutes les sessions de l'utilisateur
        console.warn('[NextAuth][signOut] Suppression des sessions pour', token?.id);
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
        console.log('[NextAuth][authorize] credentials:', credentials);
        if (!credentials?.email || !credentials?.password) {
          console.warn('[NextAuth][authorize] Email ou mot de passe manquant');
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

        console.log('[NextAuth][authorize] user:', user);

        if (!user) {
          console.warn('[NextAuth][authorize] Aucun utilisateur trouvé pour', credentials.email);
          throw new Error('No user found');
        }

        if (user.status !== UserStatus.ACTIVE) {
          console.warn('[NextAuth][authorize] Compte inactif pour', user.id);
          throw new Error('User account is not active');
        }

        if (user.role !== UserRole.ADMIN && !user.emailVerified) {
          console.warn('[NextAuth][authorize] Email non vérifié pour', user.id);
          throw new Error('Please verify your email first');
        }

        const isValid = await compare(credentials.password, user.password);
        if (!isValid) {
          console.warn('[NextAuth][authorize] Mauvais mot de passe pour', user.id);
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