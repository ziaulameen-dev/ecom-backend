import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

/**
 * A Module groups related pieces (controllers + providers) into a cohesive
 * feature. This one owns everything related to health checks.
 *
 * - `controllers`: classes that handle incoming requests for this feature.
 * - `providers`: injectable services this module creates and can share.
 *
 * The root AppModule imports this module to wire it into the app.
 */
@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
