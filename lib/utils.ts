import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(timestamp: number | string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatBytes(bytes: number | string): string {
  const numBytes = typeof bytes === 'string' ? parseInt(bytes) : bytes;
  if (isNaN(numBytes)) return '0 Bytes';
  
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (numBytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(numBytes) / Math.log(1024));
  return `${(numBytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}