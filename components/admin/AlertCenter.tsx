'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  Info,
  Trash2,
  Filter,
  Download,
  RotateCw,
  Settings2
} from 'lucide-react';
import { toast } from 'sonner';

interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  source: string;
  timestamp: string;
  acknowledged: boolean;
}

interface AlertRule {
  id: string;
  name: string;
  type: string;
  condition: string;
  threshold: number;
  enabled: boolean;
}

export default function AlertCenter() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [filter, setFilter] = useState({
    type: 'all',
    acknowledged: 'all',
    timeRange: '24h'
  });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    fetchAlerts();
    fetchAlertRules();

    if (autoRefresh) {
      const interval = setInterval(fetchAlerts, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, filter]);

  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/admin/alerts?' + new URLSearchParams({
        type: filter.type,
        acknowledged: filter.acknowledged,
        timeRange: filter.timeRange
      }));
      
      if (response.ok) {
        const data = await response.json();
        setAlerts(data);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
      toast.error('Erreur lors de la récupération des alertes');
    }
  };

  const fetchAlertRules = async () => {
    try {
      const response = await fetch('/api/admin/alert-rules');
      if (response.ok) {
        const data = await response.json();
        setAlertRules(data);
      }
    } catch (error) {
      console.error('Error fetching alert rules:', error);
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      const response = await fetch(`/api/admin/alerts/${alertId}/acknowledge`, {
        method: 'POST'
      });
      
      if (response.ok) {
        setAlerts(alerts.map(alert => 
          alert.id === alertId 
            ? { ...alert, acknowledged: true }
            : alert
        ));
        toast.success('Alerte acquittée');
      }
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      toast.error('Erreur lors de l\'acquittement de l\'alerte');
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/admin/alerts/${alertId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setAlerts(alerts.filter(alert => alert.id !== alertId));
        toast.success('Alerte supprimée');
      }
    } catch (error) {
      console.error('Error deleting alert:', error);
      toast.error('Erreur lors de la suppression de l\'alerte');
    }
  };

  const handleExport = () => {
    const csvContent = [
      ['ID', 'Type', 'Titre', 'Message', 'Source', 'Date', 'Acquittée'],
      ...alerts.map(alert => [
        alert.id,
        alert.type,
        alert.title,
        alert.message,
        alert.source,
        alert.timestamp,
        alert.acknowledged ? 'Oui' : 'Non'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alerts-${new Date().toISOString()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleToggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/admin/alert-rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      
      if (response.ok) {
        setAlertRules(alertRules.map(rule =>
          rule.id === ruleId ? { ...rule, enabled } : rule
        ));
        toast.success(`Règle ${enabled ? 'activée' : 'désactivée'}`);
      }
    } catch (error) {
      console.error('Error toggling rule:', error);
      toast.error('Erreur lors de la modification de la règle');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Centre d'alertes</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <Label>Actualisation auto</Label>
          </div>
          <Button variant="outline" onClick={() => setShowSettings(!showSettings)}>
            <Settings2 className="h-4 w-4 mr-2" />
            Paramètres
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exporter
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtres
            </CardTitle>
            <Button variant="outline" size="sm" onClick={fetchAlerts}>
              <RotateCw className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label>Type</Label>
              <Select
                value={filter.type}
                onValueChange={(value) => setFilter({ ...filter, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="error">Erreurs</SelectItem>
                  <SelectItem value="warning">Avertissements</SelectItem>
                  <SelectItem value="info">Informations</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Statut</Label>
              <Select
                value={filter.acknowledged}
                onValueChange={(value) => setFilter({ ...filter, acknowledged: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="false">Non acquittées</SelectItem>
                  <SelectItem value="true">Acquittées</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Période</Label>
              <Select
                value={filter.timeRange}
                onValueChange={(value) => setFilter({ ...filter, timeRange: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">Dernière heure</SelectItem>
                  <SelectItem value="24h">24 heures</SelectItem>
                  <SelectItem value="7d">7 jours</SelectItem>
                  <SelectItem value="30d">30 jours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alert List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Alertes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {alerts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Aucune alerte pour le moment
              </div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 border rounded-lg ${
                    alert.type === 'error'
                      ? 'border-red-600 bg-red-500/10'
                      : alert.type === 'warning'
                      ? 'border-yellow-600 bg-yellow-500/10'
                      : alert.type === 'success'
                      ? 'border-green-600 bg-green-500/10'
                      : 'border-blue-600 bg-blue-500/10'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {alert.type === 'error' ? (
                      <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                    ) : alert.type === 'warning' ? (
                      <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                    ) : alert.type === 'success' ? (
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    ) : (
                      <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{alert.title}</h3>
                          {alert.acknowledged && (
                            <Badge variant="outline" className="text-green-500">
                              Acquittée
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm text-gray-400">
                          {new Date(alert.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 mt-1">{alert.message}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm text-gray-400">
                          Source: {alert.source}
                        </span>
                        <div className="flex items-center gap-2">
                          {!alert.acknowledged && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAcknowledge(alert.id)}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Acquitter
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteAlert(alert.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Alert Rules */}
      {showSettings && (
        <Card>
          <CardHeader>
            <CardTitle>Règles d'alerte</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {alertRules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-medium">{rule.name}</h3>
                    <p className="text-sm text-gray-400">
                      {rule.type} {rule.condition} {rule.threshold}%
                    </p>
                  </div>
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={(checked) => handleToggleRule(rule.id, checked)}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
