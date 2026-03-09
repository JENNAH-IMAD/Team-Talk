import apiClient from './apiClient';
import type { LoginCredentials, AuthResponse, User } from '@/types';

const AUTH_ENDPOINTS = {
  login: '/auth/login',
  register: '/auth/register',
  refresh: '/auth/refresh',
  logout: '/auth/logout',
  me: '/auth/me',
} as const;

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>(
      AUTH_ENDPOINTS.login,
      credentials
    );
    return data;
  },

  async getCurrentUser(): Promise<User> {
    const { data } = await apiClient.get<User>(AUTH_ENDPOINTS.me);
    return data;
  },

  async logout(): Promise<void> {
    await apiClient.post(AUTH_ENDPOINTS.logout);
  },

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>(
      AUTH_ENDPOINTS.refresh,
      { refreshToken }
    );
    return data;
  },
};
