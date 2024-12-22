"use client";

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { UsersTable } from './UsersTable';
import { Button } from '@/components/ui/button';
import { CreateUserDialog } from './create-user-dialog';
import { Loader2, Plus, Search, RefreshCw, Users as UsersIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  emailVerified: Date | null;
  _count: {
    containers: number;
  };
}

interface UserManagerProps {
  onUserSelect: (userId: string) => void;
}

export function UserManager({ onUserSelect }: UserManagerProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
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

  const handleUserAction = async (action: string, userId: string) => {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <UsersIcon className="h-6 w-6" />
            User Management
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setRefreshKey(prev => prev + 1)}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add New User
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <UsersTable
            users={filteredUsers}
            onUserAction={handleUserAction}
            onBulkAction={handleBulkAction}
            onUserSelect={onUserSelect}
          />
        </div>

        <CreateUserDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          onSubmit={handleCreateUser}
        />
      </CardContent>
    </Card>
  );
}
