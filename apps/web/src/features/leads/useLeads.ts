import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useWorkspaceStore } from '../../store/workspace.store';
import {
  createLead,
  deleteLead,
  importLeadsCsv,
  listLeads,
  updateLeadStatus,
  type CreateLeadPayload,
  type LeadStatus,
} from './leads.api';

export function useLeads(filters: { status?: LeadStatus; q?: string }) {
  const wsId = useWorkspaceStore((s) => s.activeWorkspaceId);
  return useQuery({
    queryKey: ['leads', wsId, filters],
    queryFn: () => listLeads(filters),
    enabled: Boolean(wsId),
  });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateLeadPayload) => createLead(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });
}

export function useUpdateLeadStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: LeadStatus }) =>
      updateLeadStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteLead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });
}

export function useImportLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (csv: string) => importLeadsCsv(csv),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });
}
