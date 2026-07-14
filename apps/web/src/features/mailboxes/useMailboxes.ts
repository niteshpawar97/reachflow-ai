import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useWorkspaceStore } from '../../store/workspace.store';
import {
  checkDomainAuth,
  createMailbox,
  deleteMailbox,
  listMailboxes,
  reactivateMailbox,
  testMailbox,
  updateMailbox,
  type CreateMailboxPayload,
} from './mailboxes.api';

export function useMailboxes() {
  const wsId = useWorkspaceStore((s) => s.activeWorkspaceId);
  return useQuery({
    queryKey: ['mailboxes', wsId],
    queryFn: () => listMailboxes(),
    enabled: Boolean(wsId),
  });
}

export function useCreateMailbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateMailboxPayload) => createMailbox(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mailboxes'] }),
  });
}

export function useDeleteMailbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMailbox(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mailboxes'] }),
  });
}

export function useTestMailbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, to }: { id: string; to?: string }) => testMailbox(id, to),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mailboxes'] }),
  });
}

export function useUpdateMailbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string; warmupEnabled?: boolean; dailyLimit?: number }) =>
      updateMailbox(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mailboxes'] }),
  });
}

export function useCheckDomainAuth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => checkDomainAuth(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mailboxes'] }),
  });
}

export function useReactivateMailbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reactivateMailbox(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mailboxes'] }),
  });
}
