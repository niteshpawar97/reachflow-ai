import { resolveMx } from 'node:dns/promises';
import { Injectable, Logger } from '@nestjs/common';
import type { EmailStatus } from '@reachflow/database';

export interface VerificationResult {
  email: string;
  status: EmailStatus;
  mxOk: boolean;
  disposable: boolean;
  roleAccount: boolean;
  riskScore: number; // 0 (safe) .. 100 (risky)
  reason: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Common disposable/throwaway domains (starter list; extend as needed).
const DISPOSABLE = new Set([
  'mailinator.com',
  'guerrillamail.com',
  '10minutemail.com',
  'tempmail.com',
  'temp-mail.org',
  'yopmail.com',
  'trashmail.com',
  'getnada.com',
  'sharklasers.com',
  'throwawaymail.com',
  'maildrop.cc',
  'dispostable.com',
]);

const ROLE_PREFIXES = new Set([
  'info',
  'support',
  'admin',
  'sales',
  'contact',
  'hello',
  'help',
  'office',
  'billing',
  'noreply',
  'no-reply',
  'team',
  'marketing',
  'webmaster',
  'enquiries',
  'inquiries',
]);

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  async verify(rawEmail: string): Promise<VerificationResult> {
    const email = rawEmail.trim().toLowerCase();

    if (!EMAIL_RE.test(email)) {
      return this.result(email, 'INVALID', false, false, false, 100, 'Malformed email address');
    }

    const [localPart, domain] = email.split('@') as [string, string];
    const disposable = DISPOSABLE.has(domain);
    const roleAccount = ROLE_PREFIXES.has(localPart);

    const mxOk = await this.hasMx(domain);
    if (!mxOk) {
      return this.result(
        email,
        'INVALID',
        false,
        disposable,
        roleAccount,
        95,
        'Domain has no mail (MX) records — cannot receive email',
      );
    }

    if (disposable) {
      return this.result(email, 'RISKY', true, true, roleAccount, 80, 'Disposable email domain');
    }
    if (roleAccount) {
      return this.result(
        email,
        'RISKY',
        true,
        false,
        true,
        55,
        'Role-based address (not a specific person)',
      );
    }

    // Good syntax + live MX + not disposable/role. Mailbox existence not
    // SMTP-confirmed, so a small residual risk remains.
    return this.result(email, 'VALID', true, false, false, 15, 'Valid format with live mail server');
  }

  private async hasMx(domain: string): Promise<boolean> {
    try {
      const records = await resolveMx(domain);
      return records.length > 0;
    } catch (e) {
      this.logger.debug(`MX lookup failed for ${domain}: ${e instanceof Error ? e.message : e}`);
      return false;
    }
  }

  private result(
    email: string,
    status: EmailStatus,
    mxOk: boolean,
    disposable: boolean,
    roleAccount: boolean,
    riskScore: number,
    reason: string,
  ): VerificationResult {
    return { email, status, mxOk, disposable, roleAccount, riskScore, reason };
  }
}
