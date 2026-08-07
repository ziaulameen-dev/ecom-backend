import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthUser } from './jwt-auth.guard';

/**
 * Convenience param decorator to pull the verified user off the request:
 *
 *   @Get('profile')
 *   @UseGuards(JwtAuthGuard)
 *   me(@CurrentUser() user: AuthUser) { ... }
 *
 * Only meaningful on routes protected by JwtAuthGuard (which sets `req.user`).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user: AuthUser }>();
    return request.user;
  },
);
