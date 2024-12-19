import React, { useEffect, useState } from 'react';
import { Bell, CheckCircle, AlertTriangle, AlertCircle, X } from 'lucide-react';
import { Alert } from '@/lib/notifications';
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
    const ws = new WebSocket(
      `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/alerts/ws`
    );

    ws.onmessage = (event) => {
      const newAlert: Alert = JSON.parse(event.data);
      setAlerts(prev => [newAlert, ...prev]);
      updateUnreadCount([newAlert, ...alerts]);
    };

    return () => ws.close();
  };

  const updateUnreadCount = (alertsList: Alert[]) => {
    const count = alertsList.filter(alert => !alert.acknowledged).length;
    setUnreadCount(count);
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

  const getSeverityIcon = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <CheckCircle className="h-5 w-5 text-blue-500" />;
    }
  };

  const getTimeAgo = (timestamp: Date) => {
    const seconds = Math.floor((new Date().getTime() - new Date(timestamp).getTime()) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="relative">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500"
              >
                {unreadCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[400px] p-0">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Notifications</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll ? 'Show Recent' : 'Show All'}
                </Button>
              </div>
              <CardDescription>
                {unreadCount} unread notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="max-h-[400px] overflow-y-auto">
              {(showAll ? alerts : alerts.slice(0, 5)).map(alert => (
                <div
                  key={alert.id}
                  className={`
                    flex items-start space-x-4 p-3 rounded-lg mb-2
                    ${alert.acknowledged ? 'bg-gray-800' : 'bg-gray-700'}
                    ${!alert.acknowledged && 'border-l-4 border-blue-500'}
                  `}
                >
                  {getSeverityIcon(alert.severity)}
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{alert.message}</p>
                        <p className="text-sm text-gray-400">
                          {getTimeAgo(alert.created)}
                        </p>
                      </div>
                      {!alert.acknowledged && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => acknowledgeAlert(alert.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="mt-1 text-sm">
                      {alert.currentValue !== undefined && alert.threshold !== undefined && (
                        <span className="text-gray-400">
                          Current: {alert.currentValue.toFixed(1)}% |
                          Threshold: {alert.threshold}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default AlertCenter;
