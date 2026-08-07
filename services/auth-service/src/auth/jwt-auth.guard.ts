import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { KeysService } from '../keys/keys.service';

/** The verified token claims attached to the request. */
export interface AuthUser {
  sub: string;
  email: string;
  roles: string[];
}

/**
 * Protects the auth-service's own routes (profile / email change). It verifies
 * the JWT locally with KeysService (this service signed it, so it holds the
 * key — no JWKS needed). The token can arrive as a Bearer header or the
 * HttpOnly cookie, forced with `X-Auth-Source` exactly like the ecom-api guard.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly keys: KeysService,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing credentials');
    }

    try {
      const claims = this.keys.verifyAccessToken(token);
      (request as Request & { user: AuthUser }).user = {
        sub: claims.sub,
        email: claims.email,
        roles: claims.roles,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractToken(request: Request): string | null {
    const source = String(request.headers['x-auth-source'] ?? '').toLowerCase();
    const bearer = this.fromBearer(request);
    const cookie = this.fromCookie(request);

    if (source === 'bearer') return bearer;
    if (source === 'cookie') return cookie;
    return bearer ?? cookie; // auto
  }

  private fromBearer(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header) return null;
    const [scheme, value] = header.split(' ');
    return scheme === 'Bearer' && value ? value : null;
  }

  private fromCookie(request: Request): string | null {
    const cookieName = this.config.get<string>('cookie.name')!;
    const cookies = (request as Request & { cookies?: Record<string, string> })
      .cookies;
    return cookies?.[cookieName] ?? null;
  }
}
