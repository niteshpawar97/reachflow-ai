import { randomBytes } from 'node:crypto';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  PrismaService,
  Workspace,
  WorkspaceMember,
  WorkspaceRole,
} from '@reachflow/database';
import type {
  CreateWorkspaceDto,
  UpdateSettingsDto,
  UpdateWorkspaceDto,
} from './dto/workspace.dto';

export interface WorkspaceView {
  id: string;
  name: string;
  slug: string;
  ownerUserId: string;
  createdAt: Date;
}

@Injectable()
export class WorkspaceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateWorkspaceDto): Promise<WorkspaceView> {
    const slug = await this.resolveSlug(dto.slug, dto.name);
    const ws = await this.prisma.$transaction(async (tx) => {
      const created = await tx.workspace.create({
        data: { name: dto.name, slug, ownerUserId: userId },
      });
      await tx.workspaceMember.create({
        data: {
          workspaceId: created.id,
          userId,
          role: WorkspaceRole.ADMIN,
          joinedAt: new Date(),
        },
      });
      await tx.workspaceSettings.create({ data: { workspaceId: created.id } });
      return created;
    });
    return this.toView(ws);
  }

  /** Bootstrap a personal workspace for a newly registered user. */
  createForOwner(userId: string, name: string): Promise<WorkspaceView> {
    return this.create(userId, { name });
  }

  async listForUser(userId: string): Promise<Array<WorkspaceView & { role: WorkspaceRole }>> {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId, workspace: { deletedAt: null } },
      include: { workspace: true },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((m) => ({ ...this.toView(m.workspace), role: m.role }));
  }

  async getForUser(userId: string, workspaceId: string): Promise<WorkspaceView> {
    const { workspace } = await this.requireMember(userId, workspaceId);
    return this.toView(workspace);
  }

  async update(
    userId: string,
    workspaceId: string,
    dto: UpdateWorkspaceDto,
  ): Promise<WorkspaceView> {
    await this.requireRole(userId, workspaceId, WorkspaceRole.ADMIN);
    const updated = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { name: dto.name },
    });
    return this.toView(updated);
  }

  async softDelete(userId: string, workspaceId: string): Promise<void> {
    const { workspace } = await this.requireRole(userId, workspaceId, WorkspaceRole.ADMIN);
    if (workspace.ownerUserId !== userId) {
      throw new ForbiddenException('Only the owner can delete a workspace');
    }
    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { deletedAt: new Date() },
    });
  }

  async getSettings(userId: string, workspaceId: string): Promise<unknown> {
    await this.requireMember(userId, workspaceId);
    const settings = await this.prisma.workspaceSettings.findUnique({ where: { workspaceId } });
    return settings ?? this.prisma.workspaceSettings.create({ data: { workspaceId } });
  }

  async updateSettings(
    userId: string,
    workspaceId: string,
    dto: UpdateSettingsDto,
  ): Promise<unknown> {
    await this.requireRole(userId, workspaceId, WorkspaceRole.ADMIN);
    const patch: {
      timezone?: string;
      sendingWindows?: Prisma.InputJsonValue;
      fromIdentity?: Prisma.InputJsonValue;
      compliance?: Prisma.InputJsonValue;
    } = {};
    if (dto.timezone !== undefined) patch.timezone = dto.timezone;
    if (dto.sendingWindows !== undefined)
      patch.sendingWindows = dto.sendingWindows as Prisma.InputJsonValue;
    if (dto.fromIdentity !== undefined)
      patch.fromIdentity = dto.fromIdentity as Prisma.InputJsonValue;
    if (dto.compliance !== undefined) patch.compliance = dto.compliance as Prisma.InputJsonValue;

    return this.prisma.workspaceSettings.upsert({
      where: { workspaceId },
      create: { workspaceId, ...patch },
      update: patch,
    });
  }

  async listMembers(
    userId: string,
    workspaceId: string,
  ): Promise<
    Array<{ userId: string; email: string; name: string | null; role: WorkspaceRole; joinedAt: Date | null }>
  > {
    await this.requireMember(userId, workspaceId);
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
    return members.map((m) => ({
      userId: m.userId,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  // --- guards / helpers ---

  private async requireMember(
    userId: string,
    workspaceId: string,
  ): Promise<{ membership: WorkspaceMember; workspace: Workspace }> {
    const membership = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId, workspace: { deletedAt: null } },
      include: { workspace: true },
    });
    if (!membership) {
      // 404 (not 403) so we don't reveal existence of workspaces the user can't see.
      throw new NotFoundException('Workspace not found');
    }
    return { membership, workspace: membership.workspace };
  }

  private async requireRole(
    userId: string,
    workspaceId: string,
    role: WorkspaceRole,
  ): Promise<{ membership: WorkspaceMember; workspace: Workspace }> {
    const ctx = await this.requireMember(userId, workspaceId);
    if (role === WorkspaceRole.ADMIN && ctx.membership.role !== WorkspaceRole.ADMIN) {
      throw new ForbiddenException('Admin role required');
    }
    return ctx;
  }

  private async resolveSlug(provided: string | undefined, name: string): Promise<string> {
    if (provided) {
      const taken = await this.prisma.workspace.findUnique({ where: { slug: provided } });
      if (taken) {
        throw new ForbiddenException('Slug already in use');
      }
      return provided;
    }
    const base = this.slugify(name);
    for (let i = 0; i < 5; i++) {
      const candidate = i === 0 ? base : `${base}-${randomBytes(3).toString('hex')}`;
      const taken = await this.prisma.workspace.findUnique({ where: { slug: candidate } });
      if (!taken) {
        return candidate;
      }
    }
    return `${base}-${randomBytes(4).toString('hex')}`;
  }

  private slugify(name: string): string {
    const s = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50);
    return s.length >= 2 ? s : 'workspace';
  }

  private toView(ws: Workspace): WorkspaceView {
    return {
      id: ws.id,
      name: ws.name,
      slug: ws.slug,
      ownerUserId: ws.ownerUserId,
      createdAt: ws.createdAt,
    };
  }
}
