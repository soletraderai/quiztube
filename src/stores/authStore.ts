import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  tier: 'FREE' | 'PRO';
  onboardingCompleted: boolean;
  avatarUrl?: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setUser: (user: AuthUser | null) => void;
  setAccessToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

const API_BASE = 'http://localhost:3001/api';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isLoading: false,
      error: null,

      setUser: (user) => set({ user }),
      setAccessToken: (token) => set({ accessToken: token }),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),

      logout: () => {
        set({ user: null, accessToken: null, error: null });
      },

      isAuthenticated: () => {
        const { user, accessToken } = get();
        return !!(user && accessToken);
      },
    }),
    {
      name: 'teachy-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken
      }),
    }
  )
);

// API helper functions
export const authApi = {
  async login(email: string, password: string) {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }

    return data;
  },

  async signup(email: string, password: string, displayName: string) {
    const response = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password, displayName }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Signup failed');
    }

    return data;
  },

  async logout() {
    const { accessToken } = useAuthStore.getState();

    const response = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || 'Logout failed');
    }

    return response.json();
  },

  async refreshToken() {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Token refresh failed');
    }

    return data;
  },

  async forgotPassword(email: string) {
    const response = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Password reset request failed');
    }

    return data;
  },

  async resetPassword(token: string, newPassword: string) {
    const response = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Password reset failed');
    }

    return data;
  },

  async verifyEmail(token: string) {
    const response = await fetch(`${API_BASE}/auth/verify-email/${token}`);

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Email verification failed');
    }

    return data;
  },

  async getMe() {
    const { accessToken } = useAuthStore.getState();

    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to get user info');
    }

    return data;
  },
};
