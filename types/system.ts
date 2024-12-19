export interface SystemStats {
  containers: number;
  containersRunning: number;
  containersStopped: number;
  images: number;
  cpuUsage: number;
  cpuCount: number;
  networkIO: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  diskUsage: {
    used: number;
    total: number;
    percentage: number;
  };
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