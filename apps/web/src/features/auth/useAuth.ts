import { useCallback, useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '../../store/auth.store';
import type { AuthTokens } from '../../lib/types';
import { fetchMe, logout as logoutApi } from './auth.api';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

/**
 * On first mount, if we have a persisted refresh token, exchange it for an
 * access token + user so the session survives reloads.
 */
export function useAuthBootstrap(): void {
  const { refreshToken, setSession, setStatus, clear } = useAuthStore();

  useEffect(() => {
    let cancelled = false;
    async function boot(): Promise<void> {
      if (!refreshToken) {
        setStatus('anonymous');
        return;
      }
      try {
        const { data } = await axios.post<AuthTokens>(`${BASE_URL}/auth/refresh`, { refreshToken });
        if (cancelled) return;
        setSession(data);
        // Confirm the session (and pick up fresh user fields).
        const me = await fetchMe();
        if (!cancelled) {
          useAuthStore.getState().setUser(me.user);
        }
      } catch {
        if (!cancelled) clear();
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function useLogout(): () => Promise<void> {
  const { refreshToken, clear } = useAuthStore();
  return useCallback(async () => {
    try {
      if (refreshToken) await logoutApi(refreshToken);
    } finally {
      clear();
    }
  }, [refreshToken, clear]);
}
