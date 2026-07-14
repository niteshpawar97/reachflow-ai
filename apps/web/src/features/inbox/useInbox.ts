import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useWorkspaceStore } from '../../store/workspace.store';
import {
  getThread,
  listThreads,
  sendReply,
  suggestReply,
  syncMailboxInbox,
} from './inbox.api';

export function useThreads() {
  const wsId = useWorkspaceStore((s) => s.activeWorkspaceId);
  return useQuery({
    queryKey: ['inbox-threads', wsId],
    queryFn: () => listThreads(),
    enabled: Boolean(wsId),
    refetchInterval: 30_000,
  });
}

export function useThread(campaignLeadId: string | undefined) {
  const wsId = useWorkspaceStore((s) => s.activeWorkspaceId);
  return useQuery({
    queryKey: ['inbox-thread', wsId, campaignLeadId],
    queryFn: () => getThread(campaignLeadId!),
    enabled: Boolean(wsId && campaignLeadId),
  });
}

export function useSendReply(campaignLeadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => sendReply(campaignLeadId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inbox-thread'] });
      void qc.invalidateQueries({ queryKey: ['inbox-threads'] });
    },
  });
}

export function useSuggestReply() {
  return useMutation({ mutationFn: (messageId: string) => suggestReply(messageId) });
}

export function useSyncMailboxInbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mailboxId: string) => syncMailboxInbox(mailboxId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbox-threads'] }),
  });
}
