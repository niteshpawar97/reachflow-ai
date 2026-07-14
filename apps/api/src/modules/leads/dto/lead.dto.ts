import { ContactRole, LeadSource, LeadStatus } from '@reachflow/database';
import { z } from 'zod';

export const CreateLeadSchema = z.object({
  company: z.object({
    name: z.string().min(1).max(200),
    website: z.string().url().max(300).optional(),
    domain: z.string().max(200).optional(),
    industry: z.string().max(120).optional(),
    country: z.string().max(80).optional(),
    city: z.string().max(120).optional(),
  }),
  contact: z
    .object({
      name: z.string().max(160).optional(),
      title: z.string().max(160).optional(),
      email: z.string().email().max(200).optional(),
      roleType: z.nativeEnum(ContactRole).optional(),
    })
    .optional(),
  source: z.nativeEnum(LeadSource).optional(),
  sourceKey: z.string().max(300).optional(),
});
export type CreateLeadDto = z.infer<typeof CreateLeadSchema>;

export const UpdateLeadSchema = z
  .object({
    status: z.nativeEnum(LeadStatus).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'no fields to update' });
export type UpdateLeadDto = z.infer<typeof UpdateLeadSchema>;

export const ListLeadsQuerySchema = z.object({
  status: z.nativeEnum(LeadStatus).optional(),
  q: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().uuid().optional(),
});
export type ListLeadsQuery = z.infer<typeof ListLeadsQuerySchema>;

export const BulkEmailSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(50),
});
export type BulkEmailDto = z.infer<typeof BulkEmailSchema>;

export const VariantsSchema = z.object({
  count: z.coerce.number().int().min(2).max(4).default(2),
});
export type VariantsDto = z.infer<typeof VariantsSchema>;
