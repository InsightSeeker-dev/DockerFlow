import { NextAuthOptions } from "next-auth";
import type { User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { Adapter } from "next-auth/adapters";
import { PrismaUser } from "@/types/prisma";
import { UserStatus } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      username: string;
      emailVerified: Date | null;
      role: string;
      status: string;
      image?: string | null;
    }
  }
  interface User extends PrismaUser {}
  interface JWT {
    id: string;
    role: string;
    status: string;
    emailVerified: Date | null;
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 jours
  },
  pages: {
    signIn: '/auth',
    error: '/auth?error=AuthError',
    verifyRequest: '/verify-request',
  },
  debug: process.env.NODE_ENV === 'development',
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(
        credentials: Record<"email" | "password", string> | undefined
      ): Promise<User | null> {
        try {
          if (!credentials?.email || !credentials?.password) {
            console.error('Missing credentials');
            return null;
          }

          const user = await prisma.user.findUnique({
            where: {
              email: credentials.email.toLowerCase()
            },
            select: {
              id: true,
              email: true,
              name: true,
              username: true,
              password: true,
              role: true,
              status: true,
              emailVerified: true,
              image: true
            }
          });

          if (!user || !user.password) {
            console.error('User not found or no password');
            return null;
          }

          const isValidPassword = await compare(
            credentials.password,
            user.password
          );

          if (!isValidPassword) {
            console.error('Invalid password');
            return null;
          }

          if (user.status !== UserStatus.ACTIVE) {
            console.error('Account not active');
            throw new Error('Please verify your email before logging in');
          }

          // Update lastLogin
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() }
          });

          // Convert to NextAuth User type
          const { password: _, ...userWithoutPassword } = user;
          return userWithoutPassword as User;
        } catch (error) {
          console.error('Auth error:', error);
          throw error;
        }
      }
    })
  ],
  callbacks: {
    async signIn({ user }) {
      if (user.status !== UserStatus.ACTIVE) {
        throw new Error('Please verify your email before logging in');
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.status = user.status;
        token.emailVerified = user.emailVerified;
      }

      // Handle session update
      if (trigger === "update" && session) {
        return { ...token, ...session };
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.status = token.status as string;
        session.user.emailVerified = token.emailVerified as Date | null;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Permet la redirection vers les URL internes
      if (url.startsWith(baseUrl)) return url;
      // Permet la redirection vers les URL relatives
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      return baseUrl;
    }
  }
};

export function validateAdmin(session: any) {
  return session?.user?.role === 'ADMIN';
}