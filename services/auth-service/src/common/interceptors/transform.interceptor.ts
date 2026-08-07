import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RAW_RESPONSE } from '../decorators/raw-response.decorator';

export interface ResponseEnvelope<T> {
  success: true;
  data: T;
  timestamp: string;
}

/**
 * Wraps every successful response in a consistent envelope so all services in
 * the platform return the same shape. Registered globally in main.ts.
 *
 * Handlers marked with `@Raw()` are passed through untouched — the JWKS
 * endpoint uses this because JWKS has a standardized `{ keys: [...] }` shape.
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ResponseEnvelope<T> | T>
{
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ResponseEnvelope<T> | T> {
    const isRaw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isRaw) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
