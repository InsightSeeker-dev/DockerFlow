'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Activity, Cpu, HardDrive, Network } from 'lucide-react';

export default function ResourceMonitoring() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Surveillance des ressources système</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* CPU Usage */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">CPU</span>
                <Cpu className="h-4 w-4 text-gray-400" />
              </div>
              <div className="text-2xl font-bold">0%</div>
              <div className="text-sm text-gray-400">0/4 cores</div>
            </div>

            {/* Memory Usage */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Mémoire</span>
                <Activity className="h-4 w-4 text-gray-400" />
              </div>
              <div className="text-2xl font-bold">0%</div>
              <div className="text-sm text-gray-400">0/16 GB</div>
            </div>

            {/* Disk Usage */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Stockage</span>
                <HardDrive className="h-4 w-4 text-gray-400" />
              </div>
              <div className="text-2xl font-bold">0%</div>
              <div className="text-sm text-gray-400">0/100 GB</div>
            </div>

            {/* Network Usage */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Réseau</span>
                <Network className="h-4 w-4 text-gray-400" />
              </div>
              <div className="text-2xl font-bold">0 MB/s</div>
              <div className="text-sm text-gray-400">↑0 MB/s ↓0 MB/s</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Historical Data */}
      <Card>
        <CardHeader>
          <CardTitle>Historique d'utilisation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-gray-400">
            Graphique d'utilisation à venir
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
