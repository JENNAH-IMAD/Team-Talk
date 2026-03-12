import apiClient from './apiClient';
import type { Team, CreateTeamPayload, UpdateTeamPayload, Channel } from '@/types';

export const teamService = {
  async getTeams(): Promise<Team[]> {
    const { data } = await apiClient.get<Team[]>('/teams');
    return data;
  },

  async getTeam(id: string): Promise<Team> {
    const { data } = await apiClient.get<Team>(`/teams/${id}`);
    return data;
  },

  async createTeam(payload: CreateTeamPayload): Promise<Team> {
    const { data } = await apiClient.post<Team>('/teams', payload);
    return data;
  },

  async updateTeam(payload: UpdateTeamPayload): Promise<Team> {
    const { data } = await apiClient.put<Team>(`/teams/${payload.id}`, payload);
    return data;
  },

  async deleteTeam(id: string): Promise<void> {
    await apiClient.delete(`/teams/${id}`);
  },

  async addMember(teamId: string, userId: string): Promise<void> {
    await apiClient.post(`/teams/${teamId}/members`, { userId });
  },

  async removeMember(teamId: string, userId: string): Promise<void> {
    await apiClient.delete(`/teams/${teamId}/members/${userId}`);
  },

  async getChannels(teamId: string): Promise<Channel[]> {
    const { data } = await apiClient.get<Channel[]>(`/teams/${teamId}/channels`);
    return data;
  },

  async createChannel(
    teamId: string,
    payload: { name: string; description: string; isPrivate: boolean }
  ): Promise<Channel> {
    const { data } = await apiClient.post<Channel>(
      `/teams/${teamId}/channels`,
      payload
    );
    return data;
  },
};
