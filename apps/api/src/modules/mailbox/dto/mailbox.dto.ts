import { z } from 'zod';
import { MailboxProvider } from '@reachflow/database';

export const CreateMailboxSchema = z
  .object({
    provider: z.nativeEnum(MailboxProvider).default(MailboxProvider.SMTP),
    email: z.string().email().max(200),
    displayName: z.string().max(160).optional(),
    dailyLimit: z.coerce.number().int().min(1).max(2000).default(50),
    // SMTP-specific (required when provider === SMTP)
    smtpHost: z.string().max(255).optional(),
    smtpPort: z.coerce.number().int().min(1).max(65535).optional(),
    smtpSecure: z.coerce.boolean().default(true),
    smtpUsername: z.string().max(255).optional(),
    smtpPassword: z.string().max(500).optional(),
  })
  .refine(
    (v) =>
      v.provider !== MailboxProvider.SMTP ||
      Boolean(v.smtpHost && v.smtpPort && v.smtpUsername && v.smtpPassword),
    {
      message: 'SMTP mailboxes require smtpHost, smtpPort, smtpUsername and smtpPassword',
      path: ['smtpPassword'],
    },
  );
export type CreateMailboxDto = z.infer<typeof CreateMailboxSchema>;

export const UpdateMailboxSchema = z
  .object({
    displayName: z.string().max(160).optional(),
    dailyLimit: z.coerce.number().int().min(1).max(2000).optional(),
    smtpHost: z.string().max(255).optional(),
    smtpPort: z.coerce.number().int().min(1).max(65535).optional(),
    smtpSecure: z.coerce.boolean().optional(),
    smtpUsername: z.string().max(255).optional(),
    smtpPassword: z.string().max(500).optional(),
    warmupEnabled: z.coerce.boolean().optional(),
  })
  .strict();
export type UpdateMailboxDto = z.infer<typeof UpdateMailboxSchema>;

export const TestSendSchema = z.object({
  to: z.string().email().max(200).optional(),
});
export type TestSendDto = z.infer<typeof TestSendSchema>;
