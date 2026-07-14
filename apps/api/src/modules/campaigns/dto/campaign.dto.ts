import { CampaignStepMode, CampaignStepTrigger, CampaignStatus, LeadStatus } from '@reachflow/database';
import { z } from 'zod';

export const CreateCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  offer: z.string().min(1).max(5000),
  timezone: z.string().min(1).max(64).default('UTC'),
  dailyCap: z.coerce.number().int().min(1).max(500).default(50),
  schedule: z.record(z.any()).optional(),
  mailboxPool: z.array(z.record(z.any())).optional(),
});
export type CreateCampaignDto = z.infer<typeof CreateCampaignSchema>;

export const UpdateCampaignSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  offer: z.string().min(1).max(5000).optional(),
  timezone: z.string().min(1).max(64).optional(),
  dailyCap: z.coerce.number().int().min(1).max(500).optional(),
  schedule: z.record(z.any()).optional(),
  mailboxPool: z.array(z.record(z.any())).optional(),
  status: z.nativeEnum(CampaignStatus).optional(),
});
export type UpdateCampaignDto = z.infer<typeof UpdateCampaignSchema>;

export const CampaignStepSchema = z.object({
  position: z.coerce.number().int().min(1).optional(),
  mode: z.nativeEnum(CampaignStepMode).default(CampaignStepMode.AI),
  trigger: z.nativeEnum(CampaignStepTrigger).default(CampaignStepTrigger.SEND),
  delayMinutes: z.coerce.number().int().min(0).max(60 * 24 * 60).default(0),
  subject: z.string().max(200).optional(),
  body: z.string().max(10_000).optional(),
  aiPrompt: z.string().max(10_000).optional(),
});
export type CampaignStepDto = z.infer<typeof CampaignStepSchema>;

export const UpdateCampaignStepSchema = z.object({
  position: z.coerce.number().int().min(1).optional(),
  mode: z.nativeEnum(CampaignStepMode).optional(),
  trigger: z.nativeEnum(CampaignStepTrigger).optional(),
  delayMinutes: z.coerce.number().int().min(0).max(60 * 24 * 60).optional(),
  subject: z.string().max(200).optional(),
  body: z.string().max(10_000).optional(),
  aiPrompt: z.string().max(10_000).optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'no fields to update' });
export type UpdateCampaignStepDto = z.infer<typeof UpdateCampaignStepSchema>;

export const AttachLeadsSchema = z
  .object({
    leadIds: z.array(z.string().uuid()).min(1).max(200).optional(),
    filter: z
      .object({
        status: z.nativeEnum(LeadStatus).optional(),
        q: z.string().max(200).optional(),
      })
      .optional(),
  })
  .refine((v) => Boolean(v.leadIds?.length || v.filter), {
    message: 'leadIds or filter is required',
  });
export type AttachLeadsDto = z.infer<typeof AttachLeadsSchema>;
