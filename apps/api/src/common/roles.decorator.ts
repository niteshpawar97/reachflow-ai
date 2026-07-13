import { SetMetadata } from '@nestjs/common';
import { WorkspaceRole } from '@reachflow/database';

export const ROLES_KEY = 'workspace_roles';

/** Restrict a route to the given workspace roles (enforced by WorkspaceGuard). */
export const Roles = (...roles: WorkspaceRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
