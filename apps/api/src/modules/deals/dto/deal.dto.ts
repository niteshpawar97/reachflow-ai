import { z } from 'zod';
import { DealActivityType, DealStage } from '@reachflow/database';

export const CreateDealSchema = z.object({
  leadId: z.string().uuid(),
  title: z.string().min(1).max(200),
  value: z.coerce.number().min(0).max(100_000_000).optional(),
  currency: z.string().length(3).optional(),
});
export type CreateDealDto = z.infer<typeof CreateDealSchema>;

export const UpdateDealSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    value: z.coerce.number().min(0).max(100_000_000).optional(),
    currency: z.string().length(3).optional(),
  })
  .strict();
export type UpdateDealDto = z.infer<typeof UpdateDealSchema>;

export const UpdateStageSchema = z.object({
  stage: z.nativeEnum(DealStage),
});
export type UpdateStageDto = z.infer<typeof UpdateStageSchema>;

export const AddActivitySchema = z.object({
  type: z.nativeEnum(DealActivityType),
  body: z.string().max(4000).optional(),
});
export type AddActivityDto = z.infer<typeof AddActivitySchema>;
