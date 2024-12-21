'use client';

import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin, hasValidStatus } from '@/lib/utils/auth-helpers';
import AdminDashboard from '@/components/admin/AdminDashboard';

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session || !hasValidStatus(session)) {
    redirect('/auth');
  }

  if (!isAdmin(session)) {
    redirect('/dashboard');
  }

  return <AdminDashboard />;
}
