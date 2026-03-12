import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import apiClient from '@/services/apiClient';
import { storage } from '@/utils';
import type { AuthState, LoginCredentials, User } from '@/types';

export interface RegisterCredentials {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  title?: string;
}

// ── Thunks ───────────────────────────────────────────────────
export const loginUser = createAsyncThunk(
  'auth/login',
  async (credentials: LoginCredentials, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.post('/auth/login', credentials);
      storage.setToken(data.token);
      storage.setRefreshToken(data.refreshToken);
      return { user: data.user, token: data.token, refreshToken: data.refreshToken, expiresAt: data.expiresAt };
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      return rejectWithValue(error.response?.data?.message || 'Login failed');
    }
  }
);

export const registerUser = createAsyncThunk(
  'auth/register',
  async (credentials: RegisterCredentials, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.post('/auth/register', credentials);
      storage.setToken(data.token);
      storage.setRefreshToken(data.refreshToken);
      return { user: data.user, token: data.token, refreshToken: data.refreshToken };
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      return rejectWithValue(error.response?.data?.message || 'Registration failed');
    }
  }
);

export const logoutUser = createAsyncThunk('auth/logout', async () => {
  try {
    await apiClient.post('/auth/logout');
  } finally {
    storage.clearAuth();
  }
});

export const updateUserStatus = createAsyncThunk(
  'auth/updateStatus',
  async (status: string) => {
    await apiClient.put('/users/status', { status });
    return status;
  }
);

export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (data: { firstName: string; lastName: string; title?: string; bio?: string }, { rejectWithValue }) => {
    try {
      const { data: user } = await apiClient.put('/users/me/profile', data);
      return user as User;
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      return rejectWithValue(error.response?.data?.message || 'Update failed');
    }
  }
);

export const updateAvatar = createAsyncThunk(
  'auth/updateAvatar',
  async (file: File, { rejectWithValue }) => {
    try {
      const form = new FormData();
      form.append('file', file);
      // Clear the default 'application/json' so axios sets multipart/form-data with boundary
      const { data: user } = await apiClient.post('/users/me/avatar', form, {
        headers: { 'Content-Type': undefined },
      });
      return user as User;
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      return rejectWithValue(error.response?.data?.message || 'Upload failed');
    }
  }
);

export const fetchCurrentUser = createAsyncThunk(
  'auth/fetchCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.get('/auth/me');
      return data as User;
    } catch {
      storage.clearAuth();
      return rejectWithValue('Session expired');
    }
  }
);

// ── Slice ────────────────────────────────────────────────────
const initialState: AuthState = {
  user: null,
  token: storage.getToken(),
  refreshToken: storage.getRefreshToken(),
  isAuthenticated: !!storage.getToken(),
  isLoading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError(state) { state.error = null; },
    setUser(state, action: PayloadAction<User>) { state.user = action.payload; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.refreshToken = action.payload.refreshToken;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(registerUser.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.refreshToken = action.payload.refreshToken;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null; state.token = null; state.refreshToken = null; state.isAuthenticated = false;
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.user = action.payload; state.isAuthenticated = true;
      })
      .addCase(fetchCurrentUser.rejected, (state) => {
        state.user = null; state.token = null; state.isAuthenticated = false;
      })
      .addCase(updateUserStatus.fulfilled, (state, action) => {
        if (state.user) (state.user as any).status = action.payload;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.user = action.payload;
      })
      .addCase(updateAvatar.fulfilled, (state, action) => {
        state.user = action.payload;
      });
  },
});

export const { clearError, setUser } = authSlice.actions;
export default authSlice.reducer;
