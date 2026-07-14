import { useQuery } from '@tanstack/react-query';
import { useWorkspaceStore } from '../../store/workspace.store';
import { getDashboardStats } from './dashboard.api';

export function useDashboardStats() {
  const wsId = useWorkspaceStore((s) => s.activeWorkspaceId);
  return useQuery({
    queryKey: ['dashboard-stats', wsId],
    queryFn: () => getDashboardStats(),
    enabled: Boolean(wsId),
  });
}
