import React from 'react';
import { cn } from '@/utils';
import { Loader2 } from 'lucide-react';

// ── Badge ────────────────────────────────────────────────────
interface BadgeProps {
  count?: number;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ count, className }) => {
  if (!count) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5',
        'bg-red-500 text-white text-[10px] font-bold rounded-full',
        className
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
};

// ── Loader ───────────────────────────────────────────────────
interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Loader: React.FC<LoaderProps> = ({ size = 'md', className }) => {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
  return (
    <div className={cn('flex items-center justify-center p-8', className)}>
      <Loader2 className={cn(sizes[size], 'animate-spin text-brand-500')} />
    </div>
  );
};

// ── Dropdown ─────────────────────────────────────────────────
interface DropdownProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  isOpen,
  onClose,
  children,
  align = 'right',
  className,
}) => {
  if (!isOpen) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className={cn(
          'absolute z-50 mt-1.5 min-w-[240px]',
          'bg-white dark:bg-surface-850 border border-subtle',
          'rounded-xl shadow-xl animate-scale-in overflow-hidden',
          align === 'right' ? 'right-0' : 'left-0',
          className
        )}
      >
        {children}
      </div>
    </>
  );
};

// ── DropdownItem ─────────────────────────────────────────────
interface DropdownItemProps {
  onClick?: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
  danger?: boolean;
}

export const DropdownItem: React.FC<DropdownItemProps> = ({
  onClick,
  icon,
  children,
  danger,
}) => (
  <button
    onClick={onClick}
    className={cn(
      'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left',
      danger
        ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10'
        : 'text-gray-700 dark:text-gray-300 hover:bg-surface-100 dark:hover:bg-surface-800'
    )}
  >
    {icon && <span className="flex-shrink-0">{icon}</span>}
    {children}
  </button>
);
