import { ReactNode } from 'react';
import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface StatsCardProps {
  title: string;
  value: number;
  total?: number;
  icon: ReactNode;
  trend?: {
    direction: 'up' | 'down';
    value: number;
  };
  format?: 'bytes' | 'percentage' | 'number';
}

const formatValue = (value: number, format?: string) => {
  if (format === 'bytes') {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = value;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
  if (format === 'percentage') {
    return `${value.toFixed(1)}%`;
  }
  return value.toLocaleString();
};

export function StatsCard({ title, value, total, icon, trend, format = 'number' }: StatsCardProps) {
  const percentage = total ? (value / total) * 100 : null;

  return (
    <Card className="p-6 bg-black/40 backdrop-blur-sm border-gray-800/50 hover:bg-gray-800/20 transition-all duration-200">
      <div className="flex items-center justify-between">
        <div className="p-3 rounded-xl bg-gray-800/50">{icon}</div>
        {trend && (
          <div
            className={`flex items-center space-x-1 text-sm ${
              trend.direction === 'up' ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {trend.direction === 'up' ? (
              <ArrowUpIcon className="h-4 w-4" />
            ) : (
              <ArrowDownIcon className="h-4 w-4" />
            )}
            <span>{trend.value}%</span>
          </div>
        )}
      </div>
      
      <div className="mt-4">
        <h3 className="text-sm font-medium text-gray-400">{title}</h3>
        <div className="mt-2 flex items-baseline">
          <p className="text-2xl font-semibold text-white">
            {formatValue(value, format)}
            {total && ` / ${formatValue(total, format)}`}
          </p>
          {percentage !== null && (
            <span className="ml-2 text-sm text-blue-400">
              {percentage.toFixed(1)}%
            </span>
          )}
        </div>
      </div>

      {total && (
        <div className="mt-4">
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      )}
    </Card>
  );
}
