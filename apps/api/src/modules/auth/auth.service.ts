import { createHash, randomBytes } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService, User } from '@reachflow/database';
import * as bcrypt from 'bcryptjs';
import type { LoginDto, RegisterDto } from './dto/auth.dto';

export interface RequestContext {
  ip?: string;
  userAgent?: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  roleGlobal: User['roleGlobal'];
  emailVerifiedAt: Date | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto, ctx: RequestContext): Promise<AuthTokens> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { email: dto.email, name: dto.name ?? null, passwordHash },
    });
    return this.issueTokens(user, ctx);
  }

  async login(dto: LoginDto, ctx: RequestContext): Promise<AuthTokens> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
    });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issueTokens(user, ctx);
  }

  /** Rotate: validate the presented refresh token, revoke it, issue a fresh pair. */
  async refresh(refreshToken: string, ctx: RequestContext): Promise<AuthTokens> {
    const tokenHash = this.hashToken(refreshToken);
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: { user: true },
    });
    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    // Reuse of an already-revoked token => likely theft: revoke every session for the user.
    if (session.revokedAt) {
      await this.prisma.session.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token already used');
    }
    if (session.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }
    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(session.user, ctx);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.session.updateMany({
      where: { refreshTokenHash: tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string): Promise<{
    user: PublicUser;
    workspaces: Array<{ id: string; name: string; slug: string; role: string }>;
  }> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: { memberships: { include: { workspace: true } } },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return {
      user: this.toPublicUser(user),
      workspaces: user.memberships
        .filter((m) => m.workspace.deletedAt === null)
        .map((m) => ({
          id: m.workspace.id,
          name: m.workspace.name,
          slug: m.workspace.slug,
          role: m.role,
        })),
    };
  }

  private async issueTokens(user: User, ctx: RequestContext): Promise<AuthTokens> {
    const accessToken = await this.jwt.signAsync({ sub: user.id, email: user.email });

    const refreshToken = randomBytes(32).toString('hex');
    const refreshTtl = Number(this.config.get<string>('JWT_REFRESH_TTL', '1209600'));
    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: this.hashToken(refreshToken),
        userAgent: ctx.userAgent ?? null,
        ip: ctx.ip ?? null,
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
      },
    });

    return { accessToken, refreshToken, user: this.toPublicUser(user) };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      roleGlobal: user.roleGlobal,
      emailVerifiedAt: user.emailVerifiedAt,
    };
  }
}
