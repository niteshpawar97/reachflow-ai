import { api } from '../../lib/api';

export type MailboxProvider = 'SMTP' | 'GMAIL' | 'M365';
export type MailboxStatus = 'ACTIVE' | 'DISCONNECTED' | 'ERROR' | 'PAUSED';

export interface DomainAuthCheck {
  pass: boolean;
  detail: string;
}

export interface DomainAuthReport {
  domain: string;
  mx: DomainAuthCheck;
  spf: DomainAuthCheck;
  dmarc: DomainAuthCheck;
  dkim: DomainAuthCheck;
  overallPass: boolean;
  checkedAt: string;
}

export interface Mailbox {
  id: string;
  provider: MailboxProvider;
  email: string;
  displayName: string | null;
  status: MailboxStatus;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUsername: string | null;
  dailyLimit: number;
  sentToday: number;
  warmupEnabled: boolean;
  warmupStartedAt: string | null;
  warmupDay: number;
  lastError: string | null;
  healthScore: number;
  bounceCount: number;
  sentTotal: number;
  autoPausedAt: string | null;
  domainAuthReport: DomainAuthReport | null;
  domainAuthCheckedAt: string | null;
  createdAt: string;
}

export interface CreateMailboxPayload {
  provider: MailboxProvider;
  email: string;
  displayName?: string;
  dailyLimit?: number;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUsername?: string;
  smtpPassword?: string;
}

export async function listMailboxes(): Promise<Mailbox[]> {
  const { data } = await api.get<Mailbox[]>('/mailboxes');
  return data;
}

export async function createMailbox(payload: CreateMailboxPayload): Promise<Mailbox> {
  const { data } = await api.post<Mailbox>('/mailboxes', payload);
  return data;
}

export async function deleteMailbox(id: string): Promise<void> {
  await api.delete(`/mailboxes/${id}`);
}

export async function updateMailbox(
  id: string,
  payload: { warmupEnabled?: boolean; dailyLimit?: number },
): Promise<Mailbox> {
  const { data } = await api.patch<Mailbox>(`/mailboxes/${id}`, payload);
  return data;
}

export async function checkDomainAuth(id: string): Promise<DomainAuthReport> {
  const { data } = await api.post<DomainAuthReport>(`/mailboxes/${id}/domain-auth/check`);
  return data;
}

export async function reactivateMailbox(id: string): Promise<void> {
  await api.post(`/mailboxes/${id}/reactivate`);
}

export interface SendResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
}

export async function testMailbox(id: string, to?: string): Promise<SendResult> {
  const { data } = await api.post<SendResult>(`/mailboxes/${id}/test`, to ? { to } : {});
  return data;
}
