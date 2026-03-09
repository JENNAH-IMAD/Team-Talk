import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import apiClient from '@/services/apiClient';
import type { Notification, NotificationState } from '@/types';

export const fetchNotifications = createAsyncThunk('notifications/fetch', async () => {
  const { data } = await apiClient.get('/notifications');
  return data as Notification[];
});

export const markAsReadApi = createAsyncThunk('notifications/markAsRead', async (id: string) => {
  await apiClient.put(`/notifications/${id}/read`);
  return id;
});

export const markAllAsReadApi = createAsyncThunk('notifications/markAllAsRead', async () => {
  await apiClient.put('/notifications/read-all');
});

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  isLoading: false,
};

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    addNotification(state, action: PayloadAction<Notification>) {
      state.notifications.unshift(action.payload);
      if (!action.payload.read) state.unreadCount++;
    },
    markAsRead(state, action: PayloadAction<string>) {
      const n = state.notifications.find(x => x.id === action.payload);
      if (n && !n.read) { n.read = true; state.unreadCount = Math.max(0, state.unreadCount - 1); }
    },
    markAllAsRead(state) {
      state.notifications.forEach(n => (n.read = true));
      state.unreadCount = 0;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => { state.isLoading = true; })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.notifications = action.payload;
        state.unreadCount = action.payload.filter(n => !n.read).length;
        state.isLoading = false;
      })
      .addCase(markAsReadApi.fulfilled, (state, action) => {
        const n = state.notifications.find(x => x.id === action.payload);
        if (n && !n.read) { n.read = true; state.unreadCount = Math.max(0, state.unreadCount - 1); }
      })
      .addCase(markAllAsReadApi.fulfilled, (state) => {
        state.notifications.forEach(n => (n.read = true));
        state.unreadCount = 0;
      });
  },
});

export const { addNotification, markAsRead, markAllAsRead } = notificationSlice.actions;
export default notificationSlice.reducer;
