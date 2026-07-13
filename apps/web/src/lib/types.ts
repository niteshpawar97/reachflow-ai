export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  roleGlobal: 'ADMIN' | 'STAFF' | 'CLIENT';
  emailVerifiedAt: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export type WorkspaceRole = 'ADMIN' | 'STAFF' | 'CLIENT';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  ownerUserId: string;
  createdAt: string;
  role?: WorkspaceRole;
}

export interface WorkspaceSettings {
  id: string;
  workspaceId: string;
  timezone: string;
  sendingWindows: unknown;
  fromIdentity: unknown;
  compliance: unknown;
}

export interface Member {
  userId: string;
  email: string;
  name: string | null;
  role: WorkspaceRole;
  joinedAt: string | null;
}

export interface MeResponse {
  user: User;
  workspaces: Workspace[];
}

export interface ApiError {
  error: { code: string; message: string; details?: unknown; requestId?: string };
}
