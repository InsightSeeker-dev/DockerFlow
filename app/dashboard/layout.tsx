'use client';

import { ReactNode } from 'react';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <div className="flex h-screen">
        {/* Sidebar placeholder (à remplacer par un vrai composant si besoin) */}
        <aside className="w-64 bg-gray-950/80 border-r border-gray-800 flex flex-col p-6 justify-between">
          <div>
            <h2 className="text-xl font-bold text-blue-400 mb-8">DockerFlow</h2>
            <nav className="flex flex-col gap-4">
              <a href="/dashboard" className="text-gray-300 hover:text-blue-400">Accueil</a>
              <a href="/dashboard/containers" className="text-gray-300 hover:text-blue-400">Containers</a>
              <a href="/dashboard/images" className="text-gray-300 hover:text-blue-400">Images</a>
              <a href="/dashboard/profile" className="text-gray-300 hover:text-blue-400">Profil</a>
              <a href="/dashboard/settings" className="text-gray-300 hover:text-blue-400">Paramètres</a>
            </nav>
          </div>
          <div className="mt-8">
            <Button variant="destructive" className="w-full" onClick={() => signOut({ callbackUrl: '/' })}>
              Se déconnecter
            </Button>
          </div>
        </aside>
        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Navbar placeholder */}
          <header className="h-16 flex items-center px-8 border-b border-gray-800 bg-gray-950/70">
            <span className="text-lg text-gray-200 font-semibold">Mon espace utilisateur</span>
          </header>
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-black/20 backdrop-blur-sm">
            <div className="container mx-auto px-6 py-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
