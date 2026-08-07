import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF protection for COOKIE-authenticated requests (double-submit cookie).
 * The auth-service sets a readable `csrf_token` cookie on login; state-changing
 * requests must echo it in `X-CSRF-Token`. Bearer clients (no csrf cookie) are
 * exempt — a cross-site attacker can't set an Authorization header anyway.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method.toUpperCase())) return true;

    const cookieName = this.config.get<string>('csrf.cookieName')!;
    const cookies = (req as Request & { cookies?: Record<string, string> })
      .cookies;
    const csrfCookie = cookies?.[cookieName];
    if (!csrfCookie) return true; // not a cookie session -> exempt

    const header = req.headers[this.config.get<string>('csrf.headerName')!];
    if (typeof header === 'string' && header === csrfCookie) return true;

    throw new ForbiddenException('CSRF token missing or invalid');
  }
}
