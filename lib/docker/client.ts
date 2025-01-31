import Docker from 'dockerode';

let dockerClient: Docker | null = null;

export function getDockerClient(): Docker {
  if (!dockerClient) {
    console.log('Initializing Docker client...');
    try {
      dockerClient = new Docker({
        socketPath: process.platform === 'win32' 
          ? '//./pipe/docker_engine'
          : '/var/run/docker.sock'
      });
      console.log('Docker client initialized successfully');
    } catch (error) {
      console.error('Error initializing Docker client:', error);
      throw error;
    }
  }
  return dockerClient;
}