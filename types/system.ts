export interface SystemStats {
  // Container Stats
  containers: number;
  containersRunning: number;
  containersStopped: number;
  containersError: number;
  activeContainers: number;
  containerTrend: number;
  
  // Image Stats
  images: {
    total: number;
    size: number;
  };
  
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
  networkIO: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  memoryTrend: number;
  diskUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  networkTraffic: {
    in: number;
    out: number;
  };
  
  // Performance History
  performanceHistory: Array<{
    timestamp: string;
    cpu: number;
    memory: number;
    network: number;
  }>;
  
  // Optional resource limits
  resourceLimits?: {
    memory: {
      limit: number;
      available: number;
      formatted: string;
    };
    storage: {
      limit: number;
      available: number;
      formatted: string;
    };
  };
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
  createdAt: Date;
  updatedAt: Date;
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