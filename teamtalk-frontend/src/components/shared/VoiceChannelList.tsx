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
          className="w-full flex items-center gap-2 text-left text-[13px] font-semibold px-2 py-1.5 rounded-md hover:bg-white/5 transition-colors"
        >
          <Volume2 size={14} className="text-gray-400" />
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
                className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-white/5 transition-colors"
              >
                <div className="relative w-10 h-10 flex-shrink-0">
                  <div
                    className={`w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold text-white ${u.isSpeaking ? 'voice-speaking' : ''}`}
                    style={{ backgroundColor: u.avatarUrl ? 'transparent' : colorFor(u.username) }}
                  >
                    {u.avatarUrl ? (
                      <img src={u.avatarUrl} alt={u.username} className="w-full h-full object-cover" />
                    ) : (
                      initialsFor(u.username)
                    )}
                  </div>
                  {u.isLive && (
                    <div className="absolute -bottom-1 right-0 bg-red-500 text-white text-[9px] font-bold px-1 py-0.5 rounded">
                      LIVE
                    </div>
                  )}
                  <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-surface-900 ${statusClass}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] truncate">{u.username}</div>
                </div>
                {u.isDeafened ? (
                  <Headphones size={14} className="text-gray-500" />
                ) : u.isMuted ? (
                  <MicOff size={14} className="text-gray-500" />
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
