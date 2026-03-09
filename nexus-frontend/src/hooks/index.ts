import { useEffect, useRef, useCallback, useState, RefObject } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
import { useSelector, useDispatch } from 'react-redux';
import type { TypedUseSelectorHook } from 'react-redux';
import type { RootState, AppDispatch } from '@/store';
import { signalRService } from '@/services/signalRService';
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

  useEffect(() => {
    // On logout — stop the connection
    if (!isAuthenticated) {
      signalRService.offAll();
      signalRService.stop();
      return;
    }

    signalRService.start().then(() => {
      if (!signalRService.isConnected()) return;

      // Clear previous handlers to avoid duplicates (React Strict Mode double-invoke)
      signalRService.offAll();

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
      signalRService.onDmReceived((message: Message) => {
        dispatch(addMessage(message));
        toast.success('New direct message received', { id: `dm-${message.id}`, duration: 4000 });
      });
      signalRService.onMessageReacted((data) => {
        dispatch(updateReactions(data));
      });
    });

    return () => {
      signalRService.offAll();
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
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('nexus_theme') === 'dark' ||
        (!localStorage.getItem('nexus_theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return true;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('nexus_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('nexus_theme', 'light');
    }
  }, [isDark]);

  const toggle = useCallback(() => setIsDark((prev) => !prev), []);

  return { isDark, toggle };
}
