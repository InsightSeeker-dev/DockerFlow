import { User as PrismaUser } from "@prisma/client";
import 'next-auth';

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

  // Étendre l'interface User avec tous les champs de PrismaUser
  interface User extends Omit<PrismaUser, 'name'> {
    name: string; // S'assurer que name n'est jamais null
  }

  interface JWT {
    id: string;
    role: string;
    status: string;
    emailVerified: Date | null;
  }
}