import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  detectLocation,
  getDiscoveryCategories,
  importBusinesses,
  searchBusinesses,
  type DiscoverySource,
  type DiscoveredBusiness,
} from './discovery.api';

export function useDiscoveryCategories() {
  return useQuery({
    queryKey: ['discovery-categories'],
    queryFn: () => getDiscoveryCategories(),
    staleTime: 60 * 60 * 1000,
  });
}

export function useSearchBusinesses() {
  return useMutation({
    mutationFn: ({
      source,
      category,
      location,
      limit,
    }: {
      source: DiscoverySource;
      category: string;
      location: string;
      limit?: number;
    }) => searchBusinesses(category, location, source, limit),
  });
}

export function useDetectLocation() {
  return useMutation({ mutationFn: detectLocation });
}

export function useImportBusinesses() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (businesses: DiscoveredBusiness[]) => importBusinesses(businesses),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });
}
