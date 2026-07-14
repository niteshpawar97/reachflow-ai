import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useWorkspaceStore } from '../../store/workspace.store';
import {
  addDealActivity,
  getDeal,
  listDeals,
  updateDealStage,
  type DealActivityType,
  type DealStage,
} from './deals.api';

export function useDeals() {
  const wsId = useWorkspaceStore((s) => s.activeWorkspaceId);
  return useQuery({
    queryKey: ['deals', wsId],
    queryFn: () => listDeals(),
    enabled: Boolean(wsId),
  });
}

export function useDeal(id: string | undefined) {
  const wsId = useWorkspaceStore((s) => s.activeWorkspaceId);
  return useQuery({
    queryKey: ['deal', wsId, id],
    queryFn: () => getDeal(id!),
    enabled: Boolean(wsId && id),
  });
}

export function useUpdateDealStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: DealStage }) => updateDealStage(id, stage),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['deals'] });
      void qc.invalidateQueries({ queryKey: ['deal'] });
    },
  });
}

export function useAddDealActivity(dealId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ type, body }: { type: DealActivityType; body?: string }) =>
      addDealActivity(dealId, type, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deal'] }),
  });
}
