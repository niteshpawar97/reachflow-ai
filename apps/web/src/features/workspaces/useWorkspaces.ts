import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useWorkspaceStore } from '../../store/workspace.store';
import type { Member, Workspace, WorkspaceSettings } from '../../lib/types';
import {
  createWorkspace,
  getSettings,
  listMembers,
  listWorkspaces,
  updateSettings,
  updateWorkspace,
} from './workspaces.api';

export function useWorkspaces() {
  return useQuery({ queryKey: ['workspaces'], queryFn: listWorkspaces });
}

/** Returns the active workspace, defaulting to the first one available. */
export function useActiveWorkspace(): Workspace | undefined {
  const { data } = useWorkspaces();
  const { activeWorkspaceId, setActiveWorkspace } = useWorkspaceStore();

  useEffect(() => {
    const first = data?.[0];
    if (!first) return;
    const stillValid = data.some((w) => w.id === activeWorkspaceId);
    if (!activeWorkspaceId || !stillValid) {
      setActiveWorkspace(first.id);
    }
  }, [data, activeWorkspaceId, setActiveWorkspace]);

  return data?.find((w) => w.id === activeWorkspaceId) ?? data?.[0];
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  const { setActiveWorkspace } = useWorkspaceStore();
  return useMutation({
    mutationFn: (name: string) => createWorkspace(name),
    onSuccess: (ws) => {
      void qc.invalidateQueries({ queryKey: ['workspaces'] });
      setActiveWorkspace(ws.id);
    },
  });
}

export function useRenameWorkspace(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => updateWorkspace(id, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspaces'] }),
  });
}

export function useWorkspaceSettings(id: string | undefined) {
  return useQuery<WorkspaceSettings>({
    queryKey: ['workspace-settings', id],
    queryFn: () => getSettings(id as string),
    enabled: Boolean(id),
  });
}

export function useUpdateSettings(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: { timezone?: string; compliance?: unknown }) => updateSettings(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspace-settings', id] }),
  });
}

export function useMembers(id: string | undefined) {
  return useQuery<Member[]>({
    queryKey: ['workspace-members', id],
    queryFn: () => listMembers(id as string),
    enabled: Boolean(id),
  });
}
