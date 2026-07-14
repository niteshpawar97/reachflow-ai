import { z } from 'zod';

export const SendReplySchema = z.object({
  body: z.string().min(1).max(10_000),
});
export type SendReplyDto = z.infer<typeof SendReplySchema>;
