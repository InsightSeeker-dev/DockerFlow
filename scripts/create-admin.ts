import { createAdmin } from './admin-utils';

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.error('Please provide email and password');
    process.exit(1);
  }

  try {
    await createAdmin(email, password);
    console.log('Admin user created successfully');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error('Error creating admin user:', error);
    process.exit(1);
  })
  .finally(async () => {
    // await prisma.$disconnect(); // prisma is not defined in this context
  });
