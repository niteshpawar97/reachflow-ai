import { api } from '../../lib/api';

export type ReplyClassification =
  | 'UNCLASSIFIED'
  | 'INTERESTED'
  | 'NOT_INTERESTED'
  | 'MEETING_REQUEST'
  | 'PRICING_QUESTION'
  | 'REFERRAL'
  | 'OUT_OF_OFFICE'
  | 'UNSUBSCRIBE_REQUEST'
  | 'BOUNCE'
  | 'SPAM'
  | 'OTHER';

export interface ThreadSummary {
  campaignLeadId: string;
  company?: { name: string } | null;
  contact?: { name: string | null; email: string | null } | null;
  campaignName?: string;
  lastMessage: {
    subject: string | null;
    snippet: string | null;
    receivedAt: string;
    classification: ReplyClassification;
    isRead: boolean;
  };
}

export interface Message {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  fromAddress: string;
  toAddress: string;
  subject: string | null;
  bodyText: string | null;
  receivedAt: string;
  classification: ReplyClassification;
  classificationConfidence: number | null;
  classificationSummary: string | null;
  isRead: boolean;
}

export async function listThreads(): Promise<ThreadSummary[]> {
  const { data } = await api.get<ThreadSummary[]>('/inbox/threads');
  return data;
}

export async function getThread(campaignLeadId: string): Promise<Message[]> {
  const { data } = await api.get<Message[]>(`/inbox/threads/${campaignLeadId}`);
  return data;
}

export async function sendReply(campaignLeadId: string, body: string): Promise<{ sent: boolean }> {
  const { data } = await api.post<{ sent: boolean }>(`/inbox/threads/${campaignLeadId}/reply`, { body });
  return data;
}

export async function suggestReply(messageId: string): Promise<{ suggestion: string }> {
  const { data } = await api.post<{ suggestion: string }>(`/inbox/messages/${messageId}/suggest-reply`);
  return data;
}

export async function syncMailboxInbox(mailboxId: string): Promise<{ fetched: number; replies: number; bounces: number }> {
  const { data } = await api.post(`/inbox/sync/${mailboxId}`);
  return data;
}
