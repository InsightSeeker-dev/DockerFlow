import React from 'react';

interface LoadingSpinnerProps {
  size?: number | string; // e.g. 20, '2rem'
  color?: string; // e.g. '#000', 'text-blue-600'
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 20, color = 'currentColor', className = '' }) => (
  <svg
    className={`animate-spin ${className}`.trim()}
    style={{ width: size, height: size, color }}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

export default LoadingSpinner;
