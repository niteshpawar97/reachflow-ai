import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useWorkspaceStore } from '../../store/workspace.store';
import {
  createMailbox,
  deleteMailbox,
  listMailboxes,
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
