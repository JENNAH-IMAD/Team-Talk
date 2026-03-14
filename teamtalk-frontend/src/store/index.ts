import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import chatReducer from './slices/chatSlice';
import teamReducer from './slices/teamSlice';
import notificationReducer from './slices/notificationSlice';
import activeVoiceReducer from './slices/activeVoiceSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    chat: chatReducer,
    teams: teamReducer,
    notifications: notificationReducer,
    activeVoice: activeVoiceReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['auth/login/fulfilled'],
      },
    }),
  devTools: import.meta.env.DEV,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
