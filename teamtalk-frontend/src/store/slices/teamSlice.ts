import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import apiClient from '@/services/apiClient';
import type { Team, TeamState, Channel } from '@/types';

// ── Thunks ───────────────────────────────────────────────────
export const fetchTeams = createAsyncThunk('teams/fetchTeams', async () => {
  const { data } = await apiClient.get('/teams');
  return data as Team[];
});

export const fetchTeamChannels = createAsyncThunk(
  'teams/fetchChannels',
  async (teamId: string) => {
    const { data } = await apiClient.get(`/teams/${teamId}/channels`);
    return { teamId, channels: data as Channel[] };
  }
);

export const createTeam = createAsyncThunk(
  'teams/createTeam',
  async (payload: { name: string; description: string; icon?: string; color?: string }) => {
    const { data } = await apiClient.post('/teams', payload);
    return data as Team;
  }
);

export const updateTeam = createAsyncThunk(
  'teams/updateTeam',
  async ({ id, ...payload }: { id: string; name?: string; description?: string; icon?: string; color?: string; ownerId?: string }) => {
    const { data } = await apiClient.put(`/teams/${id}`, payload);
    return data as Team;
  }
);

export const deleteTeam = createAsyncThunk('teams/deleteTeam', async (teamId: string) => {
  await apiClient.delete(`/teams/${teamId}`);
  return teamId;
});

export const createChannel = createAsyncThunk(
  'teams/createChannel',
  async ({ teamId, name, description, isPrivate, isVoice }: { teamId: string; name: string; description: string; isPrivate: boolean; isVoice?: boolean }) => {
    const { data } = await apiClient.post(`/teams/${teamId}/channels`, { name, description, isPrivate, isVoice: isVoice ?? false });
    return data as Channel;
  }
);

// ── Slice ────────────────────────────────────────────────────
const initialState: TeamState & { channels: Channel[] } = {
  teams: [],
  channels: [],
  selectedTeam: null,
  isLoading: false,
  error: null,
};

const teamSlice = createSlice({
  name: 'teams',
  initialState,
  reducers: {
    setSelectedTeam(state, action: PayloadAction<string | null>) { state.selectedTeam = action.payload; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTeams.pending, (state) => { state.isLoading = true; })
      .addCase(fetchTeams.fulfilled, (state, action) => { state.teams = action.payload; state.isLoading = false; })
      .addCase(fetchTeamChannels.fulfilled, (state, action) => {
        const { channels } = action.payload;
        // Merge channels: replace channels for this team, keep others
        const otherChannels = state.channels.filter(c => c.teamId !== action.payload.teamId);
        state.channels = [...otherChannels, ...channels];
      })
      .addCase(createTeam.fulfilled, (state, action) => { state.teams.push(action.payload); })
      .addCase(updateTeam.fulfilled, (state, action) => {
        const idx = state.teams.findIndex(t => t.id === action.payload.id);
        if (idx !== -1) state.teams[idx] = action.payload;
      })
      .addCase(deleteTeam.fulfilled, (state, action) => {
        state.teams = state.teams.filter(t => t.id !== action.payload);
      })
      .addCase(createChannel.fulfilled, (state, action) => {
        state.channels.push(action.payload);
      });
  },
});

export const { setSelectedTeam } = teamSlice.actions;
export default teamSlice.reducer;
