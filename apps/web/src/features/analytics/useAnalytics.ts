import { useQuery } from '@tanstack/react-query';
import { useWorkspaceStore } from '../../store/workspace.store';
import { getCampaignBreakdown, getFunnel, getOverview } from './analytics.api';

export function useOverview(days: number) {
  const wsId = useWorkspaceStore((s) => s.activeWorkspaceId);
  return useQuery({
    queryKey: ['analytics-overview', wsId, days],
    queryFn: () => getOverview(days),
    enabled: Boolean(wsId),
  });
}

export function useFunnel() {
  const wsId = useWorkspaceStore((s) => s.activeWorkspaceId);
  return useQuery({
    queryKey: ['analytics-funnel', wsId],
    queryFn: () => getFunnel(),
    enabled: Boolean(wsId),
  });
}

export function useCampaignBreakdown() {
  const wsId = useWorkspaceStore((s) => s.activeWorkspaceId);
  return useQuery({
    queryKey: ['analytics-campaigns', wsId],
    queryFn: () => getCampaignBreakdown(),
    enabled: Boolean(wsId),
  });
}
