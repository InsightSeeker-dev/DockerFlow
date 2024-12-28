import { User as PrismaUserType } from "@prisma/client";

export interface PrismaUser extends PrismaUserType {
  username: string;
  role: string;
  status: string;
}
