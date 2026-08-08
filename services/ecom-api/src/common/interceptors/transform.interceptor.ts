import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
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
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ResponseEnvelope<T>> {
    // SSE streams emit their own MessageEvents — don't wrap them in the envelope.
    const req = context.switchToHttp().getRequest<{ url?: string }>();
    if (req?.url?.includes('/admin/events')) {
      return next.handle();
    }
    // `next.handle()` runs the route handler; we transform its output here.
    return next.handle().pipe(
      map((data) => {
        // Don't wrap binary/streamed responses (e.g. return images) — they must
        // pass through untouched, not be JSON-serialized.
        if (data instanceof StreamableFile) {
          return data as unknown as ResponseEnvelope<T>;
        }
        return {
          success: true as const,
          data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
