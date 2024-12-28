import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function migrateUserRoles() {
  try {
    // Mise à jour directe des rôles en utilisant une requête MongoDB native
    await prisma.$runCommandRaw({
      update: "users",
      updates: [
        {
          q: { role: "admin" },
          u: { $set: { role: "ADMIN" } },
          multi: true
        },
        {
          q: { role: "user" },
          u: { $set: { role: "USER" } },
          multi: true
        },
        {
          q: { role: "super_admin" },
          u: { $set: { role: "SUPER_ADMIN" } },
          multi: true
        }
      ]
    });

    await prisma.$runCommandRaw({
      update: "users",
      updates: [
        {
          q: { status: "active" },
          u: { $set: { status: "ACTIVE" } },
          multi: true
        },
        {
          q: { status: "inactive" },
          u: { $set: { status: "INACTIVE" } },
          multi: true
        },
        {
          q: { status: "suspended" },
          u: { $set: { status: "SUSPENDED" } },
          multi: true
        },
        {
          q: { status: "pending" },
          u: { $set: { status: "PENDING" } },
          multi: true
        }
      ]
    });

    console.log('Migration completed successfully')
  } catch (error) {
    console.error('Migration failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

migrateUserRoles()
