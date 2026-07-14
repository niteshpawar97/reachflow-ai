import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaService, SuppressionReason } from '@reachflow/database';

@Injectable()
export class SuppressionService {
  constructor(private readonly prisma: PrismaService) {}

  /** True if this email must not be sent to in this workspace. */
  async isSuppressed(workspaceId: string, email: string): Promise<boolean> {
    const row = await this.prisma.suppression.findUnique({
      where: { workspaceId_email: { workspaceId, email: email.toLowerCase().trim() } },
    });
    return row != null;
  }

  async add(
    workspaceId: string,
    email: string,
    reason: SuppressionReason,
    note?: string,
  ): Promise<void> {
    const normalized = email.toLowerCase().trim();
    await this.prisma.suppression.upsert({
      where: { workspaceId_email: { workspaceId, email: normalized } },
      create: { workspaceId, email: normalized, reason, note },
      update: { reason, note },
    });
  }

  async list(workspaceId: string) {
    return this.prisma.suppression.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(workspaceId: string, id: string): Promise<void> {
    try {
      await this.prisma.suppression.delete({ where: { id, workspaceId } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Suppression entry not found');
      }
      throw e;
    }
  }

  async addManual(workspaceId: string, email: string, note?: string): Promise<void> {
    const normalized = email.toLowerCase().trim();
    const existing = await this.prisma.suppression.findUnique({
      where: { workspaceId_email: { workspaceId, email: normalized } },
    });
    if (existing) {
      throw new ConflictException('This email is already suppressed');
    }
    await this.add(workspaceId, normalized, SuppressionReason.MANUAL, note);
  }
}
