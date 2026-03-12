import { useEffect, useRef, useCallback, useState, RefObject } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
import { useSelector, useDispatch } from 'react-redux';
import type { TypedUseSelectorHook } from 'react-redux';
import type { RootState, AppDispatch } from '@/store';
import { APP_CONFIG } from '@/app/config';
import { signalRService, useSignalRVersion } from '@/services/signalRService';
import apiClient from '@/services/apiClient';
import { addMessage, updateMessage, removeMessage, setTyping, updateReactions } from '@/store/slices/chatSlice';
import { addNotification } from '@/store/slices/notificationSlice';
import type { Message, Notification, TypingEvent } from '@/types';
import toast from 'react-hot-toast';

// ── Typed Redux Hooks ────────────────────────────────────────
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// ── useAuth ──────────────────────────────────────────────────
export function useAuth() {
  const { user, isAuthenticated, isLoading, error } = useAppSelector(
    (state) => state.auth
  );
  return { user, isAuthenticated, isLoading, error };
}

// ── useSignalR ───────────────────────────────────────────────
export function useSignalR() {
  const dispatch = useAppDispatch();
  const { isAuthenticated } = useAuth();
  // Tracked so we can re-join group channels after reconnect
  const groupsMapRef = useRef<Record<string, string>>({});

  useEffect(() => {
    // On logout — stop the connection
    if (!isAuthenticated) {
      signalRService.offAll();
      signalRService.stop();
      return;
    }

    // Global voice event handlers — dispatched as window events so any page can react
    const groupsMap = groupsMapRef.current;
    const onVoiceJoined = (data: { channelId: string; userId: string }) => {
      window.dispatchEvent(new CustomEvent('Team Talk:voiceJoined', {
        detail: { ...data, groupName: groupsMap[data.channelId] }
      }));
    };
    const onVoiceLeft = (data: { channelId: string; userId: string }) => {
      window.dispatchEvent(new CustomEvent('Team Talk:voiceLeft', {
        detail: { ...data, groupName: groupsMap[data.channelId] }
      }));
    };

    // Named handler so it can be individually removed in cleanup (avoids Strict Mode duplicates)
    const dmReceivedHandler = (message: Message) => {
      dispatch(addMessage(message));
      toast.success('New direct message received', { id: `dm-${message.id}`, duration: 4000 });
    };

    signalRService.start().then(() => {
      if (!signalRService.isConnected()) return;

      // Clear previous handlers owned exclusively by useSignalR (DmReceived excluded —
      // component-level handlers survive and use offEvent() for their own cleanup)
      signalRService.offAll();
      // Also remove previous dmReceivedHandler instance to avoid duplicates on re-run
      signalRService.offEvent('DmReceived', dmReceivedHandler as never);

      signalRService.onMessageReceived((message: Message) => {
        dispatch(addMessage(message));
      });
      signalRService.onMessageEdited((message: Message) => {
        dispatch(updateMessage(message));
      });
      signalRService.onMessageDeleted((messageId: string, channelId: string) => {
        dispatch(removeMessage({ messageId, channelId }));
      });
      signalRService.onTyping((event: TypingEvent) => {
        dispatch(setTyping(event));
      });
      signalRService.onNotification((notification: unknown) => {
        dispatch(addNotification(notification as Notification));
      });
      signalRService.onDmReceived(dmReceivedHandler);
      signalRService.onMessageReacted((data) => {
        dispatch(updateReactions(data));
      });

      // Register global voice presence handlers (component-level cleanup uses offEvent)
      signalRService.onUserJoinedVoice(onVoiceJoined);
      signalRService.onUserLeftVoice(onVoiceLeft);

      // Join all user's group DM channels so we receive voice events on any page.
      // Re-join on every reconnect (effect re-runs when signalRVersion increments).
      const existingIds = Object.keys(groupsMap);
      if (existingIds.length > 0) {
        // Already fetched — just re-join (handles reconnect case)
        existingIds.forEach(id => signalRService.joinChannel(id));
      } else {
        apiClient.get<{ channelId: string; name: string }[]>('/groups')
          .then(({ data }) => {
            data.forEach(g => {
              groupsMap[g.channelId] = g.name;
              signalRService.joinChannel(g.channelId);
            });
          })
          .catch(() => {});
      }
    });

    return () => {
      signalRService.offAll();
      signalRService.offEvent('DmReceived', dmReceivedHandler as never);
      signalRService.offEvent('UserJoinedVoice', onVoiceJoined as never);
      signalRService.offEvent('UserLeftVoice', onVoiceLeft as never);
      // Don't stop — connection is a global singleton, stops on logout above
    };
  }, [isAuthenticated, dispatch]);

  const joinChannel = useCallback((channelId: string) => {
    signalRService.joinChannel(channelId);
  }, []);

  const leaveChannel = useCallback((channelId: string) => {
    signalRService.leaveChannel(channelId);
  }, []);

  const sendTyping = useCallback((channelId: string, isTyping: boolean) => {
    signalRService.sendTyping(channelId, isTyping);
  }, []);

  return { joinChannel, leaveChannel, sendTyping };
}

// ── useDebounce ──────────────────────────────────────────────
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// ── useNotifications ─────────────────────────────────────────
export function useNotifications() {
  const { notifications, unreadCount } = useAppSelector(
    (state) => state.notifications
  );
  return { notifications, unreadCount };
}

// ── useClickOutside ──────────────────────────────────────────
export function useClickOutside(handler: () => void) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) return;
      handler();
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [handler]);

  return ref;
}

// ── useGsapReveal ────────────────────────────────────────────
// Animates children matching `selector` into view on scroll using GSAP
export function useGsapReveal(
  containerRef: RefObject<HTMLElement>,
  selector: string = '[data-reveal]',
  options?: { stagger?: number; y?: number; duration?: number }
) {
  useEffect(() => {
    if (!containerRef.current) return;
    const els = containerRef.current.querySelectorAll(selector);
    if (!els.length) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        els,
        { opacity: 0, y: options?.y ?? 24 },
        {
          opacity: 1,
          y: 0,
          duration: options?.duration ?? 0.55,
          stagger: options?.stagger ?? 0.08,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: containerRef.current,
            start: 'top 88%',
            once: true,
          },
        }
      );
    }, containerRef);
    return () => ctx.revert();
  }, [containerRef, selector, options?.stagger, options?.y, options?.duration]);
}

// ── useTheme ─────────────────────────────────────────────────
export function useTheme() {
  const storageKey = APP_CONFIG.theme.storageKey;
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(storageKey) === 'dark' ||
        (!localStorage.getItem(storageKey) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return true;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem(storageKey, 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem(storageKey, 'light');
    }
  }, [isDark, storageKey]);

  const toggle = useCallback(() => setIsDark((prev) => !prev), []);

  return { isDark, toggle };
}
