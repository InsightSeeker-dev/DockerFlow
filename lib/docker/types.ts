import { ContainerInfo } from 'dockerode';

export interface NetworkSettings {
  Networks: { [networkType: string]: NetworkInfo };
  Ports: {
    [portAndProtocol: string]: Array<{
      HostIp: string;
      HostPort: string;
    }> | null;
  };
}

export interface Container extends Omit<ContainerInfo, 'NetworkSettings'> {
  NetworkSettings: NetworkSettings;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export interface Port {
  PrivatePort: number;
  PublicPort: number;
  Type: string;
}

export interface NetworkInfo {
  IPAddress: string;
  Gateway: string;
  NetworkID: string;
}

export interface ContainerStats {
  cpu: number;
  memory: {
    usage: number;
    limit: number;
    percentage: number;
  };
  network: {
    rx_bytes: number;
    tx_bytes: number;
  };
}

export interface DockerImage {
  Id: string;
  ParentId: string;
  RepoTags: string[];
  RepoDigests: string[];
  Created: number;
  Size: number;
  VirtualSize: number;
  SharedSize: number;
  Labels: { [key: string]: string };
  Containers: number;
}