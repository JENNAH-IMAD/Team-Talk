import React from 'react';
import { Bell, AtSign, Reply, Users, Smile, Hash } from 'lucide-react';
import { formatTime } from '@/utils';
import type { Notification } from '@/types';
import { cn } from '@/utils';

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  mention:        { icon: <AtSign size={14} />,  color: '#6247ea', bg: '#6247ea18' },
  reply:          { icon: <Reply size={14} />,   color: '#3b82f6', bg: '#3b82f618' },
  team:           { icon: <Users size={14} />,   color: '#10b981', bg: '#10b98118' },
  teaminvitation: { icon: <Users size={14} />,   color: '#10b981', bg: '#10b98118' },
  reaction:       { icon: <Smile size={14} />,   color: '#f59e0b', bg: '#f59e0b18' },
  newmessage:     { icon: <Hash size={14} />,    color: '#6b7280', bg: '#6b728018' },
  system:         { icon: <Bell size={14} />,    color: '#6b7280', bg: '#6b728018' },
};

const getConfig = (type: string) => TYPE_CONFIG[type.toLowerCase()] ?? TYPE_CONFIG.system;

interface NotificationItemProps {
  notification: Notification;
  compact?: boolean;
  onClick?: (notification: Notification) => void;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  compact = false,
  onClick,
}) => {
  const cfg = getConfig(notification.type);
  return (
    <div
      onClick={() => onClick?.(notification)}
      className={cn(
        'flex items-center gap-3.5 cursor-pointer transition-all',
        compact
          ? 'px-4 py-3 border-b border-subtle/50 hover:bg-surface-50 dark:hover:bg-surface-800/40'
          : 'px-4 py-3.5 rounded-xl border hover:shadow-sm',
        !notification.read &&
          (compact
            ? 'bg-brand-50/50 dark:bg-brand-500/5'
            : 'bg-brand-50/60 dark:bg-brand-500/5 border-brand-100 dark:border-brand-500/10'),
        notification.read && !compact && 'bg-white dark:bg-surface-900 border-subtle'
      )}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: cfg.bg, color: cfg.color }}
      >
        {cfg.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-gray-800 dark:text-gray-200">
          {notification.content
            .replace(/\[🎤 Voice Message\]\([^)]+\)/g, '🎤 Message vocal')
            .replace(/!\[[^\]]*\]\([^)]+\)/g, '📎 Fichier joint')}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {!notification.read && <div className="w-2 h-2 rounded-full bg-brand-500" />}
        <span className="text-[11px] text-gray-400">{formatTime(notification.timestamp)}</span>
      </div>
    </div>
  );
};
