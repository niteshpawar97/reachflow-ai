import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getDiscoveryCategories,
  importBusinesses,
  searchBusinesses,
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
    mutationFn: ({ category, location, limit }: { category: string; location: string; limit?: number }) =>
      searchBusinesses(category, location, limit),
  });
}

export function useImportBusinesses() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (businesses: DiscoveredBusiness[]) => importBusinesses(businesses),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });
}
