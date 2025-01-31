import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const statusColor = {
    running: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    exited: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    created: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    restarting: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  }[status.toLowerCase()] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        statusColor,
        className
      )}
    >
      {status}
    </span>
  );
}
