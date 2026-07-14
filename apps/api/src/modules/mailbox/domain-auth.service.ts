import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { resolveMx, resolveTxt } from 'node:dns/promises';
import { PrismaService } from '@reachflow/database';
import { MailboxService } from './mailbox.service';

export interface DomainAuthCheck {
  pass: boolean;
  detail: string;
}

export interface DomainAuthReport {
  domain: string;
  mx: DomainAuthCheck;
  spf: DomainAuthCheck;
  dmarc: DomainAuthCheck;
  dkim: DomainAuthCheck;
  overallPass: boolean;
  checkedAt: string;
}

// Selector isn't knowable from DNS alone — probe the ones real providers actually
// publish by default. A miss here means "couldn't confirm", not "DKIM is broken".
const COMMON_DKIM_SELECTORS = [
  'default',
  'google',
  'selector1',
  'selector2',
  'zoho',
  'k1',
  's1',
  's2',
  'dkim',
  'mail',
  'smtp',
];

async function flattenTxt(domain: string): Promise<string[]> {
  try {
    const records = await resolveTxt(domain);
    return records.map((chunks) => chunks.join(''));
  } catch {
    return [];
  }
}

@Injectable()
export class DomainAuthService {
  private readonly logger = new Logger(DomainAuthService.name);

  constructor(
    private readonly mailboxes: MailboxService,
    private readonly prisma: PrismaService,
  ) {}

  /** Runs fresh DNS checks for a mailbox's sending domain and caches the report. */
  async check(workspaceId: string, mailboxId: string): Promise<DomainAuthReport> {
    const mailbox = await this.mailboxes.get(workspaceId, mailboxId);
    const domain = mailbox.email.split('@')[1];
    if (!domain) throw new NotFoundException('Mailbox has no valid email domain');

    const [mx, spf, dmarc, dkim] = await Promise.all([
      this.checkMx(domain),
      this.checkSpf(domain),
      this.checkDmarc(domain),
      this.checkDkim(domain),
    ]);

    const report: DomainAuthReport = {
      domain,
      mx,
      spf,
      dmarc,
      dkim,
      overallPass: mx.pass && spf.pass && dmarc.pass,
      checkedAt: new Date().toISOString(),
    };

    await this.prisma.mailbox.update({
      where: { id: mailboxId },
      data: { domainAuthReport: report as unknown as object, domainAuthCheckedAt: new Date() },
    });

    this.logger.log(`domain auth for ${domain}: mx=${mx.pass} spf=${spf.pass} dmarc=${dmarc.pass} dkim=${dkim.pass}`);
    return report;
  }

  private async checkMx(domain: string): Promise<DomainAuthCheck> {
    try {
      const records = await resolveMx(domain);
      if (records.length === 0) return { pass: false, detail: 'No MX records found' };
      return { pass: true, detail: records.map((r) => r.exchange).join(', ') };
    } catch {
      return { pass: false, detail: 'MX lookup failed (no records or NXDOMAIN)' };
    }
  }

  private async checkSpf(domain: string): Promise<DomainAuthCheck> {
    const txts = await flattenTxt(domain);
    const spf = txts.find((t) => t.toLowerCase().startsWith('v=spf1'));
    if (!spf) return { pass: false, detail: 'No SPF (v=spf1) TXT record found' };
    return { pass: true, detail: spf };
  }

  private async checkDmarc(domain: string): Promise<DomainAuthCheck> {
    const txts = await flattenTxt(`_dmarc.${domain}`);
    const dmarc = txts.find((t) => t.toLowerCase().startsWith('v=dmarc1'));
    if (!dmarc) return { pass: false, detail: 'No DMARC (_dmarc TXT) record found' };
    const policyMatch = /p=([a-z]+)/i.exec(dmarc);
    const policy = policyMatch?.[1]?.toLowerCase();
    if (policy === 'none') {
      return { pass: true, detail: `${dmarc} (policy "none" — monitoring only, not enforced)` };
    }
    return { pass: true, detail: dmarc };
  }

  private async checkDkim(domain: string): Promise<DomainAuthCheck> {
    for (const selector of COMMON_DKIM_SELECTORS) {
      const txts = await flattenTxt(`${selector}._domainkey.${domain}`);
      const dkim = txts.find((t) => /v=dkim1|p=/i.test(t));
      if (dkim) return { pass: true, detail: `selector "${selector}": ${dkim.slice(0, 200)}` };
    }
    return {
      pass: false,
      detail: `No DKIM record found under common selectors (${COMMON_DKIM_SELECTORS.join(', ')}) — may use a custom selector`,
    };
  }
}
