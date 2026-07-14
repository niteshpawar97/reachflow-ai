import { api } from '../../lib/api';

export type LeadStatus =
  | 'NEW'
  | 'ENRICHING'
  | 'SCORED'
  | 'READY'
  | 'IN_CAMPAIGN'
  | 'REPLIED'
  | 'WON'
  | 'LOST'
  | 'SUPPRESSED';

export interface LeadCompany {
  id: string;
  name: string;
  website: string | null;
  domain: string | null;
  industry: string | null;
  country: string | null;
  city: string | null;
}

export interface LeadContact {
  id: string;
  name: string | null;
  email: string | null;
  title: string | null;
  emailStatus: 'UNKNOWN' | 'VALID' | 'INVALID' | 'RISKY' | 'CATCH_ALL';
}

export interface Lead {
  id: string;
  status: LeadStatus;
  source: string;
  createdAt: string;
  company: LeadCompany;
  contact: LeadContact | null;
}

export interface LeadListResponse {
  data: Lead[];
  nextCursor: string | null;
}

export interface CreateLeadPayload {
  company: { name: string; website?: string; industry?: string; country?: string };
  contact?: { name?: string; email?: string; title?: string };
}

export interface ImportResult {
  total: number;
  imported: number;
  failed: number;
  duplicates: number;
  errors: Array<{ row: number; message: string }>;
}

export async function listLeads(params: {
  status?: LeadStatus;
  q?: string;
}): Promise<LeadListResponse> {
  const { data } = await api.get<LeadListResponse>('/leads', { params });
  return data;
}

export async function createLead(payload: CreateLeadPayload): Promise<Lead> {
  const { data } = await api.post<Lead>('/leads', payload);
  return data;
}

export async function updateLeadStatus(id: string, status: LeadStatus): Promise<Lead> {
  const { data } = await api.patch<Lead>(`/leads/${id}`, { status });
  return data;
}

export async function deleteLead(id: string): Promise<void> {
  await api.delete(`/leads/${id}`);
}

export async function importLeadsCsv(csv: string): Promise<ImportResult> {
  const { data } = await api.post<ImportResult>('/leads/import', { csv });
  return data;
}

export interface EmailDraft {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  kind: 'INITIAL' | 'FOLLOWUP' | 'VARIANT';
  variantLabel: string | null;
  sequenceIndex: number;
  subject: string;
  body: string;
  provider: string;
  model: string;
  tier: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: string | number;
  createdAt: string;
  reviewedAt: string | null;
}

export async function generateLeadEmail(id: string): Promise<EmailDraft> {
  const { data } = await api.post<EmailDraft>(`/leads/${id}/email`);
  return data;
}

export async function listLeadEmails(id: string): Promise<EmailDraft[]> {
  const { data } = await api.get<EmailDraft[]>(`/leads/${id}/email`);
  return data;
}

export async function generateLeadFollowUp(id: string): Promise<EmailDraft> {
  const { data } = await api.post<EmailDraft>(`/leads/${id}/email/followup`);
  return data;
}

export async function generateLeadVariants(id: string, count: number): Promise<EmailDraft[]> {
  const { data } = await api.post<EmailDraft[]>(`/leads/${id}/email/variants`, { count });
  return data;
}

export async function approveLeadEmail(leadId: string, emailId: string): Promise<EmailDraft> {
  const { data } = await api.post<EmailDraft>(`/leads/${leadId}/email/${emailId}/approve`);
  return data;
}

export async function rejectLeadEmail(leadId: string, emailId: string): Promise<EmailDraft> {
  const { data } = await api.post<EmailDraft>(`/leads/${leadId}/email/${emailId}/reject`);
  return data;
}

export interface WebsiteAudit {
  id: string;
  url: string;
  status: 'OK' | 'PARTIAL' | 'FAILED';
  https: boolean;
  mobileFriendly: boolean;
  hasContactForm: boolean;
  hasCta: boolean;
  performanceScore: number | null;
  responseTimeMs: number | null;
  cms: string | null;
  findings: Array<{ code: string; severity: 'high' | 'medium' | 'low'; message: string }> | null;
  aiSummary: string | null;
  createdAt: string;
}

export async function runLeadAudit(id: string): Promise<WebsiteAudit> {
  const { data } = await api.post<WebsiteAudit>(`/leads/${id}/audit`);
  return data;
}

export async function getLeadAudit(id: string): Promise<WebsiteAudit | null> {
  const { data } = await api.get<WebsiteAudit | null>(`/leads/${id}/audit`);
  return data;
}

export async function summarizeLeadAudit(id: string): Promise<WebsiteAudit> {
  const { data } = await api.post<WebsiteAudit>(`/leads/${id}/audit/summary`);
  return data;
}
