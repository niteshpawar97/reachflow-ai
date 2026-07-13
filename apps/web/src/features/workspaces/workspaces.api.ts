import { api } from '../../lib/api';
import type { Member, Workspace, WorkspaceSettings } from '../../lib/types';

export async function listWorkspaces(): Promise<Workspace[]> {
  const { data } = await api.get<Workspace[]>('/workspaces');
  return data;
}

export async function createWorkspace(name: string): Promise<Workspace> {
  const { data } = await api.post<Workspace>('/workspaces', { name });
  return data;
}

export async function updateWorkspace(id: string, name: string): Promise<Workspace> {
  const { data } = await api.patch<Workspace>(`/workspaces/${id}`, { name });
  return data;
}

export async function getSettings(id: string): Promise<WorkspaceSettings> {
  const { data } = await api.get<WorkspaceSettings>(`/workspaces/${id}/settings`);
  return data;
}

export async function updateSettings(
  id: string,
  patch: { timezone?: string; compliance?: unknown },
): Promise<WorkspaceSettings> {
  const { data } = await api.patch<WorkspaceSettings>(`/workspaces/${id}/settings`, patch);
  return data;
}

export async function listMembers(id: string): Promise<Member[]> {
  const { data } = await api.get<Member[]>(`/workspaces/${id}/members`);
  return data;
}
