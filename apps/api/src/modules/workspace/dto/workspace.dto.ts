import { z } from 'zod';

export const CreateWorkspaceSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'slug may contain only lowercase letters, numbers, hyphens')
    .min(2)
    .max(60)
    .optional(),
});
export type CreateWorkspaceDto = z.infer<typeof CreateWorkspaceSchema>;

export const UpdateWorkspaceSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'no fields to update' });
export type UpdateWorkspaceDto = z.infer<typeof UpdateWorkspaceSchema>;

export const UpdateSettingsSchema = z
  .object({
    timezone: z.string().min(1).max(64).optional(),
    sendingWindows: z.unknown().optional(),
    fromIdentity: z.unknown().optional(),
    compliance: z.unknown().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'no fields to update' });
export type UpdateSettingsDto = z.infer<typeof UpdateSettingsSchema>;
