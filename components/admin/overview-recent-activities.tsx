'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Container, User, AlertTriangle, Box, Play, Square, Trash2, Download, RefreshCw, Bell, CheckCircle, ActivityIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from 'date-fns';
import { ActivityType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { Activity } from "@/types/activity";

interface ActivityItem {
  id: string;
  type: ActivityType;
  description: string;
  createdAt: string;
  user: {
    username: string;
    email: string;
    role: string;
  };
  metadata?: any;
}

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
    if (session?.user?.role === 'ADMIN') {
      fetchActivities();
    }
  }, [session, page]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-bold">Recent Activities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-bold">Recent Activities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center p-4 space-y-4">
            <AlertTriangle className="h-8 w-8 text-red-500" />
            <p className="text-red-500">{error}</p>
            <Button onClick={fetchActivities}>Retry</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold">
          Recent Activities
          {total > 0 && <span className="ml-2 text-sm text-gray-500">({total})</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-4 text-gray-500">
            <Box className="h-8 w-8 mb-2" />
            <p>No activities found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className={`mt-1 ${getActivityColor(activity.type)}`}>
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{activity.description}</p>
                    <span className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    by {activity.user.username} ({activity.user.email})
                  </p>
                </div>
              </div>
            ))}
            
            {total > pageSize && (
              <div className="flex justify-center space-x-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * pageSize >= total}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
