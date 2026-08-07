import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Health probes. `/health` is a cheap liveness check (is the process up?);
 * `/health/ready` is a readiness check that also verifies the DB is reachable,
 * for load balancers / orchestrators that gate traffic on dependencies.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly config: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  @Get()
  check() {
    return {
      status: 'ok',
      service: 'auth-service',
      environment: this.config.get<string>('nodeEnv'),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async ready() {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException({ status: 'error', db: 'down' });
    }
    return { status: 'ok', db: 'up', timestamp: new Date().toISOString() };
  }
}
