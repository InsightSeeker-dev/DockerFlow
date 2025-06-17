import { redirect } from 'next/navigation';

export default function LoginPage() {
  // Redirige immédiatement vers la page principale (accueil ou vraie page de connexion)
  redirect('/');
  return null;
}
