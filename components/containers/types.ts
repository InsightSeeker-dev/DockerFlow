export interface ContainerPort {
  IP: string;
  PrivatePort: number;
  PublicPort: number;
  Type: string;
  hostPort?: number;
  containerPort?: number;
}

export interface ContainerUser {
  id: string;
  name?: string;
  email?: string;
  role?: string;
}

export interface ContainerConfig {
  subdomain: string;
  ports: ContainerPort[];
  volumes?: any;
  env?: any;
  cpuLimit: number;
  memoryLimit: number;
}

export interface Container {
  Id: string;
  dockerId: string;
  Name: string;
  Image: string;
  ImageID: string;
  State: string;
  Status: string;
  Ports: ContainerPort[];
  Labels: Record<string, string>;
  Names: string[];
  Created: number;
  NetworkSettings?: {
    Ports: Record<string, Array<{ HostIp: string; HostPort: string }>>;
  };
  HostConfig?: {
    NetworkMode: string;
  };
  url: string;
  subdomain: string;
  cpuLimit: number;
  memoryLimit: number;
  userId: string;
  user?: ContainerUser;
  customConfig?: ContainerConfig;
  traefik?: {
    enabled: boolean;
    protocol?: 'http' | 'https';
  };
}

export interface ContainerFormData {
  name: string;
  image: string;
  subdomain: string;
  volumeConfig: VolumeConfig;
}

export interface VolumeConfig {
  createNew: boolean;
  newVolumeName?: string;
  volumeId?: string;
  mountPath: string;
}

export interface DockerImage {
  Id: string;
  RepoTags?: string[];
  Created: number;
  Size: number;
}

export interface Volume {
  id: string;
  name: string;
  driver: string;
  mountpoint?: string;
  size: number;
  created: Date;
  userId: string;
  containerVolumes?: ContainerVolume[];
  existsInDocker?: boolean;
}

export interface ContainerVolume {
  id: string;
  containerId: string;
  volumeId: string;
  mountPath: string;
  created: Date;
  container?: {
    name: string;
    status: string;
  };
  volume?: Volume;
}

export interface CreateContainerResponse {
  id: string;
  name: string;
  image: string;
  imageId: string;
  subdomain: string;
  status: string;
  url: string;
  cpuLimit: number;
  memoryLimit: number;
  created: Date;
  userId: string;
  containerVolumes: ContainerVolume[];
}

export interface CreateVolumeRequest {
  name: string;
  driver?: string;
}

export interface CreateVolumeResponse {
  id: string;
  name: string;
  driver: string;
  mountpoint?: string;
  size: number;
  created: Date;
}

export interface ContainerStats {
  id: string;
  name: string;
  cpuUsage: number;
  memoryUsage: number;
  networkIO: {
    rx_bytes: number;
    tx_bytes: number;
  };
  status: string;
}
