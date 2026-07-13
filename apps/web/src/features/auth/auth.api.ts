import { api } from '../../lib/api';
import type { AuthTokens, MeResponse } from '../../lib/types';

export async function login(email: string, password: string): Promise<AuthTokens> {
  const { data } = await api.post<AuthTokens>('/auth/login', { email, password });
  return data;
}

export async function register(
  email: string,
  password: string,
  name?: string,
): Promise<AuthTokens> {
  const { data } = await api.post<AuthTokens>('/auth/register', { email, password, name });
  return data;
}

export async function fetchMe(): Promise<MeResponse> {
  const { data } = await api.get<MeResponse>('/auth/me');
  return data;
}

export async function logout(refreshToken: string): Promise<void> {
  await api.post('/auth/logout', { refreshToken });
}
