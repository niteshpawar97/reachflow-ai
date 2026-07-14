import { api } from '../../lib/api';
import type { LeadStatus } from '../leads/leads.api';

export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'STOPPED' | 'COMPLETED';
export type CampaignStepMode = 'AI' | 'FIXED';
export type CampaignStepTrigger = 'SEND' | 'NO_REPLY' | 'OPENED' | 'CLICKED' | 'REPLIED';
export type CampaignLeadStatus =
  | 'PENDING'
  | 'QUEUED'
  | 'SENDING'
  | 'SENT'
  | 'OPENED'
  | 'REPLIED'
  | 'BOUNCED'
  | 'SKIPPED'
  | 'STOPPED';

export interface CampaignSummary {
  id: string;
  name: string;
  offer: string;
  status: CampaignStatus;
  timezone: string;
  dailyCap: number;
  launchedAt: string | null;
  pausedAt: string | null;
  stoppedAt: string | null;
  createdAt: string;
  updatedAt: string;
  stepCount: number;
  leadCount: number;
}

export interface CampaignStep {
  id: string;
  campaignId: string;
  position: number;
  mode: CampaignStepMode;
  trigger: CampaignStepTrigger;
  delayMinutes: number;
  subject: string | null;
  body: string | null;
  aiPrompt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignLeadRow {
  id: string;
  status: CampaignLeadStatus;
  currentStep: number;
  nextSendAt: string | null;
  lead: {
    id: string;
    status: string;
    company: { name: string; domain: string | null; website: string | null };
    contact: { name: string | null; email: string | null; title: string | null } | null;
    score: { score: number } | null;
  };
}

export interface CampaignDetail extends CampaignSummary {
  schedule: unknown;
  mailboxPool: unknown;
  steps: CampaignStep[];
  leads: CampaignLeadRow[];
}

export interface CreateCampaignPayload {
  name: string;
  offer: string;
  timezone?: string;
  dailyCap?: number;
  schedule?: Record<string, unknown>;
  mailboxPool?: Array<Record<string, unknown>>;
}

export interface UpdateCampaignPayload extends Partial<CreateCampaignPayload> {
  status?: CampaignStatus;
}

export interface CampaignStepPayload {
  position?: number;
  mode?: CampaignStepMode;
  trigger?: CampaignStepTrigger;
  delayMinutes?: number;
  subject?: string;
  body?: string;
  aiPrompt?: string;
}

export interface AttachCampaignLeadsPayload {
  leadIds?: string[];
  filter?: { status?: LeadStatus; q?: string };
}

export async function listCampaigns(): Promise<CampaignSummary[]> {
  const { data } = await api.get<CampaignSummary[]>('/campaigns');
  return data;
}

export async function createCampaign(payload: CreateCampaignPayload): Promise<CampaignDetail> {
  const { data } = await api.post<CampaignDetail>('/campaigns', payload);
  return data;
}

export async function getCampaign(id: string): Promise<CampaignDetail> {
  const { data } = await api.get<CampaignDetail>(`/campaigns/${id}`);
  return data;
}

export async function updateCampaign(id: string, payload: UpdateCampaignPayload): Promise<CampaignDetail> {
  const { data } = await api.patch<CampaignDetail>(`/campaigns/${id}`, payload);
  return data;
}

export async function listCampaignSteps(id: string): Promise<CampaignStep[]> {
  const { data } = await api.get<CampaignStep[]>(`/campaigns/${id}/steps`);
  return data;
}

export async function addCampaignStep(id: string, payload: CampaignStepPayload): Promise<CampaignStep> {
  const { data } = await api.post<CampaignStep>(`/campaigns/${id}/steps`, payload);
  return data;
}

export async function updateCampaignStep(
  campaignId: string,
  stepId: string,
  payload: CampaignStepPayload,
): Promise<CampaignStep> {
  const { data } = await api.patch<CampaignStep>(`/campaigns/${campaignId}/steps/${stepId}`, payload);
  return data;
}

export async function deleteCampaignStep(campaignId: string, stepId: string): Promise<void> {
  await api.delete(`/campaigns/${campaignId}/steps/${stepId}`);
}

export async function attachCampaignLeads(
  id: string,
  payload: AttachCampaignLeadsPayload,
): Promise<CampaignLeadRow[]> {
  const { data } = await api.post<CampaignLeadRow[]>(`/campaigns/${id}/leads`, payload);
  return data;
}

export async function listCampaignLeads(id: string): Promise<CampaignLeadRow[]> {
  const { data } = await api.get<CampaignLeadRow[]>(`/campaigns/${id}/leads`);
  return data;
}

export async function launchCampaign(id: string): Promise<CampaignSummary> {
  const { data } = await api.post<CampaignSummary>(`/campaigns/${id}/launch`);
  return data;
}

export async function pauseCampaign(id: string): Promise<CampaignSummary> {
  const { data } = await api.post<CampaignSummary>(`/campaigns/${id}/pause`);
  return data;
}

export async function resumeCampaign(id: string): Promise<CampaignSummary> {
  const { data } = await api.post<CampaignSummary>(`/campaigns/${id}/resume`);
  return data;
}

export async function stopCampaign(id: string): Promise<CampaignSummary> {
  const { data } = await api.post<CampaignSummary>(`/campaigns/${id}/stop`);
  return data;
}
