import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

// Fonction utilitaire pour normaliser les états des conteneurs
export function normalizeContainerState(state: string): 'running' | 'exited' | 'created' | 'paused' | 'restarting' | 'unknown' {
  const lowerState = state.toLowerCase();
  
  if (lowerState === 'running' || lowerState === 'en cours') {
    return 'running';
  } else if (lowerState === 'exited' || lowerState === 'arrêté' || lowerState === 'stopped') {
    return 'exited';
  } else if (lowerState === 'created' || lowerState === 'créé') {
    return 'created';
  } else if (lowerState === 'paused' || lowerState === 'en pause') {
    return 'paused';
  } else if (lowerState === 'restarting' || lowerState === 'redémarrage') {
    return 'restarting';
  } else {
    console.warn(`État de conteneur non reconnu: ${state}`);
    return 'unknown';
  }
}

// Fonction utilitaire pour obtenir le libellé localisé d'un état
export function getLocalizedStateLabel(state: string): string {
  const normalizedState = normalizeContainerState(state);
  
  const stateLabels = {
    running: 'En cours',
    exited: 'Arrêté',
    created: 'Créé',
    paused: 'En pause',
    restarting: 'Redémarrage',
    unknown: 'État inconnu'
  };
  
  return stateLabels[normalizedState];
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalizedState = normalizeContainerState(status);
  
  const statusColor = {
    running: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    exited: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    created: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    restarting: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
    unknown: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
  }[normalizedState];

  // Utiliser le libellé localisé pour l'affichage
  const displayLabel = getLocalizedStateLabel(status);

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        statusColor,
        className
      )}
    >
      {displayLabel}
    </span>
  );
}
