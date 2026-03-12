import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Send, Paperclip, AtSign, Smile, Hash, Lock, MessageSquare, X, Image, Mic, MicOff, Volume2, VolumeX, PhoneOff, Monitor, MonitorOff, Video, VideoOff } from 'lucide-react';
import EmojiPicker, { type EmojiClickData, Theme } from 'emoji-picker-react';
import { useAppDispatch, useAppSelector, useAuth } from '@/hooks';
import { signalRService, useSignalRVersion } from '@/services/signalRService';
import { fetchMessages, sendMessage, setActiveChannel, editMessage, deleteMessage } from '@/store/slices/chatSlice';
import { MessageBubble, GifPicker } from '@/components/shared';
import VideoLayout, { type Participant } from '@/components/shared/VideoLayout';
import { Avatar, Loader } from '@/components/ui';
import { cn } from '@/utils';
import apiClient from '@/services/apiClient';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import type { User } from '@/types';

// Base URL for static assets (uploads). Strip /api suffix so images go to /uploads/...
const API_BASE = (import.meta.env.VITE_API_URL as string || '/api').replace(/\/api$/, '');

// ── Notification système dans le chat ─────────────────────
interface VoiceEvent { id: string; text: string; ts: string; }

const VoiceEventBubble: React.FC<{ event: VoiceEvent }> = ({ event }) => (
  <div className="flex justify-center py-2">
    <div className="flex items-center gap-2 px-4 py-1.5 bg-surface-100 dark:bg-surface-800 rounded-full text-xs text-gray-500 dark:text-gray-400 border border-subtle">
      <span>{event.text}</span>
      <span className="text-gray-400 dark:text-gray-600">
        {new Date(event.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  </div>
);

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

// ── Voice Channel Panel ───────────────────────────────────
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const VoiceChannelPanel: React.FC<{ channelId: string; meId: string; usersMap: Record<string, User> }> = ({ channelId, meId, usersMap }) => {
  const signalRVersion  = useSignalRVersion();
  const [joined, setJoined]         = useState(false);
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [muted, setMuted]           = useState(false);
  const [speakerOff, setSpeakerOff] = useState(false);
  const [videoOn, setVideoOn]       = useState(false);
  const [screenOn, setScreenOn]     = useState(false);
  const [layoutMode, setLayoutMode] = useState<'grid' | 'speaker' | 'screen' | 'focus'>('grid');
  const [focusedId, setFocusedId]   = useState<string | null>(null);
  // Remote video streams — array to support multiple streams per peer (screen + webcam)
  const [remoteVideos, setRemoteVideos] = useState<Array<{
    peerId: string; trackId: string; stream: MediaStream; isScreen: boolean;
  }>>([]);
  const [localCamStream, setLocalCamStream] = useState<MediaStream | null>(null);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);

  const localStreamRef   = useRef<MediaStream | null>(null);
  const screenStreamRef  = useRef<MediaStream | null>(null);
  const localCamRef      = useRef<MediaStream | null>(null);
  const joinedRef        = useRef(false);
  const meIdRef          = useRef(meId);
  meIdRef.current        = meId;
  const pcsRef           = useRef<Map<string, RTCPeerConnection>>(new Map());

  const closePc = useCallback((peerId: string) => {
    const pc = pcsRef.current.get(peerId);
    if (!pc) return;
    pc.ontrack = null; pc.onicecandidate = null; pc.onnegotiationneeded = null;
    pc.close();
    pcsRef.current.delete(peerId);
    setRemoteVideos(prev => prev.filter(v => v.peerId !== peerId));
    const el = document.getElementById(`vcpa-${peerId}`) as HTMLAudioElement | null;
    if (el) { el.srcObject = null; el.remove(); }
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
    const existing = pcsRef.current.get(peerId);
    if (existing && existing.signalingState !== 'closed') return existing;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = e => {
      if (e.candidate) signalRService.sendGroupVoiceIce(channelId, peerId, JSON.stringify(e.candidate)).catch(() => {});
    };
    pc.ontrack = e => {
      if (e.track.kind === 'audio') {
        const stream = e.streams[0] ?? new MediaStream([e.track]);
        let audio = document.getElementById(`vcpa-${peerId}`) as HTMLAudioElement | null;
        if (!audio) {
          audio = document.createElement('audio');
          audio.id = `vcpa-${peerId}`; audio.autoplay = true;
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
    pc.onnegotiationneeded = async () => {
      if (!joinedRef.current) return;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await signalRService.sendGroupVoiceOffer(channelId, peerId, JSON.stringify(offer));
      } catch { /* ignore */ }
    };
    pcsRef.current.set(peerId, pc);
    return pc;
  }, [channelId]);

  const join = useCallback(async () => {
    // Leave all other active calls before joining
    window.dispatchEvent(new CustomEvent('Team Talk:leave-all-calls', { detail: { except: 'voice-channel' } }));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      joinedRef.current = true;
      const w = window as unknown as { __TeamTalkVoiceChannels?: Set<string> };
      w.__TeamTalkVoiceChannels = w.__TeamTalkVoiceChannels ?? new Set();
      w.__TeamTalkVoiceChannels.add(channelId);
      await signalRService.joinVoiceChannel(channelId);
      setJoined(true);
    } catch { /* mic denied */ }
  }, [channelId]);

  const leave = useCallback(async () => {
    pcsRef.current.forEach((_, pid) => closePc(pid));
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    joinedRef.current = false;
    (window as unknown as { __TeamTalkVoiceChannels?: Set<string> }).__TeamTalkVoiceChannels?.delete(channelId);
    await signalRService.leaveVoiceChannel(channelId);
    setJoined(false); setParticipantIds([]); setVideoOn(false); setScreenOn(false);
    setRemoteVideos([]); setLocalCamStream(null);
  }, [channelId, closePc]);

  const toggleMic = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = muted; });
    setMuted(m => !m);
  }, [muted]);

  const toggleVideo = useCallback(async () => {
    if (!videoOn) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true });
        const track = s.getVideoTracks()[0];
        localCamRef.current = s;
        // Add webcam to the AUDIO stream so receivers can distinguish it from screen share
        pcsRef.current.forEach(pc => {
          if (localStreamRef.current && !pc.getSenders().some(sender => sender.track === track))
            pc.addTrack(track, localStreamRef.current);
        });
        setLocalCamStream(s);
        setVideoOn(true);
        track.onended = () => { localCamRef.current = null; setLocalCamStream(null); setVideoOn(false); };
      } catch { /* denied */ }
    } else {
      const s = localCamStream;
      s?.getTracks().forEach(t => {
        t.stop();
        pcsRef.current.forEach(pc => {
          const sender = pc.getSenders().find(sd => sd.track === t);
          if (sender) pc.removeTrack(sender);
        });
      });
      localCamRef.current = null;
      setLocalCamStream(null); setVideoOn(false);
    }
  }, [videoOn, localCamStream]);

  const toggleScreen = useCallback(async () => {
    if (!screenOn) {
      try {
        const stream = await (navigator.mediaDevices as unknown as { getDisplayMedia(c: object): Promise<MediaStream> })
          .getDisplayMedia({ video: { cursor: 'always' } as object, audio: false });
        screenStreamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        const stopScreen = () => {
          setScreenOn(false);
          setLocalScreenStream(null);
          screenStreamRef.current = null;
          pcsRef.current.forEach(pc => {
            const sender = pc.getSenders().find(s => s.track === track);
            if (sender) pc.removeTrack(sender);
          });
        };
        track.onended = stopScreen;
        pcsRef.current.forEach(pc => pc.addTrack(track, stream));
        setLocalScreenStream(stream);
        setScreenOn(true);
      } catch { /* denied */ }
    } else {
      screenStreamRef.current?.getTracks().forEach(t => {
        t.stop();
        pcsRef.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track === t);
          if (sender) pc.removeTrack(sender);
        });
      });
      screenStreamRef.current = null;
      setLocalScreenStream(null);
      setScreenOn(false);
    }
  }, [screenOn]);

  // SignalR + WebRTC handlers — re-registered on every reconnect via signalRVersion
  useEffect(() => {
    const onJoined = (data: { channelId: string; userId: string }) => {
      if (data.channelId !== channelId) return;
      setParticipantIds(prev => prev.includes(data.userId) ? prev : [...prev, data.userId]);
    };
    const onLeft = (data: { channelId: string; userId: string }) => {
      if (data.channelId !== channelId) return;
      setParticipantIds(prev => prev.filter(id => id !== data.userId));
      closePc(data.userId);
    };
    const onParticipants = async (data: { channelId: string; userIds: string[] }) => {
      if (data.channelId !== channelId || !joinedRef.current) return;
      setParticipantIds(data.userIds);
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
        const pc = pcsRef.current.get(data.senderId);
        if (pc && pc.signalingState !== 'stable') await pc.setRemoteDescription(JSON.parse(data.answer));
      } catch { /* ignore */ }
    };
    const onIce = async (data: { channelId: string; senderId: string; candidate: string }) => {
      if (data.channelId !== channelId) return;
      try {
        const pc = pcsRef.current.get(data.senderId);
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
      pcsRef.current.forEach((_, pid) => closePc(pid));
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      if (joinedRef.current) {
        (window as unknown as { __TeamTalkVoiceChannels?: Set<string> }).__TeamTalkVoiceChannels?.delete(channelId);
        signalRService.leaveVoiceChannel(channelId).catch(() => {});
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, closePc]);

  // Auto-leave when another call starts (global event)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.except === 'voice-channel') return;
      if (joinedRef.current) leave();
    };
    window.addEventListener('Team Talk:leave-all-calls', handler);
    return () => window.removeEventListener('Team Talk:leave-all-calls', handler);
  }, [leave]);

  const layoutParticipants = useMemo<Participant[]>(() => {
    const map = new Map<string, Participant>();
    const ensure = (id: string, name: string, isMuted = false) => {
      if (!map.has(id)) {
        map.set(id, { id, name, audioLevel: 0, isMuted, isLive: false, isSpeaking: false, streams: [] });
      } else if (isMuted) {
        const p = map.get(id)!;
        p.isMuted = isMuted;
      }
      return map.get(id)!;
    };

    remoteVideos.forEach(v => {
      const name = usersMap[v.peerId]?.name ?? v.peerId;
      const p = ensure(v.peerId, name);
      p.streams.push({ type: v.isScreen ? 'screen' : 'camera', stream: v.stream, screenIndex: v.isScreen ? 1 : undefined });
      if (v.isScreen) p.isLive = true;
    });

    const meName = usersMap[meId]?.name ?? 'Vous';
    const me = ensure('local', meName, muted);
    if (videoOn && localCamStream) me.streams.push({ type: 'camera', stream: localCamStream });
    if (screenOn && localScreenStream) {
      me.streams.push({ type: 'screen', stream: localScreenStream, screenIndex: 1 });
      me.isLive = true;
    }
    return Array.from(map.values());
  }, [remoteVideos, usersMap, meId, muted, videoOn, localCamStream, screenOn, localScreenStream]);

  const hasVideo = layoutParticipants.some(p => p.streams.length > 0);
  const handleTileDoubleClick = (tileId: string) => {
    if (layoutMode === 'focus' && focusedId === tileId) {
      setLayoutMode('grid'); setFocusedId(null);
      return;
    }
    setLayoutMode('focus'); setFocusedId(tileId);
  };

  return (
    <div className={cn('overflow-hidden flex flex-col h-full', hasVideo ? 'bg-[#1a1a1a]' : 'bg-surface-50 dark:bg-surface-900/50')}>

      {/* Header */}
      <div className={cn('flex items-center gap-2 px-4 py-1.5', hasVideo ? 'bg-black/40' : '')}>
        <Volume2 size={13} className="text-emerald-500 flex-shrink-0" />
        <span className={cn('text-[11px] font-bold uppercase tracking-wide', hasVideo ? 'text-emerald-400' : 'text-gray-500 dark:text-gray-400')}>
          Voice Channel
        </span>
        {participantIds.length > 0 && <span className="text-[11px] text-gray-500 ml-1">· {participantIds.length} in call</span>}
        {screenOn && <span className="ml-auto flex items-center gap-1 text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded font-bold"><Monitor size={9}/> LIVE</span>}
      </div>

      <div className="flex-1 min-h-0">
        {joined ? (
          <VideoLayout
            participants={layoutParticipants}
            mode={layoutMode}
            focusedId={focusedId}
            onTileDoubleClick={handleTileDoubleClick}
            onToggleMute={toggleMic}
            onToggleSpeaker={() => setSpeakerOff(s => !s)}
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
              <Volume2 size={14} /> Join Voice
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

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
  const signalRVersion = useSignalRVersion();
  const messages = useAppSelector((s) => (channelId ? s.chat.messages[channelId] : undefined));
  const isLoading = useAppSelector((s) => s.chat.isLoading);

  const [messageText, setMessageText] = useState('');
  const [showTyping, setShowTyping] = useState(false);
  const [showMembers] = useState(true);

  // Resizable voice panel
  const [voiceHeight, setVoiceHeight] = useState(360);
  const voiceDragging = useRef(false);
  const voiceAnchor = useRef({ startY: 0, startH: 0 });
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
  const [usersMap, setUsersMap] = useState<Record<string, User>>({});
  // Notifications vocales (rejoindre / quitter le canal vocal)
  const [voiceEvents, setVoiceEvents] = useState<VoiceEvent[]>([]);

  // Emoji picker
  const [showEmoji, setShowEmoji] = useState(false);
  const emojiRef = useRef<HTMLDivElement>(null);
  const gifRef = useRef<HTMLDivElement>(null);
  const [showGif, setShowGif] = useState(false);

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

  // Voice message recording
  const handleAudioReady = useCallback(async (blob: Blob) => {
    if (!channelId) return;
    try {
      const form = new FormData();
      form.append('file', blob, `voice-${Date.now()}.webm`);
      const { data } = await apiClient.post<{ url: string; fileName: string; contentType: string }>(
        '/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      const audioUrl = `${API_BASE}${data.url}`;
      dispatch(sendMessage({ channelId, content: `[🎤 Voice Message](${audioUrl})` }));
    } catch { /* ignore */ }
  }, [channelId, dispatch]);

  const { recording, duration, start: startRecording, stop: stopRecording } = useVoiceRecorder(handleAudioReady);

  useEffect(() => {
    apiClient.get<User[]>('/users').then(({ data }) => {
      const map: Record<string, User> = {};
      data.forEach((u) => { map[u.id] = u; });
      setUsersMap(map);
    });
  }, []);

  useEffect(() => {
    if (channelId) {
      setVoiceEvents([]); // reset notifs on channel change
      dispatch(setActiveChannel(channelId));
      dispatch(fetchMessages({ channelId }));
      signalRService.joinChannel(channelId);
      return () => { signalRService.leaveChannel(channelId); };
    }
  }, [channelId, dispatch, signalRVersion]);

  // Notifications de présence vocale (canaux voice)
  useEffect(() => {
    if (!channel?.isVoice || !channelId) return;
    const onJoined = (data: { channelId: string; userId: string }) => {
      if (data.channelId !== channelId) return;
      const name = usersMap[data.userId]?.name ?? 'Quelqu\'un';
      setVoiceEvents(prev => [...prev, {
        id: `ve-${Date.now()}`,
        text: `✅ ${name} a rejoint le canal vocal`,
        ts: new Date().toISOString(),
      }]);
    };
    const onLeft = (data: { channelId: string; userId: string }) => {
      if (data.channelId !== channelId) return;
      const name = usersMap[data.userId]?.name ?? 'Quelqu\'un';
      setVoiceEvents(prev => [...prev, {
        id: `ve-${Date.now()}`,
        text: `👋 ${name} a quitté le canal vocal`,
        ts: new Date().toISOString(),
      }]);
    };
    signalRService.onUserJoinedVoice(onJoined);
    signalRService.onUserLeftVoice(onLeft);
    return () => {
      signalRService.offEvent('UserJoinedVoice', onJoined as never);
      signalRService.offEvent('UserLeftVoice', onLeft as never);
    };
  }, [channel?.isVoice, channelId, usersMap, signalRVersion]);

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

  const onGifSelect = (url: string) => {
    setMessageText((prev) => (prev.trim() ? prev + `
![gif](${url})` : `![gif](${url})`));
    setShowGif(false);
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
    if ((!messageText.trim() && attachments.length === 0) || !channelId || recording) return;
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
        {/* Voice channel panel — shown when channel.isVoice */}
        {channel.isVoice && channelId && (
          <>
            <div style={{ height: voiceHeight, flexShrink: 0, overflow: 'hidden' }}>
              <VoiceChannelPanel channelId={channelId} meId={user?.id ?? ''} usersMap={usersMap} />
            </div>
            {/* ── Drag handle to resize voice panel ── */}
            <div
              onMouseDown={startVoiceResize}
              style={{ height: 8, flexShrink: 0, cursor: 'row-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
              className="hover:bg-brand-500/20 transition-colors group"
            >
              <div style={{ width: 48, height: 3, borderRadius: 99, background: 'rgba(255,255,255,0.18)' }} className="group-hover:bg-brand-500 transition-colors" />
            </div>
          </>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="px-5 pt-5 pb-6 border-b border-subtle/50 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center mb-3">
              {channel.isVoice
                ? <Volume2 size={22} className="text-brand-500" />
                : channel.isPrivate
                  ? <Lock size={22} className="text-brand-500" />
                  : <Hash size={22} className="text-brand-500" />}
            </div>
            <h2 className="text-xl font-black text-gray-900 dark:text-gray-100 font-display mb-1">
              {channel.isVoice ? '🔊 ' : ''}{channel.isPrivate ? '🔒 ' : '#'}{channel.name}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {channel.description || (channel.isVoice ? 'Voice channel — join to talk' : `Start of #${channel.name}`)}.
            </p>
          </div>

          {isLoading ? (
            <Loader />
          ) : (
            messages?.map((msg) => {
              // Render voice messages as audio players
              const voiceMatch = msg.content.match(/\[🎤 Voice Message\]\(([^)]+)\)/);
              if (voiceMatch) {
                const sender = usersMap[msg.userId] ?? FALLBACK_USER(msg.userId);
                return (
                  <div key={msg.id} className={`flex gap-2 px-5 py-1 ${msg.userId === user?.id ? 'flex-row-reverse' : ''}`}>
                    <Avatar user={sender} size="sm" showStatus={false} />
                    <div className="bg-surface-100 dark:bg-surface-800 rounded-2xl px-3 py-2 max-w-xs">
                      <audio controls src={voiceMatch[1]} className="h-8" style={{ minWidth: 180 }} />
                    </div>
                  </div>
                );
              }
              return (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  user={usersMap[msg.userId] ?? FALLBACK_USER(msg.userId)}
                  isOwn={msg.userId === user?.id}
                  currentUserId={user?.id}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              );
            })
          )}
          {showTyping && <TypingIndicator />}
          {/* Notifications vocales en temps réel */}
          {voiceEvents.map(ev => <VoiceEventBubble key={ev.id} event={ev} />)}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area — always shown; voice channels support both text and voice */}
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
                accept="image/*,video/mp4,application/pdf,audio/*"
                className="hidden"
                onChange={handleFileSelect}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || recording}
                className="p-1 text-gray-400 hover:text-brand-500 transition-colors flex-shrink-0 mb-0.5"
                title="Attach file or image"
              >
                <Paperclip size={18} className={uploading ? 'animate-pulse text-brand-500' : ''} />
              </button>

              {/* Voice recording — hold to record */}
              <button
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                disabled={uploading}
                className={cn('p-1 flex-shrink-0 mb-0.5 transition-colors rounded', recording ? 'text-red-500 bg-red-50 dark:bg-red-500/10' : 'text-gray-400 hover:text-brand-500')}
                title={recording ? `Recording… ${duration}s` : 'Hold to record voice message'}
              >
                {recording ? <MicOff size={18} /> : <Mic size={18} />}
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
                placeholder={recording ? `Recording… ${duration}s — release to send` : `Message #${channel.name}`}
                disabled={recording}
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

                <div ref={gifRef} className="relative">
                  <button
                    onClick={() => setShowGif((v) => !v)}
                    className={cn('px-2 h-8 rounded-lg text-xs font-bold transition-colors border', showGif ? 'bg-brand-500 text-white border-brand-500' : 'bg-surface-200 dark:bg-surface-800 text-gray-500 hover:text-brand-500')}
                    title="GIF"
                  >
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
                  disabled={(!messageText.trim() && attachments.length === 0) || recording}
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
                    (messageText.trim() || attachments.length > 0) && !recording
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












