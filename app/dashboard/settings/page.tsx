"use client";

import { useState } from 'react';
import { useTheme } from 'next-themes';
import { useSession, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function UserSettingsPage() {
  const { data: session, update } = useSession();
  const { theme, setTheme } = useTheme();

  // Password change states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);


  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwLoading(true);
    setPwError(null);
    setPwSuccess(false);
    if (newPassword !== confirmPassword) {
      setPwError('Les mots de passe ne correspondent pas.');
      setPwLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/user/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) throw new Error('Erreur lors du changement de mot de passe');
      setPwSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwError(err.message || 'Erreur inconnue');
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-12">
      <h1 className="text-2xl font-bold text-blue-400">Paramètres</h1>

      {/* Changement de mot de passe */}
      <section className="bg-gray-900/80 rounded-xl p-6 shadow-lg border border-gray-800 flex flex-col gap-5">
        <h2 className="text-lg font-semibold text-gray-200 mb-2">Changer le mot de passe</h2>
        <form onSubmit={handlePasswordChange} className="flex flex-col gap-4">
          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-300 mb-1">Mot de passe actuel</label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={pwLoading}
              required
            />
          </div>
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-300 mb-1">Nouveau mot de passe</label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={pwLoading}
              required
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-1">Confirmer le nouveau mot de passe</label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={pwLoading}
              required
            />
          </div>
          <Button type="submit" disabled={pwLoading} className="w-fit">
            {pwLoading ? 'Changement...' : 'Changer le mot de passe'}
          </Button>
          {pwSuccess && <div className="text-green-500 text-sm">Mot de passe changé avec succès !</div>}
          {pwError && <div className="text-red-500 text-sm">{pwError}</div>}
        </form>
      </section>
      <div className="flex justify-end mt-8">
        <Button variant="destructive" onClick={() => signOut({ callbackUrl: '/' })}>
          Se déconnecter
        </Button>
      </div>
    </div>
  );
}
