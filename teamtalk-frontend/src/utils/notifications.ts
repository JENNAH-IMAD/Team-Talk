import type { Notification } from '@/types';
import type { Channel } from '@/types';

export function resolveNotificationTarget(
  notification: Notification,
  channels: Channel[]
): { path: string; state?: Record<string, unknown> } {
  const type = notification.type.toLowerCase();

  if (notification.channelId) {
    const knownChannel = channels.find(c => c.id === notification.channelId);
    if (knownChannel) {
      return { path: `/dashboard/chat/${notification.channelId}` };
    }
    return { path: '/dashboard/messages', state: { openChannelId: notification.channelId } };
  }

  if (type === 'teaminvitation' || type === 'team') {
    return { path: '/dashboard/teams' };
  }

  return { path: '/dashboard/activity' };
}
