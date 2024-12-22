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
  XCircle,
  Plus,
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
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchAlerts();
    fetchAlertRules();
  }, []);

  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/admin/alerts');
      if (response.ok) {
        const data = await response.json();
        setAlerts(data);
      } else {
        throw new Error('Failed to fetch alerts');
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
      toast.error('Failed to fetch alerts');
    } finally {
      setLoading(false);
    }
  };

  const fetchAlertRules = async () => {
    try {
      const response = await fetch('/api/admin/alerts/rules');
      if (response.ok) {
        const data = await response.json();
        setAlertRules(data);
      }
    } catch (error) {
      console.error('Failed to fetch alert rules:', error);
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      const response = await fetch(`/api/admin/alerts/${alertId}/acknowledge`, {
        method: 'PATCH',
      });

      if (response.ok) {
        setAlerts(
          alerts.map((alert) =>
            alert.id === alertId
              ? { ...alert, acknowledged: true }
              : alert
          )
        );
        toast.success('Alert acknowledged');
      } else {
        throw new Error('Failed to acknowledge alert');
      }
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
      toast.error('Failed to acknowledge alert');
    }
  };

  const handleDeleteAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/admin/alerts/${alertId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setAlerts(alerts.filter((alert) => alert.id !== alertId));
        toast.success('Alert deleted');
      } else {
        throw new Error('Failed to delete alert');
      }
    } catch (error) {
      console.error('Failed to delete alert:', error);
      toast.error('Failed to delete alert');
    }
  };

  const toggleAlertRule = async (ruleId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/admin/alerts/rules/${ruleId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled }),
      });

      if (response.ok) {
        setAlertRules(
          alertRules.map((rule) =>
            rule.id === ruleId ? { ...rule, enabled } : rule
          )
        );
        toast.success(`Alert rule ${enabled ? 'enabled' : 'disabled'}`);
      } else {
        throw new Error('Failed to update alert rule');
      }
    } catch (error) {
      console.error('Failed to update alert rule:', error);
      toast.error('Failed to update alert rule');
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const filteredAlerts = alerts
    .filter((alert) => {
      if (filter === 'all') return true;
      if (filter === 'unacknowledged') return !alert.acknowledged;
      return alert.type === filter;
    })
    .filter(
      (alert) =>
        alert.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.message.toLowerCase().includes(searchTerm.toLowerCase())
    );

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Alert Center</h2>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Create Alert Rule
        </Button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="flex-1">
          <Input
            placeholder="Search alerts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter alerts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Alerts</SelectItem>
            <SelectItem value="unacknowledged">Unacknowledged</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="success">Success</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Active Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredAlerts.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No alerts found
                </p>
              ) : (
                filteredAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-start gap-4 p-4 rounded-lg border"
                  >
                    <div className="flex-shrink-0">
                      {getAlertIcon(alert.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{alert.title}</h4>
                        <Badge
                          variant={alert.acknowledged ? 'outline' : 'secondary'}
                        >
                          {alert.acknowledged ? 'Acknowledged' : 'New'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {alert.message}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{alert.source}</span>
                        <span>•</span>
                        <span>{new Date(alert.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!alert.acknowledged && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAcknowledge(alert.id)}
                        >
                          Acknowledge
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAlert(alert.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alert Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {alertRules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div>
                    <h4 className="font-semibold">{rule.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {rule.condition} {rule.threshold}
                    </p>
                  </div>
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={(checked) =>
                      toggleAlertRule(rule.id, checked)
                    }
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
