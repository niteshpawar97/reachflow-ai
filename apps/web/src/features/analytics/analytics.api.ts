import { api } from '../../lib/api';

export interface DayBucket {
  date: string;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
}

export interface Funnel {
  totalLeads: number;
  contacted: number;
  opened: number;
  clicked: number;
  replied: number;
  won: number;
}

export interface CampaignBreakdown {
  id: string;
  name: string;
  status: string;
  total: number;
  sent: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bounceRate: number;
}

export async function getOverview(days = 30): Promise<DayBucket[]> {
  const { data } = await api.get<DayBucket[]>('/analytics/overview', { params: { days } });
  return data;
}

export async function getFunnel(): Promise<Funnel> {
  const { data } = await api.get<Funnel>('/analytics/funnel');
  return data;
}

export async function getCampaignBreakdown(): Promise<CampaignBreakdown[]> {
  const { data } = await api.get<CampaignBreakdown[]>('/analytics/campaigns');
  return data;
}

/** Fetches the CSV via the authenticated client and triggers a browser download
 * (a plain <a href> would skip the Authorization header the interceptor adds). */
export async function downloadCsvExport(): Promise<void> {
  const { data } = await api.get<string>('/analytics/export.csv', { responseType: 'text' });
  const blob = new Blob([data], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'reachflow-campaign-leads.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
