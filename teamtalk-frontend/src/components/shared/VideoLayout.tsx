import React, { useMemo, useEffect, useRef } from 'react';
import { Mic, MicOff, Monitor, MonitorOff, Video, VideoOff, PhoneOff, Volume2, VolumeX } from 'lucide-react';

export type ParticipantStream = {
  type: 'camera' | 'screen';
  stream?: MediaStream | null;
  screenIndex?: number;
};

export type Participant = {
  id: string;
  name: string;
  audioLevel: number;
  isMuted: boolean;
  isLive: boolean;
  isSpeaking: boolean;
  avatarUrl?: string;
  streams: ParticipantStream[];
};

export type VideoLayoutMode = 'grid' | 'speaker' | 'screen' | 'focus';

export interface VideoLayoutProps {
  participants: Participant[];
  mode: VideoLayoutMode;
  focusedId: string | null;
  onTileDoubleClick: (tileId: string) => void;
  onToggleCamera?: () => void;
  onToggleScreen?: () => void;
  onToggleMute?: () => void;
  onToggleSpeaker?: () => void;
  onEndCall?: () => void;
  cameraOn?: boolean;
  screenOn?: boolean;
  muted?: boolean;
  speakerOff?: boolean;
}

type Tile = {
  tileId: string;
  participant: Participant;
  stream?: ParticipantStream;
  label: string;
  isScreen: boolean;
};

const tileKey = (participantId: string, streamIndex: number) => `${participantId}:${streamIndex}`;

const VideoTile: React.FC<{
  tile: Tile;
  focused: boolean;
  onDoubleClick: () => void;
}> = ({ tile, focused, onDoubleClick }) => {
  const showOutline = tile.participant.audioLevel > 0.05 || tile.participant.isSpeaking;
  const isMuted = tile.participant.isMuted;
  const live = tile.participant.isLive || tile.isScreen;
  const initials = tile.participant.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]!.toUpperCase())
    .join('');

  return (
    <div
      onDoubleClick={onDoubleClick}
      className={`relative rounded-2xl overflow-hidden border transition-all group ${
        focused ? 'border-brand-500 shadow-lg' : showOutline ? 'border-emerald-400' : 'border-white/10'
      }`}
      style={{ background: '#101018' }}
      title="Double-click to focus"
    >
      {tile.stream?.stream ? (
        <video
          ref={el => { if (el && el.srcObject !== tile.stream?.stream) el.srcObject = tile.stream?.stream as MediaStream; }}
          autoPlay
          playsInline
          muted={tile.participant.id === 'local'}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: tile.isScreen ? 'contain' : 'cover' }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white text-lg font-bold">
            {tile.participant.avatarUrl
              ? <img src={tile.participant.avatarUrl} alt={tile.participant.name} className="w-full h-full rounded-full object-cover" />
              : initials}
          </div>
        </div>
      )}

      {live && (
        <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">LIVE</div>
      )}

      {isMuted && (
        <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1">
          <MicOff size={10} /> Muted
        </div>
      )}

      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
        <div className="bg-black/60 text-white text-xs font-semibold px-2 py-0.5 rounded">
          {tile.label}
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-white/80 bg-black/60 px-2 py-0.5 rounded">
          Double-click to focus
        </div>
      </div>
    </div>
  );
};

const VideoLayout: React.FC<VideoLayoutProps> = ({
  participants,
  mode,
  focusedId,
  onTileDoubleClick,
  onToggleCamera,
  onToggleScreen,
  onToggleMute,
  onToggleSpeaker,
  onEndCall,
  cameraOn,
  screenOn,
  muted,
  speakerOff,
}) => {
  const tiles = useMemo<Tile[]>(() => {
    const list: Tile[] = [];
    participants.forEach((p) => {
      if (p.streams.length === 0) {
        list.push({
          tileId: tileKey(p.id, 0),
          participant: p,
          label: p.name,
          isScreen: false,
        });
        return;
      }
      p.streams.forEach((s, i) => {
        const label = s.type === 'screen'
          ? `${p.name} Screen${s.screenIndex ? ` #${s.screenIndex}` : ''}`
          : p.name;
        list.push({
          tileId: tileKey(p.id, i),
          participant: p,
          stream: s,
          label,
          isScreen: s.type === 'screen',
        });
      });
    });
    return list;
  }, [participants]);

  const activeSpeaker = tiles.find(t => t.participant.audioLevel > 0.05 || t.participant.isSpeaking) || tiles[0];
  const focusTile = tiles.find(t => t.tileId === focusedId) || tiles[0];
  const focusSubtitle = focusTile
    ? `${focusTile.participant.name} - ${focusTile.isScreen ? "partage d'ecran" : 'camera principale'}`
    : '';
  const lastModeRef = useRef<VideoLayoutMode>('grid');

  useEffect(() => {
    if (mode !== 'focus') lastModeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (mode === 'focus') onTileDoubleClick(focusedId ?? '');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mode, focusedId, onTileDoubleClick]);

  const gridCols = Math.ceil(Math.sqrt(Math.max(tiles.length, 1)));

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-1 min-h-0 px-3 pb-3">
        {mode === 'speaker' && activeSpeaker ? (
          <div className="flex flex-col h-full gap-2">
            <div className="relative" style={{ height: '75%' }}>
              <VideoTile
                tile={activeSpeaker}
                focused={activeSpeaker.tileId === focusedId}
                onDoubleClick={() => onTileDoubleClick(activeSpeaker.tileId)}
              />
            </div>
            <div className="flex gap-2 overflow-x-auto" style={{ height: '25%' }}>
              {tiles.filter(t => t.tileId !== activeSpeaker.tileId).map(t => (
                <div key={t.tileId} className="h-full flex-shrink-0" style={{ width: 180 }}>
                  <VideoTile tile={t} focused={t.tileId === focusedId} onDoubleClick={() => onTileDoubleClick(t.tileId)} />
                </div>
              ))}
            </div>
          </div>
        ) : mode === 'focus' && focusTile ? (
          <div className="relative h-full">
            <div className="absolute inset-0">
              <VideoTile
                tile={focusTile}
                focused
                onDoubleClick={() => onTileDoubleClick(focusTile.tileId)}
              />
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="w-24 h-24 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white text-2xl font-bold">
                {focusTile.participant.avatarUrl
                  ? <img src={focusTile.participant.avatarUrl} alt={focusTile.participant.name} className="w-full h-full rounded-full object-cover" />
                  : focusTile.participant.name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join('')}
              </div>
              <div className="mt-3 text-white text-sm font-semibold">{focusSubtitle}</div>
              <div className="text-xs text-white/70">Double-click pour revenir au mode precedent</div>
            </div>
            <div className="absolute bottom-3 right-3 flex gap-1.5">
              {tiles.filter(t => t.tileId !== focusTile.tileId).slice(0, 6).map(t => (
                <div key={t.tileId} style={{ width: 90, height: 60 }}>
                  <VideoTile tile={t} focused={false} onDoubleClick={() => onTileDoubleClick(t.tileId)} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div
            className="grid gap-2 h-full"
            style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
          >
            {(mode === 'screen'
              ? [...tiles.filter(t => t.isScreen), ...tiles.filter(t => !t.isScreen)]
              : tiles
            ).map(t => (
              <VideoTile key={t.tileId} tile={t} focused={t.tileId === focusedId} onDoubleClick={() => onTileDoubleClick(t.tileId)} />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-3 px-4 py-3 border-t border-white/10 bg-black/40">
        <button
          onClick={onToggleMute}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${muted ? 'bg-red-500/30 text-red-400' : 'bg-white/10 text-gray-200 hover:bg-white/20'}`}
        >
          {muted ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        <button
          onClick={onToggleSpeaker}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${speakerOff ? 'bg-red-500/30 text-red-400' : 'bg-white/10 text-gray-200 hover:bg-white/20'}`}
        >
          {speakerOff ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <button
          onClick={onToggleCamera}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${cameraOn ? 'bg-blue-500/30 text-blue-300' : 'bg-white/10 text-gray-200 hover:bg-white/20'}`}
        >
          {cameraOn ? <VideoOff size={18} /> : <Video size={18} />}
        </button>
        <button
          onClick={onToggleScreen}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${screenOn ? 'bg-emerald-500/30 text-emerald-300' : 'bg-white/10 text-gray-200 hover:bg-white/20'}`}
        >
          {screenOn ? <MonitorOff size={18} /> : <Monitor size={18} />}
        </button>
        <button
          onClick={onEndCall}
          className="w-12 h-12 rounded-full flex items-center justify-center bg-red-500 hover:bg-red-600 text-white transition-colors"
        >
          <PhoneOff size={18} />
        </button>
      </div>
    </div>
  );
};

export default VideoLayout;
