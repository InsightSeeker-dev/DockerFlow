// /DockerFlow/lib/docker/types.ts
import { ContainerInfo } from 'dockerode';

/**
 * Types pour les données brutes de Docker
 */

/**
 * Utilisateur
 */
export interface User {
  name: string | null;
  email: string;
  role: 'ADMIN' | 'USER';
}

/**
 * Port d'un conteneur
 */
export interface ContainerPort {
  hostPort: number;
  containerPort: number;
  protocol?: string;
}

/**
 * Configuration personnalisée d'un conteneur
 */
export interface CustomConfig {
  subdomain?: string;
  ports?: ContainerPort[];
  volumes?: Record<string, string>;
  env?: Record<string, string>;
  cpuLimit?: number;
  memoryLimit?: number;
}

/**
 * Configuration Traefik
 */
export interface TraefikConfig {
  enabled: boolean;
  rule: string;
  tls: boolean;
  certresolver: string;
}

/**
 * Port Docker
 */
export interface DockerPort {
  IP: string;
  PrivatePort: number;
  PublicPort: number;
  Type: string;
}

/**
 * Politique de redémarrage Docker
 */
export interface DockerRestartPolicy {
  Name: string;
  MaximumRetryCount: number;
}

/**
 * Configuration de l'hôte Docker
 */
export interface DockerHostConfig {
  NetworkMode: string;
  RestartPolicy: DockerRestartPolicy;
}

/**
 * Informations sur un conteneur
 */
// Extend ContainerInfo from Dockerode to include our custom properties
export interface Container extends ContainerInfo {
  Id: string;
  Names: string[];
  Image: string;
  ImageID: string;
  Command: string;
  Created: number;
  State: string;
  Status: string;
  Ports: DockerPort[];
  Labels: { [label: string]: string };
  HostConfig: DockerHostConfig;
  customConfig?: CustomConfig;
  user?: User;
  traefik?: TraefikConfig;
}
