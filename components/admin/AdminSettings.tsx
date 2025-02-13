'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { signOut } from 'next-auth/react';
import { Settings, LogOut } from 'lucide-react';

export default function AdminSettings() {
  const handleSignOut = () => {
    signOut({ callbackUrl: '/' });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Alertes système</Label>
                <p className="text-sm text-muted-foreground">
                  Recevoir des notifications pour les événements système importants
                </p>
              </div>
              <Switch />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Alertes de sécurité</Label>
                <p className="text-sm text-muted-foreground">
                  Recevoir des notifications pour les événements de sécurité
                </p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sécurité</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Délai d'expiration de session (minutes)</Label>
              <Input type="number" placeholder="30" />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Authentification à deux facteurs</Label>
                <p className="text-sm text-muted-foreground">
                  Activer l'authentification à deux facteurs pour plus de sécurité
                </p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Préférences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Mode sombre</Label>
                <p className="text-sm text-muted-foreground">
                  Activer le thème sombre pour l'interface
                </p>
              </div>
              <Switch />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Actualisation automatique</Label>
                <p className="text-sm text-muted-foreground">
                  Actualiser automatiquement les données du tableau de bord
                </p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
