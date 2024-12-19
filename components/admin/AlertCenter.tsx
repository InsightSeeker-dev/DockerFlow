'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Bell, AlertTriangle, CheckCircle, Info } from 'lucide-react';

const mockAlerts = [
  {
    id: 1,
    type: 'error',
    title: 'Utilisation CPU élevée',
    message: 'Le conteneur web-server-1 utilise plus de 90% du CPU',
    timestamp: new Date().toISOString(),
  },
  {
    id: 2,
    type: 'warning',
    title: 'Mémoire faible',
    message: 'La mémoire système est à 80% de sa capacité',
    timestamp: new Date().toISOString(),
  },
  {
    id: 3,
    type: 'info',
    title: 'Mise à jour disponible',
    message: 'Une nouvelle version de DockerFlow est disponible',
    timestamp: new Date().toISOString(),
  },
];

export default function AlertCenter() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Centre d'alertes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 border rounded-lg ${
                  alert.type === 'error'
                    ? 'border-red-600 bg-red-500/10'
                    : alert.type === 'warning'
                    ? 'border-yellow-600 bg-yellow-500/10'
                    : 'border-blue-600 bg-blue-500/10'
                }`}
              >
                <div className="flex items-start gap-3">
                  {alert.type === 'error' ? (
                    <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                  ) : alert.type === 'warning' ? (
                    <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                  ) : (
                    <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">{alert.title}</h3>
                      <span className="text-sm text-gray-400">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">{alert.message}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Alert Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Paramètres des alertes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h3 className="font-medium">Alertes CPU</h3>
                <p className="text-sm text-gray-400">
                  Notification quand l'utilisation dépasse 90%
                </p>
              </div>
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h3 className="font-medium">Alertes mémoire</h3>
                <p className="text-sm text-gray-400">
                  Notification quand l'utilisation dépasse 80%
                </p>
              </div>
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h3 className="font-medium">Alertes stockage</h3>
                <p className="text-sm text-gray-400">
                  Notification quand l'utilisation dépasse 90%
                </p>
              </div>
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
