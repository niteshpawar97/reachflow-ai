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
  mapsUrl?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
}

export interface DiscoveryResult {
  location: string;
  category: string;
  count: number;
  businesses: DiscoveredBusiness[];
}

export type DiscoverySource = 'GOOGLE_MAPS' | 'OSM';

export interface ImportResult {
  total: number;
  imported: number;
  duplicates: number;
}

export interface DetectedLocation {
  city: string;
  country: string;
  countryCode: string | null;
  location: string;
}

export async function getDiscoveryCategories(): Promise<string[]> {
  const { data } = await api.get<{ categories: string[] }>('/discovery/categories');
  return data.categories;
}

export async function detectLocation(): Promise<DetectedLocation> {
  const { data } = await api.get<DetectedLocation>('/discovery/detect-location');
  return data;
}

export async function searchBusinesses(
  category: string,
  location: string,
  source: DiscoverySource = 'GOOGLE_MAPS',
  limit = 40,
): Promise<DiscoveryResult> {
  const { data } = await api.post<DiscoveryResult>('/discovery/search', { source, category, location, limit });
  return data;
}

export async function importBusinesses(businesses: DiscoveredBusiness[]): Promise<ImportResult> {
  const { data } = await api.post<ImportResult>('/discovery/import', { businesses });
  return data;
}
