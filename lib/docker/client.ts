import Docker from 'dockerode';
import fs from 'fs';

let dockerClient: Docker | null = null;

export function getDockerClient(): Docker {
  if (!dockerClient) {
    console.log('Initializing Docker client...');
    try {
      // Vérifier si nous sommes dans un environnement Windows ou Unix
      const socketPath = process.platform === 'win32' 
        ? '//./pipe/docker_engine'
        : '/var/run/docker.sock';

      console.log('Using Docker socket path:', socketPath);

      // Vérifier si le socket existe
      if (!fs.existsSync(socketPath)) {
        throw new Error(`Docker socket not found at ${socketPath}`);
      }

      // Vérifier les permissions sur Unix
      if (process.platform !== 'win32') {
        try {
          fs.accessSync(socketPath, fs.constants.R_OK | fs.constants.W_OK);
        } catch (error) {
          console.error('Permission denied on Docker socket:', error);
          throw new Error('No permission to access Docker socket. Make sure the application user is in the docker group.');
        }
      }
      
      dockerClient = new Docker({ socketPath });

      console.log('Docker client initialized successfully');
    } catch (error) {
      console.error('Error initializing Docker client:', error);
      throw new Error(`Failed to initialize Docker client: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  return dockerClient;
}

// Fonction pour tester la connexion Docker avec plus de détails
export async function testDockerConnection(): Promise<boolean> {
  try {
    const docker = getDockerClient();
    
    // Vérifier l'accès au socket
    if (process.platform !== 'win32') {
      await fs.promises.access('/var/run/docker.sock', fs.constants.R_OK | fs.constants.W_OK);
    }

    // Tester la connexion à l'API Docker
    const info = await docker.info();
    console.log('Docker connection test successful:', {
      version: info.ServerVersion,
      containers: info.Containers,
      running: info.ContainersRunning,
      operatingSystem: info.OperatingSystem,
      architecture: info.Architecture,
      kernelVersion: info.KernelVersion
    });

    // Tester la liste des conteneurs
    const containers = await docker.listContainers({ all: true });
    console.log('Successfully listed containers:', containers.length);

    return true;
  } catch (error) {
    console.error('Docker connection test failed:', error);
    if (error instanceof Error) {
      if (error.message.includes('permission denied')) {
        console.error('Permission issue detected. Please check Docker socket permissions.');
      } else if (error.message.includes('connect ENOENT')) {
        console.error('Docker daemon not running or socket not found.');
      }
    }
    return false;
  }
}