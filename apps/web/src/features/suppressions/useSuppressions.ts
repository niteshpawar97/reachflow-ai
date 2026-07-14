import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useWorkspaceStore } from '../../store/workspace.store';
import { addSuppression, listSuppressions, removeSuppression } from './suppressions.api';

export function useSuppressions() {
  const wsId = useWorkspaceStore((s) => s.activeWorkspaceId);
  return useQuery({
    queryKey: ['suppressions', wsId],
    queryFn: () => listSuppressions(),
    enabled: Boolean(wsId),
  });
}

export function useAddSuppression() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ email, note }: { email: string; note?: string }) => addSuppression(email, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppressions'] }),
  });
}

export function useRemoveSuppression() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => removeSuppression(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppressions'] }),
  });
}
