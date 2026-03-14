import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import apiClient from '@/services/apiClient';
import type { Message, ChatState, PendingAttachment } from '@/types';

// ── Thunks ───────────────────────────────────────────────────
export const fetchMessages = createAsyncThunk(
  'chat/fetchMessages',
  async ({ channelId, page = 1 }: { channelId: string; page?: number }) => {
    const { data } = await apiClient.get(`/channels/${channelId}/messages`, { params: { page, pageSize: 50 } });
    return { channelId, messages: data.data as Message[], hasMore: data.hasMore as boolean };
  }
);

export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async ({ channelId, content, parentId, attachments }: {
    channelId: string;
    content: string;
    parentId?: string;
    attachments?: PendingAttachment[];
  }) => {
    const payload: Record<string, unknown> = { content, parentId };
    if (attachments && attachments.length > 0) {
      payload.attachments = attachments.map(a => ({
        filePath: a.filePath,
        fileName: a.fileName,
        contentType: a.contentType,
        fileSize: a.fileSize,
      }));
    }
    const { data } = await apiClient.post(`/channels/${channelId}/messages`, payload);
    return data as Message;
  }
);

export const editMessage = createAsyncThunk(
  'chat/editMessage',
  async ({ channelId, messageId, content }: { channelId: string; messageId: string; content: string }) => {
    const { data } = await apiClient.put(`/channels/${channelId}/messages/${messageId}`, { content });
    return { channelId, message: data as Message };
  }
);

export const deleteMessage = createAsyncThunk(
  'chat/deleteMessage',
  async ({ channelId, messageId }: { channelId: string; messageId: string }) => {
    await apiClient.delete(`/channels/${channelId}/messages/${messageId}`);
    return { channelId, messageId };
  }
);

// ── Slice ────────────────────────────────────────────────────
const initialState: ChatState = {
  messages: {},
  activeChannel: null,
  typingUsers: {},
  isLoading: false,
  hasMore: {},
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setActiveChannel(state, action: PayloadAction<string | null>) { state.activeChannel = action.payload; },
    addMessage(state, action: PayloadAction<Message>) {
      const { channelId } = action.payload;
      if (!state.messages[channelId]) state.messages[channelId] = [];
      // Avoid duplicates
      if (!state.messages[channelId].find(m => m.id === action.payload.id)) {
        state.messages[channelId].push(action.payload);
      }
    },
    updateMessage(state, action: PayloadAction<Message>) {
      const { channelId } = action.payload;
      const idx = state.messages[channelId]?.findIndex(m => m.id === action.payload.id);
      if (idx !== undefined && idx !== -1) state.messages[channelId][idx] = action.payload;
    },
    updateReactions(state, action: PayloadAction<{ id: string; channelId: string; reactions: { emoji: string; users: string[] }[] }>) {
      const { channelId, id, reactions } = action.payload;
      const idx = state.messages[channelId]?.findIndex(m => m.id === id);
      if (idx !== undefined && idx !== -1) state.messages[channelId][idx].reactions = reactions;
    },
    removeMessage(state, action: PayloadAction<{ messageId: string; channelId: string }>) {
      const { channelId, messageId } = action.payload;
      if (state.messages[channelId])
        state.messages[channelId] = state.messages[channelId].filter(m => m.id !== messageId);
    },
    setTyping(state, action: PayloadAction<{ channelId: string; userId: string; isTyping: boolean }>) {
      const { channelId, userId, isTyping } = action.payload;
      if (!state.typingUsers[channelId]) state.typingUsers[channelId] = [];
      if (isTyping && !state.typingUsers[channelId].includes(userId)) {
        state.typingUsers[channelId].push(userId);
      } else if (!isTyping) {
        state.typingUsers[channelId] = state.typingUsers[channelId].filter(id => id !== userId);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMessages.pending, (state) => { state.isLoading = true; })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        const { channelId, messages, hasMore } = action.payload;
        state.messages[channelId] = messages;
        state.hasMore[channelId] = hasMore;
        state.isLoading = false;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        const msg = action.payload;
        if (!state.messages[msg.channelId]) state.messages[msg.channelId] = [];
        if (!state.messages[msg.channelId].find(m => m.id === msg.id)) {
          state.messages[msg.channelId].push(msg);
        }
      })
      .addCase(editMessage.fulfilled, (state, action) => {
        const { channelId, message } = action.payload;
        const idx = state.messages[channelId]?.findIndex(m => m.id === message.id);
        if (idx !== undefined && idx !== -1) state.messages[channelId][idx] = message;
      })
      .addCase(deleteMessage.fulfilled, (state, action) => {
        const { channelId, messageId } = action.payload;
        if (state.messages[channelId]) {
          state.messages[channelId] = state.messages[channelId].filter(m => m.id !== messageId);
        }
      });
  },
});

export const { setActiveChannel, addMessage, updateMessage, removeMessage, setTyping, updateReactions } = chatSlice.actions;
export default chatSlice.reducer;
