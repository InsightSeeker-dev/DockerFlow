import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

export async function createAdmin(email: string, password: string) {
  const prisma = new PrismaClient();
  
  try {
    const hashedPassword = await hash(password, 12);
    
    const admin = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        username: email.split('@')[0],
        role: 'admin',
        status: 'active',
        emailVerified: new Date(),
        cpuLimit: 4000,
        memoryLimit: 8589934592,
        storageLimit: 107374182400
      }
    });
    
    console.log('Admin created:', admin);
    return admin;
  } catch (error) {
    console.error('Error creating admin:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
