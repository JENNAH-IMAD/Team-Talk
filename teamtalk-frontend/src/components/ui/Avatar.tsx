import React from 'react';
import { cn, getInitials, getAvatarColor } from '@/utils';
import type { User, UserStatus } from '@/types';

interface AvatarProps {
  user: Pick<User, 'id' | 'name' | 'status' | 'avatarUrl'>;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showStatus?: boolean;
  className?: string;
}

const STATUS_COLORS: Record<UserStatus, string> = {
  online: 'bg-emerald-500',
  away: 'bg-amber-500',
  donotdisturb: 'bg-red-500',
  offline: 'bg-gray-400 dark:bg-gray-600',
};

const SIZES = {
  xs: 'w-6 h-6 text-[9px]',
  sm: 'w-8 h-8 text-[11px]',
  md: 'w-9 h-9 text-xs',
  lg: 'w-11 h-11 text-sm',
  xl: 'w-14 h-14 text-base',
};

const STATUS_SIZES = {
  xs: 'w-2 h-2 -bottom-px -right-px',
  sm: 'w-2.5 h-2.5 -bottom-px -right-px',
  md: 'w-3 h-3 -bottom-0.5 -right-0.5',
  lg: 'w-3.5 h-3.5 -bottom-0.5 -right-0.5',
  xl: 'w-4 h-4 -bottom-0.5 -right-0.5',
};

export const Avatar: React.FC<AvatarProps> = ({
  user,
  size = 'md',
  showStatus = true,
  className,
}) => {
  const color = getAvatarColor(user.id);

  return (
    <div className={cn('relative flex-shrink-0', className)}>
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={user.name}
          className={cn(SIZES[size], 'rounded-lg object-cover')}
        />
      ) : (
        <div
          className={cn(
            SIZES[size],
            'rounded-lg flex items-center justify-center font-bold text-white select-none'
          )}
          style={{ backgroundColor: color }}
        >
          {getInitials(user.name)}
        </div>
      )}
      {showStatus && (
        <div
          className={cn(
            'absolute rounded-full border-2 border-white dark:border-surface-900',
            STATUS_COLORS[user.status],
            STATUS_SIZES[size]
          )}
        />
      )}
    </div>
  );
};
