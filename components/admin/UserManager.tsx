"use client";

import { User } from '@/types/user';
import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { UsersTable } from './UsersTable';
import { Button } from '@/components/ui/button';
import { CreateUserDialog } from './create-user-dialog';
import { EditUserDialog } from './edit-user-dialog';
import { Loader2, Plus, Search, RefreshCw, Users as UsersIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface UserManagerProps {
  onUserSelect: (userId: string) => void;
}

export function UserManager({ onUserSelect }: UserManagerProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetchUsers();
  }, [refreshKey]);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      toast.error('Failed to load users');
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserAction = (action: string, userId: string) => {
    if (action === 'edit') {
      const user = users.find(u => u.id === userId);
      if (user) {
        setEditUser(user);
        setIsEditDialogOpen(true);
      }
      return;
    }
    // Actions classiques (suspend, delete, etc.)
    (async () => {
      try {
        const response = await fetch(`/api/users/${userId}/${action}`, {
          method: 'POST',
        });
        if (!response.ok) throw new Error(`Failed to ${action} user`);
        toast.success(`User ${action}d successfully`);
        setRefreshKey(prev => prev + 1);
      } catch (error) {
        toast.error(`Failed to ${action} user`);
        console.error(`Error ${action}ing user:`, error);
      }
    })();
  };

  const handleBulkAction = async (action: string, userIds: string[]) => {
    try {
      const response = await fetch('/api/users/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, userIds }),
      });
      
      if (!response.ok) throw new Error(`Failed to ${action} users`);
      
      toast.success(`Users ${action}d successfully`);
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      toast.error(`Failed to ${action} users`);
      console.error(`Error ${action}ing users:`, error);
    }
  };

  const handleCreateUser = async (userData: any) => {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to create user' }));
        throw new Error(errorData.message || 'Failed to create user');
      }

      const data = await response.json();
      toast.success('User created successfully. A verification email has been sent.');
      setRefreshKey(prev => prev + 1);
      setIsCreateDialogOpen(false);
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create user';
      toast.error(message);
      console.error('Error creating user:', error);
      throw error; // Propager l'erreur pour que le formulaire puisse la gérer
    }
  };

  const filteredUsers = users.filter(user => {
    const searchTerms = searchQuery.toLowerCase();
    return (
      (user.name?.toLowerCase() || '').includes(searchTerms) ||
      (user.email?.toLowerCase() || '').includes(searchTerms) ||
      (user.role?.toLowerCase() || '').includes(searchTerms)
    );
  });

  // Handler pour la soumission du formulaire d'édition
  const handleEditUser = async (userId: string, data: any) => {
    try {
      const response = await fetch(`/api/users/${userId}/edit`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          password: data.password || undefined, // Ne pas envoyer string vide
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to update user' }));
        throw new Error(errorData.error || errorData.message || 'Failed to update user');
      }
      toast.success('User updated successfully');
      setRefreshKey(prev => prev + 1);
      setIsEditDialogOpen(false);
      setEditUser(null);
    } catch (error: any) {
      const message = error instanceof Error ? error.message : 'Failed to update user';
      toast.error(message);
      console.error('Error updating user:', error);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => setRefreshKey(prev => prev + 1)}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add User
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <UsersTable
          users={filteredUsers}
          onUserAction={handleUserAction}
          onBulkAction={handleBulkAction}
          onUserSelect={onUserSelect}
        />
      )}

      <CreateUserDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSubmit={async (data) => {
          await handleCreateUser(data);
          setRefreshKey(prev => prev + 1);
          setIsCreateDialogOpen(false);
        }}
      />
      <EditUserDialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) setEditUser(null);
        }}
        user={editUser}
        onSubmit={handleEditUser}
      />
    </div>
  );
}
