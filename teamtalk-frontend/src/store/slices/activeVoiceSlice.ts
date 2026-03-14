import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ActiveVoiceState {
  type: 'channel' | 'private' | 'group' | null;
  id: string | null;
  name: string | null;
  joinedAt: number | null;
}

const initialState: ActiveVoiceState = {
  type: null,
  id: null,
  name: null,
  joinedAt: null,
};

const activeVoiceSlice = createSlice({
  name: 'activeVoice',
  initialState,
  reducers: {
    setActiveSession(
      state,
      action: PayloadAction<{ type: 'channel' | 'private' | 'group'; id: string; name?: string | null }>
    ) {
      state.type = action.payload.type;
      state.id = action.payload.id;
      state.name = action.payload.name ?? null;
      state.joinedAt = Date.now();
    },
    clearActiveSession(state) {
      state.type = null;
      state.id = null;
      state.name = null;
      state.joinedAt = null;
    },
  },
});

export const { setActiveSession, clearActiveSession } = activeVoiceSlice.actions;
export default activeVoiceSlice.reducer;
