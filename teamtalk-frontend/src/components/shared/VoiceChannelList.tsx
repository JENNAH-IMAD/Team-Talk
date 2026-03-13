import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Headphones, MicOff, Volume2 } from 'lucide-react';

export type VoiceChannelUser = {
  id: string;
  username: string;
  avatarUrl?: string | null;
  isSpeaking?: boolean;
  isMuted?: boolean;
  isDeafened?: boolean;
  isLive?: boolean;
  status?: 'online' | 'idle' | 'dnd' | 'offline' | string;
};

export type VoiceChannel = {
  id: string;
  name: string;
  users: VoiceChannelUser[];
};

const STATUS_COLOR: Record<string, string> = {
  online: 'bg-emerald-500',
  idle: 'bg-amber-500',
  dnd: 'bg-red-500',
  offline: 'bg-gray-500',
};

const initialsFor = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]!.toUpperCase()).join('');

const colorFor = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = value.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 70% 55%)`;
};

const VoiceChannelList: React.FC<{ channel: VoiceChannel; showHeader?: boolean; indent?: number }> = ({ channel, showHeader = true, indent = 8 }) => {
  const [expanded, setExpanded] = useState(true);
  const users = useMemo(() => channel.users ?? [], [channel.users]);

  return (
    <div className="text-gray-300">
      {showHeader && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center gap-2 text-left text-[12px] font-semibold px-2 py-1.5 rounded-md hover:bg-white/5 transition-colors text-gray-300"
        >
          <Volume2 size={13} className="text-gray-400" />
          <span className="truncate">{channel.name}</span>
          <span className="ml-auto text-gray-500">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        </button>
      )}

      {(!showHeader || expanded) && (
        <div className="mt-1 space-y-0.5" style={{ paddingLeft: indent }}>
          {users.map((u) => {
            const statusClass = STATUS_COLOR[(u.status ?? 'offline').toLowerCase()] ?? STATUS_COLOR.offline;
            return (
              <div
                key={u.id}
                className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-surface-800/60 transition-colors"
              >
                <div className="relative w-6 h-6 flex-shrink-0">
                  <div
                    className={`w-6 h-6 rounded-full overflow-hidden flex items-center justify-center text-[10px] font-bold text-white ${u.isSpeaking ? 'voice-speaking' : ''}`}
                    style={{ backgroundColor: u.avatarUrl ? 'transparent' : colorFor(u.username) }}
                  >
                    {u.avatarUrl ? (
                      <img src={u.avatarUrl} alt={u.username} className="w-full h-full object-cover" />
                    ) : (
                      initialsFor(u.username)
                    )}
                  </div>
                  {u.isLive && (
                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold px-1 py-0.5 rounded">
                      LIVE
                    </div>
                  )}
                  <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-surface-900 ${statusClass}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] truncate text-gray-200">{u.username}</div>
                </div>
                {u.isDeafened ? (
                  <span className="w-5 h-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center">
                    <Headphones size={12} />
                  </span>
                ) : u.isMuted ? (
                  <span className="w-5 h-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center">
                    <MicOff size={12} />
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default VoiceChannelList;
