import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, MessageSquare, X, Send, Paperclip, Smile, AtSign,
  Phone, Mic, MicOff, Users, Plus, Check, Volume2, VolumeX, PhoneOff,
  Monitor, MonitorOff, Video, VideoOff,
} from 'lucide-react';
import EmojiPicker, { type EmojiClickData, Theme } from 'emoji-picker-react';
import { Avatar } from '@/components/ui';
import { MessageBubble, GifPicker } from '@/components/shared';
import VideoLayout, { type Participant } from '@/components/shared/VideoLayout';
import VoiceCallOverlay from '@/components/shared/VoiceCallOverlay';
import apiClient from '@/services/apiClient';
import { signalRService, useSignalRVersion } from '@/services/signalRService';
import { useAuth } from '@/hooks';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { cn, getUserRoles } from '@/utils';
import type { User, Message } from '@/types';

const API_BASE = (import.meta.env.VITE_API_URL as string || '/api').replace(/\/api$/, '');
const CALL_STORAGE_KEY = 'teamtalk.activeCall';

const STATUS_DOT: Record<string, string> = {
  online: 'bg-emerald-500', away: 'bg-amber-500',
  donotdisturb: 'bg-red-500', offline: 'bg-gray-300 dark:bg-gray-600',
};
const STATUS_LABEL: Record<string, string> = {
  online: 'Online', away: 'Away', donotdisturb: 'Do Not Disturb', offline: 'Offline',
};

interface GroupDm { channelId: string; name: string; participants: User[]; }
interface CallNotif { id: string; text: string; ts: string; }

// ── Notification bulle système ────────────────────────────
const CallNotifBubble: React.FC<{ notif: CallNotif }> = ({ notif }) => (
  <div className="flex justify-center py-2">
    <div className="flex items-center gap-2 px-4 py-1.5 bg-surface-100 dark:bg-surface-800 rounded-full text-xs text-gray-500 dark:text-gray-400 border border-subtle">
      <span>{notif.text}</span>
      <span className="text-gray-400 dark:text-gray-600">
        {new Date(notif.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  </div>
);

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// ── Panneau vocal de groupe ───────────────────────────────
interface GroupVoicePanelProps {
  channelId: string;
  meId: string;
  usersMap: Record<string, User>;
  onNotif: (text: string) => void;
  autoJoin?: boolean;
}

const GroupVoicePanel: React.FC<GroupVoicePanelProps> = ({ channelId, meId, usersMap, onNotif, autoJoin }) => {
  const [joined, setJoined]         = useState(false);
  const [participants, setParticipants] = useState<string[]>([]);
  const [muted, setMuted]           = useState(false);
  const [speakerOff, setSpeakerOff] = useState(false);
  const [videoOn, setVideoOn]       = useState(false);
  const [screenOn, setScreenOn]     = useState(false);
  const [layoutMode, setLayoutMode] = useState<'grid' | 'speaker' | 'screen' | 'focus'>('grid');
  const [focusedId, setFocusedId]   = useState<string | null>(null);
  const lastModeRef = useRef<'grid' | 'speaker' | 'screen'>('grid');
  // Array-based remote video tracking — supports multiple streams per peer (webcam + screen)
  const [remoteVideos, setRemoteVideos] = useState<Array<{
    peerId: string; trackId: string; stream: MediaStream; isScreen: boolean;
  }>>([]);
  const [localCamStream, setLocalCamStream] = useState<MediaStream | null>(null);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);

  const localStreamRef   = useRef<MediaStream | null>(null); // mic audio
  const localCamRef      = useRef<MediaStream | null>(null); // webcam video
  const screenStreamRef  = useRef<MediaStream | null>(null); // screen share
  const joinedRef        = useRef(false);
  const meIdRef          = useRef(meId);
  meIdRef.current        = meId;
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const signalRVersion   = useSignalRVersion();

  const closePc = useCallback((peerId: string) => {
    const pc = peerConnectionsRef.current.get(peerId);
    if (!pc) return;
    pc.ontrack = null; pc.onicecandidate = null; pc.onnegotiationneeded = null;
    pc.close();
    peerConnectionsRef.current.delete(peerId);
    const audio = document.getElementById(`gva-${peerId}`) as HTMLAudioElement | null;
    if (audio) { audio.srcObject = null; audio.remove(); }
    setRemoteVideos(prev => prev.filter(v => v.peerId !== peerId));
  }, []);

  const addTracks = useCallback((pc: RTCPeerConnection) => {
    const addIfMissing = (track: MediaStreamTrack, stream: MediaStream) => {
      if (!pc.getSenders().some(s => s.track === track)) pc.addTrack(track, stream);
    };
    // Audio tracks in their own stream
    localStreamRef.current?.getTracks().forEach(t => addIfMissing(t, localStreamRef.current!));
    // Webcam goes into the AUDIO stream — receiver detects audio present = webcam (not screen)
    localCamRef.current?.getVideoTracks().forEach(t => addIfMissing(t, localStreamRef.current!));
    // Screen goes in its own stream — receiver detects no audio = screen share
    screenStreamRef.current?.getTracks().forEach(t => addIfMissing(t, screenStreamRef.current!));
  }, []);

  const createPc = useCallback((peerId: string): RTCPeerConnection => {
    const existing = peerConnectionsRef.current.get(peerId);
    if (existing && existing.signalingState !== 'closed') return existing;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = e => {
      if (e.candidate)
        signalRService.sendGroupVoiceIce(channelId, peerId, JSON.stringify(e.candidate)).catch(() => {});
    };

    pc.ontrack = e => {
      if (e.track.kind === 'audio') {
        const stream = e.streams[0] ?? new MediaStream([e.track]);
        let audio = document.getElementById(`gva-${peerId}`) as HTMLAudioElement | null;
        if (!audio) {
          audio = document.createElement('audio');
          audio.id = `gva-${peerId}`; audio.autoplay = true;
          document.body.appendChild(audio);
        }
        audio.srcObject = stream;
      } else if (e.track.kind === 'video') {
        const stream = e.streams[0] ?? new MediaStream([e.track]);
        // If the stream has audio tracks → webcam (added to audio stream). No audio → screen share.
        const isScreen = (e.streams[0]?.getAudioTracks().length ?? 0) === 0;
        const trackId = e.track.id;
        setRemoteVideos(prev => {
          if (prev.find(v => v.trackId === trackId)) return prev;
          return [...prev, { peerId, trackId, stream, isScreen }];
        });
        e.track.onended = () => setRemoteVideos(prev => prev.filter(v => v.trackId !== trackId));
      }
    };

    // KEY FIX: without this, adding a track (screen share / webcam) to an existing PC
    // never triggers a new offer → remote peer never receives the video track
    pc.onnegotiationneeded = async () => {
      if (!joinedRef.current) return;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await signalRService.sendGroupVoiceOffer(channelId, peerId, JSON.stringify(offer));
      } catch { /* ignore */ }
    };

    peerConnectionsRef.current.set(peerId, pc);
    return pc;
  }, [channelId]);

  const join = useCallback(async () => {
    // Leave all other active calls before joining
    window.dispatchEvent(new CustomEvent('Team Talk:leave-all-calls', { detail: { except: 'group-voice' } }));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      joinedRef.current = true;
      const w = window as unknown as { __TeamTalkVoiceChannels?: Set<string> };
      w.__TeamTalkVoiceChannels = w.__TeamTalkVoiceChannels ?? new Set();
      w.__TeamTalkVoiceChannels.add(channelId);
      await signalRService.joinVoiceChannel(channelId);
      setJoined(true);
      onNotif('🔊 Vous avez rejoint l\'appel vocal');
      try {
        localStorage.setItem(CALL_STORAGE_KEY, JSON.stringify({ kind: 'group', channelId, ts: Date.now() }));
      } catch { /* ignore */ }
    } catch { /* mic denied */ }
  }, [channelId, onNotif]);

  const leave = useCallback(async () => {
    peerConnectionsRef.current.forEach((_, pid) => closePc(pid));
    localStreamRef.current?.getTracks().forEach(t => t.stop()); localStreamRef.current = null;
    localCamRef.current?.getTracks().forEach(t => t.stop()); localCamRef.current = null;
    screenStreamRef.current?.getTracks().forEach(t => t.stop()); screenStreamRef.current = null;
    joinedRef.current = false;
    setVideoOn(false); setScreenOn(false); setRemoteVideos([]); setLocalCamStream(null); setLocalScreenStream(null);
    const w = window as unknown as { __TeamTalkVoiceChannels?: Set<string> };
    w.__TeamTalkVoiceChannels?.delete(channelId);
    await signalRService.leaveVoiceChannel(channelId);
    setJoined(false); setParticipants([]);
    onNotif('👋 Vous avez quitté l\'appel vocal');
    try {
      const raw = localStorage.getItem(CALL_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as { kind?: string; channelId?: string };
        if (data.kind === 'group' && data.channelId === channelId) localStorage.removeItem(CALL_STORAGE_KEY);
      }
    } catch { /* ignore */ }
  }, [channelId, onNotif, closePc]);

  const toggleMic = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = muted; });
    setMuted(m => !m);
  }, [muted]);

  const applySpeakerMute = useCallback((nextMuted: boolean) => {
    document.querySelectorAll<HTMLAudioElement>('audio[id^="gva-"]').forEach((el) => {
      el.muted = nextMuted;
      if (!nextMuted) el.play().catch(() => {});
    });
  }, []);

  const toggleSpeaker = useCallback(() => {
    setSpeakerOff(prev => {
      const next = !prev;
      applySpeakerMute(next);
      return next;
    });
  }, [applySpeakerMute]);

  const toggleVideo = useCallback(async () => {
    if (!videoOn) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true });
        const track = s.getVideoTracks()[0];
        localCamRef.current = s;
        setLocalCamStream(s);
        // Add webcam to AUDIO stream so receivers detect audio present = webcam (not screen)
        peerConnectionsRef.current.forEach(pc => {
          if (localStreamRef.current && !pc.getSenders().some(sender => sender.track === track))
            pc.addTrack(track, localStreamRef.current);
        });
        setVideoOn(true);
        track.onended = () => { localCamRef.current = null; setLocalCamStream(null); setVideoOn(false); };
      } catch { /* denied */ }
    } else {
      localCamRef.current?.getTracks().forEach(t => {
        t.stop();
        peerConnectionsRef.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track === t);
          if (sender) pc.removeTrack(sender);
        });
      });
      localCamRef.current = null; setLocalCamStream(null); setVideoOn(false);
    }
  }, [videoOn]);

  const toggleScreen = useCallback(async () => {
    if (!screenOn) {
      try {
        const ss = await (navigator.mediaDevices as unknown as { getDisplayMedia(c: object): Promise<MediaStream> })
          .getDisplayMedia({ video: { cursor: 'always' } as object, audio: false });
        screenStreamRef.current = ss;
        const track = ss.getVideoTracks()[0];
        const stopScreen = () => {
          screenStreamRef.current = null; setScreenOn(false); setLocalScreenStream(null);
          peerConnectionsRef.current.forEach(pc => {
            const sender = pc.getSenders().find(s => s.track === track);
            if (sender) pc.removeTrack(sender);
          });
        };
        track.onended = stopScreen;
        peerConnectionsRef.current.forEach(pc => pc.addTrack(track, ss));
        setLocalScreenStream(ss);
        setScreenOn(true);
      } catch { /* denied */ }
    } else {
      screenStreamRef.current?.getTracks().forEach(t => {
        t.stop();
        peerConnectionsRef.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track === t);
          if (sender) pc.removeTrack(sender);
        });
      });
      screenStreamRef.current = null; setLocalScreenStream(null); setScreenOn(false);
    }
  }, [screenOn]);

  // SignalR + WebRTC handlers
  useEffect(() => {
    const onJoined = (data: { channelId: string; userId: string }) => {
      if (data.channelId !== channelId) return;
      setParticipants(p => p.includes(data.userId) ? p : [...p, data.userId]);
    };
    const onLeft = (data: { channelId: string; userId: string }) => {
      if (data.channelId !== channelId) return;
      setParticipants(p => p.filter(id => id !== data.userId));
      closePc(data.userId);
    };
    const onParticipants = async (data: { channelId: string; userIds: string[] }) => {
      if (data.channelId !== channelId || !joinedRef.current) return;
      setParticipants(data.userIds);
      for (const peerId of data.userIds.filter(id => id !== meIdRef.current)) {
        try {
          const pc = createPc(peerId);
          addTracks(pc);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await signalRService.sendGroupVoiceOffer(channelId, peerId, JSON.stringify(offer));
        } catch { /* ignore */ }
      }
    };
    const onOffer = async (data: { channelId: string; senderId: string; offer: string }) => {
      if (data.channelId !== channelId || !joinedRef.current) return;
      try {
        const pc = createPc(data.senderId);
        addTracks(pc);
        await pc.setRemoteDescription(JSON.parse(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await signalRService.sendGroupVoiceAnswer(channelId, data.senderId, JSON.stringify(answer));
      } catch { /* ignore */ }
    };
    const onAnswer = async (data: { channelId: string; senderId: string; answer: string }) => {
      if (data.channelId !== channelId) return;
      try {
        const pc = peerConnectionsRef.current.get(data.senderId);
        if (pc && pc.signalingState !== 'stable') await pc.setRemoteDescription(JSON.parse(data.answer));
      } catch { /* ignore */ }
    };
    const onIce = async (data: { channelId: string; senderId: string; candidate: string }) => {
      if (data.channelId !== channelId) return;
      try {
        const pc = peerConnectionsRef.current.get(data.senderId);
        if (pc) await pc.addIceCandidate(JSON.parse(data.candidate));
      } catch { /* ignore */ }
    };
    signalRService.onUserJoinedVoice(onJoined);
    signalRService.onUserLeftVoice(onLeft);
    signalRService.onVoiceParticipants(onParticipants);
    signalRService.onGroupVoiceOffer(onOffer);
    signalRService.onGroupVoiceAnswer(onAnswer);
    signalRService.onGroupVoiceIce(onIce);
    return () => {
      signalRService.offEvent('UserJoinedVoice', onJoined as never);
      signalRService.offEvent('UserLeftVoice', onLeft as never);
      signalRService.offEvent('VoiceParticipants', onParticipants as never);
      signalRService.offEvent('GroupVoiceOffer', onOffer as never);
      signalRService.offEvent('GroupVoiceAnswer', onAnswer as never);
      signalRService.offEvent('GroupVoiceIce', onIce as never);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, signalRVersion, createPc, addTracks, closePc]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      peerConnectionsRef.current.forEach((_, pid) => closePc(pid));
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      localCamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      if (joinedRef.current) {
        const w = window as unknown as { __TeamTalkVoiceChannels?: Set<string> };
        w.__TeamTalkVoiceChannels?.delete(channelId);
        signalRService.leaveVoiceChannel(channelId).catch(() => {});
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, closePc]);

  // Auto-leave when another call starts (global event)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.except === 'group-voice') return;
      if (joinedRef.current) leave();
    };
    window.addEventListener('Team Talk:leave-all-calls', handler);
    return () => window.removeEventListener('Team Talk:leave-all-calls', handler);
  }, [leave]);

  // Auto-join
  useEffect(() => {
    if (autoJoin && !joinedRef.current) join();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoJoin]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setRemoteVideos(prev =>
        prev.filter(v => v.stream.getTracks().some(t => t.readyState === 'live'))
      );
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    applySpeakerMute(speakerOff);
  }, [speakerOff, applySpeakerMute]);

  const layoutParticipants = useMemo<Participant[]>(() => {
    const map = new Map<string, Participant>();
    const ensure = (id: string, name: string, avatarUrl?: string, isMuted = false) => {
      if (!map.has(id)) {
        map.set(id, { id, name, avatarUrl, audioLevel: 0, isMuted, isLive: false, isSpeaking: false, streams: [] });
      } else if (isMuted) {
        const p = map.get(id)!;
        p.isMuted = isMuted;
      }
      return map.get(id)!;
    };

    const allIds = new Set(participants);
    if (meId) allIds.add(meId);
    allIds.forEach((id) => {
      if (id === meId) return;
      const user = usersMap[id];
      ensure(id, user?.name ?? id, user?.avatarUrl);
    });

    remoteVideos.forEach(v => {
      const user = usersMap[v.peerId];
      const name = user?.name ?? v.peerId;
      const p = ensure(v.peerId, name, user?.avatarUrl);
      p.streams.push({ type: v.isScreen ? 'screen' : 'camera', stream: v.stream, screenIndex: v.isScreen ? 1 : undefined });
      if (v.isScreen) p.isLive = true;
    });

    const meUser = usersMap[meId];
    const meName = meUser?.name ?? 'Vous';
    const me = ensure('local', meName, meUser?.avatarUrl, muted);
    if (videoOn && localCamStream) me.streams.push({ type: 'camera', stream: localCamStream });
    if (screenOn && localScreenStream) {
      me.streams.push({ type: 'screen', stream: localScreenStream, screenIndex: 1 });
      me.isLive = true;
    }
    return Array.from(map.values());
  }, [remoteVideos, usersMap, meId, muted, videoOn, localCamStream, screenOn, localScreenStream]);

  const hasVideo = layoutParticipants.length > 0;
  const hasScreenShare = layoutParticipants.some(p => p.streams.some(s => s.type === 'screen'));
  const tileIds = useMemo(() => {
    const ids: string[] = [];
    layoutParticipants.forEach((p) => {
      if (p.streams.length === 0) {
        ids.push(`${p.id}:0`);
        return;
      }
      p.streams.forEach((_, i) => ids.push(`${p.id}:${i}`));
    });
    return ids;
  }, [layoutParticipants]);

  useEffect(() => {
    if (layoutMode === 'screen' && !hasScreenShare) setLayoutMode('grid');
  }, [layoutMode, hasScreenShare]);

  useEffect(() => {
    if (!focusedId) return;
    if (!tileIds.includes(focusedId)) {
      setLayoutMode(lastModeRef.current);
      setFocusedId(null);
    }
  }, [focusedId, tileIds]);
  const handleTileDoubleClick = (tileId: string) => {
    if (layoutMode === 'focus' && focusedId === tileId) {
      setLayoutMode(lastModeRef.current);
      setFocusedId(null);
      return;
    }
    if (layoutMode !== 'focus') lastModeRef.current = layoutMode;
    setLayoutMode('focus');
    setFocusedId(tileId);
  };

  return (
    <div className={cn('overflow-hidden flex flex-col h-full', hasVideo ? 'bg-[#1a1a1a]' : 'bg-emerald-50/50 dark:bg-emerald-500/5')}>

      {/* ── Header ── */}
      <div className={cn('flex items-center gap-2 px-4 py-1.5', hasVideo ? 'bg-black/40' : '')}>
        <Volume2 size={13} className="text-emerald-500 flex-shrink-0" />
        <span className={cn('text-[11px] font-bold uppercase tracking-wide', hasVideo ? 'text-emerald-400' : 'text-emerald-700 dark:text-emerald-400')}>
          Appel vocal de groupe
        </span>
        {participants.length > 0 && (
          <span className="text-[11px] text-gray-500 ml-1">· {participants.length} participant{participants.length > 1 ? 's' : ''}</span>
        )}
        {hasScreenShare && <span className="ml-auto flex items-center gap-1 text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded font-bold"><Monitor size={9}/> LIVE</span>}
      </div>
      <div className="flex-1 min-h-0">
        {joined ? (
          <VideoLayout
            participants={layoutParticipants}
            mode={layoutMode}
            focusedId={focusedId}
            onTileDoubleClick={handleTileDoubleClick}
            onToggleMute={toggleMic}
            onToggleSpeaker={toggleSpeaker}
            onToggleCamera={toggleVideo}
            onToggleScreen={toggleScreen}
            onEndCall={leave}
            muted={muted}
            speakerOff={speakerOff}
            cameraOn={videoOn}
            screenOn={screenOn}
          />
        ) : (
          <div className="px-4 pb-3">
            <button onClick={join} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold transition-colors">
              <Volume2 size={14} /> Rejoindre l'appel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ── DMConversation (1-to-1) ──────────────────────────────
interface DmConversationProps {
  peer: User; me: User; allUsers: User[];
  onClose: () => void;
  onCallStart: (peer: User) => void;
  callNotifs: CallNotif[];
}

const DMConversation: React.FC<DmConversationProps> = ({
  peer, me, allUsers, onClose, onCallStart, callNotifs,
}) => {
  const signalRVersion = useSignalRVersion();
  const [channelId, setChannelId] = useState<string | null>(null);
  const [messages, setMessages]   = useState<Message[]>([]);
  const [text, setText]           = useState('');
  const [loading, setLoading]     = useState(true);
  const [sending, setSending]     = useState(false);
  const messagesEndRef             = useRef<HTMLDivElement>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const emojiRef                   = useRef<HTMLDivElement>(null);
  const gifRef                    = useRef<HTMLDivElement>(null);
  const [showGif, setShowGif]     = useState(false);
  const [showVoicePanel, setShowVoicePanel] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState<User[]>([]);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const inputRef                   = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<{ url: string; name: string; type: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef               = useRef<HTMLInputElement>(null);
  const channelIdRef               = useRef<string | null>(null);

  const handleAudioReady = useCallback(async (blob: Blob) => {
    const cid = channelIdRef.current;
    if (!cid) return;
    setSending(true);
    try {
      const form = new FormData();
      form.append('file', blob, `voice-${Date.now()}.webm`);
      const { data } = await apiClient.post<{ url: string; fileName: string; contentType: string }>(
        '/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      const audioUrl = `${API_BASE}${data.url}`;
      const { data: msg } = await apiClient.post<Message>(`/channels/${cid}/messages`, {
        content: `[🎤 Voice Message](${audioUrl})`
      });
      setMessages(prev => [...prev, msg]);
    } catch { /* ignore */ } finally { setSending(false); }
  }, []);

  const { recording, duration, start: startRecording, stop: stopRecording } =
    useVoiceRecorder(handleAudioReady);

  useEffect(() => {
    setLoading(true); setMessages([]); setChannelId(null); channelIdRef.current = null;
    apiClient.get<{ channelId: string }>(`/dm/${peer.id}`)
      .then(({ data }) => {
        setChannelId(data.channelId);
        channelIdRef.current = data.channelId;
        return apiClient.get<{ data: Message[]; hasMore: boolean }>(
          `/channels/${data.channelId}/messages`, { params: { page: 1, pageSize: 50 } }
        );
      })
      .then(({ data }) => setMessages(data.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [peer.id]);

  useEffect(() => {
    if (!channelId) return;
    const handler = (message: Message) => {
      if (message.channelId !== channelId) return;
      setMessages(prev => prev.some(m => m.id === message.id) ? prev : [...prev, message]);
    };
    signalRService.onDmReceived(handler);
    return () => { signalRService.offEvent('DmReceived', handler as never); };
  }, [channelId, signalRVersion]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, callNotifs]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setShowEmoji(false); if (gifRef.current && !gifRef.current.contains(e.target as Node)) setShowGif(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value; setText(val);
    const cursor = e.target.selectionStart ?? val.length;
    const before = val.slice(0, cursor);
    const match = before.match(/@([\w ]*)$/);
    if (match) {
      const query = match[1].toLowerCase();
      setMentionStart(cursor - match[0].length);
      setMentionSuggestions(
        allUsers.filter(u => u.id !== me.id && u.name.toLowerCase().includes(query)).slice(0, 5)
      );
    } else { setMentionSuggestions([]); setMentionStart(null); }
  }, [allUsers, me.id]);

  const insertMention = (u: User) => {
    if (mentionStart === null) return;
    const cursor = inputRef.current?.selectionStart ?? text.length;
    setText(`${text.slice(0, mentionStart)}@${u.name} ${text.slice(cursor)}`);
    setMentionSuggestions([]); setMentionStart(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const form = new FormData(); form.append('file', file);
      const { data } = await apiClient.post<{ url: string; fileName: string; contentType: string }>(
        '/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setAttachments(prev => [...prev, { url: data.url, name: data.fileName, type: data.contentType }]);
    } catch { /* ignore */ } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onGifSelect = (url: string) => {
    setText((prev) => (prev.trim() ? prev + `
![gif](${url})` : `![gif](${url})`));
    setShowGif(false);
    inputRef.current?.focus();
  };

  const handleSend = useCallback(async () => {
    if (!text.trim() || sending || !channelId) return;
    const content = text.trim();
    setText(''); setSending(true);
    try {
      const { data } = await apiClient.post<Message>(`/channels/${channelId}/messages`, { content });
      setMessages(prev => [...prev, data]);
    } catch { setText(content); } finally { setSending(false); }
  }, [text, sending, channelId]);

  const renderMessage = (msg: Message) => {
    const voiceMatch = msg.content.match(/\[🎤 Voice Message\]\(([^)]+)\)/);
    if (voiceMatch) {
      return (
        <div key={msg.id} className={`flex gap-2 px-4 py-1 ${msg.userId === me.id ? 'flex-row-reverse' : ''}`}>
          <Avatar user={msg.userId === me.id ? me : peer} size="sm" showStatus={false} />
          <div className={`bg-surface-100 dark:bg-surface-800 rounded-2xl px-3 py-2 max-w-xs ${msg.userId === me.id ? 'bg-brand-500/10' : ''}`}>
            <audio controls src={voiceMatch[1]} className="h-8 w-48" style={{ minWidth: 160 }} />
            <div className="text-[10px] text-gray-400 mt-1">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      );
    }
    return (
      <MessageBubble
        key={msg.id}
        message={msg}
        user={msg.userId === me.id ? me : peer}
        isOwn={msg.userId === me.id}
        currentUserId={me.id}
      />
    );
  };

  // Mélange messages + notifications d'appel triés par timestamp
  type Item = { kind: 'msg'; msg: Message } | { kind: 'notif'; notif: CallNotif };
  const items: Item[] = [
    ...messages.map(m => ({ kind: 'msg' as const, msg: m })),
    ...callNotifs.map(n => ({ kind: 'notif' as const, notif: n })),
  ].sort((a, b) => {
    const ta = a.kind === 'msg' ? a.msg.timestamp : a.notif.ts;
    const tb = b.kind === 'msg' ? b.msg.timestamp : b.notif.ts;
    return new Date(ta).getTime() - new Date(tb).getTime();
  });

  return (
    <motion.div key={peer.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.2 }}
      className="flex-1 flex flex-col h-full min-w-0">

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
        <button onClick={() => onCallStart(peer)} title="Appel vocal"
          className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-gray-400 hover:text-emerald-500 transition-colors">
          <Phone size={16} />
        </button>
        <button onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-gray-400 transition-colors">
          <X size={15} />
        </button>
      </div>

      {/* Messages + notifs */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 p-8">
            <Avatar user={peer} size="xl" showStatus={false} />
            <div className="text-center">
              <h3 className="font-bold text-gray-900 dark:text-gray-100 font-display mb-1">
                Commencez une conversation avec {peer.name}
              </h3>
              <p className="text-sm text-gray-500">{peer.title ?? peer.email}</p>
            </div>
          </div>
        ) : (
          <div className="py-2">
            {items.map(item =>
              item.kind === 'notif'
                ? <CallNotifBubble key={item.notif.id} notif={item.notif} />
                : renderMessage(item.msg)
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-subtle bg-white dark:bg-surface-900 flex-shrink-0">
        <div className="relative flex items-end gap-2 bg-surface-100 dark:bg-surface-800 rounded-xl px-3.5 py-2.5 border border-subtle focus-within:border-brand-500/40 transition-colors">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/mp4,application/pdf,audio/*"
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || recording}
            className="p-1 text-gray-400 hover:text-brand-500 transition-colors flex-shrink-0 mb-0.5"
          >
            <Paperclip size={17} className={uploading ? 'animate-pulse text-brand-500' : ''} />
          </button>
          <button
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            disabled={uploading || sending}
            className={cn(
              'p-1 flex-shrink-0 mb-0.5 transition-colors rounded',
              recording ? 'text-red-500 bg-red-50 dark:bg-red-500/10' : 'text-gray-400 hover:text-brand-500'
            )}
            title={recording ? `Enregistrement… ${duration}s` : 'Maintenir pour envoyer un vocal'}
          >
            {recording ? <MicOff size={17} /> : <Mic size={17} />}
          </button>
          <input
            ref={inputRef}
            value={text}
            onChange={handleInputChange}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={recording ? `Enregistrement… ${duration}s — relâchez pour envoyer` : `Message ${peer.name}…`}
            disabled={recording}
            className="flex-1 bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 font-body"
          />
          <div className="flex items-center gap-1 flex-shrink-0 mb-0.5">
            <div ref={emojiRef} className="relative">
              <button onClick={() => setShowEmoji(v => !v)}
                className={cn('p-1 transition-colors', showEmoji ? 'text-brand-500' : 'text-gray-400 hover:text-brand-500')}>
                <Smile size={17} />
              </button>
              {showEmoji && (
                <div className="absolute bottom-10 right-0 z-50 shadow-2xl rounded-2xl overflow-hidden">
                  <EmojiPicker
                    onEmojiClick={(data: EmojiClickData) => { setText(p => p + data.emoji); setShowEmoji(false); inputRef.current?.focus(); }}
                    theme={document.documentElement.classList.contains('dark') ? Theme.DARK : Theme.LIGHT}
                    width={280} height={340}
                  />
                </div>
              )}
            </div>
            <div ref={gifRef} className="relative">
              <button onClick={() => setShowGif(v => !v)}
                className={cn('px-2 h-8 rounded-lg text-xs font-bold transition-colors border', showGif ? 'bg-brand-500 text-white border-brand-500' : 'bg-surface-200 dark:bg-surface-800 text-gray-500 hover:text-brand-500')}>
                GIF
              </button>
              {showGif && (
                <div className="absolute bottom-10 right-0 z-50">
                  <GifPicker onSelect={onGifSelect} onClose={() => setShowGif(false)} />
                </div>
              )}
            </div>
            <button
              onClick={handleSend}
              disabled={!text.trim() || sending || recording}
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center transition-all flex-shrink-0',
                text.trim() && !sending && !recording
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

// ── Create Group Modal ───────────────────────────────────
interface CreateGroupModalProps {
  users: User[]; me: User;
  onClose: () => void;
  onCreate: (group: GroupDm) => void;
}

// -- GroupConversation (group chat) --------------------------
interface GroupConversationProps {
  group: GroupDm;
  me: User;
  allUsers: User[];
  onClose: () => void;
  autoJoinVoice?: boolean;
}

const GroupConversation: React.FC<GroupConversationProps> = ({ group, me, allUsers, onClose, autoJoinVoice }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);
  const [text, setText]         = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif]     = useState(false);
  const [showVoicePanel] = useState(true);
  const [voiceHeight, setVoiceHeight] = useState(360);
  const voiceDragging = useRef(false);
  const voiceAnchor = useRef({ startY: 0, startH: 0 });
  const emojiRef = useRef<HTMLDivElement>(null);
  const gifRef   = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const usersMap = useMemo(() => {
    const obj: Record<string, User> = {};
    [...allUsers, me].forEach(u => { if (u) obj[u.id] = u; });
    return obj;
  }, [allUsers, me]);

  useEffect(() => {
    setLoading(true);
    apiClient.get(`/channels/${group.channelId}/messages`, { params: { page: 1, pageSize: 50 } })
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : Array.isArray((data as any)?.data) ? (data as any).data : [];
        setMessages(list as Message[]);
      })
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [group.channelId]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setShowEmoji(false);
      if (gifRef.current && !gifRef.current.contains(e.target as Node)) setShowGif(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const startVoiceResize = useCallback((e: React.MouseEvent) => {
    voiceDragging.current = true;
    voiceAnchor.current = { startY: e.clientY, startH: voiceHeight };
    e.preventDefault();
  }, [voiceHeight]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!voiceDragging.current) return;
      const delta = e.clientY - voiceAnchor.current.startY;
      setVoiceHeight(h => Math.max(120, Math.min(900, voiceAnchor.current.startH + delta)));
    };
    const onUp = () => { voiceDragging.current = false; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, []);

    const onGifSelect = (url: string) => {
    setText((prev) => (prev.trim() ? prev + `
![gif](${url})` : `![gif](${url})`));
    setShowGif(false);
    inputRef.current?.focus();
  };

  // Voice message upload
  const uploadVoice = async (blob: Blob) => {
    if (sending) return;
    setSending(true);
    try {
      const form = new FormData();
      form.append("file", blob, `voice-${Date.now()}.webm`);
      const { data } = await apiClient.post<{ url: string; fileName: string }>(
        "/upload",
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      const audioUrl = `${API_BASE}${data.url}`;
      const { data: msg } = await apiClient.post<Message>(`/channels/${group.channelId}/messages`, {
        content: `[🎤 Voice Message](${audioUrl})`,
      });
      setMessages(prev => [...prev, msg]);
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  const { recording, duration, start: startRecording, stop: stopRecording } = useVoiceRecorder(uploadVoice);

  const handleSend = useCallback(async () => {
    if (!text.trim() || sending) return;
    const content = text.trim();
    setText(''); setSending(true);
    try {
      const { data } = await apiClient.post<Message>(`/channels/${group.channelId}/messages`, { content });
      setMessages(prev => [...prev, data]);
    } catch { setText(content); } finally { setSending(false); }
  }, [text, sending, group.channelId]);

  const renderMessage = (msg: Message) => {
    const sender = allUsers.find(u => u.id === msg.userId) ?? me;
    const voiceMatch = msg.content.match(/\[🎤 Voice Message\]\(([^)]+)\)/);
    if (voiceMatch) {
      return (
        <div key={msg.id} className={`flex gap-2 px-4 py-1 ${msg.userId === me.id ? 'flex-row-reverse' : ''}`}>
          <Avatar user={sender} size="sm" showStatus={false} />
          <div className={`bg-surface-100 dark:bg-surface-800 rounded-2xl px-3 py-2 max-w-xs ${msg.userId === me.id ? 'bg-brand-500/10' : ''}`}>
            <audio controls src={voiceMatch[1]} className="h-8 w-48" style={{ minWidth: 160 }} />
            <div className="text-[10px] text-gray-400 mt-1">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      );
    }
    return (
      <MessageBubble
        key={msg.id}
        message={msg}
        user={sender}
        isOwn={msg.userId === me.id}
        currentUserId={me.id}
      />
    );
  };

  return (
    <motion.div key={group.channelId} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.2 }}
      className="flex-1 flex flex-col h-full min-w-0">
      <div className="flex items-center justify-between border-b border-subtle px-4 py-3 bg-white dark:bg-surface-900">
        <div>
          <p className="text-[11px] text-gray-400 uppercase font-bold tracking-wide">Groupe</p>
          <h3 className="text-lg font-black text-gray-900 dark:text-gray-100 font-display">{group.name}</h3>
          <p className="text-xs text-gray-500">{group.participants.length} membres</p>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-gray-400">
          <X size={16} />
        </button>
      </div>

      {showVoicePanel && (
        <>
          <div style={{ height: voiceHeight, flexShrink: 0, overflow: 'hidden' }} className="px-4 pt-3">
            <GroupVoicePanel
              channelId={group.channelId}
              meId={me.id}
              usersMap={usersMap as Record<string, User>}
              onNotif={() => {}}
              autoJoin={autoJoinVoice}
            />
          </div>
          <div
            onMouseDown={startVoiceResize}
            style={{ height: 8, flexShrink: 0, cursor: 'row-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
            className="hover:bg-brand-500/20 transition-colors group"
          >
            <div style={{ width: 48, height: 3, borderRadius: 99, background: 'rgba(255,255,255,0.18)' }} className="group-hover:bg-brand-500 transition-colors" />
          </div>
        </>
      )}

      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-3 bg-surface-50 dark:bg-surface-900/40">
        {loading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-10 bg-surface-100 dark:bg-surface-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {messages.map(renderMessage)}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

            <div className="p-4 border-t border-subtle bg-white dark:bg-surface-900 flex-shrink-0">
        <div className="flex items-end gap-2 bg-surface-100 dark:bg-surface-800 rounded-xl px-3.5 py-2.5 border border-subtle focus-within:border-brand-500/40 transition-colors">
          <button
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            disabled={sending}
            className={cn('p-1 flex-shrink-0 mb-0.5 transition-colors rounded', recording ? 'text-red-500 bg-red-50 dark:bg-red-500/10' : 'text-gray-400 hover:text-brand-500')}
            title={recording ? `Enregistrement… ${duration}s` : 'Maintenir pour envoyer un vocal'}
          >
            {recording ? <MicOff size={17} /> : <Mic size={17} />}
          </button>

          <input ref={inputRef} value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={recording ? `Enregistrement… ${duration}s — relâchez pour envoyer` : `Message ${group.name}…`}
            disabled={recording}
            className="flex-1 bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 font-body" />

          <div className="flex items-center gap-1 flex-shrink-0 mb-0.5">
            <div ref={emojiRef} className="relative">
              <button onClick={() => setShowEmoji(v => !v)}
                className={cn('p-1 transition-colors', showEmoji ? 'text-brand-500' : 'text-gray-400 hover:text-brand-500')}>
                <Smile size={17} />
              </button>
              {showEmoji && (
                <div className="absolute bottom-10 right-0 z-50 shadow-2xl rounded-2xl overflow-hidden">
                  <EmojiPicker
                    onEmojiClick={(data: EmojiClickData) => { setText(p => p + data.emoji); setShowEmoji(false); inputRef.current?.focus(); }}
                    theme={document.documentElement.classList.contains('dark') ? Theme.DARK : Theme.LIGHT}
                    width={280} height={340} />
                </div>
              )}
            </div>

            <div ref={gifRef} className="relative">
              <button onClick={() => setShowGif(v => !v)}
                className={cn('px-2 h-8 rounded-lg text-xs font-bold transition-colors border', showGif ? 'bg-brand-500 text-white border-brand-500' : 'bg-surface-200 dark:bg-surface-800 text-gray-500 hover:text-brand-500')}>
                GIF
              </button>
              {showGif && (
                <div className="absolute bottom-10 right-0 z-50">
                  <GifPicker onSelect={onGifSelect} onClose={() => setShowGif(false)} />
                </div>
              )}
            </div>

            <button onClick={handleSend} disabled={!text.trim() || sending || recording}
              className={cn('w-8 h-8 rounded-lg flex items-center justify-center transition-all flex-shrink-0',
                text.trim() && !sending && !recording
                  ? 'bg-brand-500 hover:bg-brand-600 text-white'
                  : 'bg-surface-200 dark:bg-surface-700 text-gray-400 cursor-not-allowed'
              )}>
              <Send size={14} />
            </button>
          </div>
        </div>

      </div>
    </motion.div>
  );
};
const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ users, me, onClose, onCreate }) => {
  const [search, setSearch]   = useState('');
  const [selected, setSelected] = useState<User[]>([]);
  const [name, setName]       = useState('');
  const [creating, setCreating] = useState(false);

  const filtered = users.filter(u => u.id !== me.id && u.name.toLowerCase().includes(search.toLowerCase()));
  const toggle   = (u: User) =>
    setSelected(prev => prev.some(x => x.id === u.id) ? prev.filter(x => x.id !== u.id) : [...prev, u]);

  const handleCreate = async () => {
    if (selected.length < 1 || !name.trim()) return;
    setCreating(true);
    try {
      const { data } = await apiClient.post<GroupDm>('/groups', {
        userIds: selected.map(u => u.id), name: name.trim(),
      });
      onCreate(data);
    } catch { /* ignore */ } finally { setCreating(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }}
        className="bg-white dark:bg-surface-900 rounded-2xl shadow-2xl w-[360px] max-h-[80vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-subtle flex items-center justify-between">
          <h2 className="font-bold text-gray-900 dark:text-gray-100 font-display">Nouveau groupe</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-gray-400">
            <X size={16} />
          </button>
        </div>
        <div className="p-4 border-b border-subtle">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nom du groupe…"
            className="w-full bg-surface-100 dark:bg-surface-800 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 border-none outline-none font-body" />
        </div>
        {selected.length > 0 && (
          <div className="px-4 py-2 flex flex-wrap gap-1.5 border-b border-subtle">
            {selected.map(u => (
              <span key={u.id} className="flex items-center gap-1 px-2 py-0.5 bg-brand-500/10 text-brand-500 rounded-full text-xs font-semibold">
                {u.name}
                <button onClick={() => toggle(u)}><X size={10} /></button>
              </span>
            ))}
          </div>
        )}
        <div className="p-3 border-b border-subtle">
          <div className="flex items-center gap-2 bg-surface-100 dark:bg-surface-800 rounded-lg px-3 py-1.5">
            <Search size={13} className="text-gray-400 flex-shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher des personnes…"
              className="bg-transparent border-none outline-none text-xs text-gray-900 dark:text-gray-100 w-full placeholder-gray-400 font-body" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {filtered.map(u => (
            <button key={u.id} onClick={() => toggle(u)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors">
              <Avatar user={u} size="sm" showStatus={false} />
              <div className="flex-1 min-w-0 text-left">
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{u.name}</div>
                <div className="text-xs text-gray-400 truncate">{u.title || u.role}</div>
              </div>
              {selected.some(x => x.id === u.id) && <Check size={15} className="text-brand-500 flex-shrink-0" />}
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-subtle">
          <button onClick={handleCreate} disabled={selected.length < 1 || !name.trim() || creating}
            className={cn('w-full py-2.5 rounded-xl font-semibold text-sm transition-colors',
              selected.length >= 1 && name.trim() && !creating
                ? 'bg-brand-500 hover:bg-brand-600 text-white'
                : 'bg-surface-100 dark:bg-surface-800 text-gray-400 cursor-not-allowed'
            )}>
            {creating ? 'Création…' : `Créer le groupe (${selected.length + 1})`}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════
// DIRECT MESSAGES PAGE
// ═══════════════════════════════════════════════════════════
const DirectMessagesPage: React.FC = () => {
  const { user: me }              = useAuth();
  const navigate                  = useNavigate();
  const [users, setUsers]         = useState<User[]>([]);
  const [groups, setGroups]       = useState<GroupDm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch]       = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [activeDM, setActiveDM]   = useState<User | null>(null);
  const [activeGroup, setActiveGroup] = useState<GroupDm | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [autoJoinGroupChannelId, setAutoJoinGroupChannelId] = useState<string | null>(null);
  const [pendingVoiceJoin, setPendingVoiceJoin] = useState<string | null>(null);
  const location = useLocation();
  const restoreAttemptedRef = useRef(false);

  // Appel vocal 1-to-1 (outgoing only — incoming handled globally in DashboardLayout)
  const [callPeer, setCallPeer] = useState<User | null>(null);

  // Notifications d'appel pour la conversation active
  const [callNotifs, setCallNotifs] = useState<CallNotif[]>([]);

  const allUsers = [me as User, ...users].filter(Boolean);

  useEffect(() => {
    Promise.all([
      apiClient.get<User[]>('/users'),
      apiClient.get<GroupDm[]>('/groups').catch(() => ({ data: [] as GroupDm[] })),
    ]).then(([usersRes, groupsRes]) => {
      const normalized = (usersRes.data as User[]).map((u) => {
        const rawStatus = String(u.status ?? 'offline').toLowerCase();
        const status = (['online', 'away', 'donotdisturb', 'offline'].includes(rawStatus)
          ? rawStatus
          : 'offline') as User['status'];
        return { ...u, status };
      });
      setUsers(normalized.filter((u: User) => u.id !== me?.id));
      setGroups(groupsRes.data as GroupDm[]);
    }).finally(() => setIsLoading(false));
  }, [me?.id]);

  useEffect(() => {
    if (!users.length) return;
    try {
      const raw = localStorage.getItem(CALL_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as { kind?: string; peerId?: string };
      if (data.kind !== 'dm' || !data.peerId) return;
      const peer = users.find(u => u.id === data.peerId);
      if (!peer) return;
      setActiveDM(peer);
      setActiveGroup(null);
      setCallNotifs([]);
      setCallPeer(peer);
    } catch { /* ignore */ }
  }, [users]);

  const callNotifCounterRef = useRef(0);
  const addCallNotif = useCallback((text: string) => {
    setCallNotifs(prev => [...prev, { id: `cn-${++callNotifCounterRef.current}`, text, ts: new Date().toISOString() }]);
  }, []);

  // Capture navigation state (joinGroupChannelId) into state, then clear nav state
  useEffect(() => {
    const state = location.state as { joinGroupChannelId?: string; restoreDmPeerId?: string } | null;
    const joinChannelId = state?.joinGroupChannelId;
    const restoreDmPeerId = state?.restoreDmPeerId;
    if (joinChannelId) {
      setPendingVoiceJoin(joinChannelId);
      navigate(location.pathname, { replace: true, state: null });
      return;
    }
    if (restoreDmPeerId) {
      const peer = allUsers.find(u => u.id === restoreDmPeerId);
      if (peer) {
        setActiveDM(peer);
        setActiveGroup(null);
        setCallNotifs([]);
        setCallPeer(peer);
      }
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate, allUsers]);

  // Open DM/Group from notifications (openChannelId)
  useEffect(() => {
    const openChannelId = (location.state as { openChannelId?: string } | null)?.openChannelId;
    if (!openChannelId) return;

    const group = groups.find(g => g.channelId === openChannelId);
    if (group) {
      setActiveGroup(group);
      setActiveDM(null);
      navigate(location.pathname, { replace: true, state: null });
      return;
    }

    apiClient.get<{ peerId: string }>(`/dm/channel/${openChannelId}`)
      .then(({ data }) => {
        const peer = allUsers.find(u => u.id === data.peerId);
        if (peer) {
          setActiveDM(peer);
          setActiveGroup(null);
        }
      })
      .finally(() => {
        navigate(location.pathname, { replace: true, state: null });
      });
  }, [location.state, location.pathname, navigate, groups, allUsers]);

  // Process pending join when groups are loaded OR when pendingVoiceJoin changes
  useEffect(() => {
    if (!pendingVoiceJoin || !groups.length) return;
    const group = groups.find(g => g.channelId === pendingVoiceJoin);
    if (group) {
      setPendingVoiceJoin(null);
      setActiveGroup(group);
      setActiveDM(null);
      setAutoJoinGroupChannelId(pendingVoiceJoin);
    }
  }, [groups, pendingVoiceJoin]);

  useEffect(() => {
    if (restoreAttemptedRef.current) return;
    if (pendingVoiceJoin) return;
    try {
      const raw = localStorage.getItem(CALL_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as { kind?: string; channelId?: string };
      if (data.kind === 'group' && data.channelId) {
        restoreAttemptedRef.current = true;
        setPendingVoiceJoin(data.channelId);
      }
    } catch { /* ignore */ }
  }, [pendingVoiceJoin]);

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchQ = u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.title ?? '').toLowerCase().includes(q);
    return matchQ && (!roleFilter || getUserRoles(u).includes(roleFilter as any));
  });

  const online  = filtered.filter(u => u.status === 'online');
  const away    = filtered.filter(u => u.status === 'away' || u.status === 'donotdisturb');
  const offline = filtered.filter(u => u.status === 'offline');

  const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase()));

  const ROLE_FILTER = [
    { value: '', label: 'Tous' }, { value: 'director', label: 'Director' },
    { value: 'admin', label: 'Admin' }, { value: 'manager', label: 'Manager' },
    { value: 'employee', label: 'Employé' },
  ];

  const UserRow: React.FC<{ u: User }> = ({ u }) => (
    <motion.button initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      onClick={() => { setActiveDM(u); setActiveGroup(null); setCallNotifs([]); }}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
        activeDM?.id === u.id ? 'bg-brand-500/10' : 'hover:bg-surface-100 dark:hover:bg-surface-800/60'
      }`}>
      <div className="relative flex-shrink-0">
        <Avatar user={u} size="sm" showStatus={false} />
        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-surface-900 ${STATUS_DOT[u.status] ?? 'bg-gray-300'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-[13px] font-semibold truncate ${activeDM?.id === u.id ? 'text-brand-500' : 'text-gray-900 dark:text-gray-100'}`}>{u.name}</div>
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
        {items.map(u => <UserRow key={u.id} u={u} />)}
      </div>
    );
  };

  const handleGroupCreated = (group: GroupDm) => {
    setGroups(prev => [...prev, group]);
    setActiveGroup(group);
    setActiveDM(null);
    setShowCreateGroup(false);
  };

  return (
    <div className="flex h-full">
      {/* Left panel */}
      <div className="w-72 border-r border-subtle bg-white dark:bg-surface-900 flex flex-col flex-shrink-0 h-full">
        <div className="p-3 border-b border-subtle">
          <div className="flex items-center gap-2 bg-surface-100 dark:bg-surface-800 rounded-lg px-3 py-1.5 mb-2">
            <Search size={13} className="text-gray-400 flex-shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
              className="bg-transparent border-none outline-none text-xs text-gray-900 dark:text-gray-100 w-full placeholder-gray-400 font-body" />
            {search && <button onClick={() => setSearch('')}><X size={11} className="text-gray-400" /></button>}
          </div>
          <div className="flex gap-1 flex-wrap items-center justify-between">
            <div className="flex gap-1 flex-wrap">
              {ROLE_FILTER.map(f => (
                <button key={f.value} onClick={() => setRoleFilter(f.value === roleFilter ? '' : f.value)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-colors ${
                    roleFilter === f.value
                      ? 'bg-brand-500 text-white'
                      : 'bg-surface-100 dark:bg-surface-800 text-gray-500 hover:bg-surface-200 dark:hover:bg-surface-700'
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>
            <button onClick={() => setShowCreateGroup(true)} title="Nouveau groupe"
              className="p-1 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-gray-400 hover:text-brand-500 transition-colors">
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
          {isLoading ? (
            <div className="space-y-2 p-2">
              {[...Array(5)].map((_, i) => (
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
              {/* Groupes */}
              {filteredGroups.length > 0 && (
                <div className="mb-3">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-600">
                    Groupes — {filteredGroups.length}
                  </div>
                  {filteredGroups.map(g => (
                    <motion.button key={g.channelId} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      onClick={() => { setActiveGroup(g); setActiveDM(null); setCallNotifs([]); setAutoJoinGroupChannelId(null); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
                        activeGroup?.channelId === g.channelId
                          ? 'bg-brand-500/10'
                          : 'hover:bg-surface-100 dark:hover:bg-surface-800/60'
                      }`}>
                      <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                        <Users size={14} className="text-brand-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-[13px] font-semibold truncate ${
                          activeGroup?.channelId === g.channelId ? 'text-brand-500' : 'text-gray-900 dark:text-gray-100'
                        }`}>{g.name}</div>
                        <div className="text-[11px] text-gray-400 truncate">{g.participants.length} membres</div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
              <Section label="En ligne" items={online} />
              <Section label="Absent" items={away} />
              <Section label="Hors ligne" items={offline} />
              {filtered.length === 0 && filteredGroups.length === 0 && (
                <div className="text-center py-8 text-sm text-gray-400">Aucun résultat</div>
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
            allUsers={allUsers}
            onClose={() => setActiveDM(null)}
            onCallStart={peer => { setCallNotifs([]); setCallPeer(peer); }}
            callNotifs={callNotifs}
          />
        ) : activeGroup && me ? (
          <GroupConversation
            key={activeGroup.channelId}
            group={activeGroup}
            me={me}
            allUsers={allUsers}
            onClose={() => setActiveGroup(null)}
            autoJoinVoice={autoJoinGroupChannelId === activeGroup.channelId}
          />
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex-1 flex items-center justify-center flex-col gap-3 text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
              <MessageSquare size={28} className="text-gray-300 dark:text-gray-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-gray-100 font-display mb-1">Messages Directs</h3>
              <p className="text-sm text-gray-400">Sélectionnez une personne ou un groupe</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {showCreateGroup && me && (
          <CreateGroupModal users={users} me={me} onClose={() => setShowCreateGroup(false)} onCreate={handleGroupCreated} />
        )}
        {callPeer && me && (
          <VoiceCallOverlay
            outgoingPeer={callPeer}
            allUsers={allUsers}
            onEnd={() => setCallPeer(null)}
            onCallStarted={() => addCallNotif('📞 Appel vocal démarré')}
            onCallEnded={(dur) => {
              const m = Math.floor(dur / 60), s = dur % 60;
              addCallNotif(`📵 Appel terminé — ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default DirectMessagesPage;



























