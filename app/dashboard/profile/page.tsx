"use client";

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function UserProfilePage() {
  const { data: session, update } = useSession();
  const [name, setName] = useState('');
  useEffect(() => {
    if (session?.user?.name && name !== session.user.name) {
      setName(session.user.name);
    }
  }, [session?.user?.name]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Erreur lors de la mise à jour');
      const updated = await update();
      if (updated?.user?.name) {
        setName(updated.user.name);
      }
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return <div>Chargement…</div>;
  }
  return (
    <div className="max-w-xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-blue-400">Mon profil</h1>
      <form onSubmit={handleUpdateProfile} className="bg-gray-900/80 rounded-xl p-6 shadow-lg border border-gray-800 flex flex-col gap-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">Nom</label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Votre nom"
            disabled={loading}
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">Email</label>
          <Input
            id="email"
            value={session?.user?.email || ''}
            disabled
            className="bg-gray-800 text-gray-400"
          />
        </div>
        <Button type="submit" disabled={loading || !name.trim()} className="w-fit">
          {loading ? 'Mise à jour...' : 'Mettre à jour'}
        </Button>
        {success && <div className="text-green-500 text-sm">Profil mis à jour !</div>}
        {error && <div className="text-red-500 text-sm">{error}</div>}
      </form>
    </div>
  );
}
