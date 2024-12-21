export interface User {
  id: string;
  name: string;
  email: string;
  username?: string;
  role: 'ADMIN' | 'USER';
  status: 'active' | 'inactive';
  emailVerified?: Date | null;
  password?: string;
  image?: string | null;
  created_at: Date;
  updated_at: Date;
  isActive: boolean;
}

export type UserWithoutDates = Omit<User, 'created_at' | 'updated_at'>;
