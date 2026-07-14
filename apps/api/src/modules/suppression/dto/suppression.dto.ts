import { z } from 'zod';

export const AddSuppressionSchema = z.object({
  email: z.string().email().max(200),
  note: z.string().max(300).optional(),
});
export type AddSuppressionDto = z.infer<typeof AddSuppressionSchema>;
