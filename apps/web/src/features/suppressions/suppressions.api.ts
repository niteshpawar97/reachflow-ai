import { api } from '../../lib/api';

export type SuppressionReason = 'UNSUBSCRIBED' | 'BOUNCED' | 'COMPLAINED' | 'MANUAL';

export interface Suppression {
  id: string;
  email: string;
  reason: SuppressionReason;
  note: string | null;
  createdAt: string;
}

export async function listSuppressions(): Promise<Suppression[]> {
  const { data } = await api.get<Suppression[]>('/suppressions');
  return data;
}

export async function addSuppression(email: string, note?: string): Promise<void> {
  await api.post('/suppressions', { email, note });
}

export async function removeSuppression(id: string): Promise<void> {
  await api.delete(`/suppressions/${id}`);
}
