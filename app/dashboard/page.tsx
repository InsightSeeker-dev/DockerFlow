import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { hasValidStatus, isAdmin } from '@/lib/session';
import { headers } from 'next/headers';
import Dashboard from '@/components/dashboard/Dashboard';

export default async function DashboardPage() {
  headers(); // Force la fonction à être exécutée dans un contexte de requête

  const session = await getServerSession();

  if (!session) {
    return redirect('/auth');
  }

  if (!hasValidStatus(session)) {
    return redirect('/auth?error=AccountInactive');
  }

  // Rediriger les admins vers leur dashboard
  if (isAdmin(session)) {
    return redirect('/admin/dashboard');
  }

  return <Dashboard />;
}