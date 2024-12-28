const { MongoClient } = require('mongodb');
require('dotenv').config();

async function migrateUserRoles() {
  const client = new MongoClient(process.env.DATABASE_URL);

  try {
    await client.connect();
    const db = client.db();

    // Mise à jour des rôles
    await db.collection('users').updateMany(
      { role: 'admin' },
      { $set: { role: 'ADMIN' } }
    );

    await db.collection('users').updateMany(
      { role: 'user' },
      { $set: { role: 'USER' } }
    );

    await db.collection('users').updateMany(
      { role: 'super_admin' },
      { $set: { role: 'SUPER_ADMIN' } }
    );

    // Mise à jour des statuts
    await db.collection('users').updateMany(
      { status: 'active' },
      { $set: { status: 'ACTIVE' } }
    );

    await db.collection('users').updateMany(
      { status: 'inactive' },
      { $set: { status: 'INACTIVE' } }
    );

    await db.collection('users').updateMany(
      { status: 'suspended' },
      { $set: { status: 'SUSPENDED' } }
    );

    await db.collection('users').updateMany(
      { status: 'pending' },
      { $set: { status: 'PENDING' } }
    );

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await client.close();
  }
}

migrateUserRoles();
