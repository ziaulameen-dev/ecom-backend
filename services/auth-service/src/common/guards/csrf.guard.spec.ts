import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExecutionContext } from '@nestjs/common';
import { CsrfGuard } from './csrf.guard';

const CONFIG: Record<string, string> = {
  'csrf.cookieName': 'csrf_token',
  'csrf.headerName': 'x-csrf-token',
};

function ctx(req: Partial<Record<string, unknown>>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('CsrfGuard', () => {
  const guard = new CsrfGuard({
    get: (k: string) => CONFIG[k],
  } as unknown as ConfigService);

  it('allows safe methods without a token', () => {
    expect(guard.canActivate(ctx({ method: 'GET', headers: {} }))).toBe(true);
  });

  it('allows requests with no csrf cookie (bearer / pre-login)', () => {
    expect(
      guard.canActivate(ctx({ method: 'POST', headers: {}, cookies: {} })),
    ).toBe(true);
  });

  it('rejects a cookie session missing the header', () => {
    expect(() =>
      guard.canActivate(
        ctx({ method: 'POST', headers: {}, cookies: { csrf_token: 'abc' } }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejects a mismatched header', () => {
    expect(() =>
      guard.canActivate(
        ctx({
          method: 'PATCH',
          headers: { 'x-csrf-token': 'nope' },
          cookies: { csrf_token: 'abc' },
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows a matching double-submit token', () => {
    expect(
      guard.canActivate(
        ctx({
          method: 'PATCH',
          headers: { 'x-csrf-token': 'abc' },
          cookies: { csrf_token: 'abc' },
        }),
      ),
    ).toBe(true);
  });
});
