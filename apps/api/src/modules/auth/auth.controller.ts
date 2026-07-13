import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import type { Request } from 'express';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { AuthService, type AuthTokens, type RequestContext } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import {
  LoginSchema,
  RefreshSchema,
  RegisterSchema,
  type LoginDto,
  type RefreshDto,
  type RegisterDto,
} from './dto/auth.dto';
import { JwtAuthGuard, type AuthUser } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @UsePipes(new ZodValidationPipe(RegisterSchema))
  register(@Body() dto: RegisterDto, @Req() req: Request): Promise<AuthTokens> {
    return this.auth.register(dto, this.ctx(req));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(LoginSchema))
  login(@Body() dto: LoginDto, @Req() req: Request): Promise<AuthTokens> {
    return this.auth.login(dto, this.ctx(req));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(RefreshSchema))
  refresh(@Body() dto: RefreshDto, @Req() req: Request): Promise<AuthTokens> {
    return this.auth.refresh(dto.refreshToken, this.ctx(req));
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ZodValidationPipe(RefreshSchema))
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser): Promise<unknown> {
    return this.auth.me(user.userId);
  }

  private ctx(req: Request): RequestContext {
    return {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };
  }
}
