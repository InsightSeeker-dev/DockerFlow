// Fichier: /DockerFlow/lib/docker/errors.ts
export class DockerError extends Error {
  statusCode?: number;
  code?: string;
  reason?: string;

  constructor(message: string, options?: { statusCode?: number; code?: string; reason?: string }) {
    super(message);
    this.name = 'DockerError';
    this.statusCode = options?.statusCode;
    this.code = options?.code;
    this.reason = options?.reason;
  }
}