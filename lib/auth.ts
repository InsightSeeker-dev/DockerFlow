import { NextAuthOptions } from "next-auth";
import type { User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { Adapter } from "next-auth/adapters";
import { PrismaUser } from "@/types/prisma";

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

          if (user.status !== 'ACTIVE') {
            console.error('Account not active');
            return null;
          }

          // Update lastLogin
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() }
          });

          // Convert to NextAuth User type
          const { password: _, ...userWithoutPassword } = user;
          return {
            id: userWithoutPassword.id,
            email: userWithoutPassword.email,
            name: userWithoutPassword.name || '',
            username: userWithoutPassword.username,
            image: userWithoutPassword.image,
            role: userWithoutPassword.role,
            status: userWithoutPassword.status
          } as User;
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.status = user.status;
        token.emailVerified = user.emailVerified;
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
    }
  }
};

export function validateAdmin(session: any) {
  return session?.user?.role === 'ADMIN';
}