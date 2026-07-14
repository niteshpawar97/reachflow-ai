import { api } from '../../lib/api';

export interface DiscoveredBusiness {
  name: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  category: string;
  osmId: string;
  lat: number | null;
  lon: number | null;
  hasWebsite: boolean;
}

export interface DiscoveryResult {
  location: string;
  category: string;
  count: number;
  businesses: DiscoveredBusiness[];
}

export interface ImportResult {
  total: number;
  imported: number;
  duplicates: number;
}

export async function getDiscoveryCategories(): Promise<string[]> {
  const { data } = await api.get<{ categories: string[] }>('/discovery/categories');
  return data.categories;
}

export async function searchBusinesses(
  category: string,
  location: string,
  limit = 40,
): Promise<DiscoveryResult> {
  const { data } = await api.post<DiscoveryResult>('/discovery/search', { category, location, limit });
  return data;
}

export async function importBusinesses(businesses: DiscoveredBusiness[]): Promise<ImportResult> {
  const { data } = await api.post<ImportResult>('/discovery/import', { businesses });
  return data;
}
