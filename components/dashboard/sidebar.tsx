'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  BoxIcon,
  LayoutDashboardIcon,
  ServerIcon,
  SettingsIcon,
  UsersIcon,
} from 'lucide-react';
import { useSession } from 'next-auth/react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboardIcon },
  { name: 'Containers', href: '/dashboard/containers', icon: BoxIcon },
  { name: 'Images', href: '/dashboard/images', icon: ServerIcon },
  { name: 'Settings', href: '/dashboard/settings', icon: SettingsIcon },
];

const adminNavigation = [
  { name: 'Users', href: '/dashboard/admin/users', icon: UsersIcon },
  { name: 'System', href: '/dashboard/admin/system', icon: ServerIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN';

  return (
    <div className="flex w-64 flex-col border-r bg-background">
      <nav className="flex-1 space-y-1 px-2 py-4">
        {navigation.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              'group flex items-center rounded-md px-2 py-2 text-sm font-medium',
              pathname === item.href
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <item.icon className="mr-3 h-5 w-5" />
            {item.name}
          </Link>
        ))}

        {isAdmin && (
          <>
            <div className="mt-8 mb-2 px-2 text-xs font-semibold text-muted-foreground">
              Admin
            </div>
            {adminNavigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'group flex items-center rounded-md px-2 py-2 text-sm font-medium',
                  pathname === item.href
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.name}
              </Link>
            ))}
          </>
        )}
      </nav>
    </div>
  );
}