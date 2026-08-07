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
 *
 * On login in cookie mode we set a readable `csrf_token` cookie. For any
 * state-changing request the client must copy it into an `X-CSRF-Token` header;
 * the browser's same-origin policy stops a malicious site from reading the
 * cookie, so a cross-site forged request can't produce a matching header.
 *
 * Bearer clients never carry the csrf cookie (they authenticate with a header,
 * which a cross-site attacker can't set anyway), so they're skipped.
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

    // No csrf cookie -> not a cookie session (bearer or pre-login) -> exempt.
    if (!csrfCookie) return true;

    const header = req.headers[this.config.get<string>('csrf.headerName')!];
    if (typeof header === 'string' && header === csrfCookie) return true;

    throw new ForbiddenException('CSRF token missing or invalid');
  }
}
