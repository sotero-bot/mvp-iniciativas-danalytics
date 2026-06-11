import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { AppError, AppErrorCode } from './AppError';

interface SerializedError {
  code: AppErrorCode | string;
  message: string;
  details?: unknown;
  statusCode: number;
}

@Catch()
export class ErrorCodeFilter implements ExceptionFilter {
  private readonly logger = new Logger(ErrorCodeFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const payload = this.toPayload(exception);

    if (payload.statusCode >= 500) {
      this.logger.error(`${payload.code}: ${payload.message}`, this.extractStack(exception));
    } else {
      this.logger.warn(`${payload.code}: ${payload.message}`);
    }

    response.status(payload.statusCode).json(payload);
  }

  private toPayload(exception: unknown): SerializedError {
    if (exception instanceof AppError) {
      return {
        code: exception.code,
        message: exception.message,
        details: exception.details,
        statusCode: exception.statusCode,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const httpResponse = exception.getResponse();
      const message =
        typeof httpResponse === 'string'
          ? httpResponse
          : (httpResponse as { message?: string | string[] })?.message
          ? Array.isArray((httpResponse as { message: string[] }).message)
            ? ((httpResponse as { message: string[] }).message).join(', ')
            : (httpResponse as { message: string }).message
          : exception.message;
      const code = this.mapHttpStatusToCode(status);
      const details = typeof httpResponse === 'object' && httpResponse !== null ? httpResponse : undefined;
      return { code, message, details, statusCode: status };
    }

    const fallbackMessage =
      exception instanceof Error ? exception.message : 'Unexpected error';
    return {
      code: 'UNKNOWN',
      message: fallbackMessage,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    };
  }

  private mapHttpStatusToCode(status: number): AppErrorCode {
    if (status === 401) return 'AUTH_TOKEN_INVALID';
    if (status === 403) return 'FORBIDDEN';
    if (status === 400) return 'VALIDATION_ERROR';
    if (status === 404) return 'UNKNOWN';
    return 'UNKNOWN';
  }

  private extractStack(exception: unknown): string | undefined {
    if (exception instanceof Error && exception.stack) return exception.stack;
    return undefined;
  }
}
