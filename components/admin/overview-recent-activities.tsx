'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Container, User, AlertTriangle, Box, Play, Square, Trash2, Download, RefreshCw, Bell, CheckCircle, ActivityIcon, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ActivityType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { Activity } from "@/types/activity";
import { cn } from "@/lib/utils";

const getActivityIcon = (type: ActivityType) => {
  switch (type) {
    case 'USER_LOGIN':
    case 'USER_LOGOUT':
    case 'USER_REGISTER':
    case 'USER_UPDATE':
    case 'USER_DELETE':
      return <User className="h-4 w-4" />;
    case 'CONTAINER_CREATE':
      return <Container className="h-4 w-4" />;
    case 'CONTAINER_START':
      return <Play className="h-4 w-4" />;
    case 'CONTAINER_STOP':
      return <Square className="h-4 w-4" />;
    case 'CONTAINER_DELETE':
      return <Trash2 className="h-4 w-4" />;
    case 'IMAGE_PULL':
      return <Download className="h-4 w-4" />;
    case 'IMAGE_DELETE':
      return <Trash2 className="h-4 w-4" />;
    case 'SYSTEM_UPDATE':
      return <RefreshCw className="h-4 w-4" />;
    case 'ALERT_TRIGGERED':
      return <Bell className="h-4 w-4" />;
    case 'ALERT_RESOLVED':
      return <CheckCircle className="h-4 w-4" />;
    default:
      return <ActivityIcon className="h-4 w-4" />;
  }
};

const getActivityColor = (type: ActivityType) => {
  switch (type) {
    case 'USER_LOGIN':
    case 'CONTAINER_START':
    case 'ALERT_RESOLVED':
      return 'text-green-500';
    case 'USER_LOGOUT':
    case 'CONTAINER_STOP':
      return 'text-yellow-500';
    case 'USER_DELETE':
    case 'CONTAINER_DELETE':
    case 'IMAGE_DELETE':
    case 'ALERT_TRIGGERED':
      return 'text-red-500';
    case 'SYSTEM_UPDATE':
    case 'IMAGE_PULL':
      return 'text-blue-500';
    default:
      return 'text-gray-500';
  }
};

export function OverviewRecentActivities() {
  const { data: session } = useSession();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(5);
  const [total, setTotal] = useState(0);

  const fetchActivities = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/admin/activities?page=${page}&pageSize=${pageSize}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data?.error || `Failed to fetch activities: ${response.status}`);
      }

      setActivities(data.activities || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Error fetching activities:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch activities');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user) {
      fetchActivities();
    }
  }, [session, page]);

  if (!session?.user) {
    return null;
  }

  return (
    <Card className="col-span-3">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-medium">
          Activités Récentes
          {total > 0 && <span className="text-sm text-muted-foreground ml-2">({total})</span>}
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fetchActivities()}
          disabled={isLoading}
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-6 text-red-500">
            <AlertTriangle className="h-6 w-6 mr-2" />
            <span>{error}</span>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            Aucune activité récente
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start space-x-4 p-3 rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className={cn(
                  "p-2 rounded-full bg-accent/10",
                  getActivityColor(activity.type)
                )}>
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">
                    {activity.description}
                  </p>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <span>{activity.user?.username}</span>
                    <span className="mx-1">•</span>
                    <span>
                      {formatDistanceToNow(new Date(activity.createdAt), {
                        addSuffix: true,
                        locale: fr
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {total > pageSize && (
              <div className="flex justify-center space-x-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || isLoading}
                >
                  Précédent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * pageSize >= total || isLoading}
                >
                  Suivant
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
