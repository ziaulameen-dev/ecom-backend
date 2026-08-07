import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { JwksService } from './jwks.service';

/** The verified token claims we attach to the request. */
export interface AuthUser {
  sub: string;
  email: string;
  roles: string[];
}

/**
 * Protects routes by verifying the Bearer JWT against the auth service's
 * PUBLIC keys (fetched via JWKS). The flow:
 *
 *   1. Read the `Authorization: Bearer <token>` header.
 *   2. Decode the token header to find which key signed it (`kid`).
 *   3. Fetch that public key from JWKS (cached) via JwksService.
 *   4. Verify signature + `iss`/`aud`/`exp` with jsonwebtoken.
 *   5. Attach the claims to `req.user` for controllers/decorators.
 *
 * This service NEVER holds a signing secret — it only ever sees public keys.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwks: JwksService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing credentials');
    }

    // Decode (without verifying) just to read the `kid` from the header.
    const decoded = jwt.decode(token, { complete: true });
    const kid = decoded?.header?.kid;
    if (!decoded || typeof kid !== 'string') {
      throw new UnauthorizedException('Malformed token');
    }

    let publicKey: string;
    try {
      publicKey = await this.jwks.getPublicKey(kid);
    } catch {
      // Unknown kid / JWKS unreachable -> cannot establish trust.
      throw new UnauthorizedException('Unable to resolve signing key');
    }

    try {
      const payload = jwt.verify(token, publicKey, {
        algorithms: ['RS256'],
        issuer: this.config.get<string>('jwt.issuer'),
        audience: this.config.get<string>('jwt.audience'),
      }) as jwt.JwtPayload;

      const user: AuthUser = {
        sub: payload.sub as string,
        email: (payload.email as string) ?? '',
        roles: (payload.roles as string[]) ?? [],
      };
      (request as Request & { user: AuthUser }).user = user;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  /**
   * Resolve the token from EITHER a Bearer header (mobile / other services) OR
   * the HttpOnly cookie (browser). Clients may force a source with the
   * `X-Auth-Source` header:
   *
   *   - `bearer` -> only the Authorization header
   *   - `cookie` -> only the cookie
   *   - absent   -> auto: prefer the Authorization header, else the cookie
   */
  private extractToken(request: Request): string | null {
    const source = String(
      request.headers['x-auth-source'] ?? '',
    ).toLowerCase();
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
    const cookieName = this.config.get<string>('jwt.cookieName')!;
    const cookies = (request as Request & { cookies?: Record<string, string> })
      .cookies;
    return cookies?.[cookieName] ?? null;
  }
}
