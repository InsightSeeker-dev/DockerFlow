import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { hasValidStatus, isAdmin } from '@/lib/session';
import AdminDashboard from '@/components/admin/AdminDashboard';
import { headers } from 'next/headers';

export default async function AdminDashboardPage() {
  headers(); // Force la fonction à être exécutée dans un contexte de requête

  const session = await getServerSession();

  if (!session) {
    return redirect('/auth');
  }

  if (!hasValidStatus(session)) {
    return redirect('/verify-request');
  }

  if (!isAdmin(session)) {
    return redirect('/dashboard');
  }

  return <AdminDashboard />;
}
