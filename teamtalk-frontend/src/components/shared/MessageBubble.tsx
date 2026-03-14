import React, { useState, useEffect } from 'react';
import { Edit2, Trash2, Smile, Reply, Bookmark, Check, X, FileText, FileArchive, FileSpreadsheet, File, Film, Download } from 'lucide-react';
import { Avatar } from '@/components/ui';
import { formatTime, cn } from '@/utils';
import apiClient from '@/services/apiClient';
import type { Message, User, Attachment } from '@/types';

const API_BASE = (import.meta.env.VITE_API_URL as string || '/api').replace(/\/api$/, '');

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentCard({ att }: { att: Attachment }) {
  const url = att.url.startsWith('http') ? att.url : `${API_BASE}${att.url}`;
  const mime = att.contentType ?? '';
  const isImage = mime.startsWith('image/');
  const isVideo = mime.startsWith('video/');
  const isPdf = mime === 'application/pdf' || att.fileName.endsWith('.pdf');
  const isZip = mime.includes('zip') || /\.(zip|rar|7z|tar|gz)$/i.test(att.fileName);
  const isSheet = mime.includes('spreadsheet') || mime.includes('excel') || /\.(xlsx|xls|csv)$/i.test(att.fileName);

  if (isImage) {
    return (
      <img
        src={url}
        alt={att.fileName}
        className="max-w-xs max-h-64 rounded-xl border border-subtle object-cover cursor-pointer hover:opacity-90 transition-opacity"
        onClick={() => window.open(url, '_blank')}
      />
    );
  }

  if (isVideo) {
    return (
      <video
        src={url}
        controls
        className="max-w-xs rounded-xl border border-subtle"
      />
    );
  }

  let icon = <File size={18} className="text-brand-500 flex-shrink-0" />;
  if (isPdf) icon = <FileText size={18} className="text-red-500 flex-shrink-0" />;
  else if (isZip) icon = <FileArchive size={18} className="text-amber-500 flex-shrink-0" />;
  else if (isSheet) icon = <FileSpreadsheet size={18} className="text-emerald-500 flex-shrink-0" />;
  else if (isVideo) icon = <Film size={18} className="text-purple-500 flex-shrink-0" />;

  return (
    <a
      href={url}
      download={att.fileName}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2.5 px-3 py-2 bg-surface-100 dark:bg-surface-800 border border-subtle rounded-xl hover:border-brand-500/40 transition-colors max-w-xs group"
    >
      {icon}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{att.fileName}</p>
        {att.fileSize > 0 && <p className="text-[10px] text-gray-400">{fmtBytes(att.fileSize)}</p>}
      </div>
      <Download size={13} className="text-gray-400 group-hover:text-brand-500 transition-colors flex-shrink-0" />
    </a>
  );
}

// Quick emoji picker (no heavy library needed for 6 common emojis)
const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

interface MessageBubbleProps {
  message: Message;
  user: User;
  isOwn: boolean;
  currentUserId?: string;
  onEdit?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
  onReply?: (messageId: string) => void;
  onReactionToggle?: (messageId: string, emoji: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  user,
  isOwn,
  currentUserId,
  onEdit,
  onDelete,
  onReply,
  onReactionToggle,
}) => {
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const [localReactions, setLocalReactions] = useState(message.reactions ?? []);
  // Keep in sync when Redux updates (via SignalR broadcast)
  useEffect(() => { setLocalReactions(message.reactions ?? []); }, [message.reactions]);

  const handleSaveEdit = () => {
    if (editText.trim() && editText !== message.content) {
      onEdit?.(message.id, editText);
    }
    setEditing(false);
  };

  const handleReact = async (emoji: string) => {
    setShowEmojiPicker(false);
    try {
      const { data } = await apiClient.post<{ reactions: { emoji: string; users: string[] }[] }>(
        `/channels/${message.channelId}/messages/${message.id}/reactions`,
        { emoji }
      );
      setLocalReactions(data.reactions);
      onReactionToggle?.(message.id, emoji);
    } catch {
      // silently fail — server will broadcast via SignalR anyway
    }
  };

  const hasReacted = (emoji: string) =>
    localReactions.find((r) => r.emoji === emoji)?.users.includes(currentUserId ?? '') ?? false;

  // Fix legacy URLs that were stored as /api/uploads/... → /uploads/...
  const fixUrl = (url: string) => url.replace(/^\/api\/uploads\//, '/uploads/');

  const renderContent = (text: string) => {
    const elements: React.ReactNode[] = [];
    const regex = /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|(@[\w][^\s]*)/g;
    let last = 0;
    let match;
    let key = 0;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > last) {
        const between = text.slice(last, match.index);
        between.split(/(@[\w][^\s]*)/).forEach((part) => {
          if (/^@[\w]/.test(part)) {
            elements.push(
              <span key={key++} className="bg-brand-500/10 text-brand-500 dark:text-brand-300 px-1 rounded font-semibold">{part}</span>
            );
          } else {
            elements.push(<React.Fragment key={key++}>{part}</React.Fragment>);
          }
        });
      }
      if (match[1] !== undefined) {
        const mediaSrc = fixUrl(match[2]);
        const isClip = /\.mp4(\?|$)/i.test(mediaSrc);
        if (isClip) {
          elements.push(
            <video key={key++} src={mediaSrc} autoPlay loop muted playsInline
              className="max-w-xs rounded-xl mt-1.5 border border-subtle"
            />
          );
        } else {
          elements.push(
            <img key={key++} src={mediaSrc} alt={match[1]}
              className="max-w-xs max-h-64 rounded-xl mt-1.5 border border-subtle object-cover cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => window.open(mediaSrc, '_blank')}
            />
          );
        }
      } else if (match[3] !== undefined) {
        const linkHref = fixUrl(match[4]);
        elements.push(
          <a key={key++} href={linkHref} target="_blank" rel="noreferrer"
            className="text-brand-500 underline hover:text-brand-400"
          >{match[3]}</a>
        );
      } else if (match[5]) {
        elements.push(
          <span key={key++} className="bg-brand-500/10 text-brand-500 dark:text-brand-300 px-1 rounded font-semibold">{match[5]}</span>
        );
      }
      last = match.index + match[0].length;
    }
    if (last < text.length) {
      text.slice(last).split(/(@[\w][^\s]*)/).forEach((part) => {
        if (/^@[\w]/.test(part)) {
          elements.push(<span key={key++} className="bg-brand-500/10 text-brand-500 dark:text-brand-300 px-1 rounded font-semibold">{part}</span>);
        } else {
          elements.push(<React.Fragment key={key++}>{part}</React.Fragment>);
        }
      });
    }
    return elements;
  };

  return (
    <div
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowEmojiPicker(false); }}
      className={cn(
        'group relative flex gap-3 px-5 py-1.5 transition-colors duration-100',
        showActions && 'bg-surface-50/60 dark:bg-surface-800/30'
      )}
    >
      <Avatar user={user} size="sm" showStatus={false} />

      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="font-bold text-[13px] text-gray-900 dark:text-gray-100 font-body">
            {user.name}
          </span>
          <span className="text-[11px] text-gray-400 dark:text-gray-600">
            {formatTime(message.timestamp)}
          </span>
          {(message.edited || message.isEdited) && (
            <span className="text-[10px] text-gray-400 dark:text-gray-600 italic">
              (edited)
            </span>
          )}
        </div>

        {/* Content */}
        {editing ? (
          <div className="flex items-center gap-2 mt-1">
            <input
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
              className="flex-1 bg-surface-100 dark:bg-surface-800 border border-subtle rounded-lg px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-brand-500"
              autoFocus
            />
            <button onClick={handleSaveEdit} className="p-1 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded">
              <Check size={16} />
            </button>
            <button onClick={() => { setEditing(false); setEditText(message.content); }} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded">
              <X size={16} />
            </button>
          </div>
        ) : (
          <>
            {message.content && (
              <div className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                {renderContent(message.content)}
              </div>
            )}
            {(message.attachments ?? []).length > 0 && (
              <div className="mt-1.5 flex flex-col gap-1.5">
                {message.attachments!.map(att => (
                  <AttachmentCard key={att.id} att={att} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Reactions */}
        {localReactions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {localReactions.map((reaction, i) => {
              const reacted = reaction.users.includes(currentUserId ?? '');
              return (
                <button
                  key={i}
                  onClick={() => handleReact(reaction.emoji)}
                  className={cn(
                    'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border transition-all',
                    reacted
                      ? 'bg-brand-500/15 border-brand-500/40 text-brand-600 dark:text-brand-300'
                      : 'bg-surface-100 dark:bg-surface-800 border-subtle hover:border-brand-500/50'
                  )}
                >
                  <span>{reaction.emoji}</span>
                  <span className="font-semibold text-gray-500 dark:text-gray-400">
                    {reaction.users.length}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Thread indicator */}
        {(message.threadCount ?? 0) > 0 && (
          <button className="flex items-center gap-1.5 mt-1.5 text-brand-500 text-xs font-semibold hover:underline">
            <Reply size={13} />
            {message.threadCount} {message.threadCount === 1 ? 'reply' : 'replies'}
          </button>
        )}
      </div>

      {/* Hover actions */}
      {showActions && !editing && (
        <div className="absolute -top-3 right-5 flex items-center bg-white dark:bg-surface-850 border border-subtle rounded-lg shadow-md p-0.5 animate-scale-in">
          {/* Emoji react button */}
          <div className="relative">
            <button
              onClick={() => setShowEmojiPicker((p) => !p)}
              title="React"
              className="p-1.5 rounded-md transition-colors text-gray-400 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <Smile size={14} />
            </button>
            {showEmojiPicker && (
              <div className="absolute bottom-full left-0 mb-1 flex gap-1 bg-white dark:bg-surface-900 border border-subtle rounded-xl shadow-lg p-1.5 z-30">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleReact(emoji)}
                    className={cn(
                      'text-base w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:scale-125',
                      hasReacted(emoji) ? 'bg-brand-500/15' : 'hover:bg-surface-100 dark:hover:bg-surface-800'
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {[
            { icon: Reply, label: 'Reply', onClick: () => onReply?.(message.id) },
            ...(isOwn ? [{ icon: Edit2, label: 'Edit', onClick: () => setEditing(true) }] : []),
            ...(isOwn ? [{ icon: Trash2, label: 'Delete', onClick: () => onDelete?.(message.id), danger: true }] : []),
            { icon: Bookmark, label: 'Save', onClick: () => {} },
          ].map((action, i) => (
            <button
              key={i}
              onClick={action.onClick}
              title={action.label}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                (action as { danger?: boolean }).danger
                  ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10'
                  : 'text-gray-400 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-gray-600 dark:hover:text-gray-300'
              )}
            >
              <action.icon size={14} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
