import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PrismaService, type Mailbox } from '@reachflow/database';
import { decryptSecret, encryptSecret, encryptionConfigured } from './mailbox.crypto';
import type { CreateMailboxDto, UpdateMailboxDto } from './dto/mailbox.dto';
import { DEFAULT_IMAP_PORT, inferImapHost } from '../inbox/imap-provider-defaults';

export interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
}

/** Public shape — NEVER includes the encrypted secret. */
export type SafeMailbox = Omit<Mailbox, 'secretCiphertext'>;

@Injectable()
export class MailboxService {
  constructor(private readonly prisma: PrismaService) {}

  async create(workspaceId: string, dto: CreateMailboxDto): Promise<SafeMailbox> {
    if (!encryptionConfigured()) {
      throw new BadRequestException(
        'MAILBOX_ENCRYPTION_KEY is not configured on the server — cannot store credentials',
      );
    }

    const secret = this.secretForProvider(dto);
    try {
      const mailbox = await this.prisma.mailbox.create({
        data: {
          workspaceId,
          provider: dto.provider,
          email: dto.email,
          displayName: dto.displayName ?? null,
          dailyLimit: dto.dailyLimit,
          smtpHost: dto.smtpHost ?? null,
          smtpPort: dto.smtpPort ?? null,
          smtpSecure: dto.smtpSecure,
          smtpUsername: dto.smtpUsername ?? null,
          secretCiphertext: secret ? encryptSecret(secret) : null,
        },
      });
      return this.sanitize(mailbox);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('A mailbox with this email already exists');
      }
      throw e;
    }
  }

  async list(workspaceId: string): Promise<SafeMailbox[]> {
    const rows = await this.prisma.mailbox.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((m) => this.sanitize(m));
  }

  async get(workspaceId: string, id: string): Promise<SafeMailbox> {
    return this.sanitize(await this.requireMailbox(workspaceId, id));
  }

  async update(workspaceId: string, id: string, dto: UpdateMailboxDto): Promise<SafeMailbox> {
    const existing = await this.requireMailbox(workspaceId, id);

    const data: Prisma.MailboxUpdateInput = {
      ...(dto.displayName !== undefined ? { displayName: dto.displayName } : {}),
      ...(dto.dailyLimit !== undefined ? { dailyLimit: dto.dailyLimit } : {}),
      ...(dto.smtpHost !== undefined ? { smtpHost: dto.smtpHost } : {}),
      ...(dto.smtpPort !== undefined ? { smtpPort: dto.smtpPort } : {}),
      ...(dto.smtpSecure !== undefined ? { smtpSecure: dto.smtpSecure } : {}),
      ...(dto.smtpUsername !== undefined ? { smtpUsername: dto.smtpUsername } : {}),
      ...(dto.warmupEnabled !== undefined ? { warmupEnabled: dto.warmupEnabled } : {}),
    };

    // Re-encrypt only when a new password is supplied.
    if (dto.smtpPassword) {
      if (!encryptionConfigured()) {
        throw new BadRequestException('MAILBOX_ENCRYPTION_KEY is not configured');
      }
      data.secretCiphertext = encryptSecret(JSON.stringify({ password: dto.smtpPassword }));
    }

    const updated = await this.prisma.mailbox.update({ where: { id: existing.id }, data });
    return this.sanitize(updated);
  }

  async remove(workspaceId: string, id: string): Promise<void> {
    const existing = await this.requireMailbox(workspaceId, id);
    await this.prisma.mailbox.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * INTERNAL — decrypts the stored secret for actual sending (worker use).
   * Not exposed by the controller. Returns a parsed credential object.
   */
  async getCredentials(
    workspaceId: string,
    id: string,
  ): Promise<Record<string, unknown> | null> {
    const mailbox = await this.requireMailbox(workspaceId, id);
    if (!mailbox.secretCiphertext) return null;
    return JSON.parse(decryptSecret(mailbox.secretCiphertext)) as Record<string, unknown>;
  }

  /** Effective IMAP connection settings for a mailbox — explicit overrides win,
   * else inferred from the SMTP host (same account creds in almost all cases).
   * Returns null when there's no password or no host to connect to. */
  async getImapConfig(workspaceId: string, id: string): Promise<ImapConfig | null> {
    const mailbox = await this.requireMailbox(workspaceId, id);
    const host = mailbox.imapHost ?? inferImapHost(mailbox.smtpHost);
    if (!host) return null;

    const creds = await this.getCredentials(workspaceId, id);
    const password = creds?.password;
    if (typeof password !== 'string') return null;

    return {
      host,
      port: mailbox.imapPort ?? DEFAULT_IMAP_PORT,
      secure: mailbox.imapSecure,
      username: mailbox.imapUsername ?? mailbox.smtpUsername ?? mailbox.email,
      password,
    };
  }

  /** Advance the IMAP sync cursor after a successful poll. */
  async updateImapCursor(mailboxId: string, lastUid: number): Promise<void> {
    await this.prisma.mailbox.update({
      where: { id: mailboxId },
      data: { imapLastUid: lastUid, imapLastSyncAt: new Date() },
    });
  }

  private async requireMailbox(workspaceId: string, id: string): Promise<Mailbox> {
    const mailbox = await this.prisma.mailbox.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!mailbox) {
      throw new NotFoundException('Mailbox not found');
    }
    return mailbox;
  }

  private secretForProvider(dto: CreateMailboxDto): string | null {
    if (dto.provider === 'SMTP' && dto.smtpPassword) {
      return JSON.stringify({ password: dto.smtpPassword });
    }
    return null; // OAuth providers store tokens later, via the OAuth callback
  }

  private sanitize(mailbox: Mailbox): SafeMailbox {
    const { secretCiphertext: _omit, ...safe } = mailbox;
    return safe;
  }
}
