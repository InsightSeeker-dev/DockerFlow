import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { hasValidStatus, isAdmin } from '@/lib/session';
import AdminDashboard from '@/components/admin/AdminDashboard';
import { headers } from 'next/headers';
import { authOptions } from '@/lib/auth';

export default async function AdminDashboardPage() {
  headers(); // Force la fonction à être exécutée dans un contexte de requête

  const session = await getServerSession(authOptions);

  // Log pour le débogage
  console.log('AdminDashboardPage:', {
    hasSession: !!session,
    isValidStatus: hasValidStatus(session),
    isAdminUser: isAdmin(session),
    userRole: session?.user?.role,
    userStatus: session?.user?.status
  });

  if (!session) {
    return redirect('/auth');
  }

  if (!hasValidStatus(session)) {
    return redirect('/auth?error=AccountInactive');
  }

  if (!isAdmin(session)) {
    return redirect('/dashboard');
  }

  return <AdminDashboard />;
}
