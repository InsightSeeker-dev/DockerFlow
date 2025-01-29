// Fonction pour obtenir le port par défaut selon l'image
export function getDefaultPort(imageName: string): number {
  const imageNameLower = imageName.toLowerCase();
  if (imageNameLower.includes('grafana')) return 3000;
  if (imageNameLower.includes('postgres')) return 5432;
  if (imageNameLower.includes('mysql')) return 3306;
  if (imageNameLower.includes('mongo')) return 27017;
  if (imageNameLower.includes('redis')) return 6379;
  if (imageNameLower.includes('nginx')) return 80;
  if (imageNameLower.includes('node')) return 3000;
  if (imageNameLower.includes('python')) return 8000;
  if (imageNameLower.includes('wordpress')) return 80;
  if (imageNameLower.includes('phpmyadmin')) return 80;
  return 8080; // Port par défaut si aucune correspondance
}

// Fonction pour obtenir le chemin de volume par défaut selon l'image
export function getDefaultVolumePath(imageName: string): string {
  const imageNameLower = imageName.toLowerCase();
  if (imageNameLower.includes('grafana')) return '/var/lib/grafana';
  if (imageNameLower.includes('postgres')) return '/var/lib/postgresql/data';
  if (imageNameLower.includes('mysql')) return '/var/lib/mysql';
  if (imageNameLower.includes('mongo')) return '/data/db';
  if (imageNameLower.includes('redis')) return '/data';
  if (imageNameLower.includes('wordpress')) return '/var/www/html';
  return '/data'; // Chemin par défaut si aucune correspondance
}
