// ============================================================
// Core Entity Types
// ============================================================

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  secondaryRole?: UserRole;
  roles?: UserRole[];
  avatarUrl?: string;
  status: UserStatus;
  firstName?: string;
  lastName?: string;
  title: string;
  bio?: string;
  createdAt: string;
  lastActiveAt?: string;
}

export type UserRole = 'admin' | 'director' | 'manager' | 'employee';
export type UserStatus = 'online' | 'away' | 'donotdisturb' | 'offline';

export interface Team {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  ownerId: string;
  members: string[];
  createdAt: string;
}

export interface Channel {
  id: string;
  name: string;
  teamId: string;
  description: string;
  isPrivate: boolean;
  isVoice?: boolean;
  isGroup?: boolean;
  groupName?: string;
  pinnedCount: number;
  createdAt: string;
  lastMessageAt?: string;
}

export interface Message {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: number;
  reactions?: Reaction[];
  edited?: boolean;
  isEdited?: boolean;
  threadCount?: number;
  parentId?: string;
  attachments?: Attachment[];
}

export interface Reaction {
  emoji: string;
  users: string[];
}

export interface Attachment {
  id: string;
  fileName: string;
  contentType: string;
  url: string;
  fileSize: number;
}

export interface PendingAttachment {
  filePath: string;   // uuid.ext — the saved server filename
  fileName: string;   // original display name
  contentType: string;
  fileSize: number;
  previewUrl?: string; // object URL for local image preview
}

export interface Notification {
  id: string;
  type: NotificationType;
  content: string;
  timestamp: number;
  read: boolean;
  channelId?: string;
  userId?: string;
}

export type NotificationType =
  | 'newmessage'
  | 'mention'
  | 'teaminvitation'
  | 'reply'
  | 'reaction'
  | 'team'
  | 'system';

// ============================================================
// Auth Types
// ============================================================

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
  expiresAt: number;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// ============================================================
// Chat Types
// ============================================================

export interface ChatState {
  messages: Record<string, Message[]>;
  activeChannel: string | null;
  typingUsers: Record<string, string[]>;
  isLoading: boolean;
  hasMore: Record<string, boolean>;
}

export interface TypingEvent {
  channelId: string;
  userId: string;
  isTyping: boolean;
}

// ============================================================
// Team Types
// ============================================================

export interface TeamState {
  teams: Team[];
  selectedTeam: string | null;
  isLoading: boolean;
  error: string | null;
}

export interface CreateTeamPayload {
  name: string;
  description: string;
  icon?: string;
  color?: string;
}

export interface UpdateTeamPayload extends Partial<CreateTeamPayload> {
  id: string;
}

// ============================================================
// Notification Types
// ============================================================

export interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
}

// ============================================================
// API Types
// ============================================================

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ApiError {
  message: string;
  statusCode: number;
  errors?: Record<string, string[]>;
}
