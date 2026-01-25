import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setAuth: (user: AuthUser, token: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  checkAuth: () => Promise<void>;
}

// For API fetch requests, use empty base (Vite proxy handles it in dev)
// In production, VITE_API_URL points to the backend
const API_BASE = import.meta.env.VITE_API_URL || '';

// Auth endpoints are at /auth/*, not /api/auth/*
// So we need the base URL without /api suffix
const AUTH_BASE = API_BASE.replace(/\/api\/?$/, '');

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: true,
      isAuthenticated: false,

      setAuth: (user, token) => {
        set({ user, token, isAuthenticated: true, isLoading: false });
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false, isLoading: false });
        // Call logout endpoint to clear server cookie
        fetch(`${AUTH_BASE}/auth/logout`, {
          method: 'POST',
          credentials: 'include',
        }).catch(() => {
          // Ignore errors on logout
        });
      },

      setLoading: (loading) => {
        set({ isLoading: loading });
      },

      checkAuth: async () => {
        const { token } = get();

        if (!token) {
          set({ isLoading: false, isAuthenticated: false });
          return;
        }

        try {
          const response = await fetch(`${AUTH_BASE}/auth/me`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            credentials: 'include',
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
              set({ user: data.data, isAuthenticated: true, isLoading: false });
              return;
            }
          }

          // Token invalid, clear auth
          set({ user: null, token: null, isAuthenticated: false, isLoading: false });
        } catch {
          set({ user: null, token: null, isAuthenticated: false, isLoading: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);

// Helper to get auth header for API calls
export function getAuthHeader(): Record<string, string> {
  const token = useAuthStore.getState().token;
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}
