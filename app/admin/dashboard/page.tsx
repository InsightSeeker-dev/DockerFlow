'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AdminDashboard from '@/components/admin/AdminDashboard';

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Rediriger si l'utilisateur n'est pas admin
  if (status === 'authenticated' && session?.user?.role !== 'admin') {
    router.push('/dashboard');
    return null;
  }

  if (status === 'unauthenticated') {
    router.push('/auth');
    return null;
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return <AdminDashboard />;
}
