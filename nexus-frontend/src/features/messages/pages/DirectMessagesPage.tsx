import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MessageSquare, X, Send, Paperclip, Smile, AtSign, Image } from 'lucide-react';
import EmojiPicker, { type EmojiClickData, Theme } from 'emoji-picker-react';
import { Avatar } from '@/components/ui';
import { MessageBubble } from '@/components/shared';
import apiClient from '@/services/apiClient';
import { signalRService } from '@/services/signalRService';
import { useAuth } from '@/hooks';
import { cn } from '@/utils';
import type { User, Message } from '@/types';

// Base URL for static assets (uploads). Strip /api suffix so images go to /uploads/...
const API_BASE = (import.meta.env.VITE_API_URL as string || '/api').replace(/\/api$/, '');

const STATUS_DOT: Record<string, string> = {
  online: 'bg-emerald-500',
  away: 'bg-amber-500',
  donotdisturb: 'bg-red-500',
  offline: 'bg-gray-300 dark:bg-gray-600',
};

const STATUS_LABEL: Record<string, string> = {
  online: 'Online',
  away: 'Away',
  donotdisturb: 'Do Not Disturb',
  offline: 'Offline',
};

const ROLE_FILTER: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'employee', label: 'Employee' },
];

// ── DM Conversation ─────────────────────────────────────────
interface DmConversationProps {
  peer: User;
  me: User;
  onClose: () => void;
}

const DMConversation: React.FC<DmConversationProps> = ({ peer, me, onClose }) => {
  const [channelId, setChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Emoji picker
  const [showEmoji, setShowEmoji] = useState(false);
  const emojiRef = useRef<HTMLDivElement>(null);

  // @mention autocomplete
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [mentionSuggestions, setMentionSuggestions] = useState<User[]>([]);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // File upload
  const [attachments, setAttachments] = useState<{ url: string; name: string; type: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch or create DM channel, then load messages
  useEffect(() => {
    setLoading(true);
    setMessages([]);
    setChannelId(null);
    apiClient
      .get<{ channelId: string }>(`/dm/${peer.id}`)
      .then(({ data }) => {
        setChannelId(data.channelId);
        return apiClient.get<{ data: Message[]; hasMore: boolean }>(
          `/channels/${data.channelId}/messages`,
          { params: { page: 1, pageSize: 50 } }
        );
      })
      .then(({ data }) => setMessages(data.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [peer.id]);

  // Load users for @mention
  useEffect(() => {
    apiClient.get<User[]>('/users').then(({ data }) => setAllUsers(data));
  }, []);

  // Real-time: listen for incoming DMs on this channel
  useEffect(() => {
    if (!channelId) return;
    const handler = (message: Message) => {
      if (message.channelId !== channelId) return;
      setMessages((prev) => prev.some((m) => m.id === message.id) ? prev : [...prev, message]);
    };
    signalRService.onDmReceived(handler);
    return () => { signalRService.offEvent('DmReceived', handler); };
  }, [channelId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close emoji picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node))
        setShowEmoji(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // @mention detection
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setText(val);
    const cursor = e.target.selectionStart ?? val.length;
    const before = val.slice(0, cursor);
    const match = before.match(/@([\w ]*)$/);
    if (match) {
      const query = match[1].toLowerCase();
      setMentionStart(cursor - match[0].length);
      setMentionSuggestions(
        allUsers.filter((u) => u.id !== me.id && u.name.toLowerCase().includes(query)).slice(0, 5)
      );
    } else {
      setMentionSuggestions([]);
      setMentionStart(null);
    }
  }, [allUsers, me.id]);

  const insertMention = (u: User) => {
    if (mentionStart === null) return;
    const cursor = inputRef.current?.selectionStart ?? text.length;
    const before = text.slice(0, mentionStart);
    const after = text.slice(cursor);
    setText(`${before}@${u.name} ${after}`);
    setMentionSuggestions([]);
    setMentionStart(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // Emoji picker
  const onEmojiClick = (data: EmojiClickData) => {
    setText((prev) => prev + data.emoji);
    setShowEmoji(false);
    inputRef.current?.focus();
  };

  // File upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await apiClient.post<{ url: string; fileName: string; contentType: string }>(
        '/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setAttachments((prev) => [...prev, { url: data.url, name: data.fileName, type: data.contentType }]);
    } catch {
      // ignore
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (idx: number) => setAttachments((prev) => prev.filter((_, i) => i !== idx));

  const handleSend = useCallback(async () => {
    if ((!text.trim() && attachments.length === 0) || !channelId || sending) return;
    let content = text.trim();
    for (const att of attachments) {
      content += att.type.startsWith('image/')
        ? `\n![${att.name}](${API_BASE}${att.url})`
        : `\n[📎 ${att.name}](${API_BASE}${att.url})`;
    }
    setText('');
    setAttachments([]);
    setSending(true);
    try {
      const { data } = await apiClient.post<Message>(
        `/channels/${channelId}/messages`,
        { content }
      );
      setMessages((prev) => [...prev, data]);
    } catch {
      setText(content);
    } finally {
      setSending(false);
    }
  }, [text, attachments, channelId, sending]);

  const handleEdit = useCallback(
    async (messageId: string, content: string) => {
      if (!channelId) return;
      const { data } = await apiClient.put<Message>(
        `/channels/${channelId}/messages/${messageId}`,
        { content }
      );
      setMessages((prev) => prev.map((m) => (m.id === messageId ? data : m)));
    },
    [channelId]
  );

  const handleDelete = useCallback(
    async (messageId: string) => {
      if (!channelId) return;
      await apiClient.delete(`/channels/${channelId}/messages/${messageId}`);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    },
    [channelId]
  );

  return (
    <motion.div
      key={peer.id}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.2 }}
      className="flex-1 flex flex-col h-full min-w-0"
    >
      {/* Header */}
      <div className="h-14 border-b border-subtle bg-white dark:bg-surface-900 flex items-center px-5 gap-3 flex-shrink-0">
        <Avatar user={peer} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[14px] text-gray-900 dark:text-gray-100">{peer.name}</div>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[peer.status] ?? 'bg-gray-400'}`} />
            <span className="text-[11px] text-gray-400">{STATUS_LABEL[peer.status] ?? peer.status}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-gray-400 transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 p-8">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#6247ea18,#8b5cf618)' }}
            >
              <MessageSquare size={28} className="text-brand-500" />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-gray-900 dark:text-gray-100 font-display mb-1">
                Start a conversation with {peer.name}
              </h3>
              <p className="text-sm text-gray-500">{peer.title ?? peer.email}</p>
            </div>
          </div>
        ) : (
          <div className="py-2">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                user={msg.userId === me.id ? me : peer}
                isOwn={msg.userId === me.id}
                currentUserId={me.id}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-subtle bg-white dark:bg-surface-900 flex-shrink-0">
        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachments.map((att, i) => (
              <div key={i} className="relative group">
                {att.type.startsWith('image/') ? (
                  <img
                    src={`${API_BASE}${att.url}`}
                    alt={att.name}
                    className="h-16 w-16 object-cover rounded-lg border border-subtle"
                  />
                ) : (
                  <div className="h-12 px-3 flex items-center gap-2 bg-surface-100 dark:bg-surface-800 rounded-lg border border-subtle">
                    <Image size={14} className="text-brand-500 flex-shrink-0" />
                    <span className="text-xs text-gray-600 dark:text-gray-400 max-w-[80px] truncate">{att.name}</span>
                  </div>
                )}
                <button
                  onClick={() => removeAttachment(i)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* @mention suggestions */}
        {mentionSuggestions.length > 0 && (
          <div className="mb-2 bg-white dark:bg-surface-900 border border-subtle rounded-xl shadow-lg overflow-hidden">
            {mentionSuggestions.map((u) => (
              <button
                key={u.id}
                onMouseDown={(e) => { e.preventDefault(); insertMention(u); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors text-left"
              >
                <Avatar user={u} size="sm" />
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{u.name}</div>
                  <div className="text-xs text-gray-400">{u.title || u.role}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="relative flex items-end gap-2 bg-surface-100 dark:bg-surface-800 rounded-xl px-3.5 py-2.5 border border-subtle focus-within:border-brand-500/40 transition-colors">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/mp4,application/pdf"
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-1 text-gray-400 hover:text-brand-500 transition-colors flex-shrink-0 mb-0.5"
            title="Attach file or image"
          >
            <Paperclip size={17} className={uploading ? 'animate-pulse text-brand-500' : ''} />
          </button>

          <input
            ref={inputRef}
            value={text}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setMentionSuggestions([]); return; }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (mentionSuggestions.length > 0) {
                  insertMention(mentionSuggestions[0]);
                } else {
                  handleSend();
                }
              }
            }}
            placeholder={`Message ${peer.name}…`}
            className="flex-1 bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 font-body"
          />

          <div className="flex items-center gap-1 flex-shrink-0 mb-0.5">
            <button
              onClick={() => { setText((p) => p + '@'); inputRef.current?.focus(); }}
              className="p-1 text-gray-400 hover:text-brand-500 transition-colors"
              title="Mention someone"
            >
              <AtSign size={17} />
            </button>

            {/* Emoji picker */}
            <div ref={emojiRef} className="relative">
              <button
                onClick={() => setShowEmoji((v) => !v)}
                className={cn('p-1 transition-colors', showEmoji ? 'text-brand-500' : 'text-gray-400 hover:text-brand-500')}
                title="Emoji"
              >
                <Smile size={17} />
              </button>
              {showEmoji && (
                <div className="absolute bottom-10 right-0 z-50 shadow-2xl rounded-2xl overflow-hidden">
                  <EmojiPicker
                    onEmojiClick={onEmojiClick}
                    theme={document.documentElement.classList.contains('dark') ? Theme.DARK : Theme.LIGHT}
                    width={320}
                    height={380}
                  />
                </div>
              )}
            </div>

            <button
              onClick={handleSend}
              disabled={(!text.trim() && attachments.length === 0) || sending || !channelId}
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center transition-all flex-shrink-0',
                (text.trim() || attachments.length > 0) && !sending && channelId
                  ? 'bg-brand-500 hover:bg-brand-600 text-white'
                  : 'bg-surface-200 dark:bg-surface-700 text-gray-400 cursor-not-allowed'
              )}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════
// DIRECT MESSAGES PAGE
// ═══════════════════════════════════════════════════════════
const DirectMessagesPage: React.FC = () => {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [activeDM, setActiveDM] = useState<User | null>(null);

  useEffect(() => {
    apiClient
      .get<User[]>('/users')
      .then(({ data }) => setUsers(data.filter((u) => u.id !== me?.id)))
      .finally(() => setIsLoading(false));
  }, [me?.id]);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchQ =
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.title ?? '').toLowerCase().includes(q);
    const matchRole = !roleFilter || u.role === roleFilter;
    return matchQ && matchRole;
  });

  const online = filtered.filter((u) => u.status === 'online');
  const away = filtered.filter((u) => u.status === 'away' || u.status === 'donotdisturb');
  const offline = filtered.filter((u) => u.status === 'offline');

  const UserRow: React.FC<{ u: User }> = ({ u }) => (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => setActiveDM(u)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
        activeDM?.id === u.id
          ? 'bg-brand-500/10'
          : 'hover:bg-surface-100 dark:hover:bg-surface-800/60'
      }`}
    >
      <div className="relative flex-shrink-0">
        <Avatar user={u} size="sm" showStatus={false} />
        <div
          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-surface-900 ${
            STATUS_DOT[u.status] ?? 'bg-gray-300'
          }`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div
          className={`text-[13px] font-semibold truncate ${
            activeDM?.id === u.id ? 'text-brand-500' : 'text-gray-900 dark:text-gray-100'
          }`}
        >
          {u.name}
        </div>
        <div className="text-[11px] text-gray-400 truncate">{u.title ?? u.email}</div>
      </div>
    </motion.button>
  );

  const Section: React.FC<{ label: string; items: User[] }> = ({ label, items }) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-3">
        <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-600">
          {label} — {items.length}
        </div>
        {items.map((u) => (
          <UserRow key={u.id} u={u} />
        ))}
      </div>
    );
  };

  return (
    <div className="flex h-full">
      {/* Left panel */}
      <div className="w-72 border-r border-subtle bg-white dark:bg-surface-900 flex flex-col flex-shrink-0 h-full">
        <div className="p-3 border-b border-subtle">
          <div className="flex items-center gap-2 bg-surface-100 dark:bg-surface-800 rounded-lg px-3 py-1.5 mb-2">
            <Search size={13} className="text-gray-400 flex-shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people…"
              className="bg-transparent border-none outline-none text-xs text-gray-900 dark:text-gray-100 w-full placeholder-gray-400 font-body"
            />
            {search && (
              <button onClick={() => setSearch('')}>
                <X size={11} className="text-gray-400" />
              </button>
            )}
          </div>
          <div className="flex gap-1 flex-wrap">
            {ROLE_FILTER.map((f) => (
              <button
                key={f.value}
                onClick={() => setRoleFilter(f.value === roleFilter ? '' : f.value)}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-colors ${
                  roleFilter === f.value
                    ? 'bg-brand-500 text-white'
                    : 'bg-surface-100 dark:bg-surface-800 text-gray-500 hover:bg-surface-200 dark:hover:bg-surface-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
          {isLoading ? (
            <div className="space-y-2 p-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <div className="w-8 h-8 rounded-lg bg-surface-100 dark:bg-surface-800 animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-surface-100 dark:bg-surface-800 rounded animate-pulse w-3/4" />
                    <div className="h-2.5 bg-surface-100 dark:bg-surface-800 rounded animate-pulse w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <Section label="Online" items={online} />
              <Section label="Away" items={away} />
              <Section label="Offline" items={offline} />
              {filtered.length === 0 && (
                <div className="text-center py-8 text-sm text-gray-400">No users found</div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right panel */}
      <AnimatePresence mode="wait">
        {activeDM && me ? (
          <DMConversation
            key={activeDM.id}
            peer={activeDM}
            me={me}
            onClose={() => setActiveDM(null)}
          />
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex items-center justify-center flex-col gap-3 text-center p-8"
          >
            <div className="w-16 h-16 rounded-2xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
              <MessageSquare size={28} className="text-gray-300 dark:text-gray-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-gray-100 font-display mb-1">
                Direct Messages
              </h3>
              <p className="text-sm text-gray-400">Select a person to start a private conversation</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DirectMessagesPage;
