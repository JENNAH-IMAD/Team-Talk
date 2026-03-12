import React from 'react';
import { cn } from '@/utils';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

const VARIANTS = {
  primary:
    'bg-brand-500 hover:bg-brand-600 text-white shadow-sm shadow-brand-500/20',
  secondary:
    'bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-800/80 text-gray-700 dark:text-gray-300 border border-subtle',
  ghost:
    'bg-transparent hover:bg-surface-100 dark:hover:bg-surface-800/60 text-gray-600 dark:text-gray-400',
  danger:
    'bg-red-500 hover:bg-red-600 text-white shadow-sm shadow-red-500/20',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-6 py-2.5 text-sm gap-2',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading,
  icon,
  children,
  className,
  disabled,
  ...props
}) => {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-semibold transition-all duration-150',
        'focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:ring-offset-1 dark:focus:ring-offset-surface-900',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        icon
      )}
      {children}
    </button>
  );
};
