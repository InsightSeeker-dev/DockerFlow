'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ProfileMenu } from "@/components/admin/profile-menu";

export function Navbar() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    return pathname === path;
  };

  return (
    <div className="border-b">
      <div className="flex h-16 items-center px-4">
        <nav className="flex items-center space-x-4 lg:space-x-6 mx-6">
          <Link
            href="/dashboard"
            className={cn(
              "text-sm font-medium transition-colors hover:text-primary",
              isActive("/dashboard")
                ? "text-black dark:text-white"
                : "text-muted-foreground"
            )}
          >
            Overview
          </Link>
          <Link
            href="/dashboard/containers"
            className={cn(
              "text-sm font-medium transition-colors hover:text-primary",
              isActive("/dashboard/containers")
                ? "text-black dark:text-white"
                : "text-muted-foreground"
            )}
          >
            Conteneurs
          </Link>
          <Link
            href="/volumes"
            className={cn(
              "text-sm font-medium transition-colors hover:text-primary",
              isActive("/volumes")
                ? "text-black dark:text-white"
                : "text-muted-foreground"
            )}
          >
            Volumes
          </Link>
          <Link
            href="/dashboard/images"
            className={cn(
              "text-sm font-medium transition-colors hover:text-primary",
              isActive("/dashboard/images")
                ? "text-black dark:text-white"
                : "text-muted-foreground"
            )}
          >
            Images
          </Link>
        </nav>
        <div className="ml-auto flex items-center space-x-4">
          <ProfileMenu />
        </div>
      </div>
    </div>
  );
}
