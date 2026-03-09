import React from 'react';
import { motion } from 'framer-motion';
import { Bell, AtSign, Reply, Users, Smile, Hash, RefreshCw } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { fetchNotifications, markAllAsReadApi } from '@/store/slices/notificationSlice';
import { formatTime } from '@/utils';

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  mention:        { icon: <AtSign size={14} />,  color: '#6247ea', bg: '#6247ea18' },
  reply:          { icon: <Reply size={14} />,   color: '#3b82f6', bg: '#3b82f618' },
  team:           { icon: <Users size={14} />,   color: '#10b981', bg: '#10b98118' },
  teaminvitation: { icon: <Users size={14} />,   color: '#10b981', bg: '#10b98118' },
  reaction:       { icon: <Smile size={14} />,   color: '#f59e0b', bg: '#f59e0b18' },
  newmessage:     { icon: <Hash size={14} />,    color: '#6b7280', bg: '#6b728018' },
  system:         { icon: <Bell size={14} />,    color: '#6b7280', bg: '#6b728018' },
};

const getConfig = (type: string) => TYPE_CONFIG[type.toLowerCase()] ?? TYPE_CONFIG['system'];

const ActivityPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { notifications, isLoading } = useAppSelector((s) => s.notifications);
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="flex-1 overflow-y-auto p-8 font-body">
      <div className="max-w-xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-black text-gray-900 dark:text-gray-100 font-display">Activity</h2>
            {unread > 0 && (
              <p className="text-sm text-gray-500 mt-0.5">
                <span className="text-brand-500 font-semibold">{unread}</span> unread
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => dispatch(fetchNotifications())}
              className="p-2 rounded-xl border border-subtle hover:bg-surface-50 dark:hover:bg-surface-800 text-gray-400 transition-colors" title="Refresh">
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
            {unread > 0 && (
              <button onClick={() => dispatch(markAllAsReadApi())}
                className="text-xs font-semibold text-brand-500 px-3 py-1.5 rounded-xl border border-brand-500/20 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors">
                Mark all read
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-surface-50 dark:bg-surface-800 rounded-xl animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center mx-auto mb-3">
              <Bell size={24} className="text-gray-300 dark:text-gray-600" />
            </div>
            <p className="text-sm text-gray-400">No activity yet</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {notifications.map((n, i) => {
              const cfg = getConfig(n.type);
              return (
                <motion.div key={n.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={`flex items-center gap-3.5 px-4 py-3.5 rounded-xl cursor-pointer transition-all hover:shadow-sm border ${
                    !n.read
                      ? 'bg-brand-50/60 dark:bg-brand-500/5 border-brand-100 dark:border-brand-500/10'
                      : 'bg-white dark:bg-surface-900 border-subtle'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 dark:text-gray-200">{n.content}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!n.read && <div className="w-2 h-2 rounded-full bg-brand-500" />}
                    <span className="text-xs text-gray-400">{formatTime(n.timestamp)}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityPage;
