import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * The shape every successful response is wrapped in. Having a consistent
 * envelope makes life easier for API consumers.
 */
export interface ResponseEnvelope<T> {
  success: true;
  data: T;
  timestamp: string;
}

/**
 * An Interceptor can run logic BEFORE a handler runs and AFTER it returns.
 * This one takes whatever a controller returns and wraps it in a standard
 * envelope: { success, data, timestamp }.
 *
 * Registered globally in main.ts, so it applies to every route.
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ResponseEnvelope<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ResponseEnvelope<T>> {
    // `next.handle()` runs the route handler; we transform its output here.
    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
