import React, { useEffect, useState } from 'react';
import { Bell, CheckCircle, AlertTriangle, AlertCircle, X } from 'lucide-react';
import { type Alert } from '@prisma/client';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

interface AlertCenterProps {
  userId: string;
}

const AlertCenter: React.FC<AlertCenterProps> = ({ userId }) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetchAlerts();
    setupWebSocket();
  }, [userId]);

  const fetchAlerts = async () => {
    try {
      const response = await fetch(`/api/alerts?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setAlerts(data);
        updateUnreadCount(data);
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    }
  };

  const setupWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/alerts/ws`);

    ws.onopen = () => {
      console.log('WebSocket connection established');
    };

    ws.onmessage = (event) => {
      const newAlert = JSON.parse(event.data);
      setAlerts(prev => [newAlert, ...prev]);
      updateUnreadCount([newAlert, ...alerts]);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed. Attempting to reconnect...');
      setTimeout(setupWebSocket, 5000);
    };

    return () => {
      ws.close();
    };
  };

  const updateUnreadCount = (alertsList: Alert[]) => {
    setUnreadCount(alertsList.filter(alert => !alert.acknowledged).length);
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/alerts/${alertId}/acknowledge`, {
        method: 'POST',
      });

      if (response.ok) {
        setAlerts(prev =>
          prev.map(alert =>
            alert.id === alertId ? { ...alert, acknowledged: true } : alert
          )
        );
        updateUnreadCount(alerts);
      }
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <CheckCircle className="h-5 w-5 text-blue-500" />;
    }
  };

  const getTimeAgo = (date: Date | string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const filteredAlerts = showAll ? alerts : alerts.filter(alert => !alert.acknowledged);

  return (
    <div className="relative">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative p-2">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                {unreadCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[400px] max-h-[500px] overflow-y-auto">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alerts</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAll(!showAll)}
              className="text-xs"
            >
              {showAll ? 'Show Unread' : 'Show All'}
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4">
            {filteredAlerts.length === 0 ? (
              <div className="text-center text-sm text-gray-500">No alerts</div>
            ) : (
              filteredAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-start space-x-4 rounded-md border p-3 ${
                    alert.acknowledged ? 'bg-gray-50' : 'bg-white'
                  }`}
                >
                  {getSeverityIcon(alert.severity)}
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {alert.type.charAt(0).toUpperCase() + alert.type.slice(1)} Alert
                    </p>
                    <p className="text-sm text-gray-500">{alert.message}</p>
                    <div className="flex items-center pt-2">
                      <span className="text-xs text-gray-500">
                        {getTimeAgo(alert.created)}
                      </span>
                      {!alert.acknowledged && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-auto h-8 text-xs"
                          onClick={() => acknowledgeAlert(alert.id)}
                        >
                          Acknowledge
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default AlertCenter;
