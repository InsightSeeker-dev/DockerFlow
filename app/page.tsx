// app/page.tsx
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function Home() {
  headers(); // Force la fonction à être exécutée dans un contexte de requête

  const session = await getServerSession();

  if (!session) {
    return redirect('/auth');
  }

  // Rediriger vers le dashboard approprié en fonction du rôle
  if (session.user.role === 'ADMIN') {
    return redirect('/admin/dashboard');
  }

  return redirect('/dashboard');
}