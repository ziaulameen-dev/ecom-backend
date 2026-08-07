import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

/**
 * A Controller maps incoming HTTP requests to handler methods. The string in
 * `@Controller('health')` is the route prefix, so every handler here lives
 * under `/health`.
 *
 * Controllers should be thin: read the request, call a service, return the
 * result. No business logic lives here.
 */
@Controller('health')
export class HealthController {
  // The HealthService is injected via the constructor by Nest's DI container.
  constructor(private readonly healthService: HealthService) {}

  /**
   * GET /health
   * Liveness/readiness probe. Returns 200 with basic runtime info.
   * Whatever we return is automatically serialized to JSON by Nest.
   */
  @Get()
  check() {
    return this.healthService.check();
  }
}
