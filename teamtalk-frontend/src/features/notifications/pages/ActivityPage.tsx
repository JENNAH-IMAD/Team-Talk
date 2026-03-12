import React from 'react';
import { motion } from 'framer-motion';
import { Bell, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/hooks';
import { fetchNotifications, markAllAsReadApi, markAsReadApi } from '@/store/slices/notificationSlice';
import { resolveNotificationTarget } from '@/utils';
import { NotificationItem } from '@/components/shared';

const ActivityPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { notifications, isLoading } = useAppSelector((s) => s.notifications);
  const channels = useAppSelector((s) => s.teams.channels);
  const unread = notifications.filter((n) => !n.read).length;

  const handleClick = (n: typeof notifications[number]) => {
    if (!n.read) dispatch(markAsReadApi(n.id));
    const target = resolveNotificationTarget(n, channels);
    navigate(target.path, target.state ? { state: target.state } : undefined);
  };

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
            {notifications.map((n, i) => (
              <motion.div key={n.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <NotificationItem notification={n} onClick={handleClick} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityPage;
