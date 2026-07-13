import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService, WorkspaceRole } from '@reachflow/database';
import type { AuthedRequest } from '../modules/auth/guards/jwt-auth.guard';
import { ROLES_KEY } from './roles.decorator';

export interface WorkspaceContext {
  id: string;
  role: WorkspaceRole;
}

export interface WorkspaceScopedRequest extends AuthedRequest {
  workspace?: WorkspaceContext;
}

/**
 * Resolves the active workspace for the request (from :workspaceId / :id route
 * param, else the X-Workspace-Id header), verifies the authenticated user is a
 * member, attaches req.workspace = { id, role }, and enforces any @Roles().
 *
 * Must run AFTER JwtAuthGuard (needs req.user). Non-members get 404 so we never
 * leak the existence of workspaces the caller can't access.
 */
@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<WorkspaceScopedRequest>();
    if (!req.user) {
      throw new UnauthorizedException('Not authenticated');
    }

    const workspaceId = this.resolveWorkspaceId(req);
    if (!workspaceId) {
      throw new BadRequestException('Missing workspace id');
    }

    const membership = await this.prisma.workspaceMember.findFirst({
      where: { userId: req.user.userId, workspaceId, workspace: { deletedAt: null } },
    });
    if (!membership) {
      throw new NotFoundException('Workspace not found');
    }

    req.workspace = { id: workspaceId, role: membership.role };

    const required = this.reflector.getAllAndOverride<WorkspaceRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required && required.length > 0 && !required.includes(membership.role)) {
      throw new ForbiddenException('Insufficient workspace role');
    }

    return true;
  }

  private resolveWorkspaceId(req: WorkspaceScopedRequest): string | undefined {
    const params = req.params as Record<string, string> | undefined;
    const fromParam = params?.workspaceId ?? params?.id;
    if (fromParam) {
      return fromParam;
    }
    const header = req.headers['x-workspace-id'];
    return Array.isArray(header) ? header[0] : header;
  }
}
