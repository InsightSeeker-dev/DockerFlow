'use client';

import { useSession, signOut } from 'next-auth/react';
import { Bell, ChevronDown, Search, User } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

export function Navbar() {
  const { data: session } = useSession();
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <nav className="bg-black/40 backdrop-blur-sm border-b border-gray-800/50">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Search Bar */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-5 w-5 text-gray-400" aria-hidden="true" />
              </div>
              <input
                type="text"
                className="block w-full rounded-lg border border-gray-800/50 bg-black/20 py-2 pl-10 pr-3 text-gray-300 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
                placeholder="Search containers, images..."
              />
            </div>
          </div>

          {/* Right section */}
          <div className="flex items-center space-x-6">
            {/* Notifications */}
            <button className="relative text-gray-400 hover:text-gray-300">
              <Bell className="h-6 w-6" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-xs text-white">
                3
              </span>
            </button>

            {/* Profile dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-3 rounded-lg border border-gray-800/50 bg-black/20 px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800/30"
              >
                {session?.user?.image ? (
                  <Image
                    src={session.user.image}
                    alt="Profile"
                    width={28}
                    height={28}
                    className="rounded-full"
                  />
                ) : (
                  <User className="h-5 w-5 text-gray-400" />
                )}
                <span>{session?.user?.name || 'User'}</span>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </button>

              {/* Dropdown menu */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 rounded-lg border border-gray-800/50 bg-black/90 py-1 shadow-lg backdrop-blur-sm">
                  <a
                    href="/dashboard/profile"
                    className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800/50"
                  >
                    Your Profile
                  </a>
                  <a
                    href="/dashboard/settings"
                    className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800/50"
                  >
                    Settings
                  </a>
                  <button
                    onClick={() => signOut()}
                    className="block w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-800/50"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
