// ============================================================
// Application Configuration
// ============================================================

export const APP_CONFIG = {
  name: 'Nexus',
  description: 'Enterprise Collaboration Platform',
  version: '1.0.0',

  api: {
    baseUrl: import.meta.env.VITE_API_URL || '/api',
    timeout: 15_000,
  },

  signalR: {
    hubUrl: '/hubs/chat',
    reconnectAttempts: 10,
  },

  auth: {
    tokenKey: 'nexus_token',
    refreshTokenKey: 'nexus_refresh_token',
  },

  pagination: {
    defaultPageSize: 50,
    messagesPageSize: 50,
  },

  theme: {
    storageKey: 'nexus_theme',
    default: 'dark' as const,
  },
} as const;
