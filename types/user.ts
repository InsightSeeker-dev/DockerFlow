export interface User {
  id: string;
  name: string;
  email: string;
  username?: string;
  role: 'ADMIN' | 'USER';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  emailVerified?: Date | null;
  password?: string;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date | null;
  _count?: {
    containers: number;
  };
}

export type UserWithoutDates = Omit<User, 'createdAt' | 'updatedAt'>;
