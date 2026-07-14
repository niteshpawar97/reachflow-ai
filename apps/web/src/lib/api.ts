import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';
import { useAuthStore } from '../store/auth.store';
import { useWorkspaceStore } from '../store/workspace.store';
import type { AuthTokens } from './types';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

export const api: AxiosInstance = axios.create({ baseURL: BASE_URL });

// Attach the access token + active workspace to every request.
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const wsId = useWorkspaceStore.getState().activeWorkspaceId;
  if (wsId) {
    config.headers['X-Workspace-Id'] = wsId;
  }
  return config;
});

// Single-flight refresh so parallel 401s don't spawn multiple refreshes.
let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken } = useAuthStore.getState();
  if (!refreshToken) {
    return null;
  }
  try {
    // Plain axios (not `api`) to avoid the interceptor recursing.
    const { data } = await axios.post<AuthTokens>(`${BASE_URL}/auth/refresh`, { refreshToken });
    useAuthStore.getState().setSession(data);
    return data.accessToken;
  } catch {
    useAuthStore.getState().clear();
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const isAuthCall = original?.url?.includes('/auth/');

    if (error.response?.status === 401 && original && !original._retried && !isAuthCall) {
      original._retried = true;
      refreshing = refreshing ?? refreshAccessToken();
      const newToken = await refreshing;
      refreshing = null;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);

export function extractApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { error?: { message?: string } }
      | undefined;
    return data?.error?.message ?? error.message;
  }
  return error instanceof Error ? error.message : 'Something went wrong';
}
