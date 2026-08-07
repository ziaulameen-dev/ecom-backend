import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Declare which roles may access a route:
 *
 *   @Roles('admin')
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   create(...) { ... }
 *
 * Enforced by RolesGuard, which reads this metadata.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
