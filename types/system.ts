export interface SystemStats {
  // Container Stats
  containers: number;
  containersRunning: number;
  containersStopped: number;
  containersError: number;
  containerTrend: number;
  
  // User Stats
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  suspendedUsers: number;
  userTrend: number;
  
  // System Resources
  cpuUsage: number;
  cpuCount: number;
  cpuTrend: number;
  
  memoryUsage: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  memoryTrend: number;

  diskUsage: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };

  networkTraffic: {
    in: number;
    out: number;
  };

  networkIO?: {
    bytesPerSecond: number;
    packetsPerSecond: number;
  };

  systemLoad?: number;

  // Image Stats
  images: {
    total: number;
    size: number;
    pulls: number;
    tags?: Array<{
      name: string;
      count: number;
    }>;
  };

  // Performance History
  performanceHistory: Array<{
    timestamp: string;
    cpu: number;
    memory: number;
    network: number;
  }>;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  avatar: string | null;
  bio: string | null;
  role: string;
  memoryLimit: number;
  storageLimit: number;
  created_at: Date;
  updated_at: Date;
}

export interface Container {
  Id: string;
  Names: string[];
  Image: string;
  ImageID: string;
  Command: string;
  Created: number;
  Ports: Array<{
    IP: string;
    PrivatePort: number;
    PublicPort: number;
    Type: string;
  }>;
  Labels: { [key: string]: string };
  State: string;
  Status: string;
  HostConfig: {
    NetworkMode: string;
  };
  NetworkSettings: {
    Networks: {
      [key: string]: {
        IPAddress: string;
        Gateway: string;
      };
    };
  };
  Mounts: Array<{
    Type: string;
    Source: string;
    Destination: string;
  }>;
}

export interface Activity {
  id: string;
  type: 'container' | 'image' | 'user' | 'system';
  description: string;
  user: string;
  time: string;
  details?: {
    [key: string]: any;
  };
}