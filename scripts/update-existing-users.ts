const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Récupérer tous les utilisateurs
  const users = await prisma.user.findMany();
  console.log(`Found ${users.length} users`);

  // Mettre à jour chaque utilisateur
  for (const user of users) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        role: 'admin',
        cpuLimit: 4000,
        memoryLimit: 8589934592,
        storageLimit: 107374182400,
        cpuThreshold: 80,
        memoryThreshold: 85,
        storageThreshold: 90,
      },
    });
    console.log(`Updated user ${user.email} to admin with new resource limits`);
  }

  console.log('All users have been updated to admin with new resource limits');
}

main()
  .catch((error) => {
    console.error('Error updating users:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
