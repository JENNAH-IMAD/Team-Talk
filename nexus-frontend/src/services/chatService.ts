import apiClient from './apiClient';
import type { Message, PaginatedResponse } from '@/types';

const CHAT_ENDPOINTS = {
  messages: (channelId: string) => `/channels/${channelId}/messages`,
  message: (channelId: string, messageId: string) =>
    `/channels/${channelId}/messages/${messageId}`,
} as const;

export const chatService = {
  async getMessages(
    channelId: string,
    page = 1,
    pageSize = 50
  ): Promise<PaginatedResponse<Message>> {
    const { data } = await apiClient.get<PaginatedResponse<Message>>(
      CHAT_ENDPOINTS.messages(channelId),
      { params: { page, pageSize } }
    );
    return data;
  },

  async sendMessage(
    channelId: string,
    content: string,
    parentId?: string
  ): Promise<Message> {
    const { data } = await apiClient.post<Message>(
      CHAT_ENDPOINTS.messages(channelId),
      { content, parentId }
    );
    return data;
  },

  async editMessage(
    channelId: string,
    messageId: string,
    content: string
  ): Promise<Message> {
    const { data } = await apiClient.put<Message>(
      CHAT_ENDPOINTS.message(channelId, messageId),
      { content }
    );
    return data;
  },

  async deleteMessage(channelId: string, messageId: string): Promise<void> {
    await apiClient.delete(CHAT_ENDPOINTS.message(channelId, messageId));
  },

  async addReaction(
    channelId: string,
    messageId: string,
    emoji: string
  ): Promise<void> {
    await apiClient.post(
      `${CHAT_ENDPOINTS.message(channelId, messageId)}/reactions`,
      { emoji }
    );
  },
};
