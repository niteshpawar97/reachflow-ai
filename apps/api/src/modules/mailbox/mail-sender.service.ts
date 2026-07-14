import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { PrismaService } from '@reachflow/database';
import { MailboxService } from './mailbox.service';

export interface OutgoingMessage {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
}

export interface SendResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
  /** True when the recipient was permanently rejected (SMTP 5xx at RCPT TO) —
   * a hard bounce, distinct from a transient failure that's worth retrying. */
  bounced?: boolean;
  bounceReason?: string;
}

const PERMANENT_BOUNCE_HINTS =
  /no such user|user unknown|mailbox unavailable|does not exist|invalid recipient|recipient rejected|address rejected|mailbox not found/i;

/** SMTP 5xx = permanent failure (bounce). 4xx = transient (worth retrying). */
function isPermanentSmtpFailure(e: unknown): boolean {
  const responseCode = (e as { responseCode?: number })?.responseCode;
  if (typeof responseCode === 'number') return responseCode >= 500 && responseCode < 600;
  const message = e instanceof Error ? e.message : String(e);
  return PERMANENT_BOUNCE_HINTS.test(message);
}

/**
 * Real SMTP sending via nodemailer. Builds a transport from a mailbox's
 * decrypted credentials, enforces the daily cap, and tracks sentToday.
 * Only SMTP mailboxes send today; GMAIL/M365 arrive with OAuth.
 */
@Injectable()
export class MailSenderService {
  private readonly logger = new Logger(MailSenderService.name);

  constructor(
    private readonly mailboxes: MailboxService,
    private readonly prisma: PrismaService,
  ) {}

  async sendViaMailbox(
    workspaceId: string,
    mailboxId: string,
    msg: OutgoingMessage,
  ): Promise<SendResult> {
    const mailbox = await this.mailboxes.get(workspaceId, mailboxId); // sanitized (no secret)

    if (mailbox.provider !== 'SMTP') {
      throw new BadRequestException('Only SMTP mailboxes can send right now');
    }
    if (!mailbox.smtpHost || !mailbox.smtpPort || !mailbox.smtpUsername) {
      throw new BadRequestException('Mailbox is missing SMTP configuration');
    }
    if (mailbox.status === 'PAUSED') {
      throw new BadRequestException('Mailbox is paused');
    }
    if (mailbox.sentToday >= mailbox.dailyLimit) {
      throw new BadRequestException(
        `Daily send limit reached (${mailbox.sentToday}/${mailbox.dailyLimit})`,
      );
    }

    const creds = await this.mailboxes.getCredentials(workspaceId, mailboxId);
    const password = creds?.password;
    if (typeof password !== 'string') {
      throw new BadRequestException('Mailbox has no stored password');
    }

    const transport = this.buildTransport({
      host: mailbox.smtpHost,
      port: mailbox.smtpPort,
      username: mailbox.smtpUsername,
      password,
      useStartTls: mailbox.smtpSecure,
    });

    const from = mailbox.displayName
      ? `"${mailbox.displayName}" <${mailbox.email}>`
      : mailbox.email;

    try {
      const info = await transport.sendMail({
        from,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
        replyTo: msg.replyTo,
      });

      await this.prisma.mailbox.update({
        where: { id: mailbox.id },
        data: { sentToday: { increment: 1 }, status: 'ACTIVE', lastError: null },
      });

      this.logger.log(`sent via ${mailbox.email} -> ${msg.to} (${info.messageId})`);
      return {
        messageId: info.messageId,
        accepted: (info.accepted ?? []).map(String),
        rejected: (info.rejected ?? []).map(String),
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'SMTP send failed';

      // A permanent rejection is a bounce, not a mailbox/transport problem —
      // don't mark the MAILBOX as errored, just report it to the caller so the
      // campaign sender can suppress the recipient instead of retrying forever.
      if (isPermanentSmtpFailure(e)) {
        this.logger.warn(`bounce via ${mailbox.email} -> ${msg.to}: ${message}`);
        return {
          messageId: '',
          accepted: [],
          rejected: [msg.to],
          bounced: true,
          bounceReason: message.slice(0, 300),
        };
      }

      await this.prisma.mailbox.update({
        where: { id: mailbox.id },
        data: { status: 'ERROR', lastError: message.slice(0, 500) },
      });
      this.logger.error(`send failed via ${mailbox.email}: ${message}`);
      throw new ServiceUnavailableException(`SMTP send failed: ${message}`);
    } finally {
      transport.close();
    }
  }

  /** Send a small test email (defaults to the mailbox's own address). */
  async sendTest(workspaceId: string, mailboxId: string, to?: string): Promise<SendResult> {
    const mailbox = await this.mailboxes.get(workspaceId, mailboxId);
    return this.sendViaMailbox(workspaceId, mailboxId, {
      to: to ?? mailbox.email,
      subject: 'ReachFlow test email ✓',
      text: 'This is a test from ReachFlow AI. Your SMTP mailbox is working.',
      html: '<p>This is a test from <b>ReachFlow AI</b>. Your SMTP mailbox is working. ✓</p>',
    });
  }

  private buildTransport(opts: {
    host: string;
    port: number;
    username: string;
    password: string;
    useStartTls: boolean;
  }): Transporter {
    // Port 465 = implicit TLS (secure). 587/25 = STARTTLS upgrade.
    const secure = opts.port === 465;
    return createTransport({
      host: opts.host,
      port: opts.port,
      secure,
      requireTLS: !secure && opts.useStartTls,
      auth: { user: opts.username, pass: opts.password },
    });
  }
}
