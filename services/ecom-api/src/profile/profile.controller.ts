import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser, JwtAuthGuard } from '../auth/jwt-auth.guard';

/**
 * A PROTECTED endpoint that simply echoes the verified token claims. Useful to
 * prove end-to-end that the ecom-api trusts tokens minted by the auth service:
 *
 *   GET /api/profile   (requires: Authorization: Bearer <token>)
 */
@Controller('profile')
export class ProfileController {
  @Get()
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return {
      message: 'Token verified via the auth service JWKS 🎉',
      user,
    };
  }
}
