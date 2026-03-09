import React from 'react';
import { cn } from '@/utils';

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  badge?: number;
  collapsed?: boolean;
  onClick?: () => void;
}

export const SidebarItem: React.FC<SidebarItemProps> = ({
  icon,
  label,
  isActive,
  badge,
  collapsed,
  onClick,
}) => (
  <button
    onClick={onClick}
    title={collapsed ? label : undefined}
    className={cn(
      'w-full flex items-center gap-2.5 rounded-lg text-[13px] font-medium transition-all duration-100',
      collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2',
      isActive
        ? 'bg-brand-500/10 text-brand-500 dark:text-brand-300 font-semibold'
        : 'text-gray-500 dark:text-gray-400 hover:bg-surface-100 dark:hover:bg-surface-800/60 hover:text-gray-700 dark:hover:text-gray-300'
    )}
  >
    <span className="flex-shrink-0">{icon}</span>
    {!collapsed && (
      <>
        <span className="flex-1 text-left truncate">{label}</span>
        {badge && badge > 0 && (
          <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </>
    )}
    {collapsed && badge && badge > 0 && (
      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
    )}
  </button>
);
