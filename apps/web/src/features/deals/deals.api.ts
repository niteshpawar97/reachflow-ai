import { api } from '../../lib/api';

export type DealStage = 'NEW' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST';
export type DealActivityType = 'EMAIL' | 'REPLY' | 'CALL' | 'NOTE' | 'MEETING' | 'STAGE_CHANGE';

export interface Deal {
  id: string;
  title: string;
  stage: DealStage;
  value: string | number | null;
  currency: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lead: {
    id: string;
    company: { name: string; website: string | null };
    contact: { name: string | null; email: string | null } | null;
  };
}

export interface DealActivity {
  id: string;
  type: DealActivityType;
  body: string | null;
  createdAt: string;
}

export interface DealDetail extends Deal {
  activities: DealActivity[];
}

export async function listDeals(): Promise<Deal[]> {
  const { data } = await api.get<Deal[]>('/deals');
  return data;
}

export async function getDeal(id: string): Promise<DealDetail> {
  const { data } = await api.get<DealDetail>(`/deals/${id}`);
  return data;
}

export async function createDeal(leadId: string, title: string): Promise<Deal> {
  const { data } = await api.post<Deal>('/deals', { leadId, title });
  return data;
}

export async function updateDealStage(id: string, stage: DealStage): Promise<Deal> {
  const { data } = await api.patch<Deal>(`/deals/${id}/stage`, { stage });
  return data;
}

export async function addDealActivity(
  id: string,
  type: DealActivityType,
  body?: string,
): Promise<DealActivity> {
  const { data } = await api.post<DealActivity>(`/deals/${id}/activities`, { type, body });
  return data;
}
