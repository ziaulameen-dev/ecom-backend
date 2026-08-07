import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * An Exception Filter catches errors thrown anywhere in the request lifecycle
 * and turns them into a consistent JSON error response — so clients never see
 * raw stack traces and every error looks the same.
 *
 * `@Catch()` with no arguments means "catch everything", including unexpected
 * (non-HttpException) errors, which we treat as 500s.
 *
 * Registered globally in main.ts.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Known HTTP errors carry their own status + message; everything else is 500.
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    // Log server errors with the stack; client (4xx) errors stay quieter.
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      path: request.url,
      // `message` may be a string or an object (e.g. validation details).
      error: typeof message === 'string' ? { message } : message,
      timestamp: new Date().toISOString(),
    });
  }
}
