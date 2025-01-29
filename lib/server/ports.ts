import net from 'net';
import { getDockerClient } from '../docker/client';

// Vérifie si un port est disponible
export async function isPortAvailable(port: number): Promise<boolean> {
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

// Trouve le prochain port disponible à partir d'un port donné
export async function findNextAvailablePort(startPort: number): Promise<number> {
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

  // Chercher le prochain port disponible
  let port = startPort;
  while (port < 65535) { // 65535 est le port maximum
    if (!usedPorts.has(port) && await isPortAvailable(port)) {
      return port;
    }
    port++;
  }

  throw new Error('No available ports found');
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

  // Définir les plages de ports pour différents services
  const portRanges: { [key: number]: [number, number] } = {
    80: [8080, 8089],    // HTTP alternatives
    443: [8443, 8449],   // HTTPS alternatives
    3306: [33060, 33069], // MySQL alternatives
    5432: [54320, 54329], // PostgreSQL alternatives
    27017: [27018, 27027], // MongoDB alternatives
    6379: [63790, 63799], // Redis alternatives
    3000: [3001, 3010],   // Node/Grafana alternatives
  };

  // Si le port est dans une plage connue, chercher dans cette plage
  const range = portRanges[desiredPort];
  if (range) {
    try {
      return await findAvailablePortInRange(range[0], range[1]);
    } catch {
      // Si aucun port n'est trouvé dans la plage, continuer avec la recherche générale
    }
  }

  // Sinon, chercher le prochain port disponible à partir du port désiré
  return findNextAvailablePort(desiredPort + 1);
}
