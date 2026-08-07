import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  ThrottlerStorage,
} from '@nestjs/throttler';

/**
 * A ThrottlerGuard that is a no-op unless `RATE_LIMIT_ENABLED=true`.
 *
 * We register it globally but let `shouldSkip()` short-circuit when the feature
 * is off — so a single env var turns per-IP rate limiting on/off, and the
 * per-route `@Throttle()` limits on the auth endpoints only bite in production.
 */
@Injectable()
export class ConditionalThrottlerGuard extends ThrottlerGuard {
  constructor(
    // These tokens are custom provider tokens, so they need explicit @Inject.
    @InjectThrottlerOptions()
    options: ConstructorParameters<typeof ThrottlerGuard>[0],
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly config: ConfigService,
  ) {
    super(options, storageService, reflector);
  }

  protected shouldSkip(): Promise<boolean> {
    return Promise.resolve(!this.config.get<boolean>('rateLimit.enabled'));
  }
}
