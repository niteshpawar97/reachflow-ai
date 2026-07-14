import { api } from '../../lib/api';

export interface DashboardStats {
  leads: { total: number; ready: number; verified: number };
  mailboxes: number;
  campaigns: { total: number; active: number };
  emails: {
    generated: number;
    sent: number;
    opened: number;
    clicked: number;
    replied: number;
    openRate: number;
    clickRate: number;
    replyRate: number;
  };
  checklist: { workspace: boolean; mailbox: boolean; leads: boolean; campaign: boolean };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const { data } = await api.get<DashboardStats>('/dashboard/stats');
  return data;
}
