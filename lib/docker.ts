import Docker from 'dockerode';

// Configuration de Docker avec les options avancées
const dockerOptions = {
  socketPath: '/var/run/docker.sock',
  timeout: 60000, // 60 secondes de timeout global
  version: 'v1.41', // Version de l'API Docker explicite
  headers: {
    'User-Agent': 'DockerFlow'
  }
};

// Création de l'instance Docker avec gestion des erreurs
let docker: Docker;
try {
  docker = new Docker(dockerOptions);
  console.log('[DOCKER] Successfully connected to Docker daemon');
} catch (error) {
  console.error('[DOCKER] Failed to connect to Docker daemon:', error);
  throw new Error('Failed to initialize Docker client');
}

// Test de la connexion et des permissions au démarrage
const testConnection = async () => {
  try {
    // Test de la connexion de base
    await docker.ping();
    console.log('[DOCKER] Docker daemon is responsive');

    // Test des permissions
    const info = await docker.info();
    console.log('[DOCKER] Docker version:', info.ServerVersion);
    console.log('[DOCKER] Operating System:', info.OperatingSystem);
    
    // Test des permissions sur les conteneurs
    const containers = await docker.listContainers();
    console.log('[DOCKER] Successfully listed containers');
    
    return true;
  } catch (error) {
    console.error('[DOCKER] Connection test failed:', error);
    return false;
  }
};

// Exécuter le test de connexion
testConnection().then((success) => {
  if (!success) {
    console.error('[DOCKER] Failed to establish proper connection to Docker daemon');
  }
}).catch((error) => {
  console.error('[DOCKER] Unexpected error during connection test:', error);
});

// Configuration Traefik par défaut pour tous les conteneurs
export const getTraefikConfig = (name: string, subdomain: string, port: string) => ({
  'traefik.enable': 'true',
  // Router configuration
  [`traefik.http.routers.${name}.rule`]: `Host(\`${subdomain}.dockersphere.ovh\`)`,
  [`traefik.http.routers.${name}.entrypoints`]: 'websecure',
  [`traefik.http.routers.${name}.tls`]: 'true',
  [`traefik.http.routers.${name}.tls.certresolver`]: 'letsencrypt',
  [`traefik.http.routers.${name}.middlewares`]: 'secure-headers',
  
  // Service configuration
  [`traefik.http.services.${name}.loadbalancer.server.port`]: port,
  
  // Global middlewares (if not already defined in Traefik)
  'traefik.http.middlewares.secure-headers.headers.sslredirect': 'true',
  'traefik.http.middlewares.secure-headers.headers.stsincludesubdomains': 'true',
  'traefik.http.middlewares.secure-headers.headers.stsseconds': '31536000'
});

export { docker };
