import { create } from 'zustand';
import type { User } from '../lib/types';

const REFRESH_KEY = 'reachflow.refreshToken';

interface AuthState {
  accessToken: string | null; // kept in memory only
  refreshToken: string | null; // persisted to localStorage
  user: User | null;
  status: 'loading' | 'authenticated' | 'anonymous';
  setSession: (p: { accessToken: string; refreshToken: string; user: User }) => void;
  setAccessToken: (token: string) => void;
  setUser: (user: User) => void;
  clear: () => void;
  setStatus: (status: AuthState['status']) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: typeof localStorage !== 'undefined' ? localStorage.getItem(REFRESH_KEY) : null,
  user: null,
  status: 'loading',
  setSession: ({ accessToken, refreshToken, user }) => {
    localStorage.setItem(REFRESH_KEY, refreshToken);
    set({ accessToken, refreshToken, user, status: 'authenticated' });
  },
  setAccessToken: (accessToken) => set({ accessToken }),
  setUser: (user) => set({ user }),
  clear: () => {
    localStorage.removeItem(REFRESH_KEY);
    set({ accessToken: null, refreshToken: null, user: null, status: 'anonymous' });
  },
  setStatus: (status) => set({ status }),
}));

// Non-hook accessors for use inside the axios interceptor.
export const authAccess = {
  get: () => useAuthStore.getState(),
};
