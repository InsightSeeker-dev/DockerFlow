// /DockerFlow/lib/docker/types.ts
import { ContainerInfo, Port as DockerodePort, ContainerInspectInfo as DockerContainerInspectInfo } from 'dockerode';

/**
 * Types pour les données brutes de Docker
 */
export interface DockerMount {
  Type: string;
  Source: string;
  Destination: string;
  Mode: string;
  RW: boolean;
  Propagation: string;
  Name?: string;
  Driver?: string;
}

export interface DockerHostConfig {
  NetworkMode: string;
  RestartPolicy?: {
    Name: string;
    MaximumRetryCount: number;
  };
}

export interface DockerContainer {
  Id: string;
  Names: string[];
  Image: string;
  ImageID: string;
  Command: string;
  Created: number;
  State: string;
  Status: string;
  Ports: DockerodePort[];
  Labels: { [key: string]: string };
  NetworkSettings: NetworkSettings;
  Mounts: DockerMount[];
  HostConfig: DockerHostConfig;
}

/**
 * Configuration réseau d'un conteneur
 */
export interface NetworkSettings {
  Networks: {
    [key: string]: {
      NetworkID: string;
      EndpointID: string;
      Gateway: string;
      IPAddress: string;
      IPPrefixLen: number;
      IPv6Gateway: string;
      GlobalIPv6Address: string;
      GlobalIPv6PrefixLen: number;
      MacAddress: string;
    };
  };
}

/**
 * Information sur un port
 */
export interface Port extends DockerodePort {}

/**
 * Information sur un point de montage
 */
export interface Mount extends DockerMount {}

/**
 * Configuration de l'hôte Docker
 */
export interface HostConfig {
  NetworkMode: string;
  RestartPolicy: RestartPolicy;
}

/**
 * Politique de redémarrage d'un conteneur
 */
export interface RestartPolicy {
  Name: string;
  MaximumRetryCount: number;
}

/**
 * État possible d'un conteneur
 */
export interface ContainerState {
  Status: string;
  Running: boolean;
  Paused: boolean;
  Restarting: boolean;
  OOMKilled: boolean;
  Dead: boolean;
  Pid: number;
  ExitCode: number;
  Error: string;
  StartedAt: string;
  FinishedAt: string;
  Health?: {
    Status: string;
    FailingStreak: number;
    Log: Array<{
      Start: string;
      End: string;
      ExitCode: number;
      Output: string;
    }>;
  };
}

/**
 * Information de base sur un conteneur
 */
export interface BaseContainer {
  Id: string;
  Names: string[];
  Image: string;
  ImageID: string;
  Command: string;
  Created: number;
  State: string;
  Status: string;
  Ports: Port[];
  Labels: { [key: string]: string };
  NetworkSettings: NetworkSettings;
  Mounts: Mount[];
  HostConfig: HostConfig;
}

/**
 * Information complète sur un conteneur
 */
export interface Container extends BaseContainer {
  subdomain?: string;
  created_at?: string;
  updated_at?: string;
  user_id?: string;
}

/**
 * Informations détaillées sur un conteneur
 */
export interface ContainerInspectInfo extends Omit<Container, 'State'> {
  State: ContainerState;
  Config: {
    Hostname: string;
    Domainname: string;
    User: string;
    AttachStdin: boolean;
    AttachStdout: boolean;
    AttachStderr: boolean;
    ExposedPorts: { [key: string]: {} };
    Tty: boolean;
    OpenStdin: boolean;
    StdinOnce: boolean;
    Env: string[];
    Cmd: string[];
    Image: string;
    Volumes: { [key: string]: {} };
    WorkingDir: string;
    Entrypoint: string[] | null;
    Labels: { [key: string]: string };
  };
}

/**
 * Statistiques Docker
 */
export interface DockerStats {
  read: string;
  preread: string;
  pids_stats: {
    current: number;
  };
  blkio_stats: {
    io_service_bytes_recursive: Array<{
      major: number;
      minor: number;
      op: string;
      value: number;
    }>;
  };
  num_procs: number;
  storage_stats: {};
  cpu_stats: {
    cpu_usage: {
      total_usage: number;
      percpu_usage: number[];
      usage_in_kernelmode: number;
      usage_in_usermode: number;
    };
    system_cpu_usage: number;
    online_cpus: number;
    throttling_data: {
      periods: number;
      throttled_periods: number;
      throttled_time: number;
    };
  };
  precpu_stats: {
    cpu_usage: {
      total_usage: number;
      percpu_usage: number[];
      usage_in_kernelmode: number;
      usage_in_usermode: number;
    };
    system_cpu_usage: number;
    online_cpus: number;
    throttling_data: {
      periods: number;
      throttled_periods: number;
      throttled_time: number;
    };
  };
  memory_stats: {
    usage: number;
    max_usage: number;
    stats: {
      active_anon: number;
      active_file: number;
      cache: number;
      dirty: number;
      hierarchical_memory_limit: number;
      inactive_anon: number;
      inactive_file: number;
      mapped_file: number;
      pgfault: number;
      pgmajfault: number;
      pgpgin: number;
      pgpgout: number;
      rss: number;
      rss_huge: number;
      total_active_anon: number;
      total_active_file: number;
      total_cache: number;
      total_dirty: number;
      total_inactive_anon: number;
      total_inactive_file: number;
      total_mapped_file: number;
      total_pgfault: number;
      total_pgmajfault: number;
      total_pgpgin: number;
      total_pgpgout: number;
      total_rss: number;
      total_rss_huge: number;
      total_unevictable: number;
      total_writeback: number;
      unevictable: number;
      writeback: number;
    };
    limit: number;
  };
  name: string;
  id: string;
  networks?: {
    [key: string]: {
      rx_bytes: number;
      tx_bytes: number;
    };
  };
}
