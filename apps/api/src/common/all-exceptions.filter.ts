import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ZodError } from 'zod';

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

/**
 * Catches every unhandled exception and renders the standard API error shape:
 *   { error: { code, message, details?, requestId? } }
 * - ZodError            -> 422 with per-field details
 * - HttpException       -> its status + code derived from the status
 * - anything else       -> 500 (message hidden in production)
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { id?: string }>();
    const requestId = req.id;

    const { status, body } = this.normalize(exception);
    if (requestId) {
      body.error.requestId = requestId;
    }

    if (status >= 500) {
      this.logger.error(`${req.method} ${req.url} -> ${status}`, this.stack(exception));
    }

    res.status(status).json(body);
  }

  private normalize(exception: unknown): { status: number; body: ErrorBody } {
    if (exception instanceof ZodError) {
      return {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        body: {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: exception.issues.map((i) => ({
              path: i.path.join('.'),
              message: i.message,
              code: i.code,
            })),
          },
        },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const resp = exception.getResponse();
      const message =
        typeof resp === 'string'
          ? resp
          : ((resp as { message?: string | string[] }).message ?? exception.message);
      return {
        status,
        body: {
          error: {
            code: this.codeForStatus(status),
            message: Array.isArray(message) ? message.join('; ') : message,
          },
        },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        error: {
          code: 'INTERNAL_ERROR',
          message:
            process.env.NODE_ENV === 'production'
              ? 'Internal server error'
              : exception instanceof Error
                ? exception.message
                : 'Unknown error',
        },
      },
    };
  }

  private codeForStatus(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'VALIDATION_ERROR',
      429: 'RATE_LIMITED',
    };
    return map[status] ?? 'HTTP_ERROR';
  }

  private stack(exception: unknown): string | undefined {
    return exception instanceof Error ? exception.stack : undefined;
  }
}
