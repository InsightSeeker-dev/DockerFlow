export interface ContainerFormData {
  name: string;
  image: string;
  subdomain: string;
}

export interface DockerImage {
  Id: string;
  RepoTags?: string[];
  Created: number;
  Size: number;
}

export interface CreateContainerResponse {
  id: string;
  name: string;
  subdomain: string;
  ports: Array<{
    containerPort: number;
    hostPort: number;
  }>;
  status: string;
  url: string;
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
  rx_bytes: number;
  tx_bytes: number;
  status: string;
}
