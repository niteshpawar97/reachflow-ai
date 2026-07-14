/** Infer a mailbox's IMAP host/port from its SMTP host when not explicitly
 * configured — most providers have a predictable IMAP counterpart. */
export function inferImapHost(smtpHost: string | null): string | null {
  if (!smtpHost) return null;
  const host = smtpHost.toLowerCase();

  if (host.includes('zoho')) return host.replace('smtp.', 'imap.');
  if (host.includes('gmail') || host.includes('google')) return 'imap.gmail.com';
  if (host.includes('office365') || host.includes('outlook')) return 'outlook.office365.com';
  if (host.startsWith('smtp.')) return host.replace(/^smtp\./, 'imap.');
  // Generic cPanel/hosting: mail.domain.com serves both SMTP and IMAP.
  return host;
}

export const DEFAULT_IMAP_PORT = 993;
