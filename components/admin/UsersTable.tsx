"use client";

import { User } from '@/types/user';
import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, ShieldAlert, ShieldCheck, User2 } from 'lucide-react';
import { format } from 'date-fns';

interface UsersTableProps {
  users: User[];
  onUserAction: (action: string, userId: string) => void;
  onBulkAction: (action: string, userIds: string[]) => void;
  onUserSelect?: (userId: string) => void;
}

export function UsersTable({ users, onUserAction, onBulkAction, onUserSelect }: UsersTableProps) {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const handleSelectAll = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map(user => user.id));
    }
  };

  const handleSelectUser = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-500/15 text-green-700 hover:bg-green-500/25';
      case 'suspended':
        return 'bg-yellow-500/15 text-yellow-700 hover:bg-yellow-500/25';
      case 'inactive':
        return 'bg-gray-500/15 text-gray-700 hover:bg-gray-500/25';
      default:
        return 'bg-gray-500/15 text-gray-700 hover:bg-gray-500/25';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return <ShieldAlert className="h-4 w-4" />;
      case 'moderator':
        return <ShieldCheck className="h-4 w-4" />;
      default:
        return <User2 className="h-4 w-4" />;
    }
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px] text-center">
              <Checkbox
                checked={selectedUsers.length === users.length}
                onCheckedChange={handleSelectAll}
                aria-label="Select all"
              />
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Containers</TableHead>
            <TableHead className="w-[80px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow
              key={user.id}
              className="hover:bg-muted/50 cursor-pointer"
              onClick={() => onUserSelect?.(user.id)}
            >
              <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedUsers.includes(user.id)}
                  onCheckedChange={() => handleSelectUser(user.id)}
                  aria-label={`Select ${user.name}`}
                />
              </TableCell>
              <TableCell className="font-medium">{user.name}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {getRoleIcon(user.role)}
                  <span className="capitalize">{user.role.toLowerCase()}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant="secondary"
                  className={getStatusColor(user.status)}
                >
                  {user.status}
                </Badge>
              </TableCell>
              <TableCell>{format(new Date(user.createdAt), 'PP')}</TableCell>
              <TableCell>{user._count?.containers || 0}</TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="h-8 w-8 p-0"
                    >
                      <span className="sr-only">Open menu</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => onUserAction('edit', user.id)}
                    >
                      Edit user
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onUserAction('resetPassword', user.id)}
                    >
                      Reset password
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {user.status === 'ACTIVE' ? (
                      <DropdownMenuItem
                        onClick={() => onUserAction('suspend', user.id)}
                        className="text-yellow-600"
                      >
                        Suspend user
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={() => onUserAction('activate', user.id)}
                        className="text-green-600"
                      >
                        Activate user
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => onUserAction('delete', user.id)}
                      className="text-red-600"
                    >
                      Delete user
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {selectedUsers.length > 0 && (
        <div className="flex items-center gap-2 p-4 bg-muted/50">
          <span className="text-sm text-muted-foreground">
            {selectedUsers.length} user(s) selected
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onBulkAction('delete', selectedUsers);
              setSelectedUsers([]);
            }}
            className="text-red-600"
          >
            Delete Selected
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onBulkAction('suspend', selectedUsers);
              setSelectedUsers([]);
            }}
          >
            Suspend Selected
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onBulkAction('activate', selectedUsers);
              setSelectedUsers([]);
            }}
          >
            Activate Selected
          </Button>
        </div>
      )}
    </div>
  );
}
