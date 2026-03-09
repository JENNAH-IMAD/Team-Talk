import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Send, Paperclip, AtSign, Smile, Hash, Lock, MessageSquare, X, Image } from 'lucide-react';
import EmojiPicker, { type EmojiClickData, Theme } from 'emoji-picker-react';
import { useAppDispatch, useAppSelector, useAuth } from '@/hooks';
import { signalRService } from '@/services/signalRService';
import { fetchMessages, sendMessage, setActiveChannel, editMessage, deleteMessage } from '@/store/slices/chatSlice';
import { MessageBubble } from '@/components/shared';
import { Avatar, Loader } from '@/components/ui';
import { cn } from '@/utils';
import apiClient from '@/services/apiClient';
import type { User } from '@/types';

// Base URL for static assets (uploads). Strip /api suffix so images go to /uploads/...
const API_BASE = (import.meta.env.VITE_API_URL as string || '/api').replace(/\/api$/, '');

// ── Members Panel ─────────────────────────────────────────
const MembersPanel: React.FC<{ users: Record<string, User> }> = ({ users }) => {
  const list = Object.values(users);
  const online = list.filter((u) => u.status === 'online');
  const offline = list.filter((u) => u.status !== 'online');

  return (
    <aside className="w-[240px] bg-white dark:bg-surface-900 border-l border-subtle flex flex-col h-full flex-shrink-0">
      <div className="px-4 py-3.5 border-b border-subtle">
        <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 font-display">
          Members — {list.length}
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
        {online.length > 0 && (
          <>
            <div className="px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-600">
              Online — {online.length}
            </div>
            {online.map((u) => (
              <div key={u.id} className="flex items-center gap-2.5 px-4 py-1.5 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors">
                <Avatar user={u} size="sm" />
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-gray-900 dark:text-gray-100 truncate">{u.name}</div>
                  <div className="text-[11px] text-gray-400 dark:text-gray-600 truncate">{u.title}</div>
                </div>
              </div>
            ))}
          </>
        )}
        {offline.length > 0 && (
          <>
            <div className="px-4 py-2 mt-2 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-600">
              Offline — {offline.length}
            </div>
            {offline.map((u) => (
              <div key={u.id} className="flex items-center gap-2.5 px-4 py-1.5 opacity-50">
                <Avatar user={u} size="sm" />
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-gray-900 dark:text-gray-100 truncate">{u.name}</div>
                  <div className="text-[11px] text-gray-400 truncate">{u.title}</div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </aside>
  );
};

// ── Typing Indicator ──────────────────────────────────────
const TypingIndicator: React.FC = () => (
  <div className="flex items-center gap-2 px-5 py-1">
    <div className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-600"
          style={{ animation: `typing 1.4s ${i * 0.2}s infinite ease-in-out` }}
        />
      ))}
    </div>
    <span className="text-xs text-gray-400 dark:text-gray-600">Someone is typing…</span>
  </div>
);

const FALLBACK_USER = (id: string): User => ({
  id, name: 'Unknown User', email: '', role: 'employee', status: 'offline', title: '', createdAt: '',
});

// ═══════════════════════════════════════════════════════════
// CHAT VIEW PAGE
// ═══════════════════════════════════════════════════════════
const ChatView: React.FC = () => {
  const { channelId } = useParams<{ channelId: string }>();
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const messages = useAppSelector((s) => (channelId ? s.chat.messages[channelId] : undefined));
  const isLoading = useAppSelector((s) => s.chat.isLoading);

  const [messageText, setMessageText] = useState('');
  const [showTyping, setShowTyping] = useState(false);
  const [showMembers] = useState(true);
  const [usersMap, setUsersMap] = useState<Record<string, User>>({});

  // Emoji picker
  const [showEmoji, setShowEmoji] = useState(false);
  const emojiRef = useRef<HTMLDivElement>(null);

  // @mention autocomplete
  const [mentionSuggestions, setMentionSuggestions] = useState<User[]>([]);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // File upload
  const [attachments, setAttachments] = useState<{ url: string; name: string; type: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channels = useAppSelector((s) => s.teams.channels);
  const channel = channels.find((c) => c.id === channelId);

  useEffect(() => {
    apiClient.get<User[]>('/users').then(({ data }) => {
      const map: Record<string, User> = {};
      data.forEach((u) => { map[u.id] = u; });
      setUsersMap(map);
    });
  }, []);

  useEffect(() => {
    if (channelId) {
      dispatch(setActiveChannel(channelId));
      dispatch(fetchMessages({ channelId }));
      signalRService.joinChannel(channelId);
      return () => { signalRService.leaveChannel(channelId); };
    }
  }, [channelId, dispatch]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node))
        setShowEmoji(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── @mention detection ───────────────────────────────────
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setMessageText(val);
    const cursor = e.target.selectionStart ?? val.length;
    const before = val.slice(0, cursor);
    const match = before.match(/@([\w ]*)$/);
    if (match) {
      const query = match[1].toLowerCase();
      setMentionStart(cursor - match[0].length);
      const allUsers = Object.values(usersMap);
      setMentionSuggestions(
        allUsers.filter((u) => u.id !== user?.id && u.name.toLowerCase().includes(query)).slice(0, 5)
      );
    } else {
      setMentionSuggestions([]);
      setMentionStart(null);
    }
  }, [usersMap, user]);

  const insertMention = (u: User) => {
    if (mentionStart === null) return;
    const cursor = inputRef.current?.selectionStart ?? messageText.length;
    const before = messageText.slice(0, mentionStart);
    const after = messageText.slice(cursor);
    setMessageText(`${before}@${u.name} ${after}`);
    setMentionSuggestions([]);
    setMentionStart(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // ── Emoji picker ─────────────────────────────────────────
  const onEmojiClick = (data: EmojiClickData) => {
    setMessageText((prev) => prev + data.emoji);
    setShowEmoji(false);
    inputRef.current?.focus();
  };

  // ── File upload ──────────────────────────────────────────
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

  // ── Send ─────────────────────────────────────────────────
  const handleSend = () => {
    if ((!messageText.trim() && attachments.length === 0) || !channelId) return;
    let content = messageText.trim();
    for (const att of attachments) {
      content += att.type.startsWith('image/')
        ? `\n![${att.name}](${API_BASE}${att.url})`
        : `\n[📎 ${att.name}](${API_BASE}${att.url})`;
    }
    dispatch(sendMessage({ channelId, content }));
    setMessageText('');
    setAttachments([]);
    setShowTyping(true);
    setTimeout(() => setShowTyping(false), 2500);
  };

  const handleEdit = (messageId: string, content: string) => {
    if (channelId) dispatch(editMessage({ channelId, messageId, content }));
  };

  const handleDelete = (messageId: string) => {
    if (channelId) dispatch(deleteMessage({ channelId, messageId }));
  };

  if (!channelId || !channel) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <MessageSquare size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-700" />
          <p className="text-gray-400 dark:text-gray-600 font-medium">Select a channel to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="px-5 pt-5 pb-6 border-b border-subtle/50 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center mb-3">
              {channel.isPrivate ? <Lock size={22} className="text-brand-500" /> : <Hash size={22} className="text-brand-500" />}
            </div>
            <h2 className="text-xl font-black text-gray-900 dark:text-gray-100 font-display mb-1">
              Welcome to #{channel.name}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {channel.description}. This is the start of the{' '}
              <strong className="text-gray-700 dark:text-gray-300">#{channel.name}</strong> channel.
            </p>
          </div>

          {isLoading ? (
            <Loader />
          ) : (
            messages?.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                user={usersMap[msg.userId] ?? FALLBACK_USER(msg.userId)}
                isOwn={msg.userId === user?.id}
                currentUserId={user?.id}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))
          )}
          {showTyping && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="p-4 border-t border-subtle">
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

          <div className="relative flex items-end gap-2 bg-surface-100 dark:bg-surface-850 rounded-xl px-3.5 py-2.5 border border-subtle focus-within:border-brand-500/40 transition-colors">
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
              <Paperclip size={18} className={uploading ? 'animate-pulse text-brand-500' : ''} />
            </button>

            <input
              ref={inputRef}
              value={messageText}
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
              placeholder={`Message #${channel.name}`}
              className="flex-1 bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 font-body"
            />

            <div className="flex items-center gap-1 flex-shrink-0 mb-0.5">
              <button
                onClick={() => { setMessageText((p) => p + '@'); inputRef.current?.focus(); }}
                className="p-1 text-gray-400 hover:text-brand-500 transition-colors"
                title="Mention someone"
              >
                <AtSign size={18} />
              </button>

              {/* Emoji picker */}
              <div ref={emojiRef} className="relative">
                <button
                  onClick={() => setShowEmoji((v) => !v)}
                  className={cn('p-1 transition-colors', showEmoji ? 'text-brand-500' : 'text-gray-400 hover:text-brand-500')}
                  title="Emoji"
                >
                  <Smile size={18} />
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
                disabled={!messageText.trim() && attachments.length === 0}
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
                  (messageText.trim() || attachments.length > 0)
                    ? 'bg-brand-500 hover:bg-brand-600 text-white'
                    : 'bg-surface-200 dark:bg-surface-800 text-gray-400 cursor-not-allowed'
                )}
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {showMembers && <MembersPanel users={usersMap} />}
    </div>
  );
};

export default ChatView;
