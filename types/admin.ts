export interface UserResource {
  id: string;
  cpuLimit: number;
  memoryLimit: number;
  storageLimit: number;
  cpuUsage: number;
  memoryUsage: number;
  storageUsage: number;
}

export interface DockerImageInfo {
  id: string;
  name: string;
  tag: string;
  size: number;
  source: 'dockerhub' | 'custom';
  dockerfile?: string;
  userId: string;
  created: Date;
  updated: Date;
}

export interface ContainerDetails {
  id: string;
  name: string;
  imageId: string;
  status: string;
  ports: Record<string, number>;
  volumes?: Record<string, string>;
  env?: Record<string, string>;
  cpuLimit?: number;
  memoryLimit?: number;
  created: Date;
  userId: string;
}

export interface UserDetails {
  id: string;
  username: string;
  email: string;
  role: string;
  cpuLimit: number;
  memoryLimit: number;
  storageLimit: number;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}
