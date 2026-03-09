import * as signalR from '@microsoft/signalr';
import { storage } from '@/utils';
import type { Message, TypingEvent } from '@/types';

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
    this.connection.onreconnected(() => console.log('[SignalR] Reconnected'));
    this.connection.onclose(() => console.log('[SignalR] Connection closed'));

    this.startPromise = this.connection
      .start()
      .then(() => console.log('[SignalR] Connected'))
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

  // Remove a specific callback from an event (for cleanup in components)
  offEvent(event: string, callback: (...args: unknown[]) => void): void {
    this.connection?.off(event, callback as never);
  }

  offAll(): void {
    if (!this.connection) return;
    ['ReceiveMessage', 'MessageEdited', 'MessageDeleted', 'UserTyping', 'UserStatusChanged', 'ReceiveNotification', 'DmReceived', 'MessageReacted']
      .forEach(e => this.connection!.off(e));
  }
}

export const signalRService = new SignalRService();
