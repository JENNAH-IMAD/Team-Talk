import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX,
  Monitor, MonitorOff, Video, VideoOff,
} from 'lucide-react';
import { Avatar } from '@/components/ui';
import { signalRService } from '@/services/signalRService';
import VideoLayout, { type Participant } from '@/components/shared/VideoLayout';
import type { User } from '@/types';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];
const CALL_STORAGE_KEY = 'teamtalk.activeCall';

export interface VoiceCallOverlayProps {
  outgoingPeer?: User;
  incomingCallerId?: string;
  incomingOffer?: string;
  allUsers: User[];
  onEnd: () => void;
  onCallStarted?: () => void;
  onCallEnded?: (durationSeconds: number) => void;
}

type CallState = 'idle' | 'calling' | 'ringing' | 'active';

// ── Ring tone factory ─────────────────────────────────────
export const createRingtone = (type: 'dm' | 'group' | 'channel' = 'dm'): (() => void) => {
  try {
    const ctx = new AudioContext();
    let stopped = false;
    let loopTimeout: number;

    const beep = (freq: number, t: number, dur: number, vol = 0.22) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.04);
      g.gain.setValueAtTime(vol, t + dur - 0.04);
      g.gain.linearRampToValueAtTime(0, t + dur);
      osc.start(t); osc.stop(t + dur);
    };

    const patterns: Record<typeof type, () => void> = {
      dm: () => {
        // Two quick beeps — 480 Hz
        const t = ctx.currentTime;
        beep(480, t, 0.35); beep(480, t + 0.45, 0.35);
      },
      group: () => {
        // Three ascending beeps — warmer/friendlier
        const t = ctx.currentTime;
        beep(500, t, 0.2); beep(620, t + 0.25, 0.2); beep(740, t + 0.5, 0.22);
      },
      channel: () => {
        // Single gentle chime
        const t = ctx.currentTime;
        beep(880, t, 0.28, 0.18); beep(1100, t + 0.06, 0.22, 0.10);
      },
    };

    const intervals: Record<typeof type, number> = { dm: 2500, group: 3000, channel: 4000 };

    const ring = () => {
      if (stopped) return;
      patterns[type]();
      loopTimeout = window.setTimeout(() => { if (!stopped) ring(); }, intervals[type]);
    };
    ring();
    return () => { stopped = true; clearTimeout(loopTimeout); ctx.close().catch(() => {}); };
  } catch { return () => {}; }
};

// ── Component ─────────────────────────────────────────────
const VoiceCallOverlay: React.FC<VoiceCallOverlayProps> = ({
  outgoingPeer, incomingCallerId, incomingOffer,
  allUsers, onEnd, onCallStarted, onCallEnded,
}) => {
  const [callState, setCallState] = useState<CallState>(
    outgoingPeer ? 'calling' : incomingCallerId ? 'ringing' : 'idle'
  );
  const [muted, setMuted]           = useState(false);
  const [speakerOff, setSpeakerOff] = useState(false);
  const [duration, setDuration]     = useState(0);
  const [sharing, setSharing]       = useState(false);
  const [receivingScreen, setReceivingScreen] = useState(false);
  const [cameraOn, setCameraOn]     = useState(false);
  const [localCamStream, setLocalCamStream] = useState<MediaStream | null>(null);
  const [remoteCamStream, setRemoteCamStream] = useState<MediaStream | null>(null);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [remoteScreenStream, setRemoteScreenStream] = useState<MediaStream | null>(null);
  const [layoutMode, setLayoutMode] = useState<'grid' | 'speaker' | 'screen' | 'focus'>('grid');
  const [focusedId, setFocusedId]   = useState<string | null>(null);
  const lastModeRef = useRef<'grid' | 'speaker' | 'screen'>('grid');
  const [panelHeight, setPanelHeight] = useState(360);
  const [panelWidth, setPanelWidth] = useState(560);

  const pcRef           = useRef<RTCPeerConnection | null>(null);
  const videoPcRef      = useRef<RTCPeerConnection | null>(null); // shared for screen + cam
  const localStreamRef  = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const localCamRef     = useRef<MediaStream | null>(null);
  const remoteAudioRef  = useRef<HTMLAudioElement | null>(null);
  const timerRef        = useRef<number | null>(null);
  const durationRef     = useRef(0);
  const stopRingRef     = useRef<(() => void) | null>(null);
  // track id → type, set when adding, read in ontrack on receiver
  const trackTypeRef    = useRef<Record<string, 'cam' | 'screen'>>({});

  const peer     = outgoingPeer ?? allUsers.find(u => u.id === incomingCallerId);
  const targetId = outgoingPeer?.id ?? incomingCallerId ?? '';
  const clearStoredCall = useCallback(() => {
    try {
      const raw = localStorage.getItem(CALL_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as { kind?: string; peerId?: string };
      if (data.kind === 'dm' && data.peerId === targetId) localStorage.removeItem(CALL_STORAGE_KEY);
    } catch { /* ignore */ }
  }, [targetId]);

  useEffect(() => {
    if (callState !== 'active' || !targetId) return;
    try {
      localStorage.setItem(CALL_STORAGE_KEY, JSON.stringify({ kind: 'dm', peerId: targetId, ts: Date.now() }));
    } catch { /* ignore */ }
  }, [callState, targetId]);

  // ── Ringing ────────────────────────────────────────────
  useEffect(() => {
    if (callState === 'ringing') {
      stopRingRef.current = createRingtone('dm');
      return () => { stopRingRef.current?.(); stopRingRef.current = null; };
    }
  }, [callState]);

  const stopRing = () => { stopRingRef.current?.(); stopRingRef.current = null; };

  // ── Audio PC ──────────────────────────────────────────
  const createAudioPc = () => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = async (e) => {
      if (e.candidate) await signalRService.sendIceCandidate(targetId, JSON.stringify(e.candidate));
    };
    pc.ontrack = (e) => {
      if (e.track.kind !== 'audio') return;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = e.streams[0];
        if (!speakerOff) remoteAudioRef.current.play().catch(() => {});
      }
    };
    return pc;
  };

  // ── Video PC (shared for cam + screen) ────────────────
  const getOrCreateVideoPc = useCallback((remotePeerId: string): RTCPeerConnection => {
    if (videoPcRef.current && videoPcRef.current.signalingState !== 'closed') return videoPcRef.current;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = async (e) => {
      if (e.candidate) await signalRService.sendScreenIce(remotePeerId, JSON.stringify(e.candidate));
    };
    pc.ontrack = (e) => {
      if (e.track.kind !== 'video') return;
      const type = trackTypeRef.current[e.track.id];
      if (type === 'cam') {
        setRemoteCamStream(e.streams[0]);
      } else {
        // screen share (type === 'screen' or fallback)
        setReceivingScreen(true);
        setRemoteScreenStream(e.streams[0]);
      }
      e.track.onended = () => {
        if (type === 'cam') setRemoteCamStream(null);
        else { setReceivingScreen(false); setRemoteScreenStream(null); }
      };
    };
    videoPcRef.current = pc;
    return pc;
  }, [targetId]);

  // Build and send a new offer on the video PC, embedding track types in the payload
  const sendVideoOffer = useCallback(async () => {
    const pc = videoPcRef.current;
    if (!pc) return;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      // Embed track→type mapping so receiver can distinguish cam from screen
      const tracksInfo = { ...trackTypeRef.current };
      await signalRService.sendScreenOffer(targetId, JSON.stringify({ offer, tracksInfo }));
    } catch { /* ignore */ }
  }, [targetId]);

  // ── Timer ────────────────────────────────────────────
  const startTimer = () => {
    durationRef.current = 0;
    timerRef.current = window.setInterval(() => {
      durationRef.current += 1; setDuration(durationRef.current);
    }, 1000);
  };

  const leaveAllOtherCalls = () => {
    window.dispatchEvent(new CustomEvent('Team Talk:leave-all-calls', { detail: { except: 'dm-overlay' } }));
  };

  // ── Call setup ───────────────────────────────────────
  const startCall = async () => {
    leaveAllOtherCalls();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      const pc = createAudioPc(); pcRef.current = pc;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await signalRService.callUser(targetId, JSON.stringify(offer));
    } catch { onEnd(); }
  };

  const answerCall = async () => {
    if (!incomingOffer) return;
    stopRing(); leaveAllOtherCalls();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      const pc = createAudioPc(); pcRef.current = pc;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      await pc.setRemoteDescription(JSON.parse(incomingOffer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await signalRService.acceptCall(targetId, JSON.stringify(answer));
      setCallState('active'); startTimer(); onCallStarted?.();
    } catch { onEnd(); }
  };

  const hangUp = async () => {
    stopRing();
    clearStoredCall();
    const finalDuration = durationRef.current;
    clearInterval(timerRef.current ?? 0);
    // Stop all local media
    localCamRef.current?.getTracks().forEach(t => t.stop()); localCamRef.current = null;
    screenStreamRef.current?.getTracks().forEach(t => t.stop()); screenStreamRef.current = null;
    videoPcRef.current?.close(); videoPcRef.current = null;
    pcRef.current?.close();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    await signalRService.endCall(targetId);
    onCallEnded?.(finalDuration); onEnd();
  };

  const rejectIncoming = async () => {
    stopRing();
    clearStoredCall();
    await signalRService.rejectCall(targetId);
    onEnd();
  };

  // ── Webcam ───────────────────────────────────────────
  const toggleCamera = async () => {
    if (!cameraOn) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true });
        const track = s.getVideoTracks()[0];
        localCamRef.current = s; setLocalCamStream(s);
        trackTypeRef.current[track.id] = 'cam';
        const pc = getOrCreateVideoPc(targetId);
        pc.addTrack(track, s);
        await sendVideoOffer();
        setCameraOn(true);
        track.onended = () => { localCamRef.current = null; setLocalCamStream(null); setCameraOn(false); };
      } catch { /* denied */ }
    } else {
      localCamRef.current?.getTracks().forEach(t => {
        delete trackTypeRef.current[t.id];
        t.stop();
        const sender = videoPcRef.current?.getSenders().find(s => s.track === t);
        if (sender) videoPcRef.current?.removeTrack(sender);
      });
      localCamRef.current = null; setLocalCamStream(null); setCameraOn(false);
      if (videoPcRef.current) await sendVideoOffer();
    }
  };

  // ── Screen share ────────────────────────────────────
  const cleanupScreenShare = useCallback((notify = true) => {
    screenStreamRef.current?.getTracks().forEach(t => {
      delete trackTypeRef.current[t.id];
      t.stop();
      const sender = videoPcRef.current?.getSenders().find(s => s.track === t);
      if (sender) videoPcRef.current?.removeTrack(sender);
    });
    screenStreamRef.current = null;
    setLocalScreenStream(null);
    if (notify) signalRService.stopScreenShare(targetId).catch(() => {});
    setSharing(false);
    if (videoPcRef.current && (cameraOn || Object.keys(trackTypeRef.current).length > 0)) {
      sendVideoOffer(); // renegotiate to remove screen track
    }
  }, [targetId, cameraOn, sendVideoOffer]);

  const startScreenShare = async () => {
    try {
      const stream = await (navigator.mediaDevices as MediaDevices & {
        getDisplayMedia: (c: object) => Promise<MediaStream>;
      }).getDisplayMedia({ video: { cursor: 'always' }, audio: false });
      screenStreamRef.current = stream;
      setLocalScreenStream(stream);
      const track = stream.getVideoTracks()[0];
      trackTypeRef.current[track.id] = 'screen';
      const pc = getOrCreateVideoPc(targetId);
      pc.addTrack(track, stream);
      await sendVideoOffer();
      track.onended = () => cleanupScreenShare(true);
      setSharing(true);
    } catch { /* cancelled */ }
  };

  // ── SignalR events ───────────────────────────────────
  useEffect(() => {
    if (outgoingPeer) startCall();

    const onAccepted = async (data: { answer: string }) => {
      if (!pcRef.current) return;
      await pcRef.current.setRemoteDescription(JSON.parse(data.answer));
      setCallState('active'); startTimer(); onCallStarted?.();
    };
    const onRejected = () => { stopRing(); clearStoredCall(); onEnd(); };
    const onEnded    = () => { stopRing(); clearStoredCall(); onCallEnded?.(durationRef.current); onEnd(); };
    const onIce      = async (data: { candidate: string }) => {
      try { await pcRef.current?.addIceCandidate(JSON.parse(data.candidate)); } catch {}
    };

    const onScreenOffer = async (data: { senderId: string; offer: string }) => {
      // Parse payload — may contain tracksInfo
      let sdp: RTCSessionDescriptionInit;
      let tracksInfo: Record<string, 'cam' | 'screen'> = {};
      try {
        const parsed = JSON.parse(data.offer);
        if (parsed.offer) { sdp = parsed.offer; tracksInfo = parsed.tracksInfo ?? {}; }
        else sdp = parsed;
      } catch { return; }

      // Merge received tracksInfo so ontrack can distinguish cam vs screen
      Object.assign(trackTypeRef.current, tracksInfo);

      // Reuse existing video PC for renegotiation
      const pc = getOrCreateVideoPc(data.senderId);
      await pc.setRemoteDescription(sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await signalRService.acceptScreenShare(data.senderId, JSON.stringify(answer));
    };

    const onScreenAccepted = async (data: { answer: string }) => {
      if (videoPcRef.current) await videoPcRef.current.setRemoteDescription(JSON.parse(data.answer));
    };
    const onScreenStopped = () => {
      setReceivingScreen(false);
      setRemoteScreenStream(null);
    };
    const onScreenIce = async (data: { candidate: string }) => {
      try { await videoPcRef.current?.addIceCandidate(JSON.parse(data.candidate)); } catch {}
    };

    signalRService.onCallAccepted(onAccepted);
    signalRService.onCallRejected(onRejected);
    signalRService.onCallEnded(onEnded);
    signalRService.onIceCandidate(onIce);
    signalRService.onScreenOfferReceived(onScreenOffer);
    signalRService.onScreenShareAccepted(onScreenAccepted);
    signalRService.onScreenShareStopped(onScreenStopped);
    signalRService.onScreenIceCandidate(onScreenIce);

    return () => {
      clearInterval(timerRef.current ?? 0);
      signalRService.offEvent('CallAccepted',        onAccepted as never);
      signalRService.offEvent('CallRejected',        onRejected);
      signalRService.offEvent('CallEnded',           onEnded);
      signalRService.offEvent('IceCandidate',        onIce as never);
      signalRService.offEvent('ScreenOfferReceived', onScreenOffer as never);
      signalRService.offEvent('ScreenShareAccepted', onScreenAccepted as never);
      signalRService.offEvent('ScreenShareStopped',  onScreenStopped);
      signalRService.offEvent('ScreenIceCandidate',  onScreenIce as never);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatDuration = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const toggleMic = () => { localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = muted; }); setMuted(m => !m); };
  const toggleSpeaker = () => { if (remoteAudioRef.current) remoteAudioRef.current.muted = !speakerOff; setSpeakerOff(s => !s); };

  const resizeStateRef = useRef<{ startY: number; startH: number } | null>(null);
  const resizeXStateRef = useRef<{ startX: number; startW: number } | null>(null);
  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizeStateRef.current) return;
    const next = resizeStateRef.current.startH + (e.clientY - resizeStateRef.current.startY);
    setPanelHeight(Math.max(240, Math.min(next, 720)));
  }, []);
  const handleResizeMoveX = useCallback((e: MouseEvent) => {
    if (!resizeXStateRef.current) return;
    const next = resizeXStateRef.current.startW + (resizeXStateRef.current.startX - e.clientX);
    setPanelWidth(Math.max(360, Math.min(next, 1400)));
  }, []);
  const handleResizeEnd = useCallback(() => {
    resizeStateRef.current = null;
    resizeXStateRef.current = null;
    window.removeEventListener('mousemove', handleResizeMove);
    window.removeEventListener('mousemove', handleResizeMoveX);
    window.removeEventListener('mouseup', handleResizeEnd);
  }, [handleResizeMove, handleResizeMoveX]);
  const startResize = (e: React.MouseEvent) => {
    resizeStateRef.current = { startY: e.clientY, startH: panelHeight };
    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeEnd);
  };
  const startResizeDiag = (e: React.MouseEvent) => {
    resizeStateRef.current = { startY: e.clientY, startH: panelHeight };
    resizeXStateRef.current = { startX: e.clientX, startW: panelWidth };
    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mousemove', handleResizeMoveX);
    window.addEventListener('mouseup', handleResizeEnd);
  };

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mousemove', handleResizeMoveX);
      window.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [handleResizeMove, handleResizeMoveX, handleResizeEnd]);
  const layoutParticipants = useMemo<Participant[]>(() => {
    const list: Participant[] = [];
    const local: Participant = {
      id: 'local',
      name: 'Vous',
      audioLevel: 0,
      isMuted: muted,
      isLive: sharing,
      isSpeaking: false,
      avatarUrl: undefined,
      streams: [],
    };
    if (cameraOn && localCamStream) local.streams.push({ type: 'camera', stream: localCamStream });
    if (sharing && localScreenStream) local.streams.push({ type: 'screen', stream: localScreenStream, screenIndex: 1 });
    list.push(local);

    const remote: Participant = {
      id: peer?.id ?? 'remote',
      name: peer?.name ?? 'Remote',
      audioLevel: 0,
      isMuted: false,
      isLive: receivingScreen,
      isSpeaking: false,
      avatarUrl: peer?.avatarUrl,
      streams: [],
    };
    if (remoteCamStream) remote.streams.push({ type: 'camera', stream: remoteCamStream });
    if (remoteScreenStream) remote.streams.push({ type: 'screen', stream: remoteScreenStream, screenIndex: 1 });
    list.push(remote);
    return list;
  }, [muted, sharing, cameraOn, localCamStream, localScreenStream, receivingScreen, remoteCamStream, remoteScreenStream, peer]);

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
    <>
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      <AnimatePresence>

      {/* ── RINGING — small toast notification (top-right) ── */}
      {callState === 'ringing' && peer && (
        <motion.div
          key="ringing"
          initial={{ opacity: 0, y: -16, x: 16 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: -16, x: 16 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className="fixed top-4 right-4 z-50 bg-white dark:bg-surface-900 rounded-2xl shadow-2xl border border-subtle w-80 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping" />
              <Avatar user={peer} size="md" showStatus={false} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-gray-900 dark:text-gray-100 text-sm truncate">{peer.name}</div>
              <div className="text-xs text-gray-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                Appel entrant…
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={rejectIncoming} title="Refuser"
                className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors shadow">
                <PhoneOff size={16} className="text-white" />
              </button>
              <button onClick={answerCall} title="Accepter"
                className="w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center transition-colors shadow animate-bounce">
                <Phone size={16} className="text-white" />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── CALLING / ACTIVE — compact floating panel (bottom-right) ── */}
      {(callState === 'calling' || callState === 'active') && (
        <motion.div
          key="active"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0, width: panelWidth }}
          exit={{ opacity: 0, y: 32 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          className="fixed top-20 right-5 z-50 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', width: panelWidth, height: panelHeight, maxWidth: 'calc(100vw - 20px)', maxHeight: 'calc(100vh - 140px)' }}
        >
          <VideoLayout
            participants={layoutParticipants}
            mode={layoutMode}
            focusedId={focusedId}
            onTileDoubleClick={handleTileDoubleClick}
            onToggleMute={toggleMic}
            onToggleSpeaker={toggleSpeaker}
            onToggleCamera={toggleCamera}
            onToggleScreen={sharing ? () => cleanupScreenShare(true) : startScreenShare}
            onEndCall={hangUp}
            muted={muted}
            speakerOff={speakerOff}
            cameraOn={cameraOn}
            screenOn={sharing || receivingScreen}
          />
          <div
            onMouseDown={startResize}
            className="h-3 cursor-row-resize flex items-center justify-center bg-black/40 border-t border-white/10"
          >
            <div className="w-10 h-1.5 rounded-full bg-white/20" />
          </div>
          <div
            onMouseDown={startResizeDiag}
            className="absolute top-2 -left-2 w-3 h-24 cursor-ew-resize"
            style={{ touchAction: 'none' }}
          />
          <div
            onMouseDown={startResizeDiag}
            className="absolute -left-2 -bottom-2 w-4 h-4 cursor-nesw-resize"
            style={{ touchAction: 'none' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
};

export default VoiceCallOverlay;
