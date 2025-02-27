import { getDockerClient } from './client';
import net from 'net';

// Vérifie si un port est utilisé par Docker
async function isPortUsedByDocker(port: number): Promise<boolean> {
  const docker = getDockerClient();
  const containers = await docker.listContainers({ all: true });
  
  return containers.some(container => {
    return container.Ports?.some(p => 
      p.PublicPort === port || p.PrivatePort === port
    ) ?? false;
  });
}

// Vérifie si un port est disponible sur le système
async function isPortAvailableSystem(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => {
      resolve(false);
    });
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

// Vérifie si un port est réellement disponible (système + Docker)
export async function isPortAvailable(port: number): Promise<boolean> {
  try {
    // Vérifie d'abord si le port est utilisé par Docker
    const dockerUsed = await isPortUsedByDocker(port);
    if (dockerUsed) {
      console.log(`Port ${port} est utilisé par un conteneur Docker`);
      return false;
    }

    // Ensuite, vérifie si le port est disponible sur le système
    const systemAvailable = await isPortAvailableSystem(port);
    if (!systemAvailable) {
      console.log(`Port ${port} est utilisé par le système`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Erreur lors de la vérification du port ${port}:`, error);
    return false;
  }
}

// Définir les types pour les plages de ports
type PortRange = [number, number];

interface ServicePortRanges {
  HTTP: PortRange;
  HTTPS: PortRange;
  MYSQL: PortRange;
  POSTGRES: PortRange;
  MONGODB: PortRange;
  REDIS: PortRange;
  NODE: PortRange;
}

interface FallbackPortRanges {
  DYNAMIC: PortRange;
  ALTERNATIVE: PortRange;
}

interface PortRanges {
  PRIMARY: ServicePortRanges;
  FALLBACK: FallbackPortRanges;
}

// Définir les plages de ports pour différents services
const PORT_RANGES: PortRanges = {
  // Plages principales
  PRIMARY: {
    HTTP: [8080, 8089] as PortRange,
    HTTPS: [8443, 8449] as PortRange,
    MYSQL: [33060, 33069] as PortRange,
    POSTGRES: [54320, 54329] as PortRange,
    MONGODB: [27018, 27027] as PortRange,
    REDIS: [63790, 63799] as PortRange,
    NODE: [3001, 3010] as PortRange
  },
  // Plages de secours
  FALLBACK: {
    DYNAMIC: [49152, 65535] as PortRange, // Plage de ports dynamiques/privés
    ALTERNATIVE: [10000, 10999] as PortRange // Plage alternative sécurisée
  }
};

// Trouve le prochain port disponible à partir d'un port donné
export async function findNextAvailablePort(startPort: number, options: { preferredRange?: [number, number] } = {}): Promise<number> {
  const docker = getDockerClient();
  
  // Récupérer tous les conteneurs
  const containers = await docker.listContainers({ all: true });
  
  // Collecter tous les ports utilisés
  const usedPorts = new Set<number>();
  containers.forEach(container => {
    container.Ports?.forEach(port => {
      if (port.PublicPort) {
        usedPorts.add(port.PublicPort);
      }
    });
  });

  // Essayer d'abord dans la plage préférée si spécifiée
  if (options.preferredRange) {
    const [min, max] = options.preferredRange;
    for (let port = min; port <= max; port++) {
      if (!usedPorts.has(port) && await isPortAvailable(port)) {
        return port;
      }
    }
  }

  // Essayer dans la plage dynamique
  const [dynamicMin, dynamicMax] = PORT_RANGES.FALLBACK.DYNAMIC;
  for (let port = Math.max(startPort, dynamicMin); port <= dynamicMax; port++) {
    if (!usedPorts.has(port) && await isPortAvailable(port)) {
      return port;
    }
  }

  // En dernier recours, essayer la plage alternative
  const [altMin, altMax] = PORT_RANGES.FALLBACK.ALTERNATIVE;
  for (let port = altMin; port <= altMax; port++) {
    if (!usedPorts.has(port) && await isPortAvailable(port)) {
      return port;
    }
  }

  throw new Error('No available ports found in any range');
}

// Trouve un port disponible dans une plage donnée
export async function findAvailablePortInRange(min: number, max: number): Promise<number> {
  for (let port = min; port <= max; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available ports found in range ${min}-${max}`);
}

// Suggère un port alternatif si le port demandé est occupé
export async function suggestAlternativePort(desiredPort: number): Promise<number> {
  // Si le port désiré est disponible, le retourner
  if (await isPortAvailable(desiredPort)) {
    return desiredPort;
  }

  // Déterminer la plage appropriée selon le port demandé
  let preferredRange: [number, number] | undefined;

  switch (desiredPort) {
    case 80:
      preferredRange = PORT_RANGES.PRIMARY.HTTP;
      break;
    case 443:
      preferredRange = PORT_RANGES.PRIMARY.HTTPS;
      break;
    case 3306:
      preferredRange = PORT_RANGES.PRIMARY.MYSQL;
      break;
    case 5432:
      preferredRange = PORT_RANGES.PRIMARY.POSTGRES;
      break;
    case 27017:
      preferredRange = PORT_RANGES.PRIMARY.MONGODB;
      break;
    case 6379:
      preferredRange = PORT_RANGES.PRIMARY.REDIS;
      break;
    case 3000:
      preferredRange = PORT_RANGES.PRIMARY.NODE;
      break;
  }

  try {
    // Essayer d'abord la plage préférée si elle existe
    if (preferredRange) {
      return await findNextAvailablePort(desiredPort, { preferredRange });
    }

    // Sinon, essayer les plages de secours
    return await findNextAvailablePort(desiredPort);
  } catch (error) {
    console.warn(`Impossible de trouver un port dans les plages principales pour ${desiredPort}, utilisation des plages de secours`);
    
    // En dernier recours, essayer les plages de secours
    try {
      return await findNextAvailablePort(PORT_RANGES.FALLBACK.ALTERNATIVE[0], {
        preferredRange: PORT_RANGES.FALLBACK.ALTERNATIVE
      });
    } catch {
      throw new Error(`Impossible de trouver un port disponible pour le service (port d'origine: ${desiredPort})`);
    }
  }
}
