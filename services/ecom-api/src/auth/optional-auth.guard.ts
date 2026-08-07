import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { DenylistService } from './denylist.service';
import { AuthUser } from './jwt-auth.guard';
import { JwksService } from './jwks.service';

/**
 * Like JwtAuthGuard but NON-blocking: it never rejects. If a valid token is
 * present it sets `req.user`; otherwise (missing/invalid/revoked) it leaves
 * `req.user` undefined and still allows the request. Used for cart routes,
 * which work for guests but attach to the user's cart when logged in.
 */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(
    private readonly jwks: JwksService,
    private readonly config: ConfigService,
    private readonly denylist: DenylistService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) return true;

    try {
      const decoded = jwt.decode(token, { complete: true });
      const kid = decoded?.header?.kid;
      if (typeof kid !== 'string') return true;
      const publicKey = await this.jwks.getPublicKey(kid);
      const payload = jwt.verify(token, publicKey, {
        algorithms: ['RS256'],
        issuer: this.config.get<string>('jwt.issuer'),
        audience: this.config.get<string>('jwt.audience'),
      }) as jwt.JwtPayload;

      if (await this.denylist.isDenied(payload.sid as string)) return true;

      const user: AuthUser = {
        sub: payload.sub as string,
        email: (payload.email as string) ?? '',
        roles: (payload.roles as string[]) ?? [],
      };
      (request as Request & { user?: AuthUser }).user = user;
    } catch {
      // Invalid/expired token -> treat as guest (no throw).
    }
    return true;
  }

  private extractToken(request: Request): string | null {
    const source = String(request.headers['x-auth-source'] ?? '').toLowerCase();
    const bearer = this.fromBearer(request);
    const cookie = this.fromCookie(request);
    if (source === 'bearer') return bearer;
    if (source === 'cookie') return cookie;
    return bearer ?? cookie;
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
