'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Container, User, AlertTriangle, Box, Play, Square, Trash2, Download, RefreshCw, Bell, CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from 'date-fns';
import { ActivityType } from "@prisma/client";
import { Button } from "@/components/ui/button";

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
      return <Activity className="h-4 w-4" />;
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
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTestLoading, setIsTestLoading] = useState(false);

  const fetchActivities = async () => {
    try {
      console.log('Fetching activities...');
      const response = await fetch('/api/admin/activities');
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to fetch activities: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Received activities:', data);
      setActivities(data);
    } catch (err) {
      console.error('Error in fetchActivities:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(fetchActivities, 30000);
    return () => clearInterval(interval);
  }, []);

  const createTestActivities = async () => {
    try {
      setIsTestLoading(true);
      const response = await fetch('/api/admin/activities/test', {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to create test activities');
      }
      
      await fetchActivities();
    } catch (err) {
      console.error('Error creating test activities:', err);
      setError(err instanceof Error ? err.message : 'Failed to create test activities');
    } finally {
      setIsTestLoading(false);
    }
  };

  if (isLoading) {
    console.log('Loading state:', isLoading);
  }

  if (error) {
    console.log('Error state:', error);
  }

  console.log('Current activities:', activities);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold">Recent Activities</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={createTestActivities}
          disabled={isTestLoading}
        >
          {isTestLoading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Activity className="h-4 w-4 mr-2" />
              Create Test Activities
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-500" />
          </div>
        ) : error ? (
          <div className="text-red-500 text-center py-4">
            <AlertTriangle className="h-4 w-4 inline-block mr-2" />
            {error}
          </div>
        ) : activities.length === 0 ? (
          <div className="text-gray-500 text-center py-4">
            <Box className="h-4 w-4 inline-block mr-2" />
            No recent activities
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3">
                <div className={`mt-1 ${getActivityColor(activity.type)}`}>
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm text-gray-300">{activity.description}</p>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">{activity.user.username}</span>
                    <span className="text-xs text-gray-600">•</span>
                    <span className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
