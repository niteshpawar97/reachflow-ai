import { z } from 'zod';

export const DiscoverySearchSchema = z.object({
  source: z.enum(['GOOGLE_MAPS', 'OSM']).default('GOOGLE_MAPS'),
  category: z.string().min(1).max(50),
  location: z.string().min(2).max(160),
  limit: z.coerce.number().int().min(1).max(60).default(40),
});
export type DiscoverySearchDto = z.infer<typeof DiscoverySearchSchema>;

const BusinessSchema = z.object({
  name: z.string().min(1).max(200),
  website: z.string().max(300).nullable().optional(),
  phone: z.string().max(60).nullable().optional(),
  email: z.string().max(200).nullable().optional(),
  address: z.string().max(300).nullable().optional(),
  category: z.string().max(50),
  osmId: z.string().max(60),
  lat: z.number().nullable().optional(),
  lon: z.number().nullable().optional(),
  hasWebsite: z.boolean().optional(),
  mapsUrl: z.string().max(1000).nullable().optional(),
  rating: z.number().min(0).max(5).nullable().optional(),
  reviewCount: z.number().int().min(0).nullable().optional(),
});

export const DiscoveryImportSchema = z.object({
  businesses: z.array(BusinessSchema).min(1).max(100),
});
export type DiscoveryImportDto = z.infer<typeof DiscoveryImportSchema>;
