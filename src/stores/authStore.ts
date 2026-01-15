import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, supabaseAuth, isSupabaseConfigured } from '../lib/supabase';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';

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
  supabaseSession: Session | null;

  // Actions
  setUser: (user: AuthUser | null) => void;
  setAccessToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSupabaseSession: (session: Session | null) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
  initializeAuth: () => Promise<void>;
}

const API_BASE = 'http://localhost:3001/api';

// Convert Supabase user to our AuthUser format
const supabaseUserToAuthUser = (
  supabaseUser: SupabaseUser,
  backendUser?: any
): AuthUser => {
  return {
    id: backendUser?.id || supabaseUser.id,
    email: supabaseUser.email || '',
    displayName:
      backendUser?.displayName ||
      supabaseUser.user_metadata?.display_name ||
      supabaseUser.user_metadata?.full_name ||
      supabaseUser.email?.split('@')[0] ||
      'User',
    emailVerified: !!supabaseUser.email_confirmed_at,
    tier: backendUser?.tier || 'FREE',
    onboardingCompleted: backendUser?.onboardingCompleted || false,
    avatarUrl: backendUser?.avatarUrl || supabaseUser.user_metadata?.avatar_url,
  };
};

// Convert backend /auth/me response to AuthUser format
export const backendUserToAuthUser = (backendUser: any): AuthUser => ({
  id: backendUser.id,
  email: backendUser.email,
  displayName: backendUser.displayName,
  emailVerified: backendUser.emailVerified ?? false,
  tier: backendUser.tier || 'FREE',
  onboardingCompleted: backendUser.onboardingCompleted ?? false,
  avatarUrl: backendUser.avatarUrl,
});

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isLoading: false,
      error: null,
      supabaseSession: null,

      setUser: (user) => set({ user }),
      setAccessToken: (token) => set({ accessToken: token }),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      setSupabaseSession: (session) => set({ supabaseSession: session }),

      logout: async () => {
        try {
          if (isSupabaseConfigured()) {
            await supabaseAuth.signOut();
          }
        } catch (error) {
          console.error('Logout error:', error);
        }

        // Clear auth state
        set({ user: null, accessToken: null, error: null, supabaseSession: null });

        // Clear session store to prevent data leakage between users
        // Using dynamic import to avoid circular dependency
        try {
          const { useSessionStore } = await import('./sessionStore');
          useSessionStore.getState().clearLibrary();
        } catch (err) {
          console.warn('Failed to clear session library:', err);
        }
      },

      isAuthenticated: () => {
        const { user, accessToken } = get();
        return !!(user && accessToken);
      },

      // Initialize auth state from Supabase session
      initializeAuth: async () => {
        if (!isSupabaseConfigured()) {
          console.log('Supabase not configured, skipping auth initialization');
          return;
        }

        set({ isLoading: true });

        try {
          const session = await supabaseAuth.getSession();

          if (session?.user) {
            set({
              supabaseSession: session,
              accessToken: session.access_token,
            });

            // Fetch user profile from backend
            try {
              const backendUser = await authApi.getMe();
              set({
                user: supabaseUserToAuthUser(session.user, backendUser),
              });
            } catch (backendError) {
              console.warn('Backend user fetch failed, using Supabase data only:', backendError);
              // Backend might not have user yet, use Supabase data
              set({
                user: supabaseUserToAuthUser(session.user),
              });
            }
          } else {
            // No active session
            set({
              user: null,
              accessToken: null,
              supabaseSession: null,
            });
          }
        } catch (error) {
          console.error('Failed to initialize auth:', error);
          // Clear potentially stale state
          set({
            user: null,
            accessToken: null,
            supabaseSession: null,
          });
          throw error; // Re-throw so caller knows init failed
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'teachy-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
      }),
    }
  )
);

// Set up Supabase auth state listener
if (isSupabaseConfigured()) {
  supabase.auth.onAuthStateChange(async (event, session) => {
    const store = useAuthStore.getState();

    // Handle INITIAL_SESSION (page load with persisted session) and SIGNED_IN
    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
      store.setSupabaseSession(session);
      store.setAccessToken(session.access_token);

      // Fetch user from backend to get fresh tier data
      try {
        const backendUser = await authApi.getMe();
        store.setUser(supabaseUserToAuthUser(session.user, backendUser));
      } catch (error) {
        console.warn('Failed to fetch user from backend:', error);
        store.setUser(supabaseUserToAuthUser(session.user));
      }

      // Sync session data from cloud after authentication
      // Import dynamically to avoid circular dependency
      import('./sessionStore').then(({ useSessionStore }) => {
        useSessionStore.getState().syncWithCloud();
      }).catch(err => {
        console.warn('Failed to sync sessions from cloud:', err);
      });
    } else if (event === 'SIGNED_OUT') {
      store.setUser(null);
      store.setAccessToken(null);
      store.setSupabaseSession(null);
    } else if (event === 'TOKEN_REFRESHED' && session) {
      store.setSupabaseSession(session);
      store.setAccessToken(session.access_token);

      // Also refresh user data on token refresh to keep tier in sync
      try {
        const backendUser = await authApi.getMe();
        store.setUser(supabaseUserToAuthUser(session.user, backendUser));
      } catch {
        // Keep existing user data if refresh fails
      }
    }
  });
}

// API helper functions
export const authApi = {
  // Sign in with email and password (Supabase or legacy)
  async login(email: string, password: string) {
    if (isSupabaseConfigured()) {
      const { session, user } = await supabaseAuth.signIn(email, password);

      if (!session || !user) {
        throw new Error('Login failed');
      }

      // Fetch user profile from backend
      const store = useAuthStore.getState();
      store.setAccessToken(session.access_token);

      try {
        const backendUser = await authApi.getMe();
        return {
          user: supabaseUserToAuthUser(user, backendUser),
          accessToken: session.access_token,
        };
      } catch {
        return {
          user: supabaseUserToAuthUser(user),
          accessToken: session.access_token,
        };
      }
    }

    // Legacy API login
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

  // Sign up with email and password (Supabase or legacy)
  async signup(email: string, password: string, displayName: string) {
    if (isSupabaseConfigured()) {
      const { session, user } = await supabaseAuth.signUp(email, password, displayName);

      if (!user) {
        throw new Error('Signup failed');
      }

      // If session exists (email confirmation disabled), user is logged in
      if (session) {
        const store = useAuthStore.getState();
        store.setAccessToken(session.access_token);

        try {
          const backendUser = await authApi.getMe();
          return {
            user: supabaseUserToAuthUser(user, backendUser),
            accessToken: session.access_token,
            requiresEmailVerification: false,
          };
        } catch {
          return {
            user: supabaseUserToAuthUser(user),
            accessToken: session.access_token,
            requiresEmailVerification: false,
          };
        }
      }

      // Email confirmation required
      return {
        user: null,
        accessToken: null,
        requiresEmailVerification: true,
        message: 'Please check your email to verify your account',
      };
    }

    // Legacy API signup
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

  // Sign in with Google OAuth
  async signInWithGoogle() {
    if (!isSupabaseConfigured()) {
      throw new Error('Google OAuth requires Supabase configuration');
    }

    await supabaseAuth.signInWithGoogle();
    // User will be redirected to Google, then back to /auth/callback
  },

  async logout() {
    if (isSupabaseConfigured()) {
      await supabaseAuth.signOut();
      return { success: true };
    }

    const { accessToken } = useAuthStore.getState();

    const response = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
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
    if (isSupabaseConfigured()) {
      const { session } = await supabaseAuth.refreshSession();
      if (session) {
        useAuthStore.getState().setAccessToken(session.access_token);
        return { accessToken: session.access_token };
      }
      throw new Error('Failed to refresh session');
    }

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
    if (isSupabaseConfigured()) {
      await supabaseAuth.resetPassword(email);
      return { message: 'Password reset email sent' };
    }

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
    if (isSupabaseConfigured()) {
      // For Supabase, user clicks link in email which sets session
      // Then they can update password directly
      await supabaseAuth.updatePassword(newPassword);
      return { message: 'Password updated successfully' };
    }

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
    // Supabase handles email verification via redirect
    // This is only for legacy API
    const response = await fetch(`${API_BASE}/auth/verify-email/${token}`);

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Email verification failed');
    }

    return data;
  },

  async getMe() {
    const { accessToken } = useAuthStore.getState();

    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to get user info');
    }

    return data;
  },

  // Refresh user data from backend and update store
  async refreshUserData(): Promise<AuthUser | null> {
    try {
      const backendData = await this.getMe();
      const authUser = backendUserToAuthUser(backendData);
      useAuthStore.getState().setUser(authUser);
      return authUser;
    } catch (error) {
      console.error('Failed to refresh user data:', error);
      return null;
    }
  },
};
