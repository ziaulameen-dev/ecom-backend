import { Module } from '@nestjs/common';
import { DenylistService } from './denylist.service';
import { JwksService } from './jwks.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OptionalAuthGuard } from './optional-auth.guard';
import { RolesGuard } from './roles.guard';

/**
 * Provides token-verification building blocks to the rest of the API: the JWKS
 * client, the JWT guard, the optional (non-blocking) guard, and the roles
 * guard. Exported so feature modules can use them in `@UseGuards(...)`.
 *
 * NOTE: this module holds NO signing secret — verification uses only the
 * PUBLIC keys fetched from the auth service's JWKS endpoint.
 */
@Module({
  providers: [
    JwksService,
    DenylistService,
    JwtAuthGuard,
    OptionalAuthGuard,
    RolesGuard,
  ],
  exports: [
    JwksService,
    DenylistService,
    JwtAuthGuard,
    OptionalAuthGuard,
    RolesGuard,
  ],
})
export class AuthModule {}
