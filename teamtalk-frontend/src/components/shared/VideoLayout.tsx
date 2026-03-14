import React, { useMemo, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Monitor, MonitorOff, Video, VideoOff, PhoneOff, Volume2, VolumeX } from 'lucide-react';

function generateColorFromId(id: string): string {
  const colors = ['#5865f2', '#eb459e', '#ed4245', '#faa61a', '#57f287', '#1abc9c', '#9b59b6', '#e67e22'];
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

function darkenColor(hex: string): string {
  if (!hex.startsWith('#') || hex.length < 7) return '#1e1f22';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * 0.4)}, ${Math.round(g * 0.4)}, ${Math.round(b * 0.4)})`;
}

function extractDominantColor(imageUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1; canvas.height = 1;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve('#1e1f22'); return; }
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(img, 0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        resolve(`rgb(${Math.round(d[0] * 0.4)}, ${Math.round(d[1] * 0.4)}, ${Math.round(d[2] * 0.4)})`);
      } catch {
        resolve('#1e1f22');
      }
    };
    img.onerror = () => resolve('#1e1f22');
    img.src = imageUrl;
  });
}

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
  color?: string;
  isMe?: boolean;
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
  audioLayout?: 'list' | 'tiles';
}

type Tile = {
  tileId: string;
  participant: Participant;
  stream?: ParticipantStream;
  label: string;
  isScreen: boolean;
};

const tileKey = (participantId: string, streamIndex: number) => `${participantId}:${streamIndex}`;

function hasLiveVideo(tile: Tile): boolean {
  return tile.stream?.stream?.getVideoTracks().some(t => t.readyState === 'live') ?? false;
}

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join('');
}

// ── Discord-style grid config ────────────────────────────────
type GridConfig = { columns: number; rows: number; avatarSize: number };
function getGridConfig(count: number): GridConfig {
  if (count <= 1) return { columns: 1, rows: 1, avatarSize: 80 };
  if (count === 2) return { columns: 2, rows: 1, avatarSize: 80 };
  if (count === 3) return { columns: 2, rows: 2, avatarSize: 72 };
  if (count === 4) return { columns: 2, rows: 2, avatarSize: 72 };
  if (count === 5) return { columns: 3, rows: 2, avatarSize: 64 };
  if (count === 6) return { columns: 3, rows: 2, avatarSize: 64 };
  if (count <= 9) return { columns: 3, rows: 3, avatarSize: 56 };
  return { columns: 4, rows: 4, avatarSize: 48 };
}

// Inject speaking ring keyframe once (module-level, no CSS file needed)
if (typeof document !== 'undefined' && !document.getElementById('ttk-speaking-ring')) {
  const _s = document.createElement('style');
  _s.id = 'ttk-speaking-ring';
  _s.textContent = '@keyframes ttk-speaking{0%,100%{box-shadow:0 0 0 3px #23a559}50%{box-shadow:0 0 0 6px rgba(35,165,89,.35)}}';
  document.head.appendChild(_s);
}

// ── Compact row for audio-only participants ─────────────────
// Height fixed at 72px; only expands to 16:9 when live video is present
const VideoTile: React.FC<{
  tile: Tile;
  focused: boolean;
  onDoubleClick: () => void;
  forceCompact?: boolean;
  volume?: number;
  onVolumeChange?: (participantId: string, delta: number) => void;
  onVolumeSet?: (participantId: string, value: number) => void;
  volumeOpen?: boolean;
  onToggleVolume?: (participantId: string) => void;
  variant?: 'row' | 'tile';
  avatarSize?: number;
}> = ({
  tile,
  focused,
  onDoubleClick,
  forceCompact,
  volume = 1,
  onVolumeChange,
  onVolumeSet,
  volumeOpen,
  onToggleVolume,
  variant = 'row',
  avatarSize,
}) => {
  const liveVideo = hasLiveVideo(tile);
  const showOutline = tile.participant.audioLevel > 0.05 || tile.participant.isSpeaking;
  const isMuted = tile.participant.isMuted;
  const live = tile.participant.isLive || tile.isScreen;
  const isMe = tile.participant.isMe;

  // Dominant background for tile variant — extracted from avatar or darkened ID color
  const baseColor = tile.participant.color ?? generateColorFromId(tile.participant.id);
  const [tileBg, setTileBg] = useState<string>(() =>
    tile.participant.avatarUrl ? '#1e1f22' : darkenColor(baseColor)
  );
  useEffect(() => {
    if (variant !== 'tile') return;
    if (tile.participant.avatarUrl) {
      setTileBg('#1e1f22');
      extractDominantColor(tile.participant.avatarUrl).then(setTileBg);
    } else {
      setTileBg(darkenColor(tile.participant.color ?? generateColorFromId(tile.participant.id)));
    }
  }, [tile.participant.avatarUrl, tile.participant.id, tile.participant.color, variant]);

  // Use a ref for the video element so srcObject is always synced even when the stream
  // object reference changes (e.g. peer rejoins, screen share restarts after leave/rejoin)
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const stream = tile.stream?.stream ?? null;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
      if (stream) el.play().catch(() => {});
    }
  }, [tile.stream?.stream]);

  // Audio-only → compact row
  if (!liveVideo || forceCompact) {
    const canAdjustVolume = tile.participant.id !== 'local' && onVolumeChange;
    if (variant === 'tile') {
      const sz = avatarSize ?? 80;
      return (
        <div
          onDoubleClick={onDoubleClick}
          className="relative flex items-center justify-center overflow-hidden cursor-pointer h-full w-full"
          style={{
            borderRadius: 12,
            background: tileBg,
            boxShadow: showOutline ? '0 0 0 3px #23a559' : 'none',
            animation: showOutline ? 'ttk-speaking 1.2s ease-in-out infinite' : 'none',
          }}
          title="Double-click to focus"
        >
          {/* Avatar circle */}
          <div style={{
            width: sz, height: sz, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: tile.participant.avatarUrl ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)',
            border: '2px solid rgba(255,255,255,0.2)',
          }}>
            {tile.participant.avatarUrl
              ? <img src={tile.participant.avatarUrl} alt={tile.participant.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ color: 'white', fontSize: Math.round(sz * 0.38), fontWeight: 700 }}>{getInitials(tile.participant.name)}</span>
            }
          </div>

          {/* Username label */}
          <div style={{
            position: 'absolute', bottom: 8, left: 10,
            fontSize: 13, color: 'white',
            background: 'rgba(0,0,0,0.5)', padding: '2px 8px', borderRadius: 4,
            maxWidth: 'calc(100% - 20px)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {tile.participant.name}
            {isMe && <span style={{ opacity: 0.7, fontSize: 10, marginLeft: 5 }}>(Vous)</span>}
          </div>

          {/* Muted indicator */}
          {isMuted && (
            <div style={{
              position: 'absolute', top: 8, right: 8,
              background: 'rgba(0,0,0,0.55)', borderRadius: '50%',
              width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <MicOff size={11} color="white" />
            </div>
          )}

          {/* LIVE badge */}
          {live && (
            <div style={{
              position: 'absolute', top: 8, left: 8,
              background: '#ed4245', color: 'white', fontSize: 9, fontWeight: 700,
              padding: '2px 5px', borderRadius: 3,
            }}>
              LIVE
            </div>
          )}
        </div>
      );
    }
    return (
      <div
        onDoubleClick={onDoubleClick}
        className={`flex items-center gap-3 px-3 rounded-2xl border transition-all cursor-pointer ${
          focused ? 'border-brand-500' : showOutline ? 'border-emerald-400' : 'border-white/10'
        }`}
        style={{ height: 56, minHeight: 56, maxHeight: 56, background: '#2b2d31', flexShrink: 0 }}
        title="Double-click to focus"
      >
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold overflow-hidden bg-white/10 border border-white/10">
          {tile.participant.avatarUrl
            ? <img src={tile.participant.avatarUrl} alt={tile.participant.name} className="w-full h-full object-cover" />
            : getInitials(tile.participant.name)}
        </div>

        {/* Name + status */}
        <div className="min-w-0 flex-1">
          <div className="text-white text-[13px] font-semibold truncate">{tile.participant.name}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {live && <span className="text-[9px] bg-red-500 text-white px-1 py-0.5 rounded font-bold">LIVE</span>}
            {isMuted && <span className="flex items-center gap-0.5 text-[9px] text-red-400"><MicOff size={9} /> Muted</span>}
            {showOutline && !isMuted && <span className="text-[9px] text-emerald-400">Speaking</span>}
          </div>
        </div>

        {/* Volume control — only for remote participants */}
        {canAdjustVolume && (
          <div
            className="relative flex items-center flex-shrink-0"
            onClick={e => e.stopPropagation()}
            onDoubleClick={e => e.stopPropagation()}
          >
            <button
              data-volume-toggle
              onClick={() => onToggleVolume?.(tile.participant.id)}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/15 text-white/70 flex items-center justify-center transition-colors"
              title="Volume"
            >
              <Volume2 size={14} />
            </button>
            {volumeOpen && (
              <div
                data-volume-popover
                className="absolute right-0 top-10 z-10 w-44 bg-[#1b1d22] border border-white/10 rounded-xl p-3 shadow-2xl"
              >
                <div className="text-[10px] text-white/60 mb-2">Volume</div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(volume * 100)}
                  onChange={(e) => onVolumeSet?.(tile.participant.id, Number(e.target.value) / 100)}
                  className="w-full"
                />
                <div className="text-[10px] text-white/60 text-right mt-1 tabular-nums">{Math.round(volume * 100)}%</div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Full 16:9 video tile
  return (
    <div
      onDoubleClick={onDoubleClick}
      className={`relative rounded-2xl overflow-hidden border transition-all group h-full w-full ${
        focused ? 'border-brand-500 shadow-lg' : showOutline ? 'border-emerald-400' : 'border-white/10'
      }`}
      style={{ background: '#101018' }}
      title="Double-click to focus"
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={tile.participant.id === 'local'}
        className="absolute inset-0 w-full h-full"
        style={{ objectFit: tile.isScreen ? 'contain' : 'cover' }}
      />
      {live && (
        <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">LIVE</div>
      )}
      {isMuted && (
        <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1">
          <MicOff size={10} /> Muted
        </div>
      )}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
        <div className="bg-black/60 text-white text-xs font-semibold px-2 py-0.5 rounded">{tile.label}</div>
        {/* Volume control on hover for remote video tiles */}
        {tile.participant.id !== 'local' && onVolumeChange && (
          <div
            className="relative opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-black/70 px-2 py-0.5 rounded"
            onClick={e => e.stopPropagation()}
            onDoubleClick={e => e.stopPropagation()}
          >
            <button
              data-volume-toggle
              onClick={() => onToggleVolume?.(tile.participant.id)}
              className="text-white/80 hover:text-white text-xs font-bold px-1"
            >
              <Volume2 size={12} />
            </button>
            {volumeOpen && (
              <div
                data-volume-popover
                className="absolute bottom-8 right-2 z-10 w-44 bg-[#1b1d22] border border-white/10 rounded-xl p-3 shadow-2xl"
              >
                <div className="text-[10px] text-white/60 mb-2">Volume</div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(volume * 100)}
                  onChange={(e) => onVolumeSet?.(tile.participant.id, Number(e.target.value) / 100)}
                  className="w-full"
                />
                <div className="text-[10px] text-white/60 text-right mt-1 tabular-nums">{Math.round(volume * 100)}%</div>
              </div>
            )}
          </div>
        )}
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
  // Per-participant volume (0–1). Remote participants only; 'local' is always muted in <video>.
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const [openVolumeId, setOpenVolumeId] = useState<string | null>(null);

  const setVolume = (participantId: string, value: number) => {
    const next = Math.min(1, Math.max(0, parseFloat(value.toFixed(2))));
    setVolumes(prev => {
      const el = document.getElementById(`vcpa-${participantId}`) as HTMLAudioElement | null;
      if (el) el.volume = next;
      return { ...prev, [participantId]: next };
    });
  };

  const handleVolumeChange = (participantId: string, delta: number) => {
    setVolumes(prev => {
      const current = prev[participantId] ?? 1;
      const next = Math.min(1, Math.max(0, parseFloat((current + delta).toFixed(2))));
      // Apply directly to the DOM audio element
      const el = document.getElementById(`vcpa-${participantId}`) as HTMLAudioElement | null;
      if (el) el.volume = next;
      return { ...prev, [participantId]: next };
    });
  };

  const toggleVolumePopover = (participantId: string) => {
    setOpenVolumeId(prev => (prev === participantId ? null : participantId));
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-volume-popover]') || target.closest('[data-volume-toggle]')) return;
      setOpenVolumeId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const tiles = useMemo<Tile[]>(() => {
    const list: Tile[] = [];
    participants.forEach((p) => {
      if (p.streams.length === 0) {
        list.push({ tileId: tileKey(p.id, 0), participant: p, label: p.name, isScreen: false });
        return;
      }
      p.streams.forEach((s, i) => {
        const label = s.type === 'screen'
          ? `${p.name} Screen${s.screenIndex ? ` #${s.screenIndex}` : ''}`
          : p.name;
        list.push({ tileId: tileKey(p.id, i), participant: p, stream: s, label, isScreen: s.type === 'screen' });
      });
    });
    return list;
  }, [participants]);

  // Screen share or loudest speaker gets the main stage
  const activeSpeaker = useMemo(() => (
    tiles.find(t => t.isScreen) ||
    tiles.find(t => t.participant.audioLevel > 0.05 || t.participant.isSpeaking) ||
    tiles[0]
  ), [tiles]);

  const focusTile = tiles.find(t => t.tileId === focusedId) || tiles[0];
  const lastModeRef = useRef<VideoLayoutMode>('grid');

  useEffect(() => { if (mode !== 'focus') lastModeRef.current = mode; }, [mode]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mode === 'focus') onTileDoubleClick(focusedId ?? '');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mode, focusedId, onTileDoubleClick]);


  const renderDiscordGrid = () => {
    const cfg = getGridConfig(tiles.length);
    const count = tiles.length;
    const tileH = 'min(calc(100vh - 180px), 480px)';

    const mkTile = (t: Tile, wrapStyle?: React.CSSProperties) => (
      <div key={t.tileId} style={{ borderRadius: 12, overflow: 'hidden', flexShrink: 0, height: tileH, minHeight: 160, ...wrapStyle }}>
        <VideoTile
          tile={t}
          focused={t.tileId === focusedId}
          onDoubleClick={() => onTileDoubleClick(t.tileId)}
          variant="tile"
          avatarSize={cfg.avatarSize}
          volume={volumes[t.participant.id] ?? 1}
          onVolumeChange={handleVolumeChange}
          onVolumeSet={setVolume}
          volumeOpen={openVolumeId === t.participant.id}
          onToggleVolume={toggleVolumePopover}
        />
      </div>
    );

    const cb: React.CSSProperties = {
      background: '#1e1f22', padding: 16, display: 'flex',
      gap: 8, alignItems: 'center', justifyContent: 'center',
      alignContent: 'center', flexWrap: 'wrap',
    };

    if (count === 1) return (
      <div style={cb}>
        {mkTile(tiles[0], { width: 'min(100%, 860px)', flex: '0 0 auto' })}
      </div>
    );

    if (count === 2) return (
      <div style={{ ...cb, flexWrap: 'nowrap' }}>
        {tiles.map(t => mkTile(t, { flex: 1, minWidth: 0, height: 'min(calc(100vh - 180px), 360px)' }))}
      </div>
    );

    if (count === 3) return (
      <div style={{ ...cb, flexDirection: 'column', alignItems: 'stretch' }}>
        <div style={{ display: 'flex', gap: 8 }}>{mkTile(tiles[0], { flex: 1 })}</div>
        <div style={{ display: 'flex', gap: 8 }}>{tiles.slice(1).map(t => mkTile(t, { flex: 1 }))}</div>
      </div>
    );

    if (count === 5) return (
      <div style={{ ...cb, flexDirection: 'column', alignItems: 'stretch' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {tiles.slice(0, 3).map(t => mkTile(t, { flex: 1 }))}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {tiles.slice(3).map(t => mkTile(t, { flex: '0 0 calc(33.333% - 5.333px)' }))}
        </div>
      </div>
    );

    // 4, 6, 7-9, 10-16: uniform flex-wrap grid
    return (
      <div style={cb}>
        {tiles.map(t => mkTile(t, {
          flex: `0 0 calc(${100 / cfg.columns}% - ${(cfg.columns - 1) * 8 / cfg.columns}px)`,
          minWidth: 0,
        }))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-1 min-h-0 px-3 pb-3 overflow-hidden">

        {mode === 'speaker' && activeSpeaker ? (
          // Screen share / active speaker gets ~80% — right column is narrower
          <div className="flex h-full gap-2">
            <div className="flex-1 min-w-0 min-h-0">
              <VideoTile
                tile={activeSpeaker}
                focused={activeSpeaker.tileId === focusedId}
                onDoubleClick={() => onTileDoubleClick(activeSpeaker.tileId)}
                volume={volumes[activeSpeaker.participant.id] ?? 1}
                onVolumeChange={handleVolumeChange}
                onVolumeSet={setVolume}
                volumeOpen={openVolumeId === activeSpeaker.participant.id}
                onToggleVolume={toggleVolumePopover}
              />
            </div>
            {tiles.filter(t => t.tileId !== activeSpeaker.tileId).length > 0 && (
              <div className="flex flex-col gap-2 overflow-y-auto" style={{ width: 160, flexShrink: 0 }}>
                {tiles.filter(t => t.tileId !== activeSpeaker.tileId).map(t => (
                  <div key={t.tileId} style={{ height: 120, flexShrink: 0, borderRadius: 8, overflow: 'hidden' }}>
                    <VideoTile
                      tile={t}
                      variant="tile"
                      avatarSize={40}
                      focused={t.tileId === focusedId}
                      onDoubleClick={() => onTileDoubleClick(t.tileId)}
                      volume={volumes[t.participant.id] ?? 1}
                      onVolumeChange={handleVolumeChange}
                      onVolumeSet={setVolume}
                      volumeOpen={openVolumeId === t.participant.id}
                      onToggleVolume={toggleVolumePopover}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

        ) : mode === 'focus' && focusTile ? (
          <div className="relative h-full">
            <div className="absolute inset-0">
              <VideoTile
                tile={focusTile}
                focused
                onDoubleClick={() => onTileDoubleClick(focusTile.tileId)}
                volume={volumes[focusTile.participant.id] ?? 1}
                onVolumeChange={handleVolumeChange}
                onVolumeSet={setVolume}
                volumeOpen={openVolumeId === focusTile.participant.id}
                onToggleVolume={toggleVolumePopover}
              />
            </div>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none">
              <div className="text-xs text-white/50 bg-black/40 rounded px-2 py-0.5">Double-click pour revenir</div>
            </div>
            <div className="absolute bottom-3 right-3 flex gap-1.5">
              {tiles.filter(t => t.tileId !== focusTile.tileId).slice(0, 6).map(t => (
                <div key={t.tileId} style={{ width: 90, height: 60 }}>
                  <VideoTile
                    tile={t}
                    focused={false}
                    onDoubleClick={() => onTileDoubleClick(t.tileId)}
                    volume={volumes[t.participant.id] ?? 1}
                    onVolumeChange={handleVolumeChange}
                    onVolumeSet={setVolume}
                    volumeOpen={openVolumeId === t.participant.id}
                    onToggleVolume={toggleVolumePopover}
                  />
                </div>
              ))}
            </div>
          </div>

        ) : renderDiscordGrid()}
      </div>

      {/* Controls bar */}
      <div className="flex items-center justify-center gap-3 px-4 py-3 border-t border-white/10 bg-black/40 flex-shrink-0">
        <button onClick={onToggleMute}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${muted ? 'bg-red-500/30 text-red-400' : 'bg-white/10 text-gray-200 hover:bg-white/20'}`}>
          {muted ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        <button onClick={onToggleSpeaker}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${speakerOff ? 'bg-red-500/30 text-red-400' : 'bg-white/10 text-gray-200 hover:bg-white/20'}`}>
          {speakerOff ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <button onClick={onToggleCamera}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${cameraOn ? 'bg-blue-500/30 text-blue-300' : 'bg-white/10 text-gray-200 hover:bg-white/20'}`}>
          {cameraOn ? <VideoOff size={18} /> : <Video size={18} />}
        </button>
        <button onClick={onToggleScreen}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${screenOn ? 'bg-emerald-500/30 text-emerald-300' : 'bg-white/10 text-gray-200 hover:bg-white/20'}`}>
          {screenOn ? <MonitorOff size={18} /> : <Monitor size={18} />}
        </button>
        <button onClick={onEndCall}
          className="w-12 h-12 rounded-full flex items-center justify-center bg-red-500 hover:bg-red-600 text-white transition-colors">
          <PhoneOff size={18} />
        </button>
      </div>
    </div>
  );
};

export default VideoLayout;







