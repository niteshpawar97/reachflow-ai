import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useWorkspaceStore } from '../../store/workspace.store';
import type { CampaignStepPayload, CreateCampaignPayload, UpdateCampaignPayload } from './campaigns.api';
import {
  addCampaignStep,
  attachCampaignLeads,
  createCampaign,
  deleteCampaignStep,
  getCampaign,
  launchCampaign,
  listCampaignLeads,
  listCampaignSteps,
  listCampaigns,
  pauseCampaign,
  resumeCampaign,
  stopCampaign,
  updateCampaign,
  updateCampaignStep,
} from './campaigns.api';
import type { AttachCampaignLeadsPayload } from './campaigns.api';

export function useCampaigns() {
  const wsId = useWorkspaceStore((s) => s.activeWorkspaceId);
  return useQuery({
    queryKey: ['campaigns', wsId],
    queryFn: listCampaigns,
    enabled: Boolean(wsId),
  });
}

export function useCampaign(id: string | undefined) {
  const wsId = useWorkspaceStore((s) => s.activeWorkspaceId);
  return useQuery({
    queryKey: ['campaign', wsId, id],
    queryFn: () => getCampaign(id as string),
    enabled: Boolean(wsId && id),
  });
}

export function useCampaignSteps(id: string | undefined) {
  const wsId = useWorkspaceStore((s) => s.activeWorkspaceId);
  return useQuery({
    queryKey: ['campaign-steps', wsId, id],
    queryFn: () => listCampaignSteps(id as string),
    enabled: Boolean(wsId && id),
  });
}

export function useCampaignLeads(id: string | undefined) {
  const wsId = useWorkspaceStore((s) => s.activeWorkspaceId);
  return useQuery({
    queryKey: ['campaign-leads', wsId, id],
    queryFn: () => listCampaignLeads(id as string),
    enabled: Boolean(wsId && id),
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCampaignPayload) => createCampaign(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['campaigns'] });
      void qc.invalidateQueries({ queryKey: ['campaign'] });
    },
  });
}

export function useUpdateCampaign(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateCampaignPayload) => updateCampaign(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['campaigns'] });
      void qc.invalidateQueries({ queryKey: ['campaign'] });
    },
  });
}

export function useAddCampaignStep(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CampaignStepPayload) => addCampaignStep(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['campaign'] });
      void qc.invalidateQueries({ queryKey: ['campaign-steps'] });
    },
  });
}

export function useUpdateCampaignStep(campaignId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ stepId, payload }: { stepId: string; payload: CampaignStepPayload }) =>
      updateCampaignStep(campaignId, stepId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['campaign'] });
      void qc.invalidateQueries({ queryKey: ['campaign-steps'] });
    },
  });
}

export function useDeleteCampaignStep(campaignId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (stepId: string) => deleteCampaignStep(campaignId, stepId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['campaign'] });
      void qc.invalidateQueries({ queryKey: ['campaign-steps'] });
    },
  });
}

export function useAttachCampaignLeads(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AttachCampaignLeadsPayload) => attachCampaignLeads(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['campaign'] });
      void qc.invalidateQueries({ queryKey: ['campaign-leads'] });
    },
  });
}

export function useLaunchCampaign(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => launchCampaign(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['campaigns'] }),
  });
}

export function usePauseCampaign(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => pauseCampaign(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['campaigns'] }),
  });
}

export function useResumeCampaign(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => resumeCampaign(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['campaigns'] }),
  });
}

export function useStopCampaign(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => stopCampaign(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['campaigns'] }),
  });
}
