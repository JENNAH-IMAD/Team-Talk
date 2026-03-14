import * as signalR from '@microsoft/signalr';
import { useState, useEffect } from 'react';
import { storage } from '@/utils';
import type { Message, TypingEvent } from '@/types';

// ── Connection version tracking ────────────────────────────
// Incremented each time SignalR connects or reconnects.
// Components include `useSignalRVersion()` in their effect deps
// so handlers are re-registered on every (re)connect.
let _connVersion = 0;
const _connListeners = new Set<() => void>();
function _notifyConnected() {
  _connVersion++;
  _connListeners.forEach(fn => fn());
}
export function useSignalRVersion(): number {
  const [version, setVersion] = useState(_connVersion);
  useEffect(() => {
    const listener = () => setVersion(v => v + 1);
    _connListeners.add(listener);
    return () => { _connListeners.delete(listener); };
  }, []);
  return version;
}

const HUB_URL = import.meta.env.VITE_SIGNALR_URL || 'http://localhost:5001/hubs/chat';

class SignalRService {
  private connection: signalR.HubConnection | null = null;
  // Shared promise while connecting — callers can await it
  private startPromise: Promise<void> | null = null;

  isConnected(): boolean {
    return this.connection?.state === signalR.HubConnectionState.Connected;
  }

  async start(): Promise<void> {
    // Already connected or reconnecting — nothing to do
    if (
      this.connection?.state === signalR.HubConnectionState.Connected ||
      this.connection?.state === signalR.HubConnectionState.Reconnecting
    ) return;

    // Already in the middle of connecting — return the same promise so all callers await it
    if (this.startPromise) return this.startPromise;

    const token = storage.getToken();
    if (!token) return;

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, { accessTokenFactory: () => token })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.connection.onreconnecting(() => console.log('[SignalR] Reconnecting...'));
    this.connection.onreconnected(() => { _notifyConnected(); console.log('[SignalR] Reconnected'); });
    this.connection.onclose(() => console.log('[SignalR] Connection closed'));

    this.startPromise = this.connection
      .start()
      .then(() => { _notifyConnected(); console.log('[SignalR] Connected'); })
      .catch(() => { /* silently ignore — React Strict Mode stop-during-negotiation */ })
      .finally(() => { this.startPromise = null; });

    return this.startPromise;
  }

  async stop(): Promise<void> {
    this.startPromise = null;
    if (this.connection) { await this.connection.stop(); this.connection = null; }
  }

  // Wait for the connection to be ready, then join the channel group
  async joinChannel(channelId: string): Promise<void> {
    if (this.startPromise) await this.startPromise;
    if (this.connection?.state === signalR.HubConnectionState.Connected)
      await this.connection.invoke('JoinChannel', channelId);
  }

  async leaveChannel(channelId: string): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected)
      await this.connection.invoke('LeaveChannel', channelId);
  }

  async sendMessage(channelId: string, content: string): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected)
      await this.connection.invoke('SendMessage', channelId, content);
  }

  async sendTyping(channelId: string, isTyping: boolean): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected)
      await this.connection.invoke('SendTyping', channelId, isTyping);
  }

  onMessageReceived(callback: (message: Message) => void): void {
    this.connection?.on('ReceiveMessage', callback);
  }
  onMessageEdited(callback: (message: Message) => void): void {
    this.connection?.on('MessageEdited', callback);
  }
  onMessageDeleted(callback: (messageId: string, channelId: string) => void): void {
    this.connection?.on('MessageDeleted', callback);
  }
  onTyping(callback: (event: TypingEvent) => void): void {
    this.connection?.on('UserTyping', callback);
  }
  onUserStatusChanged(callback: (userId: string, status: string) => void): void {
    this.connection?.on('UserStatusChanged', callback);
  }
  onNotification(callback: (notification: unknown) => void): void {
    this.connection?.on('ReceiveNotification', callback);
  }
  onDmReceived(callback: (message: Message) => void): void {
    this.connection?.on('DmReceived', callback);
  }
  onMessageReacted(callback: (data: { id: string; channelId: string; reactions: { emoji: string; users: string[] }[] }) => void): void {
    this.connection?.on('MessageReacted', callback);
  }

  // ── Voice channels ────────────────────────────────────────
  async joinVoiceChannel(channelId: string): Promise<void> {
    if (this.startPromise) await this.startPromise;
    if (this.connection?.state === signalR.HubConnectionState.Connected)
      await this.connection.invoke('JoinVoiceChannel', channelId);
  }

  async leaveVoiceChannel(channelId: string): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected)
      await this.connection.invoke('LeaveVoiceChannel', channelId);
  }

  // ── Voice calls (WebRTC signaling) ────────────────────────
  async callUser(targetUserId: string, offer: string): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected)
      await this.connection.invoke('CallUser', targetUserId, offer);
  }

  async acceptCall(callerId: string, answer: string): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected)
      await this.connection.invoke('AcceptCall', callerId, answer);
  }

  async rejectCall(callerId: string): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected)
      await this.connection.invoke('RejectCall', callerId);
  }

  async endCall(targetUserId: string): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected)
      await this.connection.invoke('EndCall', targetUserId);
  }

  async sendIceCandidate(targetUserId: string, candidate: string): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected)
      await this.connection.invoke('SendIceCandidate', targetUserId, candidate);
  }

  // ── Event listeners for calls ─────────────────────────────
  onIncomingCall(callback: (data: { callerId: string; offer: string }) => void): void {
    this.connection?.on('IncomingCall', callback);
  }
  onCallAccepted(callback: (data: { answer: string }) => void): void {
    this.connection?.on('CallAccepted', callback);
  }
  onCallRejected(callback: (data: { userId: string }) => void): void {
    this.connection?.on('CallRejected', callback);
  }
  onCallEnded(callback: () => void): void {
    this.connection?.on('CallEnded', callback);
  }
  onIceCandidate(callback: (data: { candidate: string }) => void): void {
    this.connection?.on('IceCandidate', callback);
  }

  // ── Voice channel presence ────────────────────────────────
  // Bug 2: call off before on — prevents duplicate listeners when component re-registers on reconnect
  onUserJoinedVoice(callback: (data: { channelId: string; userId: string }) => void): void {
    this.connection?.off('UserJoinedVoice', callback as never);
    this.connection?.on('UserJoinedVoice', callback);
  }
  onUserLeftVoice(callback: (data: { channelId: string; userId: string }) => void): void {
    this.connection?.off('UserLeftVoice', callback as never);
    this.connection?.on('UserLeftVoice', callback);
  }
  onVoiceParticipants(callback: (data: { channelId: string; userIds: string[] }) => void): void {
    this.connection?.off('VoiceParticipants', callback as never);
    this.connection?.on('VoiceParticipants', callback);
  }
  // Bug 6: participant state sync — mute, camera, quality changes
  async updateParticipantState(channelId: string, state: Record<string, unknown>): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected)
      await this.connection.invoke('UpdateParticipantState', channelId, state);
  }
  onParticipantStateChanged(callback: (data: { channelId: string; userId: string; state: Record<string, unknown> }) => void): void {
    this.connection?.off('ParticipantStateChanged', callback as never);
    this.connection?.on('ParticipantStateChanged', callback);
  }

  // ── Screen sharing (WebRTC signaling) ────────────────────
  async sendScreenOffer(targetUserId: string, offer: string): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected)
      await this.connection.invoke('SendScreenOffer', targetUserId, offer);
  }

  async acceptScreenShare(senderId: string, answer: string): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected)
      await this.connection.invoke('AcceptScreenShare', senderId, answer);
  }

  async stopScreenShare(targetUserId: string): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected)
      await this.connection.invoke('StopScreenShare', targetUserId);
  }

  async sendScreenIce(targetUserId: string, candidate: string): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected)
      await this.connection.invoke('SendScreenIce', targetUserId, candidate);
  }

  onScreenOfferReceived(cb: (data: { senderId: string; offer: string }) => void): void {
    this.connection?.on('ScreenOfferReceived', cb);
  }
  onScreenShareAccepted(cb: (data: { answer: string }) => void): void {
    this.connection?.on('ScreenShareAccepted', cb);
  }
  onScreenShareStopped(cb: () => void): void {
    this.connection?.on('ScreenShareStopped', cb);
  }
  onScreenIceCandidate(cb: (data: { candidate: string }) => void): void {
    this.connection?.on('ScreenIceCandidate', cb);
  }

  // ── Group Voice WebRTC Signaling ──────────────────────────
  async sendGroupVoiceOffer(channelId: string, targetUserId: string, offer: string): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected)
      await this.connection.invoke('SendGroupVoiceOffer', channelId, targetUserId, offer);
  }
  async sendGroupVoiceAnswer(channelId: string, targetUserId: string, answer: string): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected)
      await this.connection.invoke('SendGroupVoiceAnswer', channelId, targetUserId, answer);
  }
  async sendGroupVoiceIce(channelId: string, targetUserId: string, candidate: string): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected)
      await this.connection.invoke('SendGroupVoiceIce', channelId, targetUserId, candidate);
  }
  onGroupVoiceOffer(cb: (data: { channelId: string; senderId: string; offer: string }) => void): void {
    this.connection?.on('GroupVoiceOffer', cb);
  }
  onGroupVoiceAnswer(cb: (data: { channelId: string; senderId: string; answer: string }) => void): void {
    this.connection?.on('GroupVoiceAnswer', cb);
  }
  onGroupVoiceIce(cb: (data: { channelId: string; senderId: string; candidate: string }) => void): void {
    this.connection?.on('GroupVoiceIce', cb);
  }

  // ── Call event notifications (channel broadcast) ─────────
  async sendCallEvent(channelId: string, type: string, text: string): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected)
      await this.connection.invoke('SendCallEvent', channelId, type, text);
  }
  onCallEvent(cb: (data: { channelId: string; type: string; text: string }) => void): void {
    this.connection?.on('CallEventReceived', cb);
  }

  // Remove a specific callback from an event (for cleanup in components)
  offEvent(event: string, callback: (...args: unknown[]) => void): void {
    this.connection?.off(event, callback as never);
  }

  offAll(): void {
    if (!this.connection) return;
    // Clear only events exclusively owned by useSignalR.
    // DmReceived is excluded — DMConversation/GroupConversation register their own handlers
    // and manage cleanup via offEvent(). Clearing it here would wipe those component handlers.
    [
      'ReceiveMessage', 'MessageEdited', 'MessageDeleted', 'UserTyping', 'UserStatusChanged',
      'ReceiveNotification', 'MessageReacted',
    ].forEach(e => this.connection!.off(e));
  }

  offAllVoice(): void {
    if (!this.connection) return;
    [
      'IncomingCall', 'CallAccepted', 'CallRejected', 'CallEnded', 'IceCandidate',
      'UserJoinedVoice', 'UserLeftVoice', 'VoiceParticipants', 'ParticipantStateChanged',
      'ScreenOfferReceived', 'ScreenShareAccepted', 'ScreenShareStopped', 'ScreenIceCandidate',
      'CallEventReceived',
      'GroupVoiceOffer', 'GroupVoiceAnswer', 'GroupVoiceIce',
    ].forEach(e => this.connection!.off(e));
  }
}

export const signalRService = new SignalRService();
