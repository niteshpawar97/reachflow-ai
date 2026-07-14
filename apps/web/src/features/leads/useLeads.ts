import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useWorkspaceStore } from '../../store/workspace.store';
import {
  approveLeadEmail,
  createLead,
  deleteLead,
  generateLeadEmail,
  generateLeadFollowUp,
  generateLeadVariants,
  getLeadAudit,
  importLeadsCsv,
  listLeadEmails,
  listLeads,
  rejectLeadEmail,
  runLeadAudit,
  scrapeLeadContacts,
  summarizeLeadAudit,
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

export function useLeadAudit(leadId: string) {
  const wsId = useWorkspaceStore((s) => s.activeWorkspaceId);
  return useQuery({
    queryKey: ['lead-audit', wsId, leadId],
    queryFn: () => getLeadAudit(leadId),
    enabled: Boolean(wsId && leadId),
  });
}

export function useRunAudit(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => runLeadAudit(leadId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lead-audit'] }),
  });
}

export function useScrapeContacts(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => scrapeLeadContacts(leadId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });
}

export function useSummarizeAudit(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => summarizeLeadAudit(leadId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lead-audit'] }),
  });
}

export function useLeadEmails(leadId: string) {
  const wsId = useWorkspaceStore((s) => s.activeWorkspaceId);
  return useQuery({
    queryKey: ['lead-emails', wsId, leadId],
    queryFn: () => listLeadEmails(leadId),
    enabled: Boolean(wsId && leadId),
  });
}

export function useGenerateEmail(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => generateLeadEmail(leadId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lead-emails'] }),
  });
}

export function useGenerateFollowUp(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => generateLeadFollowUp(leadId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lead-emails'] }),
  });
}

export function useGenerateVariants(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (count: number) => generateLeadVariants(leadId, count),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lead-emails'] }),
  });
}

export function useApproveLeadEmail(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (emailId: string) => approveLeadEmail(leadId, emailId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lead-emails'] }),
  });
}

export function useRejectLeadEmail(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (emailId: string) => rejectLeadEmail(leadId, emailId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lead-emails'] }),
  });
}
