import { ReactNode } from 'react';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Navbar } from '@/components/dashboard/Navbar';

interface DashboardLayoutProps {
  children: ReactNode;
}

export const metadata = {
  title: 'Dashboard | DockerFlow',
  description: 'Manage your Docker containers with ease',
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <div className="flex h-screen">
        {/* Sidebar */}
        <Sidebar />
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Navbar */}
          <Navbar />
          
          {/* Main Content Area */}
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