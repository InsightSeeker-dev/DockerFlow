'use client';

import { Container } from '@/components/ui/container';
import { UserList } from '@/components/admin/user-list';
import { CreateUserDialog } from '@/components/admin/create-user-dialog';
import { useUsers } from '@/hooks/use-admin';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { useState } from 'react';

export default function UsersPage() {
  const { data: session } = useSession();
  const { users, isLoading, error, refresh } = useUsers();
  const [dialogOpen, setDialogOpen] = useState(false);

  if (session?.user?.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  const handleSubmit = async (data: any) => {
    try {
      // Appeler l'API pour créer l'utilisateur
      const response = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to create user');
      }

      // Rafraîchir la liste des utilisateurs
      await refresh();
    } catch (error) {
      console.error('Error creating user:', error);
    }
  };

  return (
    <Container>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Users</h1>
          <CreateUserDialog 
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            onSubmit={handleSubmit}
          />
        </div>

        <div className="grid gap-6">
          <UserList 
            users={users} 
            isLoading={isLoading}
            error={error}
            onRefresh={refresh}
          />
        </div>
      </div>
    </Container>
  );
}