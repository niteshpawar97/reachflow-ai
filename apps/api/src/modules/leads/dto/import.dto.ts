import { z } from 'zod';

/**
 * CSV import. `csv` is the raw file content (first row = headers).
 * `mapping` optionally maps our fields -> CSV column names; otherwise the
 * default header names below are used (case-insensitive).
 */
export const ImportLeadsSchema = z.object({
  csv: z.string().min(1, 'csv content is required').max(5_000_000),
  mapping: z.record(z.string()).optional(),
});
export type ImportLeadsDto = z.infer<typeof ImportLeadsSchema>;

// field -> default CSV header (lowercased)
export const DEFAULT_MAPPING: Record<string, string> = {
  companyName: 'company',
  website: 'website',
  domain: 'domain',
  industry: 'industry',
  country: 'country',
  city: 'city',
  contactName: 'name',
  contactEmail: 'email',
  title: 'title',
};

export interface ImportResult {
  total: number;
  imported: number;
  failed: number;
  duplicates: number;
  errors: Array<{ row: number; message: string }>;
}
