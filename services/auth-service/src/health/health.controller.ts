import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * GET /health — liveness probe for the auth service. Public (no token needed)
 * so nginx and Docker can check it.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  check() {
    return {
      status: 'ok',
      service: 'auth-service',
      environment: this.config.get<string>('nodeEnv'),
      timestamp: new Date().toISOString(),
    };
  }
}
