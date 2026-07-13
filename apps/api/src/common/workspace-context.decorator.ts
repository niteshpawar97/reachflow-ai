import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { WorkspaceContext, WorkspaceScopedRequest } from './workspace.guard';

/** The resolved workspace context ({ id, role }) set by WorkspaceGuard. */
export const WorkspaceCtx = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): WorkspaceContext | undefined => {
    return ctx.switchToHttp().getRequest<WorkspaceScopedRequest>().workspace;
  },
);

/** Just the active workspace id (set by WorkspaceGuard). */
export const WorkspaceId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    return ctx.switchToHttp().getRequest<WorkspaceScopedRequest>().workspace?.id;
  },
);
