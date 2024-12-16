import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteAllUsers() {
  try {
    console.log('Starting user deletion...');

    // Supprimer tous les utilisateurs sauf l'admin principal
    const result = await prisma.user.deleteMany({});

    console.log(`Successfully deleted ${result.count} users`);
  } catch (error) {
    console.error('Error deleting users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllUsers();
