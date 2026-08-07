import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * The Service holds the business logic. Controllers should stay thin and
 * delegate the actual work here. This makes the logic reusable and easy to
 * unit-test in isolation (without spinning up HTTP).
 *
 * `@Injectable()` marks the class as a "provider" so Nest's dependency
 * injection container can create it and hand it to whoever asks for it.
 */
@Injectable()
export class HealthService {
  // The process start time, captured once when this provider is instantiated.
  private readonly startedAt = Date.now();

  // `ConfigService` is injected by Nest — we did not `new` it ourselves.
  constructor(private readonly config: ConfigService) {}

  /**
   * Builds the health payload. In a real app this is also where you would
   * ping the database, cache, or downstream services and report their status.
   */
  check() {
    return {
      status: 'ok',
      service: 'ecom-api',
      environment: this.config.get<string>('nodeEnv'),
      // Uptime in whole seconds since the process started.
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
    };
  }
}
