import { Module } from '@nestjs/common';
import { JwksService } from './jwks.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

/**
 * Provides token-verification building blocks to the rest of the API:
 * the JWKS client, the JWT guard, and the roles guard. Exported so feature
 * modules can `@UseGuards(JwtAuthGuard, RolesGuard)`.
 *
 * NOTE: this module holds NO signing secret — verification uses only the
 * PUBLIC keys fetched from the auth service's JWKS endpoint.
 */
@Module({
  providers: [JwksService, JwtAuthGuard, RolesGuard],
  exports: [JwksService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
